"""O otimizador consome a calibração (só agregados, objeto puro): captura calibrada, teto D_z, q intacto.

O `compute` é puro: recebe `Calibration` (as linhas da tabela de agregados, já lidas do JSON) e nunca
uma sessão. Aqui calcula-se à mão o que a captura calibrada muda nas toneladas da freguesia e se prova
que a procura da APA (o `q`) não é substituída — ADR «Captura anual é derivada» (#53).

Freguesia de teste: 1 000 hab → D_z = 1 000 × 1,59583 × 12 ÷ 1000 = 19,14996 t/ano.
Prior da captura do saco à porta: 0,25 × 0,6 = 0,15; política fixa (degrau quinzenal = âncora 26/ano).
"""

import pytest

from novelo.domain.calibration import PSEUDO_K_PARISH, Calibration, Reading, blend, observed_weight
from novelo.domain.vocab import CalibrationMetric, CalibrationScope
from novelo.features.planning.params import default_params
from novelo.features.planning.schemas import ScenarioRequest, ZoneOut
from novelo.features.planning.service import compute

DEMAND_T = 1000 * 1.59583 * 12 / 1000  # 19,14996 t/ano


def _zone() -> ZoneOut:
    return ZoneOut(
        code="030899",
        name="Freguesia de teste",
        population=1000,
        population_year=2021,
        demand_t=round(DEMAND_T, 4),
        latitude=41.41823,
        longitude=-8.30164,  # no estaleiro: a volta da freguesia é o único km da ronda
        tipau=None,
        service_days=5,
        area_km2=5.0,
        existing_containers=0,
        localities=["Local de teste"],
        geometry=None,
    )


def _request() -> ScenarioRequest:
    # Só o saco à porta: a captura calibrada isola-se do canal `existing` (as capturas são independentes
    # na união de canais: 1 − Π(1 − c)).
    return ScenarioRequest(label="C", objective="max_tonnes", budget_eur_year=60000, default_modes=["on_demand"])


def _calibration(observed: float, n: int) -> Calibration:
    prior = 0.15
    blended = blend(prior, observed, n, PSEUDO_K_PARISH)
    return Calibration(
        window_weeks=12,
        readings=[
            Reading(
                metric=CalibrationMetric.ON_DEMAND_CAPTURE,
                scope=CalibrationScope.PARISH,
                unit_code="030899",
                unit_name="Freguesia de teste",
                parish_code="030899",
                n=n,
                pseudo_k=PSEUDO_K_PARISH,
                observed=observed,
                prior=prior,
                blended=blended,
                weight=observed_weight(n, PSEUDO_K_PARISH),
                label=f"observado·{n}",
            )
        ],
    )


def _parish_tonnes(result) -> float:
    return next(a.tonnes for a in result.allocations if a.parish_code == "030899")


def test_prior_run_without_calibration_uses_the_assumption() -> None:
    result, _ = compute([_zone()], default_params(), _request(), baseline_t=0.0)
    # Só o saco à porta, política fixa (degrau quinzenal = âncora 26/ano): captura 0,25 × 0,6 = 0,15.
    assert _parish_tonnes(result) == pytest.approx(DEMAND_T * 0.15, abs=0.01)


def test_calibrated_capture_raises_the_tonnes_by_the_blend() -> None:
    # Captura observada 0,5 com n=8 (domina o prior 0,15): blend = (7·0,15 + 8·0,5) ÷ 15 = 0,3367.
    # As toneladas da freguesia sobem de (≤) 0,15·D_z para 0,3367·D_z.
    calibrated = compute([_zone()], default_params(), _request(), baseline_t=0.0, calibration=_calibration(0.5, 8))[0]
    expected = DEMAND_T * (7 * 0.15 + 8 * 0.5) / 15
    assert calibrated.allocations[0].tonnes == pytest.approx(expected, abs=0.01)


def test_the_observed_capture_is_capped_by_the_demand_of_the_apa() -> None:
    # Observação saturada (2,0 ≫ 1): o blend dá (8·0,15 + 8·2) ÷ 16 = 1,075 → limitado a 1 no degrau;
    # as toneladas ficam EXATAMENTE na procura D_z — o teto da APA nunca é ultrapassado.
    calibrated = compute([_zone()], default_params(), _request(), baseline_t=0.0, calibration=_calibration(2.0, 8))[0]
    assert calibrated.allocations[0].tonnes == pytest.approx(DEMAND_T, abs=0.01)


def test_q_is_untouched_by_the_calibration() -> None:
    # O potencial (procura calculada com o q da APA) é igual com e sem calibração: nunca é substituído.
    plain, _ = compute([_zone()], default_params(), _request(), baseline_t=0.0)
    calibrated, _ = compute([_zone()], default_params(), _request(), baseline_t=0.0, calibration=_calibration(2.0, 8))
    assert plain.kpis.potential_t == calibrated.kpis.potential_t == pytest.approx(DEMAND_T, abs=0.1)


def test_calibration_from_another_parish_does_not_leak() -> None:
    # Freguesia sem amostras fica com o prior: a captura calibrada de "030899" não toca "030888".
    other = _zone().model_copy(update={"code": "030888", "name": "Outra"})
    calibrated = compute([other], default_params(), _request(), baseline_t=0.0, calibration=_calibration(0.5, 8))[0]
    plain, _ = compute([other], default_params(), _request(), baseline_t=0.0)
    assert calibrated.allocations[0].tonnes == pytest.approx(plain.allocations[0].tonnes)


def _bags_calibration(blended: float) -> Calibration:
    """Sacos por ronda calibrados (n=4 semanas com ronda, k=8): só a linha `bags_per_round`."""
    return Calibration(
        window_weeks=12,
        readings=[
            Reading(
                metric=CalibrationMetric.BAGS_PER_ROUND,
                scope=CalibrationScope.PARISH,
                unit_code="030899",
                unit_name="Freguesia de teste",
                parish_code="030899",
                n=4,
                pseudo_k=PSEUDO_K_PARISH,
                observed=blended,
                prior=DEMAND_T * 1000 * 0.15 / 25 / 26,
                blended=blended,
                weight=observed_weight(4, PSEUDO_K_PARISH),
                label="estimativa·4",
            )
        ],
    )


def _requests_calibration() -> Calibration:
    """Pedidos por semana (n=2 semanas, 1 pedido/semana): sinal de arranque, prior 0."""
    return Calibration(
        window_weeks=12,
        readings=[
            Reading(
                metric=CalibrationMetric.REQUESTS_PER_WEEK,
                scope=CalibrationScope.PARISH,
                unit_code="030899",
                unit_name="Freguesia de teste",
                parish_code="030899",
                n=2,
                pseudo_k=PSEUDO_K_PARISH,
                observed=1.0,
                prior=0.0,
                blended=blend(0.0, 1.0, 2, PSEUDO_K_PARISH),
                weight=observed_weight(2, PSEUDO_K_PARISH),
                label="estimativa·2",
            )
        ],
    )


def _parish_km(result) -> float:
    return next(a.km_year for a in result.allocations if a.parish_code == "030899")


def test_calibrated_bags_per_round_recalibrates_the_tour_n() -> None:
    # Prior (zona no estaleiro: a volta é o único km): 2,872494 t/ano ÷ 25 kg = 114,8998 sacos/ano
    # ÷ 26 rondas = 4,41922 por ronda; volta = 0,7124 · √(4,41922 · 5) · 1,3 = 4,35330 -> 113,186 km/ano.
    plain, _ = compute([_zone()], default_params(), _request(), baseline_t=0.0)
    assert _parish_km(plain) == pytest.approx(26 * 0.7124 * (114.8998 / 26 * 5.0) ** 0.5 * 1.3, abs=0.05)
    # Calibrado a 3,0 sacos por ronda: o n da volta muda (km = 26 · 0,7124 · √(3 · 5) · 1,3 = 93,25),
    # as toneladas ficam EXATAMENTE as mesmas — o pedido calibra o n, nunca multiplica kg.
    calibrated, _ = compute([_zone()], default_params(), _request(), baseline_t=0.0, calibration=_bags_calibration(3.0))
    assert _parish_km(calibrated) == pytest.approx(26 * 0.7124 * (3.0 * 5.0) ** 0.5 * 1.3, abs=0.05)
    assert _parish_km(calibrated) < _parish_km(plain)
    assert _parish_tonnes(calibrated) == pytest.approx(_parish_tonnes(plain), abs=0.01)


def test_requests_per_week_is_kpi_only_and_never_touches_the_plan() -> None:
    # Pedidos por semana (1/semana, n=2): sinal de arranque e KPI por freguesia — nenhum número do
    # plano se mexe (nem kg nem km): a ronda não encolhe por haver (ou não) pedidos.
    plain, _ = compute([_zone()], default_params(), _request(), baseline_t=0.0)
    with_requests, _ = compute(
        [_zone()], default_params(), _request(), baseline_t=0.0, calibration=_requests_calibration()
    )
    assert _parish_tonnes(with_requests) == pytest.approx(_parish_tonnes(plain), abs=0.01)
    assert _parish_km(with_requests) == pytest.approx(_parish_km(plain), abs=0.01)
    assert with_requests.kpis.annual_cost_eur == pytest.approx(plain.kpis.annual_cost_eur, abs=0.01)
