"""Conta e inspeciona as consultas SQL emitidas durante um bloco (testes de desempenho)."""

from collections.abc import Iterator
from contextlib import contextmanager
from typing import Any

from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncSession


@contextmanager
def capture_sql(session: AsyncSession) -> Iterator[list[str]]:
    """Regista as instruções SQL da ligação da sessão de teste enquanto o bloco corre."""
    conn = session.sync_session.get_bind()
    statements: list[str] = []

    def _on_execute(_conn: Any, _cursor: Any, statement: str, *_: Any) -> None:
        if not statement.startswith(
            ("SAVEPOINT", "RELEASE SAVEPOINT", "ROLLBACK TO SAVEPOINT")
        ):  # ruído da sessão de teste
            statements.append(statement)

    event.listen(conn, "before_cursor_execute", _on_execute)
    try:
        yield statements
    finally:
        event.remove(conn, "before_cursor_execute", _on_execute)
