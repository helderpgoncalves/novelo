"""Log estruturado por pedido: rota (modelo), duração e, em debug, o número de consultas SQL."""

import json
import logging
import uuid

import httpx
import pytest
from fastapi import FastAPI
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from novelo.core.logging import JsonFormatter, RequestLoggingMiddleware, install_query_counter
from tests.conftest import TEST_DB


def _request_records(caplog: pytest.LogCaptureFixture) -> list[logging.LogRecord]:
    return [r for r in caplog.records if r.name == "novelo.request"]


async def test_request_log_has_route_template_and_duration(
    logged_in: httpx.AsyncClient, caplog: pytest.LogCaptureFixture
) -> None:
    caplog.set_level(logging.INFO, logger="novelo.request")
    sid = uuid.uuid4()
    assert (await logged_in.get(f"/api/v1/planning/scenarios/{sid}")).status_code == 404
    record = _request_records(caplog)[-1]
    assert record.route == "/api/v1/planning/scenarios/{scenario_id}"  # type: ignore[attr-defined]
    assert record.status == 404 and record.method == "GET" and record.duration_ms >= 0  # type: ignore[attr-defined]
    payload = json.loads(JsonFormatter().format(record))
    assert payload["route"] == "/api/v1/planning/scenarios/{scenario_id}" and "duration_ms" in payload
    assert str(sid) not in payload["route"] and "queries" not in payload  # sem debug não há contagem


async def test_debug_logs_the_number_of_queries_per_request(caplog: pytest.LogCaptureFixture) -> None:
    app = FastAPI()
    engine = create_async_engine(TEST_DB)
    install_query_counter(engine.sync_engine)
    install_query_counter(engine.sync_engine)  # idempotente: não conta a dobrar

    @app.get("/three")
    async def three() -> dict[str, int]:
        async with engine.connect() as conn:
            for _ in range(3):
                await conn.execute(text("SELECT 1"))
        return {"ok": 1}

    app.add_middleware(RequestLoggingMiddleware)
    caplog.set_level(logging.DEBUG, logger="novelo.request")
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://t") as c:
        assert (await c.get("/three")).status_code == 200
    await engine.dispose()
    record = _request_records(caplog)[-1]
    assert record.queries == 3 and record.route == "/three"  # type: ignore[attr-defined]
