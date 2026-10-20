"""Ações que o copiloto propõe e o utilizador confirma; executam-se COMO o utilizador (mesmos services e roles)."""

import uuid
from datetime import datetime
from enum import StrEnum
from typing import Literal

from pydantic import BaseModel, Field

Risk = Literal["low", "medium", "high", "critical"]
ActionStatus = Literal["proposed", "executed", "failed", "rejected", "expired", "undone"]


class ActionType(StrEnum):
    CREATE_SCENARIO = "create_scenario"
    DUPLICATE_SCENARIO = "duplicate_scenario"
    DELETE_SCENARIO = "delete_scenario"
    RUN_BENCHMARK = "run_benchmark"
    GENERATE_REPORT = "generate_report"
    RESOLVE_ALERT = "resolve_alert"
    IGNORE_ALERT = "ignore_alert"
    REOPEN_ALERT = "reopen_alert"
    OPEN_LOT = "open_lot"
    SET_LOT_STATE = "set_lot_state"
    RESERVE_LOT = "reserve_lot"
    UPDATE_PARAMETER = "update_parameter"
    SET_USER_ACTIVE = "set_user_active"
    SET_USER_ROLE = "set_user_role"
    CHANGE_AI_TASK_MODEL = "change_ai_task_model"
    EXPORT_MY_DATA = "export_my_data"
    DELETE_MY_COPILOT_DATA = "delete_my_copilot_data"


class ActionOut(BaseModel):
    id: uuid.UUID
    type: ActionType
    params: dict[str, object]
    summary: str
    impact: str
    risk: Risk
    reversible: bool
    status: ActionStatus
    auto_approved: bool
    requires_text: bool = Field(description="Ação crítica: o utilizador tem de escrever a palavra de confirmação")
    confirm_word: str | None = None
    result: dict[str, object]
    thread_id: uuid.UUID | None
    user_id: uuid.UUID
    user_email: str | None = Field(default=None, description="Só na vista de auditoria dos administradores")
    can_undo: bool
    expires_at: datetime
    decided_at: datetime | None
    created_at: datetime


class ActionPage(BaseModel):
    items: list[ActionOut]
    next_cursor: str | None


class ProposeActionIn(BaseModel):
    type: ActionType
    params: dict[str, object] = Field(default_factory=dict)
    thread_id: uuid.UUID | None = None
    locale: Literal["pt-PT", "en"] = "pt-PT"


class ConfirmActionIn(BaseModel):
    confirmation_text: str | None = Field(default=None, max_length=40)
    idempotency_key: str | None = Field(default=None, max_length=64)
