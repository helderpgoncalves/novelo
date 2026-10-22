import base64

import httpx
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.features.lots import service as lots_service
from novelo.features.lots.schemas import CompositionPart, TriageAnalysis
from tests.conftest import FakeLlm

# PNG 1x1 válido
PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
)
ITEM = {
    "garment_type": "jumper",
    "condition": "reuse",
    "composition": [{"fibre": "wool", "pct": 80}, {"fibre": "polyester", "pct": 20}],
    "brand": "  zara ",
    "estimated_weight_g": 400,
    "confidence": 0.9,
}


async def open_lot(c: httpx.AsyncClient, parish: str | None = None) -> str:
    return (await c.post("/api/v1/lots", json={"parish_code": parish})).json()["code"]


async def test_lot_lifecycle_and_public_passport(logged_in: httpx.AsyncClient) -> None:
    zones = (await logged_in.get("/api/v1/planning/zones")).json()
    azurem = next(z for z in zones if z["name"] == "Azurém")["code"]
    code = await open_lot(logged_in, azurem)
    assert code.startswith("NOV-") and len(code) == 10

    # Não se fecha um lote vazio.
    assert (await logged_in.post(f"/api/v1/lots/{code}/state", json={"state": "sorted"})).json()["code"] == "conflict"

    assert (await logged_in.post(f"/api/v1/lots/{code}/items", json=ITEM)).status_code == 201
    other = {
        **ITEM,
        "garment_type": "tshirt",
        "condition": "recycle",
        "estimated_weight_g": 200,
        "composition": [{"fibre": "cotton", "pct": 100}],
        "brand": "Zara",
    }
    await logged_in.post(f"/api/v1/lots/{code}/items", json=other)

    detail = (await logged_in.get(f"/api/v1/lots/{code}")).json()
    assert detail["items"] == 2 and detail["weight_kg"] == pytest.approx(0.6)
    assert detail["dominant_fibre"] == "wool"  # 320 g de lã vs 200 g de algodão
    assert detail["reuse_kg"] == pytest.approx(0.4) and detail["recycle_kg"] == pytest.approx(0.2)
    comp = {p["fibre"]: p["pct"] for p in detail["composition"]}
    assert comp["wool"] == pytest.approx(53.3, abs=0.1) and sum(comp.values()) == pytest.approx(100, abs=0.2)

    closed = await logged_in.post(f"/api/v1/lots/{code}/state", json={"state": "sorted"})
    assert closed.json()["state"] == "sorted"
    assert (await logged_in.post(f"/api/v1/lots/{code}/items", json=ITEM)).json()["code"] == "conflict"

    # Passaporte: público (sem sessão) e sem dados pessoais.
    anonymous = httpx.AsyncClient(transport=logged_in._transport, base_url="http://test")
    passport = (await anonymous.get(f"/api/v1/public/lots/{code}")).json()
    assert passport["parish_name"] == "Azurém" and passport["brands"] == [{"brand": "Zara", "items": 2}]
    assert "reservation" not in passport and "created_by" not in str(passport)
    qr = await anonymous.get(f"/api/v1/public/lots/{code}/qr")
    assert qr.headers["content-type"] == "image/svg+xml" and b"<svg" in qr.content
    assert b'fill="#fff"' in qr.content  # fundo branco: o QR lê-se também no tema escuro
    assert (await anonymous.get("/api/v1/public/lots/NOV-NAOEXI")).status_code == 404
    assert (await anonymous.get("/api/v1/lots")).status_code == 401  # a lista é privada


async def test_composition_must_add_up_to_100(logged_in: httpx.AsyncClient) -> None:
    code = await open_lot(logged_in)
    bad = {**ITEM, "composition": [{"fibre": "wool", "pct": 50}]}
    assert (await logged_in.post(f"/api/v1/lots/{code}/items", json=bad)).status_code == 422


async def test_market_reservation_and_brand_evidence(logged_in: httpx.AsyncClient, session: AsyncSession) -> None:
    code = await open_lot(logged_in)
    await logged_in.post(f"/api/v1/lots/{code}/items", json=ITEM)
    # Só lotes triados aparecem na bolsa e podem ser reservados.
    assert (
        await logged_in.post(
            f"/api/v1/market/{code}/reserve", json={"recycler_name": "Têxtil do Ave", "contact": "a@b.pt"}
        )
    ).json()["code"] == "conflict"
    await logged_in.post(f"/api/v1/lots/{code}/state", json={"state": "sorted"})

    market = (await logged_in.get("/api/v1/market", params={"fibre": "wool"})).json()
    assert market[0]["fibre"] == "wool" and any(i["code"] == code for i in market[0]["items"])

    reserved = await logged_in.post(
        f"/api/v1/market/{code}/reserve", json={"recycler_name": "Têxtil do Ave", "contact": "a@b.pt"}
    )
    assert reserved.json()["state"] == "reserved" and reserved.json()["reservation"]["recycler_name"] == "Têxtil do Ave"
    assert (await logged_in.post(f"/api/v1/lots/{code}/state", json={"state": "delivered"})).json()[
        "state"
    ] == "delivered"
    assert (await logged_in.post(f"/api/v1/lots/{code}/state", json={"state": "collected"})).json()[
        "code"
    ] == "conflict"  # só avança

    # Entregue sai da bolsa, mas continua a contar como lote triado no relatório RAP.
    market = (await logged_in.get("/api/v1/market")).json()
    assert all(i["code"] != code for e in market for i in e["items"])
    sorted_lots = await lots_service.market(session, None, lots_service.SORTED_STATES)
    assert any(i.code == code for e in sorted_lots for i in e.items)

    brands = (await logged_in.get("/api/v1/brands")).json()
    zara = next(b for b in brands["brands"] if b["brand"] == "Zara")
    assert zara["items"] >= 1 and zara["top_fibre"] == "wool"


async def test_triage_analyses_photos_without_storing_them(logged_in: httpx.AsyncClient, llm: FakeLlm) -> None:
    llm.queue(
        "TriageAnalysis",
        TriageAnalysis(
            garment_type="shirt",
            condition="reuse",
            composition=[CompositionPart(fibre="cotton", pct=100)],
            brand="Mango",
            confidence=0.82,
            notes="Legible label",
        ),
    )
    resp = await logged_in.post(
        "/api/v1/triage",
        files={"item_photo": ("a.png", PNG, "image/png"), "label_photo": ("b.png", PNG, "image/png")},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["analysis"]["brand"] == "Mango" and body["dominant_fibre"] == "cotton"
    assert body["estimated_weight_g"] == 200 and body["prompt_version"] == "v3"  # peso calculado no servidor
    sent = llm.calls[0]["user"]
    assert isinstance(sent, list) and sum(1 for p in sent if p["type"] == "image_url") == 2  # type: ignore[index]
    assert "notes`: pt-PT" in sent[0]["text"]  # type: ignore[index]  # a nota vem na língua do ecrã


async def test_triage_rejects_non_images(logged_in: httpx.AsyncClient, llm: FakeLlm) -> None:
    resp = await logged_in.post("/api/v1/triage", files={"item_photo": ("a.png", b"not an image", "image/png")})
    assert resp.status_code == 400


async def test_triage_sends_reduced_jpeg_photos_to_the_vision_model(logged_in: httpx.AsyncClient, llm: FakeLlm) -> None:
    llm.queue(
        "TriageAnalysis",
        TriageAnalysis(
            garment_type="shirt",
            condition="reuse",
            composition=[CompositionPart(fibre="cotton", pct=100)],
            brand=None,
            confidence=0.8,
            notes="ok",
        ),
    )
    resp = await logged_in.post("/api/v1/triage", files={"item_photo": ("a.png", PNG, "image/png")})
    assert resp.status_code == 200 and resp.json()["model"] == "fake/model"
    urls = [p["image_url"]["url"] for p in llm.calls[-1]["user"] if p["type"] == "image_url"]  # type: ignore[union-attr]
    assert urls and all(u.startswith("data:image/jpeg;base64,") for u in urls)
