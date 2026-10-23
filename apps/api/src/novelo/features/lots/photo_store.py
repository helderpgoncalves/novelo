"""Guardar, ler, apagar e expirar as miniaturas das peças (RGPD: consentimento, retenção e apagamento).

Regras:
- só o operador guarda (o router exige não-convidado) e confirma que a foto não mostra pessoas, rostos, documentos
  nem informação pessoal (`confirm_no_people`); o momento fica em `consent_at`;
- o lote tem de estar antes de `delivered` (colhido, triado ou reservado): depois de entregue o passaporte é histórico;
  apagar é sempre permitido;
- a foto expira ao fim de `LOT_PHOTO_RETENTION_DAYS` e `purge_expired_photos` apaga-a (nunca a peça nem o lote);
- a auditoria regista só o facto (peça, lote, tamanho), nunca bytes.
"""

import asyncio
import hashlib
import logging
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from anyio import to_thread
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.core.config import get_settings
from novelo.core.database import SessionLocal
from novelo.core.errors import AppError, ConflictError, ConsentRequiredError, NotFoundError
from novelo.core.request_meta import RequestMeta
from novelo.domain.vocab import LotState
from novelo.features.audit import service as audit
from novelo.features.lots import photos
from novelo.features.lots.models import Lot, LotItem, LotItemPhoto
from novelo.features.users.models import User

log = logging.getLogger("novelo.lots.photos")
PURGE_INTERVAL_S = 24 * 3600
PURGE_START_DELAY_S = 30  # deixa o arranque e as migrações terminarem


@dataclass(frozen=True)
class PhotoBlob:
    """Imagem pronta a servir: bytes, tipo e ETag forte (muda sempre que a foto é substituída)."""

    content: bytes
    mime: str
    etag: str


def etag_of(photo_id: uuid.UUID) -> str:
    """ETag forte. Cada foto tem um `id` novo (substituir = apagar e criar), por isso o conteúdo é imutável por id."""
    return f'"{hashlib.sha256(photo_id.bytes).hexdigest()[:32]}"'


CREDIT_MAX_CHARS = 240


class InvalidCreditError(AppError):
    status_code = 400
    code = "bad_request"


def clean_credit_text(credit: str | None) -> str | None:
    """Atribuição de licença (ex.: «Autor, CC BY-SA 4.0, Wikimedia Commons»): texto simples, sem HTML, até 240."""
    text = " ".join((credit or "").split())
    if not text:
        return None
    if "<" in text or ">" in text:
        raise InvalidCreditError("The credit must be plain text (no HTML)")
    if len(text) > CREDIT_MAX_CHARS:
        raise InvalidCreditError(f"The credit must be at most {CREDIT_MAX_CHARS} characters")
    return text


async def _lot_and_item(db: AsyncSession, code: str, item_id: uuid.UUID) -> tuple[Lot, LotItem]:
    row = (
        await db.execute(
            select(Lot, LotItem)
            .join(LotItem, LotItem.lot_id == Lot.id)
            .where(Lot.code == code.upper(), LotItem.id == item_id)
        )
    ).one_or_none()
    if row is None:
        raise NotFoundError("Lot item not found")
    return row[0], row[1]


async def save_photo(
    db: AsyncSession,
    user: User,
    code: str,
    item_id: uuid.UUID,
    data: bytes,
    *,
    confirm_no_people: bool,
    credit: str | None = None,
    meta: RequestMeta | None = None,
) -> None:
    """Valida, processa e guarda (substituindo a anterior) a miniatura da peça."""
    if not confirm_no_people:
        raise ConsentRequiredError("Confirm that the photo shows no people, faces, documents or personal information")
    clean_credit = clean_credit_text(credit)
    lot, item = await _lot_and_item(db, code, item_id)
    if lot.state == LotState.DELIVERED:
        raise ConflictError("The lot was already delivered: photos can no longer be changed")
    settings = get_settings()
    processed = await to_thread.run_sync(photos.process, data, settings.lot_photo_max_bytes)
    now = datetime.now(UTC)
    replaced = bool(
        (await db.execute(delete(LotItemPhoto).where(LotItemPhoto.item_id == item.id).returning(LotItemPhoto.id))).all()
    )
    db.add(
        LotItemPhoto(
            item_id=item.id,
            content=processed.content,
            mime=processed.mime,
            width=processed.width,
            height=processed.height,
            size_bytes=processed.size_bytes,
            credit=clean_credit,
            created_by_id=user.id,
            expires_at=now + timedelta(days=settings.lot_photo_retention_days),
            consent_at=now,
        )
    )
    await audit.record_by(
        db,
        user,
        "lot.photo.save",
        meta=meta,
        target_type="lot_item",
        target_id=item.id,
        details={"lot": lot.code, "size_bytes": processed.size_bytes, "replaced": replaced},
    )
    await db.commit()


async def delete_photo(
    db: AsyncSession, user: User, code: str, item_id: uuid.UUID, *, meta: RequestMeta | None = None
) -> None:
    """Direito ao apagamento: apaga já, em qualquer estado do lote. Idempotente (sem foto não faz nada)."""
    lot, item = await _lot_and_item(db, code, item_id)
    removed = bool(
        (await db.execute(delete(LotItemPhoto).where(LotItemPhoto.item_id == item.id).returning(LotItemPhoto.id))).all()
    )
    if removed:
        await audit.record_by(
            db,
            user,
            "lot.photo.delete",
            meta=meta,
            target_type="lot_item",
            target_id=item.id,
            details={"lot": lot.code},
        )
    await db.commit()


async def photo_etag(db: AsyncSession, code: str, item_id: uuid.UUID) -> str:
    """ETag da foto atual sem ler os bytes; 404 se não existir, tiver expirado ou o lote/peça não existirem."""
    photo_id = await db.scalar(
        select(LotItemPhoto.id)
        .join(LotItem, LotItem.id == LotItemPhoto.item_id)
        .join(Lot, Lot.id == LotItem.lot_id)
        .where(Lot.code == code.upper(), LotItem.id == item_id, LotItemPhoto.expires_at > datetime.now(UTC))
    )
    if photo_id is None:
        raise NotFoundError("Photo not found")
    return etag_of(photo_id)


async def read_photo(db: AsyncSession, code: str, item_id: uuid.UUID) -> PhotoBlob:
    """Os bytes da foto (consulta explícita à coluna diferida). 404 como em `photo_etag`."""
    row = (
        await db.execute(
            select(LotItemPhoto.id, LotItemPhoto.content, LotItemPhoto.mime)
            .join(LotItem, LotItem.id == LotItemPhoto.item_id)
            .join(Lot, Lot.id == LotItem.lot_id)
            .where(Lot.code == code.upper(), LotItem.id == item_id, LotItemPhoto.expires_at > datetime.now(UTC))
        )
    ).one_or_none()
    if row is None:
        raise NotFoundError("Photo not found")
    return PhotoBlob(content=row.content, mime=row.mime, etag=etag_of(row.id))


async def purge_expired_photos(db: AsyncSession) -> int:
    """Apaga as miniaturas expiradas e devolve quantas. Nunca toca em peças nem em lotes."""
    result = await db.execute(
        delete(LotItemPhoto).where(LotItemPhoto.expires_at <= datetime.now(UTC)).returning(LotItemPhoto.id)
    )
    removed = len(result.all())
    if removed:
        await audit.record(db, "lot.photo.purge", actor_id=None, target_type="lot_item", details={"count": removed})
    await db.commit()
    return removed


async def purge_loop(interval_s: float = PURGE_INTERVAL_S, start_delay_s: float = PURGE_START_DELAY_S) -> None:
    """No arranque (depois de um atraso curto) e de 24 em 24 h. Nunca derruba a API; cancela-se no encerramento."""
    try:
        await asyncio.sleep(start_delay_s)
        while True:
            try:
                async with SessionLocal() as db:
                    removed = await purge_expired_photos(db)
                if removed:
                    log.info("Miniaturas expiradas apagadas: %d", removed)
            except Exception:
                log.exception("Não foi possível apagar as miniaturas expiradas")
            await asyncio.sleep(interval_s)
    except asyncio.CancelledError:
        raise
