"""ETL de contentores (scripts/etl/containers.py) com ficheiros FALSOS de tests/fixtures."""

import csv
import hashlib
import importlib.util
import json
import shutil
import sys
from datetime import date
from pathlib import Path
from types import ModuleType

import openpyxl
import pytest
from pyproj import Transformer

REPO = Path(__file__).resolve().parents[4]
FIXTURES = Path(__file__).resolve().parents[1] / "fixtures"


def _load() -> ModuleType:
    spec = importlib.util.spec_from_file_location("etl_containers", REPO / "scripts" / "etl" / "containers.py")
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    sys.modules["etl_containers"] = module  # os dataclasses precisam do módulo registado
    spec.loader.exec_module(module)
    return module


etl = _load()


def _run(tmp_path: Path, *files: str, **kwargs: str) -> tuple[dict[str, object], Path]:
    raw, out = tmp_path / "raw", tmp_path / "processed"
    raw.mkdir()
    for name in files:
        shutil.copy(FIXTURES / name, raw / name)
    return etl.run(raw, out, **kwargs), out


def _csv(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8", newline="") as fh:
        return list(csv.DictReader(fh))


# --- Funções pequenas ---


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("41,4425", 41.4425),
        (" -8.2918 ", -8.2918),
        ("1.234,5", 1234.5),
        ("1,234.5", 1234.5),
        ("-13 125,85", -13125.85),
        ("1.234.567", 1234567.0),
        (3, 3.0),
        ("abc", None),
        ("", None),
        (None, None),
    ],
)
def test_parse_number(raw: object, expected: float | None) -> None:
    assert etl.parse_number(raw) == expected


def test_kind_and_status_mapping() -> None:
    assert etl.map_kind("Têxteis") == ("textile", True)
    assert etl.map_kind("Roupa e calçado") == ("textile", True)
    assert etl.map_kind("Vidrão") == ("recyclable", True)
    assert etl.map_kind("Indiferenciados") == ("undifferentiated", True)
    assert etl.map_kind("Biorresíduos") == ("organic", True)
    assert etl.map_kind("Misterioso") == ("other", False)
    assert etl.map_status("Inativo") == ("inactive", True)  # "inativo" não é "ativo"
    assert etl.map_status("Ativo") == ("active", True)
    assert etl.map_status("A instalar") == ("planned", True)
    assert etl.map_status("Quebrado") == ("active", False)


def test_detect_columns_ignores_accents_and_case() -> None:
    cols = etl.detect_columns(["N.º", "TIPOLOGIA", "Situação", "Coordenada X", "Coordenada Y", "Lugar"])
    assert cols == {
        "ref": "N.º",
        "kind": "TIPOLOGIA",
        "status": "Situação",
        "x": "Coordenada X",
        "y": "Coordenada Y",
        "locality": "Lugar",
    }


def test_find_inputs_only_matching_names(tmp_path: Path) -> None:
    for name in (
        "Contentores_2026.xlsx",
        "ecopontos.GEOJSON",
        "lista container.csv",
        "dados_textil.xlsx",
        "~$contentores.xlsx",
    ):
        (tmp_path / name).write_bytes(b"")
    (tmp_path / "public").mkdir()
    names = [p.name for p in etl.find_inputs(tmp_path)]
    assert names == ["Contentores_2026.xlsx", "ecopontos.GEOJSON", "lista container.csv"]


# --- Sem ficheiro: não escreve nada ---


def test_no_input_writes_nothing(tmp_path: Path) -> None:
    result, out = _run(tmp_path)
    assert result == {"status": "awaiting_data", "files": []}
    assert not out.exists()


def test_no_input_removes_stale_outputs_and_manifest_entry(tmp_path: Path) -> None:
    result, out = _run(tmp_path, "contentores_teste.csv")
    assert result["status"] == "ok"
    (tmp_path / "raw" / "contentores_teste.csv").unlink()
    assert etl.run(tmp_path / "raw", out)["status"] == "awaiting_data"
    assert not (out / "containers.csv").exists()
    assert json.loads((out / "sources.json").read_text()) == []


# --- CSV com ; e vírgula decimal ---


def test_csv_semicolon_decimal_comma(tmp_path: Path) -> None:
    result, out = _run(tmp_path, "contentores_teste.csv")
    assert result["accepted"] == 7 and result["located"] == 6 and result["pending"] == 1
    assert result["rejected"] == 4
    rows = {r["external_ref"]: r for r in _csv(out / "containers.csv")}
    assert set(rows) == {"TESTE-001", "TESTE-002", "TESTE-003", "TESTE-004", "TESTE-005", "TESTE-009", "TESTE-010"}

    first = rows["TESTE-001"]
    assert (first["latitude"], first["longitude"]) == ("41.453900", "-8.290200")
    assert first["kind"] == "textile" and first["status"] == "active"
    assert first["parish"] == "Azurém" and first["operator"] == "Operador Falso"
    assert first["capacity_litres"] == "2500" and first["installed_on"] == "2024-03-15"
    assert rows["TESTE-002"]["kind"] == "textile" and rows["TESTE-002"]["status"] == "active"
    assert rows["TESTE-003"]["kind"] == "undifferentiated" and rows["TESTE-003"]["status"] == "inactive"
    assert rows["TESTE-004"]["kind"] == "recyclable" and rows["TESTE-004"]["status"] == "planned"
    assert rows["TESTE-010"]["kind"] == "other" and rows["TESTE-010"]["status"] == "active"

    pending = rows["TESTE-005"]
    assert pending["coord_status"] == "pending" and pending["latitude"] == "" and pending["parish"] == "Ronfe"

    swapped = rows["TESTE-009"]  # latitude e longitude trocadas no ficheiro
    assert (swapped["latitude"], swapped["longitude"]) == ("41.442500", "-8.291800")


def test_csv_rejections_say_why(tmp_path: Path) -> None:
    _, out = _run(tmp_path, "contentores_teste.csv")
    rejected = {r["line"]: r["reason_key"] for r in _csv(out / "containers_rejected.csv")}
    assert rejected == {
        "7": "outside_municipality",  # 0,0
        "8": "bad_coordinates",  # abc / def
        "9": "duplicate_ref",  # TESTE-001 outra vez
        "12": "no_location",  # linha sem nada
    }


def test_quality_alerts_for_data_quality_screen(tmp_path: Path) -> None:
    _, out = _run(tmp_path, "contentores_teste.csv")
    alerts = _csv(out / "containers_alerts.csv")
    assert [a["type_key"] for a in alerts] == [
        "container_rows_rejected",
        "container_pending_location",
        "container_assumed_values",
    ]
    assert [a["id"] for a in alerts] == ["1", "2", "3"]
    assert "4 linhas" in alerts[0]["detail"] and "contentores_teste.csv linha 8" in alerts[0]["detail"]
    assert "1 contentores" in alerts[1]["detail"] and "TESTE-005" in alerts[1]["detail"]
    assert "'Misterioso' (1)" in alerts[2]["detail"] and "'Quebrado' (1)" in alerts[2]["detail"]
    assert "1 linhas com latitude/longitude" in alerts[2]["detail"]


def test_manifest_has_sha256_and_is_idempotent(tmp_path: Path) -> None:
    _, out = _run(tmp_path, "contentores_teste.csv")
    first = (out / "containers.csv").read_bytes()
    entry = next(m for m in json.loads((out / "sources.json").read_text()) if m["key"] == "vitrus_containers")
    assert entry["file_sha256"] == hashlib.sha256((tmp_path / "raw" / "contentores_teste.csv").read_bytes()).hexdigest()
    assert entry["file_name"] == "contentores_teste.csv"
    etl.run(tmp_path / "raw", out)
    assert (out / "containers.csv").read_bytes() == first
    manifest = json.loads((out / "sources.json").read_text())
    assert [m["key"] for m in manifest].count("vitrus_containers") == 1


def test_default_kind_is_explicit_opt_in(tmp_path: Path) -> None:
    raw = tmp_path / "raw"
    raw.mkdir()
    (raw / "contentores.csv").write_text("id;lat;lon\nA;41,45;-8,29\n", encoding="utf-8")
    etl.run(raw, tmp_path / "a")
    assert _csv(tmp_path / "a" / "containers.csv")[0]["kind"] == "other"
    assert "sem tipo" in _csv(tmp_path / "a" / "containers_alerts.csv")[0]["detail"]
    etl.run(raw, tmp_path / "b", default_kind="textile")
    assert _csv(tmp_path / "b" / "containers.csv")[0]["kind"] == "textile"


def test_csv_latin1_and_comma_delimiter(tmp_path: Path) -> None:
    raw = tmp_path / "raw"
    raw.mkdir()
    (raw / "container_lista.csv").write_bytes("ID,Tipo,Latitude,Longitude\nX1,Têxtil,41.45,-8.29\n".encode("cp1252"))
    result = etl.run(raw, tmp_path / "out")
    assert result["accepted"] == 1
    assert _csv(tmp_path / "out" / "containers.csv")[0]["kind"] == "textile"


def test_single_coordinate_column(tmp_path: Path) -> None:
    raw = tmp_path / "raw"
    raw.mkdir()
    (raw / "contentores.csv").write_text('ID;Tipo;Coordenadas\nA;Têxtil;"41,4539, -8,2902"\n', encoding="utf-8")
    etl.run(raw, tmp_path / "out")
    row = _csv(tmp_path / "out" / "containers.csv")[0]
    assert (row["latitude"], row["longitude"]) == ("41.453900", "-8.290200")


# --- GeoJSON ---


def test_geojson(tmp_path: Path) -> None:
    result, out = _run(tmp_path, "ecopontos_teste.geojson")
    assert result["accepted"] == 3 and result["located"] == 2 and result["pending"] == 1 and result["rejected"] == 1
    rows = {r["external_ref"]: r for r in _csv(out / "containers.csv")}
    assert (rows["101"]["latitude"], rows["101"]["longitude"]) == ("41.453900", "-8.290200")
    assert rows["101"]["address"] == "Praça Falsa de Teste" and rows["101"]["status"] == "active"
    assert rows["102"]["status"] == "inactive"
    assert rows["104"]["coord_status"] == "pending" and rows["104"]["parish"] == "Creixomil"
    assert _csv(out / "containers_rejected.csv")[0]["reason_key"] == "not_a_point"


def test_geojson_projected_crs(tmp_path: Path) -> None:
    raw = tmp_path / "raw"
    raw.mkdir()
    doc = {
        "type": "FeatureCollection",
        "crs": {"type": "name", "properties": {"name": "urn:ogc:def:crs:EPSG::3763"}},
        "features": [
            {
                "type": "Feature",
                "properties": {"ID": "P1", "Tipo": "Têxtil"},
                "geometry": {"type": "Point", "coordinates": [-13125.851908, 198299.292090]},
            }
        ],
    }
    (raw / "contentores.geojson").write_text(json.dumps(doc), encoding="utf-8")
    etl.run(raw, tmp_path / "out")
    row = _csv(tmp_path / "out" / "containers.csv")[0]
    assert float(row["latitude"]) == pytest.approx(41.4539, abs=1e-5)
    assert float(row["longitude"]) == pytest.approx(-8.2902, abs=1e-5)


# --- Excel com X/Y em PT-TM06 ---


def test_xlsx_projected_xy_ptm06(tmp_path: Path) -> None:
    to_tm06 = Transformer.from_crs(4326, 3763, always_xy=True)
    x1, y1 = to_tm06.transform(-8.2902, 41.4539)
    x2, y2 = to_tm06.transform(-8.3000, 41.4600)
    wb = openpyxl.Workbook()
    ws = wb.active
    assert ws is not None
    ws.title = "Contentores"
    ws.append(["Listagem FALSA de contentores (teste)"])
    ws.append([])
    ws.append(["N.º", "Tipologia", "Situação", "X (PT-TM06)", "Y (PT-TM06)", "Freguesia", "Data instalação"])
    ws.append([1, "Têxtil", "Ativo", x1, y1, "Azurém", date(2025, 1, 31)])
    ws.append([2, "Têxtil", "Ativo", f"{x2:.2f}".replace(".", ","), f"{y2:.2f}".replace(".", ","), "Azurém", None])
    ws.append([3, "Têxtil", "Ativo", 0, 0, "Azurém", None])
    notes = wb.create_sheet("Notas")
    notes.append(["Isto não é uma tabela de contentores"])
    raw = tmp_path / "raw"
    raw.mkdir()
    wb.save(raw / "Contentores_teste.xlsx")

    result = etl.run(raw, tmp_path / "out")
    assert result["accepted"] == 2 and result["rejected"] == 1
    rows = {r["external_ref"]: r for r in _csv(tmp_path / "out" / "containers.csv")}
    assert float(rows["1"]["latitude"]) == pytest.approx(41.4539, abs=1e-5)
    assert float(rows["1"]["longitude"]) == pytest.approx(-8.2902, abs=1e-5)
    assert float(rows["2"]["latitude"]) == pytest.approx(41.4600, abs=1e-4)  # centímetros perdidos nos 2 decimais
    assert rows["1"]["installed_on"] == "2025-01-31"
    assert _csv(tmp_path / "out" / "containers_rejected.csv")[0]["line"] == "6"
