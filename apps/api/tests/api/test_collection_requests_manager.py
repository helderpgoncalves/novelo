"""Local/B2B e a mesa do gestor: morada institucional, teto de 20, despacho de exceções e ausências.

Costura principal (spec #54): o local pede com a morada do sítio da conta (nunca morada escrita) e o
gestor (admin/operator) vê a fila de exceções, despacha (agendar/recusar) e aponta o resultado da
visita — recolhido fecha, a ausência soma, e à 3.ª o pedido expira.
"""

import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import select

from novelo.domain.vocab import CircuitStatus, CollectionType, LocalKind, Typology
from novelo.features.collection_requests.models import CollectionRequest
from novelo.features.datasets.models import DataSource
from novelo.features.locals.models import LocalAccount
from novelo.features.network.models import Circuit, CircuitDay, CircuitLocality, Locality, Parish
from novelo.features.users.models import User
from tests.api.test_collection_requests import future_dow, make_parish_with_round

MONDAY = 0


async def make_local_with_site(session) -> Locality:
    """Um sítio servido por um circuito à segunda-feira (dados feitos à mão, isolados do seed)."""
    tag = uuid.uuid4().hex[:6]
    parish = Parish(dicofre=f"98{tag[:4]}", name=f"Freguesia de local {tag}", population=50)
    session.add(parish)
    await session.flush()
    source = (await session.execute(select(DataSource).limit(1))).scalar_one_or_none()
    if source is None:
        source = DataSource(
            key=f"test-local-{tag}",
            title="Fonte de teste",
            provider="Teste",
            file_name="teste.csv",
            file_sha256="0" * 64,
            imported_at=datetime.now(UTC),
        )
        session.add(source)
        await session.flush()
    circuit = Circuit(
        code=f"CR-L60-{tag}",
        typology=Typology.SUPPORT,
        collection_type=CollectionType.DOOR_TO_DOOR,
        status=CircuitStatus.OK,
        days_text="segunda",
        source_id=source.id,
    )
    locality = Locality(name=f"Local de teste B2B {tag}", parish_id=parish.id)
    session.add_all([circuit, locality])
    await session.flush()
    session.add(CircuitLocality(circuit_id=circuit.id, locality_id=locality.id, position=0))
    session.add(CircuitDay(circuit_id=circuit.id, weekday=1))  # 1 = segunda
    await session.flush()
    return locality


async def bind_local(make_user, session, locality: Locality, *, kind: LocalKind = LocalKind.B2B):
    """Cria o utilizador com papel `local` ligado ao sítio e devolve o cliente HTTP dele.

    `make_user` devolve um cliente HTTP (cookies próprios); a conta de local liga-se ao utilizador
    buscado por email na sessão do teste.
    """
    email = f"{uuid.uuid4().hex[:8]}@test.pt"
    user_client = await make_user(email, role="local")
    user = (await session.execute(select(User).where(User.email == email))).scalar_one()
    session.add(LocalAccount(user_id=user.id, locality_id=locality.id, kind=kind))
    await session.flush()
    return user_client


def local_body(*, bags: int = 4, **overrides) -> dict:
    body = {"bag_count": bags, "requested_date": future_dow(MONDAY).isoformat()}
    body.update(overrides)
    return body


def citizen_body(parish: Parish, *, address: str, date_: str | None = None, **overrides) -> dict:
    body = {
        "bag_count": 2,
        "requested_date": date_ or future_dow(MONDAY).isoformat(),
        "address": address,
        "parish_code": parish.dicofre,
    }
    body.update(overrides)
    return body


# --- o local/B2B pede com a morada institucional ------------------------------------------------


async def test_local_request_uses_the_institutional_address(make_user, session) -> None:
    locality = await make_local_with_site(session)
    user = await bind_local(make_user, session, locality)
    resp = await user.post("/api/v1/collection-requests", json=local_body())
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["subject_kind"] == "local"
    assert body["locality_id"] == str(locality.id)
    assert body["locality_name"] == locality.name
    assert body["address"] is None  # a morada é a institucional — nunca escrita
    assert body["state"] == "scheduled"


async def test_local_with_written_address_is_rejected(make_user, session) -> None:
    locality = await make_local_with_site(session)
    user = await bind_local(make_user, session, locality)
    resp = await user.post("/api/v1/collection-requests", json=local_body(address="Rua Qualquer, 1"))
    assert resp.status_code == 422, resp.text
    assert resp.json()["code"] == "local_address_forbidden"
    resp = await user.post("/api/v1/collection-requests", json=local_body(parish_code="999999"))
    assert resp.status_code == 422, resp.text
    assert resp.json()["code"] == "local_address_forbidden"


async def test_local_above_20_bags_is_special_collection_not_error(make_user, session) -> None:
    locality = await make_local_with_site(session)
    user = await bind_local(make_user, session, locality)
    # 20 passa (teto — estimativa); 21–500 é recolha especial; 501 rebenta o travão do campo (422).
    resp = await user.post("/api/v1/collection-requests", json=local_body(bags=20))
    assert resp.status_code == 201, resp.text
    assert resp.json()["state"] == "scheduled"
    await user.delete(f"/api/v1/collection-requests/{resp.json()['id']}")
    resp = await user.post("/api/v1/collection-requests", json=local_body(bags=21))
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["state"] == "exception"
    assert body["exception_reason"] == "special_volume"
    await user.delete(f"/api/v1/collection-requests/{body['id']}")
    resp = await user.post("/api/v1/collection-requests", json=local_body(bags=501))
    assert resp.status_code == 422, resp.text


async def test_one_active_request_per_locality(make_user, session) -> None:
    locality = await make_local_with_site(session)
    user = await bind_local(make_user, session, locality)
    resp = await user.post("/api/v1/collection-requests", json=local_body())
    assert resp.status_code == 201, resp.text
    request_id = resp.json()["id"]
    resp = await user.post("/api/v1/collection-requests", json=local_body())
    assert resp.status_code == 409, resp.text
    assert resp.json()["code"] == "address_request_active"
    resp = await user.delete(f"/api/v1/collection-requests/{request_id}")
    assert resp.status_code == 204, resp.text
    resp = await user.post("/api/v1/collection-requests", json=local_body())
    assert resp.status_code == 201, resp.text


async def test_local_listing_returns_only_the_own_site(make_user, session) -> None:
    own = await make_local_with_site(session)
    other = await make_local_with_site(session)
    user = await bind_local(make_user, session, own, kind=LocalKind.ASSISTED)
    other_user = await bind_local(make_user, session, other)
    resp = await other_user.post("/api/v1/collection-requests", json=local_body())
    assert resp.status_code == 201, resp.text
    resp = await user.post("/api/v1/collection-requests", json=local_body())
    assert resp.status_code == 201, resp.text
    mine_id = resp.json()["id"]
    resp = await user.get("/api/v1/collection-requests")
    assert resp.status_code == 200, resp.text
    ids = [row["id"] for row in resp.json()]
    assert ids == [mine_id]  # só o próprio sítio; nunca os pedidos do outro local


# --- a mesa do gestor: despacho, resultado da visita, anulação -----------------------------------


async def test_manager_dispatches_schedule_and_reject(make_user, session) -> None:
    parish = await make_parish_with_round(session)
    citizen = await make_user("urgente@test.pt")
    resp = await citizen.post(
        "/api/v1/collection-requests",
        json=citizen_body(parish, address="Rua da Urgência, 7", urgent=True),
    )
    assert resp.status_code == 201, resp.text
    request_id = resp.json()["id"]
    assert resp.json()["exception_reason"] == "urgency"

    team = await make_user("gestor@test.pt", role="operator")
    # Recusar sem motivo não passa.
    resp = await team.post(f"/api/v1/collection-requests/{request_id}/dispatch", json={"action": "reject"})
    assert resp.status_code == 409, resp.text
    # Recusar com motivo.
    resp = await team.post(
        f"/api/v1/collection-requests/{request_id}/dispatch", json={"action": "reject", "reason": "Fora da área piloto"}
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["state"] == "rejected"
    assert body["dispatch_reason"] == "Fora da área piloto"
    # Já não se despacha outra vez (o estado terminal ficou).
    resp = await team.post(
        f"/api/v1/collection-requests/{request_id}/dispatch",
        json={"action": "schedule", "requested_date": "2027-01-04"},
    )
    assert resp.status_code == 409, resp.text


async def test_manager_schedules_an_out_of_round_request_with_a_new_date(make_user, session) -> None:
    parish = await make_parish_with_round(session)
    citizen = await make_user("teimoso@test.pt")
    resp = await citizen.post(
        "/api/v1/collection-requests",
        json=citizen_body(parish, address="Rua da Ronda Perdida, 3", date_=future_dow(3).isoformat()),
    )
    assert resp.json()["exception_reason"] == "out_of_round"  # quinta: a ronda do teste é só à segunda
    request_id = resp.json()["id"]
    team = await make_user("gestora@test.pt", role="admin")
    monday = future_dow(0)
    resp = await team.post(
        f"/api/v1/collection-requests/{request_id}/dispatch",
        json={"action": "schedule", "requested_date": monday.isoformat()},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["state"] == "scheduled"
    assert body["requested_date"] == monday.isoformat()
    assert body["exception_reason"] is None


async def test_third_missed_visit_expires_the_request(make_user, session) -> None:
    parish = await make_parish_with_round(session)
    citizen = await make_user("ausente@test.pt")
    resp = await citizen.post(
        "/api/v1/collection-requests",
        json=citizen_body(parish, address="Rua das Ausências, 9", bag_count=1),
    )
    request_id = resp.json()["id"]
    team = await make_user("motorista-chefe@test.pt", role="operator")
    resp = await team.post(f"/api/v1/collection-requests/{request_id}/outcome", json={"outcome": "missed"})
    assert resp.status_code == 200, resp.text
    assert resp.json()["missed_count"] == 1
    resp = await team.post(f"/api/v1/collection-requests/{request_id}/outcome", json={"outcome": "missed"})
    assert resp.json()["state"] == "scheduled"  # a 2.ª ausência ainda não expira
    resp = await team.post(f"/api/v1/collection-requests/{request_id}/outcome", json={"outcome": "missed"})
    body = resp.json()
    assert body["state"] == "expired"  # à 3.ª ausência, expira
    assert body["missed_count"] == 3
    assert body["expired_at"] is not None
    # Terminado: já não recebe resultados nem se anula.
    resp = await team.post(f"/api/v1/collection-requests/{request_id}/outcome", json={"outcome": "collected"})
    assert resp.status_code == 409, resp.text
    assert resp.json()["code"] == "request_not_scheduled"
    resp = await citizen.delete(f"/api/v1/collection-requests/{request_id}")
    assert resp.status_code == 409, resp.text


async def test_collected_closes_the_request(make_user, session) -> None:
    parish = await make_parish_with_round(session)
    citizen = await make_user("recolhido@test.pt")
    resp = await citizen.post(
        "/api/v1/collection-requests",
        json=citizen_body(parish, address="Rua da Certeza, 5"),
    )
    request_id = resp.json()["id"]
    team = await make_user("equipa@test.pt", role="operator")
    resp = await team.post(f"/api/v1/collection-requests/{request_id}/outcome", json={"outcome": "collected"})
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["state"] == "collected"
    assert body["collected_at"] is not None


async def test_local_cannot_dispatch_or_record_outcomes(make_user, session) -> None:
    """A mesa do gestor é só admin/operator: um papel `local` não despacha nem aponta visitas."""
    parish = await make_parish_with_round(session)
    team = await make_user("equipa-mesa@test.pt", role="operator")
    resp = await team.post(
        "/api/v1/collection-requests",
        json=citizen_body(parish, address="Rua do Portão, 1"),
    )
    request_id = resp.json()["id"]
    local_user = await bind_local(make_user, session, await make_local_with_site(session))
    resp = await local_user.post(f"/api/v1/collection-requests/{request_id}/dispatch", json={"action": "schedule"})
    assert resp.status_code == 403, resp.text
    resp = await local_user.post(f"/api/v1/collection-requests/{request_id}/outcome", json={"outcome": "collected"})
    assert resp.status_code == 403, resp.text


async def test_only_the_owner_or_the_team_cancels(make_user, session) -> None:
    parish = await make_parish_with_round(session)
    owner = await make_user("dono-do-pedido@test.pt")
    resp = await owner.post(
        "/api/v1/collection-requests",
        json=citizen_body(parish, address="Rua da Privacidade, 2", bag_count=1),
    )
    request_id = resp.json()["id"]
    local_user = await bind_local(make_user, session, await make_local_with_site(session))
    resp = await local_user.delete(f"/api/v1/collection-requests/{request_id}")
    assert resp.status_code == 403, resp.text
    team = await make_user("supervisor@test.pt", role="admin")
    resp = await team.delete(f"/api/v1/collection-requests/{request_id}")
    assert resp.status_code == 204, resp.text


# --- retenção da morada: 12 meses, purgada à leitura ---------------------------------------------


async def test_address_is_purged_on_read_after_retention(make_user, session) -> None:
    parish = await make_parish_with_round(session)
    citizen = await make_user("rgpd@test.pt")
    resp = await citizen.post(
        "/api/v1/collection-requests",
        json=citizen_body(parish, address="Rua do Esquecimento, 12", bag_count=1),
    )
    request_id = resp.json()["id"]
    assert resp.json()["address"] == "Rua do Esquecimento, 12"
    assert resp.json()["address_retained_until"] is not None
    # Envelhece o pedido 13 meses (retenção de 12) e lê outra vez: a morada tem de ter desaparecido.
    stale = datetime.now(UTC) - timedelta(days=30 * 13)
    await session.execute(
        CollectionRequest.__table__.update()
        .where(CollectionRequest.id == uuid.UUID(request_id))
        .values(address_retained_until=stale)
    )
    await session.commit()
    resp = await citizen.get("/api/v1/collection-requests")
    row = next(r for r in resp.json() if r["id"] == request_id)
    assert row["address"] is None
    assert row["state"] == "scheduled"  # o pedido fica; só a morada é apagada
