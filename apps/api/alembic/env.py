"""Alembic síncrono (psycopg2) a partir da mesma DATABASE_URL (asyncpg) da aplicação."""

from alembic import context
from sqlalchemy import create_engine, pool

from novelo.core.config import get_settings
from novelo.core.database import Base
from novelo.features.scenarios import models  # noqa: F401  (todos os modelos têm de ser importados)

target_metadata = Base.metadata
url = get_settings().database_url.replace("+asyncpg", "+psycopg2")


def run_migrations_offline() -> None:
    context.configure(url=url, target_metadata=target_metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    engine = create_engine(url, poolclass=pool.NullPool)
    with engine.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
