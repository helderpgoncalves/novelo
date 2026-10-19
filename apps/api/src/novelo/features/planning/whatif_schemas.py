import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from novelo.domain.vocab import CollectionMode, ScenarioObjective, WhatIfStatus
from novelo.features.users.schemas import Locale


class ModeRestriction(BaseModel):
    parish: str = Field(description="Nome da freguesia como o utilizador o escreveu")
    allowed_modes: list[CollectionMode]


class CaptureScale(BaseModel):
    mode: CollectionMode
    factor: float = Field(gt=0, le=5, description="1,2 = mais 20%")


class ScenarioDelta(BaseModel):
    """O que o modelo devolve: só descreve a alteração. Quem corre os números é o otimizador."""

    intent: Literal["change", "clarify", "unsupported"]
    understood: str = Field(max_length=400, description='Uma frase a começar por "Entendi:" na língua da pergunta')
    clarification: str | None = Field(default=None, max_length=400)
    set_modes: list[ModeRestriction] = Field(default_factory=list, max_length=12)
    budget_eur_year: float | None = Field(default=None, ge=0, le=5_000_000)
    target_pct: float | None = Field(default=None, ge=1, le=100)
    capture_scale: CaptureScale | None = None


class WhatIfRequest(BaseModel):
    scenario_id: uuid.UUID
    question: str = Field(min_length=5, max_length=500)
    locale: Locale = "pt-PT"


class ResolvedChange(BaseModel):
    """Alteração já validada contra as listas fechadas (freguesias e modos)."""

    parish_code: str
    parish_name: str
    allowed_modes: list[CollectionMode]


class WhatIfOut(BaseModel):
    id: uuid.UUID
    status: WhatIfStatus
    question: str
    understood: str
    clarification: str | None
    changes: list[ResolvedChange]
    budget_eur_year: float | None
    target_pct: float | None
    objective: ScenarioObjective | None
    capture_scale: CaptureScale | None
    unknown_parishes: list[str] = Field(description="Freguesias que não existem na lista oficial")
    suggestions: list[str] = Field(description="Freguesias parecidas, para corrigir a pergunta")
    base_scenario_id: uuid.UUID
    new_scenario_id: uuid.UUID | None
    explanation: str | None
    explanation_verified: bool | None = Field(
        description="True se todos os números da explicação existem nos resultados"
    )
    prompt_version: str
    created_at: datetime
