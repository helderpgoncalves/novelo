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
    # base do modelo (Vitrus + APA): 43 051 t × 5,4% = 2 324 754 kg ÷ 156 830 hab = 14,82 kg/hab/ano no lixo;
    # gerado = 2 324,754 + 301,265 = 2 626,0 t; captura 301,265 ÷ 2 626,0 = 11,5%
    base = by_key["vitrus_apa_share_of_rsu"]
    assert (base["kg_per_inhab_year"], base["basis"], base["is_model_base"]) == (14.82, "residual", True)
    assert base["implied_capture_pct"] == pytest.approx(11.5) and base["implied_potential_t"] == pytest.approx(2626.0)
    assert "APA" in base["source"] and "43 051" in base["source"]
    # leituras publicadas: 315 × 5,4% = 17,01 (no lixo); 517 × 4,55% = 23,52; 0,7 × 12 = 8,4 (alternativa)
    assert by_key["plan_share_of_residual"]["kg_per_inhab_year"] == pytest.approx(17.01)
    assert by_key["plan_share_of_residual"]["implied_capture_pct"] == pytest.approx(10.1)  # 301,265 ÷ 2 968,9
    assert by_key["pt_composition"]["kg_per_inhab_year"] == pytest.approx(23.52)
    assert by_key["plan_per_capita"]["kg_per_inhab_year"] == 8.4
    assert [r["is_model_base"] for r in body["readings"]] == [True, False, False, False]
    assert {k for k, r in by_key.items() if r["is_alternative"]} == {"plan_per_capita", "plan_share_of_residual"}
    assert "não usada pela Vitrus" in by_key["plan_per_capita"]["source"]
    # na mesma base, leituras maiores do potencial implicam sempre captura menor
    for basis in ("residual", "generated"):
        same = sorted((r for r in body["readings"] if r["basis"] == basis), key=lambda r: r["kg_per_inhab_year"])
        captures = [r["implied_capture_pct"] for r in same]
        assert captures == sorted(captures, reverse=True)
    # França: 4,27 ÷ 16,74 (gerado por habitante e ano na base do modelo: 2 626 019 kg ÷ 156 830) = 25,5%
    assert body["france"]["capture_of_model_base_pct"] == pytest.approx(25.5)
    assert "no_time_series" in body["cannot_test"]


async def test_spatial_check_needs_at_least_four_parishes(
    client: httpx.AsyncClient, make_user: MakeUser, municipal: None
) -> None:
    operator = await make_user("operador@vitrus.pt", "operator")
    body = (await operator.get(f"{V}/model")).json()
    # a amostra municipal de teste tem 3 freguesias: não se finge uma validação
    assert body["spatial"] == []
