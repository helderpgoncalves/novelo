"""Compara a estrada (OSRM) com a estimativa do modelo: desvio da estrada e velocidade média da viatura.

Mede estaleiro -> centróide de cada freguesia e estaleiro -> locais candidatos, nos dois sentidos, e imprime o desvio
(estrada ÷ linha reta) e a velocidade média (km ÷ h) para comparar com `detour_factor` e `vehicle_speed_kmh` dos
pressupostos. Uso: `just osrm-calibrate` (precisa do OSRM a correr). Os números vão para docs/engenharia/rotas-reais.md.
"""

import argparse
import csv
import statistics
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "apps" / "api" / "src"))

from novelo.adapters.osrm import OsrmClient, OsrmError  # noqa: E402
from novelo.domain.geo import haversine_km  # noqa: E402
from novelo.features.planning import assumptions as a  # noqa: E402
from novelo.features.planning.params import default_params  # noqa: E402

PROCESSED = ROOT / "data" / "processed"


def read(name: str, lat: str, lon: str, *, only_true: str | None = None) -> list[tuple[float, float]]:
    with (PROCESSED / name).open(encoding="utf-8") as f:
        rows = [r for r in csv.DictReader(f) if only_true is None or r[only_true] == "true"]
    return [(float(r[lat]), float(r[lon])) for r in rows]


def pct(values: list[float], q: float) -> float:
    ordered = sorted(values)
    return ordered[min(len(ordered) - 1, round(q * (len(ordered) - 1)))]


def report(title: str, depot: tuple[float, float], points: list[tuple[float, float]], client: OsrmClient) -> None:
    nodes = [depot, *points]
    m = client.table(nodes)
    detours: list[float] = []
    speeds: list[float] = []
    unreachable = 0
    for i, p in enumerate(points, start=1):
        straight = haversine_km(*depot, *p)
        for d, t in ((m.distance_m[0][i], m.duration_s[0][i]), (m.distance_m[i][0], m.duration_s[i][0])):
            if d is None or t is None or t <= 0 or straight < 0.05:
                unreachable += d is None
                continue
            detours.append(d / 1000 / straight)
            speeds.append(d / 1000 / (t / 3600))
    print(f"\n{title}: {len(points)} pontos, {len(detours)} trajetos medidos, {unreachable} sem caminho")
    print(
        f"  desvio da estrada (estrada ÷ linha reta)  mediana {statistics.median(detours):.2f}   "
        f"p10 {pct(detours, 0.1):.2f}   p90 {pct(detours, 0.9):.2f}   média {statistics.mean(detours):.2f}   "
        f"(pressuposto: {default_params().detour_factor:g})"
    )
    print(
        f"  velocidade média de condução (km/h)       mediana {statistics.median(speeds):.1f}   "
        f"p10 {pct(speeds, 0.1):.1f}   p90 {pct(speeds, 0.9):.1f}   (pressuposto: {a.VEHICLE_SPEED_KMH:g})"
    )


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--url", default="http://localhost:5190", help="OSRM (por omissão o do `just dev`)")
    ap.add_argument("--sites", type=int, default=300, help="máximo de locais candidatos a medir")
    args = ap.parse_args()
    client = OsrmClient(args.url, timeout_s=60)
    depot = (a.DEPOT_LAT, a.DEPOT_LON)
    try:
        print(f"Estaleiro {depot} · {args.url}")
        report("Centróides das freguesias", depot, read("parishes.csv", "latitude", "longitude"), client)
        sites = read("municipal_sites.csv", "latitude", "longitude", only_true="textile_candidate")[: args.sites]
        report("Locais municipais candidatos", depot, sites, client)
    except OsrmError as exc:
        print(f"OSRM indisponível: {exc}\nArranca-o com `just osrm-up`.", file=sys.stderr)
        return 1
    finally:
        client.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
