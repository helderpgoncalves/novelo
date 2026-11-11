"""Mapas estáticos do deck a partir de data/processed (CAOP 2019 + pacote municipal da Vitrus)."""
import csv, json, sys
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import Polygon
from matplotlib.collections import PatchCollection

ROOT = sys.argv[1]
OUT = f"{ROOT}/pitch/vitrus/img"
LINHO, TINTA, FLORESTA, AREIA = "#F4F1EA", "#14211D", "#2E6B57", "#C4A06A"
gj = json.load(open(f"{ROOT}/data/processed/caop_guimaraes.geojson"))
sites = list(csv.DictReader(open(f"{ROOT}/data/processed/municipal_sites.csv")))

def rings(geom):
    if geom["type"] == "Polygon":
        yield geom["coordinates"][0]
    else:
        for poly in geom["coordinates"]:
            yield poly[0]

def base(ax):
    patches = [Polygon(r, closed=True) for f in gj["features"] for r in rings(f["geometry"])]
    ax.add_collection(PatchCollection(patches, facecolor="#E9E4D7", edgecolor="#B9B29F", linewidth=0.6))
    ax.set_aspect(1 / 0.75)  # ~cos(41.4°)
    ax.autoscale_view()
    ax.axis("off")

def pts(rows):
    return [float(r["longitude"]) for r in rows], [float(r["latitude"]) for r in rows]

def save(fig, name):
    fig.savefig(f"{OUT}/{name}", dpi=200, facecolor=LINHO, bbox_inches="tight", pad_inches=0.05)
    plt.close(fig)

cand = [s for s in sites if s["textile_candidate"] == "true"]
cand_prec = [s for s in cand if s["coord_precision"] == "precise"]
cand_appr = [s for s in cand if s["coord_precision"] != "precise"]
pub_non = [s for s in sites if s["site_class"] == "public" and s["textile_candidate"] != "true"]
school = [s for s in sites if "Escola" in s["producer_types"]]
prod = [s for s in sites if s["site_class"] == "producer" and "Escola" not in s["producer_types"]]

# 1. rede municipal inteira
fig, ax = plt.subplots(figsize=(7, 6.2), facecolor=LINHO); base(ax)
ax.scatter(*pts(pub_non), s=5, c="#8C8A7E", label=f"Só orgânico/verdes ({len(pub_non)})", linewidths=0)
ax.scatter(*pts(prod), s=6, c=AREIA, label=f"Produtores ({len(prod) + len(school)})", linewidths=0)
ax.scatter(*pts(cand), s=6, c=FLORESTA, label=f"Públicos com contentor de rua ({len(cand)})", linewidths=0)
ax.legend(loc="upper center", bbox_to_anchor=(0.5, 0.0), frameon=False, fontsize=9, labelcolor=TINTA, markerscale=1.6)
save(fig, "mapa-rede-municipal.png")

# 2. candidatos
fig, ax = plt.subplots(figsize=(7, 6.2), facecolor=LINHO); base(ax)
ax.scatter(*pts(cand_prec), s=7, c=FLORESTA, label=f"Públicos, coordenada precisa ({len(cand_prec)})", linewidths=0)
ax.scatter(*pts(cand_appr), s=9, c="#D9822B", label=f"Públicos, coordenada aproximada ({len(cand_appr)})", linewidths=0)
ax.scatter(*pts(school), s=22, c=TINTA, marker="s", label=f"Escolas, pontos assistidos ({len(school)})", linewidths=0)
ax.legend(loc="upper center", bbox_to_anchor=(0.5, 0.0), frameon=False, fontsize=9, labelcolor=TINTA, markerscale=1.0)
save(fig, "mapa-candidatos.png")
print(len(cand), len(cand_prec), len(cand_appr), len(school), len(prod), len(pub_non))
