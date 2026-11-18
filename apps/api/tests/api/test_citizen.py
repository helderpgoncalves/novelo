"""A área do cidadão (doador): conta por magic link com 13+, sacos ativados e histórico.

Costura principal: comportamento pela API (pedido/resposta + estado na base). A conta de doador nasce
por email sem password (a recusa de menores de 13 é explícita, nunca silenciosa); os sacos são do
próprio (nunca se vê os do outro); o histórico liga cada saco ao lote que o levou — via `lot_units.code`
— para o passaporte público, sem nunca expor o doador.
"""

import re
import uuid
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.domain.bags import MAX_ACTIVE_BAGS
from novelo.domain.vocab import ScenarioObjective, ScenarioStatus
from novelo.features.network.models import Parish
from novelo.features.planning.models import Scenario
from novelo.features.users import service as users
from novelo.features.users.models import User
from tests.conftest import PASSWORD, OutboxSender

AUTH = "/api/v1/auth"
CID = "/api/v1/cidadao"


async def _token(outbox: OutboxSender) -> str:
    match = re.search(r"token=([\w-]+)", outbox.sent[-1]["text"])
    assert match
    return match.group(1)


async def _sign_up_donor(
    client: httpx.AsyncClient,
    session: AsyncSession,
    outbox: OutboxSender,
    email: str = "doador@exemplo.pt",
    declared_age: int = 34,
) -> httpx.AsyncClient:
    """Cria um doador pela porta de entrada real (magic link) e devolve o cliente com a sessão dele."""
    resp = await client.post(
        f"{AUTH}/donor/sign-up", json={"email": email, "declared_age": declared_age, "consent": True}
    )
    assert resp.status_code == 204, resp.text
    verified = await client.post(f"{AUTH}/magic-link/verify", json={"token": await _token(outbox)})
    assert verified.status_code == 200, verified.text
    return client


# --- conta de doador: magic link, 13+, recusa de menores ------------------------------------------


async def test_signup_refuses_under_13(client: httpx.AsyncClient, outbox: OutboxSender) -> None:
    for age in (12, 5, 0):
        resp = await client.post(
            f"{AUTH}/donor/sign-up", json={"email": "pequeno@exemplo.pt", "declared_age": age, "consent": True}
        )
        assert resp.status_code == 422, (age, resp.text)
        assert resp.json()["code"] == "age_below_minimum"
    assert outbox.sent == []  # a recusa é explícita e nunca envia email


async def test_signup_requires_consent(client: httpx.AsyncClient, outbox: OutboxSender) -> None:
    resp = await client.post(
        f"{AUTH}/donor/sign-up", json={"email": "doador@exemplo.pt", "declared_age": 30, "consent": False}
    )
    assert resp.status_code == 422  # Literal[True]: o consentimento tem de ser explícito
    assert outbox.sent == []


async def test_signup_creates_donor_account(
    client: httpx.AsyncClient, session: AsyncSession, outbox: OutboxSender
) -> None:
    resp = await client.post(
        f"{AUTH}/donor/sign-up", json={"email": "Doador@Exemplo.pt", "declared_age": 34, "consent": True}
    )
    assert resp.status_code == 204
    user = (await session.execute(select(User).where(User.email == "doador@exemplo.pt"))).scalar_one()
    assert user.role == "donor"
    assert user.declared_age == 34
    assert user.donor_code and user.donor_code.startswith("NVA-")
    assert user.approval_status == "approved"  # conta leve: sem espera de aprovação
    assert user.hashed_password is None  # sem password: só magic link
    # O email de entrada aponta para a área do cidadão.
    verified = await client.post(f"{AUTH}/magic-link/verify", json={"token": await _token(outbox)})
    body = verified.json()
    assert body["user"]["role"] == "donor" and body["next"] == "/cidadao"

    me = await client.get(f"{AUTH}/me")
    assert me.status_code == 200

    account = await client.get(f"{CID}/account")
    assert account.status_code == 200
    data = account.json()
    assert data["email"] == "doador@exemplo.pt"
    assert data["donor_code"] == user.donor_code
    assert data["declared_age"] == 34


async def test_signup_with_existing_email_sends_entry_link_without_revealing(
    client: httpx.AsyncClient, session: AsyncSession, outbox: OutboxSender
) -> None:
    await users.create_user(session, email="ana@vitrus.pt", password=PASSWORD)
    before = (await session.execute(select(User))).scalars().all()
    resp = await client.post(
        f"{AUTH}/donor/sign-up", json={"email": "ana@vitrus.pt", "declared_age": 41, "consent": True}
    )
    assert resp.status_code == 204
    after = (await session.execute(select(User))).scalars().all()
    assert len(after) == len(before)  # nenhuma conta nova
    assert outbox.sent and outbox.sent[-1]["to"] == "ana@vitrus.pt"


async def test_signup_honeypot_sends_nothing(
    client: httpx.AsyncClient, session: AsyncSession, outbox: OutboxSender
) -> None:
    resp = await client.post(
        f"{AUTH}/donor/sign-up",
        json={"email": "bot@exemplo.pt", "declared_age": 30, "consent": True, "website": "spam.pt"},
    )
    assert resp.status_code == 204
    assert outbox.sent == []
    users = (await session.execute(select(User).where(User.email == "bot@exemplo.pt"))).scalars().all()
    assert users == []


async def test_donor_account_requires_donor_role(logged_in: httpx.AsyncClient) -> None:
    resp = await logged_in.get(f"{CID}/account")
    assert resp.status_code == 403


# --- os meus sacos: ativar, apelido privado, declaração, desativar --------------------------------


async def _create_bag(
    c: httpx.AsyncClient, nickname: str | None = None, declaration: str | None = "reuse"
) -> httpx.Response:
    body: dict[str, object] = {}
    if nickname is not None:
        body["nickname"] = nickname
    if declaration is not None:
        body["declaration"] = declaration
    return await c.post(f"{CID}/bags", json=body)


async def test_activate_bag_with_nickname_and_declaration(
    client: httpx.AsyncClient, session: AsyncSession, outbox: OutboxSender
) -> None:
    c = await _sign_up_donor(client, session, outbox)
    resp = await _create_bag(c, nickname="Saco da cozinha", declaration="reuse")
    assert resp.status_code == 201, resp.text
    bag = resp.json()
    assert bag["code"].startswith("NVL-")
    assert bag["nickname"] == "Saco da cozinha"
    assert bag["declaration"] == "reuse"
    assert bag["active"] is True

    listing = await c.get(f"{CID}/bags")
    assert [b["code"] for b in listing.json()] == [bag["code"]]


async def test_bag_declaration_is_validated(
    client: httpx.AsyncClient, session: AsyncSession, outbox: OutboxSender
) -> None:
    c = await _sign_up_donor(client, session, outbox)
    bad = await _create_bag(c, declaration="reject")  # «rejeitar» não é declaração de saco
    assert bad.status_code == 422
    ok = await _create_bag(c, declaration="recycle")
    assert ok.status_code == 201 and ok.json()["declaration"] == "recycle"


async def test_bags_are_private_to_the_owner(
    client: httpx.AsyncClient, session: AsyncSession, outbox: OutboxSender, make_user
) -> None:
    c1 = await _sign_up_donor(client, session, outbox, email="um@exemplo.pt")
    await _create_bag(c1, nickname="Meu")
    other = await make_user("outro@exemplo.pt", role="donor")
    resp = await other.get(f"{CID}/bags")
    assert resp.status_code == 200 and resp.json() == []  # só os próprios


async def test_update_bag_nickname_and_declaration(
    client: httpx.AsyncClient, session: AsyncSession, outbox: OutboxSender
) -> None:
    c = await _sign_up_donor(client, session, outbox)
    bag = (await _create_bag(c)).json()
    resp = await c.patch(f"{CID}/bags/{bag['id']}", json={"nickname": "Roupa boa", "declaration": "recycle"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["nickname"] == "Roupa boa" and data["declaration"] == "recycle"


async def test_deactivate_and_reactivate_bag(
    client: httpx.AsyncClient, session: AsyncSession, outbox: OutboxSender
) -> None:
    c = await _sign_up_donor(client, session, outbox)
    bag = (await _create_bag(c)).json()
    off = await c.post(f"{CID}/bags/{bag['id']}/deactivate")
    assert off.status_code == 200 and off.json()["active"] is False
    # Desativado congela: sem edições (o saco saiu do sistema).
    edit = await c.patch(f"{CID}/bags/{bag['id']}", json={"nickname": "x"})
    assert edit.status_code == 409
    assert edit.json()["code"] == "bag_inactive"
    # Desativar outra vez não rebenta (idempotente); reativar volta a deixar editar.
    again = await c.post(f"{CID}/bags/{bag['id']}/deactivate")
    assert again.status_code == 200
    on = await c.post(f"{CID}/bags/{bag['id']}/activate")
    assert on.status_code == 200 and on.json()["active"] is True


async def test_active_bag_limit(client: httpx.AsyncClient, session: AsyncSession, outbox: OutboxSender) -> None:
    c = await _sign_up_donor(client, session, outbox)
    for _ in range(MAX_ACTIVE_BAGS):
        assert (await _create_bag(c, declaration=None)).status_code == 201
    over = await _create_bag(c, declaration=None)
    assert over.status_code == 409
    assert over.json()["code"] == "bag_limit_reached"


async def test_bag_qr_and_account_qr(client: httpx.AsyncClient, session: AsyncSession, outbox: OutboxSender) -> None:
    c = await _sign_up_donor(client, session, outbox)
    bag = (await _create_bag(c)).json()
    qr = await c.get(f"{CID}/bags/{bag['id']}/qr")
    assert qr.status_code == 200
    data = qr.json()
    assert data["code"] == bag["code"] and "<svg" in data["svg"]
    acct = await c.get(f"{CID}/account/qr")
    assert acct.status_code == 200
    assert acct.json()["code"].startswith("NVA-") and "<svg" in acct.json()["svg"]


async def test_bag_of_someone_else_is_not_found(
    client: httpx.AsyncClient, session: AsyncSession, outbox: OutboxSender, make_user
) -> None:
    c1 = await _sign_up_donor(client, session, outbox, email="um@exemplo.pt")
    bag = (await _create_bag(c1)).json()
    other = await make_user("outro@exemplo.pt", role="donor")
    resp = await other.get(f"{CID}/bags/{bag['id']}/qr")
    assert resp.status_code == 404


# --- histórico: sacos ligados ao passaporte do lote -----------------------------------------------


async def _open_lot_with_bag(operator: httpx.AsyncClient, bag_code: str, weight_g: int = 2400) -> str:
    resp = await operator.post("/api/v1/lots", json={})
    assert resp.status_code == 201, resp.text
    lot = resp.json()
    unit = await operator.post(f"/api/v1/lots/{lot['code']}/units", json={"bag_code": bag_code})
    assert unit.status_code == 201, unit.text
    weighed = await operator.put(f"/api/v1/lots/{lot['code']}/units/{unit.json()['id']}", json={"weight_g": weight_g})
    assert weighed.status_code == 200
    return lot["code"]


async def test_history_links_bags_to_lot_passports(
    client: httpx.AsyncClient, session: AsyncSession, outbox: OutboxSender, make_user
) -> None:
    c = await _sign_up_donor(client, session, outbox)
    first = (await _create_bag(c, nickname="Cozinha", declaration="reuse")).json()
    second = (await _create_bag(c, declaration=None)).json()
    operator = await make_user("operador@vitrus.pt")
    lot_a = await _open_lot_with_bag(operator, first["code"], weight_g=2400)

    resp = await c.get(f"{CID}/history")
    assert resp.status_code == 200
    rows = {r["bag_code"]: r for r in resp.json()}
    assert rows[first["code"]]["lot_code"] == lot_a
    assert rows[first["code"]]["weight_kg"] == 2.4
    assert rows[first["code"]]["nickname"] == "Cozinha"
    assert rows[first["code"]]["declaration"] == "reuse"
    assert rows[second["code"]]["lot_code"] is None  # ainda em casa
    # O passaporte público do lote não conhece o doador: o link é só o código.
    passport = await client.get(f"/api/v1/public/lots/{lot_a}")
    assert passport.status_code == 200
    assert "doador@exemplo.pt" not in str(passport.json())


async def test_history_of_other_donor_shows_nothing(
    client: httpx.AsyncClient, session: AsyncSession, outbox: OutboxSender, make_user
) -> None:
    c1 = await _sign_up_donor(client, session, outbox, email="um@exemplo.pt")
    bag = (await _create_bag(c1)).json()
    operator = await make_user("operador@vitrus.pt")
    await _open_lot_with_bag(operator, bag["code"])
    other = await make_user("outro@exemplo.pt", role="donor")
    resp = await other.get(f"{CID}/history")
    assert resp.status_code == 200 and resp.json() == []


# --- agenda pública «onde e quando entrego» -------------------------------------------------------


async def _insert_scenario_with_agenda(
    session: AsyncSession, label: str, agenda: list[dict], *, minutes_ago: int = 0
) -> None:
    session.add(
        Scenario(
            label=label,
            objective=ScenarioObjective.MIN_COST,
            status=ScenarioStatus.COMPUTED,
            solver_status="OPTIMAL",
            params={},
            result={"public_agenda": agenda},
            tonnes_year=Decimal("3000"),
            capex_eur=Decimal("42500"),
            annual_cost_eur=Decimal("60000"),
            coverage_pct=Decimal("80"),
            modes=["on_demand"],
            created_at=datetime.now(UTC) - timedelta(minutes=minutes_ago),
        )
    )
    await session.commit()


async def test_public_agenda_reads_latest_scenario(client: httpx.AsyncClient, session: AsyncSession) -> None:
    empty = await client.get("/api/v1/public/collection-agenda")
    assert empty.status_code == 200
    assert empty.json()["agenda"] is None  # sem cenário publicado: «ainda não há agenda»

    entry = {
        "parish_code": "010101",
        "parish_name": "Azurém",
        "channel": "on_demand",
        "weekday": 2,
        "every_weeks": 1.0,
        "rounds_year": 52.0,
        "frequency": "weekly",
    }
    await _insert_scenario_with_agenda(session, "Velho", [entry], minutes_ago=60)
    await _insert_scenario_with_agenda(session, "Novo sem agenda", [], minutes_ago=40)  # sem public_agenda útil
    entry2 = {**entry, "parish_name": "Creixomil", "weekday": 3}
    await _insert_scenario_with_agenda(session, "Mais novo", [entry2], minutes_ago=5)

    resp = await client.get("/api/v1/public/collection-agenda")
    assert resp.status_code == 200
    data = resp.json()
    assert [e["parish_name"] for e in data["agenda"]] == ["Creixomil"]  # o MAIS RECENTE com agenda
    assert data["scenario_label"] == "Mais novo"
    assert data["updated_at"] is not None


async def test_donor_can_request_collection(
    client: httpx.AsyncClient, session: AsyncSession, outbox: OutboxSender
) -> None:
    """A conta de doador é uma conta normal: escreve nos seus pedidos de recolha (#60)."""
    parish = Parish(dicofre=f"98{uuid.uuid4().hex[:4]}", name="Freguesia de teste", population=100)
    session.add(parish)
    await session.commit()
    c = await _sign_up_donor(client, session, outbox)
    resp = await c.post(
        "/api/v1/collection-requests",
        json={
            "bag_count": 2,
            "requested_date": date.today().isoformat(),
            "address": "Rua das Flores 12, Azurém",
            "parish_code": parish.dicofre,
        },
    )
    assert resp.status_code == 201, resp.text
    assert resp.json()["subject_kind"] == "citizen"
