"""Convites por email: criar, listar, reenviar, revogar e aceitar (público, sem Turnstile, com limitador)."""

import re
from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from typing import Any

import httpx
import pytest
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.adapters.email import get_email_sender
from novelo.core.config import get_settings
from novelo.core.errors import UpstreamError
from novelo.core.ratelimit import invite_accept_limiter
from novelo.core.security import hash_token
from novelo.features.audit.models import AuditLog
from novelo.features.users import service as users
from novelo.features.users.models import Invitation, User
from tests.conftest import PASSWORD, OutboxSender

U = "/api/v1/users"
AUTH = "/api/v1/auth"
Maker = Callable[..., Any]


def token_of(outbox: OutboxSender, index: int = -1) -> str:
    match = re.search(r"accept-invite\?token=([\w-]+)", outbox.sent[index]["text"])
    assert match
    return match.group(1)


async def invite(admin: httpx.AsyncClient, email: str = "nova@x.pt", **over: object) -> httpx.Response:
    return await admin.post(f"{U}/invitations", json={"email": email, **over})


async def test_invite_and_accept_happy_path(
    client: httpx.AsyncClient, make_user: Maker, outbox: OutboxSender, session: AsyncSession
) -> None:
    admin = await make_user("boss@x.pt", "admin")
    resp = await invite(admin, "Nova@X.pt", name="Nova Pessoa", message="Precisamos de ti.", locale="en")
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["email"] == "nova@x.pt" and body["status"] == "pending" and body["role"] == "operator"
    assert body["email_delivered"] is True and body["send_count"] == 1 and body["invited_by_name"] == "boss@x.pt"
    expires = datetime.fromisoformat(body["expires_at"])
    assert timedelta(days=6, hours=23) < expires - datetime.now(UTC) <= timedelta(days=7)

    assert len(outbox.sent) == 1 and outbox.sent[0]["to"] == "nova@x.pt"
    mail = outbox.sent[0]
    assert "boss@x.pt" in mail["subject"] and "Operator" in mail["html"] and "Precisamos de ti." in mail["text"]
    token = token_of(outbox)
    assert len(token) >= 40
    row = (await session.execute(select(Invitation))).scalar_one()
    assert row.token_hash == hash_token(token) and token not in (row.token_hash, row.email)

    preview = await client.post(f"{AUTH}/invitations/preview", json={"token": token})
    assert preview.status_code == 200
    assert preview.json()["email"] == "nova@x.pt" and preview.json()["invited_by_name"] == "boss@x.pt"

    accepted = await client.post(
        f"{AUTH}/invitations/accept", json={"token": token, "name": "  Nova   Pessoa ", "password": PASSWORD}
    )
    assert accepted.status_code == 200, accepted.text
    user = accepted.json()["user"]
    assert user["role"] == "operator" and user["email_verified"] and user["joined_via"] == "invited"
    assert user["name"] == "Nova Pessoa" and user["has_password"] and user["locale"] == "en"
    refresh = next(c for c in accepted.headers.get_list("set-cookie") if c.startswith("refresh_token="))
    assert f"Max-Age={get_settings().refresh_token_days * 86400}" in refresh and "HttpOnly" in refresh
    assert (await client.get(f"{AUTH}/me")).json()["email"] == "nova@x.pt"

    other = httpx.AsyncClient(transport=client._transport, base_url="http://test")
    assert (await other.post(f"{AUTH}/login", json={"email": "nova@x.pt", "password": PASSWORD})).status_code == 200
    await other.aclose()

    listed = (await admin.get(f"{U}/invitations")).json()
    assert listed["total"] == 1 and listed["items"][0]["status"] == "accepted"
    actions = {a.action for a in (await session.execute(select(AuditLog))).scalars()}
    assert {"invitation.create", "invitation.accept"} <= actions


async def test_accept_without_password_signs_in_by_link_later(
    client: httpx.AsyncClient, make_user: Maker, outbox: OutboxSender
) -> None:
    admin = await make_user("boss@x.pt", "admin")
    await invite(admin, role="guest")
    accepted = await client.post(f"{AUTH}/invitations/accept", json={"token": token_of(outbox), "name": "Rui"})
    assert accepted.status_code == 200
    assert accepted.json()["user"]["has_password"] is False and accepted.json()["user"]["role"] == "guest"
    assert (await client.post(f"{AUTH}/login", json={"email": "nova@x.pt", "password": PASSWORD})).status_code == 401
    assert (await client.post(f"{AUTH}/magic-link", json={"email": "nova@x.pt"})).status_code == 204
    assert len(outbox.sent) == 2  # convite + link de entrada


async def test_token_is_single_use_and_neutral(
    client: httpx.AsyncClient, make_user: Maker, outbox: OutboxSender
) -> None:
    admin = await make_user("boss@x.pt", "admin")
    await invite(admin)
    token = token_of(outbox)
    assert (await client.post(f"{AUTH}/invitations/accept", json={"token": token, "name": "A"})).status_code == 200
    again = await client.post(f"{AUTH}/invitations/accept", json={"token": token, "name": "B"})
    assert again.status_code == 400 and again.json()["code"] == "invalid_token"
    assert (await client.post(f"{AUTH}/invitations/preview", json={"token": token})).json()["code"] == "invalid_token"
    wrong = await client.post(f"{AUTH}/invitations/accept", json={"token": "x" * 43, "name": "B"})
    assert wrong.status_code == 400 and wrong.json()["code"] == "invalid_token"  # mesma resposta: sem enumeração


async def test_expired_invitation(
    client: httpx.AsyncClient, make_user: Maker, outbox: OutboxSender, session: AsyncSession
) -> None:
    admin = await make_user("boss@x.pt", "admin")
    await invite(admin)
    await session.execute(update(Invitation).values(expires_at=datetime.now(UTC) - timedelta(minutes=1)))
    token = token_of(outbox)
    assert (await client.post(f"{AUTH}/invitations/accept", json={"token": token, "name": "A"})).status_code == 400
    assert (await admin.get(f"{U}/invitations", params={"status": "expired"})).json()["total"] == 1
    assert (await admin.get(f"{U}/invitations", params={"status": "pending"})).json()["total"] == 0
    # um convite expirado dá lugar a um novo para o mesmo email
    assert (await invite(admin)).status_code == 201
    statuses = {i["status"] for i in (await admin.get(f"{U}/invitations")).json()["items"]}
    assert statuses == {"pending", "revoked"}


async def test_revoked_invitation(client: httpx.AsyncClient, make_user: Maker, outbox: OutboxSender) -> None:
    admin = await make_user("boss@x.pt", "admin")
    created = (await invite(admin)).json()
    revoked = await admin.post(f"{U}/invitations/{created['id']}/revoke")
    assert revoked.status_code == 200 and revoked.json()["status"] == "revoked"
    assert (await admin.post(f"{U}/invitations/{created['id']}/revoke")).status_code == 200  # idempotente
    bad = await client.post(f"{AUTH}/invitations/accept", json={"token": token_of(outbox), "name": "A"})
    assert bad.status_code == 400 and bad.json()["code"] == "invalid_token"
    assert (await admin.post(f"{U}/invitations/{created['id']}/resend")).status_code == 409
    assert (await invite(admin)).status_code == 201  # revogado: pode convidar de novo


async def test_accepted_cannot_be_revoked_or_resent(
    client: httpx.AsyncClient, make_user: Maker, outbox: OutboxSender
) -> None:
    admin = await make_user("boss@x.pt", "admin")
    created = (await invite(admin)).json()
    await client.post(f"{AUTH}/invitations/accept", json={"token": token_of(outbox), "name": "A"})
    assert (await admin.post(f"{U}/invitations/{created['id']}/revoke")).status_code == 409
    assert (await admin.post(f"{U}/invitations/{created['id']}/resend")).status_code == 409


async def test_existing_account_and_pending_invitation_conflict(make_user: Maker) -> None:
    admin = await make_user("boss@x.pt", "admin")
    await make_user("rui@x.pt")
    taken = await invite(admin, "RUI@x.pt")
    assert taken.status_code == 409 and taken.json()["code"] == "email_taken"
    assert (await invite(admin, "novo@x.pt")).status_code == 201
    pending = await invite(admin, "novo@x.pt")
    assert pending.status_code == 409 and pending.json()["code"] == "invitation_pending"


async def test_admin_role_needs_reinforced_confirmation(
    client: httpx.AsyncClient, make_user: Maker, outbox: OutboxSender
) -> None:
    admin = await make_user("boss@x.pt", "admin")
    denied = await invite(admin, role="admin")
    assert denied.status_code == 400 and denied.json()["code"] == "admin_confirmation_required"
    assert outbox.sent == []
    assert (await invite(admin, role="admin", confirm_admin=False)).status_code == 400
    assert (await invite(admin, role="admin", confirm_admin=True)).status_code == 201
    accepted = await client.post(f"{AUTH}/invitations/accept", json={"token": token_of(outbox), "name": "Co-admin"})
    assert accepted.json()["user"]["role"] == "admin"


async def test_only_admins_manage_invitations(
    logged_in: httpx.AsyncClient, client: httpx.AsyncClient, make_user: Maker, outbox: OutboxSender
) -> None:
    guest = await make_user("convidado@x.pt", "guest")
    admin = await make_user("boss@x.pt", "admin")
    created = (await invite(admin)).json()
    for actor in (logged_in, guest):  # operador e convidado
        assert (await invite(actor, "outro@x.pt")).status_code == 403
        assert (await actor.get(f"{U}/invitations")).status_code == 403
        assert (await actor.post(f"{U}/invitations/{created['id']}/resend")).status_code == 403
        assert (await actor.post(f"{U}/invitations/{created['id']}/revoke")).status_code == 403
    anonymous = httpx.AsyncClient(transport=client._transport, base_url="http://test")
    assert (await invite(anonymous, "outro@x.pt")).status_code == 401
    assert (await anonymous.get(f"{U}/invitations")).status_code == 401
    await anonymous.aclose()
    assert len([m for m in outbox.sent if "accept-invite" in m["text"]]) == 1


async def test_resend_replaces_the_link(client: httpx.AsyncClient, make_user: Maker, outbox: OutboxSender) -> None:
    admin = await make_user("boss@x.pt", "admin")
    created = (await invite(admin)).json()
    first = token_of(outbox)
    resent = await admin.post(f"{U}/invitations/{created['id']}/resend")
    assert resent.status_code == 200 and resent.json()["send_count"] == 2
    second = token_of(outbox)
    assert first != second
    assert (await client.post(f"{AUTH}/invitations/accept", json={"token": first, "name": "A"})).status_code == 400
    assert (await client.post(f"{AUTH}/invitations/accept", json={"token": second, "name": "A"})).status_code == 200


async def test_resend_is_rate_limited_per_invitation(make_user: Maker) -> None:
    admin = await make_user("boss@x.pt", "admin")
    created = (await invite(admin)).json()
    codes = [(await admin.post(f"{U}/invitations/{created['id']}/resend")).status_code for _ in range(4)]
    assert codes == [200, 200, 200, 429]


async def test_invitation_rate_limit_per_admin(make_user: Maker, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(get_settings(), "invitations_per_hour", 2)
    admin = await make_user("boss@x.pt", "admin")
    codes = [(await invite(admin, f"p{i}@x.pt")).status_code for i in range(3)]
    assert codes == [201, 201, 429]


async def test_invitation_to_same_email_is_limited(make_user: Maker, session: AsyncSession) -> None:
    admin = await make_user("boss@x.pt", "admin")
    for _ in range(3):
        created = (await invite(admin)).json()
        await admin.post(f"{U}/invitations/{created['id']}/revoke")
    assert (await invite(admin)).status_code == 429


async def test_inviter_losing_admin_invalidates_pending_invitations(
    client: httpx.AsyncClient, make_user: Maker, outbox: OutboxSender, session: AsyncSession
) -> None:
    await make_user("root@x.pt", "admin")
    admin = await make_user("boss@x.pt", "admin")
    await invite(admin)
    boss = (await session.execute(select(User).where(User.email == "boss@x.pt"))).scalar_one()
    boss.role = "operator"
    await session.commit()
    bad = await client.post(f"{AUTH}/invitations/accept", json={"token": token_of(outbox), "name": "A"})
    assert bad.status_code == 400 and bad.json()["code"] == "invalid_token"


async def test_account_created_meanwhile_blocks_the_invitation(
    client: httpx.AsyncClient, make_user: Maker, outbox: OutboxSender, session: AsyncSession
) -> None:
    admin = await make_user("boss@x.pt", "admin")
    await invite(admin)
    await users.create_user(session, email="nova@x.pt", password=PASSWORD)
    resp = await client.post(f"{AUTH}/invitations/accept", json={"token": token_of(outbox), "name": "A"})
    assert resp.status_code == 409 and resp.json()["code"] == "email_taken"
    assert (await admin.get(f"{U}/invitations")).json()["items"][0]["status"] == "pending"  # não foi gasto


async def test_email_failure_keeps_the_invitation_for_resending(
    client: httpx.AsyncClient, make_user: Maker, outbox: OutboxSender
) -> None:
    class Failing:
        async def send(self, *, to: str, subject: str, html: str, text: str) -> None:
            raise UpstreamError("down")

    admin = await make_user("boss@x.pt", "admin")
    app = client._transport.app  # type: ignore[attr-defined]
    app.dependency_overrides[get_email_sender] = Failing
    created = await invite(admin)
    assert created.status_code == 201 and created.json()["email_delivered"] is False
    app.dependency_overrides[get_email_sender] = lambda: outbox
    resent = await admin.post(f"{U}/invitations/{created.json()['id']}/resend")
    assert resent.json()["email_delivered"] is True and len(outbox.sent) == 1


async def test_list_filters(make_user: Maker) -> None:
    admin = await make_user("boss@x.pt", "admin")
    for email in ("ana@x.pt", "rui@x.pt"):
        await invite(admin, email)
    assert (await admin.get(f"{U}/invitations", params={"q": "ana"})).json()["total"] == 1
    page = (await admin.get(f"{U}/invitations", params={"limit": 1, "offset": 1})).json()
    assert page["total"] == 2 and len(page["items"]) == 1
    assert (await admin.get(f"{U}/invitations", params={"status": "bogus"})).status_code == 422


async def test_accept_validates_input(client: httpx.AsyncClient, make_user: Maker, outbox: OutboxSender) -> None:
    admin = await make_user("boss@x.pt", "admin")
    await invite(admin)
    token = token_of(outbox)
    for body in (
        {"token": token, "name": "   "},
        {"token": token, "name": "A", "password": "curta"},
        {"token": token, "name": "A", "password": " " + PASSWORD},
        {"token": "curto", "name": "A"},
    ):
        assert (await client.post(f"{AUTH}/invitations/accept", json=body)).status_code == 422
    assert (await client.post(f"{AUTH}/invitations/accept", json={"token": token, "name": "A"})).status_code == 200


async def test_accept_needs_no_turnstile_but_is_rate_limited(
    client: httpx.AsyncClient, make_user: Maker, outbox: OutboxSender, monkeypatch: pytest.MonkeyPatch
) -> None:
    admin = await make_user("boss@x.pt", "admin")
    s = get_settings()
    monkeypatch.setattr(s, "turnstile_enabled_mode", "auto")
    monkeypatch.setattr(s, "turnstile_secret_key", "real-secret")
    monkeypatch.setattr(s, "turnstile_site_key", "site-key")
    assert (await invite(admin)).status_code == 201  # rota de admin: sem Turnstile
    ok = await client.post(f"{AUTH}/invitations/accept", json={"token": token_of(outbox), "name": "A"})
    assert ok.status_code == 200  # o token de uso único é o segredo: sem cabeçalho de captcha
    monkeypatch.setattr(invite_accept_limiter, "limit", 2)
    codes = [
        (await client.post(f"{AUTH}/invitations/accept", json={"token": "x" * 43, "name": "B"})).status_code
        for _ in range(3)
    ]
    assert codes[-1] == 429


async def test_audit_never_holds_the_token(make_user: Maker, outbox: OutboxSender, session: AsyncSession) -> None:
    admin = await make_user("boss@x.pt", "admin")
    created = (await invite(admin, message="olá")).json()
    await admin.post(f"{U}/invitations/{created['id']}/resend")
    await admin.post(f"{U}/invitations/{created['id']}/revoke")
    tokens = [token_of(outbox, 0), token_of(outbox, 1)]
    dump = " ".join(
        f"{r.details} {r.target_label} {r.user_agent}" for r in (await session.execute(select(AuditLog))).scalars()
    )
    assert all(t not in dump for t in tokens)
    audit = (await admin.get(f"{U}/audit", params={"action": "invitation."})).json()
    assert [e["action"] for e in audit["items"]] == ["invitation.revoke", "invitation.resend", "invitation.create"]
    assert audit["items"][0]["actor_email"] == "boss@x.pt" and audit["items"][0]["target_label"] == "nova@x.pt"
