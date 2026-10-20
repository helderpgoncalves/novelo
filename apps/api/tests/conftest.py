"""Fixtures partilhadas. Os testes de API usam um Postgres real (DATABASE_URL de teste)."""

import asyncio
import json
import os
from collections.abc import AsyncGenerator, AsyncIterator, Iterator
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import httpx
import pytest
from fastapi import Depends, FastAPI
from sqlalchemy import create_engine, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from novelo.adapters.email import get_email_sender
from novelo.adapters.openrouter import CallUsage, ChatResult, RawToolCall, RoundResult, TextPiece, ToolCallRecord
from novelo.ai.cache import response_cache
from novelo.ai.catalog import ModelCatalog, get_catalog
from novelo.core.config import get_settings
from novelo.core.database import Base, get_db
from novelo.core.ratelimit import (
    alerts_limiter,
    auth_limiter,
    copilot_limiter,
    reset_limiter,
    triage_limiter,
    whatif_limiter,
)
from novelo.features.ai_admin import models as _ai_models  # noqa: F401
from novelo.features.auth import models as _auth_models  # noqa: F401
from novelo.features.copilot import models as _copilot_models  # noqa: F401
from novelo.features.datasets import models as _dataset_models  # noqa: F401
from novelo.features.lots import models as _lot_models  # noqa: F401
from novelo.features.lots.router import get_llm
from novelo.features.municipal import models as _municipal_models  # noqa: F401
from novelo.features.network import models as _network_models  # noqa: F401
from novelo.features.planning import models as _planning_models  # noqa: F401
from novelo.features.planning import whatif_models as _whatif_models  # noqa: F401
from novelo.features.reports import models as _report_models  # noqa: F401
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


CATALOG_ITEMS = {
    "data": [
        {
            "id": "openai/gpt-6-luna",
            "name": "GPT-6 Luna",
            "context_length": 1050000,
            "pricing": {"prompt": "0.0000001", "completion": "0.0000005"},
            "architecture": {"input_modalities": ["text", "image"], "output_modalities": ["text"]},
            "supported_parameters": ["tools", "structured_outputs"],
        },
        {
            "id": "acme/text-only",
            "name": "Acme Text",
            "context_length": 128000,
            "pricing": {"prompt": "0.0000002", "completion": "0.000001"},
            "architecture": {"input_modalities": ["text"]},
            "supported_parameters": ["tools", "structured_outputs"],
        },
        {
            "id": "acme/vision-no-tools",
            "name": "Acme Vision",
            "pricing": {"prompt": "0.0000003", "completion": "0.0000012"},
            "architecture": {"input_modalities": ["text", "image"]},
            "supported_parameters": ["structured_outputs"],
        },
        {
            "id": "typesafe/jev-router",
            "name": "JEV Router",
            "pricing": {"prompt": "-1", "completion": "-1"},
            "architecture": {"input_modalities": ["text", "image"]},
            "supported_parameters": ["tools", "structured_outputs"],
        },
    ]
}


class OutboxSender:
    """Guarda os emails enviados para os testes lerem o link de recuperação."""

    def __init__(self) -> None:
        self.sent: list[dict[str, str]] = []

    async def send(self, *, to: str, subject: str, html: str, text: str) -> None:
        self.sent.append({"to": to, "subject": subject, "html": html, "text": text})


@pytest.fixture(autouse=True)
def _clean_ai_cache() -> None:
    response_cache.clear()  # a cache de respostas é global ao processo: cada teste começa vazio


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
        self.chat_script: list[object] = []
        self.stream_script: list[object] = []
        self.usage: list[object] = []
        self.account_data: dict[str, object] = {}
        self.ping_error: Exception | None = None

    def queue_rounds(self, *rounds: object) -> None:
        """Voltas do streaming: dict {text: [pedaços], tools: [(nome, args)], delay: s} ou uma exceção."""
        self.stream_script.extend(rounds)

    async def stream_round(
        self, *, system: str, messages: list[dict[str, object]], tools: list[object], task: object = None,
        model: str | None = None, tools_enabled: bool = True,
    force_tool: str | None = None,
    ) -> AsyncIterator[object]:  # fmt: skip
        self.calls.append({"schema": "stream", "system": system, "user": messages, "tools_enabled": tools_enabled})
        if not self.stream_script:
            raise AssertionError("Sem voltas preparadas para o streaming")
        step = self.stream_script.pop(0)
        if isinstance(step, Exception):
            raise step
        spec: dict[str, Any] = step  # type: ignore[assignment]
        chunks: list[str] = spec.get("text", [])
        for chunk in chunks:
            if spec.get("delay"):
                await asyncio.sleep(spec["delay"])
            yield TextPiece(chunk)
        calls = [
            RawToolCall(id=f"call_{i}", name=n, arguments=json.dumps(a))
            for i, (n, a) in enumerate(spec.get("tools", []))
        ]
        usage = CallUsage("fake/model", 0.2, 1000, 50, 0.0004)
        self.usage.append(usage)
        yield RoundResult("".join(chunks), calls, "tool_calls" if calls else "stop", "fake/model", usage)

    def queue_chat(self, *steps: object) -> None:
        """Passos do copiloto: uma lista [(ferramenta, argumentos)] corre ferramentas; uma str é a resposta final."""
        self.chat_script.extend(steps)

    def model_for(self, task: object) -> str:
        return "fake/model"

    async def account(self) -> dict[str, object]:
        return self.account_data

    async def ping(self, model: str) -> CallUsage:
        if self.ping_error:
            raise self.ping_error
        return CallUsage(model, 0.42, 10, 1, 0.000003)

    async def chat(
        self, *, system: str, messages: list[dict[str, object]], execute: object, **kw: object
    ) -> ChatResult:
        self.calls.append({"schema": "chat", "system": system, "user": messages})
        records: list[ToolCallRecord] = []
        while self.chat_script:
            step = self.chat_script.pop(0)
            if isinstance(step, Exception):
                raise step
            if isinstance(step, str):
                done = [*messages, {"role": "assistant", "content": step}]
                return ChatResult(text=step, messages=done, tool_calls=records, iterations=1)
            for name, args in step:  # type: ignore[attr-defined]
                result = await execute(name, json.dumps(args))  # type: ignore[operator]
                records.append(ToolCallRecord(name=name, arguments=json.dumps(args), result=result))
        raise AssertionError("Sem passos preparados para o copiloto")

    def queue(self, schema_name: str, *responses: object) -> None:
        self.responses.setdefault(schema_name, []).extend(responses)

    async def structured(
        self,
        *,
        system: str,
        user: object,
        schema: type,
        model: str | None = None,
        retries: int = 1,
        task: object = None,
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


def stream_deps_for(session: AsyncSession, llm: FakeLlm, catalog: ModelCatalog) -> Any:
    """Dependências do stream para testes: a sessão do teste (sem a fechar) e o modelo falso."""
    from novelo.features.copilot.agent import StreamDeps  # noqa: PLC0415

    @asynccontextmanager
    async def factory() -> AsyncIterator[AsyncSession]:
        yield session

    async def make_llm(_db: AsyncSession, _user: object) -> Any:
        return llm

    async def precheck(_db: AsyncSession, _user: object) -> None:
        return None

    return StreamDeps(session_factory=factory, make_llm=make_llm, catalog=catalog, precheck=precheck)


def _mount_ai_routers(app: FastAPI, _: ModelCatalog) -> None:
    """Monta o copiloto e o painel de IA se o `main.py` ainda não o fez (as mesmas linhas que lá devem existir)."""
    from novelo.core.deps import get_current_user  # noqa: PLC0415
    from novelo.core.errors import COMMON_ERRORS  # noqa: PLC0415
    from novelo.features.ai_admin.router import router as ai_router  # noqa: PLC0415
    from novelo.features.copilot.router import router as copilot_router  # noqa: PLC0415

    paths = {getattr(r, "path", "") for r in app.routes}
    protected = [Depends(get_current_user)]
    if "/api/v1/ai/settings" not in paths:
        app.include_router(ai_router, prefix="/api/v1/ai", tags=["ai"], dependencies=protected, responses=COMMON_ERRORS)
    if "/api/v1/copilot/chat" not in paths:
        app.include_router(
            copilot_router, prefix="/api/v1/copilot", tags=["copilot"], dependencies=protected, responses=COMMON_ERRORS
        )


@pytest.fixture
def catalog() -> ModelCatalog:
    transport = httpx.MockTransport(lambda _: httpx.Response(200, json=CATALOG_ITEMS))
    return ModelCatalog(url="https://catalog.test/models", transport=transport)


@pytest.fixture
def llm() -> FakeLlm:
    return FakeLlm()


@pytest.fixture
def outbox() -> OutboxSender:
    return OutboxSender()


@pytest.fixture
async def client(
    session: AsyncSession, outbox: OutboxSender, llm: FakeLlm, catalog: ModelCatalog
) -> AsyncGenerator[httpx.AsyncClient, None]:
    app = create_app()
    _mount_ai_routers(app, catalog)

    async def _db() -> AsyncGenerator[AsyncSession, None]:
        yield session

    app.dependency_overrides[get_db] = _db
    app.dependency_overrides[get_email_sender] = lambda: outbox
    app.dependency_overrides[get_llm] = lambda: llm
    app.dependency_overrides[get_catalog] = lambda: catalog
    from novelo.features.copilot.router import get_stream_deps  # noqa: PLC0415

    app.dependency_overrides[get_stream_deps] = lambda: stream_deps_for(session, llm, catalog)
    auth_limiter.reset()
    reset_limiter.reset()
    triage_limiter.reset()
    whatif_limiter.reset()
    copilot_limiter.reset()
    alerts_limiter.reset()
    response_cache.clear()
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as c:
        yield c


PASSWORD = "uma-password-segura-123"


@pytest.fixture
async def make_user(client: httpx.AsyncClient, session: AsyncSession) -> Any:
    """Cria um utilizador e devolve um cliente HTTP novo (cookies próprios) com a sessão dele, sobre a mesma app."""
    from novelo.features.users import service as user_service  # noqa: PLC0415

    opened: list[httpx.AsyncClient] = []

    async def build(email: str, role: str = "operator") -> httpx.AsyncClient:
        await user_service.create_user(session, email=email, password=PASSWORD, role=role, email_verified=True)
        c = httpx.AsyncClient(transport=client._transport, base_url="http://test")
        resp = await c.post("/api/v1/auth/login", json={"email": email, "password": PASSWORD})
        assert resp.status_code == 200, resp.text
        opened.append(c)
        return c

    yield build
    for c in opened:
        await c.aclose()


@pytest.fixture
async def logged_in(client: httpx.AsyncClient) -> httpx.AsyncClient:
    resp = await client.post(
        "/api/v1/auth/register", json={"email": "ana@vitrus.pt", "password": PASSWORD, "name": "Ana"}
    )
    assert resp.status_code == 201
    return client


MUNICIPAL_FIXTURE = Path(__file__).parent / "fixtures" / "municipal"


async def load_municipal(session: AsyncSession, data_dir: Path = MUNICIPAL_FIXTURE, *, empty: bool = False) -> None:
    """Troca a rede municipal real (já importada no início da sessão) por uma amostra pequena e feita à mão.

    Tudo corre na transação do teste, que é desfeita no fim. Com `empty=True` deixa a rede municipal por importar.
    """
    from sqlalchemy import delete, select  # noqa: PLC0415

    from novelo.features.datasets.models import DataSource  # noqa: PLC0415
    from novelo.features.municipal import models as m  # noqa: PLC0415
    from novelo.features.municipal.importer import MUNICIPAL_SOURCE, import_municipal  # noqa: PLC0415

    for model in (m.MunicipalLink, m.MunicipalContainer, m.MunicipalSite, m.MunicipalParishStat, m.MunicipalMeta):
        await session.execute(delete(model))
    source = (await session.execute(select(DataSource).where(DataSource.key == MUNICIPAL_SOURCE))).scalar_one()
    if empty:
        await session.execute(delete(DataSource).where(DataSource.id == source.id))
        await session.flush()
        return
    source.file_sha256 = "f" * 64
    source.imported_at = datetime(2026, 10, 20, 12, 0, tzinfo=UTC)
    await session.flush()
    await import_municipal(session, data_dir, source.id)
    await session.flush()


@pytest.fixture
async def municipal(session: AsyncSession) -> None:
    await load_municipal(session)
