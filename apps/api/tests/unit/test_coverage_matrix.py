import pytest

from novelo.domain.coverage_matrix import ParishFigures, by_tipau, density, equity, group

ROWS = [
    ParishFigures("apu", population=10_000, covered_population=8_000, tonnes=40, annual_cost_eur=4_000),
    ParishFigures("apu", population=6_000, covered_population=4_000, tonnes=20, annual_cost_eur=3_200),
    ParishFigures("amu", population=3_000, covered_population=1_500, tonnes=10, annual_cost_eur=1_500),
    ParishFigures("apr", population=1_000, covered_population=0, tonnes=0, annual_cost_eur=0),
    ParishFigures(None, population=500, covered_population=500, tonnes=2, annual_cost_eur=300),
]


def test_density_by_hand() -> None:
    assert density(1_278, 1.552) == pytest.approx(823.45, abs=0.01)  # Aldão: 1 278 hab ÷ 1,552 km² (CAOP)
    assert density(100, None) is None and density(100, 0) is None


def test_groups_by_tipau_by_hand() -> None:
    groups = by_tipau(ROWS)
    assert [g.tipau for g in groups] == ["apu", "amu", "apr", None]
    apu = groups[0]
    assert (apu.parishes, apu.population, apu.covered_population) == (2, 16_000, 12_000)
    assert apu.covered_pct == pytest.approx(75.0)  # 12 000 / 16 000
    assert apu.tonnes == 60 and apu.annual_cost_eur == 7_200 and apu.eur_per_tonne == pytest.approx(120.0)
    apr = groups[2]
    assert apr.covered_pct == 0 and apr.eur_per_tonne is None  # 0 t: €/t não existe
    total = group(ROWS, None)
    assert total.population == 20_500 and total.covered_pct == pytest.approx(14_000 / 20_500 * 100)


def test_equity_compares_non_urban_with_urban_by_hand() -> None:
    e = equity(ROWS)
    assert e.urban_population == 16_000 and e.urban_covered_pct == pytest.approx(75.0)
    # AMU + APR: 1 500 cobertos de 4 000 = 37,5%; razão 37,5 / 75 = 0,5. A freguesia sem TIPAU fica de fora.
    assert e.non_urban_population == 4_000 and e.non_urban_covered_pct == pytest.approx(37.5)
    assert e.non_urban_vs_urban == pytest.approx(0.5)
    nobody = equity([ParishFigures("apu", 100, 0, 0, 0), ParishFigures("apr", 100, 50, 1, 10)])
    assert nobody.non_urban_vs_urban is None  # urbana a 0%: razão sem sentido
