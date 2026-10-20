import asyncio
import uuid
from collections.abc import AsyncGenerator, AsyncIterator
from contextlib import aclosing
from datetime import datetime
from typing import Annotated, Any, Literal

import anyio
from fastapi import APIRouter, Depends, File, Path, Query, UploadFile
from fastapi.responses import JSONResponse, Response, StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.adapters.openrouter import OpenRouterClient
from novelo.ai.catalog import ModelCatalog, get_catalog
from novelo.ai.catalog import catalog as default_catalog
from novelo.core.database import SessionLocal, get_db
from novelo.core.deps import CurrentUser, NotImpersonating
from novelo.core.errors import FeatureDisabledError
from novelo.core.guest import NotGuestDep, PdfGuard, guest_ai_guard
from novelo.core.ratelimit import copilot_limiter
from novelo.features.copilot import actions as action_service
from novelo.features.copilot import history, memory_api, service, sessions, threads, uploads, user_settings
from novelo.features.copilot import mentions as mention_service
from novelo.features.copilot.agent import PreparedTurn, StreamDeps, stream_turn
from novelo.features.copilot.schemas import (
    AttachmentOut,
    CommandsOut,
    CompactOut,
    CopilotCommand,
    CopilotDoneEvent,
    CopilotErrorEvent,
    CopilotEvent,
    CopilotEventCatalog,
    CopilotEventMessage,
    CopilotReply,
    CopilotRequest,
    CopilotStreamRequest,
    DataExport,
    FeedbackIn,
    FeedbackOut,
    MentionsOut,
    MentionType,
    ProjectOut,
    ShareOut,
    ThreadExport,
    ThreadOut,
    ThreadPage,
    ThreadSummaryOut,
    ThreadUpdate,
)
from novelo.features.copilot.schemas_actions import ActionOut, ActionPage, ActionType, ConfirmActionIn, ProposeActionIn
from novelo.features.copilot.schemas_artifacts import ArtifactSource, CartesianChart, ChartArtifact, Point, Series
from novelo.features.copilot.schemas_history import ArtifactOut, ArtifactPage, HistoryKind, HistoryPage, TimelineEvent
from novelo.features.copilot.schemas_memory import (
    CopilotSettings,
    CopilotSettingsOut,
    MemoryEntryCreate,
    MemoryEntryList,
    MemoryEntryOut,
    MemoryEntryUpdate,
    MemoryTarget,
    PendingApprove,
    PendingMemoryOut,
    PersonaPreviewIn,
    PersonaPreviewOut,
    SessionSearchOut,
)
from novelo.features.lots.router import get_llm
from novelo.features.users.models import User
from novelo.features.users.schemas import Locale

router = APIRouter()  # prefixo /copilot
Db = Annotated[AsyncSession, Depends(get_db)]
Llm = Annotated[OpenRouterClient, Depends(get_llm)]
Catalog = Annotated[ModelCatalog, Depends(get_catalog)]

HEARTBEAT_S = 15.0
SSE_HEADERS = {
    "Cache-Control": "no-cache, no-transform",
    "X-Accel-Buffering": "no",  # o nginx não pode guardar a resposta em memória
    "Connection": "keep-alive",
}
SSE_RESPONSE: dict[int | str, dict[str, Any]] = {
    200: {
        "description": "Stream de eventos `CopilotEventMessage` (text/event-stream): cada mensagem SSE tem `event: <type>` e `data: <JSON>`",
        "content": {"text/event-stream": {"schema": {"$ref": "#/components/schemas/CopilotEventMessage"}}},
    }
}


async def _per_user_limit(user: CurrentUser, db: Db) -> None:
    copilot_limiter.check(f"copilot:{user.id}")
    await guest_ai_guard(user, db)  # convidados: pedidos por hora e gasto de IA em 24 h


async def _precheck(db: AsyncSession, user: User) -> None:
    """Antes de abrir o stream: sem chave ou sem orçamento devolve um erro HTTP normal (503)."""
    from novelo.core.config import get_settings  # noqa: PLC0415
    from novelo.features.ai_admin.service import build_runtime  # noqa: PLC0415

    if not get_settings().llm_enabled:
        raise FeatureDisabledError("AI is disabled: OPENROUTER_API_KEY is not set")
    (await build_runtime(db, user)).check_budget()


async def _make_llm(db: AsyncSession, user: User) -> OpenRouterClient:
    from novelo.features.ai_admin.service import build_client  # noqa: PLC0415

    return await build_client(db, user)


def get_stream_deps() -> StreamDeps:
    """Dependências do stream (substituíveis nos testes): sessão própria, cliente do modelo e catálogo."""
    return StreamDeps(session_factory=SessionLocal, make_llm=_make_llm, catalog=default_catalog, precheck=_precheck)


Deps = Annotated[StreamDeps, Depends(get_stream_deps)]


def encode(event: CopilotEvent) -> bytes:
    data = event.model_dump_json()
    return f"event: {event.type}\ndata: {data}\n\n".encode()


async def sse(events: AsyncGenerator[CopilotEvent, None]) -> AsyncIterator[bytes]:
    """Eventos -> bytes SSE, com `: ping` a cada 15 s de silêncio. Se o cliente desligar, cancela o agente."""
    queue: asyncio.Queue[bytes | None] = asyncio.Queue()

    async def pump() -> None:
        try:
            async with aclosing(events) as stream:
                async for event in stream:
                    await queue.put(encode(event))
        except Exception as exc:  # o agente já devolve erros como eventos; isto é só uma rede de segurança
            await queue.put(encode(CopilotErrorEvent(code="internal_error", message=type(exc).__name__)))
            await queue.put(encode(CopilotDoneEvent(finish="error")))
        finally:
            await queue.put(None)

    task = asyncio.create_task(pump())
    try:
        while True:
            try:
                item = await asyncio.wait_for(queue.get(), HEARTBEAT_S)
            except TimeoutError:
                yield b": ping\n\n"
                continue
            if item is None:
                break
            yield item
    finally:
        with anyio.CancelScope(shield=True):  # deixa o agente gravar a mensagem parcial e o uso antes de terminar
            task.cancel()
            await asyncio.gather(task, return_exceptions=True)


def _stream(deps: StreamDeps, user: User, turn: PreparedTurn) -> StreamingResponse:
    return StreamingResponse(
        sse(stream_turn(deps, user.id, turn, user.impersonation)), media_type="text/event-stream", headers=SSE_HEADERS
    )


# --- Conversa em streaming ---------------------------------------------------------------------------


@router.post(
    "/stream", response_class=StreamingResponse, responses=SSE_RESPONSE, dependencies=[Depends(_per_user_limit)]
)
async def copilot_stream(body: CopilotStreamRequest, user: CurrentUser, db: Db, deps: Deps) -> StreamingResponse:
    """Responde em `text/event-stream` com eventos tipados (ver `CopilotEventMessage`). Menções, anexos e contexto
    da página são validados e resolvidos no servidor antes de abrir o stream; erros dessa fase são HTTP normais."""
    await deps.precheck(db, user)
    turn = await threads.prepare_turn(db, user, body)
    return _stream(deps, user, turn)


@router.post(
    "/threads/{thread_id}/regenerate",
    response_class=StreamingResponse,
    responses=SSE_RESPONSE,
    dependencies=[Depends(_per_user_limit)],
)
async def regenerate_copilot_response(
    thread_id: uuid.UUID, user: CurrentUser, db: Db, deps: Deps, locale: Locale = "pt-PT"
) -> StreamingResponse:
    """Apaga a última resposta e volta a gerá-la a partir da última pergunta (mesmos anexos e menções)."""
    await deps.precheck(db, user)
    return _stream(deps, user, await threads.prepare_regenerate(db, user, thread_id, locale))


def _sample_action(status: str) -> ActionOut:
    from datetime import UTC  # noqa: PLC0415

    now = datetime.now(UTC)
    return ActionOut(
        id=uuid.UUID(int=2), type=ActionType.RESOLVE_ALERT, params={"alert_id": str(uuid.UUID(int=3)), "note": "Confirmado com a Vitrus"},
        summary="Alterar o estado de um alerta de qualidade dos dados", impact="Fica registado quem e quando; pode ser reaberto.", risk="medium",
        reversible=True, status=status, auto_approved=False, requires_text=False, result={}, thread_id=None, user_id=uuid.UUID(int=1),
        can_undo=status == "executed", expires_at=now, decided_at=None, created_at=now,
    )  # fmt: skip


@router.get("/event-schema", response_model=CopilotEventCatalog)
async def get_copilot_event_schema() -> CopilotEventCatalog:
    """Um exemplo de cada evento do stream, na ordem típica. Documenta o contrato e dá ao cliente gerado os tipos."""
    import uuid as _uuid  # noqa: PLC0415

    from novelo.domain.vocab import ScenarioObjective  # noqa: PLC0415
    from novelo.features.copilot import schemas as s  # noqa: PLC0415

    sample = _uuid.UUID(int=1)
    card = s.ScenarioCard(
        scenario_id=sample, label="Copilot · Exemplo", objective=ScenarioObjective.MAX_TONNES, created_now=True,
        parent_id=None, kpis=s.CardKpis(tonnes_year=321.0, annual_cost_eur=39400.0, eur_per_tonne=122.7, capex_eur=8000.0, coverage_pct=61.5),
    )  # fmt: skip
    events: list[CopilotEvent] = [
        s.CopilotStartEvent(thread_id=sample, message_id=sample, model="openai/gpt-6-luna", prompt_version="v2"),
        s.CopilotStatusEvent(phase="thinking", label_key="status.thinking"),
        s.CopilotStatusEvent(phase="tool", label_key="status.running_optimizer", detail="Serzedelo"),
        s.CopilotToolStartEvent(id="call_1", name="what_if", args_summary="scenario_id=1a2b3c4d…, set_modes=[…]"),
        s.CopilotToolResultEvent(
            id="call_1",
            name="what_if",
            ok=True,
            summary="«Copilot · Exemplo»: 321.0 t/ano, 122.7 €/t",
            duration_ms=1800,
        ),
        s.CopilotCardEvent(card=card),
        s.CopilotStatusEvent(phase="writing", label_key="status.writing"),
        s.CopilotTextDeltaEvent(delta="Criei a variante com Serzedelo a pedido."),
        s.CopilotStatusEvent(phase="verifying", label_key="status.verifying"),
        s.CopilotRetractEvent(),
        s.CopilotVerificationEvent(verified=True),
        s.CopilotSuggestionsEvent(items=["Compara com o cenário base", "Qual é a cobertura?"]),
        s.CopilotTitleEvent(title="Serzedelo a pedido"),
        s.CopilotUsageEvent(prompt_tokens=4200, completion_tokens=310, tokens=4510, cost_usd=0.00057),
        s.CopilotContextEvent(used_tokens=5200, window_tokens=64000, compacted=False),
        s.CopilotMemoryEvent(
            action="added",
            target="user",
            content="Prefere respostas curtas e tabelas.",
            status="applied",
            entry_id=sample,
        ),
        s.CopilotPlanEvent(steps=["Ler o cenário base", "Correr a variante", "Comparar"]),
        s.CopilotClarifyEvent(question="Com que orçamento anual?", options=["40 000 €", "60 000 €", "Outro valor"]),
        s.CopilotSourcesEvent(
            items=[
                s.CopilotSource(kind="tool", label="what_if"),
                s.CopilotSource(kind="scenario", label="Contido", ref="/scenarios/1"),
            ]
        ),
        s.CopilotArtifactEvent(
            id=sample,
            title="Custo por tonelada por cenário",
            sources=[ArtifactSource(tool="list_scenarios", label="Otimizador", result_id="r1")],
            artifact=ChartArtifact(
                spec=CartesianChart(
                    title="Custo por tonelada por cenário",
                    source="Otimizador",
                    estimate=True,
                    kind="bar",
                    x_label="Cenário",
                    y_label="Custo por tonelada",
                    y_unit="€/t",
                    series=[Series(name="€/t", unit="€/t", points=[Point(x="Contido", y=122.7)])],
                )
            ),
        ),
        s.CopilotConfirmEvent(action=_sample_action("proposed")),
        s.CopilotActionResultEvent(action=_sample_action("executed")),
        s.CopilotNavigateEvent(
            route="/scenarios/$scenarioId", label="Abrir o cenário", params={"scenarioId": str(sample)}
        ),
        s.CopilotErrorEvent(code="ai_budget_exceeded", message="The monthly AI budget has been reached"),
        s.CopilotDoneEvent(),
    ]
    return CopilotEventCatalog(events=[CopilotEventMessage(root=e) for e in events])


# --- Conversas ----------------------------------------------------------------------------------------


@router.get("/threads", response_model=ThreadPage)
async def list_copilot_threads(
    user: CurrentUser,
    db: Db,
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 30,
    archived: bool = False,
    q: Annotated[str | None, Query(max_length=80)] = None,
    pinned: bool | None = None,
    project: Annotated[str | None, Query(max_length=60)] = None,
) -> ThreadPage:
    """Conversas do utilizador (fixadas primeiro, depois a mais recente). `q` pesquisa títulos e mensagens, sem acentos."""
    return await threads.list_threads(db, user, offset, limit, archived, q, pinned, project)


@router.get("/projects", response_model=list[ProjectOut])
async def list_copilot_projects(user: CurrentUser, db: Db) -> list[ProjectOut]:
    """Pastas simples (`project`) com o número de conversas."""
    return await threads.projects(db, user)


@router.get("/threads/{thread_id}", response_model=ThreadOut)
async def get_copilot_thread(thread_id: uuid.UUID, user: CurrentUser, db: Db, catalog: Catalog) -> ThreadOut:
    return await threads.get_thread(db, user, thread_id, catalog)


@router.patch("/threads/{thread_id}", response_model=ThreadSummaryOut)
async def update_copilot_thread(
    thread_id: uuid.UUID, body: ThreadUpdate, user: CurrentUser, db: Db
) -> ThreadSummaryOut:
    """Renomear, fixar, arquivar ou mover para uma pasta (qualquer subconjunto)."""
    return await threads.update(db, user, thread_id, body)


@router.delete("/threads/{thread_id}", status_code=204)
async def delete_copilot_thread(thread_id: uuid.UUID, user: CurrentUser, db: Db) -> Response:
    """Apaga a conversa e o histórico derivado (mensagens, artefactos e anexos que usou)."""
    await threads.delete(db, user, thread_id)
    return Response(status_code=204)


@router.post("/threads/{thread_id}/compact", response_model=CompactOut)
async def compact_copilot_thread(
    thread_id: uuid.UUID, user: CurrentUser, db: Db, llm: Llm, catalog: Catalog
) -> CompactOut:
    """Resume as voltas antigas num memo e reduz os resultados de ferramentas a digests (comando `/compact`)."""
    try:
        return await threads.compact(db, llm, user, thread_id, catalog)
    finally:
        await llm.aclose()


@router.get("/threads/{thread_id}/export", response_model=ThreadExport, dependencies=[NotImpersonating])
async def export_copilot_thread(thread_id: uuid.UUID, user: CurrentUser, db: Db) -> ThreadExport:
    """A conversa em Markdown, para o comando `/exportar`."""
    return await threads.export(db, user, thread_id)


@router.get(
    "/threads/{thread_id}/export.pdf",
    response_class=Response,
    responses={200: {"content": {"application/pdf": {}}}},
    dependencies=[NotImpersonating, PdfGuard],
)
async def export_copilot_thread_pdf(thread_id: uuid.UUID, user: CurrentUser, db: Db) -> Response:
    """A conversa em PDF."""
    filename, pdf = await threads.export_pdf(db, user, thread_id)
    return Response(
        content=pdf, media_type="application/pdf", headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@router.post("/threads/{thread_id}/share", response_model=ShareOut)
async def share_copilot_thread(thread_id: uuid.UUID, user: CurrentUser, db: Db) -> ShareOut:
    """Cria (ou devolve) o link de partilha só de leitura para outros utilizadores autenticados."""
    return await threads.share(db, user, thread_id)


@router.delete("/threads/{thread_id}/share", status_code=204)
async def unshare_copilot_thread(thread_id: uuid.UUID, user: CurrentUser, db: Db) -> Response:
    await threads.unshare(db, user, thread_id)
    return Response(status_code=204)


@router.get("/shared/{token}", response_model=ThreadOut, dependencies=[NotGuestDep])
async def get_shared_copilot_thread(
    token: Annotated[str, Path(max_length=64)], user: CurrentUser, db: Db, catalog: Catalog
) -> ThreadOut:
    """Conversa partilhada (só leitura)."""
    return await threads.get_shared(db, user, token, catalog)


@router.get("/threads/{thread_id}/timeline", response_model=list[TimelineEvent])
async def get_copilot_thread_timeline(thread_id: uuid.UUID, user: CurrentUser, db: Db) -> list[TimelineEvent]:
    """Cronologia de eventos da conversa: mensagens, ferramentas, memórias, anexos, ações e artefactos."""
    return await threads.timeline(db, user, thread_id)


@router.put("/messages/{message_id}/feedback", response_model=FeedbackOut)
async def send_copilot_feedback(message_id: uuid.UUID, body: FeedbackIn, user: CurrentUser, db: Db) -> FeedbackOut:
    """👍 (1) ou 👎 (-1) numa resposta; enviar outra vez substitui."""
    return await threads.set_feedback(db, user, message_id, body)


# --- Histórico, ações e artefactos --------------------------------------------------------------------


@router.get("/history", response_model=HistoryPage)
async def list_copilot_history(
    user: CurrentUser,
    db: Db,
    cursor: str | None = None,
    kinds: Annotated[list[HistoryKind] | None, Query()] = None,
    since: datetime | None = None,
    until: datetime | None = None,
    status: Annotated[str | None, Query(max_length=20)] = None,
    q: Annotated[str | None, Query(max_length=80)] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 30,
) -> HistoryPage:
    """Cronologia unificada (conversas, ações, artefactos, memórias, anexos) com cursor estável e pesquisa sem acentos."""
    return await history.history_page(
        db, user, cursor=cursor, kinds=list(kinds or []), since=since, until=until, status=status, q=q, limit=limit
    )


@router.get("/actions", response_model=ActionPage)
async def list_copilot_actions(
    user: CurrentUser,
    db: Db,
    scope: Literal["mine", "all"] = "mine",
    cursor: str | None = None,
    status: Annotated[str | None, Query(max_length=20)] = None,
    type: Annotated[ActionType | None, Query()] = None,
    q: Annotated[str | None, Query(max_length=80)] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 30,
    locale: Locale = "pt-PT",
) -> ActionPage:
    """Registo de ações (quem, o quê, parâmetros, resultado, estado). `scope=all` é auditoria só para administradores (sem conversas)."""
    return await history.actions_page(
        db,
        user,
        scope=scope,
        cursor=cursor,
        status=status,
        type_=type.value if type else None,
        q=q,
        limit=limit,
        locale=locale,
    )


@router.post("/actions", response_model=ActionOut, status_code=201)
async def propose_copilot_action(body: ProposeActionIn, user: CurrentUser, db: Db, llm: Llm) -> ActionOut:
    """Propõe uma ação (por formulário, sem passar pelo modelo). Fica à espera de `confirm`; expira em 10 minutos."""
    try:
        ctx = action_service.Ctx(db, user, body.locale, llm)
        row = await action_service.propose(ctx, body.type, dict(body.params), body.thread_id)
        return action_service.to_out(row, body.locale)
    finally:
        await llm.aclose()


@router.post("/actions/{action_id}/confirm", response_model=ActionOut)
async def confirm_copilot_action(
    action_id: uuid.UUID,
    body: ConfirmActionIn,
    user: CurrentUser,
    db: Db,
    llm: Llm,
    catalog: Catalog,
    locale: Locale = "pt-PT",
) -> ActionOut:
    """Executa a ação proposta COMO o utilizador. Idempotente: confirmar de novo devolve o resultado guardado."""
    try:
        ctx = action_service.Ctx(db, user, locale, llm, catalog)
        return action_service.to_out(await action_service.confirm(ctx, action_id, body.confirmation_text), locale)
    finally:
        await llm.aclose()


@router.post("/actions/{action_id}/reject", response_model=ActionOut)
async def reject_copilot_action(action_id: uuid.UUID, user: CurrentUser, db: Db, locale: Locale = "pt-PT") -> ActionOut:
    return action_service.to_out(await action_service.reject(action_service.Ctx(db, user, locale), action_id), locale)


@router.post("/actions/{action_id}/undo", response_model=ActionOut)
async def undo_copilot_action(
    action_id: uuid.UUID, user: CurrentUser, db: Db, catalog: Catalog, locale: Locale = "pt-PT"
) -> ActionOut:
    """Desfaz uma ação executada, se for reversível (criações, estados de alertas, pressupostos, contas, modelo de IA)."""
    return action_service.to_out(
        await action_service.undo(action_service.Ctx(db, user, locale, None, catalog), action_id), locale
    )


@router.get("/artifacts", response_model=ArtifactPage)
async def list_copilot_artifacts(
    user: CurrentUser,
    db: Db,
    cursor: str | None = None,
    artifact_type: Annotated[str | None, Query(max_length=16)] = None,
    pinned: bool | None = None,
    q: Annotated[str | None, Query(max_length=80)] = None,
    thread_id: uuid.UUID | None = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 30,
) -> ArtifactPage:
    """Galeria de gráficos, tabelas, mapas... gerados nas conversas."""
    return await history.artifacts_page(
        db, user, cursor=cursor, artifact_type=artifact_type, pinned=pinned, q=q, thread_id=thread_id, limit=limit
    )


@router.post("/artifacts/{artifact_id}/refresh", response_model=ArtifactOut)
async def refresh_copilot_artifact(
    artifact_id: uuid.UUID, user: CurrentUser, db: Db, locale: Locale = "pt-PT"
) -> ArtifactOut:
    """Volta a calcular o artefacto com os dados atuais (mesma ferramenta, mesmos argumentos)."""
    return await history.refresh_artifact(db, user, artifact_id, locale)


@router.put("/artifacts/{artifact_id}/pin", response_model=ArtifactOut)
async def pin_copilot_artifact(artifact_id: uuid.UUID, user: CurrentUser, db: Db, pinned: bool = True) -> ArtifactOut:
    """Fixar (ou largar) um artefacto no painel."""
    return await history.set_pinned(db, user, artifact_id, pinned)


@router.delete("/artifacts/{artifact_id}", status_code=204)
async def delete_copilot_artifact(artifact_id: uuid.UUID, user: CurrentUser, db: Db) -> Response:
    await history.delete_artifact(db, user, artifact_id)
    return Response(status_code=204)


# --- Anexos, menções e comandos ---------------------------------------------------------------------


@router.post("/attachments", response_model=list[AttachmentOut], status_code=201)
async def upload_copilot_attachments(
    user: CurrentUser,
    db: Db,
    catalog: Catalog,
    files: Annotated[list[UploadFile], File(description="Até 5 ficheiros, 10 MB cada")],
) -> list[AttachmentOut]:
    """Imagens, PDF, CSV/XLSX, TXT/MD/JSON. O ficheiro é validado pelo conteúdo e descartado: guarda-se só o texto extraído."""
    return await uploads.upload(db, user, files, catalog)


@router.get("/mentions", response_model=MentionsOut)
async def search_copilot_mentions(
    user: CurrentUser,
    db: Db,
    q: Annotated[str, Query(max_length=80)] = "",
    types: Annotated[list[MentionType] | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=30)] = 12,
    locale: Locale = "pt-PT",
) -> MentionsOut:
    """Auto-completar de `@`: entidades tipadas, ordenadas por relevância (prefixo, depois aproximado, sem acentos)."""
    return await mention_service.search(db, user, q, list(types or []), limit, locale)


COMMANDS = [
    CopilotCommand(
        name="/compact",
        label_key="command.compact",
        description_key="command.compact.description",
        kind="server",
        admin_only=False,
    ),
    CopilotCommand(
        name="/novo",
        label_key="command.new",
        description_key="command.new.description",
        kind="client",
        admin_only=False,
    ),
    CopilotCommand(
        name="/limpar",
        label_key="command.clear",
        description_key="command.clear.description",
        kind="client",
        admin_only=False,
    ),
    CopilotCommand(
        name="/exportar",
        label_key="command.export",
        description_key="command.export.description",
        kind="client",
        admin_only=False,
    ),
    CopilotCommand(
        name="/modelo",
        label_key="command.model",
        description_key="command.model.description",
        kind="client",
        admin_only=True,
        route="/admin/ai",
    ),
]


@router.get("/commands", response_model=CommandsOut)
async def list_copilot_commands(user: CurrentUser) -> CommandsOut:
    """Comandos `/` disponíveis para o utilizador e as ações do composer (anexar ficheiro, anexar ecrã atual, @)."""
    return CommandsOut(
        commands=[c for c in COMMANDS if not c.admin_only or user.role == "admin"],
        composer_actions=["attach_file", "attach_current_screen", "mention"],
    )


# --- Definições, memória e personalidade --------------------------------------------------------------


@router.get("/settings", response_model=CopilotSettingsOut)
async def get_copilot_settings(user: CurrentUser, db: Db) -> CopilotSettingsOut:
    """Definições do utilizador (memória, persona, notificações, retenção...), com medidores de uso da memória."""
    return await user_settings.out(db, user.id)


@router.put("/settings", response_model=CopilotSettingsOut)
async def update_copilot_settings(body: CopilotSettings, user: CurrentUser, db: Db) -> CopilotSettingsOut:
    return await user_settings.save(db, user.id, body)


@router.post("/persona/preview", response_model=PersonaPreviewOut, dependencies=[Depends(_per_user_limit)])
async def preview_copilot_persona(body: PersonaPreviewIn, user: CurrentUser, llm: Llm) -> PersonaPreviewOut:
    """Como o copiloto responderia a uma frase de exemplo com a persona escolhida (chamada barata, sem ferramentas)."""
    try:
        return await memory_api.preview_persona(llm, body)
    finally:
        await llm.aclose()


@router.get("/memory/entries", response_model=MemoryEntryList)
async def list_copilot_memory_entries(user: CurrentUser, db: Db, target: MemoryTarget | None = None) -> MemoryEntryList:
    return await memory_api.list_entries(db, user, target)


@router.post("/memory/entries", response_model=MemoryEntryOut, status_code=201)
async def create_copilot_memory_entry(body: MemoryEntryCreate, user: CurrentUser, db: Db) -> MemoryEntryOut:
    return await memory_api.create_entry(db, user, body)


@router.patch("/memory/entries/{entry_id}", response_model=MemoryEntryOut)
async def update_copilot_memory_entry(
    entry_id: uuid.UUID, body: MemoryEntryUpdate, user: CurrentUser, db: Db
) -> MemoryEntryOut:
    return await memory_api.update_entry(db, user, entry_id, body)


@router.delete("/memory/entries/{entry_id}", status_code=204)
async def delete_copilot_memory_entry(entry_id: uuid.UUID, user: CurrentUser, db: Db) -> Response:
    await memory_api.delete_entry(db, user, entry_id)
    return Response(status_code=204)


@router.delete("/memory/entries", status_code=204, dependencies=[NotImpersonating])
async def clear_copilot_memory(target: MemoryTarget, user: CurrentUser, db: Db) -> Response:
    """Esvazia uma memória (`memory` ou `user`)."""
    await memory_api.clear(db, user, target)
    return Response(status_code=204)


@router.get("/memory/pending", response_model=list[PendingMemoryOut])
async def list_pending_memory(user: CurrentUser, db: Db) -> list[PendingMemoryOut]:
    """Escritas de memória à espera de aprovação (quando `write_approval=ask`)."""
    return await memory_api.list_pending(db, user)


@router.post("/memory/pending/{pending_id}/approve", response_model=PendingMemoryOut)
async def approve_pending_memory(
    pending_id: uuid.UUID, body: PendingApprove, user: CurrentUser, db: Db
) -> PendingMemoryOut:
    return await memory_api.approve(db, user, pending_id, body)


@router.post("/memory/pending/{pending_id}/reject", response_model=PendingMemoryOut)
async def reject_pending_memory(pending_id: uuid.UUID, user: CurrentUser, db: Db) -> PendingMemoryOut:
    return await memory_api.reject(db, user, pending_id)


@router.get("/sessions/search", response_model=SessionSearchOut)
async def search_copilot_sessions(
    user: CurrentUser,
    db: Db,
    q: Annotated[str, Query(min_length=2, max_length=120)],
    limit: Annotated[int, Query(ge=1, le=30)] = 10,
    since: datetime | None = None,
    until: datetime | None = None,
) -> SessionSearchOut:
    """Pesquisa nas conversas anteriores do utilizador (sem acentos, prefixos), com excertos e datas."""
    return await sessions.search(db, user.id, q, limit, None, since, until)


@router.get("/data/export", response_model=DataExport, dependencies=[NotImpersonating])
async def export_copilot_data(user: CurrentUser, db: Db, catalog: Catalog) -> DataExport:
    """Tudo o que o copiloto guarda sobre o utilizador: definições, memória, conversas e ações (RGPD)."""
    return await memory_api.export_data(db, user, catalog)


@router.delete("/data", dependencies=[NotImpersonating])
async def delete_copilot_data(
    confirmation: Annotated[str, Query(min_length=6, max_length=10, description="APAGAR ou DELETE")],
    user: CurrentUser,
    db: Db,
) -> JSONResponse:
    """Apaga TUDO o que o copiloto guarda sobre o utilizador (RGPD). Fica só o registo da eliminação."""
    return JSONResponse({"deleted": await memory_api.delete_data(db, user, confirmation)})


# --- Conversa sem streaming (v1, mantida) ------------------------------------------------------------


@router.post("/chat", response_model=CopilotReply, dependencies=[Depends(_per_user_limit)])
async def copilot_chat(body: CopilotRequest, user: CurrentUser, db: Db, llm: Llm) -> CopilotReply:
    """Conversa em pt-PT/en sem streaming. O modelo escolhe ferramentas; os números do texto são verificados."""
    try:
        return await service.chat(db, llm, user, body)
    finally:
        await llm.aclose()
