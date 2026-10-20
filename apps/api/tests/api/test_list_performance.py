"""Listas leves: não carregam colunas pesadas (PDF, JSON do resultado) e não fazem N+1."""

import hashlib
import uuid
from decimal import Decimal
from typing import Any

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.domain.vocab import ScenarioObjective, ScenarioStatus
from novelo.features.lots.models import Lot, LotItem
from novelo.features.planning.models import Scenario
from novelo.features.planning.schemas import ScenarioSummary
from novelo.features.reports.models import Report
from novelo.features.users import service as users
from tests.conftest import PASSWORD
from tests.querycount import capture_sql

P = "/api/v1"
BIG = {"blob": "x" * 50_000}


async def _scenario(session: AsyncSession, label: str, modes: list[str]) -> Scenario:
    row = Scenario(
        label=label,
        objective=ScenarioObjective.MAX_TONNES,
        budget_eur_year=Decimal("1000"),
        status=ScenarioStatus.COMPUTED,
        solver_status="optimal",
        params=BIG,
        constraints={},
        result={"modes": [{"mode": m, "zones": 2} for m in modes] + [{"mode": "on_demand", "zones": 0}], **BIG},
        modes=modes,
        tonnes_year=Decimal("10"),
        capex_eur=Decimal("1"),
        annual_cost_eur=Decimal("2"),
        eur_per_tonne=Decimal("0.2"),
        coverage_pct=Decimal("50"),
    )
    session.add(row)
    await session.flush()
    return row


def _selects_column(statements: list[str], table: str, column: str) -> bool:
    """Alguma consulta lê `table.column` na lista de colunas (antes do FROM)?"""
    return any(f"{table}.{column}" in s.split(" FROM ")[0] for s in statements if f"FROM {table}" in s)


async def test_report_list_does_not_read_the_pdf(logged_in: httpx.AsyncClient, session: AsyncSession) -> None:
    pdf = b"%PDF-" + b"0" * 200_000
    report = Report(
        title="RAP",
        locale="pt-PT",
        scenario_ids=[str(uuid.uuid4())],
        summary=BIG,
        pdf=pdf,
        size_bytes=len(pdf),
        sha256=hashlib.sha256(pdf).hexdigest(),
    )
    session.add(report)
    await session.flush()
    with capture_sql(session) as sql:
        resp = await logged_in.get(f"{P}/reports")
    assert resp.status_code == 200 and resp.json()[0]["size_bytes"] == len(pdf)
    assert not _selects_column(sql, "reports", "pdf") and not _selects_column(sql, "reports", "summary")
    assert len(resp.content) < 2_000
    download = await logged_in.get(f"{P}/reports/{report.id}/pdf")  # o PDF só sai no download
    assert download.content == pdf


async def test_scenario_list_and_home_do_not_read_the_result_json(
    logged_in: httpx.AsyncClient, session: AsyncSession
) -> None:
    await _scenario(session, "Rua", ["street"])
    await _scenario(session, "Mistura", ["street", "on_demand"])
    with capture_sql(session) as sql:
        listed = await logged_in.get(f"{P}/planning/scenarios")
    assert listed.status_code == 200 and {s["label"] for s in listed.json()} == {"Rua", "Mistura"}
    assert set(listed.json()[0]) == set(ScenarioSummary.model_fields)  # contrato igual
    assert not _selects_column(sql, "scenarios", "result") and not _selects_column(sql, "scenarios", "params")

    with capture_sql(session) as sql:
        home = await logged_in.get(f"{P}/textile/overview")
    assert home.status_code == 200
    assert not _selects_column(sql, "scenarios", "result")
    points = {p["label"]: p["modes"] for p in home.json()["scenario_frontier"]}
    assert points == {"Rua": ["street"], "Mistura": ["street", "on_demand"]}  # os modos vêm da coluna `modes`


async def test_new_scenarios_store_their_modes(logged_in: httpx.AsyncClient) -> None:
    body = {"label": "Real", "objective": "max_tonnes", "budget_eur_year": 30000}
    created = await logged_in.post(f"{P}/planning/scenarios", json=body)
    assert created.status_code == 201
    modes_in_result = {m["mode"] for m in created.json()["result"]["modes"] if m["zones"] > 0}
    home = await logged_in.get(f"{P}/textile/overview")
    point = next(p for p in home.json()["scenario_frontier"] if p["id"] == created.json()["id"])
    assert set(point["modes"]) == modes_in_result and modes_in_result


async def _lot(session: AsyncSession, code: str, weights: list[int]) -> None:
    row = Lot(code=code, items=[], events=[])
    session.add(row)
    await session.flush()
    for g in weights:
        session.add(
            LotItem(
                lot_id=row.id,
                garment_type="tshirt",
                condition="reuse",
                composition=[{"fibre": "cotton", "pct": 100}],
                dominant_fibre="cotton",
                estimated_weight_g=g,
                confidence=Decimal("0.9"),
            )
        )
    await session.flush()


async def test_lot_list_aggregates_in_sql_with_a_constant_number_of_queries(
    logged_in: httpx.AsyncClient, session: AsyncSession
) -> None:
    await _lot(session, "NOV-AAAAAA", [100, 200])
    await _lot(session, "NOV-BBBBBB", [])
    with capture_sql(session) as few:
        first = await logged_in.get(f"{P}/lots")
    by_code = {x["code"]: x for x in first.json()}
    assert by_code["NOV-AAAAAA"]["items"] == 2 and by_code["NOV-AAAAAA"]["weight_kg"] == 0.3
    assert by_code["NOV-BBBBBB"]["items"] == 0 and by_code["NOV-BBBBBB"]["weight_kg"] == 0
    for i in range(5):
        await _lot(session, f"NOV-C{i}CCCC", [50, 50, 50])
    with capture_sql(session) as many:
        await logged_in.get(f"{P}/lots")
    assert len(many) == len(few)  # não cresce com o número de lotes
    assert not _selects_column(many, "lot_items", "composition")


async def test_main_lists_do_not_grow_with_the_data(make_user: Any, session: AsyncSession) -> None:
    """Sem N+1: o número de consultas dos endpoints principais não depende do número de linhas."""
    admin: httpx.AsyncClient = await make_user("admin@x.pt", "admin")
    urls = [
        f"{P}/planning/scenarios",
        f"{P}/datasets/quality",
        f"{P}/network/circuits",
        f"{P}/lots",
        f"{P}/market",
        f"{P}/users",
    ]
    n = 0
    for url in urls:
        with capture_sql(session) as before:
            assert (await admin.get(url)).status_code == 200, url
        for _ in range(4):
            n += 1
            await _scenario(session, f"n{n}", ["street"])
            await _lot(session, f"NOV-D{n:05d}", [10, 20])
            await users.create_user(
                session, email=f"u{n}@x.pt", password=PASSWORD, role="operator", email_verified=True
            )
        with capture_sql(session) as after:
            assert (await admin.get(url)).status_code == 200, url
        assert len(after) == len(before), url
