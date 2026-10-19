"""Application factory. Todas as rotas vivem sob /api/v1."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.routing import APIRoute

from novelo.core.config import get_settings
from novelo.core.errors import register_error_handlers
from novelo.core.logging import RequestLoggingMiddleware, configure_logging
from novelo.features.baseline.router import router as baseline_router
from novelo.features.health.router import router as health_router

API_PREFIX = "/api/v1"


def _operation_id(route: APIRoute) -> str:
    """Nome da função como operationId: gera `getTextileBaselineOptions` no cliente do web."""
    return route.name


def create_app() -> FastAPI:
    settings = get_settings()
    configure_logging(settings.log_level)

    app = FastAPI(
        title="Novelo API",
        version="0.1.0",
        generate_unique_id_function=_operation_id,
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
    app.include_router(baseline_router, prefix=f"{API_PREFIX}/baseline", tags=["baseline"])
    return app


app = create_app()
