"""O RGPD implementado na conta de doador (#66): política pública, consentimentos, exportação e apagamento.

Costura principal: comportamento pela API. A política de privacidade por finalidades (com prazos por
categoria) é PÚBLICA e sai de UMA fonte (features/privacy/policy.py); os consentimentos de marketing e
parcerias são registos auditáveis próprios; a exportação é portabilidade (art. 20.º); o apagamento
anónima a conta mas os agregados sobrevivem (sacos, livro de pontos e pedidos ficam sem pessoa).
"""

from datetime import UTC, datetime

import httpx
import pytest
from sqlalchemy import select, text

from novelo.core.security import hash_token, new_opaque_token
from novelo.features.audit.models import AuditLog
from novelo.features.auth.models import LoginToken
from novelo.features.calibration import service as calibration
from novelo.features.collection_requests.models import CollectionRequest
from novelo.features.planning.params import default_params
from novelo.features.planning.service import ensure_default_parameters
from novelo.features.points.models import PointEntry
from novelo.features.privacy import service as privacy
from novelo.features.privacy.models import DonorConsent
from novelo.features.users import service as users
from novelo.features.users.models import User
from tests.api.test_cidadao import _sign_up_donor
from tests.api.test_collection_requests import citizen_body, make_parish_with_round
from tests.conftest import PASSWORD

PUBLIC = "/api/v1/public"
CID = "/api/v1/cidadao"

# Um marcador impossível de colidir: a morada NUNCA pode chegar ao planeamento nem aos agregados.
MARKER_ADDRESS = "RUA-CONFIDENCIAL-MARCADOR-9812"


# --- política pública por finalidades, com prazos por categoria ------------------------------------


async def test_policy_is_public_and_structured_by_purpose(client: httpx.AsyncClient) -> None:
    resp = await client.get(f"{PUBLIC}/privacy-policy")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["version"].startswith("doadores-")
    assert "Vitrus" in body["controller"]  # o responsável é a Vitrus; a plataforma é subresponsável
    purposes = {p["id"]: p for p in body["purposes"]}
    # As finalidades decididas no bilhete: conta, sacos, pedidos, pontos, triagem, logs, marketing, parcerias.
    assert {
        "conta",
        "sacos",
        "pedidos",
        "pontos",
        "triagem",
        "logs_autenticacao",
        "marketing",
        "parcerias",
    } == set(purposes)
    # Toda a finalidade declara base legal e categorias COM prazo («omitir prazos é contraordenação»).
    for purpose in purposes.values():
        assert purpose["legal_basis"]
        assert purpose["categories"], purpose["id"]
        for category in purpose["categories"]:
            assert category["name"] and category["retention"], category
    marketing = purposes["marketing"]
    assert marketing["consent_required"] is True
    partnerships = purposes["parcerias"]
    assert partnerships["consent_required"] is True
    assert "soft opt-in" in partnerships["description"]  # nunca vale para parceiros (CNPD DIRETRIZ/2022/1)


async def test_policy_publishes_the_decided_retention_deadlines(client: httpx.AsyncClient) -> None:
    body = (await client.get(f"{PUBLIC}/privacy-policy")).json()
    purposes = {p["id"]: p for p in body["purposes"]}
    retentions = {c["name"]: c["retention"] for p in purposes.values() for c in p["categories"]}
    joined = "\n".join(retentions)
    # Morada do pedido: 12 meses (#60). Logs de OTP/magic link: 12 meses (ADR). Miniaturas: 90 dias.
    assert "12 meses" in " ".join(retentions[p["name"]] for p in purposes["pedidos"]["categories"])
    assert "12 meses" in " ".join(retentions[p["name"]] for p in purposes["logs_autenticacao"]["categories"])
    assert "90 dias" in " ".join(retentions[p["name"]] for p in purposes["triagem"]["categories"])
    assert joined  # sanidade: há categorias


# --- consentimento em duas camadas, registo auditável ----------------------------------------------


async def test_donor_grants_and_withdraws_marketing_and_partnerships_separately(
    client: httpx.AsyncClient, session, outbox
) -> None:  # type: ignore[no-untyped-def]
    await _sign_up_donor(client, session, outbox)
    current = (await client.get(f"{CID}/consents")).json()
    # Por defeito TUDO desligado: zero consentimento é o estado inicial (zero partilha por defeito).
    assert {c["purpose"] for c in current["items"]} == {"marketing", "partnerships"}
    assert all(c["granted"] is False and c["updated_at"] is None for c in current["items"])

    granted = await client.put(f"{CID}/consents", json={"purpose": "marketing", "granted": True})
    assert granted.status_code == 200, granted.text
    body = granted.json()
    marketing = next(c for c in body["items"] if c["purpose"] == "marketing")
    assert marketing["granted"] is True
    assert marketing["policy_version"].startswith("doadores-")
    assert marketing["updated_at"] is not None
    partnerships = next(c for c in body["items"] if c["purpose"] == "partnerships")
    assert partnerships["granted"] is False  # a outra camada não se mexe: consentimentos são granulares

    withdrawn = await client.put(f"{CID}/consents", json={"purpose": "marketing", "granted": False})
    assert withdrawn.status_code == 200
    after = next(c for c in withdrawn.json()["items"] if c["purpose"] == "marketing")
    assert after["granted"] is False and after["updated_at"] is not None


async def test_consent_records_are_append_only_and_audited(client: httpx.AsyncClient, session, outbox) -> None:  # type: ignore[no-untyped-def]
    await _sign_up_donor(client, session, outbox, email="consentinte@exemplo.pt")
    await client.put(f"{CID}/consents", json={"purpose": "partnerships", "granted": True})
    await client.put(f"{CID}/consents", json={"purpose": "partnerships", "granted": False})
    rows = (
        (await session.execute(select(DonorConsent).order_by(DonorConsent.created_at, DonorConsent.seq)))
        .scalars()
        .all()
    )
    assert len(rows) == 2  # duas linhas, nenhuma editada: a história é a prova (art. 7.º/1 RGPD)
    assert [r.granted for r in rows] == [True, False]
    assert all(r.policy_version.startswith("doadores-") for r in rows)
    user = (await session.execute(select(User).where(User.email == "consentinte@exemplo.pt"))).scalar_one()
    actions = (
        (
            await session.execute(
                select(AuditLog.action).where(AuditLog.target_id == str(user.id), AuditLog.action.like("consent.%"))
            )
        )
        .scalars()
        .all()
    )
    assert actions == ["consent.grant", "consent.withdraw"]


async def test_consent_endpoints_are_for_donors_only(make_user: object) -> None:
    team = await make_user("equipa-rgpd@test.pt")  # type: ignore[operator]
    assert (await team.get(f"{CID}/consents")).status_code == 403
    assert (await team.put(f"{CID}/consents", json={"purpose": "marketing", "granted": True})).status_code == 403
    anonymous = httpx.AsyncClient(transport=team._transport, base_url="http://test")
    try:
        assert (await anonymous.get(f"{CID}/consents")).status_code == 401
    finally:
        await anonymous.aclose()


# --- portabilidade (art. 20.º): exportação em JSON legível por máquina ------------------------------


async def test_export_returns_machine_readable_account_data(client: httpx.AsyncClient, session, outbox) -> None:  # type: ignore[no-untyped-def]
    await _sign_up_donor(client, session, outbox, email="portabilidade@exemplo.pt")
    await client.put(f"{CID}/consents", json={"purpose": "marketing", "granted": True})
    bag = (await client.post(f"{CID}/bags", json={"nickname": "Saco azul", "declaration": "reuse"})).json()
    parish = await make_parish_with_round(session)
    donor_session = session
    resp = await client.post("/api/v1/collection-requests", json=citizen_body(parish, address="Rua da Exportação, 7"))
    assert resp.status_code == 201, resp.text
    # Ganho no livro-razão: +100 flat pelo saco recolhido e pesado (o caminho real de #64 é o scan;
    # aqui semeia-se a linha diretamente — o formato do export é o que se testa).
    user = (await donor_session.execute(select(User).where(User.email == "portabilidade@exemplo.pt"))).scalar_one()
    donor_session.add(PointEntry(user_id=user.id, kind="gain_flat", amount=100, bag_code=bag["code"], lot_code=None))
    await donor_session.commit()

    export = await client.get(f"{CID}/account/export")
    assert export.status_code == 200, export.text
    assert "attachment" in export.headers.get("content-disposition", "")
    body = export.json()
    assert body["profile"]["email"] == "portabilidade@exemplo.pt"
    assert body["profile"]["donor_code"].startswith("NVA-")
    assert body["consents"][0]["purpose"] == "marketing" and body["consents"][0]["granted"] is True
    assert body["bags"][0]["code"] == bag["code"] and body["bags"][0]["nickname"] == "Saco azul"
    assert any(r["address"] == "Rua da Exportação, 7" for r in body["collection_requests"])
    assert body["points"][0]["amount"] == 100 and body["points"][0]["bag_code"] == bag["code"]
    assert body["exported_at"] is not None


# --- apagar a conta: pré-aviso com saldo e prazos, confirmação, agregados sobrevivem ----------------


async def _seed_donor_with_points_and_requests(client, session, outbox, email):  # type: ignore[no-untyped-def]
    await _sign_up_donor(client, session, outbox, email=email)
    bag = (await client.post(f"{CID}/bags", json={"nickname": "Saco do quarto", "declaration": "reuse"})).json()
    parish = await make_parish_with_round(session)
    resp = await client.post("/api/v1/collection-requests", json=citizen_body(parish, address=MARKER_ADDRESS))
    assert resp.status_code == 201, resp.text
    user = (await session.execute(select(User).where(User.email == email))).scalar_one()
    now = datetime.now(UTC)
    session.add_all(
        [
            PointEntry(
                user_id=user.id,
                kind="gain_flat",
                amount=100,
                bag_code=bag["code"],
                expires_at=now.replace(year=now.year + 1),
            ),
            PointEntry(
                user_id=user.id,
                kind="gain_bonus",
                amount=50,
                bag_code=bag["code"],
                expires_at=now.replace(year=now.year + 2),
            ),
        ]
    )
    await session.commit()
    return user, bag


async def test_delete_preview_shows_balance_fifo_timeline_and_what_is_lost(
    client: httpx.AsyncClient, session, outbox
) -> None:  # type: ignore[no-untyped-def]
    await _seed_donor_with_points_and_requests(client, session, outbox, "previa@exemplo.pt")
    resp = await client.get(f"{CID}/account/delete-preview")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["saldo"]["balance"] == 150  # 100 flat + 50 bónus
    assert body["saldo"]["flat"] == 100 and body["saldo"]["bonus"] == 50
    timeline = body["timeline"]
    assert len(timeline) == 2  # duas datas de expiração (o ganho de 12 meses e o de 24)
    assert sum(item["amount"] for item in timeline) == 150
    assert timeline[0]["expires_at"] < timeline[1]["expires_at"]
    assert body["active_bags"] == 1 and body["bags"] == 1
    assert body["requests"] == 1
    assert body["points_entries"] == 2


async def test_delete_requires_matching_email_confirmation(client: httpx.AsyncClient, session, outbox) -> None:  # type: ignore[no-untyped-def]
    await _seed_donor_with_points_and_requests(client, session, outbox, "confirmar@exemplo.pt")
    wrong = await client.post(f"{CID}/account/delete", json={"confirm_email": "outra@exemplo.pt"})
    assert wrong.status_code == 400
    assert wrong.json()["code"] == "confirmation_mismatch"
    case = await client.post(f"{CID}/account/delete", json={"confirm_email": "Confirmar@Exemplo.pt "})
    assert case.status_code == 204, case.text  # normaliza espaços e capitalização: quem é dono apaga


async def test_delete_anonymizes_account_but_keeps_the_aggregates(client: httpx.AsyncClient, session, outbox) -> None:  # type: ignore[no-untyped-def]
    user, bag = await _seed_donor_with_points_and_requests(client, session, outbox, "apagarme@exemplo.pt")
    await client.put(f"{CID}/consents", json={"purpose": "marketing", "granted": True})
    resp = await client.post(f"{CID}/account/delete", json={"confirm_email": "apagarme@exemplo.pt"})
    assert resp.status_code == 204, resp.text

    # A pessoa desapareceu: sem linha na users, sem sessão (o token morre em cascata), sem email em lado nenhum.
    assert await session.get(User, user.id) is None
    dead = await client.get(f"{CID}/account")
    assert dead.status_code in (401, 403)

    # Os sacos sobrevivem anónimos: o código (QR físico) fica, o apelido (texto pessoal) vai.
    bags = (await session.execute(text("SELECT user_id, nickname, code FROM bag_activations"))).all()
    assert len(bags) == 1 and bags[0][0] is None and bags[0][1] is None and bags[0][2] == bag["code"]

    # O livro de pontos sobrevive sem dono (agregados): as linhas ficam, o crédito morre.
    entries = (await session.execute(select(PointEntry))).scalars().all()
    assert len(entries) == 2 and all(e.user_id is None for e in entries)

    # Os pedidos sobrevivem como estatística: a morada é purgada JÁ (não espera os 12 meses).
    requests = (await session.execute(select(CollectionRequest))).scalars().all()
    assert len(requests) == 1
    assert requests[0].requester_id is None
    assert requests[0].address is None and requests[0].address_key is None
    assert requests[0].parish_id is not None  # a freguesia fica: é ela que alimenta os agregados

    # Os consentimentos ficam como prova anónima (accountability, art. 7.º/1): sem pessoa, com o facto.
    consents = (await session.execute(select(DonorConsent))).scalars().all()
    assert len(consents) == 1 and consents[0].user_id is None and consents[0].granted is True

    # Auditoria: o facto do apagamento fica, o email desaparece (scrub).
    audit_actions = (
        (await session.execute(select(AuditLog.action).where(AuditLog.action == "account.delete_self"))).scalars().all()
    )
    assert len(audit_actions) == 1
    leaked = 0
    for row in await session.execute(select(AuditLog.details, AuditLog.target_label)):
        for value in row:
            if value and "apagarme@exemplo.pt" in str(value):
                leaked += 1
    assert leaked == 0


async def test_deleted_donor_email_is_free_for_a_new_account(client: httpx.AsyncClient, session, outbox) -> None:  # type: ignore[no-untyped-def]
    await _sign_up_donor(client, session, outbox, email="reutilizar@exemplo.pt")
    await client.post(f"{CID}/account/delete", json={"confirm_email": "reutilizar@exemplo.pt"})
    resp = await client.post(
        "/api/v1/auth/donor/sign-up", json={"email": "reutilizar@exemplo.pt", "declared_age": 40, "consent": True}
    )
    assert resp.status_code == 204, resp.text
    users = (await session.execute(select(User).where(User.email == "reutilizar@exemplo.pt"))).scalars().all()
    assert len(users) == 1 and users[0].role == "donor"


# --- 13+: consentimento impossível abaixo da idade mínima ------------------------------------------


async def test_consent_is_impossible_below_13(client: httpx.AsyncClient, outbox: object) -> None:
    # A porta de entrada recusa <13 ANTES de qualquer consentimento (a conta nem nasce).
    resp = await client.post(
        "/api/v1/auth/donor/sign-up",
        json={"email": "menor@exemplo.pt", "declared_age": 12, "consent": True},
    )
    assert resp.status_code == 422
    body = resp.json()
    assert body["code"] == "age_below_minimum"
    assert "13" in body["message"]  # recusa CLARA: diz o número
    assert outbox.sent == []  # type: ignore[attr-defined]


# --- retenção dos logs de entrada: 12 meses (job diário, ADR) ---------------------------------------


async def test_login_log_purge_removes_only_older_than_twelve_months(session) -> None:  # type: ignore[no-untyped-def]
    user = await users.create_user(session, email="entradas@test.pt", password=PASSWORD, role="operator")
    now = datetime.now(UTC)
    old = LoginToken(user_id=user.id, token_hash=hash_token(new_opaque_token()), purpose="magic_link", expires_at=now)
    recent = LoginToken(
        user_id=user.id, token_hash=hash_token(new_opaque_token()), purpose="magic_link", expires_at=now
    )
    session.add_all([old, recent])
    await session.flush()
    # 13 meses para trás (o corte é 12): o registo antigo TEM de sair; o recente fica.
    await session.execute(
        text("UPDATE login_tokens SET created_at = :at WHERE id = :id").bindparams(
            at=now.replace(year=now.year - 2), id=old.id
        )
    )
    await session.commit()

    removed = await privacy.purge_expired_login_tokens(session)
    assert removed == 1
    left = (await session.execute(select(LoginToken))).scalars().all()
    assert len(left) == 1 and left[0].id == recent.id


# --- a morada nunca passa ao planeamento (costura de regressão) -------------------------------------


async def test_request_address_never_reaches_calibration_aggregates(session, make_user) -> None:  # type: ignore[no-untyped-def]
    await ensure_default_parameters(session)
    parish = await make_parish_with_round(session)
    requester = await make_user("pedinte@test.pt")
    resp = await requester.post("/api/v1/collection-requests", json=citizen_body(parish, address=MARKER_ADDRESS))
    assert resp.status_code == 201, resp.text
    rows = await calibration.recompute(session, default_params())
    assert rows, "o recálculo devia produzir agregados"
    for row in rows:
        blob = repr(tuple(getattr(row, c.name) for c in row.__table__.columns))
        assert MARKER_ADDRESS not in blob  # nem morada, nem chave de morada, em nenhum agregado


@pytest.mark.solver  # corre um cenário (CP-SAT/VRP com o corte de testes)
async def test_request_address_never_reaches_a_computed_scenario(logged_in: httpx.AsyncClient, session) -> None:
    parish = await make_parish_with_round(session)
    resp = await logged_in.post("/api/v1/collection-requests", json=citizen_body(parish, address=MARKER_ADDRESS))
    assert resp.status_code == 201, resp.text
    scenario = await logged_in.post(
        "/api/v1/planning/scenarios",
        json={"label": "RGPD", "objective": "min_cost", "target_tonnes": 120},
    )
    assert scenario.status_code == 201, scenario.text
    assert MARKER_ADDRESS not in scenario.text
