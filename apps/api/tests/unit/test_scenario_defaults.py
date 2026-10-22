"""Modos por omissão: a Vitrus não tem contentores de têxtil (21 out 2026); `street` só como referência explícita."""

import pytest

from novelo.domain import pilot
from novelo.domain.vocab import CollectionMode as Mode
from novelo.features.planning.params import default_params
from novelo.features.planning.pilot_schemas import PilotRequest
from novelo.features.planning.schemas import PlanningParams, ScenarioRequest, ScenarioResult, SitingSummary


def test_scenario_request_defaults_exclude_street() -> None:
    req = ScenarioRequest(label="A", objective="max_tonnes", budget_eur_year=60_000)  # type: ignore[arg-type]
    assert req.default_modes == [Mode.EXISTING, Mode.ON_DEMAND]
    assert Mode.STREET not in req.default_modes


def test_site_mode_defaults_to_existing() -> None:
    req = ScenarioRequest(label="A", objective="max_tonnes", budget_eur_year=60_000, siting="sites")  # type: ignore[arg-type]
    assert req.site_mode == Mode.EXISTING
    explicit = ScenarioRequest(
        label="A",
        objective="max_tonnes",  # type: ignore[arg-type]
        budget_eur_year=60_000,
        siting="sites",
        site_mode=Mode.STREET,
    )
    assert explicit.site_mode == Mode.STREET  # continua aceite, como referência


def test_pilot_defaults_exclude_street() -> None:
    assert pilot.DEFAULT_MODES == (Mode.EXISTING, Mode.ON_DEMAND)
    assert PilotRequest().modes == [Mode.EXISTING, Mode.ON_DEMAND]


def test_saved_parameters_and_results_without_the_new_fields_still_load() -> None:
    """Pressupostos e cenários guardados antes de 22 out 2026 não têm os campos novos (viatura dedicada, tratamento):
    valem os valores por omissão; os campos que saíram (canal PAP, desvio) são ignorados."""
    old = default_params().model_dump(mode="json")
    for key in ("on_demand_every_weeks", "vehicle_capex_eur", "shift_hours", "rsu_treatment_eur_per_t"):
        old.pop(key)
    old |= {"piggyback_extra_km": 1.5, "piggyback_min_days": 2, "pap_cost_per_pickup_eur": 6.0}
    p = PlanningParams.model_validate(old)
    assert (p.on_demand_every_weeks, p.vehicle_capex_eur, p.shift_hours) == (2, 42_500.0, 7.0)
    assert p.rsu_treatment_eur_per_t == pytest.approx(105.64)
    assert "piggyback_extra_km" not in p.model_dump()
    kpis = {
        "capex_eur": 0, "opex_eur_year": 0, "annual_cost_eur": 0, "tonnes_year": 0, "eur_per_tonne": None,
        "coverage_pct": 0, "points": 0, "km_year": 0, "potential_t": 2324.8, "baseline_observed_t": 301.3,
    }  # fmt: skip
    r = ScenarioResult.model_validate({"kpis": kpis, "allocations": [], "routes": [], "modes": [], "depot": [0, 0]})
    assert r.collection_plan is None and r.kpis.avoided_treatment_eur is None and r.kpis.vehicles is None
    # plano antigo (saco na viatura PAP, 0 km): a Vitrus excluiu esse canal; fica nulo e o ecrã pede para recalcular
    legacy = {
        "parish_code": "030801", "parish_name": "X", "channel": "door_to_door", "circuit": "C14", "weekday": 1,
        "vehicle": "BD-86-EN", "crew": 2, "new_km_year": 0.0, "tonnes_year": 1.0, "pickups_year": 40.0,
        "kg_per_round": 19.2, "round_kg": 19.2, "fits_capacity": None,
    }  # fmt: skip
    old_result = {"kpis": kpis, "allocations": [], "routes": [], "modes": [], "depot": [0, 0]}
    assert ScenarioResult.model_validate({**old_result, "collection_plan": [legacy]}).collection_plan is None
    s = SitingSummary.model_validate(
        {"radius_m": 300, "site_mode": "existing", "candidates": 3, "demand_points": 4, "served_points": 3,
         "opened": 2, "solver_iterations": 1, "population_proxy": "x"}
    )  # fmt: skip
    assert (s.site_candidates, s.staffed_candidates) == ("public", 0)
