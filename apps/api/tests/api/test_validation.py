"""Validação do modelo: leituras do potencial e validação cruzada espacial."""

from collections.abc import Awaitable, Callable

import httpx
import pytest

V = "/api/v1/validation"
MakeUser = Callable[..., Awaitable[httpx.AsyncClient]]


async def test_requires_a_session(client: httpx.AsyncClient) -> None:
    resp = await client.get(f"{V}/model")
    assert resp.status_code == 401


async def test_readings_are_computed_from_the_cited_sources(client: httpx.AsyncClient, make_user: MakeUser) -> None:
    operator = await make_user("operador@vitrus.pt", "operator")
    body = (await operator.get(f"{V}/model")).json()

    by_key = {r["key"]: r for r in body["readings"]}
    # 0,7 × 12 = 8,4; 315 × 5,4% = 17,01; 517 × 4,55% = 23,52 (arredondado a 2 casas)
    assert by_key["plan_per_capita"]["kg_per_inhab_year"] == 8.4
    assert by_key["plan_share_of_residual"]["kg_per_inhab_year"] == pytest.approx(17.01)
    assert by_key["pt_composition"]["kg_per_inhab_year"] == pytest.approx(23.52)
    assert [r["is_model_base"] for r in body["readings"]] == [True, False, False]
    # leituras maiores do potencial implicam sempre captura menor
    captures = [r["implied_capture_pct"] for r in body["readings"]]
    assert captures == sorted(captures, reverse=True)
    # França: 4,27 / 8,4 = 50,8% do potencial-base
    assert body["france"]["capture_of_model_base_pct"] == pytest.approx(50.8)
    assert "no_time_series" in body["cannot_test"]


async def test_spatial_check_needs_at_least_four_parishes(
    client: httpx.AsyncClient, make_user: MakeUser, municipal: None
) -> None:
    operator = await make_user("operador@vitrus.pt", "operator")
    body = (await operator.get(f"{V}/model")).json()
    # a amostra municipal de teste tem 3 freguesias: não se finge uma validação
    assert body["spatial"] == []
