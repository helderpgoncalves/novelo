import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from novelo.core.database import Base, TimestampMixin, UuidPkMixin


def _user_fk(ondelete: str = "CASCADE") -> Mapped[uuid.UUID]:
    return mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete=ondelete))


class CopilotThread(Base, UuidPkMixin, TimestampMixin):
    """Conversa do copiloto de um utilizador. Só o dono a vê (ou quem tiver o link de partilha, só leitura)."""

    __tablename__ = "copilot_threads"
    __table_args__ = (Index("ix_copilot_threads_user_updated", "user_id", "updated_at"),)

    user_id: Mapped[uuid.UUID] = _user_fk()
    title: Mapped[str] = mapped_column(String(120), default="")
    summary: Mapped[str] = mapped_column(Text, default="")  # voltas antigas compactadas
    summarized_messages: Mapped[int] = mapped_column(Integer, default=0)
    archived: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    pinned: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    project: Mapped[str] = mapped_column(String(60), default="", server_default="")  # pasta simples
    ephemeral: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="false"
    )  # sem histórico: apagada em 24 h
    snapshot: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)  # memória e persona congeladas no início
    reviewed_upto: Mapped[int] = mapped_column(Integer, default=0)  # mensagens já vistas pela revisão de memória
    share_token: Mapped[str | None] = mapped_column(String(64), unique=True)
    parent_thread_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))  # ramo (branch) de outra conversa
    search_text: Mapped[str] = mapped_column(Text, default="")  # título sem acentos


class CopilotMessage(Base, UuidPkMixin, TimestampMixin):
    """Mensagem de uma conversa. Nunca guarda imagens nem ficheiros: só texto extraído, metadados e digests."""

    __tablename__ = "copilot_messages"
    __table_args__ = (
        Index("ix_copilot_messages_thread_created", "thread_id", "created_at"),
        Index("ix_copilot_messages_fts", text("to_tsvector('simple', search_text)"), postgresql_using="gin"),
    )

    thread_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("copilot_threads.id", ondelete="CASCADE")
    )
    role: Mapped[str] = mapped_column(String(12))  # user | assistant
    parts: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, default=list)
    tool_trace: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, default=list)  # nome, ok, resumo, digest, resultado
    cards: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, default=list)
    usage: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    verified: Mapped[bool | None] = mapped_column(Boolean)
    model: Mapped[str | None] = mapped_column(String(120))
    prompt_version: Mapped[str | None] = mapped_column(String(12))
    status: Mapped[str] = mapped_column(String(12), default="complete")  # complete | cancelled | error
    digested: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    search_text: Mapped[str] = mapped_column(Text, default="")  # texto sem acentos, para pesquisa


class CopilotFeedback(Base, UuidPkMixin, TimestampMixin):
    __tablename__ = "copilot_feedback"
    __table_args__ = (UniqueConstraint("message_id", "user_id", name="uq_copilot_feedback_message_user"),)

    message_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("copilot_messages.id", ondelete="CASCADE")
    )
    user_id: Mapped[uuid.UUID] = _user_fk()
    rating: Mapped[int] = mapped_column(SmallInteger)  # 1 ou -1
    comment: Mapped[str | None] = mapped_column(String(500))


class CopilotAttachment(Base, UuidPkMixin, TimestampMixin):
    """Anexo reduzido ao que o modelo pode ler: texto extraído, tabela amostrada e metadados. Nunca o ficheiro."""

    __tablename__ = "copilot_attachments"
    __table_args__ = (Index("ix_copilot_attachments_user_created", "user_id", "created_at"),)

    user_id: Mapped[uuid.UUID] = _user_fk()
    kind: Mapped[str] = mapped_column(String(12))  # image | pdf | table | text
    filename: Mapped[str] = mapped_column(String(120))
    mime: Mapped[str] = mapped_column(String(80))
    size_bytes: Mapped[int] = mapped_column(Integer)
    preview: Mapped[str] = mapped_column(Text, default="")
    meta: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    data: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    search_text: Mapped[str] = mapped_column(Text, default="")


class CopilotMemoryEntry(Base, UuidPkMixin, TimestampMixin):
    """Uma entrada curta da memória do utilizador. `memory` = notas do copiloto; `user` = perfil do utilizador."""

    __tablename__ = "copilot_memory_entries"
    __table_args__ = (Index("ix_copilot_memory_user_target", "user_id", "target", "created_at"),)

    user_id: Mapped[uuid.UUID] = _user_fk()
    target: Mapped[str] = mapped_column(String(8))  # memory | user
    content: Mapped[str] = mapped_column(Text)
    origin: Mapped[str] = mapped_column(String(8), default="tool")  # auto | manual | tool
    pinned: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    source_thread_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    search_text: Mapped[str] = mapped_column(Text, default="")


class CopilotMemoryPending(Base, UuidPkMixin, TimestampMixin):
    """Escrita de memória em fila (o utilizador escolheu aprovar antes de gravar)."""

    __tablename__ = "copilot_memory_pending"
    __table_args__ = (Index("ix_copilot_memory_pending_user_status", "user_id", "status"),)

    user_id: Mapped[uuid.UUID] = _user_fk()
    target: Mapped[str] = mapped_column(String(8))
    ops: Mapped[list[dict[str, Any]]] = mapped_column(JSONB)  # lote validado: add | patch | remove
    summary: Mapped[str] = mapped_column(Text)
    origin: Mapped[str] = mapped_column(String(8), default="tool")
    source_thread_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    status: Mapped[str] = mapped_column(String(10), default="pending")  # pending | approved | rejected


class CopilotUserSettings(Base, UuidPkMixin, TimestampMixin):
    """Definições do copiloto de um utilizador (as do sistema vivem em ai_settings e no .env)."""

    __tablename__ = "copilot_user_settings"
    __table_args__ = (UniqueConstraint("user_id", name="uq_copilot_user_settings_user"),)

    user_id: Mapped[uuid.UUID] = _user_fk()
    values: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)  # só o que difere dos valores por omissão


class CopilotAction(Base, UuidPkMixin, TimestampMixin):
    """Registo de auditoria de cada ação proposta pelo copiloto: quem, o quê, parâmetros, estado e resultado."""

    __tablename__ = "copilot_actions"
    __table_args__ = (
        Index("ix_copilot_actions_user_created", "user_id", "created_at"),
        UniqueConstraint("user_id", "idempotency_key", name="uq_copilot_actions_user_idem"),
    )

    user_id: Mapped[uuid.UUID] = _user_fk()
    thread_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("copilot_threads.id", ondelete="SET NULL")
    )
    type: Mapped[str] = mapped_column(String(40))
    params: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    summary: Mapped[str] = mapped_column(Text)
    impact: Mapped[str] = mapped_column(Text, default="")
    risk: Mapped[str] = mapped_column(String(10))  # low | medium | high | critical
    reversible: Mapped[bool] = mapped_column(Boolean, default=False)
    status: Mapped[str] = mapped_column(String(12), default="proposed")
    # proposed | executed | failed | rejected | expired | undone
    auto_approved: Mapped[bool] = mapped_column(Boolean, default=False)
    result: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    undo: Mapped[dict[str, Any] | None] = mapped_column(JSONB)  # o que é preciso para desfazer
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    idempotency_key: Mapped[str | None] = mapped_column(String(64))
    search_text: Mapped[str] = mapped_column(Text, default="")


class CopilotArtifact(Base, UuidPkMixin, TimestampMixin):
    """Gráfico, tabela, mapa... gerado numa conversa. A galeria lê-os; `refresh` permite voltar a calcular com dados novos."""

    __tablename__ = "copilot_artifacts"
    __table_args__ = (Index("ix_copilot_artifacts_user_created", "user_id", "created_at"),)

    user_id: Mapped[uuid.UUID] = _user_fk()
    thread_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("copilot_threads.id", ondelete="CASCADE")
    )
    message_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    artifact_type: Mapped[str] = mapped_column(String(16))
    title: Mapped[str] = mapped_column(String(160))
    spec: Mapped[dict[str, Any]] = mapped_column(JSONB)
    sources: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, default=list)
    refresh: Mapped[dict[str, Any] | None] = mapped_column(JSONB)  # {"tool","args","builder","builder_args"}
    pinned: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    refreshed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    search_text: Mapped[str] = mapped_column(Text, default="")
