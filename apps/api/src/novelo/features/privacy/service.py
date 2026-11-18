"""Regras do RGPD do doador: consentimentos append-only, exportação, apagamento e retenção de logs.

Sem FastAPI nos caminhos de domínio; os routers chamam daqui. O apagamento é o gesto delicado e segue
o ADR «RGPD da conta de doador» à letra: pré-aviso com saldo e prazos FIFO, possibilidade de gastar
antes, «pontos não são dinheiro nem conversíveis» — e depois a pessoa desaparece (linha da `users`
apagada; FKs fazem o resto: SET NULL nos agregados que sobrevivem, CASCADE no que é da pessoa).
"""

import hmac
import logging
import uuid
from datetime import UTC, datetime

from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.core.errors import ConfirmationMismatchError
from novelo.core.request_meta import RequestMeta
from novelo.domain.points import LedgerEntry
from novelo.domain.privacy import ConsentPurpose, expiry_timeline, retention_cutoff
from novelo.features.audit import service as audit
from novelo.features.cidadao.models import BagActivation
from novelo.features.collection_requests.models import CollectionRequest
from novelo.features.email_log.models import EmailDelivery
from novelo.features.network.models import Parish
from novelo.features.points import service as points_service
from novelo.features.points.models import PointEntry
from novelo.features.privacy.models import DonorConsent
from novelo.features.privacy.policy import POLICY_VERSION, PolicyOut, policy
from novelo.features.privacy.schemas import (
    AccountExportOut,
    ConsentsOut,
    ConsentStateOut,
    DeletionPreviewOut,
    ExportBag,
    ExportConsent,
    ExportPointEntry,
    ExportProfile,
    ExportRequest,
    TimelineItem,
)
from novelo.features.users import impersonation
from novelo.features.users.models import ImpersonationSession, Invitation, User

log = logging.getLogger(__name__)


# --- política (a página pública lê daqui) -----------------------------------------------------------


def get_policy() -> PolicyOut:
    """A política em vigor (Pydantic; o FastAPI serializa tal e qual)."""
    return policy()


# --- consentimentos: dar e retirar criam LINHAS (a história é a prova, art. 7.º/1) -------------------


async def record_consent(
    db: AsyncSession,
    user: User,
    body_purpose: ConsentPurpose,
    granted: bool,
    meta: RequestMeta | None,
    *,
    source: str = "account",
) -> ConsentsOut:
    db.add(
        DonorConsent(
            user_id=user.id,
            purpose=body_purpose,
            granted=granted,
            policy_version=POLICY_VERSION,
            source=source,
        )
    )
    await audit.record_by(
        db,
        user,
        "consent.grant" if granted else "consent.withdraw",
        meta=meta,
        target_type="user",
        target_id=user.id,
        target_label=user.email,
        details={"purpose": body_purpose.value, "policy_version": POLICY_VERSION, "source": source},
    )
    await db.commit()
    return await list_consents(db, user)


async def list_consents(db: AsyncSession, user: User) -> ConsentsOut:
    """As duas camadas com o estado corrente (a última linha por finalidade vence; sem linhas: desligado)."""
    rows = (
        (
            await db.execute(
                select(DonorConsent)
                .where(DonorConsent.user_id == user.id)
                .order_by(DonorConsent.purpose, DonorConsent.created_at.desc(), DonorConsent.seq.desc())
            )
        )
        .scalars()
        .all()
    )
    latest: dict[ConsentPurpose, DonorConsent] = {}
    for row in rows:
        latest.setdefault(row.purpose, row)  # a primeira de cada (a mais recente) ganha
    return ConsentsOut(
        items=[
            ConsentStateOut(
                purpose=purpose,
                granted=latest[purpose].granted if purpose in latest else False,
                policy_version=latest[purpose].policy_version if purpose in latest else None,
                updated_at=latest[purpose].created_at if purpose in latest else None,
            )
            for purpose in ConsentPurpose
        ]
    )


async def consent_history(db: AsyncSession, user_id: uuid.UUID) -> list[ExportConsent]:
    """O histórico inteiro, para a exportação (portabilidade inclui as decisões de consentimento)."""
    rows = (
        (
            await db.execute(
                select(DonorConsent)
                .where(DonorConsent.user_id == user_id)
                .order_by(DonorConsent.created_at, DonorConsent.seq)
            )
        )
        .scalars()
        .all()
    )
    return [
        ExportConsent(
            purpose=r.purpose.value,
            granted=r.granted,
            policy_version=r.policy_version,
            source=r.source,
            created_at=r.created_at,
        )
        for r in rows
    ]


# --- exportação (portabilidade, art. 20.º): fornecidos + observados, nunca derivados ----------------


async def export_account(db: AsyncSession, user: User) -> AccountExportOut:
    """A conta inteira em JSON estruturado: perfil, consentimentos, sacos, pedidos e livro de pontos."""
    bags = (
        (
            await db.execute(
                select(BagActivation).where(BagActivation.user_id == user.id).order_by(BagActivation.created_at)
            )
        )
        .scalars()
        .all()
    )
    requests = (
        await db.execute(
            select(CollectionRequest, Parish.dicofre)
            .outerjoin(Parish, Parish.id == CollectionRequest.parish_id)
            .where(CollectionRequest.requester_id == user.id)
            .order_by(CollectionRequest.created_at)
        )
    ).all()
    entries = (
        (
            await db.execute(
                select(PointEntry).where(PointEntry.user_id == user.id).order_by(PointEntry.created_at, PointEntry.seq)
            )
        )
        .scalars()
        .all()
    )
    return AccountExportOut(
        exported_at=datetime.now(UTC),
        policy_version=POLICY_VERSION,
        profile=ExportProfile(
            email=user.email,
            name=user.name,
            donor_code=user.donor_code,
            declared_age=user.declared_age,
            locale=user.locale,
            joined_via=user.joined_via,
            created_at=user.created_at,
        ),
        consents=await consent_history(db, user.id),
        bags=[
            ExportBag(
                code=b.code,
                nickname=b.nickname,
                declaration=b.declaration,
                active=b.deactivated_at is None,
                created_at=b.created_at,
                deactivated_at=b.deactivated_at,
            )
            for b in bags
        ],
        collection_requests=[
            ExportRequest(
                subject_kind=r.subject_kind,
                address=r.address,
                parish_code=dicofre,
                bag_count=r.bag_count,
                requested_date=r.requested_date.isoformat(),
                urgent=r.urgent,
                state=r.state,
                created_at=r.created_at,
            )
            for r, dicofre in requests
        ],
        points=[
            ExportPointEntry(
                kind=e.kind.value,
                amount=e.amount,
                bag_code=e.bag_code,
                lot_code=e.lot_code,
                reason=e.reason,
                created_at=e.created_at,
                expires_at=e.expires_at,
            )
            for e in entries
        ],
    )


# --- pré-aviso do apagamento: saldo + prazos FIFO + o que se perde (as proteções do ADR) ------------


async def deletion_preview(db: AsyncSession, user: User) -> DeletionPreviewOut:
    """O que se perde ao apagar: saldo atual, calendário FIFO e contagens — o web junta o texto
    («pontos não são dinheiro nem conversíveis»; resgatar ainda é possível antes de confirmar)."""
    saldo = await points_service.saldo(db, user.id)
    entries = (await db.execute(select(PointEntry).where(PointEntry.user_id == user.id))).scalars().all()
    timeline = expiry_timeline(
        [LedgerEntry(kind=e.kind, amount=e.amount, created_at=e.created_at, expires_at=e.expires_at) for e in entries],
        now=datetime.now(UTC),
    )
    bags = (
        (
            await db.execute(
                select(BagActivation).where(BagActivation.user_id == user.id).order_by(BagActivation.created_at)
            )
        )
        .scalars()
        .all()
    )
    n_requests = int(
        await db.scalar(
            select(func.count()).select_from(CollectionRequest).where(CollectionRequest.requester_id == user.id)
        )
        or 0
    )
    return DeletionPreviewOut(
        saldo=saldo,
        timeline=[TimelineItem(expires_at=at, amount=amount) for at, amount in timeline],
        active_bags=sum(1 for b in bags if b.deactivated_at is None),
        bags=len(bags),
        requests=n_requests,
        points_entries=len(entries),
    )


# --- o apagamento: a pessoa sai, os agregados ficam (art. 17.º/3/d com 89.º/1) ----------------------


async def delete_account(db: AsyncSession, user: User, confirm_email: str, meta: RequestMeta) -> None:
    """Apagar a própria conta de doador, com o email escrito à mão como trava.

    Mecânica (espelha o apagamento por administradores, sem os seus portões de equipa): auditoria
    lavrada (sem email nem IP do próprio), emails e convites apagados, apelidos dos sacos esvanecem,
    moradas dos pedidos purgadas JÁ (não esperam os 12 meses) e a linha da `users` desaparece — as
    FKs (SET NULL) deixam sacos, livro de pontos, pedidos e consentimentos anónimos; a sessão morre
    em cascata.
    """
    if not hmac.compare_digest(" ".join(confirm_email.split()).lower().encode(), user.email.lower().encode()):
        raise ConfirmationMismatchError("The confirmation email does not match the account")
    facts = {
        "role": user.role,
        "bags": await db.scalar(
            select(func.count()).select_from(BagActivation).where(BagActivation.user_id == user.id)
        ),
        "requests": await db.scalar(
            select(func.count()).select_from(CollectionRequest).where(CollectionRequest.requester_id == user.id)
        ),
    }
    email, user_id = user.email, user.id
    await audit.record_by(
        db, user, "account.delete_self", meta=meta, target_type="user", target_id=user_id, details=facts
    )
    await audit.scrub_user(db, user_id, email)
    await db.execute(delete(Invitation).where(Invitation.email == email))
    await db.execute(delete(EmailDelivery).where(EmailDelivery.to_email == email))
    await db.execute(
        delete(ImpersonationSession).where(
            (ImpersonationSession.target_id == user_id) | (ImpersonationSession.admin_id == user_id)
        )
    )
    # Dados pessoais de nível inferior: apelidos (texto livre) e moradas (esperariam 12 meses).
    await db.execute(update(BagActivation).where(BagActivation.user_id == user_id).values(nickname=None))
    await db.execute(
        update(CollectionRequest)
        .where(CollectionRequest.requester_id == user_id)
        .values(address=None, address_key=None)
    )
    await impersonation.end_for_target(db, user_id)
    await db.delete(user)  # FKs: SET NULL nos agregados, CASCADE em sessões, tokens e copiloto
    await db.commit()
    log.info("donor account deleted id=%s", user_id)


# --- retenção dos logs de entrada (12 meses): JOB diário, não purga à leitura -----------------------
#
# PORQUÊ um job e não «purga à leitura» (o padrão das moradas de #60): os `login_tokens` nunca são
# listados nem lidos em bloco — escrevem-se no pedido de entrada e consomem-se um a um na verificação;
# não há caminho de leitura onde a purga pudesse viver. O padrão correto é o mesmo das miniaturas
# (`photo_store.purge_loop`): um loop diário no arranque da API, discreto e auditável.


async def purge_expired_login_tokens(db: AsyncSession) -> int:
    """Apaga os registos de entrada com mais de 12 meses (o token já morreu sozinho; fica o log)."""
    cutoff = retention_cutoff(datetime.now(UTC), months=12)
    from novelo.features.auth.models import LoginToken  # noqa: PLC0415  (evita ciclo no arranque)

    result = await db.execute(delete(LoginToken).where(LoginToken.created_at < cutoff))
    await db.commit()
    removed = int(getattr(result, "rowcount", 0) or 0)
    if removed:
        await audit.record(
            db, "privacy.login_log_purge", actor_id=None, target_type="login_token", details={"count": removed}
        )
        await db.commit()
    return removed


async def retention_loop(interval_s: float = 24 * 3600, start_delay_s: float = 30) -> None:
    """No arranque (com atraso curto) e de 24 em 24 h. Nunca derruba a API (mesmo padrão das fotos)."""
    import asyncio  # noqa: PLC0415

    from novelo.core.database import SessionLocal  # noqa: PLC0415

    try:
        await asyncio.sleep(start_delay_s)
        while True:
            try:
                async with SessionLocal() as db:
                    removed = await purge_expired_login_tokens(db)
                if removed:
                    log.info("Registos de entrada expirados apagados: %d", removed)
            except Exception:
                log.exception("Não foi possível purgar os registos de entrada expirados")
            await asyncio.sleep(interval_s)
    except asyncio.CancelledError:
        raise


__all__ = [
    "consent_history",
    "delete_account",
    "deletion_preview",
    "export_account",
    "get_policy",
    "list_consents",
    "purge_expired_login_tokens",
    "record_consent",
    "retention_loop",
]
