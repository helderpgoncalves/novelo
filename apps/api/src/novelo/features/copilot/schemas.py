import uuid
from typing import Literal

from pydantic import BaseModel, Field, model_validator

from novelo.domain.vocab import ScenarioObjective
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
