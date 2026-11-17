"""O otimizador consome a calibração (só agregados, objeto puro): captura calibrada, teto D_z, q intacto.

O `compute` é puro: recebe `Calibration` (as linhas da tabela de agregados, já lidas do JSON) e nunca
uma sessão. Aqui calcula-se à mão o que a captura calibrada muda nas toneladas da freguesia e se prova
que a procura da APA (o `q`) não é substituída — ADR «Captura anual é derivada» (#53).

Freguesia de teste: 1 000 hab → D_z = 1 000 × 1,59583 × 12 ÷ 1000 = 19,14996 t/ano.
Prior da captura do saco à porta: 0,25 × 0,6 = 0,15; política fixa (degrau quinzenal = âncora 26/ano).
"""

import pytest

from novelo.domain.calibration import PSEUDO_K_PARISH, Calibration, Reading, blend
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
        latitude=41.4425,
        longitude=-8.2918,
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
                weight=n / (n + PSEUDO_K_PARISH),
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
    # Captura observada 0,5 com n=8 (domina o prior 0,15): blend = (8·0,15 + 8·0,5) ÷ 16 = 0,325.
    # As toneladas da freguesia sobem de (≤) 0,15·D_z para 0,325·D_z = 6,2237 t.
    calibrated = compute([_zone()], default_params(), _request(), baseline_t=0.0, calibration=_calibration(0.5, 8))[0]
    expected = DEMAND_T * (8 * 0.15 + 8 * 0.5) / 16
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
