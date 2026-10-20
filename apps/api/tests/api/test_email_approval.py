"""Registo -> pendente de aprovação, sem deixar ninguém à espera: emails ao utilizador e aos administradores,
avisos quando falham, lembrete diário e estado do convite."""

from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from typing import Any

import httpx
import pytest
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.adapters.email import EmailSendError, UnavailableSender, get_email_sender
from novelo.core.config import get_settings
from novelo.features.auth import service as auth_service
from novelo.features.email_log import monitor
from novelo.features.email_log.models import EmailDelivery, EmailSuppression
from novelo.features.users import service as users
from novelo.features.users.models import User
from tests.conftest import PASSWORD, OutboxSender

AUTH = "/api/v1/auth"
U = "/api/v1/users"
Maker = Callable[..., Any]


async def register(c: httpx.AsyncClient, email: str = "novo@x.pt") -> httpx.Response:
    return await c.post(f"{AUTH}/register", json={"email": email, "password": PASSWORD, "name": "Novo Nome"})


def to(outbox: OutboxSender, who: str) -> list[str]:
    return [m["subject"] for m in outbox.sent if m["to"] == who]


async def rows(session: AsyncSession, template: str) -> list[EmailDelivery]:
    q = select(EmailDelivery).where(EmailDelivery.template == template).order_by(EmailDelivery.created_at)
    return list((await session.execute(q)).scalars())


async def user_id(session: AsyncSession, email: str) -> str:
    return str((await session.execute(select(User.id).where(User.email == email))).scalar_one())


# --- registo ---------------------------------------------------------------------------------------------------


async def test_register_tells_the_user_and_the_admins(
    client: httpx.AsyncClient, make_user: Maker, outbox: OutboxSender, session: AsyncSession
) -> None:
    await make_user("boss@x.pt", "admin")
    resp = await register(client)
    assert resp.status_code == 201 and resp.json()["approval_status"] == "pending"
    assert to(outbox, "novo@x.pt") == ["Recebemos o teu pedido · Novelo", "Confirma o teu email · Novelo"]
    mine = next(m for m in outbox.sent if m["subject"].startswith("Recebemos"))
    assert "avisamos-te por email" in " ".join(mine["text"].split()) and "/pending-approval" in mine["text"]
    assert to(outbox, "boss@x.pt") == ["Novo pedido de conta · Novelo"]
    assert [r.status for r in await rows(session, "registration_received")] == ["sent"]
    assert [r.to_email for r in await rows(session, "approval_requested")] == ["boss@x.pt"]
    status = (await client.get(f"{AUTH}/approval-status")).json()
    assert status["status"] == "pending" and status["confirmation_email"] == "sent"


async def test_without_active_admins_it_is_recorded_as_skipped_and_alerts(
    client: httpx.AsyncClient, session: AsyncSession
) -> None:
    assert (await register(client)).status_code == 201
    [row] = await rows(session, "approval_requested")
    assert (row.status, row.error_code) == ("skipped", "no_recipients")
    assert "no_admin_recipients" in await monitor.compute_alerts(session)


async def test_register_refuses_when_no_email_can_be_sent(client: httpx.AsyncClient, session: AsyncSession) -> None:
    client._transport.app.dependency_overrides[get_email_sender] = UnavailableSender  # type: ignore[attr-defined]
    s = get_settings()
    s.environment, s.resend_api_key = "production", ""  # type: ignore[assignment]
    try:
        resp = await register(client)
    finally:
        s.environment = "development"
    assert resp.status_code == 503 and resp.json()["code"] == "email_unavailable"
    assert await users.get_by_email(session, "novo@x.pt") is None  # nenhuma conta fica à espera para sempre


async def test_register_survives_a_failed_confirmation_but_leaves_it_visible(
    client: httpx.AsyncClient, make_user: Maker, outbox: OutboxSender
) -> None:
    admin = await make_user("boss@x.pt", "admin")
    outbox.errors = [EmailSendError("provider_down", transient=False)]
    assert (await register(client)).status_code == 201
    listed = (await admin.get(U, params={"approval_status": "pending"})).json()
    assert listed[0]["approval_email"] == {
        "status": "failed", "template": "registration_received", "at": listed[0]["approval_email"]["at"],
        "error_code": "provider_down",
    }  # fmt: skip
    assert (await client.get(f"{AUTH}/approval-status")).json()["confirmation_email"] == "failed"
    # o utilizador pode pedir o email outra vez; quando sai, o estado passa a `sent`
    assert (await client.post(f"{AUTH}/resend-registration-email")).status_code == 204
    assert (await client.get(f"{AUTH}/approval-status")).json()["confirmation_email"] == "sent"
    ok = (await admin.get(U, params={"approval_status": "pending"})).json()
    assert ok[0]["approval_email"]["status"] == "sent"


async def test_resend_registration_email_rules(
    client: httpx.AsyncClient, make_user: Maker, outbox: OutboxSender, session: AsyncSession
) -> None:
    await register(client)
    outbox.errors = [EmailSendError("provider_auth", transient=False)]
    failing = await client.post(f"{AUTH}/resend-registration-email")
    assert failing.status_code == 503 and failing.json()["code"] == "email_unavailable"
    assert (await client.post(f"{AUTH}/resend-registration-email")).status_code == 204
    assert (await client.post(f"{AUTH}/resend-registration-email")).status_code == 429  # 2 por hora
    await session.execute(update(User).where(User.email == "novo@x.pt").values(approval_status="approved"))
    await session.commit()
    assert (await client.post(f"{AUTH}/resend-registration-email")).status_code == 409


async def test_verification_resend_has_a_cooldown_and_reports_failures(
    client: httpx.AsyncClient, outbox: OutboxSender
) -> None:
    await register(client)
    assert (await client.post(f"{AUTH}/resend-verification")).status_code == 204
    assert (await client.post(f"{AUTH}/resend-verification")).status_code == 429  # 1 por minuto
    from novelo.core.ratelimit import verify_cooldown_limiter  # noqa: PLC0415

    verify_cooldown_limiter.reset()
    outbox.errors = [EmailSendError("provider_down", transient=False)]
    resp = await client.post(f"{AUTH}/resend-verification")
    assert resp.status_code == 503 and resp.json()["code"] == "email_unavailable"


# --- todos os caminhos de entrada ------------------------------------------------------------------------------


async def test_google_signup_is_pending_and_notifies(
    session: AsyncSession, make_user: Maker, outbox: OutboxSender
) -> None:
    await make_user("boss@x.pt", "admin")
    user, _, _ = await auth_service.login_with_google(
        session, {"sub": "g-9", "email": "gente@x.pt", "name": "Gente"}, "pt-PT", outbox
    )
    assert user.approval_status == "pending"
    assert to(outbox, "gente@x.pt") == ["Recebemos o teu pedido · Novelo"]  # Google já verificou o email
    assert to(outbox, "boss@x.pt") == ["Novo pedido de conta · Novelo"]


async def test_invited_and_guest_accounts_are_approved_and_get_no_request_email(
    client: httpx.AsyncClient, make_user: Maker, outbox: OutboxSender, monkeypatch: pytest.MonkeyPatch
) -> None:
    import re  # noqa: PLC0415

    admin = await make_user("boss@x.pt", "admin")
    await admin.post(f"{U}/invitations", json={"email": "conv@x.pt"})
    token = re.search(r"accept-invite\?token=([\w-]+)", outbox.sent[-1]["text"])
    assert token
    accepted = await client.post(f"{AUTH}/invitations/accept", json={"token": token.group(1), "name": "Conv"})
    assert accepted.json()["user"]["approval_status"] == "approved"
    s = get_settings()
    monkeypatch.setattr(s, "quick_join_code", "evento-123")
    other = httpx.AsyncClient(transport=client._transport, base_url="http://test")
    joined = await other.post(
        f"{AUTH}/quick-join", json={"name": "Rui", "email": "qr@x.pt", "code": "evento-123", "consent": True}
    )
    await other.aclose()
    assert joined.json()["user"]["approval_status"] == "approved"
    assert to(outbox, "conv@x.pt") == ["boss@x.pt convidou-te · Novelo"]  # só o convite
    assert to(outbox, "qr@x.pt") == ["O teu acesso está pronto · Novelo"]  # só as boas-vindas
    assert to(outbox, "boss@x.pt") == []  # nenhum aviso de aprovação aos admins


async def test_magic_link_and_impersonation_never_approve(
    client: httpx.AsyncClient, make_user: Maker, outbox: OutboxSender, session: AsyncSession
) -> None:
    admin = await make_user("boss@x.pt", "admin")
    await register(client)
    await client.post(f"{AUTH}/logout")
    await client.post(f"{AUTH}/magic-link", json={"email": "novo@x.pt"})
    assert (
        await session.execute(select(User.approval_status).where(User.email == "novo@x.pt"))
    ).scalar_one() == "pending"
    op = await users.create_user(session, email="op@x.pt", password=PASSWORD)
    before = len(outbox.sent)
    resp = await admin.post(f"{U}/{op.id}/impersonate", json={"reason": "Preciso de ver o ecrã dele"})
    assert resp.status_code == 200 and len(outbox.sent) == before  # impersonar não envia emails nem aprova ninguém
    assert (
        await session.execute(select(User.approval_status).where(User.email == "op@x.pt"))
    ).scalar_one() == "approved"


# --- decisão do administrador -----------------------------------------------------------------------------------


async def test_approve_warns_when_the_email_did_not_go_out(
    client: httpx.AsyncClient, make_user: Maker, outbox: OutboxSender, session: AsyncSession
) -> None:
    admin = await make_user("boss@x.pt", "admin")
    await register(client)
    uid = await user_id(session, "novo@x.pt")
    outbox.errors = [EmailSendError("invalid_recipient", transient=False)]
    resp = await admin.post(f"{U}/{uid}/approve", json={})
    assert resp.status_code == 200 and resp.json()["approval_status"] == "approved"  # a ação fica feita
    assert resp.json()["email_warning"] == {
        "code": "email_failed", "template": "approval_granted", "error_code": "invalid_recipient",
    }  # fmt: skip
    listed = {u["email"]: u for u in (await admin.get(U)).json()}
    assert listed["novo@x.pt"]["approval_email"]["status"] == "failed"
    resent = await admin.post(f"{U}/{uid}/resend-email")
    assert resent.status_code == 200 and resent.json()["email_warning"] is None
    assert to(outbox, "novo@x.pt")[-1] == "Conta aprovada · Novelo"
    assert (await admin.get(U)).json()[-1]["approval_email"]["status"] in {"sent", "none"}


async def test_reject_warns_and_suppressed_recipients_are_reported_as_skipped(
    client: httpx.AsyncClient, make_user: Maker, outbox: OutboxSender, session: AsyncSession
) -> None:
    admin = await make_user("boss@x.pt", "admin")
    await register(client, "a@x.pt")
    await register(client, "b@x.pt")
    outbox.errors = [EmailSendError("timeout", transient=False)]
    failed = await admin.post(f"{U}/{await user_id(session, 'a@x.pt')}/reject", json={"notify": True})
    assert failed.json()["email_warning"]["code"] == "email_failed"
    session.add(EmailSuppression(to_email="b@x.pt", reason="bounced"))
    await session.commit()
    skipped = await admin.post(f"{U}/{await user_id(session, 'b@x.pt')}/reject", json={"notify": True})
    assert skipped.json()["email_warning"] == {
        "code": "email_skipped", "template": "approval_rejected", "error_code": "suppressed_bounced",
    }  # fmt: skip
    quiet = await admin.post(f"{U}/{await user_id(session, 'a@x.pt')}/approve", json={"notify": False})
    assert quiet.json()["email_warning"] is None  # sem email pedido, sem aviso


# --- lembrete diário ------------------------------------------------------------------------------------------------


async def test_daily_reminder_for_accounts_pending_over_24_hours(
    client: httpx.AsyncClient, make_user: Maker, outbox: OutboxSender, session: AsyncSession
) -> None:
    admin = await make_user("boss@x.pt", "admin")
    await register(client)
    outbox.sent.clear()
    assert (await admin.get(f"{U}/summary")).status_code == 200
    assert outbox.sent == []  # ainda não passaram 24 h
    old = datetime.now(UTC) - timedelta(hours=25)
    await session.execute(update(User).where(User.email == "novo@x.pt").values(created_at=old))
    await session.commit()
    assert (await admin.get(f"{U}/summary")).status_code == 200
    assert to(outbox, "boss@x.pt") == ["Há contas por rever há mais de um dia · Novelo"]
    await admin.get(f"{U}/summary")
    await admin.get(f"{AUTH}/me")
    assert len(to(outbox, "boss@x.pt")) == 1  # no máximo 1 por 24 h
    [row] = await rows(session, "pending_reminder")
    row.created_at = datetime.now(UTC) - timedelta(hours=25)
    await session.commit()
    await admin.get(f"{AUTH}/me")
    assert len(to(outbox, "boss@x.pt")) == 2


async def test_reminder_failure_never_breaks_the_admin_request(
    client: httpx.AsyncClient, make_user: Maker, outbox: OutboxSender, session: AsyncSession
) -> None:
    admin = await make_user("boss@x.pt", "admin")
    await register(client)
    await session.execute(
        update(User).where(User.email == "novo@x.pt").values(created_at=datetime.now(UTC) - timedelta(hours=30))
    )
    await session.commit()
    outbox.errors = [EmailSendError("provider_auth", transient=False)]
    me = await admin.get(f"{AUTH}/me")
    assert me.status_code == 200 and me.json()["pending_approvals"] == 1
    assert [r.status for r in await rows(session, "pending_reminder")] == ["failed"]


# --- convites ---------------------------------------------------------------------------------------------------------


async def test_invitation_shows_the_delivery_state(
    client: httpx.AsyncClient, make_user: Maker, outbox: OutboxSender, session: AsyncSession
) -> None:
    admin = await make_user("boss@x.pt", "admin")
    ok = (await admin.post(f"{U}/invitations", json={"email": "ok@x.pt"})).json()
    assert (ok["delivery_status"], ok["email_delivered"], ok["delivery_error"]) == ("sent", True, None)
    assert ok["last_email_at"] is not None
    outbox.errors = [EmailSendError("domain_not_verified", transient=False)]
    bad = (await admin.post(f"{U}/invitations", json={"email": "bad@x.pt"})).json()
    assert (bad["delivery_status"], bad["email_delivered"], bad["delivery_error"]) == (
        "failed", False, "domain_not_verified",
    )  # fmt: skip
    from novelo.features.email_log import service  # noqa: PLC0415

    await service.apply_event(session, "msg-1", "email.delivered")  # o webhook confirma a entrega do convite "ok"
    listed = {i["email"]: i for i in (await admin.get(f"{U}/invitations")).json()["items"]}
    assert listed["ok@x.pt"]["delivery_status"] == "delivered" and listed["ok@x.pt"]["email_delivered"] is True
    assert listed["bad@x.pt"]["delivery_status"] == "failed"


async def test_invitation_without_attempts_is_none(make_user: Maker, session: AsyncSession) -> None:
    from novelo.features.users.models import Invitation  # noqa: PLC0415

    admin = await make_user("boss@x.pt", "admin")
    session.add(
        Invitation(
            email="n@x.pt", role="operator", token_hash="h" * 64, expires_at=datetime.now(UTC) + timedelta(days=1)
        )
    )
    await session.commit()
    item = (await admin.get(f"{U}/invitations")).json()["items"][0]
    assert (item["delivery_status"], item["last_email_at"], item["delivery_error"]) == ("none", None, None)


async def test_admin_can_copy_a_fresh_link_once(
    client: httpx.AsyncClient, make_user: Maker, outbox: OutboxSender, session: AsyncSession
) -> None:
    import re  # noqa: PLC0415

    from novelo.features.audit.models import AuditLog  # noqa: PLC0415

    admin = await make_user("boss@x.pt", "admin")
    outbox.errors = [EmailSendError("provider_down", transient=False)]
    created = (await admin.post(f"{U}/invitations", json={"email": "lucas@x.pt"})).json()
    assert created["delivery_status"] == "failed"
    resp = await admin.post(f"{U}/invitations/{created['id']}/link")
    assert resp.status_code == 200 and resp.headers["cache-control"] == "no-store"
    body = resp.json()
    token = re.search(r"/accept-invite\?token=([\w-]+)$", body["url"])
    assert token and body["url"].startswith(get_settings().app_url.rstrip("/"))
    assert body["invitation"]["id"] == created["id"] and body["expires_at"]
    assert outbox.sent == []  # não envia nada
    again = (await admin.post(f"{U}/invitations/{created['id']}/link")).json()
    assert again["url"] != body["url"]  # cada pedido invalida o anterior
    assert (await client.post(f"{AUTH}/invitations/preview", json={"token": token.group(1)})).status_code == 400
    new_token = again["url"].rsplit("=", 1)[1]
    assert (await client.post(f"{AUTH}/invitations/preview", json={"token": new_token})).status_code == 200
    audit = (await session.execute(select(AuditLog).where(AuditLog.action == "invitation.link"))).scalars().all()
    assert len(audit) == 2 and all(new_token not in str(a.details) and a.actor_id for a in audit)
    await admin.post(f"{U}/invitations/{created['id']}/revoke")
    assert (await admin.post(f"{U}/invitations/{created['id']}/link")).status_code == 409
    assert (await admin.post(f"{U}/invitations/00000000-0000-0000-0000-000000000000/link")).status_code == 404
