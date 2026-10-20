import uuid
from datetime import datetime
from enum import StrEnum
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, RootModel, model_validator

from novelo.core.errors import ErrorCode
from novelo.domain.vocab import ScenarioObjective
from novelo.features.copilot.schemas_actions import ActionOut
from novelo.features.copilot.schemas_artifacts import Artifact, ArtifactSource
from novelo.features.copilot.schemas_memory import MemoryTarget
from novelo.features.users.schemas import Locale


class ChatTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=2000)


class CopilotRequest(BaseModel):
    """O servidor não guarda conversas: o web envia o histórico (máx. 20 mensagens) em cada pedido."""

    messages: list[ChatTurn] = Field(min_length=1, max_length=20)
    locale: Locale = "pt-PT"
    scenario_id: uuid.UUID | None = Field(default=None, description="Cenário aberto no ecrã, se houver")

    @model_validator(mode="after")
    def _ends_with_user(self) -> "CopilotRequest":
        if self.messages[-1].role != "user":
            raise ValueError("The last message must come from the user")
        return self


class CardKpis(BaseModel):
    tonnes_year: float
    annual_cost_eur: float
    eur_per_tonne: float | None
    capex_eur: float
    coverage_pct: float


class ScenarioCard(BaseModel):
    """Resultado de uma ferramenta para o web desenhar. Os números vêm do otimizador, nunca do texto do modelo."""

    scenario_id: uuid.UUID
    label: str
    objective: ScenarioObjective
    kpis: CardKpis
    created_now: bool = Field(description="Cenário criado pelo copiloto neste pedido")
    parent_id: uuid.UUID | None


class ToolTrace(BaseModel):
    name: str
    ok: bool


class CopilotReply(BaseModel):
    text: str
    cards: list[ScenarioCard]
    tools_used: list[ToolTrace]
    verified: bool = Field(description="Todos os números do texto existem nos resultados das ferramentas")
    warning: Literal["numbers_unverified"] | None = Field(
        description="Se presente, o texto foi substituído por um aviso e só valem os cartões"
    )
    prompt_version: str
    model: str
    language: Locale


# --- Contexto enviado pelo cliente ------------------------------------------------------------------


class PageContext(BaseModel):
    """O que o utilizador está a ver. Só estrutura: o servidor resolve as entidades, sem confiar no texto."""

    model_config = ConfigDict(extra="forbid")
    route: str = Field(max_length=200, description="Rota do ecrã, ex.: /scenarios/$scenarioId")
    params: dict[str, str] = Field(default_factory=dict, description="Parâmetros da rota, ex.: scenarioId")
    search: dict[str, str] = Field(default_factory=dict, description="Query string validada do ecrã")
    visible_entity_ids: list[str] = Field(default_factory=list, max_length=20)
    selected_filters: dict[str, str] = Field(default_factory=dict)


class MentionType(StrEnum):
    SCENARIO = "scenario"
    PARISH = "parish"
    CIRCUIT = "circuit"
    LOCALITY = "locality"
    VEHICLE = "vehicle"
    LOT = "lot"
    ALERT = "alert"
    REPORT = "report"
    BRAND = "brand"
    FIBRE = "fibre"
    PAGE = "page"
    DATA_SOURCE = "data_source"
    MUNICIPAL_SITE = "municipal_site"  # local da rede municipal (outras frações; não é têxtil)


class MentionRef(BaseModel):
    model_config = ConfigDict(extra="forbid")
    type: MentionType
    id: str = Field(min_length=1, max_length=120)


class CopilotStreamRequest(BaseModel):
    """Uma mensagem nova numa conversa (nova se `thread_id` for nulo). Comandos: `/compact`."""

    message: str = Field(min_length=1, max_length=4000)
    thread_id: uuid.UUID | None = None
    locale: Locale = "pt-PT"
    page_context: PageContext | None = None
    mentions: list[MentionRef] = Field(default_factory=list, max_length=10)
    attachment_ids: list[uuid.UUID] = Field(default_factory=list, max_length=5)
    confirm: bool = Field(
        default=False, description="O utilizador confirmou as escritas pedidas (se tiver activado a confirmação)"
    )
    edit_message_id: uuid.UUID | None = Field(
        default=None, description="Editar esta mensagem do utilizador: cria um ramo da conversa a partir dela"
    )


# --- Eventos do stream (SSE) ------------------------------------------------------------------------


class _Event(BaseModel):
    model_config = ConfigDict(extra="forbid")


class CopilotStartEvent(_Event):
    type: Literal["start"] = "start"
    thread_id: uuid.UUID
    message_id: uuid.UUID
    model: str
    prompt_version: str


class CopilotStatusEvent(_Event):
    """Fase da tarefa. `label_key` é uma chave de tradução (status.running_optimizer); `detail` é um dado."""

    type: Literal["status"] = "status"
    phase: Literal["thinking", "planning", "tool", "verifying", "writing", "compacting"]
    label_key: str
    detail: str | None = None


class CopilotToolStartEvent(_Event):
    type: Literal["tool_start"] = "tool_start"
    id: str
    name: str
    args_summary: str


class CopilotToolResultEvent(_Event):
    type: Literal["tool_result"] = "tool_result"
    id: str
    name: str
    ok: bool
    summary: str
    duration_ms: int


class CopilotTextDeltaEvent(_Event):
    type: Literal["text_delta"] = "text_delta"
    delta: str


class CopilotCardEvent(_Event):
    type: Literal["card"] = "card"
    card: ScenarioCard


class CopilotRetractEvent(_Event):
    """O texto já enviado falhou a verificação: apagar o texto desta mensagem. Segue-se o texto reescrito."""

    type: Literal["retract"] = "retract"
    reason: Literal["numbers_unverified"] = "numbers_unverified"


class CopilotVerificationEvent(_Event):
    type: Literal["verification"] = "verification"
    verified: bool
    warning: Literal["numbers_unverified"] | None = None


class CopilotSuggestionsEvent(_Event):
    type: Literal["suggestions"] = "suggestions"
    items: list[str] = Field(max_length=3)


class CopilotContextEvent(_Event):
    type: Literal["context"] = "context"
    used_tokens: int
    window_tokens: int
    compacted: bool


class CopilotUsageEvent(_Event):
    type: Literal["usage"] = "usage"
    prompt_tokens: int
    completion_tokens: int
    tokens: int
    cost_usd: float | None


class CopilotTitleEvent(_Event):
    type: Literal["title"] = "title"
    title: str


class CopilotErrorEvent(_Event):
    type: Literal["error"] = "error"
    code: ErrorCode
    message: str


class CopilotMemoryEvent(_Event):
    """Uma escrita de memória (ou o seu bloqueio). O web mostra «Guardei na memória: …» com Desfazer."""

    type: Literal["memory"] = "memory"
    action: Literal["added", "patched", "removed", "staged", "blocked"]
    target: MemoryTarget
    content: str
    status: Literal["applied", "pending", "blocked"]
    entry_id: uuid.UUID | None = None
    previous: str | None = Field(default=None, description="Texto anterior (patch/remove), para desfazer")
    reason: str | None = None


class CopilotPlanEvent(_Event):
    """Plano curto de um pedido composto, antes de executar os passos."""

    type: Literal["plan"] = "plan"
    steps: list[str] = Field(max_length=6)


class CopilotClarifyEvent(_Event):
    """Falta um parâmetro crítico: pergunta com opções clicáveis. Termina a volta; a resposta é a mensagem seguinte."""

    type: Literal["clarify"] = "clarify"
    question: str
    options: list[str] = Field(max_length=4)


class CopilotSource(BaseModel):
    kind: Literal["tool", "scenario", "file", "entity", "memory", "page"]
    label: str
    ref: str | None = Field(default=None, description="Rota ou id para abrir a fonte, se existir")


class CopilotSourcesEvent(_Event):
    """O que foi usado para responder: ferramentas, cenários, ficheiros, menções, memórias e o ecrã."""

    type: Literal["sources"] = "sources"
    items: list[CopilotSource]


class CopilotArtifactEvent(_Event):
    """Gráfico, tabela, mapa... com os dados reais já embutidos. O servidor constrói-o; o modelo só escolhe e titula."""

    type: Literal["artifact"] = "artifact"
    id: uuid.UUID
    title: str
    sources: list[ArtifactSource]
    artifact: Artifact


class CopilotConfirmEvent(_Event):
    """O copiloto propôs uma ação de escrita. Só `POST /copilot/actions/{id}/confirm` a executa."""

    type: Literal["confirm"] = "confirm"
    action: ActionOut


class CopilotActionResultEvent(_Event):
    """Resultado de uma ação executada (auto-aprovada neste pedido)."""

    type: Literal["action_result"] = "action_result"
    action: ActionOut


class CopilotNavigateEvent(_Event):
    """Sugestão de navegação: o web mostra «Abrir» e só então navega."""

    type: Literal["navigate"] = "navigate"
    route: str
    label: str
    params: dict[str, str] = Field(default_factory=dict)
    search: dict[str, str] = Field(default_factory=dict)


class CopilotDoneEvent(_Event):
    type: Literal["done"] = "done"
    finish: Literal["stop", "cancelled", "error"] = "stop"


CopilotEvent = Annotated[
    CopilotStartEvent
    | CopilotStatusEvent
    | CopilotToolStartEvent
    | CopilotToolResultEvent
    | CopilotTextDeltaEvent
    | CopilotCardEvent
    | CopilotRetractEvent
    | CopilotVerificationEvent
    | CopilotSuggestionsEvent
    | CopilotContextEvent
    | CopilotUsageEvent
    | CopilotTitleEvent
    | CopilotErrorEvent
    | CopilotMemoryEvent
    | CopilotPlanEvent
    | CopilotClarifyEvent
    | CopilotSourcesEvent
    | CopilotArtifactEvent
    | CopilotConfirmEvent
    | CopilotActionResultEvent
    | CopilotNavigateEvent
    | CopilotDoneEvent,
    Field(discriminator="type"),
]


class CopilotEventMessage(RootModel[CopilotEvent]):
    """Um evento do stream `text/event-stream` (campo `data:` de cada mensagem SSE)."""


class CopilotEventCatalog(BaseModel):
    """Um exemplo de cada evento, na ordem típica de uma resposta: serve de contrato para o web."""

    events: list[CopilotEventMessage]


# --- Threads ----------------------------------------------------------------------------------------


class ToolTraceOut(BaseModel):
    name: str
    ok: bool
    summary: str


class MessageOut(BaseModel):
    id: uuid.UUID
    role: Literal["user", "assistant"]
    text: str
    attachments: list["AttachmentOut"]
    mentions: list[MentionRef]
    tools: list[ToolTraceOut]
    cards: list[ScenarioCard]
    artifacts: list["ArtifactEnvelope"]
    actions: list[ActionOut]
    verified: bool | None
    status: Literal["complete", "cancelled", "error"]
    model: str | None
    tokens: int | None
    cost_usd: float | None
    feedback: Literal[1, -1] | None
    created_at: datetime


class ArtifactEnvelope(BaseModel):
    id: uuid.UUID
    title: str
    sources: list[ArtifactSource]
    artifact: Artifact


class ThreadSummaryOut(BaseModel):
    id: uuid.UUID
    title: str
    archived: bool
    pinned: bool
    project: str
    ephemeral: bool
    shared: bool
    parent_thread_id: uuid.UUID | None
    snippet: str | None = None
    message_count: int
    has_summary: bool
    created_at: datetime
    updated_at: datetime


class ThreadPage(BaseModel):
    items: list[ThreadSummaryOut]
    total: int
    offset: int
    limit: int


class ThreadOut(ThreadSummaryOut):
    summary: str
    messages: list[MessageOut]
    used_tokens: int
    window_tokens: int


class ThreadUpdate(BaseModel):
    """Qualquer subconjunto: renomear, fixar, arquivar ou mover para uma pasta (`project`; vazio = sem pasta)."""

    title: str | None = Field(default=None, min_length=1, max_length=120)
    pinned: bool | None = None
    archived: bool | None = None
    project: str | None = Field(default=None, max_length=60)


class ShareOut(BaseModel):
    token: str
    path: str = Field(description="Caminho do web para abrir a conversa em só leitura")


class ProjectOut(BaseModel):
    name: str
    threads: int


class DataExport(BaseModel):
    exported_at: datetime
    settings: dict[str, object]
    memory: list[dict[str, object]]
    threads: list["ThreadOut"]
    actions: list[ActionOut]


class FeedbackIn(BaseModel):
    rating: Literal[1, -1]
    comment: str | None = Field(default=None, max_length=500)


class FeedbackOut(BaseModel):
    message_id: uuid.UUID
    rating: Literal[1, -1]


class CompactOut(BaseModel):
    thread: ThreadSummaryOut
    compacted_messages: int
    summary: str
    used_tokens: int
    window_tokens: int


class ThreadExport(BaseModel):
    filename: str
    markdown: str


# --- Anexos -----------------------------------------------------------------------------------------


class AttachmentOut(BaseModel):
    id: uuid.UUID
    kind: Literal["image", "pdf", "table", "text"]
    filename: str
    mime: str
    size_bytes: int
    preview: str = Field(description="Início do texto extraído ou resumo da tabela")
    meta: dict[str, object] = Field(description="Páginas, colunas, dimensões... (nunca o ficheiro)")
    model_can_see: bool = Field(description="Falso para imagens se o modelo do copiloto não aceita imagens")


# --- Menções e comandos -----------------------------------------------------------------------------


class MentionItem(BaseModel):
    id: str
    type: MentionType
    label: str
    sublabel: str | None = None
    icon: str = Field(description="Nome de ícone sugerido (lucide): map, truck, package, file-text...")
    route: str | None = Field(default=None, description="Rota do web para abrir a entidade, se existir")


class MentionGroup(BaseModel):
    type: MentionType
    items: list[MentionItem]


class MentionsOut(BaseModel):
    query: str
    groups: list[MentionGroup]
    total: int


class CopilotCommand(BaseModel):
    name: str = Field(description="Comando com barra, ex.: /compact")
    label_key: str
    description_key: str
    kind: Literal["server", "client"] = Field(description="server: enviado em /copilot/stream; client: tratado no web")
    admin_only: bool
    route: str | None = None


class CommandsOut(BaseModel):
    commands: list[CopilotCommand]
    composer_actions: list[str] = Field(description="Ações do composer: attach_file, attach_current_screen, mention")
