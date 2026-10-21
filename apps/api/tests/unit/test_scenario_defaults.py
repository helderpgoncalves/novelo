"""Modos por omissão: a Vitrus não tem contentores de têxtil (21 out 2026); `street` só como referência explícita."""

from novelo.domain import pilot
from novelo.domain.vocab import CollectionMode as Mode
from novelo.features.planning.pilot_schemas import PilotRequest
from novelo.features.planning.schemas import ScenarioRequest


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
