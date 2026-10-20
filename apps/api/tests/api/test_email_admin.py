"""Visibilidade do administrador sobre os emails: lista, resumo, alertas, reconciliação, teste, DNS, supressões."""

from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from typing import Any

import httpx
import pytest
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.adapters.dns import get_dns_resolver
from novelo.adapters.email import EmailSendError, get_email_status_reader
from novelo.core.config import get_settings
from novelo.features.audit.models import AuditLog
from novelo.features.email_log import monitor
from novelo.features.email_log.models import EmailDelivery, EmailSuppression
from novelo.features.users.models import User
from tests.conftest import OutboxSender

E = "/api/v1/users/emails"
U = "/api/v1/users"
Maker = Callable[..., Any]


class FakeReader:
    def __init__(self, events: dict[str, str | None], configured: bool = True) -> None:
        self.events, self._configured = events, configured
        self.asked: list[str] = []

    @property
    def configured(self) -> bool:
        return self._configured

    async def last_event(self, provider_message_id: str) -> str | None:
        self.asked.append(provider_message_id)
        return self.events.get(provider_message_id)


class FakeDns:
    def __init__(self, records: dict[tuple[str, str], list[str] | None]) -> None:
        self.records = records
        self.queries = 0

    async def query(self, name: str, rtype: str) -> list[str] | None:
        self.queries += 1
        return self.records.get((name, rtype), [])


@pytest.fixture(autouse=True)
def _sender_domain(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(get_settings(), "email_from", "Novelo <novelo@heldergoncalves.io>")


def use(client: httpx.AsyncClient, dependency: Callable[..., Any], fake: object) -> None:
    client._transport.app.dependency_overrides[dependency] = lambda: fake  # type: ignore[attr-defined]


async def add(
    session: AsyncSession,
    *,
    status: str = "sent",
    template: str = "magic_link",
    to: str = "x@x.pt",
    error: str | None = None,
    minutes_ago: int = 0,
    pid: str | None = None,
) -> EmailDelivery:
    when = datetime.now(UTC) - timedelta(minutes=minutes_ago)
    row = EmailDelivery(
        to_email=to,
        template=template,
        status=status,
        error_code=error,
        attempts=1,
        provider_message_id=pid,
        created_at=when,
        updated_at=when,
        sent_at=when if status != "failed" else None,
    )
    session.add(row)
    await session.commit()
    return row


# --- permissões -----------------------------------------------------------------------------------------------


async def test_only_admins_see_emails(client: httpx.AsyncClient, make_user: Maker) -> None:
    operator = await make_user("op@x.pt", "operator")
    anon = httpx.AsyncClient(transport=client._transport, base_url="http://test")
    for c, code in ((operator, 403), (anon, 401)):
        for method, path in (
            ("GET", E),
            ("GET", f"{E}/summary"),
            ("GET", f"{E}/health"),
            ("GET", f"{E}/suppressions"),
            ("POST", f"{E}/refresh"),
            ("POST", f"{E}/test"),
            ("POST", f"{E}/suppressions"),
            ("POST", f"{U}/invitations/00000000-0000-0000-0000-000000000000/link"),
        ):
            resp = await c.request(method, path, json={"email": "a@x.pt"})
            assert resp.status_code == code, (method, path, resp.status_code)
    await anon.aclose()


# --- lista ------------------------------------------------------------------------------------------------------


async def test_list_filters_paginates_and_has_no_bodies(make_user: Maker, session: AsyncSession) -> None:
    admin = await make_user("boss@x.pt", "admin")
    await add(session, to="ana@x.pt", pid="re_1", status="delivered")
    await add(session, to="rui@x.pt", status="failed", error="timeout", template="invitation")
    await add(session, to="ana@y.pt", status="bounced", error="bounced_permanent")
    everything = (await admin.get(E, params={"limit": 2})).json()
    assert everything["total"] == 3 and len(everything["items"]) == 2 and everything["limit"] == 2
    item = everything["items"][0]
    assert set(item) == {
        "id", "to_email", "template", "status", "error_code", "attempts", "user_id", "invitation_id",
        "provider_message_id", "created_at", "sent_at", "delivered_at", "updated_at",
    }  # fmt: skip
    by_status = (await admin.get(E, params={"status": "failed"})).json()
    assert [i["to_email"] for i in by_status["items"]] == ["rui@x.pt"]
    by_template = (await admin.get(E, params={"template": "invitation"})).json()
    assert by_template["total"] == 1
    by_q = (await admin.get(E, params={"q": "ana@"})).json()
    assert by_q["total"] == 2
    assert (await admin.get(E, params={"status": "nope"})).status_code == 422
    one = (await admin.get(f"{E}/{item['id']}")).json()
    assert one["id"] == item["id"]
    assert (await admin.get(f"{E}/00000000-0000-0000-0000-000000000000")).status_code == 404


# --- resumo e o que sabemos -----------------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("secret", "read_key", "mode"),
    [
        ("", "", "provider_accepted_only"),
        ("whsec_x", "", "webhook"),
        ("", "re_read", "api"),
        ("whsec_x", "re_read", "api+webhook"),
    ],
)
async def test_summary_says_honestly_what_we_know(
    make_user: Maker, monkeypatch: pytest.MonkeyPatch, secret: str, read_key: str, mode: str
) -> None:
    s = get_settings()
    monkeypatch.setattr(s, "resend_webhook_secret", secret)
    monkeypatch.setattr(s, "resend_read_api_key", read_key)
    monkeypatch.setattr(s, "resend_api_key", "re_send")
    admin = await make_user("boss@x.pt", "admin")
    body = (await admin.get(f"{E}/summary")).json()
    assert body["delivery_tracking"] == mode and body["provider_configured"] is True
    assert body["webhook_configured"] is bool(secret) and body["read_key_configured"] is bool(read_key)


async def test_summary_counts_rates_and_unconfirmed(
    make_user: Maker, session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(get_settings(), "resend_webhook_secret", "whsec_x")
    admin = await make_user("boss@x.pt", "admin")
    await add(session, status="delivered", minutes_ago=30)
    await add(session, status="delivered", minutes_ago=30)
    await add(session, status="sent", minutes_ago=30, pid="re_old")  # sem confirmação há > 15 min
    await add(session, status="sent", minutes_ago=2, pid="re_new")
    await add(session, status="failed", error="timeout", minutes_ago=30)
    await add(session, status="skipped", error="suppressed_bounced", minutes_ago=30)
    await add(session, status="sent", minutes_ago=3 * 24 * 60)  # fora das 24 h, dentro dos 7 dias
    body = (await admin.get(f"{E}/summary")).json()
    day = body["last_24h"]
    assert (day["delivered"], day["sent"], day["failed"], day["skipped"], day["total"]) == (2, 2, 1, 1, 6)
    assert body["last_7d"]["total"] == 7 and body["last_failure_at"] is not None
    assert body["success_rate_24h_pct"] == 80.0  # 4 aceites em 5 tentativas (o `skipped` não conta)
    assert body["failures_by_error_code"] == [{"error_code": "timeout", "count": 1}]
    assert body["unconfirmed"] == 1 and body["failures_last_hour"] == 1


async def test_delivery_delay_is_averaged(make_user: Maker, session: AsyncSession) -> None:
    admin = await make_user("boss@x.pt", "admin")
    row = await add(session, status="delivered", minutes_ago=10)
    row.sent_at = datetime.now(UTC) - timedelta(minutes=10)
    row.delivered_at = row.sent_at + timedelta(seconds=30)
    await session.commit()
    assert (await admin.get(f"{E}/summary")).json()["avg_delivery_delay_s"] == 30.0


# --- alertas ---------------------------------------------------------------------------------------------------


async def test_alerts_cover_each_problem(
    make_user: Maker, session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    s = get_settings()
    monkeypatch.setattr(s, "environment", "production")
    monkeypatch.setattr(s, "resend_api_key", "")
    admin = await make_user("boss@x.pt", "admin")
    for _ in range(3):
        await add(session, status="failed", error="provider_auth", minutes_ago=5)
    await add(session, status="skipped", template="approval_requested", error="no_recipients", to="no-recipient")
    alerts = (await admin.get(f"{E}/summary")).json()["alerts"]
    assert set(alerts) == {
        "provider_not_configured", "failures_last_hour", "provider_auth_invalid", "no_admin_recipients",
    }  # fmt: skip
    me = (await admin.get("/api/v1/auth/me")).json()
    assert me["email_alerts"] == 4
    # taxa de falha > 20% com pelo menos 5 envios na última hora
    await add(session, status="sent")
    await add(session, status="sent")
    monitor.reset_caches()
    assert "high_failure_rate" in (await admin.get(f"{E}/summary")).json()["alerts"]


async def test_domain_not_verified_alert_clears_after_a_success(make_user: Maker, session: AsyncSession) -> None:
    admin = await make_user("boss@x.pt", "admin")
    await add(session, status="failed", error="domain_not_verified", minutes_ago=5)
    assert "domain_not_verified" in (await admin.get(f"{E}/summary")).json()["alerts"]
    await add(session, status="sent")
    assert "domain_not_verified" not in (await admin.get(f"{E}/summary")).json()["alerts"]


async def test_webhook_silent_alert(make_user: Maker, session: AsyncSession, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(get_settings(), "resend_webhook_secret", "whsec_x")
    admin = await make_user("boss@x.pt", "admin")
    await add(session, status="sent", minutes_ago=120, pid="re_1")
    assert "webhook_silent" in (await admin.get(f"{E}/summary")).json()["alerts"]
    await add(session, status="delivered", minutes_ago=100, pid="re_2")
    monitor.reset_caches()
    assert "webhook_silent" not in (await admin.get(f"{E}/summary")).json()["alerts"]


async def test_alert_email_goes_to_the_oldest_admin_at_most_every_6_hours(
    make_user: Maker, session: AsyncSession, outbox: OutboxSender
) -> None:
    admin = await make_user("boss@x.pt", "admin")
    await make_user("second@x.pt", "admin")
    await session.execute(
        update(User).where(User.email == "boss@x.pt").values(created_at=datetime.now(UTC) - timedelta(days=30))
    )  # no teste tudo corre na mesma transação (now() igual): fixa quem é o mais antigo
    await session.commit()
    for _ in range(3):
        await add(session, status="failed", error="provider_down", minutes_ago=5)
    assert (await admin.get(f"{E}/summary")).status_code == 200
    alerts = [m for m in outbox.sent if "atenção" in m["subject"]]
    assert len(alerts) == 1 and alerts[0]["to"] == "boss@x.pt"
    assert "Houve 3 ou mais falhas" in " ".join(alerts[0]["text"].split())
    monitor.reset_caches()
    await admin.get(f"{E}/summary")
    assert len([m for m in outbox.sent if "atenção" in m["subject"]]) == 1  # janela de 6 h
    row = (await session.execute(select(EmailDelivery).where(EmailDelivery.template == "email_alert"))).scalar_one()
    row.created_at = datetime.now(UTC) - timedelta(hours=7)
    await session.commit()
    monitor.reset_caches()
    await admin.get(f"{E}/summary")
    assert len([m for m in outbox.sent if "atenção" in m["subject"]]) == 2


async def test_ready_reports_email_state(
    client: httpx.AsyncClient, session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    assert (await client.get("/api/v1/ready")).json()["email"] == "ok"
    for _ in range(3):
        await add(session, status="failed", error="provider_down", minutes_ago=5)
    assert (await client.get("/api/v1/ready")).json()["email"] == "failing"
    monkeypatch.setattr(get_settings(), "environment", "production")
    monkeypatch.setattr(get_settings(), "resend_api_key", "")
    assert (await client.get("/api/v1/ready")).json()["email"] == "not_configured"


# --- reconciliação com a API do Resend -----------------------------------------------------------------------


async def test_refresh_syncs_sent_and_delayed_emails(
    client: httpx.AsyncClient, make_user: Maker, session: AsyncSession
) -> None:
    admin = await make_user("boss@x.pt", "admin")
    a = await add(session, status="sent", pid="re_a")
    b = await add(session, status="delayed", pid="re_b")
    c = await add(session, status="sent", pid="re_c")
    old = await add(session, status="sent", pid="re_old", minutes_ago=73 * 60)  # > 72 h: não se consulta
    done = await add(session, status="delivered", pid="re_done")
    reader = FakeReader({"re_a": "delivered", "re_b": "bounced", "re_c": "sent", "re_old": "delivered"})
    use(client, get_email_status_reader, reader)
    resp = await admin.post(f"{E}/refresh")
    assert resp.status_code == 200 and resp.json()["checked"] == 3 and resp.json()["updated"] == 2
    for row in (a, b, c, old, done):
        await session.refresh(row)
    assert (a.status, b.status, c.status, old.status, done.status) == (
        "delivered",
        "bounced",
        "sent",
        "sent",
        "delivered",
    )
    assert "re_old" not in reader.asked and "re_done" not in reader.asked


async def test_opening_the_list_reconciles_once_a_minute_and_errors_are_ignored(
    client: httpx.AsyncClient, make_user: Maker, session: AsyncSession
) -> None:
    admin = await make_user("boss@x.pt", "admin")
    row = await add(session, status="sent", pid="re_a")
    reader = FakeReader({"re_a": "delivered"})
    use(client, get_email_status_reader, reader)
    first = (await admin.get(E)).json()
    assert first["items"][0]["status"] == "delivered"
    await add(session, status="sent", pid="re_b")
    reader.events["re_b"] = "delivered"
    await admin.get(E)
    assert "re_b" not in reader.asked  # cache de 60 s
    await session.refresh(row)

    class Broken(FakeReader):
        async def last_event(self, provider_message_id: str) -> str | None:
            raise RuntimeError("boom")

    use(client, get_email_status_reader, Broken({}))
    assert (await admin.post(f"{E}/refresh")).status_code == 200  # nunca parte o pedido


async def test_refresh_without_a_read_key_does_nothing(client: httpx.AsyncClient, make_user: Maker) -> None:
    admin = await make_user("boss@x.pt", "admin")
    use(client, get_email_status_reader, FakeReader({}, configured=False))
    body = (await admin.post(f"{E}/refresh")).json()
    assert (body["checked"], body["updated"], body["delivery_tracking"]) == (0, 0, "provider_accepted_only")


# --- email de teste ----------------------------------------------------------------------------------------------


async def test_test_email_is_sent_logged_audited_and_limited(
    make_user: Maker, session: AsyncSession, outbox: OutboxSender
) -> None:
    admin = await make_user("boss@x.pt", "admin")
    resp = await admin.post(f"{E}/test")
    assert resp.status_code == 200
    body = resp.json()
    assert body["template"] == "test_email" and body["status"] == "sent" and body["to_email"] == "boss@x.pt"
    assert outbox.sent[0]["subject"] == "Email de teste · Novelo"
    assert (await admin.get(f"{E}/{body['id']}")).json()["status"] == "sent"
    assert (await session.execute(select(AuditLog).where(AuditLog.action == "email.test"))).scalar_one()
    assert (await admin.post(f"{E}/test")).status_code == 200
    assert (await admin.post(f"{E}/test")).status_code == 200
    assert (await admin.post(f"{E}/test")).status_code == 429  # 3 por hora


async def test_test_email_failure_is_returned_not_hidden(make_user: Maker, outbox: OutboxSender) -> None:
    admin = await make_user("boss@x.pt", "admin")
    outbox.errors = [EmailSendError("domain_not_verified", transient=False)]
    body = (await admin.post(f"{E}/test")).json()
    assert body["status"] == "failed" and body["error_code"] == "domain_not_verified"


# --- DNS ------------------------------------------------------------------------------------------------------------


def good_dns() -> FakeDns:
    return FakeDns(
        {
            ("resend._domainkey.heldergoncalves.io", "TXT"): ["p=MIGfMA0GCSqGSIb3DQEBAQUAA4GN"],
            ("send.heldergoncalves.io", "TXT"): ["v=spf1 include:amazonses.com ~all"],
            ("send.heldergoncalves.io", "MX"): ["10 feedback-smtp.eu-west-1.amazonses.com."],
            ("_dmarc.heldergoncalves.io", "TXT"): ["v=DMARC1; p=quarantine; rua=mailto:a@x.pt"],
        }
    )


async def test_dns_health_ok_and_cached(client: httpx.AsyncClient, make_user: Maker) -> None:
    admin = await make_user("boss@x.pt", "admin")
    dns = good_dns()
    use(client, get_dns_resolver, dns)
    body = (await admin.get(f"{E}/health")).json()
    assert body["domain"] == "heldergoncalves.io" and body["overall"] == "ok"
    assert {c["key"]: c["status"] for c in body["checks"]} == {
        "dkim": "ok",
        "spf": "ok",
        "return_path": "ok",
        "dmarc": "ok",
    }
    asked = dns.queries
    await admin.get(f"{E}/health")
    assert dns.queries == asked  # cache de 10 min


async def test_dns_health_reports_each_problem_with_a_hint(client: httpx.AsyncClient, make_user: Maker) -> None:
    admin = await make_user("boss@x.pt", "admin")
    use(client, get_dns_resolver, FakeDns({("_dmarc.heldergoncalves.io", "TXT"): ["v=DMARC1; p=none"]}))
    body = (await admin.get(f"{E}/health")).json()
    checks = {c["key"]: c for c in body["checks"]}
    assert body["overall"] == "fail"
    assert checks["dkim"]["status"] == "fail" and "resend._domainkey.heldergoncalves.io" in checks["dkim"]["hint"]
    assert checks["spf"]["status"] == "fail" and checks["return_path"]["status"] == "fail"
    assert checks["dmarc"]["status"] == "warn" and checks["dmarc"]["detail"] == "policy_none"


async def test_dns_lookup_failure_is_unknown_and_not_cached(client: httpx.AsyncClient, make_user: Maker) -> None:
    admin = await make_user("boss@x.pt", "admin")
    use(client, get_dns_resolver, FakeDns({("resend._domainkey.heldergoncalves.io", "TXT"): None}))
    body = (await admin.get(f"{E}/health")).json()
    assert {c["key"]: c["status"] for c in body["checks"]}["dkim"] == "unknown"
    use(client, get_dns_resolver, good_dns())
    assert (await admin.get(f"{E}/health")).json()["overall"] == "ok"


# --- supressões -----------------------------------------------------------------------------------------------------


async def test_suppressions_can_be_added_listed_and_removed(
    make_user: Maker, session: AsyncSession, outbox: OutboxSender
) -> None:
    admin = await make_user("boss@x.pt", "admin")
    created = await admin.post(f"{E}/suppressions", json={"email": " Mau@X.pt "})
    assert (
        created.status_code == 201 and created.json()["to_email"] == "mau@x.pt" and created.json()["reason"] == "manual"
    )
    assert (await admin.post(f"{E}/suppressions", json={"email": "mau@x.pt"})).status_code == 409
    assert (await admin.post(f"{E}/suppressions", json={"email": "sem-arroba"})).status_code == 409
    listed = (await admin.get(f"{E}/suppressions", params={"q": "mau"})).json()
    assert listed["total"] == 1
    session.add(EmailSuppression(to_email="outro@x.pt", reason="bounced"))
    await session.commit()
    assert (await admin.get(f"{E}/suppressions")).json()["total"] == 2
    actions = {a.action for a in (await session.execute(select(AuditLog))).scalars()}
    assert "email.suppress" in actions
    assert (await admin.delete(f"{E}/suppressions/{created.json()['id']}")).status_code == 204
    assert (await admin.delete(f"{E}/suppressions/{created.json()['id']}")).status_code == 404
    assert (await admin.get(f"{E}/suppressions")).json()["total"] == 1
    assert "email.unsuppress" in {a.action for a in (await session.execute(select(AuditLog))).scalars()}
