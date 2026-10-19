"""Fixtures partilhadas. Os testes de API usam um Postgres real (DATABASE_URL de teste)."""

import asyncio
import os
from collections.abc import AsyncGenerator, Iterator

import httpx
import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from novelo.adapters.email import get_email_sender
from novelo.core.config import get_settings
from novelo.core.database import Base, get_db
from novelo.core.ratelimit import auth_limiter, reset_limiter, triage_limiter, whatif_limiter
from novelo.features.auth import models as _auth_models  # noqa: F401
from novelo.features.datasets import models as _dataset_models  # noqa: F401
from novelo.features.lots import models as _lot_models  # noqa: F401
from novelo.features.lots.router import get_llm
from novelo.features.network import models as _network_models  # noqa: F401
from novelo.features.planning import models as _planning_models  # noqa: F401
from novelo.features.planning import whatif_models as _whatif_models  # noqa: F401
from novelo.features.textile import models as _textile_models  # noqa: F401
from novelo.features.users import models as _user_models  # noqa: F401
from novelo.main import create_app
from novelo.seed import seed


async def _seed_reference_data() -> None:
    engine = create_async_engine(TEST_DB)
    async with async_sessionmaker(engine, expire_on_commit=False)() as db:
        await seed(db, get_settings().data_dir)
    await engine.dispose()


TEST_DB = os.environ.get("TEST_DATABASE_URL", "postgresql+asyncpg://novelo:novelo@localhost:5590/novelo_test")


class OutboxSender:
    """Guarda os emails enviados para os testes lerem o link de recuperação."""

    def __init__(self) -> None:
        self.sent: list[dict[str, str]] = []

    async def send(self, *, to: str, subject: str, html: str, text: str) -> None:
        self.sent.append({"to": to, "subject": subject, "html": html, "text": text})


@pytest.fixture(scope="session", autouse=True)
def _database() -> Iterator[None]:
    admin = create_engine(
        TEST_DB.replace("+asyncpg", "+psycopg2").rsplit("/", 1)[0] + "/postgres", isolation_level="AUTOCOMMIT"
    )
    name = TEST_DB.rsplit("/", 1)[1]
    try:
        with admin.connect() as conn:
            conn.execute(text(f'DROP DATABASE IF EXISTS "{name}"'))
            conn.execute(text(f'CREATE DATABASE "{name}"'))
    except Exception:  # sem Postgres: só correm os testes que não precisam da BD
        yield
        return
    sync = create_engine(TEST_DB.replace("+asyncpg", "+psycopg2"))
    Base.metadata.create_all(sync)
    asyncio.run(_seed_reference_data())
    yield


@pytest.fixture
async def session() -> AsyncGenerator[AsyncSession, None]:
    engine = create_async_engine(TEST_DB)
    async with engine.connect() as conn:
        trans = await conn.begin()
        maker = async_sessionmaker(bind=conn, expire_on_commit=False, join_transaction_mode="create_savepoint")
        async with maker() as s:
            yield s
        await trans.rollback()
    await engine.dispose()


class FakeLlm:
    """Substitui o OpenRouter: devolve respostas preparadas por tipo de schema e regista os pedidos."""

    def __init__(self) -> None:
        self.responses: dict[str, list[object]] = {}
        self.calls: list[dict[str, object]] = []

    def queue(self, schema_name: str, *responses: object) -> None:
        self.responses.setdefault(schema_name, []).extend(responses)

    async def structured(
        self, *, system: str, user: object, schema: type, model: str | None = None, retries: int = 1
    ) -> object:
        self.calls.append({"schema": schema.__name__, "system": system, "user": user})
        queue = self.responses.get(schema.__name__, [])
        if not queue:
            raise AssertionError(f"Sem resposta preparada para {schema.__name__}")
        item = queue.pop(0)
        if isinstance(item, Exception):
            raise item
        return item

    async def aclose(self) -> None:
        return None


@pytest.fixture
def llm() -> FakeLlm:
    return FakeLlm()


@pytest.fixture
def outbox() -> OutboxSender:
    return OutboxSender()


@pytest.fixture
async def client(session: AsyncSession, outbox: OutboxSender, llm: FakeLlm) -> AsyncGenerator[httpx.AsyncClient, None]:
    app = create_app()

    async def _db() -> AsyncGenerator[AsyncSession, None]:
        yield session

    app.dependency_overrides[get_db] = _db
    app.dependency_overrides[get_email_sender] = lambda: outbox
    app.dependency_overrides[get_llm] = lambda: llm
    auth_limiter.reset()
    reset_limiter.reset()
    triage_limiter.reset()
    whatif_limiter.reset()
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as c:
        yield c


PASSWORD = "uma-password-segura-123"


@pytest.fixture
async def logged_in(client: httpx.AsyncClient) -> httpx.AsyncClient:
    resp = await client.post(
        "/api/v1/auth/register", json={"email": "ana@vitrus.pt", "password": PASSWORD, "name": "Ana"}
    )
    assert resp.status_code == 201
    return client
