"""Domínio da rede municipal: valores calculados à mão (sem base de dados)."""

import csv
from pathlib import Path

import pytest

from novelo.core.config import get_settings
from novelo.domain import municipal as dom
from novelo.domain.coverage import FRENCH_PEOPLE_PER_POINT, reference_points

# --- fold ----------------------------------------------------------------------------------------------------------


def test_fold_removes_accents_case_and_extra_spaces() -> None:
    assert dom.fold("  São  TORCATO ") == "sao torcato"
    assert dom.fold("Cemitério de Lordelo") == "cemiterio de lordelo"


# --- bbox ----------------------------------------------------------------------------------------------------------


def test_parse_bbox_order_is_lon_lat() -> None:
    box = dom.parse_bbox("-8.30, 41.45,-8.29,41.46")
    assert (box.min_lon, box.min_lat, box.max_lon, box.max_lat) == (-8.30, 41.45, -8.29, 41.46)
    assert box.contains(41.456, -8.296) and not box.contains(41.456, -8.27) and not box.contains(41.47, -8.295)
    assert box.contains(41.45, -8.30)  # os limites contam


@pytest.mark.parametrize(
    "raw", ["", "1,2,3", "1,2,3,4,5", "a,b,c,d", "-8,41,-9,42", "-8,42,-7,41", "-200,0,0,1", "0,-95,1,0"]
)
def test_parse_bbox_rejects_invalid(raw: str) -> None:
    with pytest.raises(ValueError):
        dom.parse_bbox(raw)


# --- agrupamento ----------------------------------------------------------------------------------------------------


def test_cell_size_halves_with_each_zoom() -> None:
    # zoom 0: 360° em 4 células de 64 px por mosaico de 256 px = 90°; zoom 10: 90 / 1024
    assert dom.cell_size_deg(0) == 90.0
    assert dom.cell_size_deg(10) == pytest.approx(0.087890625)
    assert dom.cell_size_deg(11) == pytest.approx(dom.cell_size_deg(10) / 2)


def test_grid_cluster_weighted_centroid_and_singletons() -> None:
    pts = [
        dom.GeoPoint("a", 41.00, -8.00, 1),
        dom.GeoPoint("b", 41.01, -8.01, 3),  # mesma célula (0,0879°) que "a"
        dom.GeoPoint("c", 41.50, -8.50, 2),  # sozinho
    ]
    out = dom.grid_cluster(pts, zoom=10)
    assert len(out) == 2
    group = next(c for c in out if c.sites == 2)
    # média ponderada: lat = (41,00·1 + 41,01·3) / 4 = 41,0075; lon = (-8,00·1 + -8,01·3) / 4 = -8,0075
    assert (group.weight, group.keys) == (4, ())
    assert group.lat == pytest.approx(41.0075) and group.lon == pytest.approx(-8.0075)
    alone = next(c for c in out if c.sites == 1)
    assert alone.keys == ("c",) and (alone.lat, alone.lon) == (41.5, -8.5)


def test_grid_cluster_stops_at_street_zoom_and_rejects_negative() -> None:
    pts = [dom.GeoPoint("a", 41.0, -8.0), dom.GeoPoint("b", 41.0, -8.0)]
    assert len(dom.grid_cluster(pts, zoom=dom.MAX_CLUSTER_ZOOM)) == 2
    assert len(dom.grid_cluster(pts, zoom=3)) == 1
    with pytest.raises(ValueError):
        dom.grid_cluster(pts, zoom=-1)


# --- lacuna estimada -----------------------------------------------------------------------------------------------


def test_gap_estimate_by_hand() -> None:
    # lacuna: 3 000 hab · 1,25 kg/mês · 12 / 1000 = 45 t; potencial: 45 ÷ (1 − 0,25) = 60 t; 2 candidatos: 22,5 t cada
    g = dom.gap_estimate(3000, 2, 1.25, 0.25)
    assert (round(g.potential_t, 2), round(g.gap_t, 2), round(g.t_per_candidate, 2)) == (60.0, 45.0, 22.5)
    zero = dom.gap_estimate(3000, 0, 1.25, 0.25)  # sem candidatos divide por 1
    assert round(zero.t_per_candidate, 2) == 45.0


@pytest.mark.parametrize(
    ("args"), [(-1, 0, 0.7, 0.2), (10, -1, 0.7, 0.2), (10, 1, 0, 0.2), (10, 1, 0.7, 1.5), (10, 1, 0.7, 1.0)]
)
def test_gap_estimate_validates(args: tuple[int, int, float, float]) -> None:
    with pytest.raises(ValueError):
        dom.gap_estimate(*args)


def test_gap_estimate_reproduces_the_etl_columns_for_all_48_parishes() -> None:
    """O ETL calcula `textile_gap_t_estimate` e `gap_t_per_candidate_site`; o domínio dá o mesmo (±0,05 e ±0,01)."""
    path = get_settings().data_dir / "municipal_by_parish.csv"
    with Path(path).open(encoding="utf-8", newline="") as fh:
        rows = list(csv.DictReader(fh))
    assert len(rows) == 48
    textile_t = 43_050.5 / 0.84 * 0.0586  # têxtil no lixo do concelho (Vitrus + APA): 3 003,28 t
    kg = textile_t * 1000 / 156_830 / 12  # por habitante e mês: 1,5958
    capture = 301.266 / (textile_t + 301.266)  # captura atual do concelho: 9,12%
    for r in rows:
        g = dom.gap_estimate(int(r["population"]), int(r["candidate_sites"]), kg, capture)
        assert abs(g.potential_t - float(r["textile_potential_t_estimate"])) <= 0.05, r["name"]
        assert abs(g.gap_t - float(r["textile_gap_t_estimate"])) <= 0.05, r["name"]
        assert abs(g.t_per_candidate - float(r["gap_t_per_candidate_site"])) <= 0.01, r["name"]
    assert sum(float(r["textile_gap_t_estimate"]) for r in rows) == pytest.approx(3003.28, abs=0.5)


# --- candidatos -------------------------------------------------------------------------------------------------


def test_candidate_reasons_keys() -> None:
    assert dom.candidate_reasons(has_underground=True, organic_within_15m=2, containers=3, approximate=True) == [
        "underground", "organic_collective_nearby", "three_or_more_containers", "approximate_coordinates",
    ]  # fmt: skip
    assert dom.candidate_reasons(has_underground=False, organic_within_15m=0, containers=2, approximate=False) == []


def test_candidate_sort_key_follows_the_documented_order() -> None:
    def c(site: str, precise: bool, gap: float, ug: bool, org: int, n: int) -> dom.CandidateKeyInput:
        return dom.CandidateKeyInput(site, precise, gap, ug, org, n)

    items = [
        c("S5", False, 20.0, True, 1, 9),  # aproximado: depois de todos os precisos
        c("S4", True, 1.0, False, 0, 1),  # preciso, freguesia com pouca lacuna
        c("S3", True, 5.0, False, 0, 1),  # preciso, mais lacuna
        c("S2", True, 5.0, True, 0, 1),  # igual ao S3 mas com enterrado
        c("S1", True, 5.0, True, 1, 1),  # e com orgânico perto
        c("S0", True, 5.0, True, 1, 4),  # e mais contentores
    ]
    assert [x.site_id for x in sorted(items, key=dom.candidate_sort_key)] == ["S0", "S1", "S2", "S3", "S4", "S5"]
    tie = [c("Sb", True, 1.0, False, 0, 1), c("Sa", True, 1.0, False, 0, 1)]
    assert [x.site_id for x in sorted(tie, key=dom.candidate_sort_key)] == ["Sa", "Sb"]


# --- estatística -----------------------------------------------------------------------------------------------------


def test_quantile_linear_interpolation() -> None:
    values = [4.0, 1.0, 3.0, 2.0]
    assert dom.quantile(values, 0) == 1.0 and dom.quantile(values, 1) == 4.0
    assert dom.quantile(values, 0.5) == 2.5  # posição 1,5 entre 2 e 3
    assert dom.quantile(values, 0.25) == 1.75  # posição 0,75 entre 1 e 2
    assert dom.quantile([7.0], 0.9) == 7.0
    d = dom.distribution(values)
    assert (d.minimum, d.p25, d.median, d.p75, d.maximum) == (1.0, 1.75, 2.5, 3.25, 4.0)
    with pytest.raises(ValueError):
        dom.quantile([], 0.5)
    with pytest.raises(ValueError):
        dom.quantile([1.0], 1.5)


def test_per_thousand_and_people_per() -> None:
    assert dom.per_thousand(2722, 156_830) == pytest.approx(17.356, abs=0.001)  # 17,4 contentores por 1 000 hab.
    assert dom.per_thousand(5, 0) == 0.0
    assert dom.people_per(1574, 156_830) == pytest.approx(99.64, abs=0.01)
    assert dom.people_per(0, 100) is None
    assert reference_points(156_830, FRENCH_PEOPLE_PER_POINT) == 111
