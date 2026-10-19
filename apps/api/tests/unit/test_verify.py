from novelo.ai.verify import numbers_in, unsupported_numbers
from novelo.features.planning.whatif_service import resolve_parishes

FACTS = {"new": {"tonnes": "301,3", "cost": "12 400", "points": "7"}, "diff": {"t": "+4,5"}}


def test_numbers_accept_comma_dot_and_thousand_separators() -> None:
    assert numbers_in("301,3 t e 12 400 € e 7,5") == {301.3, 12400.0, 7.5}
    assert numbers_in("1.5 km") == {1.5}


def test_explanation_with_only_known_numbers_is_verified() -> None:
    assert unsupported_numbers("Passa para 301,3 t com 7 pontos e 12 400 €.", FACTS) == set()


def test_invented_number_is_rejected() -> None:
    assert unsupported_numbers("Passa para 305,0 t com 7 pontos.", FACTS) == {305.0}


def test_parish_names_are_resolved_against_the_closed_list() -> None:
    zones = {"030866": "Serzedelo", "030854": "Selho (São Jorge)", "030850": "Selho (São Cristóvão)"}
    resolved, unknown, suggestions = resolve_parishes(["serzedelo", "Selho São Jorge", "Serzedelu"], zones)
    assert resolved["serzedelo"] == "030866"
    assert unknown == ["Serzedelu"] and "Serzedelo" in suggestions
