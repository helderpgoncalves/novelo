"""Calibração (retroalimentação da procura observada), com valores calculados à mão.

ADR «Captura anual é derivada» (#53) e docs/engenharia/dados-e-modelo.md §Calibração:
janela de 12 semanas, mediana móvel, pseudo-contagem k=4 visitas (local) / k=8 semanas (freguesia),
captura anual derivada (taxa × degrau), limitada pela procura D_z. O `q` da APA nunca entra aqui:
a procura entra como argumento (`demand_kg_year`) e nunca é recalculada dentro do módulo.
"""

from datetime import UTC, datetime, timedelta

import pytest

from novelo.domain.calibration import (
    PSEUDO_K_LOCAL,
    PSEUDO_K_PARISH,
    WINDOW_WEEKS,
    Calibration,
    Reading,
    annual_capture,
    blend,
    conversion_ratio,
    generation_rate_kg_day,
    improved_prior,
    median,
    observed_weeks,
    observed_weight,
    on_demand_capture_readings,
    pooled_kg_per_bag,
    sample_label,
    visit_rates,
    weekly_means,
    weekly_request_rate,
)
from novelo.domain.vocab import CalibrationMetric, CalibrationScope

# --- Janela e pseudo-contagem ---


def test_window_is_twelve_weeks_and_ks_are_the_documented_ones() -> None:
    assert WINDOW_WEEKS == 12
    assert PSEUDO_K_LOCAL == 4  # visitas (métricas por local)
    assert PSEUDO_K_PARISH == 8  # semanas (métricas por freguesia)


def test_median_of_odd_and_even_lists() -> None:
    assert median([3.0, 1.0, 2.0]) == 2.0
    assert median([4.0, 1.0, 3.0, 2.0]) == 2.5  # (2 + 3) / 2
    assert median([7.5]) == 7.5


def test_median_of_empty_list_raises() -> None:
    with pytest.raises(ValueError, match="vazia"):
        median([])


def test_median_ignores_nothing_it_is_given() -> None:
    # Um outlier não arrasta a mediana (motivo da escolha: robusteza a falhas de pesagem mal colocadas).
    assert median([4.0, 4.1, 3.9, 4.0, 400.0]) == 4.0


def test_observed_weight_is_n_over_n_plus_k() -> None:
    assert observed_weight(0, 4) == 0.0
    assert observed_weight(2, 4) == pytest.approx(2 / 6)  # o prior ainda pesa 4/6
    assert observed_weight(4, 4) == pytest.approx(0.5)  # à 4.ª visita empata
    assert observed_weight(5, 4) == pytest.approx(5 / 9)  # domina
    assert observed_weight(3, 8) == pytest.approx(3 / 11)


def test_blend_with_no_samples_is_exactly_the_prior() -> None:
    assert blend(0.18, 0.36, 0, 4) == 0.18


def test_blend_prior_taxa_with_two_visits() -> None:
    # (4·0,18 + 2·0,36) ÷ 6 = 1,44 ÷ 6 = 0,24 — o observado ainda não domina (peso 1/3).
    assert blend(0.18, 0.36, 2, 4) == pytest.approx(0.24)


def test_blend_at_four_visits_observed_ties_the_prior() -> None:
    # (4·0,18 + 4·0,36) ÷ 8 = 2,16 ÷ 8 = 0,27 — meio caminho: o observado empata o prior.
    assert blend(0.18, 0.36, 4, 4) == pytest.approx(0.27)


def test_blend_of_bag_weight_with_twelve_units() -> None:
    # (4·25 + 12·10) ÷ 16 = 220 ÷ 16 = 13,75 kg por saco.
    assert blend(25.0, 10.0, 12, 4) == pytest.approx(13.75)


def test_blend_rejects_negative_prior_or_observed() -> None:
    with pytest.raises(ValueError):
        blend(-0.1, 0.3, 2, 4)
    with pytest.raises(ValueError):
        blend(0.2, -0.3, 2, 4)


def test_sample_label_prefixes_the_sample_count() -> None:
    assert sample_label(0, 4) == "pressuposto"
    assert sample_label(2, 4) == "estimativa·2"  # abaixo do limiar de dominância
    assert sample_label(4, 4) == "observado·4"  # empata: passa a observado
    assert sample_label(1, 8) == "estimativa·1"
    assert sample_label(12, 8) == "observado·12"


# --- Taxa de geração (kg/dia por local = peso ÷ intervalo) ---


def test_generation_rate_is_weight_over_days() -> None:
    # 6 kg ÷ 7 dias = 0,857142… kg/dia.
    assert generation_rate_kg_day(6.0, 7.0) == pytest.approx(0.857142857, rel=1e-6)


def test_generation_rate_rejects_zero_weight_and_zero_days() -> None:
    with pytest.raises(ValueError, match="peso"):
        generation_rate_kg_day(0.0, 7.0)  # peso 0 = falha de pesagem, nunca taxa
    with pytest.raises(ValueError, match="dias"):
        generation_rate_kg_day(6.0, 0.0)


def test_visit_rates_drop_the_first_visit_and_failed_weighings() -> None:
    # Visitas consecutivas de um local: a primeira não tem intervalo; a 4.ª pesou 0 (falha, não amostra).
    visits = [(None, 2.0), (7.0, 6.0), (14.0, 3.5), (7.0, 0.0), (7.0, 2.8)]
    rates = visit_rates(visits)
    assert rates == pytest.approx([6.0 / 7.0, 3.5 / 14.0, 2.8 / 7.0])  # 0,857…, 0,25, 0,4
    assert median(rates) == pytest.approx(0.4)


def test_visit_rates_empty_without_intervals() -> None:
    assert visit_rates([(None, 5.0)]) == []


# --- Amostras semanais das métricas de freguesia ---


def test_weekly_means_of_bags_per_round() -> None:
    # Semana 1: 4 e 6 sacos → 5,0; semana 2: 5 sacos; semana 4: 10 e 2 → 6,0.
    # A semana 3 não teve ronda: não é amostra (não é 0 sacos por ronda).
    means = weekly_means({1: [4.0, 6.0], 2: [5.0], 4: [10.0, 2.0]})
    assert means == {1: 5.0, 2: 5.0, 4: 6.0}


def test_weekly_request_rate_is_total_over_observed_weeks() -> None:
    assert weekly_request_rate([1, 0, 2], 3) == pytest.approx(1.0)  # 3 pedidos ÷ 3 semanas
    assert weekly_request_rate([2], 8) == pytest.approx(0.25)  # 2 pedidos ÷ 8 semanas observadas


def test_weekly_request_rate_needs_weeks() -> None:
    with pytest.raises(ValueError):
        weekly_request_rate([1, 2], 0)


def test_observed_weeks_counts_from_the_first_request() -> None:
    end = datetime(2026, 11, 17, tzinfo=UTC)
    assert observed_weeks(end, end) == 1  # um pedido hoje: 1 semana observada
    assert observed_weeks(end - timedelta(days=1), end) == 1
    assert observed_weeks(end - timedelta(days=8), end) == 2  # 8 dias → 2 semanas
    assert observed_weeks(end - timedelta(days=100), end) == WINDOW_WEEKS  # teto da janela
    assert observed_weeks(end + timedelta(days=1), end) == 0  # futuro: nada observado


# --- Captura anual derivada (taxa × degrau, limitada por D_z) ---


def test_annual_capture_is_observed_over_demand_capped_at_one() -> None:
    assert annual_capture(500.0, 2000.0) == pytest.approx(0.25)
    assert annual_capture(2500.0, 2000.0) == 1.0  # a procura da APA é o teto
    with pytest.raises(ValueError):
        annual_capture(-1.0, 2000.0)
    with pytest.raises(ValueError):
        annual_capture(100.0, 0.0)


def test_unvisited_priors_improve_by_the_calibrated_conversion_within_the_blend() -> None:
    # Conversão litros→kg observada nos visitados: 600 kg observados ÷ 400 kg prior = 1,5.
    # Melhorada com pseudo-contagem k=4 e n=2 visitas: (4·1 + 2·1,5) ÷ 6 = 7/6 ≈ 1,1667.
    # O prior do local não visitado (2 kg/dia) passa a 2 × 7/6 ≈ 2,3333 — melhorado, nunca substituído.
    ratio = conversion_ratio(600.0, 400.0)
    assert ratio == pytest.approx(1.5)
    assert improved_prior(2.0, ratio, 2, 4) == pytest.approx(2.0 * 7 / 6)
    # Sem amostras, o prior fica intacto (nunca auto-substituído para além do blend).
    assert improved_prior(2.0, ratio, 0, 4) == 2.0


# --- Leituras e derivação da captura por freguesia ---


def taxa_reading(code: str, name: str, parish: str, n: int, observed: float | None, prior: float) -> Reading:
    return Reading(
        metric=CalibrationMetric.GENERATION_RATE,
        scope=CalibrationScope.LOCAL,
        unit_code=code,
        unit_name=name,
        parish_code=parish,
        n=n,
        pseudo_k=PSEUDO_K_LOCAL,
        observed=observed,
        prior=prior,
        blended=blend(prior, observed, n, PSEUDO_K_LOCAL) if observed is not None else prior,
        weight=observed_weight(n, PSEUDO_K_LOCAL),
        label=sample_label(n, PSEUDO_K_LOCAL),
    )


def test_on_demand_capture_is_derived_from_taxa_and_blended_with_the_prior() -> None:
    # Freguesia com procura D_z = 2 000 kg/ano e prior de captura 0,15 (0,25 × 0,6).
    # Dois locais observados: A 1,0 kg/dia com n=2; B 0,5 kg/dia com n=1.
    # Evidência anual: (1,0 + 0,5) × 365 = 547,5 kg → captura observada = 547,5 ÷ 2000 = 0,27375.
    # Blend de freguesia (k=8, n=3): (8·0,15 + 3·0,27375) ÷ 11 = 2,02125 ÷ 11 = 0,18375.
    readings = [
        taxa_reading("l-a", "Escola A", "030810", 2, 1.0, 0.05),
        taxa_reading("l-b", "Escola B", "030810", 1, 0.5, 0.05),
    ]
    derived = on_demand_capture_readings(readings, demand_kg_year={"030810": 2000.0}, prior_capture={"030810": 0.15})
    assert set(derived) == {"030810"}
    row = derived["030810"]
    assert row.observed == pytest.approx(547.5 / 2000.0)  # 0,27375
    assert row.blended == pytest.approx((8 * 0.15 + 3 * (547.5 / 2000.0)) / 11)
    assert row.label == "estimativa·3"  # n=3 < k=8
    assert row.weight == pytest.approx(3 / 11)


def test_on_demand_capture_observed_dominates_with_enough_visits() -> None:
    # Um local com 10 visitas e taxa observada 1,0 kg/dia; D_z = 2 000 kg/ano → evidência 365 kg → 0,1825.
    # (8·0,15 + 10·0,1825) ÷ 18 = (1,2 + 1,825) ÷ 18 = 3,025 ÷ 18 = 0,168055…
    readings = [taxa_reading("l-a", "Escola A", "030810", 10, 1.0, 0.05)]
    derived = on_demand_capture_readings(readings, demand_kg_year={"030810": 2000.0}, prior_capture={"030810": 0.15})
    row = derived["030810"]
    assert row.label == "observado·10"
    assert row.blended == pytest.approx((8 * 0.15 + 10 * (365.0 / 2000.0)) / 18)


def test_on_demand_capture_capped_at_one_by_demand() -> None:
    # 50 kg/dia observados × 365 = 18 250 kg ≫ D_z = 2 000: a evidência satura a 1 (procura da APA = teto).
    readings = [taxa_reading("l-a", "Escola A", "030810", 12, 50.0, 0.05)]
    derived = on_demand_capture_readings(readings, demand_kg_year={"030810": 2000.0}, prior_capture={"030810": 0.15})
    assert derived["030810"].observed == 1.0


def test_parishes_without_readings_are_left_alone() -> None:
    # Freguesias sem observação não entram na derivação: o prior nunca é substituído.
    readings = [taxa_reading("l-a", "Escola A", "030810", 2, 1.0, 0.05)]
    derived = on_demand_capture_readings(
        readings, demand_kg_year={"030810": 2000.0, "030811": 3000.0}, prior_capture={"030810": 0.15, "030811": 0.2}
    )
    assert set(derived) == {"030810"}


def test_calibration_lookup_by_metric_and_unit() -> None:
    a = taxa_reading("l-a", "Escola A", "030810", 2, 1.0, 0.05)
    cal = Calibration(window_weeks=12, readings=[a])
    assert cal.reading(CalibrationMetric.GENERATION_RATE, "l-a") is a
    assert cal.reading(CalibrationMetric.GENERATION_RATE, "l-zzz") is None
    assert cal.reading(CalibrationMetric.REQUESTS_PER_WEEK, "l-a") is None


def test_pooled_kg_per_bag_is_the_n_weighted_mean_of_local_medians() -> None:
    # Local A: mediana 12,0 kg com n=3; local B: mediana 10,0 kg com n=5.
    # Agrupado: (12·3 + 10·5) ÷ 8 = (36 + 50) ÷ 8 = 10,75.
    rows = [
        Reading(
            metric=CalibrationMetric.KG_PER_BAG,
            scope=CalibrationScope.LOCAL,
            unit_code="l-a",
            unit_name="Escola A",
            parish_code="030810",
            n=3,
            pseudo_k=PSEUDO_K_LOCAL,
            observed=12.0,
            prior=20.0,
            blended=blend(20.0, 12.0, 3, PSEUDO_K_LOCAL),
            weight=3 / 7,
            label="estimativa·3",
        ),
        Reading(
            metric=CalibrationMetric.KG_PER_BAG,
            scope=CalibrationScope.LOCAL,
            unit_code="l-b",
            unit_name="Escola B",
            parish_code="030811",
            n=5,
            pseudo_k=PSEUDO_K_LOCAL,
            observed=10.0,
            prior=20.0,
            blended=blend(20.0, 10.0, 5, PSEUDO_K_LOCAL),
            weight=5 / 9,
            label="observado·5",
        ),
    ]
    pooled = pooled_kg_per_bag(rows)
    assert pooled is not None
    assert pooled == pytest.approx(10.75)
    assert pooled_kg_per_bag([]) is None


def test_calibration_concelho_row() -> None:
    # O kg por saco agrupado do concelho vive numa linha scope=concelho (a que calibra o parâmetro global).
    row = Reading(
        metric=CalibrationMetric.KG_PER_BAG,
        scope=CalibrationScope.CONCELHO,
        unit_code="concelho",
        unit_name="Concelho de Guimarães",
        parish_code="",
        n=8,
        pseudo_k=PSEUDO_K_LOCAL,
        observed=10.0,
        prior=25.0,
        blended=(4 * 25.0 + 8 * 10.0) / 12,  # 180 ÷ 12 = 15,0
        weight=8 / 12,
        label="observado·8",
    )
    cal = Calibration(window_weeks=12, readings=[row])
    assert cal.kg_per_pickup() == pytest.approx(15.0)
    empty = Calibration(window_weeks=12, readings=[])
    assert empty.kg_per_pickup() is None
