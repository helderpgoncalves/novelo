from novelo.ai.verify import check_numbers, numbers_in, unsupported_numbers, unsupported_rounded
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


def test_rounded_verifier_ignores_labels_with_digits_and_list_markers() -> None:
    from novelo.ai.verify import unsupported_rounded  # noqa: PLC0415

    facts = {"p50": 410.5}
    assert unsupported_rounded("A mediana (P50) é 410,5 €/t; o intervalo P10-P90 vem da simulação.", facts) == set()
    assert unsupported_rounded("1. Creixomil\n2. Azurém\n3. Ponte", facts) == set()
    assert unsupported_rounded("Há 3 freguesias e 410,5 €/t.", facts) == {3.0}


def test_dot_thousands_separator_is_accepted_when_the_integer_matches() -> None:
    from novelo.ai.verify import unsupported_rounded  # noqa: PLC0415

    facts = {"annual_cost_eur": 37198.99}
    assert unsupported_rounded("O custo anual é de 37.199 € (P10).", facts) == set()
    assert unsupported_rounded("O custo anual é de 38.100 €.", facts) == {38.1}


def test_number_formats_english_and_portuguese() -> None:
    from novelo.ai.verify import unsupported_rounded  # noqa: PLC0415

    facts = {"a": 37198.99, "b": 52041.78, "c": 1317.4, "d": 301.27}
    assert (
        unsupported_rounded("From 37,198.99 to 52,041.78 €/yr", facts) == set()
    )  # inglês: vírgula de milhares e ponto decimal
    assert unsupported_rounded("De 37.198,99 a 52.041,78 €/ano", facts) == set()  # português antigo
    assert unsupported_rounded("Cerca de 1 317 t, ou 1.317 t, ou 1,317 t; 301,3 t", facts) == set()
    assert unsupported_rounded("Entre 37,198.90 e 52,041.78", facts) == {37198.9}
    assert unsupported_rounded("Valor de 5,5 e 12.5", facts) == {5.5, 12.5}


def test_a_negative_difference_can_be_written_as_less_by_the_absolute_value() -> None:
    from novelo.ai.verify import unsupported_rounded  # noqa: PLC0415

    assert unsupported_rounded("Menos 1,92 t por ano.", {"difference_tonnes_per_year": -1.92}) == set()
    assert unsupported_rounded("Menos 2,5 t por ano.", {"difference_tonnes_per_year": -1.92}) == {2.5}


# --- números de fontes web ------------------------------------------------------------------------------------


def test_external_numbers_need_a_source_excerpt_and_a_label() -> None:
    facts = [{"collected_t": 301.27}]
    excerpt = ["Em Espanha recolheram-se 12,5 kg de têxteis por habitante em 2023."]
    ok = "Em Espanha, 12,5 kg por habitante em 2023 (fonte externa, https://exemplo.es). Cá recolhemos 301,3 t."
    out = check_numbers(ok, facts, excerpt)
    assert out.unsupported == set() and out.external == {12.5, 2023.0}
    unlabeled = check_numbers("Em Espanha recolhem-se 12,5 kg por habitante.", facts, excerpt)
    assert unlabeled.unsupported == {12.5} and unlabeled.external == set()  # sem rótulo de fonte não passa
    invented = check_numbers("Em Espanha são 99 kg (fonte externa).", facts, excerpt)
    assert invented.unsupported == {99.0}  # não está nos dados nem em nenhum excerto


def test_novelo_numbers_are_never_reclassified_as_external() -> None:
    out = check_numbers("Recolhemos 301,3 t.", [{"t": 301.27}], ["301,3 t noutro país"])
    assert out.unsupported == set() and out.external == set()


def test_numbers_are_accepted_in_portuguese_and_english_formats() -> None:
    facts = {"capture_pct": 9.1, "still_in_bin_t": 3003.3, "generated_t": 3304.6, "treatment_eur_per_t": 105.64}
    for text in ("9,1% e 3 003,3 t de 3 304,6 t, a 105,64 €/t", "9.1% and 3,003.3 t of 3,304.6 t, at 105.64 €/t"):
        assert unsupported_rounded(text, facts) == set(), text
