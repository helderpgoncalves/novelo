# /// script
# requires-python = ">=3.12"
# dependencies = ["httpx>=0.28", "shapely>=2.0"]
# ///
"""Descarrega dados públicos reais e guarda-os em data/raw/public/ (versionados, para o ETL ser reproduzível).

- INE, Censos 2021 (indicador 0011609): população residente por freguesia de Guimarães.
- OpenStreetMap (Nominatim): polígono de cada freguesia e coordenadas de cada localidade dos circuitos.

Uso: `just fetch-public` (demora uns 3 minutos: o Nominatim exige no máximo 1 pedido por segundo).
Dados © INE, I.P. e © colaboradores do OpenStreetMap (ODbL).
"""

from __future__ import annotations

import csv
import json
import re
import time
from pathlib import Path

import httpx
from shapely.geometry import Point, mapping, shape
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "data" / "raw" / "public"
PROCESSED = ROOT / "data" / "processed"
UA = "novelo-hackathon/1.0 (https://novelo.bitsapiens.io; contacto-removido)"
INE = "https://www.ine.pt/ine/json_indicador/pindica.jsp"
NOMINATIM = "https://nominatim.openstreetmap.org/search"


def fetch_population(client: httpx.Client) -> list[dict]:
    """Um pedido por código de freguesia (030801...): a API recusa listas com códigos inválidos.

    O resultado fica em data/raw/public/population_ine.json: só se volta a pedir ao INE se o ficheiro não existir.
    """
    cache = OUT / "population_ine.json"
    if cache.exists():
        return json.loads(cache.read_text())
    rows = []
    for n in range(1, 100):
        code = f"0308{n:02d}"
        data = None
        for attempt in range(4):
            try:
                resp = client.get(
                    INE,
                    params={"op": 2, "varcd": "0011609", "Dim1": "S7A2021", "Dim2": code, "Dim3": "T", "Dim4": "T", "lang": "PT"},
                    timeout=40,
                )
                data = resp.json()[0]
                break
            except (ValueError, httpx.HTTPError):
                time.sleep(2 + attempt * 3)
        if not data or "Dados" not in data:
            continue
        item = data["Dados"]["2021"][0]
        rows.append({"dicofre": item["geocod"], "name": item["geodsg"], "population": int(item["valor"]), "year": 2021})
    cache.write_text(json.dumps(rows, ensure_ascii=False, indent=1))
    return rows


# Nomes das freguesias antigas no OpenStreetMap, para as uniões cujo polígono não existe como relação própria.
CONSTITUENTS = {
    "Candoso São Tiago e Mascotelos": ["Candoso (Santiago)", "Mascotelos"],
    "Leitões, Oleiros e Figueiredo": ["Leitões", "Oleiros", "Figueiredo"],
    "Oliveira, São Paio e São Sebastião": ["Oliveira do Castelo", "São Paio", "São Sebastião"],
    "Souto Santa Maria, Souto São Salvador e Gondomar": ["Souto (Santa Maria)", "Souto (São Salvador)", "Gondomar"],
}


def geocode(client: httpx.Client, query: str, polygon: bool = False) -> dict | None:
    params = {"q": f"{query}, Guimarães, Portugal", "format": "jsonv2", "limit": 1, "countrycodes": "pt"}
    if polygon:
        params |= {"polygon_geojson": 1, "polygon_threshold": 0.0004}
    for attempt in range(5):
        time.sleep(1.1 + attempt * 4)  # política de uso do Nominatim; recua se nos pedir calma
        try:
            results = client.get(NOMINATIM, params=params, timeout=40).json()
        except (ValueError, httpx.HTTPError):
            continue
        return results[0] if results else None
    return None


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    with httpx.Client(headers={"User-Agent": UA}, follow_redirects=True) as client:
        parishes = fetch_population(client)
        print(f"INE: {len(parishes)} freguesias, {sum(p['population'] for p in parishes)} habitantes")

        # Incremental: reaproveita os polígonos já descarregados (o Nominatim é lento e deve ser tratado com cuidado).
        cache_file = OUT / "parishes.geojson"
        cached = {
            f["properties"]["dicofre"]: f for f in json.loads(cache_file.read_text())["features"]
        } if cache_file.exists() else {}
        features = []
        for p in parishes:
            if p["dicofre"] in cached:
                feature = cached[p["dicofre"]]
                feature["properties"].update(p)
                features.append(feature)
                continue
            # As uniões de freguesias têm nomes como "Abação e Gémeos": no OSM chamam-se "União das freguesias de ...".
            queries = [f"União das freguesias de {p['name']}", p["name"]] if " e " in p["name"] else [p["name"]]
            geometry, hit = None, None
            for q in queries:
                hit = geocode(client, q, polygon=True)
                geometry = hit.get("geojson") if hit else None
                if geometry and geometry["type"] in {"Polygon", "MultiPolygon"}:
                    break
                geometry = None
            if not geometry:
                # Último recurso: a união dos polígonos das freguesias que a compõem ("A, B e C").
                short = p["name"].replace("União das freguesias de ", "")
                parts = CONSTITUENTS.get(short) or [x.strip() for x in re.split(r",| e ", short) if x.strip()]
                shapes = []
                for part in parts:
                    sub = geocode(client, part, polygon=True)
                    sub_geometry = sub.get("geojson") if sub else None
                    if sub_geometry and sub_geometry["type"] in {"Polygon", "MultiPolygon"}:
                        shapes.append(shape(sub_geometry))
                if len(shapes) == len(parts) and shapes:
                    geometry = mapping(unary_union(shapes))
                    hit = {"osm_id": "union"}
            if not geometry:
                # Sem contorno: ficamos só com um ponto (a freguesia entra no otimizador mas não no mapa coroplético).
                point = geocode(client, (CONSTITUENTS.get(p["name"].replace("União das freguesias de ", "")) or [p["name"]])[0])
                print("  sem polígono, só ponto:", p["name"], "->", bool(point))
                if point:
                    features.append(
                        {
                            "type": "Feature",
                            "properties": {**p, "lat": round(float(point["lat"]), 6), "lon": round(float(point["lon"]), 6), "osm_id": None},
                            "geometry": None,
                        }
                    )
                continue
            centroid = shape(geometry).representative_point()
            features.append(
                {
                    "type": "Feature",
                    "properties": {**p, "lat": round(centroid.y, 6), "lon": round(centroid.x, 6), "osm_id": hit.get("osm_id")},
                    "geometry": mapping(shape(geometry).simplify(0.0002)),
                }
            )
        (OUT / "parishes.geojson").write_text(json.dumps({"type": "FeatureCollection", "features": features}, ensure_ascii=False))
        print(f"OSM: {len(features)} polígonos de freguesia")

        polygons = [(f["properties"]["dicofre"], shape(f["geometry"])) for f in features if f["geometry"]]
        loc_cache = OUT / "localities_geocoded.json"
        known = {x["locality"]: x for x in json.loads(loc_cache.read_text())} if loc_cache.exists() else {}
        localities = []
        with (PROCESSED / "localities.csv").open(encoding="utf-8") as fh:
            names = [row["locality"] for row in csv.DictReader(fh)]
        for name in names:
            previous = known.get(name)
            if previous and previous["lat"] is not None:
                point = Point(previous["lon"], previous["lat"])
                previous["dicofre"] = next((code for code, poly in polygons if poly.contains(point)), None)
                localities.append(previous)
                continue
            hit = geocode(client, name)
            if not hit:
                localities.append({"locality": name, "lat": None, "lon": None, "dicofre": None, "osm_display": None})
                continue
            point = Point(float(hit["lon"]), float(hit["lat"]))
            parish = next((code for code, poly in polygons if poly.contains(point)), None)
            localities.append(
                {"locality": name, "lat": round(point.y, 6), "lon": round(point.x, 6), "dicofre": parish, "osm_display": hit["display_name"]}
            )
        (OUT / "localities_geocoded.json").write_text(json.dumps(localities, ensure_ascii=False, indent=1))
        located = sum(1 for x in localities if x["lat"] is not None)
        print(f"OSM: {located}/{len(localities)} localidades geocodificadas")

    sources = {
        "ine_census_2021": "INE, Censos 2021, indicador 0011609 (população residente por local de residência)",
        "osm_nominatim": "© OpenStreetMap contributors (ODbL), geocodificação Nominatim",
    }
    (OUT / "sources.json").write_text(json.dumps(sources, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
