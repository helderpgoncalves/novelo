"""Acesso e versão dos dados municipais: papéis, versão (ETag) e documentos da importação."""

from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.core.errors import ForbiddenError, NotFoundError
from novelo.features.datasets.models import DataSource
from novelo.features.municipal.importer import MUNICIPAL_SOURCE
from novelo.features.municipal.models import MunicipalMeta


def resolve_names(role: str, show_names: bool) -> bool:
    """Nomes de produtores só para admin que os peça. Pedir sem ser admin é um erro explícito (403), não um silêncio."""
    if show_names and role != "admin":
        raise ForbiddenError("Only administrators can see producer names")
    return show_names


async def data_version(db: AsyncSession) -> str:
    row = (
        await db.execute(
            select(DataSource.file_sha256, DataSource.imported_at).where(DataSource.key == MUNICIPAL_SOURCE)
        )
    ).first()
    return "none" if row is None else f"{row.file_sha256[:12]}-{int(row.imported_at.timestamp())}"


async def get_source(db: AsyncSession) -> DataSource:
    source = (await db.execute(select(DataSource).where(DataSource.key == MUNICIPAL_SOURCE))).scalar_one_or_none()
    if source is None:
        raise NotFoundError("Municipal containers have not been imported")
    return source


async def get_meta(db: AsyncSession, key: str) -> dict[str, Any]:
    row = (await db.execute(select(MunicipalMeta.payload).where(MunicipalMeta.key == key))).scalar_one_or_none()
    if row is None:
        raise NotFoundError("Municipal containers have not been imported")
    return dict(row)
