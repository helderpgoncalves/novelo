from datetime import date

import httpx
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.features.textile import overview

P = "/api/v1"


async def test_overview_requires_login(client: httpx.AsyncClient) -> None:
    assert (await client.get(f"{P}/textile/overview")).status_code == 401


async def test_overview_gap_and_references(logged_in: httpx.AsyncClient) -> None:
    body = (await logged_in.get(f"{P}/textile/overview")).json()
    gap = body["gap"]
    assert gap["population"] == 156_830 and gap["parishes_count"] == 48
    # gerado = 51 250,6 t × 5,86% (Vitrus + APA) + 301,265 t = 3 003,285 + 301,265 = 3 304,55 t
    assert gap["potential_t"] == pytest.approx(3304.55, abs=0.1)
    assert gap["collected_t"] == pytest.approx(301.265, abs=0.01)
    assert gap["missing_t"] == pytest.approx(3003.3, abs=0.05)  # o que ainda vai para o lixo
    assert gap["capture_pct"] == pytest.approx(9.1, abs=0.05)  # 301,265 ÷ 3 304,55
    assert gap["kg_per_inhab_year"] == pytest.approx(1.92, abs=0.01)  # 301 265 kg ÷ 156 830
    assert gap["potential_kg_per_inhab_year"] == pytest.approx(21.07, abs=0.01)  # 3 304 550 kg ÷ 156 830
    assert gap["missing_kg_per_inhab_year"] == pytest.approx(19.15, abs=0.01)  # 3 003 285 kg ÷ 156 830
    assert gap["missing_kg_per_inhab_month"] == pytest.approx(1.596, abs=0.001)  # 19,1499 ÷ 12
    assert "APA" in gap["potential_source_label"] and "43 050,5" in gap["potential_source_label"]
    assert gap["potential_is_estimate"] is True
    refs = {r["key"]: r for r in body["references"]}
    assert refs["france_2024"]["kg_per_inhab_year"] == 4.27 and refs["france_2024"]["verified"]
    assert "guimaraes_plan_potential" not in refs  # o plano municipal deixou de ser fonte de números
    assert refs["guimaraes_potential"]["kg_per_inhab_year"] == pytest.approx(21.07, abs=0.01)
    assert refs["guimaraes_potential"]["is_estimate"] is True
    assert refs["germany_2022"]["verified"] is False


async def test_overview_parishes_sorted_by_population(logged_in: httpx.AsyncClient) -> None:
    parishes = (await logged_in.get(f"{P}/textile/overview")).json()["parishes"]
    assert len(parishes) == 48
    assert [p["population"] for p in parishes] == sorted((p["population"] for p in parishes), reverse=True)
    first = parishes[0]
    assert (first["name"], first["population"]) == ("Creixomil", 9708)
    assert first["potential_t"] == pytest.approx(185.91, abs=0.01)  # 9 708 × 19,1499 kg/hab/ano / 1000
    assert first["share_of_population_pct"] == pytest.approx(6.19, abs=0.01)  # 9 708 / 156 830
    assert first["centroid"] is not None and first["area_km2"] and first["area_km2"] > 0
    assert sum(p["share_of_population_pct"] for p in parishes) == pytest.approx(100, abs=0.2)


async def test_overview_timeline_uses_injected_clock(session: AsyncSession) -> None:
    out = await overview.get_overview(session, date(2026, 10, 19))
    by_key = {m.key: m for m in out.timeline}
    assert by_key["municipal_obligation"].status == "done" and by_key["municipal_obligation"].days_remaining is None
    assert by_key["transposition_deadline"].days_remaining == 241  # 19 out 2026 → 17 jun 2027
    assert by_key["epr_regimes"].status == "upcoming" and by_key["epr_regimes"].days_remaining == 546
    later = await overview.get_overview(session, date(2027, 6, 17))
    assert {m.key: m.status for m in later.timeline}["transposition_deadline"] == "done"


async def test_overview_highlights_and_sources(session: AsyncSession) -> None:
    out = await overview.get_overview(session, date(2026, 10, 19))
    hl = {h.key: h for h in out.highlights}
    assert 4 <= len(hl) <= 6
    assert hl["top_entity_share"].context["entity"] == "Ultriplo"
    assert hl["france_equivalent_t"].value == pytest.approx(669.7, abs=0.1)  # 4,27 × 156 830 / 1000
    assert hl["parish_size_ratio"].value == pytest.approx(13.9, abs=0.05)  # 9 708 / 699
    assert hl["top_parishes_share"].value == pytest.approx(25.3, abs=0.05)  # 39 618 / 156 830
    assert hl["textile_in_mixed_waste"].value == pytest.approx(4.55)
    assert hl["reuse_share"].is_estimate  # duas entidades por percentagens
    textile = next(s for s in out.data_sources if s.key == "vitrus_textile_2025")
    assert set(textile.methods) == {"weighed", "percentage"} and textile.rows > 0
    assert next(s for s in out.data_sources if s.key == "ine_census_2021").rows == 48
    rsu = next(s for s in out.data_sources if s.key == "vitrus_apa_rsu_2025")
    assert (rsu.kind, rsu.rows, rsu.rows_unit) == ("operator", 3, "values")  # 43 050,5 t, 84,0% e 5,86%
    municipal = next(s for s in out.data_sources if s.key == "vitrus_municipal_containers_2026_10")
    assert (municipal.kind, municipal.rows, municipal.rows_unit) == ("operator", 2751, "rows")


async def test_overview_frontier_marks_pareto(logged_in: httpx.AsyncClient) -> None:
    empty = (await logged_in.get(f"{P}/textile/overview")).json()
    assert empty["scenario_frontier"] == [] and empty["pareto_ids"] == []
    for budget in (15000, 90000):
        body = {"label": f"B{budget}", "objective": "max_tonnes", "budget_eur_year": budget}
        assert (await logged_in.post(f"{P}/planning/scenarios", json=body)).status_code in (200, 201)
    points = (await logged_in.get(f"{P}/textile/overview")).json()
    front = points["scenario_frontier"]
    assert len(front) == 2 and all(p["status"] == "feasible" for p in front)
    flagged = {p["id"] for p in front if p["is_pareto"]}
    assert flagged == set(points["pareto_ids"]) and flagged
