"""Taxonomia fechada da triagem: valores calculados à mão.

O vocabulário é fechado e versionado (`TAXONOMY_VERSION`): mudar valores é uma decisão visível
(nova versão + migração + `just gen` + traduções). O estado fino mapeia sempre nos 3 destinos
e o tamanho só existe em bandas lidas da etiqueta (`unknown` quando ilegível).
"""

from novelo.domain.taxonomy import (
    EXPORT_KEY_AXES,
    PROMISED_AXES,
    TAXONOMY_VERSION,
    AttributeSource,
    Colour,
    FineState,
    Gender,
    Provenance,
    Season,
    SizeBand,
    TriageAxis,
    attribute_provenance,
    corrected_axes,
    destination_for,
    size_band_from_label,
)
from novelo.domain.vocab import GarmentType, TextileDestination


def test_taxonomy_is_versioned_so_changes_are_traceable() -> None:
    assert TAXONOMY_VERSION == 1  # mudar um valor do vocabulário passa por aqui


def test_fine_state_has_four_grades_plus_recycle_and_reject() -> None:
    assert [s.value for s in FineState] == [
        "grade_a",
        "grade_b",
        "grade_c",
        "grade_d",
        "recycle",
        "reject",
    ]


def test_fine_state_maps_onto_the_three_destinations() -> None:
    # Os 4 graus de qualidade são todos reutilização; reciclar e rejeitar mantêm o destino.
    assert destination_for(FineState.GRADE_A) is TextileDestination.REUSE
    assert destination_for(FineState.GRADE_B) is TextileDestination.REUSE
    assert destination_for(FineState.GRADE_C) is TextileDestination.REUSE
    assert destination_for(FineState.GRADE_D) is TextileDestination.REUSE
    assert destination_for(FineState.RECYCLE) is TextileDestination.RECYCLE
    assert destination_for(FineState.REJECT) is TextileDestination.REJECT


def test_typology_extends_garment_type_with_footwear_and_accessory() -> None:
    assert GarmentType.FOOTWEAR == "footwear"
    assert GarmentType.ACCESSORY == "accessory"


def test_axes_values() -> None:
    assert [s.value for s in Season] == ["all_season", "warm", "cold"]
    assert len(Colour) == 13  # 12 cores + unknown (foto escura/ilegível)
    assert [g.value for g in Gender] == ["men", "women", "kids", "babies"]
    assert [s.value for s in SizeBand] == ["xs", "s", "m", "l", "xl", "xxl", "unknown"]


def test_provenance_has_only_confirmed_and_ai() -> None:
    assert [p.value for p in Provenance] == ["confirmed", "ai"]


def test_export_lot_key_uses_fine_state_typology_season_gender() -> None:
    # A chave do lote de escoamento (bilhete #57): cor e tamanho ficam só para filtros.
    assert EXPORT_KEY_AXES == (
        TriageAxis.FINE_STATE,
        TriageAxis.GARMENT_TYPE,
        TriageAxis.SEASON,
        TriageAxis.GENDER,
    )
    assert TriageAxis.COLOUR not in EXPORT_KEY_AXES
    assert TriageAxis.SIZE_BAND not in EXPORT_KEY_AXES


def test_gender_and_size_are_promised_axes_for_the_eval() -> None:
    assert PROMISED_AXES == (TriageAxis.GENDER, TriageAxis.SIZE_BAND)


def test_size_band_letters_from_the_label() -> None:
    assert size_band_from_label("m") is SizeBand.M
    assert size_band_from_label("XL") is SizeBand.XL
    assert size_band_from_label(" xs ") is SizeBand.XS
    assert size_band_from_label("3xl") is SizeBand.XXL  # 3XL e acima entram na banda de topo


def test_size_band_portuguese_label_letters() -> None:
    # Etiquetas portuguesas: P/M/G/GG/XG.
    assert size_band_from_label("p") is SizeBand.S
    assert size_band_from_label("g") is SizeBand.L
    assert size_band_from_label("GG") is SizeBand.XL
    assert size_band_from_label("XG") is SizeBand.XXL


def test_size_band_numeric_labels_stay_unknown() -> None:
    # 42 pode ser M (mulher) ou L (homem): a tabela EU conflitua, o operador decide à mão.
    # Regra zero: a função não inventa o mapeamento numérico.
    assert size_band_from_label("42") is SizeBand.UNKNOWN
    assert size_band_from_label("98") is SizeBand.UNKNOWN  # altura de criança


def test_size_band_unknown_when_label_is_missing_or_illegible() -> None:
    assert size_band_from_label(None) is SizeBand.UNKNOWN
    assert size_band_from_label("") is SizeBand.UNKNOWN
    assert size_band_from_label("   ") is SizeBand.UNKNOWN
    assert size_band_from_label("ilegível") is SizeBand.UNKNOWN
    assert size_band_from_label("banana") is SizeBand.UNKNOWN


def test_size_band_one_size_is_not_a_band() -> None:
    assert size_band_from_label("OS") is SizeBand.UNKNOWN
    assert size_band_from_label("one size") is SizeBand.UNKNOWN
    assert size_band_from_label("tamanho único") is SizeBand.UNKNOWN


def test_size_band_ignores_accents_and_case() -> None:
    assert size_band_from_label("TAMANHO ÚNICO") is SizeBand.UNKNOWN
    assert size_band_from_label("  xL  ") is SizeBand.XL


def test_provenance_is_ai_for_accepted_values_and_confirmed_for_changed_ones() -> None:
    proposed = {
        TriageAxis.FINE_STATE: "grade_a",
        TriageAxis.GENDER: "women",
        TriageAxis.COLOUR: "black",
    }
    final = {TriageAxis.FINE_STATE: "grade_b", TriageAxis.GENDER: "women", TriageAxis.COLOUR: "blue"}
    prov = attribute_provenance(proposed, final, ai_confidence=0.8)
    # Aceite tal e qual: selo «IA» com a confiança da proposta.
    assert prov[TriageAxis.GENDER] == AttributeSource(TriageAxis.GENDER, Provenance.AI, 0.8)
    # Corrigido: selo «confirmado» e confiança 1.0 (palavra final humana).
    assert prov[TriageAxis.FINE_STATE] == AttributeSource(TriageAxis.FINE_STATE, Provenance.CONFIRMED, 1.0)
    assert prov[TriageAxis.COLOUR] == AttributeSource(TriageAxis.COLOUR, Provenance.CONFIRMED, 1.0)
    # Eixo sem valor final (peça antiga) não tem selo.
    assert TriageAxis.SEASON not in prov


def test_provenance_without_a_proposal_is_confirmed() -> None:
    final = {TriageAxis.GENDER: "men", TriageAxis.SEASON: "cold"}
    prov = attribute_provenance({}, final, ai_confidence=0.5)
    assert prov[TriageAxis.GENDER] == AttributeSource(TriageAxis.GENDER, Provenance.CONFIRMED, 1.0)
    assert prov[TriageAxis.SEASON] == AttributeSource(TriageAxis.SEASON, Provenance.CONFIRMED, 1.0)


def test_corrected_axes_list_only_differences_with_both_values() -> None:
    proposed = {
        TriageAxis.FINE_STATE: "grade_a",
        TriageAxis.GENDER: "women",
        TriageAxis.COLOUR: "black",
        TriageAxis.SIZE_BAND: "m",
    }
    final = {TriageAxis.FINE_STATE: "grade_a", TriageAxis.GENDER: "kids", TriageAxis.SIZE_BAND: "unknown"}
    # Duas correções com valores dos dois lados: o género e o tamanho (m → unknown é correção
    # legítima: a IA leu uma banda numa etiqueta «tamanho único»).
    assert corrected_axes(proposed, final) == [
        (TriageAxis.GENDER, "women", "kids"),
        (TriageAxis.SIZE_BAND, "m", "unknown"),
    ]
    assert corrected_axes({}, final) == []  # sem proposta não há correção a medir
