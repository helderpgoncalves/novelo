"""Taxonomia da triagem na API: estado fino deriva o destino, proveniência por atributo e rótulos dourados."""

import base64

import httpx
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.features.lots.schemas import CompositionPart, TriageAnalysis
from tests.conftest import FakeLlm

# PNG 1x1 válido
PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
)

PROPOSAL = {
    "model": "fake/model",
    "prompt_version": "4",
    "confidence": 0.8,
    "values": {
        "garment_type": "jumper",
        "fine_state": "grade_a",
        "season": "all_season",
        "colour": "black",
        "gender": "women",
        "size_band": "m",
    },
}

ITEM = {
    "garment_type": "jumper",
    "fine_state": "grade_b",
    "season": "all_season",
    "colour": "blue",
    "gender": "women",
    "size_band": "m",
    "composition": [{"fibre": "wool", "pct": 100}],
    "estimated_weight_g": 400,
    "confidence": 0.8,
    "ai_proposal": PROPOSAL,
}


async def open_lot(c: httpx.AsyncClient) -> str:
    return (await c.post("/api/v1/lots", json={})).json()["code"]


async def test_fine_state_derives_the_destination(logged_in: httpx.AsyncClient) -> None:
    code = await open_lot(logged_in)
    # grade_b é reutilização: o destino derivado mantém passaporte, bolsa e RAP a funcionar.
    created = await logged_in.post(f"/api/v1/lots/{code}/items", json={**ITEM, "ai_proposal": None})
    assert created.status_code == 201
    item = created.json()
    assert item["fine_state"] == "grade_b"
    assert item["condition"] == "reuse"  # derivado do estado fino
    assert item["season"] == "all_season" and item["colour"] == "blue" and item["gender"] == "women"
    assert item["size_band"] == "m"

    detail = (await logged_in.get(f"/api/v1/lots/{code}")).json()
    assert detail["reuse_kg"] == pytest.approx(0.4) and detail["recycle_kg"] == 0 and detail["reject_kg"] == 0


async def test_recycle_and_reject_fine_states_derive_their_destinations(logged_in: httpx.AsyncClient) -> None:
    code = await open_lot(logged_in)
    base = {**ITEM, "composition": [{"fibre": "cotton", "pct": 100}]}
    await logged_in.post(
        f"/api/v1/lots/{code}/items",
        json={**base, "fine_state": "recycle", "estimated_weight_g": 200, "ai_proposal": None},
    )
    await logged_in.post(
        f"/api/v1/lots/{code}/items",
        json={**base, "fine_state": "reject", "estimated_weight_g": 100, "ai_proposal": None},
    )
    detail = (await logged_in.get(f"/api/v1/lots/{code}")).json()
    assert detail["recycle_kg"] == pytest.approx(0.2) and detail["reject_kg"] == pytest.approx(0.1)
    assert detail["reuse_kg"] == 0


async def test_legacy_condition_only_still_works(logged_in: httpx.AsyncClient) -> None:
    # O seed de demonstração e clientes antigos mandam só o destino: a peça entra sem estado fino
    # (fica fora dos lotes de escoamento até re-triagem).
    code = await open_lot(logged_in)
    excluded = {"fine_state", "season", "colour", "gender", "size_band", "ai_proposal"}
    legacy = {k: v for k, v in ITEM.items() if k not in excluded}
    legacy["condition"] = "reuse"
    created = await logged_in.post(f"/api/v1/lots/{code}/items", json=legacy)
    assert created.status_code == 201
    item = created.json()
    assert item["condition"] == "reuse" and item["fine_state"] is None
    assert item["season"] is None and item["provenance"] is None


async def test_destination_is_required_and_must_agree(logged_in: httpx.AsyncClient) -> None:
    code = await open_lot(logged_in)
    # Nem estado fino nem destino: 422.
    neither = {k: v for k, v in ITEM.items() if k not in {"fine_state", "ai_proposal"}}
    assert (await logged_in.post(f"/api/v1/lots/{code}/items", json=neither)).status_code == 422
    # Os dois, em desacordo: 422 (o destino é sempre derivado do estado fino).
    conflict = {**ITEM, "condition": "reject"}
    assert (await logged_in.post(f"/api/v1/lots/{code}/items", json=conflict)).status_code == 422
    # Os dois, em acordo: aceita.
    agree = {**ITEM, "condition": "reuse"}
    assert (await logged_in.post(f"/api/v1/lots/{code}/items", json=agree)).status_code == 201


async def test_triage_returns_destination_derived_from_fine_state(logged_in: httpx.AsyncClient, llm: FakeLlm) -> None:
    llm.queue(
        "TriageAnalysis",
        TriageAnalysis(
            garment_type="shirt",
            fine_state="grade_c",
            season="warm",
            colour="white",
            gender="men",
            size_band="l",
            composition=[CompositionPart(fibre="cotton", pct=100)],
            brand=None,
            confidence=0.7,
            notes="Camisa de algodão",
        ),
    )
    result = (
        await logged_in.post(
            "/api/v1/triage",
            files={"item_photo": ("peca.png", PNG, "image/png")},
            data={"locale": "pt-PT"},
        )
    ).json()
    assert result["analysis"]["fine_state"] == "grade_c"
    assert result["destination"] == "reuse"  # derivado no servidor: a IA não decide o destino duas vezes
    assert result["analysis"]["colour"] == "white" and result["analysis"]["gender"] == "men"


async def test_operator_corrections_become_golden_labels(logged_in: httpx.AsyncClient, session: AsyncSession) -> None:
    code = await open_lot(logged_in)
    created = await logged_in.post(f"/api/v1/lots/{code}/items", json=ITEM)
    item = created.json()
    # Corrigiu o estado (grade_a → grade_b) e a cor (black → blue); aceitou género e estação.
    prov = item["provenance"]
    assert prov["fine_state"] == {"origin": "confirmed", "confidence": 1.0}
    assert prov["colour"] == {"origin": "confirmed", "confidence": 1.0}
    assert prov["gender"] == {"origin": "ai", "confidence": 0.8}  # aceite tal e qual
    assert prov["season"] == {"origin": "ai", "confidence": 0.8}
    assert prov["size_band"] == {"origin": "ai", "confidence": 0.8}

    labels = (await logged_in.get("/api/v1/triage/golden-labels")).json()
    by_axis = {lab["axis"]: lab for lab in labels}
    assert set(by_axis) == {"fine_state", "colour"}  # só as correções são rótulos dourados
    assert by_axis["fine_state"]["ai_value"] == "grade_a"
    assert by_axis["fine_state"]["operator_value"] == "grade_b"
    assert by_axis["colour"]["ai_value"] == "black" and by_axis["colour"]["operator_value"] == "blue"
    assert all(lab["lot_code"] == code and lab["model"] == "fake/model" for lab in labels)
    assert all(lab["ai_confidence"] == 0.8 for lab in labels)


async def test_accepting_the_whole_proposal_creates_no_golden_labels(logged_in: httpx.AsyncClient) -> None:
    code = await open_lot(logged_in)
    accepted = {
        **ITEM,
        "fine_state": "grade_a",
        "colour": "black",
        "season": "all_season",
        "ai_proposal": {**PROPOSAL, "values": {**PROPOSAL["values"], "garment_type": "jumper"}},
    }
    item = (await logged_in.post(f"/api/v1/lots/{code}/items", json=accepted)).json()
    assert all(src["origin"] == "ai" for src in item["provenance"].values())
    assert (await logged_in.get("/api/v1/triage/golden-labels")).json() == []


async def test_golden_labels_filter_by_axis_and_need_session(logged_in: httpx.AsyncClient) -> None:
    code = await open_lot(logged_in)
    await logged_in.post(f"/api/v1/lots/{code}/items", json=ITEM)
    only_colour = (await logged_in.get("/api/v1/triage/golden-labels", params={"axis": "colour"})).json()
    assert {lab["axis"] for lab in only_colour} == {"colour"}
    anonymous = httpx.AsyncClient(transport=logged_in._transport, base_url="http://test")
    assert (await anonymous.get("/api/v1/triage/golden-labels")).status_code == 401
