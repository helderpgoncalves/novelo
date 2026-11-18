"""Lotes de escoamento na API: fechar por (estado, tipologia, estação, género), linhagem até às paragens.

Cor e tamanho ficam fora da chave e servem de filtros. Peças sem taxonomia completa (legadas ou
parciais) nunca entram. Uma peça só pode estar num lote de escoamento; a chave só tem um lote aberto.
Valores calculados à mão nos comentários.
"""

import uuid

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.features.network.models import Locality

KEY = {"fine_state": "grade_b", "garment_type": "jumper", "season": "warm", "gender": "women"}


def item(**over: object) -> dict[str, object]:
    """Peça triada completa (6 eixos); o destino deriva do estado fino no servidor."""
    base: dict[str, object] = {
        "garment_type": "jumper",
        "fine_state": "grade_b",
        "season": "warm",
        "gender": "women",
        "composition": [{"fibre": "wool", "pct": 100}],
        "estimated_weight_g": 400,
        "confidence": 0.9,
    }
    return {**base, **over}


async def add_item(c: httpx.AsyncClient, lot: str, **over: object) -> dict[str, object]:
    resp = await c.post(f"/api/v1/lots/{lot}/items", json=item(**over))
    assert resp.status_code == 201, resp.text
    created: dict[str, object] = resp.json()
    return created


async def open_export_lot(c: httpx.AsyncClient, **key: object) -> httpx.Response:
    return await c.post("/api/v1/export-lots", json={**KEY, **key})


async def must_open(c: httpx.AsyncClient, **key: object) -> dict[str, object]:
    resp = await open_export_lot(c, **key)
    assert resp.status_code == 201, resp.text
    lot: dict[str, object] = resp.json()
    return lot


async def stop(c: httpx.AsyncClient, session: AsyncSession, name: str) -> str:
    locality = (await session.execute(select(Locality).where(Locality.name == name))).scalar_one()
    resp = await c.post("/api/v1/lots/stops", json={"locality_id": str(locality.id)})
    assert resp.status_code == 201, resp.text
    code: str = resp.json()["code"]
    return code


async def test_closing_by_key_aggregates_only_matching_items(
    logged_in: httpx.AsyncClient, session: AsyncSession
) -> None:
    """9 peças triadas → 3 entram no lote (1,05 kg) vindas de 2 lotes de recolha (2 paragens)."""
    school = await stop(logged_in, session, "Abação")
    home = await stop(logged_in, session, "Aldão")

    blue = await add_item(logged_in, school, colour="blue", size_band="m")  # 400 g, entra
    black = await add_item(logged_in, school, colour="black", size_band="s")  # 400 g, entra
    await add_item(logged_in, school, fine_state="grade_a")  # outro estado fino: fora
    await add_item(logged_in, school, estimated_weight_g=500, fine_state=None, condition="reuse")  # legada: fora
    await add_item(logged_in, school, season=None)  # chave parcial (sem estação): fora
    pink = await add_item(logged_in, home, colour="pink", estimated_weight_g=250)  # 250 g, entra
    await add_item(logged_in, home, gender="men", estimated_weight_g=350)  # outro género: fora
    await add_item(logged_in, home, garment_type="shirt", estimated_weight_g=150)  # outra tipologia: fora
    await add_item(logged_in, home, season="cold", estimated_weight_g=300)  # outra estação: fora

    resp = await open_export_lot(logged_in)
    assert resp.status_code == 201, resp.text
    lot = resp.json()
    assert lot["code"].startswith("EXP-")
    assert lot["state"] == "open" and lot["taxonomy_version"] == 1
    assert {k: lot[k] for k in KEY} == KEY
    assert lot["items"] == 3 and lot["collection_lots"] == 2 and lot["localities"] == 2
    assert lot["weight_kg"] == 1.05  # 400 + 400 + 250 g
    assert lot["closed_at"] is None

    # Linhagem: o lote de recolha mais pesado primeiro, com a paragem de origem.
    assert [(o["lot_code"], o["locality_name"], o["items"], o["weight_kg"]) for o in lot["lineage"]] == [
        (school, "Abação", 2, 0.8),  # 400 + 400 g
        (home, "Aldão", 1, 0.25),
    ]
    assert {i["id"] for i in lot["item_list"]} == {blue["id"], black["id"], pink["id"]}
    assert {i["colour"] for i in lot["item_list"]} == {"blue", "black", "pink"}  # atributo, não chave
    assert {i["size_band"] for i in lot["item_list"]} == {"m", "s", None}  # rosa sem banda lida da etiqueta
    assert {i["lot_code"] for i in lot["item_list"]} == {school, home}
    # Privacidade: nenhum payload de escoamento traz criador nem dados de doador.
    body = str(lot)
    assert "created_by" not in body and "donor" not in body

    detail = (await logged_in.get(f"/api/v1/export-lots/{lot['code']}")).json()
    assert detail["items"] == 3 and {o["lot_code"] for o in detail["lineage"]} == {school, home}


async def test_no_matching_items_is_409(logged_in: httpx.AsyncClient) -> None:
    resp = await open_export_lot(logged_in)
    assert resp.status_code == 409 and resp.json()["code"] == "conflict"


async def test_one_open_lot_per_key_and_one_lot_per_piece(logged_in: httpx.AsyncClient, session: AsyncSession) -> None:
    code = await stop(logged_in, session, "Abação")
    await add_item(logged_in, code)  # 400 g: a peça fundadora do lote
    first = await must_open(logged_in)
    dup = await open_export_lot(logged_in)
    assert dup.status_code == 409  # já há um lote aberto com a mesma chave

    # Peças triadas depois do fecho não entram sozinhas: entram por POST /items.
    late = await add_item(logged_in, code, estimated_weight_g=300)
    added = await logged_in.post(f"/api/v1/export-lots/{first['code']}/items", json={"item_ids": [late["id"]]})
    assert added.status_code == 201, added.text
    assert added.json()["items"] == 2 and added.json()["weight_kg"] == 0.7  # 400 + 300 g

    # A mesma peça não entra duas vezes (um só lote de escoamento por peça):
    again = await logged_in.post(f"/api/v1/export-lots/{first['code']}/items", json={"item_ids": [late["id"]]})
    assert again.status_code == 409

    closed = await logged_in.post(f"/api/v1/export-lots/{first['code']}/close")
    assert closed.status_code == 200 and closed.json()["state"] == "closed"
    assert closed.json()["closed_at"] is not None
    reclose = await logged_in.post(f"/api/v1/export-lots/{first['code']}/close")
    assert reclose.status_code == 409  # já fechado

    # Fechado o lote, a chave fica livre — mas as peças já seguiram: o novo lote só apanha peças novas.
    await add_item(logged_in, code, estimated_weight_g=200)
    nxt = await must_open(logged_in)
    assert nxt["items"] == 1 and nxt["weight_kg"] == 0.2

    # Fechado não aceita peças: 409.
    stale = await add_item(logged_in, code, estimated_weight_g=100)
    closed_add = await logged_in.post(f"/api/v1/export-lots/{first['code']}/items", json={"item_ids": [stale["id"]]})
    assert closed_add.status_code == 409

    # E a peça do lote fechado nunca volta a entrar noutro:
    reused = await logged_in.post(f"/api/v1/export-lots/{nxt['code']}/items", json={"item_ids": [late["id"]]})
    assert reused.status_code == 409


async def test_add_items_rejects_key_mismatch_and_partial_taxonomy(
    logged_in: httpx.AsyncClient, session: AsyncSession
) -> None:
    code = await stop(logged_in, session, "Abação")
    await add_item(logged_in, code)  # funda o lote
    lot = await must_open(logged_in)
    other_key = await add_item(logged_in, code, gender="men")  # género diferente da chave
    partial = await add_item(logged_in, code, season=None)  # sem estação: sem chave completa

    mismatch = await logged_in.post(f"/api/v1/export-lots/{lot['code']}/items", json={"item_ids": [other_key["id"]]})
    assert mismatch.status_code == 409
    missing = await logged_in.post(f"/api/v1/export-lots/{lot['code']}/items", json={"item_ids": [partial["id"]]})
    assert missing.status_code == 409
    unknown = await logged_in.post(f"/api/v1/export-lots/{lot['code']}/items", json={"item_ids": [str(uuid.uuid4())]})
    assert unknown.status_code == 404


async def test_unknown_export_lot_is_404(logged_in: httpx.AsyncClient) -> None:
    assert (await logged_in.get("/api/v1/export-lots/EXP-XXXXXX")).status_code == 404


async def test_list_filters_by_key_axes_and_by_colour_and_size(
    logged_in: httpx.AsyncClient, session: AsyncSession
) -> None:
    code = await stop(logged_in, session, "Abação")
    # Peças primeiro, para os três lotes nascerem com conteúdo:
    # azul/M em grade_b mulheres, branca/L em grade_a mulheres, azul/L em grade_b homens (camisa).
    await add_item(logged_in, code, colour="blue", size_band="m")  # 400 g
    await add_item(logged_in, code, fine_state="grade_a", colour="white", size_band="l")  # 400 g
    await add_item(logged_in, code, gender="men", garment_type="shirt", colour="blue", size_band="l")  # 400 g

    women = await must_open(logged_in)  # grade_b jumper warm women → a peça azul/M
    premium = await must_open(logged_in, fine_state="grade_a")  # → a branca/L
    shirts = await must_open(logged_in, gender="men", garment_type="shirt")  # → a azul/L
    assert women["items"] == 1 and premium["items"] == 1 and shirts["items"] == 1

    lots = (await logged_in.get("/api/v1/export-lots")).json()
    assert {e["code"] for e in lots} == {women["code"], premium["code"], shirts["code"]}

    by_state = (await logged_in.get("/api/v1/export-lots", params={"fine_state": "grade_a"})).json()
    assert {e["code"] for e in by_state} == {premium["code"]}
    by_gender = (await logged_in.get("/api/v1/export-lots", params={"gender": "men"})).json()
    assert {e["code"] for e in by_gender} == {shirts["code"]}
    # Cor e tamanho filtram sem entrarem na chave: «tem azul?» e «tem azul M?»
    blue = (await logged_in.get("/api/v1/export-lots", params={"colour": "blue"})).json()
    assert {e["code"] for e in blue} == {women["code"], shirts["code"]}
    blue_m = (await logged_in.get("/api/v1/export-lots", params={"colour": "blue", "size_band": "m"})).json()
    assert {e["code"] for e in blue_m} == {women["code"]}
    size_l = (await logged_in.get("/api/v1/export-lots", params={"size_band": "l"})).json()
    assert {e["code"] for e in size_l} == {premium["code"], shirts["code"]}
    # E os filtros combinam com a chave:
    blue_men = (await logged_in.get("/api/v1/export-lots", params={"gender": "men", "colour": "blue"})).json()
    assert {e["code"] for e in blue_men} == {shirts["code"]}


async def test_export_lots_need_a_session(logged_in: httpx.AsyncClient) -> None:
    anonymous = httpx.AsyncClient(transport=logged_in._transport, base_url="http://test")
    assert (await anonymous.get("/api/v1/export-lots")).status_code == 401
    assert (await anonymous.post("/api/v1/export-lots", json=KEY)).status_code == 401
