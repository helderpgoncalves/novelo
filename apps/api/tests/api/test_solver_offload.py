"""O otimizador corre fora do event loop: durante uma simulação a API continua a responder."""

import asyncio
import time

import httpx
import pytest

from novelo.core.config import get_settings
from novelo.core.errors import UpstreamError
from novelo.core.guest import solver_slots
from novelo.features.planning import service as planning
from novelo.features.planning.schemas import Kpis, ScenarioResult

P = "/api/v1/planning"
BODY = {"label": "Lento", "objective": "max_tonnes", "budget_eur_year": 60000}
SLEEP_S = 1.0


def _fake_result() -> ScenarioResult:
    kpis = Kpis(
        capex_eur=0,
        opex_eur_year=0,
        annual_cost_eur=0,
        tonnes_year=0,
        eur_per_tonne=None,
        coverage_pct=0,
        points=0,
        km_year=0,
        potential_t=0,
        baseline_observed_t=0,
    )
    return ScenarioResult(kpis=kpis, allocations=[], routes=[], modes=[], depot=[0.0, 0.0])


async def test_fast_requests_are_served_while_the_solver_runs(
    logged_in: httpx.AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    def slow_compute(*_: object) -> tuple[ScenarioResult, str]:
        time.sleep(SLEEP_S)  # CPU síncrono: se estivesse no event loop, travava tudo
        return _fake_result(), "optimal"

    monkeypatch.setattr(planning, "compute", slow_compute)
    lag = 0.0

    async def ticker() -> None:
        """Mede o atraso do event loop: um loop bloqueado pelo solver deixa o tick adiado quase 1 s."""
        nonlocal lag
        last = time.perf_counter()
        while True:
            await asyncio.sleep(0.01)
            now = time.perf_counter()
            lag = max(lag, now - last - 0.01)
            last = now

    watch = asyncio.create_task(ticker())
    started = time.perf_counter()
    running = asyncio.create_task(logged_in.post(f"{P}/scenarios", json=BODY))
    try:
        await asyncio.sleep(0.3)  # o pedido já leu a BD e está dentro do solver
        latencies = {}
        for name, url in (("health", "/api/v1/health"), ("parameters", f"{P}/parameters")):
            attempts = []
            for _ in range(2):  # o melhor de 2: um loop bloqueado falha as duas, um soluço da máquina só uma
                t0 = time.perf_counter()
                resp = await logged_in.get(url)
                attempts.append(time.perf_counter() - t0)
                assert resp.status_code == 200
            latencies[name] = min(attempts)
        assert not running.done()  # os GET responderam com o solver ainda a dormir
        assert all(v < 0.2 for v in latencies.values()), latencies
        created = await running
    finally:  # nunca deixar o pedido a correr se uma verificação falhar: prenderia a transação do teste
        watch.cancel()
        if not running.done():
            await running
    assert lag < 0.5 * SLEEP_S, f"event loop bloqueado {lag:.2f}s"
    assert created.status_code == 201 and created.json()["solver_status"] == "optimal"
    assert time.perf_counter() - started >= SLEEP_S


async def test_busy_solver_is_a_typed_429_and_the_slot_is_released_on_error(
    logged_in: httpx.AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(get_settings(), "solver_max_concurrency", 1)
    assert solver_slots.acquire()
    try:
        busy = await logged_in.post(f"{P}/scenarios", json=BODY)
        assert busy.status_code == 429 and busy.json()["code"] == "rate_limited"
    finally:
        solver_slots.release()

    def failing(*_: object) -> tuple[ScenarioResult, str]:
        raise UpstreamError("solver down")

    monkeypatch.setattr(planning, "compute", failing)
    resp = await logged_in.post(f"{P}/scenarios", json=BODY)
    assert resp.status_code >= 400
    assert solver_slots.busy == 0  # a vaga volta mesmo quando o solver falha dentro da thread
