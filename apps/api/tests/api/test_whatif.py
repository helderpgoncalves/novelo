import httpx

from novelo.core.errors import FeatureDisabledError
from novelo.features.planning.whatif_schemas import ModeRestriction, ScenarioDelta
from novelo.features.planning.whatif_service import _Explanation
from tests.conftest import FakeLlm

P = "/api/v1/planning"


async def base_scenario(c: httpx.AsyncClient) -> dict:
    return (
        await c.post(f"{P}/scenarios", json={"label": "Base", "objective": "max_tonnes", "budget_eur_year": 60000})
    ).json()


def delta(parish: str = "Serzedelo", **kw: object) -> ScenarioDelta:
    return ScenarioDelta(
        intent="change",
        understood="Entendi: em Serzedelo, só recolha a pedido.",
        set_modes=[ModeRestriction(parish=parish, allowed_modes=["on_demand"])],
        **kw,
    )


async def test_whatif_full_flow_with_verified_explanation(logged_in: httpx.AsyncClient, llm: FakeLlm) -> None:
    base = await base_scenario(logged_in)
    llm.queue("ScenarioDelta", delta("serzedelo"))
    run = (
        await logged_in.post(
            "/api/v1/whatif", json={"scenario_id": base["id"], "question": "E se Serzedelo passar a recolha a pedido?"}
        )
    ).json()
    assert run["status"] == "proposed" and run["understood"].startswith("Entendi")
    assert run["changes"][0]["parish_name"] == "Serzedelo" and run["changes"][0]["allowed_modes"] == ["on_demand"]
    assert run["new_scenario_id"] is None  # nada corre antes da confirmação

    # A explicação usa os números dos factos enviados ao modelo.
    llm.queue("_Explanation", _Explanation(text="O têxtil captado passa para um valor novo."))
    applied = (await logged_in.post(f"/api/v1/whatif/{run['id']}/apply")).json()
    assert applied["status"] == "applied" and applied["new_scenario_id"] and applied["explanation_verified"] is True

    new = (await logged_in.get(f"{P}/scenarios/{applied['new_scenario_id']}")).json()
    assert new["parent_id"] == base["id"]
    serz = next(a for a in new["result"]["allocations"] if a["parish_name"] == "Serzedelo")
    assert serz["mode"] in {"on_demand", None}
    assert (await logged_in.post(f"/api/v1/whatif/{run['id']}/apply")).json()[
        "code"
    ] == "conflict"  # só se aplica uma vez


async def test_invented_numbers_are_replaced_by_the_deterministic_explanation(
    logged_in: httpx.AsyncClient, llm: FakeLlm
) -> None:
    base = await base_scenario(logged_in)
    llm.queue("ScenarioDelta", delta())
    run = (
        await logged_in.post(
            "/api/v1/whatif", json={"scenario_id": base["id"], "question": "E se Serzedelo passar a pedido?"}
        )
    ).json()
    bad = _Explanation(text="Passa a captar 99999,9 toneladas por ano, uma poupança enorme.")
    llm.queue("_Explanation", bad, bad)  # tenta duas vezes e falha a verificação nas duas
    applied = (await logged_in.post(f"/api/v1/whatif/{run['id']}/apply")).json()
    assert applied["explanation_verified"] is False and "99999" not in applied["explanation"]
    assert "Os valores são estimativas" in applied["explanation"]


async def test_unknown_parish_is_refused_with_suggestions(logged_in: httpx.AsyncClient, llm: FakeLlm) -> None:
    base = await base_scenario(logged_in)
    llm.queue("ScenarioDelta", delta("Serzedelu"))
    run = (
        await logged_in.post(
            "/api/v1/whatif", json={"scenario_id": base["id"], "question": "E se Serzedelu passar a pedido?"}
        )
    ).json()
    assert run["status"] == "rejected" and run["unknown_parishes"] == ["Serzedelu"]
    assert "Serzedelo" in run["suggestions"]
    assert (await logged_in.post(f"/api/v1/whatif/{run['id']}/apply")).json()["code"] == "conflict"


async def test_ambiguous_question_asks_back(logged_in: httpx.AsyncClient, llm: FakeLlm) -> None:
    base = await base_scenario(logged_in)
    llm.queue(
        "ScenarioDelta",
        ScenarioDelta(
            intent="clarify",
            understood="Entendi: queres poupar.",
            clarification="Em que freguesia ou com que orçamento?",
        ),
    )
    run = (
        await logged_in.post("/api/v1/whatif", json={"scenario_id": base["id"], "question": "E se pouparmos dinheiro?"})
    ).json()
    assert run["status"] == "rejected" and run["clarification"].startswith("Em que freguesia")


async def test_budget_and_history(logged_in: httpx.AsyncClient, llm: FakeLlm) -> None:
    base = await base_scenario(logged_in)
    llm.queue(
        "ScenarioDelta",
        ScenarioDelta(intent="change", understood="Entendi: orçamento de 20 000 € por ano.", budget_eur_year=20000),
    )
    run = (
        await logged_in.post(
            "/api/v1/whatif", json={"scenario_id": base["id"], "question": "E se o orçamento fosse de 20 mil euros?"}
        )
    ).json()
    assert run["budget_eur_year"] == 20000 and run["objective"] == "max_tonnes"
    history = (await logged_in.get("/api/v1/whatif", params={"scenario_id": base["id"]})).json()
    assert [h["id"] for h in history] == [run["id"]]


async def test_whatif_is_disabled_without_a_model(
    client: httpx.AsyncClient, logged_in: httpx.AsyncClient, llm: FakeLlm
) -> None:
    base = await base_scenario(logged_in)
    llm.queue("ScenarioDelta", FeatureDisabledError("AI is disabled"))
    resp = await logged_in.post(
        "/api/v1/whatif", json={"scenario_id": base["id"], "question": "E se Serzedelo passar a pedido?"}
    )
    assert resp.status_code == 503 and resp.json()["code"] == "feature_disabled"
