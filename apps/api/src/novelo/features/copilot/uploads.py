"""Receção de anexos: valida, extrai o texto numa thread com limite de tempo e descarta o ficheiro."""

import asyncio

from fastapi import UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.ai.catalog import ModelCatalog
from novelo.features.copilot import attachments as att
from novelo.features.copilot.models import CopilotAttachment
from novelo.features.copilot.schemas import AttachmentOut
from novelo.features.copilot.threads import attachment_out, copilot_model
from novelo.features.users.models import User

EXTRACT_TIMEOUT_S = 20.0


async def model_sees_images(db: AsyncSession, catalog: ModelCatalog) -> bool:
    try:
        found = (await catalog.snapshot()).models.get(await copilot_model(db))
    except Exception:
        return False
    return bool(found and found.supports_image)


async def upload(db: AsyncSession, user: User, files: list[UploadFile], catalog: ModelCatalog) -> list[AttachmentOut]:
    if not files:
        raise att.AttachmentError("No files received")
    if len(files) > att.MAX_FILES:
        raise att.AttachmentError(f"At most {att.MAX_FILES} files per upload")
    can_see = await model_sees_images(db, catalog)
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
        rows.append(row)
        if out.image_jpeg is not None:
            images.append((row, out.image_jpeg))
    db.add_all(rows)
    await db.commit()
    for row, jpeg in images:
        att.image_store.put(str(row.id), str(user.id), jpeg)
    return [attachment_out(r, can_see) for r in rows]
