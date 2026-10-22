import httpx

from novelo.core.errors import FeatureDisabledError
from novelo.features.datasets.schemas import AlertSuggestion, FieldFix
from tests.conftest import FakeLlm

D = "/api/v1/datasets"


async def first_alert(c: httpx.AsyncClient) -> dict[str, object]:
    alerts = (await c.get(f"{D}/quality")).json()["alerts"]
    assert alerts, "o seed devia trazer alertas reais da Vitrus"
    return dict(alerts[0])


def suggestion(**kw: object) -> AlertSuggestion:
    base: dict[str, object] = {
        "action": "confirm_with_vitrus",
        "suggested_status": "resolved",  # o servidor corrige: o estado decorre da ação
        "justification": "Only Vitrus can confirm this.",
        "resolution_note": "A confirmar com a Vitrus.",
        "question_for_vitrus": "Pode confirmar este registo?",
        "confidence": 0.7,
    }
    return AlertSuggestion.model_validate({**base, **kw})


async def test_suggestion_is_verified_and_never_applied(logged_in: httpx.AsyncClient, llm: FakeLlm) -> None:
    alert = await first_alert(logged_in)
    llm.queue("AlertSuggestion", suggestion())
    resp = await logged_in.post(f"{D}/alerts/{alert['id']}/suggest")
    assert resp.status_code == 200, resp.text
    out = resp.json()
    assert out["source"] == "model" and out["verified"] is True and out["applied"] is False
    assert out["action"] == "confirm_with_vitrus" and out["suggested_status"] == "open"  # estado vem da ação
    assert out["prompt_version"] == "v2" and out["alert_id"] == alert["id"]
    after = await first_alert(logged_in)
    assert after["status"] == alert["status"] and after["resolution_note"] == alert["resolution_note"]  # nada mudou

    # o humano confirma pelo endpoint que já existia
    patched = await logged_in.patch(
        f"{D}/alerts/{alert['id']}", json={"status": "resolved", "resolution_note": out["resolution_note"]}
    )
    assert patched.status_code == 200 and patched.json()["status"] == "resolved"


async def test_invented_values_fall_back_to_the_rule_based_proposal(logged_in: httpx.AsyncClient, llm: FakeLlm) -> None:
    alert = await first_alert(logged_in)
    invented = suggestion(
        action="correct_data",
        justification="The plate is clearly ZZ-99-ZZ and affects 98765 trips.",
        fields_to_fix=[FieldFix(field="plate", current_value=None, proposed_value="ZZ-99-ZZ")],
    )
    llm.queue("AlertSuggestion", invented, invented)  # tenta duas vezes
    out = (await logged_in.post(f"{D}/alerts/{alert['id']}/suggest")).json()
    assert out["source"] == "fallback" and out["verified"] is False and out["model"] is None
    assert "ZZ-99-ZZ" not in str(out) and out["action"] in {"confirm_with_vitrus", "accept_as_is"}


async def test_errors(logged_in: httpx.AsyncClient, llm: FakeLlm) -> None:
    alert = await first_alert(logged_in)
    llm.queue("AlertSuggestion", FeatureDisabledError("AI is disabled"))
    assert (await logged_in.post(f"{D}/alerts/{alert['id']}/suggest")).status_code == 503
    missing = await logged_in.post(f"{D}/alerts/00000000-0000-4000-8000-000000000000/suggest")
    assert missing.status_code == 404
