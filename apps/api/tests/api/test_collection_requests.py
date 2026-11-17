"""As regras do pedido de recolha pela API: auto-aceite, corte de 48 h, limites e 1 ativo por morada.

Costura principal (spec #54): comportamento observável por pedido/resposta. Os pedidos do local/B2B e
os endpoints do gestor estão em `test_collection_requests_manager.py`.
"""

import uuid
from datetime import UTC, date, datetime, timedelta

from sqlalchemy import select

from novelo.domain.vocab import CircuitStatus, CollectionType, Typology
from novelo.features.datasets.models import DataSource
from novelo.features.network.models import Circuit, CircuitDay, CircuitLocality, Locality, Parish

# 0 = segunda (Python); o CircuitDay guarda 1 = segunda (Vitrus).
MONDAY = 0
THURSDAY = 3


def future_dow(dow: int, *, min_days: int = 2) -> date:
    """A próxima data com o dia da semana dado, a pelo menos `min_days` dias de hoje."""
    d = datetime.now(UTC).date() + timedelta(days=min_days)
    while d.weekday() != dow:
        d += timedelta(days=1)
    return d


async def make_parish_with_round(session) -> Parish:
    """Freguesia de teste com um circuito que passa à segunda-feira (dados feitos à mão, isolados do seed)."""
    tag = uuid.uuid4().hex[:6]
    parish = Parish(dicofre=f"99{tag[:4]}", name=f"Freguesia de teste {tag}", population=100)
    session.add(parish)
    await session.flush()
    source = (await session.execute(select(DataSource).limit(1))).scalar_one_or_none()
    if source is None:
        source = DataSource(
            key=f"test-{tag}",
            title="Fonte de teste",
            provider="Teste",
            file_name="teste.csv",
            file_sha256="0" * 64,
            imported_at=datetime.now(UTC),
        )
        session.add(source)
        await session.flush()
    circuit = Circuit(
        code=f"CR-T60-{tag}",
        typology=Typology.SUPPORT,
        collection_type=CollectionType.DOOR_TO_DOOR,
        status=CircuitStatus.OK,
        days_text="segunda",
        source_id=source.id,
    )
    locality = Locality(name=f"Local de teste {tag}", parish_id=parish.id)
    session.add_all([circuit, locality])
    await session.flush()
    session.add(CircuitLocality(circuit_id=circuit.id, locality_id=locality.id, position=0))
    session.add(CircuitDay(circuit_id=circuit.id, weekday=1))  # 1 = segunda
    await session.flush()
    return parish


def citizen_body(parish: Parish, *, date_: date | None = None, **overrides) -> dict:
    body = {
        "bag_count": 3,
        "requested_date": (date_ or future_dow(MONDAY)).isoformat(),
        "address": "Rua de Santa Maria, N.º 42, 2.º Esq.",
        "parish_code": parish.dicofre,
    }
    body.update(overrides)
    return body


async def test_citizen_request_auto_accepts_when_in_round(make_user, session) -> None:
    parish = await make_parish_with_round(session)
    c = await make_user("cidadao1@test.pt")
    resp = await c.post("/api/v1/collection-requests", json=citizen_body(parish))
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["subject_kind"] == "citizen"
    assert body["state"] == "scheduled"
    assert body["exception_reason"] is None
    assert body["bag_count"] == 3
    assert body["missed_count"] == 0
    assert body["address"] == "Rua de Santa Maria, N.º 42, 2.º Esq."
    assert body["parish_code"] == parish.dicofre


async def test_bags_out_of_limits_are_a_validation_error_for_citizens(make_user, session) -> None:
    parish = await make_parish_with_round(session)
    c = await make_user("cidadao2@test.pt")
    for bags in (0, 6, 21):
        resp = await c.post("/api/v1/collection-requests", json=citizen_body(parish, bag_count=bags))
        assert resp.status_code == 422, (bags, resp.text)


async def test_date_inside_the_48h_cutoff_goes_to_the_exception_queue(make_user, session) -> None:
    parish = await make_parish_with_round(session)
    c = await make_user("cidadao3@test.pt")
    tomorrow = datetime.now(UTC).date() + timedelta(days=1)
    resp = await c.post("/api/v1/collection-requests", json=citizen_body(parish, date_=tomorrow))
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["state"] == "exception"
    assert body["exception_reason"] == "cutoff"


async def test_date_without_round_in_the_parish_is_out_of_round(make_user, session) -> None:
    parish = await make_parish_with_round(session)  # a ronda do teste é só à segunda
    c = await make_user("cidadao4@test.pt")
    resp = await c.post("/api/v1/collection-requests", json=citizen_body(parish, date_=future_dow(THURSDAY)))
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["state"] == "exception"
    assert body["exception_reason"] == "out_of_round"


async def test_urgent_requests_are_never_auto_accepted(make_user, session) -> None:
    parish = await make_parish_with_round(session)
    c = await make_user("cidadao5@test.pt")
    resp = await c.post("/api/v1/collection-requests", json=citizen_body(parish, urgent=True))
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["state"] == "exception"
    assert body["exception_reason"] == "urgency"


async def test_citizen_requires_address_and_parish(make_user, session) -> None:
    parish = await make_parish_with_round(session)
    c = await make_user("cidadao6@test.pt")
    resp = await c.post("/api/v1/collection-requests", json=citizen_body(parish, address=None))
    assert resp.status_code == 422, resp.text
    assert resp.json()["code"] == "citizen_address_required"
    resp = await c.post("/api/v1/collection-requests", json=citizen_body(parish, parish_code=None))
    assert resp.status_code == 422, resp.text
    assert resp.json()["code"] == "citizen_parish_required"


async def test_unknown_parish_code_is_rejected(make_user, session) -> None:
    parish = await make_parish_with_round(session)
    c = await make_user("cidadao7@test.pt")
    resp = await c.post("/api/v1/collection-requests", json=citizen_body(parish, parish_code="888888"))
    assert resp.status_code == 404, resp.text
    assert resp.json()["code"] == "not_found"


async def test_one_active_request_per_normalized_address(make_user, session) -> None:
    parish = await make_parish_with_round(session)
    first = await make_user("vizinha1@test.pt")
    second = await make_user("vizinho2@test.pt")
    resp = await first.post("/api/v1/collection-requests", json=citizen_body(parish))
    assert resp.status_code == 201, resp.text
    request_id = resp.json()["id"]
    # A mesma morada escrita de outra forma (maiúsculas, sem acentos, «nº») bate com a mesma chave.
    resp = await second.post(
        "/api/v1/collection-requests",
        json=citizen_body(parish, address=" rua de santa maria nº 42 2 esq "),
    )
    assert resp.status_code == 409, resp.text
    assert resp.json()["code"] == "address_request_active"
    # Outra morada (número diferente) passa: a regra é por morada, não por conta.
    resp = await second.post(
        "/api/v1/collection-requests", json=citizen_body(parish, address="Rua de Santa Maria, 44")
    )
    assert resp.status_code == 201, resp.text
    # Cancelado o primeiro, a morada volta a ficar livre.
    resp = await first.delete(f"/api/v1/collection-requests/{request_id}")
    assert resp.status_code == 204, resp.text
    resp = await second.post("/api/v1/collection-requests", json=citizen_body(parish))
    assert resp.status_code == 201, resp.text


async def test_guests_cannot_request_collection(make_user, session) -> None:
    parish = await make_parish_with_round(session)
    c = await make_user("visitante@test.pt", role="guest")
    resp = await c.post("/api/v1/collection-requests", json=citizen_body(parish))
    assert resp.status_code == 403, resp.text


async def test_listing_by_role_team_sees_all_and_filters_the_queue(make_user, session) -> None:
    """A equipa (admin/operator) vê tudo; a fila de despacho é `?state=exception`."""
    parish = await make_parish_with_round(session)
    first = await make_user("equipa1@test.pt", role="operator")
    second = await make_user("equipa2@test.pt", role="admin")
    resp = await first.post("/api/v1/collection-requests", json=citizen_body(parish))
    assert resp.status_code == 201, resp.text
    scheduled_id = resp.json()["id"]
    tomorrow = datetime.now(UTC).date() + timedelta(days=1)
    resp = await second.post(
        "/api/v1/collection-requests",
        json=citizen_body(parish, address="Rua da Fila do Gestor, 1", date_=tomorrow),
    )
    assert resp.status_code == 201, resp.text
    exception_id = resp.json()["id"]
    # Sem filtros, a equipa vê os dois (o admin vê os do operador e vice-versa).
    resp = await first.get("/api/v1/collection-requests")
    assert resp.status_code == 200, resp.text
    ids = {row["id"] for row in resp.json()}
    assert {scheduled_id, exception_id} <= ids
    # A vista do próprio inclui o email de quem pediu (a equipa vê quem pediu; leitura própria não).
    row = next(r for r in resp.json() if r["id"] == scheduled_id)
    assert row["requester_email"] == "equipa1@test.pt"
    # A fila de exceções só traz a exceção.
    resp = await first.get("/api/v1/collection-requests", params={"state": "exception"})
    assert resp.status_code == 200, resp.text
    assert [row["id"] for row in resp.json()] == [exception_id]
    # E o filtro por sujeito.
    resp = await first.get("/api/v1/collection-requests", params={"subject": "local"})
    assert resp.status_code == 200, resp.text
    assert resp.json() == []
