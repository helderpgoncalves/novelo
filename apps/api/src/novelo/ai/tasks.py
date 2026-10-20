"""Tarefas de IA: cada funcionalidade pode ter modelo, reserva e limites próprios (painel /admin/ai)."""

from enum import StrEnum

# Capacidades que o catálogo do OpenRouter anuncia e que o Novelo exige a cada tarefa.
IMAGE = "image"  # recebe imagens
TOOLS = "tools"  # chamadas a ferramentas
STRUCTURED = "structured_outputs"  # JSON que cumpre um esquema


class AiTask(StrEnum):
    COPILOT = "copilot"
    WHATIF = "whatif"
    EXPLAIN = "explain"
    BRIEFING = "briefing"
    ALERT_RESOLUTION = "alert_resolution"
    COPILOT_AUX = "copilot_aux"  # título, sugestões e resumos do copiloto (modelo barato)
    TRIAGE = "triage"  # visão
    TEST = "test"  # ping do painel (modelo explícito; não é configurável)
    WEB_SEARCH = "web_search"  # pesquisa na web do copiloto (usa o modelo de `copilot_aux`; só para a contabilidade)


# As tarefas que o painel mostra e deixa configurar.
CONFIGURABLE_TASKS: tuple[AiTask, ...] = (
    AiTask.COPILOT,
    AiTask.WHATIF,
    AiTask.EXPLAIN,
    AiTask.BRIEFING,
    AiTask.ALERT_RESOLUTION,
    AiTask.COPILOT_AUX,
    AiTask.TRIAGE,
)

TASK_REQUIREMENTS: dict[AiTask, frozenset[str]] = {
    AiTask.COPILOT: frozenset({TOOLS, STRUCTURED}),
    AiTask.WHATIF: frozenset({STRUCTURED}),
    AiTask.EXPLAIN: frozenset({STRUCTURED}),
    AiTask.BRIEFING: frozenset({STRUCTURED}),
    AiTask.ALERT_RESOLUTION: frozenset({STRUCTURED}),
    AiTask.COPILOT_AUX: frozenset({STRUCTURED}),
    AiTask.TRIAGE: frozenset({IMAGE, STRUCTURED}),
    AiTask.TEST: frozenset(),
    AiTask.WEB_SEARCH: frozenset(),
}

# Modelo recomendado por tarefa (verificado no catálogo público do OpenRouter).
RECOMMENDED_MODEL = "openai/gpt-6-luna"
RECOMMENDED: dict[AiTask, str] = dict.fromkeys(CONFIGURABLE_TASKS, RECOMMENDED_MODEL)

# Limite de tokens de saída por tarefa quando nada o define (global ou por tarefa).
TASK_MAX_TOKENS: dict[AiTask, int] = {
    AiTask.COPILOT: 900,
    AiTask.WHATIF: 400,
    AiTask.EXPLAIN: 300,
    AiTask.BRIEFING: 400,
    AiTask.ALERT_RESOLUTION: 500,
    AiTask.COPILOT_AUX: 400,
    AiTask.TRIAGE: 500,
    AiTask.TEST: 16,
    AiTask.WEB_SEARCH: 256,
}

# Respostas em cache: entrada determinística e saída sem estado do utilizador.
CACHEABLE: frozenset[AiTask] = frozenset({AiTask.WHATIF, AiTask.EXPLAIN})

# Os clientes antigos não indicam a tarefa: deduz-se do nome do schema de saída.
SCHEMA_TASKS: dict[str, AiTask] = {
    "ScenarioDelta": AiTask.WHATIF,
    "_Explanation": AiTask.EXPLAIN,
    "TriageAnalysis": AiTask.TRIAGE,
    "AlertSuggestion": AiTask.ALERT_RESOLUTION,
    "_Briefing": AiTask.BRIEFING,
    "_ThreadTitle": AiTask.COPILOT_AUX,
    "_Suggestions": AiTask.COPILOT_AUX,
    "_ThreadSummary": AiTask.COPILOT_AUX,
}

# Operação típica de cada tarefa, para estimar o custo enquanto não há histórico: (tokens de entrada, de saída).
# São estimativas declaradas como tal. As fotos da triagem já vão reduzidas (<= 1024 px).
TYPICAL_TOKENS: dict[AiTask, tuple[int, int]] = {
    AiTask.TRIAGE: (2200, 250),
    AiTask.COPILOT: (5000, 600),
    AiTask.BRIEFING: (1200, 250),
    AiTask.WHATIF: (1500, 200),
    AiTask.EXPLAIN: (600, 150),
    AiTask.ALERT_RESOLUTION: (800, 250),
    AiTask.COPILOT_AUX: (900, 150),
}

OPERATION_LABEL: dict[AiTask, str] = {
    AiTask.TRIAGE: "per_item_sorted",
    AiTask.COPILOT: "per_question",
    AiTask.BRIEFING: "per_briefing",
    AiTask.WHATIF: "per_question",
    AiTask.EXPLAIN: "per_explanation",
    AiTask.ALERT_RESOLUTION: "per_alert",
    AiTask.COPILOT_AUX: "per_helper_call",
}
