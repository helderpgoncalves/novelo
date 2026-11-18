"""Catálogo e resgate (#65) pela API: costura principal pedido/resposta + estado na base.

Cadeia real: doador com saldo (saco pesado) → vê o catálogo → resgata → o livro-razão ganha a linha
NEGATIVA `redemption` (FIFO, o saldo nunca fica negativo) e nasce um CÓDIGO pseudónimo `RDM-…` — a
única coisa que o parceiro vê (ADR «resgate por código pseudónimo»). A validação marca usado UMA vez;
o teto de donativos IPSS é indexado ao custo evitado (105,64 €/t × kg MEDIDOS na balança).
"""

import re
import uuid
from datetime import UTC, datetime, timedelta

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.features.audit.models import AuditLog
from novelo.features.catalog.models import Redemption
from novelo.features.points.models import PointEntry

AUTH = "/api/v1/auth"
CID = "/api/v1/cidadao"
ADMIN = "/api/v1/admin/catalog"
LOTS = "/api/v1/lots"

CODE_RE = re.compile(r"^RDM-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$")


async def _donor_with_weighed_bags(
    client: httpx.AsyncClient,
    session: AsyncSession,
    outbox,
    make_user,
    email: str = "doador@exemplo.pt",
    bags: int = 1,
    weight_g: int = 2400,
) -> tuple[httpx.AsyncClient, dict[str, object]]:
    """Doador pela porta real com N sacos pesados num único lote (saldo = 100×N, até ao teto de 500)."""
    resp = await client.post(f"{AUTH}/donor/sign-up", json={"email": email, "declared_age": 34, "consent": True})
    assert resp.status_code == 204, resp.text
    await client.post(f"{AUTH}/magic-link/verify", json={"token": _magic_token(outbox)})
    operator = await make_user(f"operador+{email}")
    lot = await operator.post(f"{LOTS}", json={})
    assert lot.status_code == 201, lot.text
    lot_code = lot.json()["code"]
    for n in range(bags):
        bag = await client.post(f"{CID}/bags", json={"nickname": f"Saco {n}"})
        assert bag.status_code == 201, bag.text
        unit = await operator.post(f"{LOTS}/{lot_code}/units", json={"bag_code": bag.json()["code"]})
        assert unit.status_code == 201, unit.text
        weighed = await operator.put(f"{LOTS}/{lot_code}/units/{unit.json()['id']}", json={"weight_g": weight_g})
        assert weighed.status_code == 200, weighed.text
    return client, lot.json()


def _magic_token(outbox) -> str:
    match = re.search(r"token=([\w-]+)", outbox.sent[-1]["text"])
    assert match
    return match.group(1)


async def _create_item(team: httpx.AsyncClient, **overrides: object) -> dict[str, object]:
    body: dict[str, object] = {
        "name": "Compromisso Ambiental",
        "kind": "environmental",
        "points_cost": 50,
    }
    body.update(overrides)
    resp = await team.post(f"{ADMIN}/items", json=body)
    assert resp.status_code == 201, resp.text
    return resp.json()  # type: ignore[no-any-return]


# --- resgate: saldo FIFO debitado, código pseudónimo nasce -----------------------------------------


async def test_donor_redeems_and_gets_a_pseudonymous_code(
    client: httpx.AsyncClient, session: AsyncSession, outbox, make_user
) -> None:
    c, _lot = await _donor_with_weighed_bags(client, session, outbox, make_user)
    team = await make_user("equipa@vitrus.pt")
    item = await _create_item(team)

    catalog = await c.get(f"{CID}/catalog")
    assert catalog.status_code == 200
    assert [i["name"] for i in catalog.json()] == ["Compromisso Ambiental"]

    redeemed = await c.post(f"{CID}/redemptions", json={"item_id": item["id"]})
    assert redeemed.status_code == 201, redeemed.text
    data = redeemed.json()
    assert data["state"] == "pending"
    assert data["points_spent"] == 50
    assert data["item_name"] == "Compromisso Ambiental"
    assert data["validated_at"] is None
    assert CODE_RE.match(data["code"]), data["code"]  # RDM-XXXXXX, o alfabeto dos sacos

    # O livro-razão: a linha negativa `redemption` (append-only, sem expiração — consome).
    entries = (await session.execute(select(PointEntry).order_by(PointEntry.seq))).scalars().all()
    assert [(e.kind, e.amount) for e in entries] == [("gain_flat", 100), ("redemption", -50)]
    assert entries[-1].expires_at is None

    # O saldo deriva do livro-razão: 100 − 50 = 50.
    saldo = await c.get(f"{CID}/saldo")
    assert saldo.json()["balance"] == 50

    # Os meus códigos: pendente, com o código que o doador apresenta.
    mine = await c.get(f"{CID}/redemptions")
    assert mine.status_code == 200
    assert [r["code"] for r in mine.json()] == [data["code"]]

    # O doador não apaga nem edita um resgate (o código é um bilhete: vive até ser validado).
    other = await c.post(f"{CID}/redemptions", json={"item_id": str(uuid.uuid4())})
    assert other.status_code == 404


async def test_insufficient_balance_is_rejected_with_the_shortfall(
    client: httpx.AsyncClient, session: AsyncSession, outbox, make_user
) -> None:
    c, _lot = await _donor_with_weighed_bags(client, session, outbox, make_user)
    team = await make_user("equipa@vitrus.pt")
    item = await _create_item(team, points_cost=300)

    rejected = await c.post(f"{CID}/redemptions", json={"item_id": item["id"]})
    assert rejected.status_code == 409
    body = rejected.json()
    assert body["code"] == "insufficient_points"
    assert body["details"]["shortfall"] == 200  # 300 − 100
    assert body["details"]["balance"] == 100

    # Nada entrou: nem livro-razão, nem resgate.
    rows = (await session.execute(select(Redemption))).scalars().all()
    assert rows == []


async def test_unknown_item_is_404_and_inactive_item_is_409(
    client: httpx.AsyncClient, session: AsyncSession, outbox, make_user
) -> None:
    c, _lot = await _donor_with_weighed_bags(client, session, outbox, make_user)
    team = await make_user("equipa@vitrus.pt")
    item = await _create_item(team, points_cost=50)
    off = await team.patch(f"{ADMIN}/items/{item['id']}", json={"active": False})
    assert off.status_code == 200

    missing = await c.post(f"{CID}/redemptions", json={"item_id": str(uuid.uuid4())})
    assert missing.status_code == 404
    inactive = await c.post(f"{CID}/redemptions", json={"item_id": item["id"]})
    assert inactive.status_code == 409
    assert inactive.json()["code"] == "catalog_item_inactive"

    # E o catálogo do doador esconde o inativo (a equipa continua a vê-lo).
    names = [i["name"] for i in (await c.get(f"{CID}/catalog")).json()]
    assert names == []
    all_admin = await team.get(f"{ADMIN}/items")
    assert [i["name"] for i in all_admin.json()] == ["Compromisso Ambiental"]
    assert all_admin.json()[0]["active"] is False


# --- teto de donativos: 105,64 €/t × kg MEDIDOS (âncora € é apresentação, nunca câmbio) -------------


async def _team_client(make_user, email: str = "equipa2@vitrus.pt") -> httpx.AsyncClient:
    return await make_user(email)


async def test_donation_cap_blocks_when_the_measured_tonnes_do_not_fund_it(
    client: httpx.AsyncClient, session: AsyncSession, outbox, make_user
) -> None:
    """2 × 2,4 kg medidos → teto = 50 cênt. (4 800 × 10 564 ÷ 1 000 000 = 50,7). Um donativo de 1 €
    não cabe: o incentivo nunca custa mais do que a poupança real (ADR «economia dos pontos»)."""
    c, _lot = await _donor_with_weighed_bags(client, session, outbox, make_user, bags=2, weight_g=2400)
    team = await _team_client(make_user)
    item = await _create_item(
        team, name="Donativo IPSS", kind="ipss_donation", points_cost=100, donation_value_cents=100
    )

    rejected = await c.post(f"{CID}/redemptions", json={"item_id": item["id"]})
    assert rejected.status_code == 409
    body = rejected.json()
    assert body["code"] == "donation_cap_reached"
    assert body["details"]["cap_cents"] == 50
    assert body["details"]["donated_this_month_cents"] == 0
    assert body["details"]["item_value_cents"] == 100

    # Um donativo AO ALCANCE do teto passa: 30 cênt. ≤ 50 ← 4 800 g medidos; saldo fica 100.
    ok = await _create_item(team, name="Lanche escolar", kind="ipss_donation", points_cost=100, donation_value_cents=30)
    redeemed = await c.post(f"{CID}/redemptions", json={"item_id": ok["id"]})
    assert redeemed.status_code == 201, redeemed.text
    assert redeemed.json()["donation_value_cents"] == 30

    # O segundo soma ao mês: 30 + 30 = 60 > 50 → recusado pelo teto (o saldo chegava: 100 ≥ 100).
    second = await c.post(f"{CID}/redemptions", json={"item_id": ok["id"]})
    assert second.status_code == 409
    assert second.json()["code"] == "donation_cap_reached"
    assert second.json()["details"]["donated_this_month_cents"] == 30


async def test_donation_cap_counts_the_measured_kg_of_every_bag(
    client: httpx.AsyncClient, session: AsyncSession, outbox, make_user
) -> None:
    """6 sacos × 5 kg = 30 kg → teto 316 cênt. (30 000 × 10 564 ÷ 1 000 000 = 316,92). Saldo 500
    (teto mensal de ganhos): 1.º donativo (150 cênt.) passa; 2.º (200) transborda (150+200 > 316)."""
    c, _lot = await _donor_with_weighed_bags(client, session, outbox, make_user, bags=6, weight_g=5000)
    team = await _team_client(make_user)
    primeiro = await _create_item(
        team, name="Cesto alimentar", kind="ipss_donation", points_cost=300, donation_value_cents=150
    )
    segundo = await _create_item(
        team, name="Manta solidária", kind="ipss_donation", points_cost=200, donation_value_cents=200
    )

    ok = await c.post(f"{CID}/redemptions", json={"item_id": primeiro["id"]})
    assert ok.status_code == 201, ok.text
    rejected = await c.post(f"{CID}/redemptions", json={"item_id": segundo["id"]})
    assert rejected.status_code == 409
    assert rejected.json()["code"] == "donation_cap_reached"
    assert rejected.json()["details"]["cap_cents"] == 316
    assert rejected.json()["details"]["donated_this_month_cents"] == 150


# --- stock: o decremento é atómico e 0 esgota -------------------------------------------------------


async def test_stock_runs_out_and_blocks(client: httpx.AsyncClient, session: AsyncSession, outbox, make_user) -> None:
    c, _lot = await _donor_with_weighed_bags(client, session, outbox, make_user, bags=5, weight_g=5000)
    team = await _team_client(make_user)
    item = await _create_item(team, name="Caderneta", points_cost=100, stock=1)

    first = await c.post(f"{CID}/redemptions", json={"item_id": item["id"]})
    assert first.status_code == 201
    listed = await team.get(f"{ADMIN}/items")
    assert listed.json()[0]["stock"] == 0

    second = await c.post(f"{CID}/redemptions", json={"item_id": item["id"]})
    assert second.status_code == 409
    assert second.json()["code"] == "out_of_stock"
    # E nunca desceu abaixo de zero.
    assert (await team.get(f"{ADMIN}/items")).json()[0]["stock"] == 0


# --- parceiros: freguesia propõe, Vitrus aprova, prémio vive do parceiro ----------------------------


async def test_partner_prize_lifecycle_gates_the_catalog(
    client: httpx.AsyncClient, session: AsyncSession, outbox, make_user
) -> None:
    c, _lot = await _donor_with_weighed_bags(client, session, outbox, make_user, bags=1)
    team = await _team_client(make_user)

    # A forma é fechada: prémio sem parceiro nem donativo com € fora do lugar → 422 com campos.
    bad_prize = await team.post(
        f"{ADMIN}/items", json={"name": "Prémio solto", "kind": "partner_prize", "points_cost": 50}
    )
    assert bad_prize.status_code == 422
    bad_donation = await team.post(
        f"{ADMIN}/items",
        json={"name": "Donativo mal formado", "kind": "ipss_donation", "points_cost": 100},
    )
    assert bad_donation.status_code == 422

    # Freguesia propõe; nasce proposed; prémio de parceiro proposto ainda não se resgata.
    proposed = await team.post(f"{ADMIN}/partners", json={"name": "Pastelaria do Vilão"})
    assert proposed.status_code == 201, proposed.text
    assert proposed.json()["state"] == "proposed"
    prize = await _create_item(
        team, name="Bolo de soupa", kind="partner_prize", points_cost=50, partner_id=proposed.json()["id"]
    )
    hidden = [i["name"] for i in (await c.get(f"{CID}/catalog")).json()]
    assert "Bolo de soupa" not in hidden  # parceiro proposto não entra no catálogo do doador

    # A Vitrus aprova: o prémio aparece e resgata-se; a validação marca usado UMA vez.
    approved = await team.post(f"{ADMIN}/partners/{proposed.json()['id']}/approve")
    assert approved.status_code == 200
    assert approved.json()["state"] == "active"
    assert "Bolo de soupa" in [i["name"] for i in (await c.get(f"{CID}/catalog")).json()]

    redeemed = await c.post(f"{CID}/redemptions", json={"item_id": prize["id"]})
    assert redeemed.status_code == 201, redeemed.text
    code = redeemed.json()["code"]
    assert redeemed.json()["partner_name"] == "Pastelaria do Vilão"

    # Validação tolerante à forma (minúsculas/espaços): o parceiro lê o código à mesa.
    validated = await team.post("/api/v1/admin/redemptions/validate", json={"code": code.lower()})
    assert validated.status_code == 200, validated.text
    assert validated.json()["state"] == "validated"
    assert validated.json()["validated_at"] is not None

    # A segunda apresentação é recusada — pagamento integral é uma vez por código.
    again = await team.post("/api/v1/admin/redemptions/validate", json={"code": code})
    assert again.status_code == 409
    assert again.json()["code"] == "redemption_already_used"
    unknown = await team.post("/api/v1/admin/redemptions/validate", json={"code": "RDM-ZZZZZZ"})
    assert unknown.status_code == 404

    # O doador vê o código validado nos seus (e o parabéns fica pendurado na conta dele, não no parceiro).
    mine = await c.get(f"{CID}/redemptions")
    assert mine.json()[0]["state"] == "validated"

    # Parceiro em pausa: os prémios saem do catálogo e o resgate pendente continua válido para consulta,
    # mas um NOVO resgate do mesmo prémio é recusado.
    await team.post(f"{ADMIN}/partners/{proposed.json()['id']}/deactivate")
    assert "Bolo de soupa" not in [i["name"] for i in (await c.get(f"{CID}/catalog")).json()]
    blocked = await c.post(f"{CID}/redemptions", json={"item_id": prize["id"]})
    assert blocked.status_code == 409
    assert blocked.json()["code"] == "catalog_item_inactive"


# --- campanhas sazonais: janela mostrada ao doador --------------------------------------------------


async def test_campaigns_shown_to_the_donor_only_inside_the_window(
    client: httpx.AsyncClient, session: AsyncSession, outbox, make_user
) -> None:
    c, _lot = await _donor_with_weighed_bags(client, session, outbox, make_user, bags=1)
    team = await _team_client(make_user)
    now = datetime.now(UTC)

    bad = await team.post(
        f"{ADMIN}/campaigns",
        json={"name": "Invertida", "starts_at": now.isoformat(), "ends_at": (now - timedelta(days=1)).isoformat()},
    )
    assert bad.status_code == 422

    ativa = await team.post(
        f"{ADMIN}/campaigns",
        json={
            "name": "Saco de natas",
            "description": "Em dezembro cada saco vale dobrado no espírito (informativa).",
            "starts_at": (now - timedelta(days=1)).isoformat(),
            "ends_at": (now + timedelta(days=7)).isoformat(),
        },
    )
    assert ativa.status_code == 201, ativa.text

    passada = await team.post(
        f"{ADMIN}/campaigns",
        json={
            "name": "Volta ao ano",
            "starts_at": (now - timedelta(days=30)).isoformat(),
            "ends_at": (now - timedelta(days=20)).isoformat(),
        },
    )
    assert passada.status_code == 201

    donor_view = (await c.get(f"{CID}/campaigns")).json()
    assert [camp["name"] for camp in donor_view] == ["Saco de natas"]
    team_view = (await team.get(f"{ADMIN}/campaigns")).json()
    assert [camp["name"] for camp in team_view] == ["Saco de natas", "Volta ao ano"]  # recente primeiro

    # Editar a janela para o passado tira-a do doador (mas a equipa continua a vê-la).
    ended = await team.patch(
        f"{ADMIN}/campaigns/{ativa.json()['id']}",
        json={"ends_at": (now - timedelta(seconds=1)).isoformat()},
    )
    assert ended.status_code == 200
    assert (await c.get(f"{CID}/campaigns")).json() == []


# --- portões: o doador só toca no que é dele; a gestão é de equipa ----------------------------------


async def test_role_gates_keep_the_donor_out_of_management(
    client: httpx.AsyncClient, session: AsyncSession, outbox, make_user
) -> None:
    c, _lot = await _donor_with_weighed_bags(client, session, outbox, make_user, bags=1)
    for method, path, body in (
        ("post", f"{ADMIN}/items", {"name": "Item X", "kind": "environmental", "points_cost": 1}),
        ("post", f"{ADMIN}/partners", {"name": "Parceiro X"}),
        (
            "post",
            f"{ADMIN}/campaigns",
            {"name": "Campanha", "starts_at": "2026-12-01T00:00:00Z", "ends_at": "2026-12-02T00:00:00Z"},
        ),
        ("post", "/api/v1/admin/redemptions/validate", {"code": "RDM-AAAAAA"}),
    ):
        resp = await getattr(c, method)(path, json=body)
        assert resp.status_code == 403, (path, resp.status_code)


async def test_donor_ledger_history_shows_the_redemption_line(
    client: httpx.AsyncClient, session: AsyncSession, outbox, make_user
) -> None:
    """O histórico de pontos (#64) passa a mostrar o resgate: linha negativa, sem expiração."""
    c, _lot = await _donor_with_weighed_bags(client, session, outbox, make_user, bags=1)
    team = await _team_client(make_user)
    item = await _create_item(team, name="Compromisso", points_cost=50)
    redeemed = await c.post(f"{CID}/redemptions", json={"item_id": item["id"]})
    assert redeemed.status_code == 201

    history = await c.get(f"{CID}/pontos")
    assert history.status_code == 200
    kinds = [(row["kind"], row["amount"]) for row in history.json()["items"]]
    assert ("redemption", -50) in kinds
    redemption_row = next(row for row in history.json()["items"] if row["kind"] == "redemption")
    assert redemption_row["expires_at"] is None  # consome, não expira


async def test_redemption_and_validation_are_audited(
    client: httpx.AsyncClient, session: AsyncSession, outbox, make_user
) -> None:
    c, _lot = await _donor_with_weighed_bags(client, session, outbox, make_user, bags=1)
    team = await _team_client(make_user)
    item = await _create_item(team, name="Compromisso", points_cost=50)
    redeemed = await c.post(f"{CID}/redemptions", json={"item_id": item["id"]})
    code = redeemed.json()["code"]
    await team.post("/api/v1/admin/redemptions/validate", json={"code": code})

    actions = (await session.execute(select(AuditLog.action).order_by(AuditLog.created_at))).scalars().all()
    assert "catalog.redeem" in actions
    assert "catalog.validate" in actions


# --- campanhas sazonais: multiplicador do ganho flat (US40) -----------------------------------------


async def _weigh_one_bag(client, outbox, make_user, email: str) -> httpx.AsyncClient:
    """Doador novo com UM saco pesado agora: devolve o cliente com a sessão do doador."""
    c, _ = await _donor_with_weighed_bags(client, None, outbox, make_user, email=email, bags=1)  # type: ignore[arg-type]
    return c


async def test_active_campaign_multiplies_the_flat_gain(
    client: httpx.AsyncClient, session: AsyncSession, outbox, make_user
) -> None:
    team = await _team_client(make_user)
    now = datetime.now(UTC)
    # Campanha ×2 ativa AGORA: o saco pesado dentro da janela credita 100 × 2 = 200 (estimativa).
    campaign = await team.post(
        f"{ADMIN}/campaigns",
        json={
            "name": "Janeiro a dobrar",
            "starts_at": (now - timedelta(hours=1)).isoformat(),
            "ends_at": (now + timedelta(days=7)).isoformat(),
            "gain_multiplier": 2,
        },
    )
    assert campaign.status_code == 201, campaign.text
    assert campaign.json()["gain_multiplier"] == 2.0

    c = await _weigh_one_bag(client, outbox, make_user, "doador+mult@exemplo.pt")
    saldo = (await c.get(f"{CID}/saldo")).json()
    assert saldo["balance"] == 200  # 100 × 2 — multiplicador ativo na janela
    assert saldo["gain_flat_points"] == 100  # a regra configurada não muda com a campanha


async def test_campaign_outside_the_window_is_parity(
    client: httpx.AsyncClient, session: AsyncSession, outbox, make_user
) -> None:
    team = await _team_client(make_user)
    now = datetime.now(UTC)
    # Campanha ×3 que JÁ ACABOU: fora da janela o ganho é o de sempre (paridade).
    ended = await team.post(
        f"{ADMIN}/campaigns",
        json={
            "name": "Natal passado",
            "starts_at": (now - timedelta(days=10)).isoformat(),
            "ends_at": (now - timedelta(days=1)).isoformat(),
            "gain_multiplier": 3,
        },
    )
    assert ended.status_code == 201

    c = await _weigh_one_bag(client, outbox, make_user, "doador+fora@exemplo.pt")
    saldo = (await c.get(f"{CID}/saldo")).json()
    assert saldo["balance"] == 100  # fora da janela: nada se multiplica


async def test_campaign_multiplier_one_is_exact_parity(
    client: httpx.AsyncClient, session: AsyncSession, outbox, make_user
) -> None:
    team = await _team_client(make_user)
    now = datetime.now(UTC)
    active = await team.post(
        f"{ADMIN}/campaigns",
        json={
            "name": "Só comunicação",
            "starts_at": (now - timedelta(hours=1)).isoformat(),
            "ends_at": (now + timedelta(days=7)).isoformat(),
            "gain_multiplier": 1,
        },
    )
    assert active.status_code == 201

    c = await _weigh_one_bag(client, outbox, make_user, "doador+um@exemplo.pt")
    saldo = (await c.get(f"{CID}/saldo")).json()
    assert saldo["balance"] == 100  # multiplicador 1 = campanha informativa, números de sempre


async def test_monthly_cap_still_applies_to_the_multiplied_gain(
    client: httpx.AsyncClient, session: AsyncSession, outbox, make_user, monkeypatch
) -> None:
    from novelo.core.config import get_settings

    monkeypatch.setattr(get_settings(), "points_monthly_cap", 300)
    team = await _team_client(make_user)
    now = datetime.now(UTC)
    await team.post(
        f"{ADMIN}/campaigns",
        json={
            "name": "Dobrado com teto",
            "starts_at": (now - timedelta(hours=1)).isoformat(),
            "ends_at": (now + timedelta(days=7)).isoformat(),
            "gain_multiplier": 2,
        },
    )
    # Dois sacos no mesmo lote, campanha ×2: cada ganho vale 200; o teto de 300 RECUSA o 2.º
    # (200 + 200 = 400 > 300) — o teto aplica-se ao valor JÁ multiplicado, sem adiar.
    c, _lot = await _donor_with_weighed_bags(
        client, session, outbox, make_user, email="doador+teto@exemplo.pt", bags=2
    )
    saldo = (await c.get(f"{CID}/saldo")).json()
    assert saldo["balance"] == 200
    assert saldo["credited_this_month"] == 200
    rows = (await session.execute(select(PointEntry).where(PointEntry.amount > 0))).scalars().all()
    assert len(rows) == 1 and rows[0].amount == 200
