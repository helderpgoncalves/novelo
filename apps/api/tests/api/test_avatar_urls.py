"""Avatares nas listas de administração: só https, sem N+1 e só para administradores."""

from collections.abc import Callable
from datetime import UTC, datetime
from typing import Any

import httpx
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.core.avatar import safe_avatar_url
from novelo.features.audit import service as audit_service
from novelo.features.email_log.models import EmailDelivery
from novelo.features.users import service as user_service
from novelo.features.users.models import User
from tests.conftest import PASSWORD
from tests.querycount import capture_sql

U = "/api/v1/users"
AUTH = "/api/v1/auth"
Maker = Callable[..., Any]
GOOGLE = "https://lh3.googleusercontent.com/a/abc=s96-c"


async def _account(session: AsyncSession, email: str, *, avatar: str | None, name: str | None = None) -> User:
    return await user_service.create_user(
        session, email=email, password=PASSWORD, role="operator", email_verified=True, name=name, avatar_url=avatar
    )


async def _count(session: AsyncSession, client: httpx.AsyncClient, path: str) -> tuple[Any, int]:
    with capture_sql(session) as sql:
        resp = await client.get(path)
    assert resp.status_code == 200, resp.text
    return resp.json(), len(sql)


def test_safe_avatar_url_only_allows_https() -> None:
    assert safe_avatar_url(GOOGLE) == GOOGLE
    for bad in (
        None,
        "",
        "http://x.pt/a.png",
        "javascript:alert(1)",
        "data:image/png;base64,AA",
        "https://",
        "//x.pt/a",
    ):
        assert safe_avatar_url(bad) is None, bad


async def test_user_admin_list_returns_avatar_and_hides_non_https(make_user: Maker, session: AsyncSession) -> None:
    admin = await make_user("boss@x.pt", "admin")
    await _account(session, "g@x.pt", avatar=GOOGLE)
    await _account(session, "h@x.pt", avatar="http://insecure.example/a.png")
    await _account(session, "n@x.pt", avatar=None)
    await session.commit()
    body = (await admin.get(U)).json()
    by_email = {u["email"]: u["avatar_url"] for u in body}
    assert by_email == {"boss@x.pt": None, "g@x.pt": GOOGLE, "h@x.pt": None, "n@x.pt": None}


async def test_user_admin_actions_return_avatar(make_user: Maker, session: AsyncSession) -> None:
    admin = await make_user("boss@x.pt", "admin")
    target = await _account(session, "g@x.pt", avatar=GOOGLE)
    await session.commit()
    resp = await admin.patch(f"{U}/{target.id}", json={"is_active": False})
    assert resp.status_code == 200 and resp.json()["avatar_url"] == GOOGLE


async def test_user_admin_list_has_constant_query_count(make_user: Maker, session: AsyncSession) -> None:
    admin = await make_user("boss@x.pt", "admin")
    await _account(session, "a1@x.pt", avatar=GOOGLE)
    await session.commit()
    _, few = await _count(session, admin, U)
    for i in range(5):
        await _account(session, f"b{i}@x.pt", avatar=GOOGLE)
    await session.commit()
    body, many = await _count(session, admin, U)
    assert len(body) == 7 and many == few


async def test_guest_list_avatar_constant_queries_and_admin_only(
    client: httpx.AsyncClient, make_user: Maker, session: AsyncSession
) -> None:
    admin = await make_user("boss@x.pt", "admin")
    guest = await _account(session, "g0@x.pt", avatar=GOOGLE)
    await session.execute(update(User).where(User.id == guest.id).values(joined_via="quick_join"))
    await session.commit()
    page, few = await _count(session, admin, f"{AUTH}/quick-join/guests")
    assert page["items"][0]["avatar_url"] == GOOGLE
    for i in range(4):
        other = await _account(session, f"g{i + 1}@x.pt", avatar="http://x.pt/a.png" if i == 0 else GOOGLE)
        await session.execute(update(User).where(User.id == other.id).values(joined_via="quick_join"))
    await session.commit()
    page, many = await _count(session, admin, f"{AUTH}/quick-join/guests")
    assert page["total"] == 5 and many == few
    assert sorted(i["avatar_url"] or "" for i in page["items"]).count("") == 1  # o http não sai
    operator = await make_user("op@x.pt", "operator")
    assert (await operator.get(f"{AUTH}/quick-join/guests")).status_code == 403
    assert (await client.get(f"{AUTH}/quick-join/guests")).status_code == 401


async def test_audit_entries_carry_actor_and_target_avatars_without_n_plus_1(
    make_user: Maker, session: AsyncSession
) -> None:
    admin = await make_user("boss@x.pt", "admin")
    boss = await _account_by_email(session, "boss@x.pt")
    boss.avatar_url = GOOGLE
    target = await _account(session, "rui@x.pt", avatar=GOOGLE)
    gone = await _account(session, "plain@x.pt", avatar="http://x.pt/a.png")
    await session.commit()
    await audit_service.record(
        session, "user.role_change", actor_id=boss.id, target_type="user", target_id=target.id, target_label="rui@x.pt"
    )
    await audit_service.record(
        session, "invitation.create", actor_id=boss.id, target_type="invitation", target_id=target.id
    )
    await audit_service.record(
        session, "user.role_change", actor_id=None, target_type="user", target_id="not-a-uuid", target_label=None
    )
    await session.commit()
    body, few = await _count(session, admin, f"{U}/audit")
    rows = {(e["action"], e["target_type"], e["target_id"]): e for e in body["items"]}
    user_row = rows[("user.role_change", "user", str(target.id))]
    assert user_row["actor_avatar_url"] == GOOGLE and user_row["target_avatar_url"] == GOOGLE
    assert rows[("invitation.create", "invitation", str(target.id))]["target_avatar_url"] is None  # não é uma conta
    assert rows[("user.role_change", "user", "not-a-uuid")]["actor_avatar_url"] is None
    for i in range(6):
        other = await _account(session, f"x{i}@x.pt", avatar=GOOGLE)
        await session.commit()
        await audit_service.record(
            session, "user.role_change", actor_id=other.id, target_type="user", target_id=other.id
        )
    await audit_service.record(session, "user.role_change", actor_id=boss.id, target_type="user", target_id=gone.id)
    await session.commit()
    body, many = await _count(session, admin, f"{U}/audit")
    assert body["total"] == 10 and many == few
    gone_row = next(e for e in body["items"] if e["target_id"] == str(gone.id))
    assert gone_row["target_avatar_url"] is None  # valor não-https guardado


async def _account_by_email(session: AsyncSession, email: str) -> User:
    return await user_service.get_by_email(session, email)  # type: ignore[return-value]


async def test_audit_is_admin_only(client: httpx.AsyncClient, make_user: Maker) -> None:
    operator = await make_user("op@x.pt", "operator")
    assert (await operator.get(f"{U}/audit")).status_code == 403
    assert (await client.get(f"{U}/audit")).status_code == 401


async def test_invitations_expose_inviter_email_and_avatar_in_one_query(
    make_user: Maker, session: AsyncSession
) -> None:
    admin = await make_user("boss@x.pt", "admin")
    boss = await _account_by_email(session, "boss@x.pt")
    boss.avatar_url = GOOGLE
    await session.commit()
    created = await admin.post(f"{U}/invitations", json={"email": "a@x.pt"})
    assert created.status_code == 201
    assert created.json()["invited_by_email"] == "boss@x.pt" and created.json()["invited_by_avatar_url"] == GOOGLE
    page, few = await _count(session, admin, f"{U}/invitations")
    assert page["items"][0]["invited_by_avatar_url"] == GOOGLE
    for i in range(5):
        assert (await admin.post(f"{U}/invitations", json={"email": f"b{i}@x.pt"})).status_code == 201
    page, many = await _count(session, admin, f"{U}/invitations")
    assert page["total"] == 6 and many == few
    boss.avatar_url = "http://x.pt/a.png"
    await session.commit()
    again = (await admin.get(f"{U}/invitations")).json()
    assert again["items"][0]["invited_by_avatar_url"] is None and again["items"][0]["invited_by_email"] == "boss@x.pt"
    operator = await make_user("op@x.pt", "operator")
    assert (await operator.get(f"{U}/invitations")).status_code == 403


async def test_email_deliveries_carry_recipient_name_in_one_lookup(make_user: Maker, session: AsyncSession) -> None:
    admin = await make_user("boss@x.pt", "admin")
    await _account(session, "ana@x.pt", avatar=None, name="Ana Silva")
    now = datetime.now(UTC)

    def row(to: str) -> EmailDelivery:
        return EmailDelivery(
            to_email=to, template="magic_link", status="sent", attempts=1, created_at=now, updated_at=now, sent_at=now
        )

    session.add_all([row("ana@x.pt"), row("ninguem@x.pt")])
    await session.commit()
    page, few = await _count(session, admin, f"{U}/emails")
    names = {i["to_email"]: i["to_name"] for i in page["items"]}
    assert names["ana@x.pt"] == "Ana Silva" and names["ninguem@x.pt"] is None
    session.add_all([row(f"u{i}@x.pt") for i in range(8)])
    await session.commit()
    page, many = await _count(session, admin, f"{U}/emails")
    assert page["total"] >= 10 and many == few
    one = await admin.get(f"{U}/emails/{page['items'][0]['id']}")
    assert one.status_code == 200 and "to_name" in one.json()
    operator = await make_user("op@x.pt", "operator")
    assert (await operator.get(f"{U}/emails")).status_code == 403
