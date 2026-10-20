"""Entrada por email (magic link e recuperação): o que SAI para cada estado do email introduzido.

A resposta HTTP é sempre 204; o que muda é o email. Nunca fica ninguém à espera.
"""

import re
from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from typing import Any

import httpx
import pytest
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.adapters.email import EmailSendError, UnavailableSender, get_email_sender
from novelo.core.config import get_settings
from novelo.core.ratelimit import RateLimiter
from novelo.features.audit.models import AuditLog
from novelo.features.email_log.models import EmailDelivery, EmailSuppression
from novelo.features.users import service as users
from novelo.features.users.models import Invitation, User
from tests.conftest import PASSWORD, OutboxSender

AUTH = "/api/v1/auth"
U = "/api/v1/users"
Maker = Callable[..., Any]


def subjects(outbox: OutboxSender) -> list[str]:
    return [m["subject"] for m in outbox.sent]


async def ask(client: httpx.AsyncClient, email: str, path: str = "magic-link") -> httpx.Response:
    return await client.post(f"{AUTH}/{path}", json={"email": email})


async def rows(session: AsyncSession, template: str | None = None) -> list[EmailDelivery]:
    query = select(EmailDelivery).order_by(EmailDelivery.created_at)
    if template:
        query = query.where(EmailDelivery.template == template)
    return list((await session.execute(query)).scalars())


async def invite(admin: httpx.AsyncClient, email: str = "lucas@x.pt") -> dict[str, Any]:
    resp = await admin.post(f"{U}/invitations", json={"email": email, "name": "Lucas"})
    assert resp.status_code == 201, resp.text
    body: dict[str, Any] = resp.json()
    return body


def invite_token(mail: dict[str, str]) -> str:
    match = re.search(r"accept-invite\?token=([\w-]+)", mail["text"])
    assert match
    return match.group(1)


async def age_deliveries(session: AsyncSession, minutes: int) -> None:
    """Envelhece os registos de email (para testar as janelas dos limites sem esperar)."""
    await session.execute(update(EmailDelivery).values(created_at=datetime.now(UTC) - timedelta(minutes=minutes)))
    await session.commit()


# --- (a) e (b): conta ativa, aprovada ou por aprovar ---------------------------------------------------------


async def test_active_account_gets_the_magic_link(
    client: httpx.AsyncClient, session: AsyncSession, outbox: OutboxSender
) -> None:
    await users.create_user(session, email="ana@x.pt", password=PASSWORD)
    resp = await ask(client, "ana@x.pt")
    assert resp.status_code == 204 and resp.content == b""
    assert len(outbox.sent) == 1 and "magic-link?token=" in outbox.sent[0]["text"]
    [row] = await rows(session)
    assert row.template == "magic_link" and row.status == "sent" and row.provider_message_id == "msg-1"
    assert row.to_email == "ana@x.pt" and row.attempts == 1


async def test_pending_account_gets_the_magic_link_too(
    client: httpx.AsyncClient, session: AsyncSession, outbox: OutboxSender
) -> None:
    await users.create_user(session, email="nova@x.pt", password=PASSWORD, approval_status="pending")
    assert (await ask(client, "nova@x.pt")).status_code == 204
    assert len(outbox.sent) == 1 and "magic-link?token=" in outbox.sent[0]["text"]


# --- (c): conta desativada ou recusada -----------------------------------------------------------------------


async def test_inactive_and_rejected_accounts_get_a_notice_without_a_link(
    client: httpx.AsyncClient, session: AsyncSession, outbox: OutboxSender
) -> None:
    off = await users.create_user(session, email="off@x.pt", password=PASSWORD)
    off.is_active = False
    await users.create_user(session, email="no@x.pt", password=PASSWORD, approval_status="rejected")
    await session.commit()
    assert (await ask(client, "off@x.pt")).status_code == 204
    assert (await ask(client, "no@x.pt")).status_code == 204
    assert subjects(outbox) == ["Não conseguimos dar-te acesso · Novelo"] * 2
    flat = [" ".join(m["text"].split()) for m in outbox.sent]
    assert "não está ativa" in flat[0] and "foi recusado" in flat[1]
    assert all("token=" not in m["text"] and "magic-link" not in m["text"] for m in outbox.sent)
    assert {r.template for r in await rows(session)} == {"account_unavailable"}


async def test_password_reset_for_inactive_account_gets_the_notice(
    client: httpx.AsyncClient, session: AsyncSession, outbox: OutboxSender
) -> None:
    off = await users.create_user(session, email="off@x.pt", password=PASSWORD)
    off.is_active = False
    await session.commit()
    assert (await ask(client, "off@x.pt", "forgot-password")).status_code == 204
    assert (
        subjects(outbox) == ["Não conseguimos dar-te acesso · Novelo"]
        and "reset-password" not in outbox.sent[0]["text"]
    )


# --- (d): sem conta mas com convite -------------------------------------------------------------------------


async def test_invitee_who_lost_the_email_gets_the_invitation_again(
    client: httpx.AsyncClient, make_user: Maker, session: AsyncSession, outbox: OutboxSender
) -> None:
    admin = await make_user("boss@x.pt", "admin")
    created = await invite(admin)
    first = invite_token(outbox.sent[-1])
    await age_deliveries(session, 10)  # passaram mais de 5 minutos
    resp = await ask(client, "lucas@x.pt")  # o Lucas escreve o email no login
    assert resp.status_code == 204 and resp.content == b""
    assert len(outbox.sent) == 2 and "convidou-te" in outbox.sent[1]["subject"]
    second = invite_token(outbox.sent[1])
    assert second != first
    old = await client.post(f"{AUTH}/invitations/preview", json={"token": first})
    assert old.status_code == 400 and old.json()["code"] == "invalid_token"  # o anterior deixou de valer
    new = await client.post(f"{AUTH}/invitations/preview", json={"token": second})
    assert new.status_code == 200 and new.json()["email"] == "lucas@x.pt"
    audit = (await session.execute(select(AuditLog).where(AuditLog.action == "invitation.self_resend"))).scalar_one()
    assert audit.actor_id is None and audit.target_label == "lucas@x.pt" and second not in str(audit.details)
    listed = (await admin.get(f"{U}/invitations")).json()["items"][0]
    assert listed["id"] == created["id"] and listed["send_count"] == 2 and listed["delivery_status"] == "sent"
    assert (await session.execute(select(Invitation))).scalar_one().last_sent_at is not None


async def test_expired_invitation_is_resent_with_a_new_deadline(
    client: httpx.AsyncClient, make_user: Maker, session: AsyncSession, outbox: OutboxSender
) -> None:
    admin = await make_user("boss@x.pt", "admin")
    await invite(admin)
    await session.execute(update(Invitation).values(expires_at=datetime.now(UTC) - timedelta(days=1)))
    await age_deliveries(session, 10)
    assert (await ask(client, "lucas@x.pt", "forgot-password")).status_code == 204  # também na recuperação
    assert len(outbox.sent) == 2 and "accept-invite?token=" in outbox.sent[1]["text"]
    accepted = await client.post(
        f"{AUTH}/invitations/accept", json={"token": invite_token(outbox.sent[1]), "name": "Lucas"}
    )
    assert accepted.status_code == 200


async def test_self_resend_limits_do_not_send_and_do_not_break(
    client: httpx.AsyncClient, make_user: Maker, session: AsyncSession, outbox: OutboxSender
) -> None:
    admin = await make_user("boss@x.pt", "admin")
    await invite(admin)
    # 1 por convite a cada 5 minutos: o convite acabou de sair, não se reenvia nem se invalida o link.
    assert (await ask(client, "lucas@x.pt")).status_code == 204
    assert len(outbox.sent) == 1
    # No máximo 5 por dia: depois de 5 envios (todos há mais de 5 min), o 6.º pedido não envia mas responde 204.
    for _ in range(4):
        await age_deliveries(session, 10)
        RateLimiter.reset_all()  # os limites por IP/email do pedido não são o assunto deste teste
        assert (await ask(client, "lucas@x.pt")).status_code == 204
    assert len(outbox.sent) == 5
    await age_deliveries(session, 10)
    RateLimiter.reset_all()
    assert (await ask(client, "lucas@x.pt")).status_code == 204
    assert len(outbox.sent) == 5
    assert subjects(outbox).count("Não encontrámos uma conta · Novelo") == 0  # nunca o email neutro a quem é convidado


async def test_failed_self_resend_keeps_the_previous_link_valid(
    client: httpx.AsyncClient, make_user: Maker, session: AsyncSession, outbox: OutboxSender
) -> None:
    admin = await make_user("boss@x.pt", "admin")
    await invite(admin)
    first = invite_token(outbox.sent[0])
    await age_deliveries(session, 10)
    outbox.errors = [EmailSendError("provider_auth", transient=False)]
    resp = await ask(client, "lucas@x.pt")
    assert resp.status_code == 503 and resp.json()["code"] == "email_unavailable"
    assert (await client.post(f"{AUTH}/invitations/preview", json={"token": first})).status_code == 200
    failed = (await rows(session, "invitation"))[-1]
    assert failed.status == "failed" and failed.error_code == "provider_auth"
    # a falha não bloqueia: o pedido seguinte envia
    assert (await ask(client, "lucas@x.pt")).status_code == 204 and len(outbox.sent) == 2


# --- (e): convite revogado/aceite ou email desconhecido ------------------------------------------------------


async def test_unknown_email_gets_the_neutral_email_with_a_link_to_register(
    client: httpx.AsyncClient, session: AsyncSession, outbox: OutboxSender
) -> None:
    resp = await ask(client, "Ninguem@X.pt")
    assert resp.status_code == 204 and resp.content == b""
    assert subjects(outbox) == ["Não encontrámos uma conta · Novelo"]
    assert "/register" in outbox.sent[0]["text"] and "token=" not in outbox.sent[0]["text"]
    [row] = await rows(session)
    assert row.template == "account_not_found" and row.to_email == "ninguem@x.pt"
    again = await ask(client, "ninguem@x.pt")  # 1 por destinatário a cada 30 minutos
    assert again.status_code == 204 and len(outbox.sent) == 1
    await age_deliveries(session, 31)
    assert (await ask(client, "ninguem@x.pt")).status_code == 204 and len(outbox.sent) == 2


async def test_unknown_email_with_registration_closed_asks_for_access(
    client: httpx.AsyncClient, outbox: OutboxSender, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(get_settings(), "allow_registration", False)
    assert (await ask(client, "ninguem@x.pt")).status_code == 204
    assert "/register" not in outbox.sent[0]["text"] and "administrador" in outbox.sent[0]["text"]


async def test_revoked_and_accepted_invitations_get_the_neutral_email(
    client: httpx.AsyncClient, make_user: Maker, session: AsyncSession, outbox: OutboxSender
) -> None:
    admin = await make_user("boss@x.pt", "admin")
    revoked = await invite(admin, "rev@x.pt")
    assert (await admin.post(f"{U}/invitations/{revoked['id']}/revoke")).status_code == 200
    await invite(admin, "acc@x.pt")
    accepted = await client.post(
        f"{AUTH}/invitations/accept", json={"token": invite_token(outbox.sent[-1]), "name": "Acc"}
    )
    assert accepted.status_code == 200
    await client.post(f"{AUTH}/logout")
    outbox.sent.clear()
    assert (await ask(client, "rev@x.pt")).status_code == 204
    assert subjects(outbox) == ["Não encontrámos uma conta · Novelo"]
    # o convite aceite criou uma conta: esse email recebe um magic link
    assert (await ask(client, "acc@x.pt")).status_code == 204
    assert "magic-link?token=" in outbox.sent[-1]["text"]


async def test_global_cap_on_neutral_emails(
    client: httpx.AsyncClient, outbox: OutboxSender, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(get_settings(), "email_not_found_per_hour", 3)
    for i in range(6):
        assert (await ask(client, f"x{i}@x.pt")).status_code == 204
    assert len(outbox.sent) == 3  # os restantes respondem igual mas não enviam (sem spam a terceiros)


# --- Todos os casos fazem o mesmo trabalho e respondem igual; falhas não revelam nada ------------------------


async def test_every_state_answers_identically(
    client: httpx.AsyncClient, make_user: Maker, session: AsyncSession, outbox: OutboxSender
) -> None:
    admin = await make_user("boss@x.pt", "admin")
    await invite(admin, "conv@x.pt")
    await age_deliveries(session, 10)
    await users.create_user(session, email="ana@x.pt", password=PASSWORD)
    off = await users.create_user(session, email="off@x.pt", password=PASSWORD)
    off.is_active = False
    await session.commit()
    answers = []
    for email in ("ana@x.pt", "off@x.pt", "conv@x.pt", "ninguem@x.pt"):
        resp = await ask(client, email)
        answers.append((resp.status_code, resp.content, resp.headers.get("content-type")))
    assert len(set(answers)) == 1 and answers[0][0] == 204
    assert len(outbox.sent) == 1 + 4  # o convite original + um email real por pedido


async def test_provider_failure_is_503_for_every_state(
    client: httpx.AsyncClient, make_user: Maker, session: AsyncSession, outbox: OutboxSender
) -> None:
    admin = await make_user("boss@x.pt", "admin")
    await invite(admin, "conv@x.pt")
    await age_deliveries(session, 10)
    await users.create_user(session, email="ana@x.pt", password=PASSWORD)
    for email in ("ana@x.pt", "conv@x.pt", "ninguem@x.pt"):
        outbox.errors = [EmailSendError("provider_auth", transient=False)]
        resp = await ask(client, email)
        assert resp.status_code == 503 and resp.json()["code"] == "email_unavailable", email
        assert set(resp.json()) == {"code", "message"}
    failed = [r for r in await rows(session) if r.status == "failed"]
    assert len(failed) == 3 and {r.error_code for r in failed} == {"provider_auth"}


async def test_unconfigured_provider_is_503_not_a_silent_204(client: httpx.AsyncClient) -> None:
    app = client._transport.app  # type: ignore[attr-defined]
    app.dependency_overrides[get_email_sender] = UnavailableSender
    for path in ("magic-link", "forgot-password"):
        resp = await ask(client, "ninguem@x.pt", path)
        assert resp.status_code == 503 and resp.json()["code"] == "email_unavailable"


async def test_suppressed_address_is_reported_not_silenced(
    client: httpx.AsyncClient, session: AsyncSession, outbox: OutboxSender
) -> None:
    await users.create_user(session, email="ana@x.pt", password=PASSWORD)
    session.add(EmailSuppression(to_email="ana@x.pt", reason="bounced"))
    await session.commit()
    resp = await ask(client, "ana@x.pt")
    assert resp.status_code == 409 and resp.json()["code"] == "email_suppressed" and outbox.sent == []
    [row] = await rows(session)
    assert row.status == "skipped" and row.error_code == "suppressed_bounced"


async def test_quick_join_for_an_existing_account_uses_the_same_flow(
    client: httpx.AsyncClient, session: AsyncSession, outbox: OutboxSender, monkeypatch: pytest.MonkeyPatch
) -> None:
    s = get_settings()
    monkeypatch.setattr(s, "quick_join_enabled", True)
    monkeypatch.setattr(s, "quick_join_code", "evento-123")
    await users.create_user(session, email="ana@x.pt", password=PASSWORD)
    resp = await client.post(
        f"{AUTH}/quick-join", json={"name": "Ana", "email": "ana@x.pt", "code": "evento-123", "consent": True}
    )
    assert resp.status_code == 200 and resp.json()["status"] == "check_email"
    assert "magic-link?token=" in outbox.sent[0]["text"]
    assert (await session.execute(select(User).where(User.email == "ana@x.pt"))).scalar_one().joined_via == "password"
