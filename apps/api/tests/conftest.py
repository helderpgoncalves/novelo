"""Fixtures partilhadas. Os testes de API usam um Postgres real (DATABASE_URL de teste)."""

import asyncio
import hashlib
import json
import os
import time
from collections.abc import AsyncGenerator, AsyncIterator, Iterator
from contextlib import asynccontextmanager, suppress
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
from novelo.adapters.turnstile import TurnstileResult, TurnstileUnavailableError, get_turnstile
from novelo.ai.cache import response_cache
from novelo.ai.catalog import ModelCatalog, get_catalog
from novelo.core.config import get_settings
from novelo.core.database import Base, get_db
from novelo.core.ratelimit import (
    alerts_limiter,
    auth_limiter,
    copilot_limiter,
    guest_ai_limiter,
    guest_solver_limiter,
    magic_email_limiter,
    magic_link_limiter,
    magic_verify_limiter,
    quick_join_code_limiter,
    quick_join_email_limiter,
    quick_join_limiter,
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


async def _seed_reference_data(url: str) -> None:
    engine = create_async_engine(url)
    async with async_sessionmaker(engine, expire_on_commit=False)() as db:
        await seed(db, get_settings().data_dir)
    await engine.dispose()


_BASE_DB = os.environ.get("TEST_DATABASE_URL", "postgresql+asyncpg://novelo:novelo@localhost:5590/novelo_test")
# Uma base de dados por processo de teste (cada worker do xdist tem a sua; duas corridas em simultâneo também não
# se pisam). É clonada de um template construído uma só vez (ver `_database`) e apagada no fim da sessão.
_RUN_ID = (os.environ.get("PYTEST_XDIST_TESTRUNUID") or str(os.getpid()))[:8]
_WORKER = os.environ.get("PYTEST_XDIST_WORKER", "main")
TEST_DB = f"{_BASE_DB}_{_RUN_ID}_{_WORKER}"


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


class FakeTurnstile:
    """Substitui a Cloudflare: "good" passa, "down" simula falha do serviço, o resto é recusado.

    `hostname`/`action` configuráveis; guarda o que recebeu para os testes verificarem o uso único.
    """

    def __init__(self) -> None:
        self.seen: list[tuple[str, str | None]] = []
        self.hostname = ""
        self.action = ""

    async def verify(self, token: str, remote_ip: str | None) -> TurnstileResult:
        self.seen.append((token, remote_ip))
        if token == "down":
            raise TurnstileUnavailableError("simulated outage")
        if token != "good":
            return TurnstileResult(success=False, error_codes=["invalid-input-response"])
        return TurnstileResult(success=True, hostname=self.hostname, action=self.action)


@pytest.fixture
def turnstile() -> FakeTurnstile:
    return FakeTurnstile()


@pytest.fixture(autouse=True)
def _turnstile_off_by_default(monkeypatch: pytest.MonkeyPatch) -> None:
    """Os testes existentes não levam token: o Turnstile liga-se só nos testes dedicados (test_turnstile.py)."""
    monkeypatch.setattr(get_settings(), "turnstile_enabled_mode", "false")
    monkeypatch.setattr(get_settings(), "turnstile_required", False)


@pytest.fixture(autouse=True)
def _clean_ai_cache() -> None:
    response_cache.clear()  # a cache de respostas é global ao processo: cada teste começa vazio


_SEED_SOURCES = (
    "seed.py",
    "core/upsert.py",
    "domain/geo.py",
    "domain/parish_area.py",
    "features/municipal/importer.py",
    "features/planning/params.py",
    "features/planning/service.py",
)


def _template_fingerprint() -> str:
    """Muda quando muda o esquema (DDL dos modelos), o código do seed ou os dados importados: reconstrói o template."""
    from sqlalchemy.dialects import postgresql  # noqa: PLC0415
    from sqlalchemy.schema import CreateIndex, CreateTable  # noqa: PLC0415

    h = hashlib.sha1(usedforsecurity=False)
    for table in Base.metadata.sorted_tables:
        h.update(str(CreateTable(table).compile(dialect=postgresql.dialect())).encode())
        for index in sorted(table.indexes, key=lambda i: str(i.name)):
            h.update(str(CreateIndex(index).compile(dialect=postgresql.dialect())).encode())
    root = Path(__file__).resolve().parents[1] / "src" / "novelo"
    for rel in _SEED_SOURCES:
        h.update(rel.encode())
        h.update((root / rel).read_bytes())
    data = get_settings().data_dir
    for f in sorted(data.rglob("*")) if data.exists() else []:
        if f.is_file():
            st = f.stat()
            h.update(f"{f.relative_to(data).as_posix()}:{st.st_size}:{st.st_mtime_ns}".encode())
    return h.hexdigest()[:12]


def _build_template(admin: Any, template: str, base_name: str) -> None:
    """Cria o template com o esquema (create_all) e os dados de referência. Corre 1x por alteração, sob lock."""
    building = f"{template}_building"
    admin.execute(text(f'DROP DATABASE IF EXISTS "{building}"'))
    admin.execute(text(f'CREATE DATABASE "{building}"'))
    url = _BASE_DB.rsplit("/", 1)[0] + "/" + building
    sync = create_engine(url.replace("+asyncpg", "+psycopg2"))
    Base.metadata.create_all(sync)
    sync.dispose()
    asyncio.run(_seed_reference_data(url))
    admin.execute(text(f'ALTER DATABASE "{building}" RENAME TO "{template}"'))
    stale = admin.execute(
        text("SELECT datname FROM pg_database WHERE datname LIKE :p AND datname <> :t"),
        {"p": f"{base_name}\\_tpl\\_%", "t": template},
    ).scalars()
    for name in list(stale):
        admin.execute(text(f'DROP DATABASE IF EXISTS "{name}"'))


def _drop_orphans(admin: Any, base_name: str) -> None:
    """Apaga bases de corridas mortas há mais de 6 h (o comentário da base guarda a hora de criação)."""
    names = admin.execute(
        text(
            "SELECT datname FROM pg_database WHERE datname LIKE :p AND datname NOT LIKE :t "
            "AND COALESCE(NULLIF(shobj_description(oid, 'pg_database'), '')::bigint, 0) < :limit"
        ),
        {"p": f"{base_name}\\_%\\_%", "t": f"{base_name}\\_tpl\\_%", "limit": int(time.time()) - 6 * 3600},
    ).scalars()
    for name in list(names):
        with suppress(Exception):  # em uso por outra corrida: fica
            admin.execute(text(f'DROP DATABASE IF EXISTS "{name}"'))


@pytest.fixture(scope="session", autouse=True)
def _database() -> Iterator[None]:
    """BD de teste por processo, clonada de um template (esquema + seed feitos 1x, reutilizados entre corridas)."""
    admin = create_engine(
        TEST_DB.replace("+asyncpg", "+psycopg2").rsplit("/", 1)[0] + "/postgres", isolation_level="AUTOCOMMIT"
    )
    name = TEST_DB.rsplit("/", 1)[1]
    base_name = _BASE_DB.rsplit("/", 1)[1]
    template = f"{base_name}_tpl_{_template_fingerprint()}"
    try:
        conn = admin.connect()
    except Exception:  # sem Postgres: só correm os testes que não precisam da BD
        yield
        return
    try:
        conn.execute(text("SELECT pg_advisory_lock(727274)"))  # serializa construção e clonagem entre workers
        exists = conn.execute(text("SELECT 1 FROM pg_database WHERE datname = :n"), {"n": template}).scalar()
        if not exists:
            _build_template(conn, template, base_name)
        _drop_orphans(conn, base_name)
        conn.execute(text(f'DROP DATABASE IF EXISTS "{name}"'))
        conn.execute(text(f'CREATE DATABASE "{name}" TEMPLATE "{template}"'))
        conn.execute(text(f"COMMENT ON DATABASE \"{name}\" IS '{int(time.time())}'"))
        conn.execute(text("SELECT pg_advisory_unlock(727274)"))
    finally:
        conn.close()
    yield
    with admin.connect() as conn:
        conn.execute(text(f'DROP DATABASE IF EXISTS "{name}" WITH (FORCE)'))
    admin.dispose()


@pytest.fixture(scope="session", autouse=True)
def _cheap_password_hashing() -> None:
    """Argon2 com custo mínimo só nos testes (o custo real custa ~50 ms por hash e há centenas de logins)."""
    from argon2 import PasswordHasher  # noqa: PLC0415

    from novelo.core import security  # noqa: PLC0415

    security._hasher = PasswordHasher(time_cost=1, memory_cost=8, parallelism=1)


# Marcadores atribuídos por ficheiro (sem tocar nos testes): `pytest -m "not solver"`, `-m llm`, `-m slow`.
_MARKS: dict[str, tuple[str, ...]] = {
    "solver": (
        "test_planning", "test_insights", "test_whatif", "test_overview", "test_network", "test_domain",
        "test_sensitivity", "test_benchmarks", "test_coverage", "test_copilot",
    ),
    "llm": ("test_copilot", "test_whatif", "test_ai_", "test_openrouter", "test_stream_adapter", "test_alert_suggest",
            "test_lots", "test_verify", "test_catalog", "test_eval_triage"),
    "slow": ("test_etl_", "test_reports", "test_copilot_attachments"),
}  # fmt: skip


def pytest_collection_modifyitems(items: list[pytest.Item]) -> None:
    for item in items:
        stem = item.path.stem
        for mark, prefixes in _MARKS.items():
            if stem.startswith(prefixes):
                item.add_marker(getattr(pytest.mark, mark))


@pytest.fixture(scope="session", autouse=True)
def _capped_routing_search() -> Iterator[None]:
    """O VRP (guided local search) gasta sempre o tempo todo (2 s por modo e por cenário, são ~85% dos 6 min da suite).

    Nos testes rápidos (por omissão) a pesquisa é cortada a `NOVELO_TEST_VRP_MS` (250 ms). `NOVELO_TEST_SOLVER=full`
    (usado por `just check`) mantém os limites de produção. A solução continua a ser válida; só pode ser menos curta.
    """
    if os.environ.get("NOVELO_TEST_SOLVER", "fast") == "full":
        yield
        return
    from ortools.constraint_solver import pywrapcp  # noqa: PLC0415

    original = pywrapcp.RoutingModel.SolveWithParameters
    limit_ns = int(os.environ.get("NOVELO_TEST_VRP_MS", "250")) * 1_000_000

    def capped(self: Any, search_parameters: Any, *args: Any, **kwargs: Any) -> Any:
        search_parameters.time_limit.seconds = 0
        search_parameters.time_limit.nanos = limit_ns
        return original(self, search_parameters, *args, **kwargs)

    pywrapcp.RoutingModel.SolveWithParameters = capped
    yield
    pywrapcp.RoutingModel.SolveWithParameters = original


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
    session: AsyncSession, outbox: OutboxSender, llm: FakeLlm, catalog: ModelCatalog, turnstile: FakeTurnstile
) -> AsyncGenerator[httpx.AsyncClient, None]:
    app = create_app()
    _mount_ai_routers(app, catalog)

    async def _db() -> AsyncGenerator[AsyncSession, None]:
        yield session

    app.dependency_overrides[get_db] = _db
    app.dependency_overrides[get_email_sender] = lambda: outbox
    app.dependency_overrides[get_llm] = lambda: llm
    app.dependency_overrides[get_turnstile] = lambda: turnstile
    app.dependency_overrides[get_catalog] = lambda: catalog
    from novelo.features.copilot.router import get_stream_deps  # noqa: PLC0415

    app.dependency_overrides[get_stream_deps] = lambda: stream_deps_for(session, llm, catalog)
    auth_limiter.reset()
    reset_limiter.reset()
    triage_limiter.reset()
    whatif_limiter.reset()
    copilot_limiter.reset()
    alerts_limiter.reset()
    for limiter in (
        guest_ai_limiter,
        guest_solver_limiter,
        magic_email_limiter,
        magic_link_limiter,
        magic_verify_limiter,
        quick_join_code_limiter,
        quick_join_email_limiter,
        quick_join_limiter,
    ):
        limiter.reset()
    # Todos os limitadores (incl. os novos) começam vazios em cada teste: sem isto o estado passa de teste para teste
    # dentro do mesmo worker e o resultado dependeria da distribuição do xdist.
    from novelo.core.ratelimit import RateLimiter  # noqa: PLC0415

    if hasattr(RateLimiter, "reset_all"):
        RateLimiter.reset_all()
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
async def logged_in(client: httpx.AsyncClient, session: AsyncSession) -> httpx.AsyncClient:
    resp = await client.post(
        "/api/v1/auth/register", json={"email": "ana@vitrus.pt", "password": PASSWORD, "name": "Ana"}
    )
    assert resp.status_code == 201
    assert resp.json()["approval_status"] == "pending"  # o registo público espera por um administrador
    from sqlalchemy import update  # noqa: PLC0415

    from novelo.features.users.models import User  # noqa: PLC0415

    await session.execute(update(User).where(User.email == "ana@vitrus.pt").values(approval_status="approved"))
    await session.commit()
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
