"""Application factory. Todas as rotas vivem sob /api/v1."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.routing import APIRoute

from novelo.core.config import get_settings
from novelo.core.database import SessionLocal
from novelo.core.deps import get_current_user
from novelo.core.errors import COMMON_ERRORS, register_error_handlers
from novelo.core.logging import RequestLoggingMiddleware, configure_logging
from novelo.features.auth import service as auth_service
from novelo.features.auth.router import router as auth_router
from novelo.features.datasets.router import router as datasets_router
from novelo.features.health.router import router as health_router
from novelo.features.network.router import router as network_router
from novelo.features.textile.router import router as textile_router
from novelo.features.users.router import router as users_router

API_PREFIX = "/api/v1"


def _operation_id(route: APIRoute) -> str:
    """Nome da função como operationId: gera `getTextileBaselineOptions` no cliente do web."""
    return route.name


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    async with SessionLocal() as db:
        await auth_service.seed_admin(db)
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    configure_logging(settings.log_level)

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
    app.add_middleware(RequestLoggingMiddleware)
    register_error_handlers(app)

    app.include_router(health_router, prefix=API_PREFIX, tags=["health"], responses=COMMON_ERRORS)
    app.include_router(auth_router, prefix=f"{API_PREFIX}/auth", tags=["auth"], responses=COMMON_ERRORS)
    app.include_router(users_router, prefix=f"{API_PREFIX}/users", tags=["users"], responses=COMMON_ERRORS)
    # Dados da Vitrus: só para utilizadores autenticados.
    protected = [Depends(get_current_user)]
    for router, name in ((textile_router, "textile"), (network_router, "network"), (datasets_router, "datasets")):
        app.include_router(
            router, prefix=f"{API_PREFIX}/{name}", tags=[name], dependencies=protected, responses=COMMON_ERRORS
        )
    return app


app = create_app()
