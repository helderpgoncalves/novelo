"""Registo aberto (`open_registration`): contas novas entram logo, sem um administrador aprovar cada pessoa."""

import re
from collections.abc import Callable
from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.features.app_settings.models import AppSettings
from novelo.features.audit.models import AuditLog
from novelo.features.auth import service as auth_service
from novelo.features.users import open_registration
from novelo.features.users.models import User
from tests.conftest import PASSWORD, OutboxSender

S = "/api/v1/admin/settings"
U = "/api/v1/users"
AUTH = "/api/v1/auth"
ZONES = "/api/v1/planning/zones"
Maker = Callable[..., Any]


async def register(c: httpx.AsyncClient, email: str = "juri@x.pt") -> httpx.Response:
    return await c.post(f"{AUTH}/register", json={"email": email, "password": PASSWORD, "name": "Júri"})


async def open_now(session: AsyncSession, value: bool = True) -> None:
    session.add(AppSettings(singleton=True, open_registration=value))
    await session.commit()


async def user_of(session: AsyncSession, email: str) -> User:
    return (await session.execute(select(User).where(User.email == email))).scalar_one()


async def audit_rows(session: AsyncSession, action: str) -> list[AuditLog]:
    return list((await session.execute(select(AuditLog).where(AuditLog.action == action))).scalars())


async def test_closed_by_default(client: httpx.AsyncClient) -> None:
    assert (await client.get(f"{AUTH}/registration")).json() == {"open": False}
    assert (await client.get(f"{AUTH}/config")).json()["approval_required"] is True
    assert (await register(client)).json()["approval_status"] == "pending"


async def test_only_admins_read_and_change_settings(client: httpx.AsyncClient, make_user: Maker) -> None:
    assert (await client.get(S)).status_code == 401
    operator = await make_user("op@x.pt")
    guest = await make_user("conv@x.pt", "guest")
    for actor in (operator, guest):
        assert (await actor.get(S)).status_code == 403
        assert (await actor.patch(S, json={"open_registration": True})).status_code == 403
    assert (await client.get(f"{AUTH}/registration")).json() == {"open": False}
    admin = await make_user("boss@x.pt", "admin")
    got = await admin.get(S)
    assert got.status_code == 200
    assert got.json() == {"open_registration": False, "pending_approvals": 0, "updated_at": None, "updated_by_id": None}


async def test_open_registration_approves_password_signups(
    client: httpx.AsyncClient, make_user: Maker, outbox: OutboxSender, session: AsyncSession
) -> None:
    admin = await make_user("boss@x.pt", "admin")
    changed = await admin.patch(S, json={"open_registration": True})
    assert changed.status_code == 200, changed.text
    body = changed.json()
    assert body["open_registration"] is True and body["approved_pending"] == 0 and body["updated_at"]
    [row] = await audit_rows(session, "settings.update")
    assert row.details["open_registration"] == {"from": False, "to": True}
    assert (await client.get(f"{AUTH}/registration")).json() == {"open": True}
    assert (await client.get(f"{AUTH}/config")).json()["approval_required"] is False

    sent_before = len(outbox.sent)
    resp = await register(client)
    assert resp.status_code == 201
    assert resp.json()["approval_status"] == "approved" and resp.json()["role"] == "operator"
    assert (await client.get(ZONES)).status_code == 200  # entra logo
    new_mail = outbox.sent[sent_before:]
    assert not any("tab=pending" in m["text"] for m in new_mail)  # sem aviso aos administradores
    assert {m["to"] for m in new_mail} == {"juri@x.pt"}  # só a confirmação do email
    [auto] = await audit_rows(session, open_registration.AUTO_APPROVE_ACTION)
    assert auto.actor_id is None and auto.target_label == "juri@x.pt"
    assert auto.details == {
        "reason": "open_registration", "via": "password", "role": "operator",
        "note": "aprovado automaticamente: registo aberto",
    }  # fmt: skip

    closed = await admin.patch(S, json={"open_registration": False})
    assert closed.json()["open_registration"] is False
    assert (await register(client, "depois@x.pt")).json()["approval_status"] == "pending"


async def test_google_with_and_without_open_registration(session: AsyncSession) -> None:
    closed, _, _ = await auth_service.login_with_google(session, {"sub": "g-1", "email": "um@x.pt", "name": "Um"})
    assert closed.approval_status == "pending"
    await open_now(session)
    fresh, _, _ = await auth_service.login_with_google(session, {"sub": "g-2", "email": "dois@x.pt"})
    assert fresh.approval_status == "approved" and fresh.role == "operator" and fresh.approved_by_id is None
    again, _, _ = await auth_service.login_with_google(session, {"sub": "g-1", "email": "um@x.pt"})
    assert again.approval_status == "approved"  # a conta pendente entra e fica aprovada
    vias = sorted(r.details["via"] for r in await audit_rows(session, open_registration.AUTO_APPROVE_ACTION))
    assert vias == ["google", "google"]


async def test_magic_link_and_password_login_approve_a_pending_account(
    client: httpx.AsyncClient, outbox: OutboxSender, session: AsyncSession
) -> None:
    await register(client, "link@x.pt")
    await register(client, "pw@x.pt")
    await client.post(f"{AUTH}/logout")
    await open_now(session)
    await client.post(f"{AUTH}/magic-link", json={"email": "link@x.pt"})
    token = re.search(r"magic-link\?token=([\w-]+)", outbox.sent[-1]["text"])
    assert token
    verified = await client.post(f"{AUTH}/magic-link/verify", json={"token": token.group(1)})
    assert verified.status_code == 200 and verified.json()["user"]["approval_status"] == "approved"
    assert (await client.get(ZONES)).status_code == 200
    login = await client.post(f"{AUTH}/login", json={"email": "pw@x.pt", "password": PASSWORD})
    assert login.status_code == 200 and login.json()["approval_status"] == "approved"
    vias = sorted(r.details["via"] for r in await audit_rows(session, open_registration.AUTO_APPROVE_ACTION))
    assert vias == ["magic_link", "password"]


async def test_rejected_accounts_and_emails_are_never_auto_approved(
    client: httpx.AsyncClient, make_user: Maker, session: AsyncSession
) -> None:
    admin = await make_user("boss@x.pt", "admin")
    await register(client, "nao@x.pt")
    await register(client, "apagado@x.pt")
    for email in ("nao@x.pt", "apagado@x.pt"):
        target = await user_of(session, email)
        assert (await admin.post(f"{U}/{target.id}/reject", json={})).status_code == 200
    gone = await user_of(session, "apagado@x.pt")
    deleted = await admin.request("DELETE", f"{U}/{gone.id}", json={"confirm_email": "apagado@x.pt"})
    assert deleted.status_code == 204
    assert (await admin.patch(S, json={"open_registration": True})).status_code == 200

    # A conta recusada continua recusada ao entrar.
    login = await client.post(f"{AUTH}/login", json={"email": "nao@x.pt", "password": PASSWORD})
    assert login.json()["approval_status"] == "rejected"
    assert (await client.get(ZONES)).json()["code"] == "account_rejected"
    # O email recusado (conta já eliminada, auditoria sem o email) volta a registar-se: fica à espera.
    again = await register(client, "apagado@x.pt")
    assert again.status_code == 201 and again.json()["approval_status"] == "pending"
    assert not await audit_rows(session, open_registration.AUTO_APPROVE_ACTION)
    # Nem a aprovação em bloco o aprova.
    bulk = await admin.patch(S, json={"approve_pending": True})
    assert bulk.json()["approved_pending"] == 0 and bulk.json()["skipped_previously_rejected"] == 1
    assert (await user_of(session, "apagado@x.pt")).approval_status == "pending"


async def test_approve_pending_now(client: httpx.AsyncClient, make_user: Maker, session: AsyncSession) -> None:
    admin = await make_user("boss@x.pt", "admin")
    await register(client, "a@x.pt")
    await register(client, "b@x.pt")
    await register(client, "inativo@x.pt")
    (await user_of(session, "inativo@x.pt")).is_active = False
    await session.commit()
    assert (await admin.get(S)).json()["pending_approvals"] == 3

    refused = await admin.patch(S, json={"approve_pending": True})  # registo fechado: 409
    assert refused.status_code == 409 and refused.json()["code"] == "conflict"
    assert (await admin.get(S)).json()["open_registration"] is False

    done = await admin.patch(S, json={"open_registration": True, "approve_pending": True})
    assert done.status_code == 200, done.text
    assert done.json()["approved_pending"] == 2 and done.json()["pending_approvals"] == 1  # o inativo fica
    for email in ("a@x.pt", "b@x.pt"):
        u = await user_of(session, email)
        assert u.approval_status == "approved" and u.role == "operator" and u.approved_by_id is not None
    rows = await audit_rows(session, open_registration.AUTO_APPROVE_ACTION)
    assert sorted(r.target_label or "" for r in rows) == ["a@x.pt", "b@x.pt"]
    assert all(r.details["via"] == "bulk" and r.actor_id is not None for r in rows)
