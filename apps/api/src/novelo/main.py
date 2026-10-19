"""Application factory. Todas as rotas vivem sob /api/v1."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.routing import APIRoute

from novelo.core.config import get_settings
from novelo.core.database import SessionLocal
from novelo.core.deps import get_current_user
from novelo.core.errors import register_error_handlers
from novelo.core.logging import RequestLoggingMiddleware, configure_logging
from novelo.features.auth import service as auth_service
from novelo.features.auth.router import router as auth_router
from novelo.features.baseline.router import router as baseline_router
from novelo.features.health.router import router as health_router

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

    app.include_router(health_router, prefix=API_PREFIX, tags=["health"])
    app.include_router(auth_router, prefix=f"{API_PREFIX}/auth", tags=["auth"])
    # Dados da Vitrus: só para utilizadores autenticados.
    app.include_router(
        baseline_router,
        prefix=f"{API_PREFIX}/baseline",
        tags=["baseline"],
        dependencies=[Depends(get_current_user)],
    )
    return app


app = create_app()
