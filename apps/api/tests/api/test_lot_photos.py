"""Miniaturas das peças: consentimento, estado do lote, cabeçalhos, passaporte, retenção e consultas leves."""

import io
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

import httpx
from PIL import Image
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.core.config import get_settings
from novelo.features.audit.models import AuditLog
from novelo.features.lots import photo_store
from novelo.features.lots import service as lots_service
from novelo.features.lots.models import Lot, LotItem, LotItemPhoto
from novelo.main import API_PREFIX
from tests.api.test_lots import ITEM, open_lot
from tests.querycount import capture_sql

P = "/api/v1"


def _jpeg(size: tuple[int, int] = (800, 400), color: str = "green") -> bytes:
    exif = Image.Exif()
    exif[0x010F] = "SecretCamera"
    out = io.BytesIO()
    Image.new("RGB", size, color).save(out, format="JPEG", exif=exif)
    return out.getvalue()


async def _item(c: httpx.AsyncClient) -> tuple[str, str]:
    code = await open_lot(c)
    item = (await c.post(f"{P}/lots/{code}/items", json=ITEM)).json()
    return code, item["id"]


async def _put(
    c: httpx.AsyncClient, code: str, item: str, data: bytes | None = None, confirm: bool = True, **extra: str
) -> httpx.Response:
    form = {**extra, **({"confirm_no_people": "true"} if confirm else {})}
    return await c.put(
        f"{P}/lots/{code}/items/{item}/photo",
        files={"photo": ("p.jpg", data if data is not None else _jpeg(), "image/jpeg")},
        data=form,
    )


def test_api_prefix_constant_matches_main() -> None:
    assert lots_service.API_PREFIX == API_PREFIX


async def test_upload_requires_consent_and_stores_clean_jpeg(
    logged_in: httpx.AsyncClient, session: AsyncSession
) -> None:
    code, item = await _item(logged_in)
    missing = await _put(logged_in, code, item, confirm=False)
    assert missing.status_code == 422 and missing.json()["code"] == "consent_required"
    assert (await session.scalar(select(func.count()).select_from(LotItemPhoto))) == 0

    ok = await _put(logged_in, code, item)
    assert ok.status_code == 204
    row = (await session.execute(select(LotItemPhoto))).scalar_one()
    assert (row.width, row.height, row.mime) == (640, 320, "image/jpeg")
    assert row.size_bytes <= get_settings().lot_photo_max_bytes
    assert row.consent_at is not None and row.credit is None
    days = (row.expires_at - row.consent_at).days
    assert days == get_settings().lot_photo_retention_days == 90 or days == 89

    got = await logged_in.get(f"{P}/lots/{code}/items/{item}/photo")
    assert got.status_code == 200 and got.headers["content-type"] == "image/jpeg"
    assert b"SecretCamera" not in got.content and Image.open(io.BytesIO(got.content)).size == (640, 320)
    assert got.headers["cache-control"] == "private, no-cache" and got.headers["content-disposition"] == "inline"

    detail = (await logged_in.get(f"{P}/lots/{code}")).json()["item_list"][0]
    assert detail["has_photo"] is True and detail["photo_url"] == f"{P}/lots/{code}/items/{item}/photo"


async def test_audit_records_save_and_delete_without_bytes(logged_in: httpx.AsyncClient, session: AsyncSession) -> None:
    code, item = await _item(logged_in)
    await _put(logged_in, code, item)
    await logged_in.delete(f"{P}/lots/{code}/items/{item}/photo")
    rows = (await session.execute(select(AuditLog).where(AuditLog.action.startswith("lot.photo")))).scalars().all()
    assert sorted(r.action for r in rows) == ["lot.photo.delete", "lot.photo.save"]
    assert all(r.target_id == item and "content" not in r.details for r in rows)
    save = next(r for r in rows if r.action == "lot.photo.save")
    assert save.details["replaced"] is False and save.details["lot"] == code


async def test_replace_and_delete(logged_in: httpx.AsyncClient, session: AsyncSession) -> None:
    code, item = await _item(logged_in)
    await _put(logged_in, code, item, _jpeg(color="red"))
    first = await logged_in.get(f"{P}/lots/{code}/items/{item}/photo")
    assert (await _put(logged_in, code, item, _jpeg(color="blue"))).status_code == 204
    assert (await session.scalar(select(func.count()).select_from(LotItemPhoto))) == 1
    second = await logged_in.get(f"{P}/lots/{code}/items/{item}/photo")
    assert first.headers["etag"] != second.headers["etag"] and first.content != second.content

    assert (await logged_in.delete(f"{P}/lots/{code}/items/{item}/photo")).status_code == 204
    assert (await logged_in.get(f"{P}/lots/{code}/items/{item}/photo")).status_code == 404
    assert (await logged_in.delete(f"{P}/lots/{code}/items/{item}/photo")).status_code == 204  # idempotente
    assert (await logged_in.get(f"{P}/lots/{code}")).json()["item_list"][0]["has_photo"] is False


async def test_invalid_uploads_and_unknown_targets(logged_in: httpx.AsyncClient) -> None:
    code, item = await _item(logged_in)
    svg = b"<svg xmlns='http://www.w3.org/2000/svg'/>"
    for bad in (svg, b"%PDF-1.4 x", b""):
        resp = await _put(logged_in, code, item, bad)
        assert resp.status_code == 400 and resp.json()["code"] == "bad_request"
    assert (await _put(logged_in, code, item, b"\xff\xd8\xff" + b"0" * (5 * 1024 * 1024))).status_code == 400
    assert (await _put(logged_in, "NOV-NAOEXI", item)).status_code == 404
    assert (await _put(logged_in, code, str(uuid.uuid4()))).status_code == 404
    other, _ = await _item(logged_in)
    assert (await _put(logged_in, other, item)).status_code == 404  # a peça não é deste lote
    assert (await logged_in.get(f"{P}/lots/{code}/items/{item}/photo")).status_code == 404
    assert (await logged_in.get(f"{P}/lots/{code}/items/not-a-uuid/photo")).status_code == 422


async def test_guest_cannot_upload_or_delete(logged_in: httpx.AsyncClient, make_user: Any) -> None:
    code, item = await _item(logged_in)
    guest = await make_user("convidado@example.com", "guest")
    assert (await _put(guest, code, item)).status_code == 403
    assert (await guest.delete(f"{P}/lots/{code}/items/{item}/photo")).status_code == 403
    await _put(logged_in, code, item)
    assert (await guest.get(f"{P}/lots/{code}/items/{item}/photo")).status_code == 200  # ler pode
    anonymous = httpx.AsyncClient(transport=logged_in._transport, base_url="http://test")
    assert (await anonymous.get(f"{P}/lots/{code}/items/{item}/photo")).status_code == 401
    assert (await anonymous.put(f"{P}/lots/{code}/items/{item}/photo")).status_code == 401


async def test_lot_state_rules(logged_in: httpx.AsyncClient) -> None:
    code, item = await _item(logged_in)
    await logged_in.post(f"{P}/lots/{code}/state", json={"state": "sorted"})
    assert (await _put(logged_in, code, item)).status_code == 204  # triado ainda aceita
    await logged_in.post(f"{P}/lots/{code}/state", json={"state": "delivered"})
    blocked = await _put(logged_in, code, item)
    assert blocked.status_code == 409 and blocked.json()["code"] == "conflict"
    assert (await logged_in.delete(f"{P}/lots/{code}/items/{item}/photo")).status_code == 204  # apagar sempre


async def test_public_photo_headers_etag_and_304(logged_in: httpx.AsyncClient) -> None:
    code, item = await _item(logged_in)
    anonymous = httpx.AsyncClient(transport=logged_in._transport, base_url="http://test")
    url = f"{P}/public/lots/{code}/items/{item}/photo"
    assert (await anonymous.get(url)).status_code == 404  # ainda sem foto
    await _put(logged_in, code, item)
    resp = await anonymous.get(url)
    assert resp.status_code == 200 and resp.headers["content-type"] == "image/jpeg"
    assert resp.headers["cache-control"] == "public, max-age=3600" and resp.headers["content-disposition"] == "inline"
    etag = resp.headers["etag"]
    assert etag.startswith('"') and not etag.startswith("W/")  # forte
    again = await anonymous.get(url, headers={"If-None-Match": etag})
    assert again.status_code == 304 and again.content == b"" and again.headers["etag"] == etag
    assert (await anonymous.get(url, headers={"If-None-Match": '"outro"'})).status_code == 200
    assert (await anonymous.get(f"{P}/public/lots/NOV-NAOEXI/items/{item}/photo")).status_code == 404
    assert (await anonymous.get(f"{P}/public/lots/{code}/items/{uuid.uuid4()}/photo")).status_code == 404


async def test_passport_shows_only_unexpired_photos_up_to_12(
    logged_in: httpx.AsyncClient, session: AsyncSession
) -> None:
    code = await open_lot(logged_in)
    ids = [(await logged_in.post(f"{P}/lots/{code}/items", json=ITEM)).json()["id"] for _ in range(14)]
    for item in ids:
        assert (await _put(logged_in, code, item, credit="Ana, CC BY 4.0")).status_code == 204
    anonymous = httpx.AsyncClient(transport=logged_in._transport, base_url="http://test")
    passport = (await anonymous.get(f"{P}/public/lots/{code}")).json()
    assert len(passport["photos"]) == 12
    first = passport["photos"][0]
    assert first["url"] == f"{P}/public/lots/{code}/items/{first['item_id']}/photo"
    assert first["garment_type"] == "jumper" and first["brand"] == "Zara" and first["credit"] == "Ana, CC BY 4.0"
    # Expirar a primeira tira-a do passaporte e passa a 404.
    await session.execute(
        update(LotItemPhoto)
        .where(LotItemPhoto.item_id == uuid.UUID(first["item_id"]))
        .values(expires_at=datetime.now(UTC) - timedelta(seconds=1))
    )
    refreshed = (await anonymous.get(f"{P}/public/lots/{code}")).json()
    assert first["item_id"] not in {p["item_id"] for p in refreshed["photos"]} and len(refreshed["photos"]) == 12
    assert (await anonymous.get(first["url"])).status_code == 404
    assert (await logged_in.get(f"{P}/lots/{code}/items/{first['item_id']}/photo")).status_code == 404
    detail = (await logged_in.get(f"{P}/lots/{code}")).json()
    assert next(i for i in detail["item_list"] if i["id"] == first["item_id"])["has_photo"] is False


async def test_credit_is_stored_returned_limited_and_html_rejected(logged_in: httpx.AsyncClient) -> None:
    code, item = await _item(logged_in)
    credit = "Autor, CC BY-SA 4.0, Wikimedia Commons"
    assert (await _put(logged_in, code, item, credit=credit)).status_code == 204
    detail = (await logged_in.get(f"{P}/lots/{code}")).json()["item_list"][0]
    assert detail["photo_credit"] == credit
    anonymous = httpx.AsyncClient(transport=logged_in._transport, base_url="http://test")
    assert (await anonymous.get(f"{P}/public/lots/{code}")).json()["photos"][0]["credit"] == credit

    html = await _put(logged_in, code, item, credit="<a href='x'>autor</a>")
    assert html.status_code == 400 and html.json()["code"] == "bad_request"
    assert (await _put(logged_in, code, item, credit="a" * 241)).status_code == 422
    assert (await _put(logged_in, code, item, credit="a" * 240)).status_code == 204
    # Um pedido recusado não mexe na foto anterior.
    detail = (await logged_in.get(f"{P}/lots/{code}")).json()["item_list"][0]
    assert detail["photo_credit"] == "a" * 240
    await _put(logged_in, code, item)  # sem crédito: substitui e limpa
    assert (await logged_in.get(f"{P}/lots/{code}")).json()["item_list"][0]["photo_credit"] is None


async def test_purge_deletes_only_expired_photos(logged_in: httpx.AsyncClient, session: AsyncSession) -> None:
    code = await open_lot(logged_in)
    a = (await logged_in.post(f"{P}/lots/{code}/items", json=ITEM)).json()["id"]
    b = (await logged_in.post(f"{P}/lots/{code}/items", json=ITEM)).json()["id"]
    await _put(logged_in, code, a)
    await _put(logged_in, code, b)
    await session.execute(
        update(LotItemPhoto)
        .where(LotItemPhoto.item_id == uuid.UUID(a))
        .values(expires_at=datetime.now(UTC) - timedelta(days=1))
    )
    assert await photo_store.purge_expired_photos(session) == 1
    assert await photo_store.purge_expired_photos(session) == 0
    assert (await session.scalar(select(func.count()).select_from(LotItem))) >= 2  # peças intactas
    assert (await session.scalar(select(func.count()).select_from(Lot).where(Lot.code == code))) == 1
    left = (await session.scalars(select(LotItemPhoto.item_id))).all()
    assert left == [uuid.UUID(b)]
    audit = (await session.scalars(select(AuditLog).where(AuditLog.action == "lot.photo.purge"))).all()
    assert len(audit) == 1 and audit[0].details == {"count": 1}


async def test_deleting_an_item_or_lot_cascades_to_the_photo(
    logged_in: httpx.AsyncClient, session: AsyncSession
) -> None:
    code, item = await _item(logged_in)
    await _put(logged_in, code, item)
    lot = (await session.execute(select(Lot).where(Lot.code == code))).scalar_one()
    await session.delete(lot)
    await session.flush()
    assert (await session.scalar(select(func.count()).select_from(LotItemPhoto))) == 0


async def test_lot_reads_never_load_photo_bytes_and_stay_constant(
    logged_in: httpx.AsyncClient, session: AsyncSession
) -> None:
    code = await open_lot(logged_in)
    for _ in range(2):
        item = (await logged_in.post(f"{P}/lots/{code}/items", json=ITEM)).json()["id"]
        await _put(logged_in, code, item)
    with capture_sql(session) as few:
        for url in (f"{P}/lots", f"{P}/lots/{code}", f"{P}/public/lots/{code}", f"{P}/market", f"{P}/brands"):
            assert (await logged_in.get(url)).status_code == 200
    assert not any("lot_item_photos.content" in s.split(" FROM ")[0] for s in few)
    for _ in range(4):
        item = (await logged_in.post(f"{P}/lots/{code}/items", json=ITEM)).json()["id"]
        await _put(logged_in, code, item)
    with capture_sql(session) as many:
        for url in (f"{P}/lots", f"{P}/lots/{code}", f"{P}/public/lots/{code}", f"{P}/market", f"{P}/brands"):
            await logged_in.get(url)
    assert len(many) == len(few)
