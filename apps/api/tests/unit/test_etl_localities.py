"""Freguesia e coordenadas das localidades dos circuitos (scripts/etl/locality_parishes.py), com polígonos feitos à mão.

O último teste confere o resultado real em data/processed/localities_geo.csv (gerado por `just etl`).
"""

import csv
import importlib.util
import sys
from pathlib import Path
from types import ModuleType

import pytest
from shapely.geometry import box

REPO = Path(__file__).resolve().parents[4]


def _load() -> ModuleType:
    spec = importlib.util.spec_from_file_location("etl_localities", REPO / "scripts" / "etl" / "locality_parishes.py")
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    sys.modules["etl_localities"] = module  # os dataclasses precisam do módulo registado
    spec.loader.exec_module(module)
    return module


etl = _load()

# Duas freguesias quadradas lado a lado (lon, lat): A em [0, 1] e a união B + C em [1, 2] (só a latitude 0 a 1).
PARISHES = [
    etl.ParishShape("A1", "Aldeia", box(0, 0, 1, 1)),
    etl.ParishShape("U1", "União das freguesias de Bela Vista e Cimo", box(1, 0, 2, 1)),
]
FIXES = {
    "Cimo": etl.Correction("U1", "Cimo", "freguesia antiga na união"),
    "Bela": etl.Correction("U1", "Bela Vista", "freguesia antiga na união"),
}


def test_name_correction_keeps_a_point_inside_and_otherwise_uses_the_centroid() -> None:
    rows = etl.resolve(
        [
            {"locality": "Cimo", "lat": None, "lon": None},  # sem coordenadas: centroide da união (1,5; 0,5)
            {"locality": "Bela", "lat": 0.25, "lon": 0.5},  # ponto do Nominatim noutra freguesia: centroide
        ],
        PARISHES,
        FIXES,
        {},
    )
    cimo, bela = rows
    assert (cimo["dicofre"], cimo["latitude"], cimo["longitude"]) == ("U1", 0.5, 1.5)
    assert cimo["parish_method"] == "name_caop" and cimo["coord_method"] == "caop_centroid"
    assert (bela["dicofre"], bela["coord_method"]) == ("U1", "caop_centroid")
    inside = etl.resolve([{"locality": "Bela", "lat": 0.2, "lon": 1.2}], PARISHES, FIXES, {})[0]
    assert (inside["latitude"], inside["longitude"], inside["coord_method"]) == (0.2, 1.2, "nominatim")


def test_point_in_polygon_and_unresolved() -> None:
    rows = etl.resolve(
        [
            {"locality": "Lugar", "lat": 0.5, "lon": 0.3},  # dentro de A
            {"locality": "Fora", "lat": 5.0, "lon": 5.0},  # fora de tudo
            {"locality": "Ruas", "lat": None, "lon": None},  # sem coordenadas nem correção
            {"locality": "Duvidosa", "lat": 0.5, "lon": 0.3},  # ambígua: nunca se atribui, mesmo com ponto
        ],
        PARISHES,
        FIXES,
        {"Duvidosa": "duas freguesias no nome"},
    )
    assert [(r["dicofre"], r["parish_method"]) for r in rows] == [
        ("A1", "point_caop"),
        ("", "unresolved"),
        ("", "unresolved"),
        ("", "unresolved"),
    ]
    assert rows[3]["note"] == "duas freguesias no nome" and rows[3]["latitude"] == ""


def test_a_correction_must_point_to_the_only_parish_with_that_name() -> None:
    with pytest.raises(ValueError, match="ambígua"):
        etl.check_corrections(PARISHES, {"X": etl.Correction("A1", "Cimo", "errada: Cimo está em U1")})
    twins = [*PARISHES, etl.ParishShape("C2", "Cimo de Baixo", box(2, 0, 3, 1))]
    with pytest.raises(ValueError):
        etl.check_corrections(twins, {"X": etl.Correction("U1", "Cimo", "Cimo está em duas freguesias")})


def test_alerts_list_the_fixes_and_the_open_ones() -> None:
    rows = etl.resolve(
        [{"locality": "Cimo", "lat": None, "lon": None}, {"locality": "Ruas", "lat": None, "lon": None}],
        PARISHES,
        FIXES,
        {"Ruas": "sem freguesia no nome"},
    )
    alerts = etl.alerts(rows, {"Cimo": "C7", "Ruas": "C22"}, first_id=101, corrections=FIXES)
    assert [(a["id"], a["type_key"]) for a in alerts] == [(101, "normalized_spelling"), (102, "incomplete_circuit")]
    assert "Cimo (C7) → Cimo" in alerts[0]["detail"] and "Ruas (C22): sem freguesia no nome" in alerts[1]["detail"]


def test_real_localities_put_circuit_c7_in_its_caop_parish() -> None:
    path = REPO / "data" / "processed" / "localities_geo.csv"
    if not path.exists():
        pytest.skip("sem data/processed (correr `just etl`)")
    with path.open(encoding="utf-8", newline="") as fh:
        rows = {r["locality"]: r for r in csv.DictReader(fh)}
    # C7 (PAP, 60-93-ZG): "Donin; Briteiros S. Estevão" -> União de Briteiros Santo Estêvão e Donim (030879)
    assert rows["Donin"]["dicofre"] == rows["Briteiros S. Estevão"]["dicofre"] == "030879"
    assert rows["São Salvador de Briteiros"]["dicofre"] == "030880"  # o Nominatim punha-a em Barco
    unresolved = {name for name, r in rows.items() if not r["dicofre"]}
    assert unresolved == {"Ruas Estreitas", "Selho Ruas Estreitas", "São Torcato Rua Estreitas Vermil Creixomil (5ª)"}
