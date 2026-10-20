import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.features.users import service
from tests.conftest import PASSWORD

AUTH = "/api/v1/auth"


async def _admin(client: httpx.AsyncClient, session: AsyncSession) -> None:
    await service.create_user(session, email="admin@x.pt", password=PASSWORD, role="admin", email_verified=True)
    resp = await client.post(f"{AUTH}/login", json={"email": "admin@x.pt", "password": PASSWORD})
    assert resp.status_code == 200


async def test_operator_cannot_list_users(logged_in: httpx.AsyncClient) -> None:
    resp = await logged_in.get("/api/v1/users")
    assert resp.status_code == 403 and resp.json()["code"] == "forbidden"


async def test_admin_lists_and_updates_users(client: httpx.AsyncClient, session: AsyncSession) -> None:
    other = await service.create_user(session, email="rui@x.pt", password=PASSWORD)
    await _admin(client, session)
    emails = [u["email"] for u in (await client.get("/api/v1/users")).json()]
    assert {"admin@x.pt", "rui@x.pt"} <= set(emails)

    promoted = await client.patch(f"/api/v1/users/{other.id}", json={"role": "admin", "confirm_admin": True})
    assert promoted.json()["role"] == "admin"
    deactivated = await client.patch(f"/api/v1/users/{other.id}", json={"is_active": False})
    assert deactivated.json()["is_active"] is False


async def test_admin_cannot_change_own_account(client: httpx.AsyncClient, session: AsyncSession) -> None:
    await _admin(client, session)
    me = (await client.get(f"{AUTH}/me")).json()
    resp = await client.patch(f"/api/v1/users/{me['id']}", json={"is_active": False})
    assert resp.status_code == 409


async def test_onboarding_state_is_per_account_and_idempotent(logged_in: httpx.AsyncClient) -> None:
    me = (await logged_in.get(f"{AUTH}/me")).json()
    assert me["onboarding"] == {"tour_seen_at": None, "checklist_done": [], "checklist_dismissed": False}

    first = await logged_in.put(f"{AUTH}/me/onboarding", json={"tour": "seen", "mark": "map"})
    assert first.status_code == 200
    seen_at = first.json()["tour_seen_at"]
    assert seen_at and first.json()["checklist_done"] == ["map"]

    again = await logged_in.put(
        f"{AUTH}/me/onboarding", json={"tour": "seen", "mark": "map", "checklist_dismissed": True}
    )
    assert again.json()["tour_seen_at"] == seen_at and again.json()["checklist_done"] == ["map"]
    assert again.json()["checklist_dismissed"] is True

    reset = await logged_in.put(f"{AUTH}/me/onboarding", json={"tour": "reset"})
    assert reset.json()["tour_seen_at"] is None
    assert (await logged_in.put(f"{AUTH}/me/onboarding", json={"mark": "nope"})).status_code == 422
