"""Chave e linhagem dos lotes de escoamento, com valores calculados à mão.

A chave é (estado fino, tipologia, estação, género) — cor e tamanho nunca entram; a linhagem agrega
as peças do escoamento até aos lotes de recolha de origem e às paragens.
"""

from uuid import uuid4

from novelo.domain.export_lots import (
    ExportCandidate,
    LineageRow,
    export_key_of,
    group_by_export_key,
    lineage_summary,
)


def piece(fine_state, garment_type, season, gender, weight_g, *, colour=None, size_band=None) -> ExportCandidate:
    return ExportCandidate(
        id=uuid4(),
        fine_state=fine_state,
        garment_type=garment_type,
        season=season,
        gender=gender,
        colour=colour,
        size_band=size_band,
        weight_g=weight_g,
    )


def test_export_key_needs_the_four_axes() -> None:
    # Peça legada (sem estado fino) ou sem estação/género: sem chave, fica fora do escoamento.
    assert export_key_of(None, "jumper", "warm", "women") is None
    assert export_key_of("grade_b", "jumper", None, "women") is None
    assert export_key_of("grade_b", "jumper", "warm", None) is None
    key = export_key_of("grade_b", "jumper", "warm", "women")
    assert key is not None
    assert (key.fine_state, key.garment_type, key.season, key.gender) == ("grade_b", "jumper", "warm", "women")


def test_group_by_export_key_ignores_colour_and_size() -> None:
    """7 peças → 5 chaves; cor e tamanho (azul/M na peça 7) não dividem a chave."""
    a = piece("grade_b", "jumper", "warm", "women", 400)
    b = piece("grade_b", "jumper", "warm", "women", 400)
    c = piece("grade_b", "jumper", "warm", "women", 250, colour="blue", size_band="m")
    d = piece("grade_a", "jumper", "warm", "women", 200)  # outro estado fino
    e = piece("grade_b", "jumper", "cold", "women", 300)  # outra estação
    f = piece("grade_b", "jumper", "warm", "men", 350)  # outro género
    g = piece("grade_b", "shirt", "warm", "women", 150)  # outra tipologia
    legacy = piece(None, "jumper", "warm", "women", 500)  # sem estado fino: fora
    partial = piece("grade_b", "jumper", None, "women", 100)  # sem estação: fora

    groups = group_by_export_key([a, b, c, d, e, f, g, legacy, partial])

    assert len(groups) == 5
    main = export_key_of("grade_b", "jumper", "warm", "women")
    assert main is not None and [p.id for p in groups[main]] == [a.id, b.id, c.id]
    assert sum(p.weight_g for p in groups[main]) == 1050  # 400 + 400 + 250
    # Cada variação da chave é um grupo separado, com a sua única peça:
    assert len(groups[export_key_of("grade_a", "jumper", "warm", "women")]) == 1  # 200 g
    assert len(groups[export_key_of("grade_b", "jumper", "cold", "women")]) == 1  # 300 g
    assert len(groups[export_key_of("grade_b", "jumper", "warm", "men")]) == 1  # 350 g
    assert len(groups[export_key_of("grade_b", "shirt", "warm", "women")]) == 1  # 150 g


def test_lineage_summary_groups_pieces_by_origin_lot() -> None:
    """4 peças, 3 lotes de recolha: NOV-AAA com 800 g (2 peças), NOV-CCC com 350 g, NOV-BBB com 250 g."""
    rows = [
        LineageRow(item_id=uuid4(), weight_g=400, lot_code="NOV-AAA", locality_name="Escola B", parish_name="0301"),
        LineageRow(item_id=uuid4(), weight_g=400, lot_code="NOV-AAA", locality_name="Escola B", parish_name="0301"),
        LineageRow(item_id=uuid4(), weight_g=250, lot_code="NOV-BBB", locality_name=None, parish_name="0302"),
        LineageRow(item_id=uuid4(), weight_g=350, lot_code="NOV-CCC", locality_name="Lar S. João", parish_name="0303"),
    ]

    lineage = lineage_summary(rows)

    assert [(lot.lot_code, lot.items, lot.weight_kg) for lot in lineage.lots] == [
        ("NOV-AAA", 2, 0.8),  # 400 + 400 g = 0,8 kg, o mais pesado primeiro
        ("NOV-CCC", 1, 0.35),
        ("NOV-BBB", 1, 0.25),
    ]
    assert lineage.lots[0].locality_name == "Escola B" and lineage.lots[1].parish_name == "0303"
    assert lineage.localities == 2  # Escola B e Lar S. João; a paragem sem nome não conta
    assert lineage.weight_kg == 1.4  # 400 + 400 + 250 + 350 g


def test_lineage_summary_orders_ties_by_lot_code() -> None:
    tied = [
        LineageRow(item_id=uuid4(), weight_g=300, lot_code="NOV-BBB", locality_name=None, parish_name=None),
        LineageRow(item_id=uuid4(), weight_g=300, lot_code="NOV-AAA", locality_name=None, parish_name=None),
    ]
    assert [lot.lot_code for lot in lineage_summary(tied).lots] == ["NOV-AAA", "NOV-BBB"]
