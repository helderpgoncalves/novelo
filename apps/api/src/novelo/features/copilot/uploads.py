"""Receção de anexos: valida, extrai o texto numa thread com limite de tempo e descarta o ficheiro."""

import asyncio

from fastapi import UploadFile
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.ai.catalog import ModelCatalog
from novelo.core.config import get_settings
from novelo.features.copilot import attachments as att
from novelo.features.copilot.models import CopilotAttachment
from novelo.features.copilot.schemas import AttachmentOut
from novelo.features.copilot.threads import attachment_out
from novelo.features.users.models import User

EXTRACT_TIMEOUT_S = 20.0


async def model_sees_images(catalog: ModelCatalog, model: str) -> bool:
    """O modelo do copiloto aceita imagens? `model` é o mesmo que o agente vai usar (`llm.model_for`)."""
    try:
        found = (await catalog.snapshot()).models.get(model)
    except Exception:
        return False
    return bool(found and found.supports_image)


async def _stored(db: AsyncSession, user: User) -> tuple[int, int]:
    """Anexos e bytes que o utilizador já tem guardados."""
    count, used = (
        await db.execute(
            select(func.count(), func.coalesce(func.sum(CopilotAttachment.size_bytes), 0)).where(
                CopilotAttachment.user_id == user.id
            )
        )
    ).one()
    return int(count), int(used)


async def upload(
    db: AsyncSession, user: User, files: list[UploadFile], catalog: ModelCatalog, model: str
) -> list[AttachmentOut]:
    if not files:
        raise att.AttachmentError("No files received")
    if len(files) > att.MAX_FILES:
        raise att.AttachmentError(f"At most {att.MAX_FILES} files per upload")
    s = get_settings()
    stored_count, stored_bytes = await _stored(db, user)
    if stored_count + len(files) > s.copilot_attachments_per_user:
        raise att.AttachmentError(f"Attachment limit reached ({s.copilot_attachments_per_user} files)")
    cap = s.copilot_attachments_max_mb * 1024 * 1024
    can_see = await model_sees_images(catalog, model)
    rows: list[CopilotAttachment] = []
    images: list[tuple[CopilotAttachment, bytes]] = []
    for f in files:
        name = att.safe_filename(f.filename)
        data = await f.read(att.MAX_BYTES + 1)  # nunca lê mais do que o limite
        if len(data) > att.MAX_BYTES:
            raise att.AttachmentError(f"'{name}' is larger than {att.MAX_BYTES // (1024 * 1024)} MB")
        try:
            out = await asyncio.wait_for(asyncio.to_thread(att.extract, data, name), EXTRACT_TIMEOUT_S)
        except TimeoutError as exc:
            raise att.AttachmentError(f"'{name}' took too long to process") from exc
        row = CopilotAttachment(
            user_id=user.id, kind=out.kind, filename=name, mime=out.mime, size_bytes=len(data),
            preview=out.preview, meta=out.meta, data=out.data,
        )  # fmt: skip
        stored_bytes += len(data)
        if stored_bytes > cap:
            raise att.AttachmentError(f"Attachment storage limit reached ({s.copilot_attachments_max_mb} MB)")
        rows.append(row)
        if out.image_jpeg is not None:
            images.append((row, out.image_jpeg))
    db.add_all(rows)
    await db.commit()
    for row, jpeg in images:
        att.image_store.put(str(row.id), str(user.id), jpeg)
    return [attachment_out(r, can_see) for r in rows]
