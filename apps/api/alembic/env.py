"""Alembic síncrono (psycopg2) a partir da mesma DATABASE_URL (asyncpg) da aplicação."""

from alembic import context
from sqlalchemy import create_engine, pool

from novelo.core.config import get_settings
from novelo.core.database import Base
from novelo.features.ai_admin import models as ai_admin_models  # noqa: F401
from novelo.features.audit import models as audit_models  # noqa: F401
from novelo.features.auth import models as auth_models  # noqa: F401
from novelo.features.copilot import models as copilot_models  # noqa: F401
from novelo.features.datasets import models as dataset_models  # noqa: F401
from novelo.features.lots import models as lot_models  # noqa: F401
from novelo.features.municipal import models as municipal_models  # noqa: F401
from novelo.features.network import models as network_models  # noqa: F401
from novelo.features.planning import models as planning_models  # noqa: F401
from novelo.features.planning import whatif_models  # noqa: F401
from novelo.features.reports import models as report_models  # noqa: F401
from novelo.features.textile import models as textile_models  # noqa: F401
from novelo.features.users import models as user_models  # noqa: F401

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
