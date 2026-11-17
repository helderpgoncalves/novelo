"""Lote de recolha nascido na paragem: ancorado ao local e à freguesia, peso medido, um QR por unidade física.

O lote abre quando a viatura chega («Cheguei»), acumula unidades (sacos com QR próprio ou etiqueta impressa
com UUID) e pesos medidos, e fecha quando a viatura parte («Partir»). #58 (ecrã da viatura) e #59 (conta de
local) consomem estes endpoints; o passaporte público mostra o peso medido e a paragem, nunca o doador.
"""

import uuid

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.features.network.models import Locality


async def _locality(session: AsyncSession, name: str = "Abação") -> Locality:
    return (await session.execute(select(Locality).where(Locality.name == name))).scalar_one()


async def _open_stop(c: httpx.AsyncClient, locality_id: uuid.UUID) -> httpx.Response:
    return await c.post("/api/v1/lots/stops", json={"locality_id": str(locality_id)})


async def test_open_lot_at_stop_anchors_local_and_parish(logged_in: httpx.AsyncClient, session: AsyncSession) -> None:
    locality = await _locality(session)
    assert locality.parish_id is not None  # o seed liga a localidade à freguesia
    resp = await _open_stop(logged_in, locality.id)
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["code"].startswith("NOV-")
    assert body["state"] == "collected"
    assert body["locality_id"] == str(locality.id)
    assert body["locality_name"] == locality.name
    assert body["parish_code"] is not None
    # Sem unidades pesadas, o peso cai no caminho antigo (estimado pelas peças, zero aqui).
    assert body["weight_kg"] == 0 and body["weight_source"] == "estimated"
    assert body["units"] == 0
    # A freguesia pode vir explícita (paragem à porta noutra freguesia) ou deduzir-se do local.
    other = (await session.execute(select(Locality).where(Locality.name == "Aldão"))).scalar_one()
    explicit = await logged_in.post(
        "/api/v1/lots/stops", json={"locality_id": str(other.id), "parish_code": body["parish_code"]}
    )
    assert explicit.status_code == 201, explicit.text
    assert explicit.json()["parish_code"] == body["parish_code"]


async def test_open_lot_at_unknown_locality_is_404(logged_in: httpx.AsyncClient) -> None:
    resp = await logged_in.post("/api/v1/lots/stops", json={"locality_id": str(uuid.uuid4())})
    assert resp.status_code == 404
    assert resp.json()["code"] == "not_found"


async def test_units_accumulate_one_qr_per_physical_unit(logged_in: httpx.AsyncClient, session: AsyncSession) -> None:
    locality = await _locality(session)
    code = (await _open_stop(logged_in, locality.id)).json()["code"]

    # Saco da plataforma com QR próprio: a unidade guarda o código lido.
    bag = await logged_in.post(f"/api/v1/lots/{code}/units", json={"bag_code": " NOV-SACO-0001 "})
    assert bag.status_code == 201, bag.text
    unit = bag.json()
    assert unit["source"] == "bag" and unit["code"] == "NOV-SACO-0001"  # sem espaços: o scan vem sujo
    assert unit["weight_g"] is None  # ainda sem peso medido

    # Saco sem QR: etiqueta impressa na viatura com UUID no QR.
    label = await logged_in.post(f"/api/v1/lots/{code}/units", json={})
    assert label.status_code == 201, label.text
    labeled = label.json()
    assert labeled["source"] == "label"
    assert str(uuid.UUID(labeled["code"])) == labeled["code"]  # o QR da etiqueta é um UUID

    # O mesmo QR não entra duas vezes no lote.
    dup = await logged_in.post(f"/api/v1/lots/{code}/units", json={"bag_code": "NOV-SACO-0001"})
    assert dup.status_code == 409 and dup.json()["code"] == "conflict"

    # A etiqueta imprime-se: o QR em SVG é determinístico por código e muda de unidade para unidade.
    qr = await logged_in.get(f"/api/v1/lots/{code}/units/{labeled['id']}/qr")
    assert qr.status_code == 200 and qr.headers["content-type"] == "image/svg+xml" and b"<svg" in qr.content
    again = await logged_in.get(f"/api/v1/lots/{code}/units/{labeled['id']}/qr")
    assert again.content == qr.content
    bag_qr = await logged_in.get(f"/api/v1/lots/{code}/units/{unit['id']}/qr")
    assert bag_qr.content != qr.content  # códigos diferentes, QR diferente
    assert (await logged_in.get(f"/api/v1/lots/{code}/units/{uuid.uuid4()}/qr")).status_code == 404

    # Unidade de outro lote não é encontrada aqui.
    other_code = (await _open_stop(logged_in, locality.id)).json()["code"]
    stray = await logged_in.put(f"/api/v1/lots/{other_code}/units/{unit['id']}", json={"weight_g": 4200})
    assert stray.status_code == 404


async def test_measured_weight_closes_the_stop(logged_in: httpx.AsyncClient, session: AsyncSession) -> None:
    locality = await _locality(session)
    code = (await _open_stop(logged_in, locality.id)).json()["code"]
    u1 = (await logged_in.post(f"/api/v1/lots/{code}/units", json={"bag_code": "SACO-A"})).json()
    u2 = (await logged_in.post(f"/api/v1/lots/{code}/units", json={})).json()

    # Não se parte com sacos por pesar: o peso do lote tem de ser medido.
    early = await logged_in.post(f"/api/v1/lots/{code}/departure")
    assert early.status_code == 409 and early.json()["code"] == "conflict"

    # Peso fora do razoável (0 ou acima de 30 kg) recusa-se na balança.
    assert (await logged_in.put(f"/api/v1/lots/{code}/units/{u1['id']}", json={"weight_g": 0})).status_code == 422
    assert (await logged_in.put(f"/api/v1/lots/{code}/units/{u1['id']}", json={"weight_g": 31000})).status_code == 422

    # 4200 g + 3800 g = 8000 g = 8,0 kg medidos.
    assert (await logged_in.put(f"/api/v1/lots/{code}/units/{u1['id']}", json={"weight_g": 4200})).json()[
        "weight_g"
    ] == 4200
    assert (await logged_in.put(f"/api/v1/lots/{code}/units/{u2['id']}", json={"weight_g": 3800})).status_code == 200

    detail = (await logged_in.get(f"/api/v1/lots/{code}")).json()
    assert detail["weight_kg"] == 8.0 and detail["weight_source"] == "measured"
    assert detail["units"] == 2
    assert sorted(u["code"] for u in detail["unit_list"]) == sorted(["SACO-A", u2["code"]])

    # «Partir»: fecha a paragem; o lote segue para a mesa de triagem no estado collected.
    departed = await logged_in.post(f"/api/v1/lots/{code}/departure")
    assert departed.status_code == 200, departed.text
    assert departed.json()["weight_kg"] == 8.0 and departed.json()["weight_source"] == "measured"
    assert any(e["kind"] == "departed" for e in departed.json()["events"])

    # Depois de partir não entram mais unidades nem se muda o peso (o prato já lá não está).
    assert (await logged_in.post(f"/api/v1/lots/{code}/units", json={})).status_code == 409
    assert (await logged_in.put(f"/api/v1/lots/{code}/units/{u1['id']}", json={"weight_g": 4100})).status_code == 409
    # Nem se parte duas vezes.
    assert (await logged_in.post(f"/api/v1/lots/{code}/departure")).status_code == 409

    # A peça ainda entra na mesa de triagem (o estado continua collected)…
    item = {
        "garment_type": "jumper",
        "condition": "reuse",
        "composition": [{"fibre": "wool", "pct": 100}],
        "estimated_weight_g": 400,
    }
    assert (await logged_in.post(f"/api/v1/lots/{code}/items", json=item)).status_code == 201
    # …e o peso do lote continua o medido: a estimativa das peças não substitui a balança.
    after = (await logged_in.get(f"/api/v1/lots/{code}")).json()
    assert after["weight_kg"] == 8.0 and after["weight_source"] == "measured"


async def test_unit_can_be_removed_before_departure(logged_in: httpx.AsyncClient, session: AsyncSession) -> None:
    locality = await _locality(session)
    code = (await _open_stop(logged_in, locality.id)).json()["code"]
    unit = (await logged_in.post(f"/api/v1/lots/{code}/units", json={"bag_code": "SACO-ERRADO"})).json()
    await logged_in.put(f"/api/v1/lots/{code}/units/{unit['id']}", json={"weight_g": 1000})
    assert (await logged_in.delete(f"/api/v1/lots/{code}/units/{unit['id']}")).status_code == 204
    detail = (await logged_in.get(f"/api/v1/lots/{code}")).json()
    assert detail["units"] == 0 and detail["weight_kg"] == 0 and detail["weight_source"] == "estimated"
    # A saída de uma unidade fica no histórico do lote.
    assert any(e["kind"] == "unit_removed" for e in detail["events"])


async def test_stop_close_requires_units(logged_in: httpx.AsyncClient, session: AsyncSession) -> None:
    """Paragem sem sacos não fecha lote: não há lote sem unidades (o peso seria zero)."""
    locality = await _locality(session)
    code = (await _open_stop(logged_in, locality.id)).json()["code"]
    resp = await logged_in.post(f"/api/v1/lots/{code}/departure")
    assert resp.status_code == 409 and resp.json()["code"] == "conflict"


async def test_passport_shows_measured_weight_and_stop_never_donor(
    logged_in: httpx.AsyncClient, session: AsyncSession
) -> None:
    locality = await _locality(session)
    code = (await _open_stop(logged_in, locality.id)).json()["code"]
    unit = (await logged_in.post(f"/api/v1/lots/{code}/units", json={})).json()
    await logged_in.put(f"/api/v1/lots/{code}/units/{unit['id']}", json={"weight_g": 4300})
    item = {
        "garment_type": "tshirt",
        "condition": "reuse",
        "composition": [{"fibre": "cotton", "pct": 100}],
        "estimated_weight_g": 150,
    }
    await logged_in.post(f"/api/v1/lots/{code}/items", json=item)
    await logged_in.post(f"/api/v1/lots/{code}/departure")

    anonymous = httpx.AsyncClient(transport=logged_in._transport, base_url="http://test")
    passport = (await anonymous.get(f"/api/v1/public/lots/{code}")).json()
    # Peso medido na paragem (4,3 kg), não a estimativa das peças (0,15 kg).
    assert passport["weight_kg"] == 4.3 and passport["weight_source"] == "measured"
    # A paragem: local e freguesia.
    assert passport["locality_name"] == locality.name and passport["parish_name"] is not None
    # Nunca o doador nem os códigos das unidades (o QR do saco é de quem o carrega).
    assert "created_by" not in str(passport) and "donor" not in str(passport)
    assert "units" not in passport and "unit_list" not in passport
    assert any(e["kind"] == "departed" for e in passport["events"])

    # Lote só estimado (legado): o passaporte diz que o peso é estimativa.
    legacy = (await logged_in.post("/api/v1/lots", json={"parish_code": None})).json()["code"]
    await logged_in.post(
        f"/api/v1/lots/{legacy}/items",
        json={**item, "estimated_weight_g": 200},
    )
    legacy_passport = (await anonymous.get(f"/api/v1/public/lots/{legacy}")).json()
    assert legacy_passport["weight_kg"] == 0.2 and legacy_passport["weight_source"] == "estimated"
    await anonymous.aclose()


async def test_list_lots_filters_by_locality(logged_in: httpx.AsyncClient, session: AsyncSession) -> None:
    locality = await _locality(session)
    stop_code = (await _open_stop(logged_in, locality.id)).json()["code"]
    unit = (await logged_in.post(f"/api/v1/lots/{stop_code}/units", json={})).json()
    await logged_in.put(f"/api/v1/lots/{stop_code}/units/{unit['id']}", json={"weight_g": 5200})
    await logged_in.post("/api/v1/lots", json={"parish_code": None})

    listed = (await logged_in.get("/api/v1/lots", params={"locality_id": str(locality.id)})).json()
    assert [lot["code"] for lot in listed] == [stop_code]
    assert listed[0]["weight_kg"] == 5.2 and listed[0]["weight_source"] == "measured"
    assert listed[0]["units"] == 1 and listed[0]["items"] == 0
