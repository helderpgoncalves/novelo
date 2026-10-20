"""Administração de utilizadores: eliminar (RGPD), impersonação, papéis e auditoria."""

from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from typing import Any

import httpx
import pytest
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.core.errors import ConfirmationMismatchError, LastAdminError
from novelo.core.security import create_access_token
from novelo.features.audit import service as audit_service
from novelo.features.audit.models import AuditLog
from novelo.features.auth.models import RefreshToken
from novelo.features.copilot.models import CopilotMessage, CopilotThread
from novelo.features.planning.models import Scenario
from novelo.features.users import accounts
from novelo.features.users.models import ImpersonationSession, Invitation, User
from novelo.features.users.schemas import UserAdminUpdate
from tests.conftest import PASSWORD, OutboxSender

U = "/api/v1/users"
AUTH = "/api/v1/auth"
C = "/api/v1/copilot"
P = "/api/v1/planning"
Maker = Callable[..., Any]
REASON = "Apoio ao utilizador: não consegue ver o cenário"


async def uid(session: AsyncSession, email: str) -> str:
    return str((await session.execute(select(User.id).where(User.email == email))).scalar_one())


async def audit_actions(session: AsyncSession) -> list[str]:
    rows = await session.execute(select(AuditLog.action).order_by(AuditLog.created_at))
    return [r for (r,) in rows]


async def impersonate(admin: httpx.AsyncClient, target_id: str, reason: str = REASON) -> httpx.Response:
    return await admin.post(f"{U}/{target_id}/impersonate", json={"reason": reason})


# --- eliminar ----------------------------------------------------------------------------------------------


async def test_delete_user_erases_personal_data_and_anonymises_records(
    client: httpx.AsyncClient, make_user: Maker, session: AsyncSession, outbox: OutboxSender
) -> None:
    admin = await make_user("boss@x.pt", "admin")
    target = await make_user("rui@x.pt")
    target_id = await uid(session, "rui@x.pt")
    scenario = (
        await target.post(
            f"{P}/scenarios", json={"label": "Do Rui", "objective": "max_tonnes", "budget_eur_year": 30000}
        )
    ).json()
    thread = CopilotThread(user_id=target_id, title="Conversa privada")
    session.add(thread)
    await session.flush()
    session.add(
        CopilotMessage(thread_id=thread.id, role="user", parts=[{"type": "text", "text": "olá"}], search_text="ola")
    )
    await target.post(f"{C}/memory/entries", json={"target": "user", "content": "Prefere tabelas."})
    # um convite antigo para o mesmo email e a auditoria sobre ele
    created = await admin.post(f"{U}/invitations", json={"email": "rui@x.pt"})
    assert created.status_code == 409  # já tem conta
    session.add(
        Invitation(
            email="rui@x.pt",
            role="operator",
            token_hash="a" * 64,
            expires_at=datetime.now(UTC),
            accepted_at=datetime.now(UTC),
        )
    )
    await audit_service.record(
        session, "invitation.create", actor_id=uuid_of(await uid(session, "boss@x.pt")),
        target_type="invitation", target_label="rui@x.pt",
    )  # fmt: skip
    await audit_service.record(session, "user.role_change", actor_id=None, target_type="user", target_id=target_id,
        target_label="rui@x.pt")  # fmt: skip
    await session.commit()
    assert (
        await session.scalar(select(func.count()).select_from(RefreshToken).where(RefreshToken.user_id == target_id))
    ) == 1

    resp = await admin.request("DELETE", f"{U}/{target_id}", json={"confirm_email": "RUI@x.pt "})
    assert resp.status_code == 204, resp.text

    assert (await session.execute(select(User).where(User.email == "rui@x.pt"))).first() is None
    assert (
        await session.scalar(select(func.count()).select_from(CopilotThread).where(CopilotThread.user_id == target_id))
        == 0
    )
    assert await session.scalar(select(func.count()).select_from(CopilotMessage)) == 0
    assert (
        await session.scalar(select(func.count()).select_from(RefreshToken).where(RefreshToken.user_id == target_id))
        == 0
    )
    assert await session.scalar(select(func.count()).select_from(Invitation).where(Invitation.email == "rui@x.pt")) == 0
    # o cenário sobrevive, sem autor
    kept = (await session.execute(select(Scenario.created_by_id).where(Scenario.id == scenario["id"]))).one()
    assert kept.created_by_id is None
    # auditoria: o facto fica, o email desaparece
    rows = (await session.execute(select(AuditLog))).scalars().all()
    assert all(r.target_label != "rui@x.pt" for r in rows)
    deleted = next(r for r in rows if r.action == "user.delete")
    assert deleted.target_id == target_id and deleted.target_label is None and "rui@x.pt" not in str(deleted.details)
    assert deleted.details["role"] == "operator" and deleted.actor_id is not None

    # a sessão antiga, o login e o refresh deixam de funcionar
    assert (await target.get(f"{AUTH}/me")).status_code == 401
    assert (await target.post(f"{AUTH}/refresh")).status_code == 401
    assert (await client.post(f"{AUTH}/login", json={"email": "rui@x.pt", "password": PASSWORD})).status_code == 401
    assert (await admin.delete(f"{U}/{target_id}")).status_code == 422  # sem corpo


def uuid_of(value: str) -> Any:
    import uuid  # noqa: PLC0415

    return uuid.UUID(value)


async def test_delete_requires_the_matching_email(make_user: Maker, session: AsyncSession) -> None:
    admin = await make_user("boss@x.pt", "admin")
    await make_user("rui@x.pt")
    target_id = await uid(session, "rui@x.pt")
    for wrong in ("outro@x.pt", "rui@x.pt.evil", "rui", "ru@x.pt"):
        resp = await admin.request("DELETE", f"{U}/{target_id}", json={"confirm_email": wrong})
        assert resp.status_code == 400 and resp.json()["code"] == "confirmation_mismatch"
    assert await uid(session, "rui@x.pt") == target_id
    assert "user.delete" not in await audit_actions(session)


async def test_delete_edge_cases(make_user: Maker, session: AsyncSession) -> None:
    admin = await make_user("boss@x.pt", "admin")
    me = await uid(session, "boss@x.pt")
    own = await admin.request("DELETE", f"{U}/{me}", json={"confirm_email": "boss@x.pt"})
    assert own.status_code == 409 and own.json()["code"] == "cannot_modify_self"
    ghost = await admin.request("DELETE", f"{U}/{uid_random()}", json={"confirm_email": "nobody@x.pt"})
    assert ghost.status_code == 404 and ghost.json()["code"] == "user_not_found"
    assert await uid(session, "boss@x.pt") == me


def uid_random() -> str:
    import uuid  # noqa: PLC0415

    return str(uuid.uuid4())


async def test_only_admins_can_delete(logged_in: httpx.AsyncClient, make_user: Maker, session: AsyncSession) -> None:
    guest = await make_user("convidado@x.pt", "guest")
    await make_user("alvo@x.pt")
    target_id = await uid(session, "alvo@x.pt")
    for actor in (logged_in, guest):
        resp = await actor.request("DELETE", f"{U}/{target_id}", json={"confirm_email": "alvo@x.pt"})
        assert resp.status_code == 403 and resp.json()["code"] == "forbidden"
    anonymous = httpx.AsyncClient(transport=logged_in._transport, base_url="http://test")
    assert (
        await anonymous.request("DELETE", f"{U}/{target_id}", json={"confirm_email": "alvo@x.pt"})
    ).status_code == 401
    await anonymous.aclose()
    assert await uid(session, "alvo@x.pt") == target_id


async def test_admin_can_delete_another_admin_but_the_last_one_is_protected(
    make_user: Maker, session: AsyncSession
) -> None:
    admin = await make_user("boss@x.pt", "admin")
    await make_user("co@x.pt", "admin")
    co_id = await uid(session, "co@x.pt")
    assert (await admin.request("DELETE", f"{U}/{co_id}", json={"confirm_email": "co@x.pt"})).status_code == 204
    # o único administrador ativo que resta não se pode eliminar, despromover nem desativar por outra via
    sole = (await session.execute(select(User).where(User.email == "boss@x.pt"))).scalar_one()
    operator = User(email="op@x.pt", role="operator")
    session.add(operator)
    await session.flush()
    meta = None
    with pytest.raises(LastAdminError):
        await accounts.delete_user(session, operator, sole.id, "boss@x.pt", meta)  # type: ignore[arg-type]
    with pytest.raises(LastAdminError):
        await accounts.update_user(session, operator, sole.id, UserAdminUpdate(role="operator"), meta)  # type: ignore[arg-type]
    with pytest.raises(LastAdminError):
        await accounts.update_user(session, operator, sole.id, UserAdminUpdate(is_active=False), meta)  # type: ignore[arg-type]
    with pytest.raises(ConfirmationMismatchError):
        await accounts.delete_user(session, operator, sole.id, "outro", meta)  # type: ignore[arg-type]


async def test_cannot_delete_someone_being_impersonated(make_user: Maker, session: AsyncSession) -> None:
    admin = await make_user("boss@x.pt", "admin")
    other = await make_user("co@x.pt", "admin")
    await make_user("rui@x.pt")
    target_id = await uid(session, "rui@x.pt")
    assert (await impersonate(admin, target_id)).status_code == 200
    blocked = await other.request("DELETE", f"{U}/{target_id}", json={"confirm_email": "rui@x.pt"})
    assert blocked.status_code == 409 and blocked.json()["code"] == "impersonation_active"
    await admin.post(f"{AUTH}/impersonation/stop")
    assert (await other.request("DELETE", f"{U}/{target_id}", json={"confirm_email": "rui@x.pt"})).status_code == 204


async def test_deleting_a_guest_and_an_admin_who_impersonated(make_user: Maker, session: AsyncSession) -> None:
    admin = await make_user("boss@x.pt", "admin")
    other = await make_user("co@x.pt", "admin")
    await make_user("convidado@x.pt", "guest")
    guest_id = await uid(session, "convidado@x.pt")
    assert (await impersonate(other, guest_id)).status_code == 200
    await other.post(f"{AUTH}/impersonation/stop")
    co_id = await uid(session, "co@x.pt")
    assert (await admin.request("DELETE", f"{U}/{co_id}", json={"confirm_email": "co@x.pt"})).status_code == 204
    assert await session.scalar(select(func.count()).select_from(ImpersonationSession)) == 0
    rows = (await session.execute(select(AuditLog).where(AuditLog.action.like("impersonation.%")))).scalars().all()
    assert rows and all(r.actor_id is None and r.ip is None and r.user_agent is None for r in rows)  # sem identificar


# --- papéis e desativação -----------------------------------------------------------------------------------


async def test_role_and_activation_changes_are_audited_and_need_confirmation(
    make_user: Maker, session: AsyncSession
) -> None:
    admin = await make_user("boss@x.pt", "admin")
    await make_user("rui@x.pt")
    rui = await uid(session, "rui@x.pt")
    denied = await admin.patch(f"{U}/{rui}", json={"role": "admin"})
    assert denied.status_code == 400 and denied.json()["code"] == "admin_confirmation_required"
    assert (await admin.patch(f"{U}/{rui}", json={"role": "admin", "confirm_admin": True})).json()["role"] == "admin"
    assert (await admin.patch(f"{U}/{rui}", json={"role": "guest"})).json()["role"] == "guest"
    assert (await admin.patch(f"{U}/{rui}", json={"is_active": False})).json()["is_active"] is False
    assert (await admin.patch(f"{U}/{rui}", json={"is_active": False})).status_code == 200  # sem efeito, sem auditoria
    assert (await admin.patch(f"{U}/{rui}", json={"is_active": True})).json()["is_active"] is True
    assert await audit_actions(session) == ["user.role_change", "user.role_change", "user.deactivate", "user.activate"]
    first = (await admin.get(f"{U}/audit", params={"action": "user.role_change"})).json()["items"][-1]
    assert first["details"] == {"from": "operator", "to": "admin"} and first["target_label"] == "rui@x.pt"


async def test_operator_cannot_change_roles(
    logged_in: httpx.AsyncClient, make_user: Maker, session: AsyncSession
) -> None:
    await make_user("rui@x.pt")
    rui = await uid(session, "rui@x.pt")
    assert (await logged_in.patch(f"{U}/{rui}", json={"role": "admin", "confirm_admin": True})).status_code == 403


# --- impersonação -------------------------------------------------------------------------------------------


async def test_impersonation_happy_path(make_user: Maker, session: AsyncSession, outbox: OutboxSender) -> None:
    admin = await make_user("boss@x.pt", "admin")
    await make_user("rui@x.pt")
    rui = await uid(session, "rui@x.pt")

    started = await impersonate(admin, rui)
    assert started.status_code == 200, started.text
    body = started.json()
    assert body["user"]["email"] == "rui@x.pt" and body["impersonation"]["active"] is True
    cookie = next(c for c in started.headers.get_list("set-cookie") if c.startswith("access_token="))
    assert "Max-Age=1800" in cookie and "HttpOnly" in cookie and "samesite=lax" in cookie.lower()
    assert not any(c.startswith("refresh_token=") for c in started.headers.get_list("set-cookie"))  # sem refresh

    me = (await admin.get(f"{AUTH}/me")).json()
    assert me["email"] == "rui@x.pt" and me["role"] == "operator"
    imp = me["impersonation"]
    assert (
        imp["active"] is True
        and imp["admin_id"] == await uid(session, "boss@x.pt")
        and imp["admin_name"] == "boss@x.pt"
    )
    expires = datetime.fromisoformat(imp["expires_at"])
    assert timedelta(minutes=29) < expires - datetime.now(UTC) <= timedelta(minutes=30)
    assert (await admin.get(f"{P}/zones")).status_code == 200  # vê o que o utilizador vê

    stopped = await admin.post(f"{AUTH}/impersonation/stop")
    assert stopped.status_code == 200 and stopped.json()["email"] == "boss@x.pt"
    back = (await admin.get(f"{AUTH}/me")).json()
    assert back["email"] == "boss@x.pt" and back["impersonation"] == {
        "active": False, "admin_id": None, "admin_name": None, "expires_at": None,
    }  # fmt: skip
    assert (await admin.get(U)).status_code == 200  # voltou a ser admin
    assert (await admin.post(f"{AUTH}/impersonation/stop")).status_code == 409  # nada para parar

    start, stop = (
        (await session.execute(select(AuditLog).where(AuditLog.action.in_(["impersonation.start", "impersonation.stop"])
        )
        .order_by(AuditLog.created_at))).scalars().all()
    )  # fmt: skip
    assert start.actor_id == stop.actor_id and str(start.actor_id) == await uid(session, "boss@x.pt")
    assert str(start.effective_actor_id) == rui and start.details["reason"] == REASON
    assert "token" not in str(start.details).lower()


async def test_impersonation_rules(logged_in: httpx.AsyncClient, make_user: Maker, session: AsyncSession) -> None:
    admin = await make_user("boss@x.pt", "admin")
    await make_user("co@x.pt", "admin")
    await make_user("rui@x.pt")
    await make_user("convidado@x.pt", "guest")
    inactive = User(email="off@x.pt", role="operator", is_active=False)
    session.add(inactive)
    await session.commit()
    co, rui, guest = await uid(session, "co@x.pt"), await uid(session, "rui@x.pt"), await uid(session, "convidado@x.pt")

    forbidden = await impersonate(admin, co)  # admin -> admin proibido
    assert forbidden.status_code == 403 and forbidden.json()["code"] == "impersonation_forbidden"
    own = await impersonate(admin, await uid(session, "boss@x.pt"))
    assert own.status_code == 409 and own.json()["code"] == "cannot_modify_self"
    assert (await impersonate(admin, str(inactive.id))).status_code == 409
    assert (await impersonate(admin, uid_random())).status_code == 404
    for bad in ("curto", " " * 20, "a" * 301):
        assert (await admin.post(f"{U}/{rui}/impersonate", json={"reason": bad})).status_code == 422
    assert (await admin.post(f"{U}/{rui}/impersonate", json={})).status_code == 422
    assert await session.scalar(select(func.count()).select_from(ImpersonationSession)) == 0

    guest_client = await make_user("outro@x.pt", "guest")
    for actor in (logged_in, guest_client):  # operador e convidado não impersonam
        assert (await impersonate(actor, rui)).status_code == 403
    assert (await impersonate(admin, guest)).status_code == 200  # guests podem ser impersonados
    # sem aninhamento: dentro da sessão o utilizador é não-admin, por isso nada de impersonar nem gerir
    nested = await impersonate(admin, rui)
    assert nested.status_code == 403
    assert (await admin.get(U)).status_code == 403


async def test_impersonation_blocks_sensitive_actions(make_user: Maker, session: AsyncSession) -> None:
    admin = await make_user("boss@x.pt", "admin")
    await make_user("rui@x.pt")
    rui = await uid(session, "rui@x.pt")
    thread = CopilotThread(user_id=rui, title="Privada")
    session.add(thread)
    await session.commit()
    await impersonate(admin, rui)

    blocked: list[tuple[str, str, dict[str, Any] | None]] = [
        ("POST", f"{AUTH}/change-password", {"new_password": "outra-password-segura"}),
        ("PATCH", f"{AUTH}/me", {"name": "Hackeado"}),
        ("POST", f"{AUTH}/logout-all", None),
        ("POST", f"{AUTH}/resend-verification", None),
        ("GET", f"{AUTH}/google/login", None),
        ("GET", f"{C}/data/export", None),
        ("DELETE", f"{C}/data?confirmation=APAGAR", None),
        ("GET", f"{C}/threads/{thread.id}/export", None),
        ("GET", f"{C}/threads/{thread.id}/export.pdf", None),
        ("DELETE", f"{C}/memory/entries?target=memory", None),
    ]
    for method, path, body in blocked:
        resp = await admin.request(method, path, json=body) if body else await admin.request(method, path)
        assert resp.status_code == 403 and resp.json()["code"] == "impersonation_blocked", (method, path, resp.text)
    # gerir utilizadores e convites: o impersonado não é admin
    assert (await admin.post(f"{U}/invitations", json={"email": "x@x.pt"})).status_code == 403
    assert (await admin.get(f"{U}/audit")).status_code == 403
    assert (await admin.request("DELETE", f"{U}/{rui}", json={"confirm_email": "rui@x.pt"})).status_code == 403
    # ação crítica do copiloto
    crit = await admin.post(f"{C}/actions", json={"type": "delete_my_copilot_data", "params": {}})
    assert crit.status_code == 403
    assert (await admin.get(f"{AUTH}/me")).json()["name"] is None  # nada mudou
    assert (
        await session.scalar(select(func.count()).select_from(CopilotThread).where(CopilotThread.user_id == rui)) == 1
    )


async def test_impersonation_still_allows_normal_use_and_audits_writes(make_user: Maker, session: AsyncSession) -> None:
    admin = await make_user("boss@x.pt", "admin")
    await make_user("rui@x.pt")
    rui = await uid(session, "rui@x.pt")
    await impersonate(admin, rui)
    made = await admin.post(
        f"{P}/scenarios", json={"label": "Visto pelo admin", "objective": "max_tonnes", "budget_eur_year": 30000}
    )
    assert made.status_code in (200, 201), made.text
    created_by = (
        await session.execute(select(Scenario.created_by_id).where(Scenario.id == made.json()["id"]))
    ).scalar_one()
    assert str(created_by) == rui  # como o utilizador
    write = (await session.execute(select(AuditLog).where(AuditLog.action == "impersonation.write"))).scalars().all()
    assert len(write) == 1
    assert str(write[0].actor_id) == await uid(session, "boss@x.pt") and str(write[0].effective_actor_id) == rui
    assert write[0].details == {"method": "POST", "path": "/api/v1/planning/scenarios"}
    await admin.get(f"{P}/zones")  # leituras não enchem a auditoria
    assert (
        await session.scalar(select(func.count()).select_from(AuditLog).where(AuditLog.action == "impersonation.write"))
        == 1
    )


async def test_impersonation_ends_in_every_way(make_user: Maker, session: AsyncSession) -> None:
    admin = await make_user("boss@x.pt", "admin")
    await make_user("rui@x.pt")
    rui = await uid(session, "rui@x.pt")

    # 1) expirou (a linha manda, mesmo com o JWT ainda válido)
    await impersonate(admin, rui)
    await session.execute(update(ImpersonationSession).values(expires_at=datetime.now(UTC) - timedelta(seconds=1)))
    await session.commit()
    expired = await admin.get(f"{AUTH}/me")
    assert expired.status_code == 401 and expired.json()["code"] == "session_expired"
    await admin.post(f"{AUTH}/refresh")  # o refresh do admin devolve a sessão dele

    # 2) o token antigo não volta a valer depois de parar
    started = await impersonate(admin, rui)
    stale = next(c for c in started.headers.get_list("set-cookie") if c.startswith("access_token=")).split(";")[0]
    assert (await admin.post(f"{AUTH}/impersonation/stop")).status_code == 200
    replay = httpx.AsyncClient(transport=admin._transport, base_url="http://test", headers={"cookie": stale})
    assert (await replay.get(f"{AUTH}/me")).status_code == 401
    await replay.aclose()

    # 3) o alvo é desativado a meio
    await impersonate(admin, rui)
    target = (await session.execute(select(User).where(User.email == "rui@x.pt"))).scalar_one()
    target.is_active = False
    await session.commit()
    assert (await admin.get(f"{AUTH}/me")).status_code == 401
    target.is_active = True
    await session.commit()

    # 4) o alvo passa a admin a meio
    await admin.post(f"{AUTH}/refresh")  # volta ao admin pelo refresh do próprio admin
    assert (await admin.get(f"{AUTH}/me")).json()["email"] == "boss@x.pt"
    await impersonate(admin, rui)
    target.role = "admin"
    await session.commit()
    assert (await admin.get(f"{AUTH}/me")).status_code == 401
    target.role = "operator"
    await session.commit()

    # 5) o administrador perde o papel a meio
    await admin.post(f"{AUTH}/refresh")
    await impersonate(admin, rui)
    boss = (await session.execute(select(User).where(User.email == "boss@x.pt"))).scalar_one()
    boss.role = "operator"
    await session.commit()
    assert (await admin.get(f"{AUTH}/me")).status_code == 401


async def test_refresh_during_impersonation_returns_to_the_admin(make_user: Maker, session: AsyncSession) -> None:
    admin = await make_user("boss@x.pt", "admin")
    await make_user("rui@x.pt")
    await impersonate(admin, await uid(session, "rui@x.pt"))
    refreshed = await admin.post(f"{AUTH}/refresh")  # só existe o refresh do admin: nunca renova a impersonação
    assert refreshed.status_code == 204
    me = (await admin.get(f"{AUTH}/me")).json()
    assert me["email"] == "boss@x.pt" and me["impersonation"]["active"] is False


async def test_logout_ends_the_impersonation_session(make_user: Maker, session: AsyncSession) -> None:
    admin = await make_user("boss@x.pt", "admin")
    await make_user("rui@x.pt")
    await impersonate(admin, await uid(session, "rui@x.pt"))
    await admin.post(f"{AUTH}/logout")
    ended = (await session.execute(select(ImpersonationSession.ended_at))).scalar_one()
    assert ended is not None


async def test_a_new_impersonation_ends_the_previous_one(make_user: Maker, session: AsyncSession) -> None:
    admin = await make_user("boss@x.pt", "admin")
    await make_user("rui@x.pt")
    await make_user("ana@x.pt")
    await impersonate(admin, await uid(session, "rui@x.pt"))
    await admin.post(f"{AUTH}/refresh")
    await impersonate(admin, await uid(session, "ana@x.pt"))
    active = await session.scalar(
        select(func.count()).select_from(ImpersonationSession).where(ImpersonationSession.ended_at.is_(None))
    )
    assert active == 1


async def test_a_forged_impersonation_token_is_useless(make_user: Maker, session: AsyncSession) -> None:
    """Um JWT de acesso normal com `imp` acrescentado à mão não é aceite (assinatura), e sem sessão na BD também não."""
    from novelo.core.security import create_impersonation_token  # noqa: PLC0415

    await make_user("boss@x.pt", "admin")
    await make_user("rui@x.pt")
    import uuid  # noqa: PLC0415

    token = create_impersonation_token(
        uuid.UUID(await uid(session, "rui@x.pt")),
        "operator",
        uuid.UUID(await uid(session, "boss@x.pt")),
        uuid.uuid4(),
        30,
    )
    c = httpx.AsyncClient(transport=httpx.ASGITransport(app=(await _app_of(make_user))), base_url="http://test")
    c.cookies.set("access_token", token)
    resp = await c.get(f"{AUTH}/me")
    assert resp.status_code == 401 and resp.json()["code"] == "session_expired"
    c.cookies.set("access_token", create_access_token(uuid.UUID(await uid(session, "rui@x.pt")), "operator") + "x")
    assert (await c.get(f"{AUTH}/me")).status_code == 401
    await c.aclose()


async def _app_of(make_user: Maker) -> Any:
    probe = await make_user("probe@x.pt")
    return probe._transport.app


# --- auditoria ----------------------------------------------------------------------------------------------


async def test_audit_listing_filters_and_access(
    logged_in: httpx.AsyncClient, make_user: Maker, session: AsyncSession
) -> None:
    admin = await make_user("boss@x.pt", "admin")
    await make_user("rui@x.pt")
    rui = await uid(session, "rui@x.pt")
    await admin.patch(f"{U}/{rui}", json={"is_active": False})
    await admin.patch(f"{U}/{rui}", json={"is_active": True})
    await admin.post(f"{U}/invitations", json={"email": "nova@x.pt"})

    everything = (await admin.get(f"{U}/audit")).json()
    assert everything["total"] == 3 and [e["action"] for e in everything["items"]] == [
        "invitation.create", "user.activate", "user.deactivate",
    ]  # fmt: skip
    first = everything["items"][0]
    assert first["actor_email"] == "boss@x.pt" and first["effective_actor_email"] == "boss@x.pt"
    assert first["ip"] and first["target_type"] == "invitation"
    assert (await admin.get(f"{U}/audit", params={"action": "user."})).json()["total"] == 2
    assert (await admin.get(f"{U}/audit", params={"action": "user.activate"})).json()["total"] == 1
    assert (await admin.get(f"{U}/audit", params={"target_id": rui})).json()["total"] == 2
    assert (await admin.get(f"{U}/audit", params={"actor_id": uid_random()})).json()["total"] == 0
    future = (datetime.now(UTC) + timedelta(days=1)).isoformat()
    assert (await admin.get(f"{U}/audit", params={"date_from": future})).json()["total"] == 0
    page = (await admin.get(f"{U}/audit", params={"limit": 2, "offset": 2})).json()
    assert len(page["items"]) == 1 and page["total"] == 3
    assert (await admin.get(f"{U}/audit", params={"limit": 500})).status_code == 422
    assert (await logged_in.get(f"{U}/audit")).status_code == 403


def test_sanitize_drops_secrets_and_clamps() -> None:
    clean = audit_service.sanitize(
        {
            "reason": "x" * 1000,
            "token": "abc",
            "nested": {"Password": "p", "ok": 1, "list": [{"api_key": "k", "v": 2}]},
            "refresh_token_hash": "h",
            "Authorization": "Bearer x",
        }
    )
    assert clean == {"reason": "x" * 300, "nested": {"ok": 1, "list": [{"v": 2}]}}
