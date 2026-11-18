"""Regras da área do cidadão: conta de doador, sacos ativados, histórico e agenda pública.

Sem FastAPI: os routers chamam daqui e os erros saem como `AppError`. Os sacos deduzem-se SEMPRE da
conta de quem pede — nunca de um parâmetro — para ser impossível ver ou mexer nos sacos do outro.
"""

import io
import uuid
from datetime import UTC, datetime

import segno
import sqlalchemy as sa
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.adapters.email import EmailSender
from novelo.core.errors import AgeBelowMinimumError, BagInactiveError, BagLimitReachedError, NotFoundError
from novelo.core.request_meta import RequestMeta
from novelo.domain.bags import MAX_ACTIVE_BAGS, new_account_code, new_bag_code
from novelo.domain.vocab import ScenarioStatus
from novelo.features.auth import entry
from novelo.features.citizen.models import BagActivation
from novelo.features.citizen.schemas import (
    BagActivationCreate,
    BagActivationOut,
    BagActivationUpdate,
    CollectionAgendaOut,
    CollectionHistoryOut,
    DonorAccountOut,
    DonorSignUpRequest,
)
from novelo.features.lots.models import Lot, LotUnit
from novelo.features.planning.models import Scenario
from novelo.features.users.models import User

# Versão do consentimento RGPD da conta de doador (ADR #49: conta e crédito = contrato).
DONOR_CONSENT_VERSION = "donor-2026-11"

MINIMUM_AGE = 13


def _qr_svg(code: str) -> str:
    """QR em SVG cujo payload é o próprio código (o ecrã da viatura lê offline, como as etiquetas).

    Fundo branco no próprio SVG: sem ele o QR desaparecia no tema escuro (mesma razão em `lots.service`).
    """
    buffer = io.BytesIO()
    segno.make(code, error="m").save(
        buffer, kind="svg", scale=8, border=2, dark="#14211D", light="#FFFFFF", xmldecl=False
    )
    return buffer.getvalue().decode()


# --- conta de doador: a porta de entrada é o magic link (auth/router chama daqui) -----------------


async def sign_up_donor(
    db: AsyncSession,
    sender: EmailSender,
    body: DonorSignUpRequest,
    *,
    ip: str | None,
    user_agent: str | None,
    meta: RequestMeta | None = None,
) -> None:
    """Conta de doador por email, sem password. Menor de 13 é recusa EXPLÍCITA (nunca silenciosa);
    email que já tem conta recebe o link de entrada (sem revelar nada); email novo cria a conta leve
    logo aprovada (conta de cidadão, sem acesso à app de equipa) e envia o link para `/cidadao`."""
    if body.declared_age < MINIMUM_AGE:
        raise AgeBelowMinimumError("Donor accounts require a declared age of 13 or older")
    if body.website:  # honeypot: bot recebe um sucesso plausível e nada acontece
        return
    from novelo.features.users import service as users  # noqa: PLC0415

    if await users.get_by_email(db, body.email):
        await entry.request_entry(
            db, sender, body.email, flow="magic_link", locale=body.locale, next_path="/cidadao", ip=ip,
            user_agent=user_agent, meta=meta,
        )  # fmt: skip
        return
    now = datetime.now(UTC)
    await users.create_user(
        db,
        email=body.email,
        role="donor",
        email_verified=False,  # o link prova a posse do email (ver `claim_unverified_account`)
        locale=body.locale,
        joined_via="magic_link",
        approval_status="approved",  # conta de cidadão: light por desígnio, nada de equipa
        consent_at=now,
        consent_version=DONOR_CONSENT_VERSION,
        declared_age=body.declared_age,
        donor_code=new_account_code(),
    )
    await entry.request_entry(
        db, sender, body.email, flow="magic_link", locale=body.locale, next_path="/cidadao", ip=ip,
        user_agent=user_agent, meta=meta,
    )  # fmt: skip


def account_out(user: User) -> DonorAccountOut:
    return DonorAccountOut(
        id=user.id,
        email=user.email,
        name=user.name,
        donor_code=user.donor_code,
        declared_age=user.declared_age,
        created_at=user.created_at,
    )


def account_qr(user: User) -> tuple[str, str]:
    if not user.donor_code:  # contas antigas promovidas à mão; nunca acontece pela porta normal
        user.donor_code = new_account_code()
    return user.donor_code, _qr_svg(user.donor_code)


# --- os meus sacos --------------------------------------------------------------------------------


async def _active_count(db: AsyncSession, user_id: object) -> int:
    return int(
        await db.scalar(
            select(func.count())
            .select_from(BagActivation)
            .where(BagActivation.user_id == user_id, BagActivation.deactivated_at.is_(None))
        )
        or 0
    )


async def list_activations(db: AsyncSession, user: User) -> list[BagActivation]:
    """Os sacos do próprio, o mais recente primeiro."""
    return list(
        (
            await db.execute(
                select(BagActivation).where(BagActivation.user_id == user.id).order_by(BagActivation.created_at.desc())
            )
        ).scalars()
    )


async def get_own_bag(db: AsyncSession, user: User, bag_id: uuid.UUID) -> BagActivation:
    """O saco do próprio, por id. De outro (ou inexistente): 404 — nunca se revela existência."""
    bag = (
        await db.execute(select(BagActivation).where(BagActivation.id == bag_id, BagActivation.user_id == user.id))
    ).scalar_one_or_none()
    if bag is None:
        raise NotFoundError("Bag activation not found")
    return bag


async def create_activation(db: AsyncSession, user: User, body: BagActivationCreate) -> BagActivation:
    if await _active_count(db, user.id) >= MAX_ACTIVE_BAGS:
        raise BagLimitReachedError(f"At most {MAX_ACTIVE_BAGS} active bags per account")
    now = datetime.now(UTC)
    bag = BagActivation(
        user_id=user.id,
        code=new_bag_code(),
        nickname=body.nickname,
        declaration=body.declaration,
        declared_at=now if body.declaration else None,
    )
    db.add(bag)
    await db.commit()
    return bag


async def update_activation(
    db: AsyncSession, user: User, bag_id: uuid.UUID, body: BagActivationUpdate
) -> BagActivation:
    bag = await get_own_bag(db, user, bag_id)
    if bag.deactivated_at is not None:
        raise BagInactiveError("This bag is deactivated; activate it to edit")
    bag.nickname = body.nickname
    if body.declaration != bag.declaration:
        bag.declaration = body.declaration
        bag.declared_at = datetime.now(UTC) if body.declaration else None
    await db.commit()
    return bag


async def set_activation_state(db: AsyncSession, user: User, bag_id: uuid.UUID, *, active: bool) -> BagActivation:
    """Ativar ou desativar (idempotente): desativar congela o saco; reativar volta a permitir editar."""
    bag = await get_own_bag(db, user, bag_id)
    if active and bag.deactivated_at is not None:
        if await _active_count(db, user.id) >= MAX_ACTIVE_BAGS:
            raise BagLimitReachedError(f"At most {MAX_ACTIVE_BAGS} active bags per account")
        bag.deactivated_at = None
    elif not active and bag.deactivated_at is None:
        bag.deactivated_at = datetime.now(UTC)
    await db.commit()
    return bag


def bag_qr(bag: BagActivation) -> tuple[str, str]:
    return bag.code, _qr_svg(bag.code)


def bag_out(bag: BagActivation) -> BagActivationOut:
    """`active` deduz-se de `deactivated_at is null` — não é coluna, compõe-se aqui."""
    return BagActivationOut(
        id=bag.id,
        code=bag.code,
        nickname=bag.nickname,
        declaration=bag.declaration,
        declared_at=bag.declared_at,
        active=bag.deactivated_at is None,
        created_at=bag.created_at,
    )


# --- histórico: sacos ligados ao lote pelo scan da viatura (`lot_units.code`) ----------------------


async def history(db: AsyncSession, user: User) -> list[CollectionHistoryOut]:
    """Um saco está num lote de cada vez (o scan da paragem cria a unidade). Se o mesmo código passou
    por dois lotes (correção na paragem), fica o lote mais recente — `LATERAL ... LIMIT 1`."""
    latest_lot = (
        select(
            Lot.code.label("lot_code"),
            Lot.state.label("lot_state"),
            Lot.created_at.label("lot_at"),
            LotUnit.weight_g.label("weight_g"),
        )
        .join(Lot, Lot.id == LotUnit.lot_id)
        .where(LotUnit.code == BagActivation.code)
        .order_by(Lot.created_at.desc())
        .limit(1)
        .lateral()
    )
    rows = (
        await db.execute(
            select(
                BagActivation, latest_lot.c.lot_code, latest_lot.c.lot_state, latest_lot.c.lot_at, latest_lot.c.weight_g
            )
            .outerjoin(latest_lot, sa.true())
            .where(BagActivation.user_id == user.id)
            .order_by(BagActivation.created_at.desc())
        )
    ).all()
    return [
        CollectionHistoryOut(
            bag_id=bag.id,
            bag_code=bag.code,
            nickname=bag.nickname,
            declaration=bag.declaration,
            activated_at=bag.created_at,
            lot_code=lot_code,
            lot_state=lot_state,
            weight_kg=round(weight_g / 1000, 2) if weight_g is not None else None,
            collected_at=lot_at,
        )
        for bag, lot_code, lot_state, lot_at, weight_g in rows
    ]


# --- agenda pública «onde e quando entrego» --------------------------------------------------------


async def public_agenda(db: AsyncSession) -> CollectionAgendaOut:
    """A agenda do cenário COMPLETO mais recente que tenha rondas publicadas (dado introduzido).

    Lê direto do JSON do cenário — nunca recalcula nem reagenda (ADR: visita publicada nunca é saltada).
    """
    from novelo.features.planning.schemas import PublicAgendaEntry  # noqa: PLC0415

    row = (
        await db.execute(
            select(Scenario.label, Scenario.created_at, Scenario.result["public_agenda"])
            .where(
                Scenario.status == ScenarioStatus.COMPUTED,
                Scenario.result["public_agenda"].is_not(None),
                func.jsonb_array_length(Scenario.result["public_agenda"]) > 0,
            )
            .order_by(Scenario.created_at.desc())
            .limit(1)
        )
    ).first()
    if row is None:
        return CollectionAgendaOut(agenda=None, scenario_label=None, updated_at=None)
    label, created_at, agenda = row
    return CollectionAgendaOut(
        agenda=[PublicAgendaEntry.model_validate(item) for item in agenda],
        scenario_label=label,
        updated_at=created_at,
    )


__all__ = [
    "DONOR_CONSENT_VERSION",
    "MINIMUM_AGE",
    "BagActivationOut",
    "account_out",
    "account_qr",
    "bag_out",
    "bag_qr",
    "create_activation",
    "get_own_bag",
    "history",
    "list_activations",
    "public_agenda",
    "set_activation_state",
    "sign_up_donor",
    "update_activation",
]
