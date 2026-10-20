"""ETL dos contentores municipais (scripts/etl/municipal_containers.py) com um pacote FALSO e valores feitos à mão.

Nada aqui depende do pacote real da Vitrus: o shapefile e os .txt são criados no `tmp_path`.
O teste final confere os totais do pacote real contra as contagens das linhas dos ficheiros (se o pacote existir).
"""

import csv
import hashlib
import importlib.util
import json
import sqlite3
import sys
from decimal import Decimal
from pathlib import Path
from types import ModuleType
from typing import Any

import pytest
import shapefile  # pyshp
from shapely.geometry import box

REPO = Path(__file__).resolve().parents[4]


def _load() -> ModuleType:
    spec = importlib.util.spec_from_file_location("etl_municipal", REPO / "scripts" / "etl" / "municipal_containers.py")
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    sys.modules["etl_municipal"] = module  # os dataclasses precisam do módulo registado
    spec.loader.exec_module(module)
    return module


etl = _load()


# --- coordenadas -----------------------------------------------------------------------------------------------


def test_coords_normal_order_keeps_lat_lon() -> None:
    c = etl.resolve_coords("41.456363", "-8.296393")
    assert (c.status, c.swapped) == ("ok", False)
    assert (c.lat, c.lon) == (Decimal("41.456363"), Decimal("-8.296393"))


def test_coords_swapped_columns_are_fixed_per_row() -> None:
    """Profundidade: a coluna "Y" traz a longitude e a "X2" a latitude."""
    c = etl.resolve_coords("-8.296393", "41.456363")
    assert (c.status, c.swapped) == ("ok", True)
    assert (c.lat, c.lon) == (Decimal("41.456363"), Decimal("-8.296393"))


def test_coords_rows_of_the_same_file_are_classified_independently() -> None:
    rows = [("41.45", "-8.29"), ("-8.30", "41.46"), ("41.47", "-8.31")]
    assert [etl.resolve_coords(y, x).swapped for y, x in rows] == [False, True, False]


def test_coords_spurious_characters_are_removed_and_flagged() -> None:
    """Linha 381 de Profundidade: "-8.2899442" seguido de "Â" e espaço não separável."""
    c = etl.resolve_coords("-8.2899442Â ", "41.4427733")
    assert c.status == "ok" and c.cleaned is True
    assert c.lon == Decimal("-8.2899442") and c.lat == Decimal("41.4427733")


def test_coords_missing_and_invalid() -> None:
    assert etl.resolve_coords("", " ").status == "missing"
    assert etl.resolve_coords("41.4", "").status == "invalid"  # só uma preenchida
    assert etl.resolve_coords("41.4", "41.5").status == "invalid"  # duas latitudes
    assert etl.resolve_coords("48.85", "2.35").status == "invalid"  # Paris: fora de Portugal


def test_coords_decimals_ignore_trailing_zeros() -> None:
    assert etl.resolve_coords("41.488", "-8.358").decimals == 3  # aproximada (~100 m)
    assert etl.resolve_coords("41.432660", "-8.303445").decimals == 5  # "41.432660" tem 5 casas significativas
    assert etl.resolve_coords("41.4563722222", "-8.2963777778").decimals == 10


# --- capacidade ------------------------------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("5 m³", (5000, "ok")),
        ("3 m³", (3000, "ok")),
        ("1,5 m3", (1500, "ok")),
        ("1100L", (1100, "ok")),
        ("1100l", (1100, "ok")),
        ("80l ", (80, "ok")),
        ("80", (80, "assumed_litres")),
        ("???", (None, "unknown")),
        ("?", (None, "unknown")),
        ("", (None, "unknown")),
        ("grande", (None, "unknown")),
    ],
)
def test_parse_capacity(raw: str, expected: tuple[int | None, str]) -> None:
    assert etl.parse_capacity(raw) == expected


# --- locais ----------------------------------------------------------------------------------------------------


def test_site_key_rounds_to_five_decimals_half_up() -> None:
    assert etl.site_key(Decimal("41.456363"), Decimal("-8.296393")) == "41.45636,-8.29639"
    assert etl.site_key(Decimal("41.456365"), Decimal("-8.296395")) == "41.45637,-8.29640"  # meio para cima (em módulo)


def test_same_site_within_one_metre_different_site_beyond() -> None:
    a = etl.site_id_of(etl.site_key(Decimal("41.456361"), Decimal("-8.296391")))
    b = etl.site_id_of(etl.site_key(Decimal("41.456364"), Decimal("-8.296394")))  # 4e-6 graus: mesmo local
    c = etl.site_id_of(etl.site_key(Decimal("41.456363"), Decimal("-8.296403")))  # 1e-5 graus (~0,8 m em lon): outro
    assert a == b
    assert a != c


# --- nomes de freguesia ----------------------------------------------------------------------------------------


def _square(x: float, y: float, side: float) -> Any:
    return box(x, y, x + side, y + side)


def _parish(dicofre: str, name: str, short: str, code: str = "") -> Any:
    return etl.Parish(dicofre, name, short, "ÁREA PRINCIPAL", 0.0, code or dicofre, 100, _square(0, 0, 1))


@pytest.fixture(scope="module")
def index() -> Any:
    parishes = [
        _parish("030804", "Azurém", "Azurém"),
        _parish("030806", "Barco", "Barco"),
        _parish("030850", "Selho (São Cristóvão)", "Selho (São Cristóvão)"),
        _parish("030854", "Selho (São Jorge)", "Selho (São Jorge)"),
        _parish(
            "030884",
            "União das freguesias de Oliveira, São Paio e São Sebastião",
            "Oliveira, São Paio e São Sebastião",
        ),
        _parish(
            "030888",
            "União das freguesias de Selho São Lourenço e Gominhães",
            "Selho São Lourenço e Gominhães",
        ),
        _parish("030886", "União das freguesias de Sande São Lourenço e Balazar", "Sande São Lourenço e Balazar"),
    ]
    return etl.NameIndex.build(parishes)


def test_names_ignore_case_accents_and_trailing_spaces(index: Any) -> None:
    assert index.candidates("AZUREM ") == (frozenset({"030804"}), "exact")


def test_names_union_written_in_different_ways(index: Any) -> None:
    expected = frozenset({"030884"})
    for text in (
        "UF Oliveira, São Paio, São Sebastião",
        "UF Oliveira. S. Paio e S. Sebastião",
        "União das freguesias de Oliveira, São Paio e São Sebastião",
    ):
        assert index.candidates(text) == (expected, "exact"), text


def test_names_old_form_with_de_is_same_words(index: Any) -> None:
    assert index.candidates("S.Jorge de Selho") == (frozenset({"030854"}), "same_words")


def test_names_union_component_and_aliases(index: Any) -> None:
    assert index.candidates("S. Paio")[0] == frozenset({"030884"})
    assert index.candidates("Gomilhães")[0] == frozenset({"030888"})  # erro de escrita
    assert index.candidates("Oliveira do Castelo")[0] == frozenset({"030884"})


def test_names_containing_a_name(index: Any) -> None:
    assert index.candidates("São Cláudio de Barco") == (frozenset({"030806"}), "contains_name")


def test_names_ambiguous_partial_returns_all_candidates(index: Any) -> None:
    cands, level = index.candidates("São Lourenço")
    assert level == "partial" and cands == frozenset({"030888", "030886"})
    cands, _ = index.candidates("Selho")
    assert cands == frozenset({"030850", "030854", "030888"})


def test_names_not_a_parish(index: Any) -> None:
    assert index.candidates("Cidade") == (frozenset(), "none")
    assert index.candidates("") == (frozenset(), "none")


# --- pacote falso ponta a ponta --------------------------------------------------------------------------------

# Freguesia A (x0..x0+1000) e B (x0+1000..x0+2000), lado 1000 m, em PT-TM06 perto de Guimarães.
X0, Y0 = -35000.0, 215000.0


def _ll(dx: float, dy: float) -> tuple[str, str]:
    """(lat, lon) em WGS84 de um ponto a (dx, dy) metros do canto sudoeste de A, com 7 casas."""
    lon, lat = etl.TO_WGS84.transform(X0 + dx, Y0 + dy)
    return f"{lat:.7f}", f"{lon:.7f}"


def _write_package(raw: Path) -> None:
    raw.mkdir(parents=True)
    shp_dir = raw / "Informação" / "Cont_AAD_CAOP2019"
    shp_dir.mkdir(parents=True)
    w = shapefile.Writer(str(shp_dir / "Cont_AAD_CAOP2019"), encoding="utf-8")
    for name, size in (
        ("Dicofre", 6),
        ("Freguesia", 80),
        ("Concelho", 40),
        ("Distrito", 40),
        ("TAA", 20),
        ("Des_Simpli", 80),
    ):
        w.field(name, "C", size)
    w.field("AREA_EA_Ha", "N", 13, 2)
    w.field("AREA_T_Ha", "N", 13, 2)
    for (code, name, concelho), x in (
        (("030804", "Azurém", "GUIMARÃES"), X0),
        (("030806", "Barco", "GUIMARÃES"), X0 + 1000),
        (("030999", "Outra", "BRAGA"), X0 + 5000),  # outro concelho: tem de ser ignorado
    ):
        w.poly([[[x, Y0], [x, Y0 + 1000], [x + 1000, Y0 + 1000], [x + 1000, Y0], [x, Y0]]])
        w.record(code, name, concelho, "BRAGA", "ÁREA PRINCIPAL", name, 100.0, 100.0)
    w.close()

    def tsv(name: str, header: list[str], rows: list[list[str]]) -> None:
        text = "\r\n".join("\t".join(r) for r in [header, *rows]) + "\r\n"
        (raw / name).write_bytes(text.encode("utf-8"))

    lat_a, lon_a = _ll(500, 500)  # centro de A
    lat_a2, lon_a2 = _ll(503, 500)  # 3 m a leste: outro local, mesma rua
    lat_b, lon_b = _ll(1500, 500)  # centro de B
    lat_far, lon_far = _ll(3000, 500)  # 1000 m fora do contorno
    lat_edge, lon_edge = _ll(2030, 500)  # 30 m fora de B (dentro da tolerância)
    tsv(
        "Contentores de Profundidade.txt",
        ["ID", "tipologia", "cap.", "Freguesia", "Rua", "Coord. Y", "Coord. X2"],
        [
            ["1", "molok", "5 m³", "AZUREM ", "Rua A", lon_a, lat_a],  # trocada
            ["2", "plataforma", "3 m³", "Azurém", "Rua A", lon_a, lat_a],  # mesmo local que o 1
            ["3", "bluebee", "5 m³", "Azurém", "Rua B", lon_b, lat_b],  # declara A mas está em B
            ["4", "Greenbee", "5 m³", "Barco", "Rua longe", lon_far, lat_far],  # fora do concelho
            ["5", "molok ", "5 m³", "Barco", "Rua limite", lon_edge, lat_edge],  # 30 m fora: aceite
        ],
    )
    tsv(
        "Contentores de Superfície.txt",
        ["ID", "Capacidade", "Nome", "Freguesia", "Coord_Y", "Coord_X"],
        [["C001", "1100L", "Rua A", "Azurém", lat_a, lon_a], ["C002", "1100L", "", "", "", ""]],
    )
    tsv(
        "Contentores Orgânico - Coletivo.txt",
        ["ID", "tipologia", "cap.", "Material", "Freguesia", "Rua", "Coord. Y", "Coord. X", ""],
        [["BC1", "superficie", "80l ", "Orgânico", "Azurém", "Rua A", lon_a2, lat_a2, ""]],
    )
    tsv(
        "Contentores Orgânico - Tipologia.txt",
        ["ID", "Capacidade", "Tipologia", "Nome", "Freguesia", "Coord_Y", "Coord_X"],
        [
            ["B1", "???", "Restauração", "Café A", "AZUREM", lat_a, lon_a],
            ["B2", "80", "Escola ", "Escola B", "Barco", lat_b, lon_b],
            ["", "", "", "", "", "", ""],  # linha vazia
        ],
    )
    tsv(
        "Contentores Resíduos Verdes.txt",
        ["ID", "tipologia", "cap.", "Freguesia", "Rua", "Quantidade", "Coord. Y", "Coord. X"],
        [["BC2", "superficie", "1100l", "Barco", "CEMITÉRIO", "3", lon_b, lat_b]],
    )
    (raw / "Georreferenciação.qgz").write_bytes(b"qgz")


def _write_parishes(path: Path) -> None:
    path.write_text("dicofre,name,population\n030804,Azurém,2000\n030806,Barco,1000\n", encoding="utf-8")


def _read(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8", newline="") as fh:
        return list(csv.DictReader(fh))


@pytest.fixture
def fake_run(tmp_path: Path) -> tuple[dict[str, object], Path, Path]:
    raw, out = tmp_path / "raw", tmp_path / "processed"
    _write_package(raw)
    out.mkdir()
    _write_parishes(out / "parishes.csv")
    result = etl.run(raw, out, osm_path=tmp_path / "sem-osm.geojson")
    return result, raw, out


def test_fake_package_counts(fake_run: tuple[dict[str, object], Path, Path]) -> None:
    result, _, out = fake_run
    # 12 linhas lidas (5 + 2 + 1 + 3 + 1). Rejeitadas 2: o ponto a 1000 m e a linha vazia. Aceites: 10.
    assert result["status"] == "ok"
    assert result["containers"] == 10
    assert result["located"] == 9  # C002 sem coordenadas
    rejected = _read(out / "municipal_containers_rejected.csv")
    assert {(r["source_file"], r["reason_key"]) for r in rejected} == {
        ("profundidade", "outside_municipality"),
        ("organico_tipologia", "empty_row"),
    }
    outside = next(r for r in rejected if r["reason_key"] == "outside_municipality")
    assert "A 1000 m do contorno" in outside["reason"]  # (3000 - 2000) m a leste de Barco
    assert json.loads(outside["raw"])["ID"] == "4"


def test_fake_package_swap_taxonomy_and_parish(fake_run: tuple[dict[str, object], Path, Path]) -> None:
    _, _, out = fake_run
    rows = {r["container_uid"]: r for r in _read(out / "municipal_containers.csv")}
    p1 = rows["profundidade:1"]
    assert (p1["kind"], p1["brand"], p1["capacity_litres"], p1["stream"]) == (
        "underground",
        "molok",
        "5000",
        "desconhecido",
    )
    assert p1["coord_swapped"] == "true"
    assert (p1["parish_dicofre"], p1["parish_match"], p1["declared_parish"]) == ("030804", "igual", "AZUREM")
    assert rows["profundidade:2"]["kind"] == "platform" and rows["profundidade:2"]["brand"] == ""
    assert rows["profundidade:2"]["capacity_litres"] == "3000"
    # declara Azurém mas está em Barco, a 500 m do polígono de Azurém
    p3 = rows["profundidade:3"]
    assert (p3["parish_dicofre"], p3["parish_match"]) == ("030806", "diferente")
    assert abs(int(p3["parish_mismatch_distance_m"]) - 500) <= 1
    assert p3["coord_suspect"] == "false"  # < 1 km
    # 30 m fora de Barco: aceite, atribuído a Barco e assinalado
    p5 = rows["profundidade:5"]
    assert p5["parish_dicofre"] == "030806" and "30 m" in p5["boundary_note"] and p5["brand"] == "molok"
    assert "profundidade:4" not in rows
    # sem coordenadas: fica pendente
    c2 = rows["superficie:C002"]
    assert (c2["coord_status"], c2["parish_match"], c2["site_id"]) == ("pending", "sem_coord", "")
    assert rows["superficie:C001"]["coord_swapped"] == "false"
    # produtores e capacidade
    b1, b2 = rows["organico_tipologia:B1"], rows["organico_tipologia:B2"]
    assert (b1["capacity_litres"], b1["capacity_status"], b1["producer_type_key"]) == ("", "unknown", "restaurant")
    assert (b2["capacity_litres"], b2["capacity_status"], b2["producer_type"]) == ("80", "assumed_litres", "Escola")
    assert (
        rows["organico_coletivo:BC1"]["capacity_litres"] == "80"
        and rows["organico_coletivo:BC1"]["stream"] == "organico"
    )
    assert rows["residuos_verdes:BC2"]["quantity"] == "3" and rows["residuos_verdes:BC2"]["stream"] == "verdes"


def test_fake_package_sites_group_equal_coordinates(fake_run: tuple[dict[str, object], Path, Path]) -> None:
    _, _, out = fake_run
    rows = {r["container_uid"]: r for r in _read(out / "municipal_containers.csv")}
    # centro de A: Profundidade 1 e 2, Superfície C001 e Orgânico B1 (mesmas coordenadas) = 4 unidades num local
    center = {
        rows[u]["site_id"] for u in ("profundidade:1", "profundidade:2", "superficie:C001", "organico_tipologia:B1")
    }
    assert len(center) == 1
    assert all(
        rows[u]["units_at_site"] == "4"
        for u in ("profundidade:1", "profundidade:2", "superficie:C001", "organico_tipologia:B1")
    )
    # BC1 está a 3 m: outro local
    assert rows["organico_coletivo:BC1"]["site_id"] not in center
    assert rows["organico_coletivo:BC1"]["units_at_site"] == "1"
    sites = {s["site_id"]: s for s in _read(out / "municipal_sites.csv")}
    site = sites[next(iter(center))]
    assert (site["containers"], site["site_class"], site["capacity_litres_total"]) == (
        "4",
        "mixed",
        str(5000 + 3000 + 1100),
    )
    assert (site["n_underground"], site["n_platform"], site["n_surface"], site["n_organic_producer"]) == (
        "1",
        "1",
        "1",
        "1",
    )
    assert site["capacity_unknown"] == "1"  # B1 com "???"
    assert site["n_stream_organic"] == "1" and site["n_stream_unknown"] == "3"
    assert site["textile_candidate"] == "true"
    # Barco: centro de B tem Profundidade 3, B2 e Verdes BC2 (quantidade 3): 3 contentores, 5 unidades declaradas
    b_site = sites[rows["residuos_verdes:BC2"]["site_id"]]
    assert (b_site["containers"], b_site["units_declared"]) == ("3", "5")  # 1 + 1 + 3


def test_fake_package_by_parish_and_links(fake_run: tuple[dict[str, object], Path, Path]) -> None:
    _, _, out = fake_run
    by = {r["dicofre_caop"]: r for r in _read(out / "municipal_by_parish.csv")}
    assert set(by) == {"030804", "030806"}  # "Outra" (BRAGA) ficou de fora
    a, b = by["030804"], by["030806"]
    # A: profundidade 1, 2; superfície C001; BC1; B1 = 5 contentores localizados; 2000 hab -> 2,5 por 1000 hab
    assert (a["containers"], a["population"], a["containers_per_1000_hab"]) == ("5", "2000", "2.5")
    assert a["containers_pending"] == "0"  # C002 está sem coordenadas e sem freguesia declarada: não se atribui
    # B: profundidade 3 e 5, B2, Verdes BC2 = 4 contentores; 1000 hab -> 4,0 por 1000 hab; área 1 km2
    assert (b["containers"], b["area_km2"], b["containers_per_1000_hab"]) == ("4", "1.0", "4.0")
    assert b["producers_school"] == "1" and a["producers_restaurant"] == "1"
    # ligação: BC1 está a 3 m de Profundidade 1 (e 2), mesmo local de C001 e B1
    link = _read(out / "municipal_links.csv")[0]
    assert link["organic_uid"] == "organico_coletivo:BC1" and link["within_link_radius"] == "true"
    assert abs(float(link["distance_m"]) - 3.0) <= 0.2
    summary = json.loads((out / "municipal_summary.json").read_text(encoding="utf-8"))
    assert summary["analysis"]["near_duplicates"]["cross_file_pairs"] >= 1
    # contadas ao ler, antes de rejeitar o ponto fora
    assert summary["containers"]["coord_swapped_by_header"]["profundidade"] == 5
    assert summary["parish_check"]["different"] == 1


def test_fake_package_outputs_are_valid_and_deterministic(
    fake_run: tuple[dict[str, object], Path, Path], tmp_path: Path
) -> None:
    _, raw, out = fake_run
    first = {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(out.rglob("*")) if p.is_file()}
    etl.run(raw, out, osm_path=tmp_path / "sem-osm.geojson")
    second = {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(out.rglob("*")) if p.is_file()}
    assert first == second
    geo = json.loads((out / "caop_guimaraes.geojson").read_text(encoding="utf-8"))
    assert [f["properties"]["dicofre"] for f in geo["features"]] == ["030804", "030806"]
    assert geo["features"][0]["properties"]["area_ha"] == 100.0  # 1000 m x 1000 m
    sources = json.loads((out / "sources.json").read_text(encoding="utf-8"))
    entry = next(s for s in sources if s["key"] == etl.SOURCE_KEY)
    assert len(entry["file_sha256"]) == 64
    with sqlite3.connect(out / "qgis" / "guimaraes_contentores_municipais.gpkg") as db:
        assert db.execute("select count(*) from contentores").fetchone() == (9,)
        assert db.execute("select count(*) from freguesias_caop2019").fetchone() == (2,)
        assert db.execute("pragma application_id").fetchone() == (1196444487,)


def test_without_package_nothing_is_written(tmp_path: Path) -> None:
    out = tmp_path / "processed"
    out.mkdir()
    (out / "municipal_containers.csv").write_text("x", encoding="utf-8")
    assert etl.run(tmp_path / "raw", out) == {"status": "awaiting_data"}
    assert not (out / "municipal_containers.csv").exists()


# --- pacote real: totais contra os ficheiros -------------------------------------------------------------------

PACKAGE = REPO / "data" / "raw" / "vitrus-mapa-qgis"
PROCESSED = REPO / "data" / "processed"


@pytest.mark.skipif(not (PROCESSED / "municipal_summary.json").exists(), reason="corre `just etl` primeiro")
def test_real_totals_match_raw_files() -> None:
    summary = json.loads((PROCESSED / "municipal_summary.json").read_text(encoding="utf-8"))
    # linhas de dados por ficheiro: contadas por fora do ETL (linhas físicas menos o cabeçalho)
    expected = {
        "profundidade": 593,
        "superficie": 795,
        "organico_coletivo": 397,
        "organico_tipologia": 923,
        "residuos_verdes": 46,
    }
    for spec in etl.FILES:
        lines = (PACKAGE / spec.file).read_text(encoding="utf-8").splitlines()
        assert len(lines) - 1 == expected[spec.key] == summary["files"][spec.key]["data_lines"]
    c = summary["containers"]
    assert c["rows_read"] == sum(expected.values()) == 2754
    assert c["accepted"] + c["rejected"] == c["rows_read"]
    assert c["located"] + c["pending_no_coordinates"] == c["accepted"]
    rows = _read(PROCESSED / "municipal_containers.csv")
    assert len(rows) == c["accepted"]
    by_file = {}
    for r in rows:
        by_file[r["source_file"]] = by_file.get(r["source_file"], 0) + 1
    rejected = _read(PROCESSED / "municipal_containers_rejected.csv")
    for key, n in expected.items():
        assert by_file[key] + sum(1 for r in rejected if r["source_file"] == key) == n
    # IDs únicos por ficheiro e capacidades: 593 de profundidade somam 17 x 3 m3 + 574 x 5 m3 + 2 plataformas...
    assert len({r["container_uid"] for r in rows}) == len(rows)
    deep = [r for r in rows if r["source_file"] == "profundidade"]
    assert sum(int(r["capacity_litres"]) for r in deep) == 17 * 3000 + 576 * 5000
    # 3 + 24 + 1 + 3 linhas sem coordenadas no pacote, menos a vazia (rejeitada): 29 pendentes
    assert c["pending_no_coordinates"] == 29
    # todos os contentores localizados têm local e freguesia dentro das 48
    located = [r for r in rows if r["coord_status"] == "ok"]
    assert all(r["site_id"] and r["parish_dicofre"] for r in located)
    assert len({r["parish_dicofre"] for r in located}) <= 48
    # população INE das freguesias soma 156 830 (a mesma da app)
    parishes = _read(PROCESSED / "municipal_by_parish.csv")
    assert len(parishes) == 48 and sum(int(p["population"]) for p in parishes) == 156_830
    assert sum(int(p["containers"]) for p in parishes) == len(located)
    # CAOP 2019: 24 099,97 ha somados nas 48 freguesias (atributo AREA_T_Ha do shapefile)
    assert summary["caop"]["area_ha_total"] == summary["caop"]["area_ha_attr_total"] == 24099.97
