"""Aprovação de contas: o registo público fica pendente até um administrador aprovar."""

from collections.abc import Callable
from typing import Any

import httpx
import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.features.audit.models import AuditLog
from novelo.features.auth import service as auth_service
from novelo.features.users.models import User
from tests.conftest import PASSWORD, OutboxSender

U = "/api/v1/users"
AUTH = "/api/v1/auth"
Maker = Callable[..., Any]
PROTECTED = [
    ("GET", "/api/v1/planning/zones"),
    ("GET", "/api/v1/textile/baseline"),
    ("GET", "/api/v1/copilot/threads"),
    ("POST", "/api/v1/copilot/stream"),
    ("POST", "/api/v1/planning/scenarios"),
    ("PATCH", f"{AUTH}/me"),
    ("POST", f"{AUTH}/change-password"),
]


async def uid(session: AsyncSession, email: str) -> str:
    return str((await session.execute(select(User.id).where(User.email == email))).scalar_one())


async def register(c: httpx.AsyncClient, email: str = "novo@x.pt") -> httpx.Response:
    return await c.post(f"{AUTH}/register", json={"email": email, "password": PASSWORD, "name": "Novo"})


async def test_registered_account_is_pending_and_locked_out(client: httpx.AsyncClient) -> None:
    resp = await register(client)
    assert resp.status_code == 201 and resp.json()["approval_status"] == "pending" and resp.json()["role"] == "operator"
    for method, path in PROTECTED:
        r = await client.request(method, path, json={})
        assert r.status_code == 403 and r.json()["code"] == "account_pending", (method, path, r.text)
    me = await client.get(f"{AUTH}/me")
    assert (
        me.status_code == 200 and me.json()["approval_status"] == "pending" and me.json()["pending_approvals"] is None
    )
    status = (await client.get(f"{AUTH}/approval-status")).json()
    assert status == {"status": "pending", "email_verified": False, "rejected_reason": None, "decided_at": None}
    assert (await client.get(f"{AUTH}/config")).json()["approval_required"] is True
    assert (await client.post(f"{AUTH}/resend-verification")).status_code == 204  # ainda verifica o email
    assert (await client.post(f"{AUTH}/logout")).status_code == 204


async def test_email_verification_does_not_approve(
    client: httpx.AsyncClient, outbox: OutboxSender, session: AsyncSession
) -> None:
    import re  # noqa: PLC0415

    await register(client)
    token = re.search(r"token=([\w-]+)", next(m for m in outbox.sent if m["to"] == "novo@x.pt")["text"])
    assert token
    assert (await client.post(f"{AUTH}/verify-email", json={"token": token.group(1)})).status_code == 204
    assert (await client.get(f"{AUTH}/approval-status")).json() == {
        "status": "pending", "email_verified": True, "rejected_reason": None, "decided_at": None,
    }  # fmt: skip
    assert (await client.get("/api/v1/planning/zones")).status_code == 403


async def test_admins_are_told_once_per_window(
    client: httpx.AsyncClient, make_user: Maker, outbox: OutboxSender
) -> None:
    await make_user("boss@x.pt", "admin")
    await make_user("co@x.pt", "admin")
    await register(client, "um@x.pt")
    notices = [m for m in outbox.sent if "tab=pending" in m["text"]]
    assert sorted(m["to"] for m in notices) == ["boss@x.pt", "co@x.pt"]
    assert "1 conta" in notices[0]["text"] and "/users?tab=pending" in notices[0]["text"]
    await register(client, "dois@x.pt")  # dentro dos 10 minutos: sem novo email
    assert len([m for m in outbox.sent if "tab=pending" in m["text"]]) == 2


async def test_admin_lists_and_approves(
    client: httpx.AsyncClient, make_user: Maker, outbox: OutboxSender, session: AsyncSession
) -> None:
    admin = await make_user("boss@x.pt", "admin")
    await register(client)
    new_id = await uid(session, "novo@x.pt")
    assert [u["email"] for u in (await admin.get(U, params={"approval_status": "pending"})).json()] == ["novo@x.pt"]
    assert (await admin.get(f"{U}/summary")).json() == {"pending_approvals": 1, "total": 2}
    assert (await admin.get(f"{AUTH}/me")).json()["pending_approvals"] == 1

    approved = await admin.post(f"{U}/{new_id}/approve", json={})
    assert approved.status_code == 200, approved.text
    assert approved.json()["approval_status"] == "approved" and approved.json()["role"] == "operator"
    assert approved.json()["approved_at"]
    mail = outbox.sent[-1]
    assert mail["to"] == "novo@x.pt" and "aprovada" in mail["subject"]
    # a mesma sessão passa a funcionar, sem voltar a entrar
    assert (await client.get("/api/v1/planning/zones")).status_code == 200
    assert (await client.get(f"{AUTH}/approval-status")).json()["status"] == "approved"
    assert (await admin.get(f"{U}/summary")).json()["pending_approvals"] == 0
    row = (await session.execute(select(AuditLog).where(AuditLog.action == "user.approve"))).scalar_one()
    assert row.details["role"] == "operator" and row.target_label == "novo@x.pt"
    again = await admin.post(f"{U}/{new_id}/approve", json={})
    assert again.status_code == 409 and again.json()["code"] == "conflict"


async def test_approval_sets_role_and_admin_needs_confirmation(
    client: httpx.AsyncClient, make_user: Maker, outbox: OutboxSender, session: AsyncSession
) -> None:
    admin = await make_user("boss@x.pt", "admin")
    await register(client)
    new_id = await uid(session, "novo@x.pt")
    denied = await admin.post(f"{U}/{new_id}/approve", json={"role": "admin"})
    assert denied.status_code == 400 and denied.json()["code"] == "admin_confirmation_required"
    assert (await admin.get(U, params={"approval_status": "pending"})).json()[0]["role"] == "operator"
    ok = await admin.post(f"{U}/{new_id}/approve", json={"role": "guest", "notify": False})
    assert ok.json()["role"] == "guest" and not any(
        m["to"] == "novo@x.pt" and "aprovada" in m["subject"] for m in outbox.sent
    )


async def test_reject_blocks_access_and_can_be_reconsidered(
    client: httpx.AsyncClient, make_user: Maker, outbox: OutboxSender, session: AsyncSession
) -> None:
    admin = await make_user("boss@x.pt", "admin")
    await register(client)
    new_id = await uid(session, "novo@x.pt")
    rejected = await admin.post(f"{U}/{new_id}/reject", json={"reason": "  Só   entidades parceiras ", "notify": True})
    assert rejected.status_code == 200 and rejected.json()["approval_status"] == "rejected"
    assert rejected.json()["rejected_reason"] == "Só entidades parceiras"
    assert any(m["to"] == "novo@x.pt" and "Só entidades parceiras" in m["text"] for m in outbox.sent)
    r = await client.get("/api/v1/planning/zones")
    assert r.status_code == 403 and r.json()["code"] == "account_rejected"
    status = (await client.get(f"{AUTH}/approval-status")).json()
    assert status["status"] == "rejected" and status["rejected_reason"] == "Só entidades parceiras"
    assert (await client.post(f"{AUTH}/refresh")).status_code == 401  # sessões revogadas
    # só se rejeita quem está pendente; mas pode ser reconsiderado
    assert (await admin.post(f"{U}/{new_id}/reject", json={})).status_code == 409
    assert (await admin.post(f"{U}/{new_id}/approve", json={})).status_code == 200
    quiet = await register(client, "outro@x.pt")
    assert quiet.status_code == 201
    other_id = await uid(session, "outro@x.pt")
    await admin.post(f"{U}/{other_id}/reject", json={})
    assert not any(
        m["to"] == "outro@x.pt" and "Sobre o teu pedido" in m["subject"] for m in outbox.sent
    )  # notify=false
    actions = [a for (a,) in await session.execute(select(AuditLog.action).where(AuditLog.action.like("user.%")))]
    assert sorted(actions) == ["user.approve", "user.reject", "user.reject"]


async def test_only_admins_decide_and_never_themselves(
    client: httpx.AsyncClient, logged_in: httpx.AsyncClient, make_user: Maker, session: AsyncSession
) -> None:
    guest = await make_user("convidado@x.pt", "guest")
    admin = await make_user("boss@x.pt", "admin")
    target = await make_user("pend@x.pt")
    await session.execute(update_status(await uid(session, "pend@x.pt")))
    await session.commit()
    target_id = await uid(session, "pend@x.pt")
    for actor in (logged_in, guest, target):
        assert (await actor.post(f"{U}/{target_id}/approve", json={})).status_code == 403
        assert (await actor.post(f"{U}/{target_id}/reject", json={})).status_code == 403
        assert (await actor.get(f"{U}/summary")).status_code == 403
    me = await uid(session, "boss@x.pt")
    own = await admin.post(f"{U}/{me}/approve", json={})
    assert own.status_code == 409 and own.json()["code"] == "cannot_modify_self"
    assert (await admin.post(f"{U}/{uid_random()}/approve", json={})).status_code == 404
    assert (await client.post(f"{U}/{target_id}/approve", json={})).status_code in (401, 403)


def update_status(user_id: str) -> Any:
    from sqlalchemy import update  # noqa: PLC0415

    return update(User).where(User.id == user_id).values(approval_status="pending")


def uid_random() -> str:
    import uuid  # noqa: PLC0415

    return str(uuid.uuid4())


async def test_pending_account_cannot_be_impersonated(make_user: Maker, session: AsyncSession) -> None:
    admin = await make_user("boss@x.pt", "admin")
    await make_user("pend@x.pt")
    target_id = await uid(session, "pend@x.pt")
    await session.execute(update_status(target_id))
    await session.commit()
    resp = await admin.post(f"{U}/{target_id}/impersonate", json={"reason": "Preciso de ver o ecrã dele"})
    assert resp.status_code == 409


async def test_invitation_and_quick_join_skip_approval(
    client: httpx.AsyncClient, make_user: Maker, outbox: OutboxSender, monkeypatch: pytest.MonkeyPatch
) -> None:
    from novelo.core.config import get_settings  # noqa: PLC0415

    admin = await make_user("boss@x.pt", "admin")
    await admin.post(f"{U}/invitations", json={"email": "conv@x.pt"})
    import re  # noqa: PLC0415

    token = re.search(r"accept-invite\?token=([\w-]+)", outbox.sent[-1]["text"])
    assert token
    accepted = await client.post(f"{AUTH}/invitations/accept", json={"token": token.group(1), "name": "Conv"})
    assert accepted.json()["user"]["approval_status"] == "approved"
    assert (await client.get("/api/v1/planning/zones")).status_code == 200

    s = get_settings()
    monkeypatch.setattr(s, "quick_join_enabled", True)
    monkeypatch.setattr(s, "quick_join_code", "evento-123")
    other = httpx.AsyncClient(transport=client._transport, base_url="http://test")
    joined = await other.post(
        f"{AUTH}/quick-join", json={"name": "Rui", "email": "qr@x.pt", "code": "evento-123", "consent": True}
    )
    assert joined.json()["user"]["approval_status"] == "approved" and joined.json()["user"]["role"] == "guest"
    assert (await other.get("/api/v1/planning/zones")).status_code == 200
    await other.aclose()


async def test_magic_link_for_a_pending_account_still_waits(client: httpx.AsyncClient, outbox: OutboxSender) -> None:
    import re  # noqa: PLC0415

    await register(client)
    await client.post(f"{AUTH}/logout")
    await client.post(f"{AUTH}/magic-link", json={"email": "novo@x.pt"})
    token = re.search(r"magic-link\?token=([\w-]+)", outbox.sent[-1]["text"])
    assert token
    verified = await client.post(f"{AUTH}/magic-link/verify", json={"token": token.group(1)})
    assert verified.status_code == 200 and verified.json()["user"]["approval_status"] == "pending"
    assert (await client.get("/api/v1/planning/zones")).json()["code"] == "account_pending"


async def test_google_creates_pending_and_never_approves_existing(session: AsyncSession) -> None:
    fresh, _, _ = await auth_service.login_with_google(session, {"sub": "g-1", "email": "Nova@x.pt", "name": "Nova"})
    assert fresh.approval_status == "pending" and fresh.email_verified
    approved = User(email="velha@x.pt", approval_status="approved")
    session.add(approved)
    await session.commit()
    linked, _, _ = await auth_service.login_with_google(session, {"sub": "g-2", "email": "velha@x.pt"})
    assert linked.approval_status == "approved"
