"""Application factory. Todas as rotas vivem sob /api/v1."""

import asyncio
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.routing import APIRoute

from novelo.adapters.email import warn_if_email_unavailable
from novelo.core.captcha import warn_if_unprotected
from novelo.core.config import get_settings
from novelo.core.database import SessionLocal, engine
from novelo.core.deps import NotImpersonating, get_current_user
from novelo.core.errors import COMMON_ERRORS, register_error_handlers
from novelo.core.hardening import HardeningMiddleware
from novelo.core.logging import RequestLoggingMiddleware, configure_logging, install_query_counter
from novelo.features.ai_admin.router import router as ai_router
from novelo.features.app_settings.router import router as app_settings_router
from novelo.features.auth import service as auth_service
from novelo.features.auth.router import router as auth_router
from novelo.features.calibration.router import router as calibration_router
from novelo.features.catalog.router import router as catalog_router
from novelo.features.citizen.router import public_router as public_citizen_router
from novelo.features.citizen.router import router as citizen_router
from novelo.features.collection_requests.router import router as collection_requests_router
from novelo.features.copilot.router import router as copilot_router
from novelo.features.datasets.router import router as datasets_router
from novelo.features.dev.router import router as dev_router
from novelo.features.email_log.router import admin_router as email_admin_router
from novelo.features.email_log.router import webhook_router
from novelo.features.export_lots.router import router as export_lots_router
from novelo.features.health.router import router as health_router
from novelo.features.locals.router import public_router as public_locals_router
from novelo.features.locals.router import router as locals_router
from novelo.features.lots import photo_store
from novelo.features.lots.router import public_router as public_lots_router
from novelo.features.lots.router import router as lots_router
from novelo.features.municipal.router import router as municipal_router
from novelo.features.network.router import router as network_router
from novelo.features.planning import reference
from novelo.features.planning.insights_router import router as insights_router
from novelo.features.planning.router import router as planning_router
from novelo.features.planning.whatif_router import router as whatif_router
from novelo.features.points.router import router as points_router
from novelo.features.privacy import service as privacy_service
from novelo.features.privacy.router import public_router as public_privacy_router
from novelo.features.privacy.router import router as privacy_router
from novelo.features.reports.router import router as reports_router
from novelo.features.textile.router import router as textile_router
from novelo.features.users.router import router as users_router
from novelo.features.validation.router import router as validation_router

API_PREFIX = "/api/v1"


def _operation_id(route: APIRoute) -> str:
    """Nome da função como operationId: gera `getTextileBaselineOptions` no cliente do web."""
    return route.name


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    warn_if_unprotected()
    warn_if_email_unavailable()
    async with SessionLocal() as db:
        await auth_service.seed_admin(db)
    task = asyncio.create_task(reference.seed_in_background()) if get_settings().seed_reference_scenarios else None
    purge_task = asyncio.create_task(photo_store.purge_loop())  # retenção das miniaturas (RGPD)
    login_log_task = asyncio.create_task(privacy_service.retention_loop())  # logs de entrada: 12 meses (RGPD)
    yield
    purge_task.cancel()
    login_log_task.cancel()
    if task is not None:
        task.cancel()


def create_app() -> FastAPI:
    settings = get_settings()
    configure_logging(settings.log_level)
    if settings.log_level.lower() == "debug":
        install_query_counter(engine.sync_engine)

    app = FastAPI(
        title="Novelo API",
        version="0.1.0",
        generate_unique_id_function=_operation_id,
        lifespan=lifespan,
        docs_url="/api/docs" if settings.environment == "development" else None,
        redoc_url=None,
        openapi_url="/api/openapi.json" if settings.environment == "development" else None,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_middleware(HardeningMiddleware)
    app.add_middleware(RequestLoggingMiddleware)
    register_error_handlers(app)

    app.include_router(health_router, prefix=API_PREFIX, tags=["health"], responses=COMMON_ERRORS)
    app.include_router(auth_router, prefix=f"{API_PREFIX}/auth", tags=["auth"], responses=COMMON_ERRORS)
    # `/users/emails/*` antes do router de utilizadores (o caminho literal vem primeiro).
    app.include_router(
        email_admin_router, prefix=f"{API_PREFIX}/users/emails", tags=["emails"], responses=COMMON_ERRORS
    )
    app.include_router(users_router, prefix=f"{API_PREFIX}/users", tags=["users"], responses=COMMON_ERRORS)
    app.include_router(
        app_settings_router, prefix=f"{API_PREFIX}/admin/settings", tags=["settings"], responses=COMMON_ERRORS
    )
    # Webhooks: sem sessão; a autenticação é a assinatura do fornecedor.
    app.include_router(webhook_router, prefix=f"{API_PREFIX}/webhooks", tags=["webhooks"], responses=COMMON_ERRORS)
    # Dados da Vitrus: só para utilizadores autenticados.
    protected = [Depends(get_current_user)]
    for router, name in (
        (textile_router, "textile"),
        (network_router, "network"),
        (municipal_router, "municipal"),
        (datasets_router, "datasets"),
        (planning_router, "planning"),
        (reports_router, "reports"),
        (validation_router, "validation"),
    ):
        app.include_router(
            router, prefix=f"{API_PREFIX}/{name}", tags=[name], dependencies=protected, responses=COMMON_ERRORS
        )
    app.include_router(
        whatif_router, prefix=f"{API_PREFIX}/whatif", tags=["whatif"], dependencies=protected, responses=COMMON_ERRORS
    )
    # Operação (lotes, bolsa, triagem, marcas): autenticada. O passaporte do lote é público: o QR abre sem sessão.
    app.include_router(
        insights_router,
        prefix=f"{API_PREFIX}/planning",
        tags=["planning"],
        dependencies=protected,
        responses=COMMON_ERRORS,
    )
    app.include_router(
        ai_router, prefix=f"{API_PREFIX}/ai", tags=["ai"], dependencies=protected, responses=COMMON_ERRORS
    )
    app.include_router(
        copilot_router,
        prefix=f"{API_PREFIX}/copilot",
        tags=["copilot"],
        # Conversas e memória são privadas: nem o administrador as lê impersonando (impersonation_blocked).
        dependencies=[*protected, NotImpersonating],
        responses=COMMON_ERRORS,
    )
    app.include_router(lots_router, prefix=API_PREFIX, tags=["lots"], dependencies=protected, responses=COMMON_ERRORS)
    # Pedido de recolha unificado (#60): cidadão, local assistido e produtor B2B na mesma entidade.
    app.include_router(
        collection_requests_router,
        prefix=API_PREFIX,
        tags=["collection-requests"],
        dependencies=protected,
        responses=COMMON_ERRORS,
    )
    # Painel «Calibração» (#62): a tabela de agregados da retroalimentação (leitura; a recomputação é
    # ao recalcular um cenário). O planeamento também consome só esta tabela, nunca os eventos.
    app.include_router(
        calibration_router,
        prefix=API_PREFIX,
        tags=["calibration"],
        dependencies=protected,
        responses=COMMON_ERRORS,
    )
    app.include_router(
        export_lots_router,
        prefix=f"{API_PREFIX}/export-lots",
        tags=["export-lots"],
        dependencies=protected,
        responses=COMMON_ERRORS,
    )
    app.include_router(public_lots_router, prefix=f"{API_PREFIX}/public", tags=["public"], responses=COMMON_ERRORS)
    # Conta de local e aviso «sacos prontos» (#59): leitura do próprio local; o certificado opt-in é público.
    app.include_router(
        locals_router, prefix=API_PREFIX, tags=["locals"], dependencies=protected, responses=COMMON_ERRORS
    )
    app.include_router(public_locals_router, prefix=f"{API_PREFIX}/public", tags=["public"], responses=COMMON_ERRORS)
    # Área do cidadão (#63): conta de doador, sacos ativados e histórico; a agenda pública é sem sessão.
    app.include_router(
        citizen_router, prefix=API_PREFIX, tags=["citizen"], dependencies=protected, responses=COMMON_ERRORS
    )
    app.include_router(public_citizen_router, prefix=f"{API_PREFIX}/public", tags=["public"], responses=COMMON_ERRORS)
    # Pontos (#64): saldo e histórico do doador (livro-razão imutável); anulação em abuso é de equipa.
    app.include_router(
        points_router, prefix=API_PREFIX, tags=["points"], dependencies=protected, responses=COMMON_ERRORS
    )
    # Catálogo e resgate (#65): o doador vê e resgata; a equipa gere parceiros/campanhas e valida códigos.
    app.include_router(
        catalog_router, prefix=API_PREFIX, tags=["catalog"], dependencies=protected, responses=COMMON_ERRORS
    )
    # RGPD do doador (#66): política pública por finalidades, consentimentos, exportação e apagamento.
    app.include_router(
        privacy_router, prefix=API_PREFIX, tags=["privacy"], dependencies=protected, responses=COMMON_ERRORS
    )
    app.include_router(public_privacy_router, prefix=f"{API_PREFIX}/public", tags=["public"], responses=COMMON_ERRORS)
    if settings.environment == "development":
        app.include_router(dev_router, prefix=f"{API_PREFIX}/dev", include_in_schema=False)
    return app


app = create_app()
