"""Modos por omissão: a Vitrus não tem contentores de têxtil (21 out 2026); `street` só como referência explícita."""

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
    """Pressupostos e cenários guardados antes de 21 out 2026 não têm os campos novos: valem os valores por omissão."""
    old = default_params().model_dump(mode="json")
    for key in ("pap_cost_per_pickup_eur", "pap_free_capacity_kg", "rsu_treatment_eur_per_t"):
        old.pop(key)
    p = PlanningParams.model_validate(old)
    assert (p.pap_cost_per_pickup_eur, p.pap_free_capacity_kg, p.rsu_treatment_eur_per_t) == (6.0, None, None)
    kpis = {
        "capex_eur": 0, "opex_eur_year": 0, "annual_cost_eur": 0, "tonnes_year": 0, "eur_per_tonne": None,
        "coverage_pct": 0, "points": 0, "km_year": 0, "potential_t": 2324.8, "baseline_observed_t": 301.3,
    }  # fmt: skip
    r = ScenarioResult.model_validate({"kpis": kpis, "allocations": [], "routes": [], "modes": [], "depot": [0, 0]})
    assert r.collection_plan is None and r.kpis.avoided_treatment_eur is None
    s = SitingSummary.model_validate(
        {"radius_m": 300, "site_mode": "existing", "candidates": 3, "demand_points": 4, "served_points": 3,
         "opened": 2, "solver_iterations": 1, "population_proxy": "x"}
    )  # fmt: skip
    assert (s.site_candidates, s.staffed_candidates) == ("public", 0)
