"""Pontos: o livro-razão imutável visto pela API (costura principal: pedido/resposta + estado na base).

Cadeia real: saco ativado pelo doador → scan na paragem cria a unidade → PESO medido credita o flat
(+100, idempotente: o mesmo saco nunca ganha duas vezes); a triagem que confirma a declaração credita
o bónus (+50, uma única vez por saco, nada quando contradiz); saldo e histórico saem do livro-razão;
anulação em abuso é entrada negativa com motivo (nunca apaga). O lote e o passaporte nunca mostram o
doador — o teste vizinho do passaporte mantém-se.
"""

import re
import uuid
from datetime import UTC, datetime

import httpx
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.features.points.models import PointEntry
from novelo.features.users.models import User
from tests.conftest import OutboxSender

AUTH = "/api/v1/auth"
CID = "/api/v1/cidadao"
LOTS = "/api/v1/lots"


async def _token(outbox: OutboxSender) -> str:
    match = re.search(r"token=([\w-]+)", outbox.sent[-1]["text"])
    assert match
    return match.group(1)


async def _donor_with_bag(
    client: httpx.AsyncClient,
    session: AsyncSession,
    outbox: OutboxSender,
    email: str = "doador@exemplo.pt",
    declaration: str | None = "reuse",
) -> tuple[httpx.AsyncClient, dict[str, object]]:
    """Doador pela porta real (magic link) com um saco ativado e declarado."""
    resp = await client.post(f"{AUTH}/donor/sign-up", json={"email": email, "declared_age": 34, "consent": True})
    assert resp.status_code == 204, resp.text
    verified = await client.post(f"{AUTH}/magic-link/verify", json={"token": await _token(outbox)})
    assert verified.status_code == 200, verified.text
    bag = await client.post(f"{CID}/bags", json={"nickname": "Cozinha", "declaration": declaration})
    assert bag.status_code == 201, bag.text
    return client, bag.json()


async def _weigh_bag(
    operator: httpx.AsyncClient, bag_code: str, *, weight_g: int = 2400, items: list[dict[str, object]] | None = None
) -> dict[str, object]:
    """A paragem real: abre lote, scan do saco, peso na balança (e triagem opcional por peça)."""
    resp = await operator.post(f"{LOTS}", json={})
    assert resp.status_code == 201, resp.text
    lot = resp.json()
    unit = await operator.post(f"{LOTS}/{lot['code']}/units", json={"bag_code": bag_code})
    assert unit.status_code == 201, unit.text
    weighed = await operator.put(f"{LOTS}/{lot['code']}/units/{unit.json()['id']}", json={"weight_g": weight_g})
    assert weighed.status_code == 200, weighed.text
    for item in items or []:
        added = await operator.post(f"{LOTS}/{lot['code']}/items", json=item)
        assert added.status_code == 201, added.text
    return lot


async def _entries(session: AsyncSession) -> list[PointEntry]:
    rows = (await session.execute(select(PointEntry).order_by(PointEntry.created_at))).scalars().all()
    return list(rows)


def _item(fine_state: str = "grade_a") -> dict[str, object]:
    """Peça triada mínima: estado fino decide o destino (grade_a → reuse)."""
    return {
        "garment_type": "tshirt",
        "fine_state": fine_state,
        "composition": [{"fibre": "cotton", "pct": 100}],
        "estimated_weight_g": 150,
        "confidence": 0.9,
    }


# --- ganho flat: saco recolhido E pesado -----------------------------------------------------------


async def test_weighing_a_donor_bag_credits_flat_once(
    client: httpx.AsyncClient, session: AsyncSession, outbox: OutboxSender, make_user
) -> None:
    c, bag = await _donor_with_bag(client, session, outbox)
    operator = await make_user("operador@vitrus.pt")
    lot = await _weigh_bag(operator, str(bag["code"]), weight_g=2400)

    saldo = await c.get(f"{CID}/saldo")
    assert saldo.status_code == 200
    data = saldo.json()
    assert data["balance"] == 100  # flat de lançamento (estimativa, configurável)
    assert data["flat"] == 100 and data["bonus"] == 0
    assert data["credited_this_month"] == 100
    assert data["monthly_cap"] == 500  # teto de lançamento (estimativa, configurável)
    assert data["expiring_soon"] == 0

    rows = await _entries(session)
    assert len(rows) == 1
    entry = rows[0]
    assert entry.kind == "gain_flat" and entry.amount == 100
    assert entry.bag_code == bag["code"] and entry.lot_code == lot["code"]
    assert entry.user_id is not None
    assert entry.expires_at is not None  # 12 meses à frente (FIFO no saldo)


async def test_reweighing_never_credits_twice(
    client: httpx.AsyncClient, session: AsyncSession, outbox: OutboxSender, make_user
) -> None:
    """Correção de peso na paragem (o prato anula-se): o ganho é único por saco — idempotente."""
    c, bag = await _donor_with_bag(client, session, outbox)
    operator = await make_user("operador@vitrus.pt")
    lot = await _weigh_bag(operator, str(bag["code"]), weight_g=2400)
    units = (await operator.get(f"{LOTS}/{lot['code']}")).json()["unit_list"]
    again = await operator.put(f"{LOTS}/{lot['code']}/units/{units[0]['id']}", json={"weight_g": 2500})
    assert again.status_code == 200

    assert len(await _entries(session)) == 1  # segunda pesagem não cria linha
    saldo = await c.get(f"{CID}/saldo")
    assert saldo.json()["balance"] == 100


async def test_label_units_and_unowned_bags_never_credit(
    client: httpx.AsyncClient, session: AsyncSession, outbox: OutboxSender, make_user
) -> None:
    """Etiqueta impressa (sem saco da plataforma) não tem doador: nunca credita nada."""
    operator = await make_user("operador@vitrus.pt")
    resp = await operator.post(f"{LOTS}", json={})
    lot = resp.json()
    unit = await operator.post(f"{LOTS}/{lot['code']}/units", json={})
    assert unit.status_code == 201  # etiqueta: o servidor gera o UUID
    weighed = await operator.put(f"{LOTS}/{lot['code']}/units/{unit.json()['id']}", json={"weight_g": 3000})
    assert weighed.status_code == 200
    assert await _entries(session) == []


# --- bónus de conformidade: a triagem confirma a declaração -----------------------------------------


async def test_confirmed_declaration_credits_bonus_once(
    client: httpx.AsyncClient, session: AsyncSession, outbox: OutboxSender, make_user
) -> None:
    """Declarou «reuse», a triagem confirma (maioria reutilizável): +50 uma única vez, mais peças não
    o duplicam. Flat e bónus no mesmo livro-razão, cada um com a sua linha."""
    c, bag = await _donor_with_bag(client, session, outbox, declaration="reuse")
    operator = await make_user("operador@vitrus.pt")
    await _weigh_bag(
        operator,
        str(bag["code"]),
        items=[_item("grade_a"), _item("grade_b")],  # reuse, reuse: confirma «reuse»
    )
    # Peça seguinte do mesmo lote: o bónus já entrou — nunca duplica.
    lot_code = (await session.execute(select(PointEntry.lot_code).limit(1))).scalar_one()
    extra = await operator.post(f"{LOTS}/{lot_code}/items", json=_item("grade_c"))
    assert extra.status_code == 201

    rows = await _entries(session)
    assert [(r.kind, r.amount) for r in rows] == [("gain_flat", 100), ("gain_bonus", 50)]
    saldo = await c.get(f"{CID}/saldo")
    data = saldo.json()
    assert data["balance"] == 150 and data["flat"] == 100 and data["bonus"] == 50
    assert data["credited_this_month"] == 150  # o teto conta flat e bónus juntos


async def test_contradicted_declaration_credits_nothing(
    client: httpx.AsyncClient, session: AsyncSession, outbox: OutboxSender, make_user
) -> None:
    """Declarou «reuse», a triagem diz reciclar a dominar: nada — e sem penalização no MVP."""
    c, bag = await _donor_with_bag(client, session, outbox, declaration="reuse")
    operator = await make_user("operador@vitrus.pt")
    await _weigh_bag(operator, str(bag["code"]), items=[_item("recycle"), _item("recycle"), _item("grade_a")])
    rows = await _entries(session)
    assert [r.kind for r in rows] == ["gain_flat"]  # só o flat; o bónus nunca entrou
    saldo = await c.get(f"{CID}/saldo")
    assert saldo.json()["balance"] == 100


async def test_undeclared_bag_never_earns_bonus(
    client: httpx.AsyncClient, session: AsyncSession, outbox: OutboxSender, make_user
) -> None:
    """Sem declaração não há bónus que valha — mesmo com triagem toda reutilizável."""
    _, bag = await _donor_with_bag(client, session, outbox, declaration=None)
    operator = await make_user("operador@vitrus.pt")
    await _weigh_bag(operator, str(bag["code"]), items=[_item("grade_a"), _item("grade_b")])
    assert [r.kind for r in await _entries(session)] == ["gain_flat"]


# --- teto mensal ------------------------------------------------------------------------------------


async def test_monthly_cap_refuses_overflow(
    client: httpx.AsyncClient, session: AsyncSession, outbox: OutboxSender, make_user, monkeypatch
) -> None:
    """Teto de lançamento 500 (estimativa): 6 sacos diferentes do mesmo doador, um por lote — os
    primeiros 5 enchem o teto (500) e o 6.º é RECUSADO (não adiado): sem linha, saldo fica em 500."""
    from novelo.core.config import get_settings  # noqa: PLC0415  (import tardio: só o teste o faz variar)

    monkeypatch.setattr(get_settings(), "points_monthly_cap", 500)
    c, bag = await _donor_with_bag(client, session, outbox, declaration=None)
    operator = await make_user("operador@vitrus.pt")
    codes = [str(bag["code"])] + [str((await c.post(f"{CID}/bags", json={})).json()["code"]) for _ in range(5)]
    assert len(codes) == 6
    for code in codes:
        await _weigh_bag(operator, code)
    rows = await _entries(session)
    assert len(rows) == 5  # o 6.º nunca entra no livro-razão
    saldo = await c.get(f"{CID}/saldo")
    data = saldo.json()
    assert data["balance"] == 500 and data["credited_this_month"] == 500 and data["monthly_cap"] == 500


# --- saldo, histórico e anulação ---------------------------------------------------------------------


async def test_saldo_requires_donor_role(make_user) -> None:
    operator = await make_user("operador@vitrus.pt")
    resp = await operator.get(f"{CID}/saldo")
    assert resp.status_code == 403
    history = await operator.get(f"{CID}/pontos")
    assert history.status_code == 403


async def test_annulment_is_team_only_with_reason(
    client: httpx.AsyncClient, session: AsyncSession, outbox: OutboxSender, make_user
) -> None:
    """Anular é de equipa (admin/operator), com motivo obrigatório; o doador nunca se anula a si mesmo;
    a entrada é NEGATIVA com autor e motivo — o livro-razão fica completo."""
    c, bag = await _donor_with_bag(client, session, outbox)
    operator = await make_user("operador@vitrus.pt")
    await _weigh_bag(operator, str(bag["code"]))

    donor_id = (await c.get(f"{CID}/account")).json()["id"]
    # O doador não anula (nem o outro doador): portão de equipa.
    forwho = await c.post(
        "/api/v1/admin/points/annulments", json={"user_id": donor_id, "amount": 50, "reason": "testes"}
    )
    assert forwho.status_code == 403
    # Motivo curto demais é recusa explícita (422, validação do contrato).
    short = await operator.post(
        "/api/v1/admin/points/annulments", json={"user_id": donor_id, "amount": 50, "reason": "x"}
    )
    assert short.status_code == 422
    # Anulação legítima: 100 dos 100 → saldo 0, com linha negativa e motivo.
    resp = await operator.post(
        "/api/v1/admin/points/annulments",
        json={"user_id": donor_id, "amount": 100, "reason": "Abuso: sacos de uma só casa em série"},
    )
    assert resp.status_code == 201, resp.text
    entry = resp.json()
    assert entry["amount"] == -100 and entry["kind"] == "annulment"
    assert entry["reason"] == "Abuso: sacos de uma só casa em série"
    saldo = await c.get(f"{CID}/saldo")
    assert saldo.json()["balance"] == 0
    # Anular mais do que existe não fica negativo (FIFO consome até ao que há).
    more = await operator.post(
        "/api/v1/admin/points/annulments", json={"user_id": donor_id, "amount": 500, "reason": "Revisão do caso"}
    )
    assert more.status_code == 201
    saldo = await c.get(f"{CID}/saldo")
    assert saldo.json()["balance"] == 0
    # O histórico mostra a verdade completa: ganho e duas anulações, o mais recente primeiro.
    pontos = await c.get(f"{CID}/pontos")
    kinds = [row["kind"] for row in pontos.json()["items"]]
    assert kinds == ["annulment", "annulment", "gain_flat"]
    assert pontos.json()["total"] == 3
    # Utilizador inexistente: 404 no formato da casa.
    ghost = await operator.post(
        "/api/v1/admin/points/annulments", json={"user_id": str(uuid.uuid4()), "amount": 10, "reason": "ninguém"}
    )
    assert ghost.status_code == 404


async def test_points_history_is_paginated(
    client: httpx.AsyncClient, session: AsyncSession, outbox: OutboxSender, make_user
) -> None:
    c, bag = await _donor_with_bag(client, session, outbox, declaration=None)
    operator = await make_user("operador@vitrus.pt")
    codes = [str(bag["code"])] + [str((await c.post(f"{CID}/bags", json={})).json()["code"]) for _ in range(2)]
    for code in codes:  # três sacos, três ganhos (um por lote)
        await _weigh_bag(operator, code)
    page = await c.get(f"{CID}/pontos", params={"limit": 2, "offset": 0})
    assert page.status_code == 200
    assert len(page.json()["items"]) == 2 and page.json()["total"] == 3
    rest = await c.get(f"{CID}/pontos", params={"limit": 2, "offset": 2})
    assert len(rest.json()["items"]) == 1
    assert {row["bag_code"] for row in page.json()["items"] + rest.json()["items"]} == set(codes)


async def test_ledger_rejects_duplicate_flat_at_database_level(
    client: httpx.AsyncClient, session: AsyncSession, outbox: OutboxSender, make_user
) -> None:
    """A última linha de defesa é da base: mesmo um INSERT direto (sem o ON CONFLICT do serviço) não
    consegue ganho flat duplicado para o mesmo saco — o índice único parcial recusa."""
    _, bag = await _donor_with_bag(client, session, outbox)
    operator = await make_user("operador@vitrus.pt")
    await _weigh_bag(operator, str(bag["code"]))
    session.add(
        PointEntry(
            user_id=None,
            kind="gain_flat",
            amount=100,
            bag_code=str(bag["code"]),
            expires_at=datetime.now(UTC),
        )
    )
    try:
        await session.flush()
        raise AssertionError("the duplicate flat should have been rejected")
    except IntegrityError:
        await session.rollback()


async def test_ledger_survives_account_deletion(
    client: httpx.AsyncClient, session: AsyncSession, outbox: OutboxSender, make_user
) -> None:
    """Apagar a conta perde o crédito (`user_id` SET NULL) mas o livro-razão sobrevive para os
    agregados — as linhas órfãs não incomodam as leituras dos outros."""
    c, bag = await _donor_with_bag(client, session, outbox, email="efemero@exemplo.pt")
    operator = await make_user("operador@vitrus.pt")
    await _weigh_bag(operator, str(bag["code"]))
    donor_id = (await c.get(f"{CID}/account")).json()["id"]
    # A eliminação da conta é do #66; aqui prova-se o contrato do livro-razão: SET NULL tolerado.
    await session.execute(update(User).where(User.id == donor_id).values(is_active=False))
    await session.execute(update(PointEntry).where(PointEntry.user_id == donor_id).values(user_id=None))
    await session.commit()
    rows = await _entries(session)
    assert rows and rows[0].user_id is None  # órfã, mas presente (agregados)
    saldo = await c.get(f"{CID}/saldo")
    assert saldo.status_code == 401  # conta desativada: sem sessão, sem saldo
    other, other_bag = await _donor_with_bag(client, session, outbox, email="outro@exemplo.pt")
    await _weigh_bag(operator, str(other_bag["code"]))
    theirs = await other.get(f"{CID}/saldo")
    assert theirs.status_code == 200 and theirs.json()["balance"] == 100  # os vivos leem o seu saldo
    # O passaporte público do lote nunca mostrou o doador (disciplina vizinha, reprovada aqui também).
    lot_code = rows[0].lot_code
    passport = await client.get(f"/api/v1/public/lots/{lot_code}")
    assert passport.status_code == 200
    assert "efemero@exemplo.pt" not in str(passport.json())
