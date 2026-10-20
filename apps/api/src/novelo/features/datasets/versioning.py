"""Versão dos dados de referência, para os ETags: muda quando entra um pacote novo ou se editam os pressupostos."""

import hashlib
from typing import Annotated

from fastapi import Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.core.http_cache import REFERENCE_MAX_AGE_S, REVALIDATE_MAX_AGE_S, HttpCache, cache_dependency
from novelo.features.datasets.models import DataSource
from novelo.features.planning.models import ParameterSet


async def reference_data_version(db: AsyncSession) -> str:
    """Dados importados (circuitos, frota, contentores, base têxtil...): uma linha por fonte, com hash e instante."""
    rows = (
        await db.execute(
            select(DataSource.key, DataSource.file_sha256, DataSource.imported_at).order_by(DataSource.key)
        )
    ).all()
    digest = hashlib.sha1(usedforsecurity=False)
    for key, sha, imported_at in rows:
        digest.update(f"{key}:{sha}:{imported_at.timestamp()};".encode())
    return digest.hexdigest()[:12]


async def planning_data_version(db: AsyncSession) -> str:
    """Dados de referência mais os pressupostos ativos (a procura das zonas depende deles)."""
    rows = (
        await db.execute(
            select(ParameterSet.id, ParameterSet.version, ParameterSet.updated_at).where(ParameterSet.is_default)
        )
    ).all()
    params = ";".join(f"{i}:{v}:{u.timestamp()}" for i, v, u in rows)
    mix = hashlib.sha1(f"{await reference_data_version(db)}|{params}".encode(), usedforsecurity=False)
    return mix.hexdigest()[:12]


# Dependências prontas para os routers: dados importados (5 min) e dados que dependem dos pressupostos (revalida).
ReferenceCache = Annotated[HttpCache, Depends(cache_dependency(reference_data_version, REFERENCE_MAX_AGE_S))]
PlanningCache = Annotated[HttpCache, Depends(cache_dependency(planning_data_version, REVALIDATE_MAX_AGE_S))]
