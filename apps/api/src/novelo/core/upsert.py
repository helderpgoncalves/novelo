"""INSERT .. ON CONFLICT DO UPDATE em lotes (o asyncpg aceita no máximo 32 767 parâmetros por instrução)."""

import uuid
from typing import Any

from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

MAX_PARAMS = 30_000


async def upsert(
    db: AsyncSession, model: Any, rows: list[dict[str, Any]], keys: list[str], update: list[str]
) -> dict[tuple[Any, ...], uuid.UUID]:
    """Upsert pela chave natural `keys`; devolve {chave natural: id}. Divide em lotes pelo número de colunas."""
    if not rows:
        return {}
    width = max(len(r) for r in rows) + 3  # + id e marcas de tempo
    batch = max(1, MAX_PARAMS // width)
    out: dict[tuple[Any, ...], uuid.UUID] = {}
    for start in range(0, len(rows), batch):
        stmt = insert(model).values(rows[start : start + batch])
        stmt = stmt.on_conflict_do_update(index_elements=keys, set_={c: stmt.excluded[c] for c in update})
        ids = (await db.execute(stmt.returning(*(getattr(model, k) for k in keys), model.id))).all()
        out.update({tuple(r[:-1]): r[-1] for r in ids})
    return out
