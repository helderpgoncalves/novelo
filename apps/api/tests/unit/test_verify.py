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


def test_rounded_verifier_accepts_rounding_and_rejects_invented_numbers() -> None:
    from novelo.ai.verify import unsupported_rounded  # noqa: PLC0415

    facts = {"scenario_id": "3f2a9c1e-0000-4000-8000-000000000123", "tonnes": 301.27, "pct": 22.9, "cost": 1316.9}
    assert unsupported_rounded("Captou 301,3 t, cerca de 23% (1 317 €).", facts) == set()
    assert unsupported_rounded("Captou 305 t.", facts) == {305.0}
    assert unsupported_rounded("O id 123 não é um facto.", facts) == {123.0}  # dígitos de ids não contam
    assert unsupported_rounded("Pediu 20 000 € por ano.", facts, also_allowed="orçamento de 20 000 €") == set()
