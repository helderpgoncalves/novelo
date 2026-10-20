"""Erros de domínio e o contrato único de erro da API.

Todas as respostas de erro têm o mesmo corpo e entram no OpenAPI (ver `COMMON_ERRORS`), por isso o
cliente gerado pelo hey-api tem os tipos exatos. O `code` é estável e é ele que o web traduz;
`message` está em inglês e serve para logs e para quem usa a API diretamente.
"""

from typing import Any, ClassVar, Literal

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from starlette.exceptions import HTTPException as StarletteHTTPException

ErrorCode = Literal[
    "bad_request",
    "validation_error",
    "unauthenticated",
    "session_expired",
    "invalid_credentials",
    "account_inactive",
    "current_password_incorrect",
    "invalid_token",
    "forbidden",
    "registration_closed",
    "invalid_event_code",
    "not_found",
    "user_not_found",
    "email_taken",
    "cannot_modify_self",
    "conflict",
    "rate_limited",
    "feature_disabled",
    "upstream_error",
    "ai_budget_exceeded",
    "captcha_required",
    "captcha_failed",
    "captcha_unavailable",
    "internal_error",
]


class ErrorBody(BaseModel):
    """Corpo de qualquer erro da API (exceto validação, que tem `fields`)."""

    code: ErrorCode
    message: str = Field(description="Mensagem técnica em inglês; o web traduz a partir de `code`")


class FieldError(BaseModel):
    field: str = Field(description="Caminho do campo, ex.: `password` ou `body.email`")
    type: str = Field(description="Tipo de erro do Pydantic, ex.: `string_too_short`")
    message: str


class ValidationErrorBody(BaseModel):
    code: Literal["validation_error"] = "validation_error"
    message: str
    fields: list[FieldError]


class AppError(Exception):
    status_code: ClassVar[int] = 400
    code: ClassVar[ErrorCode] = "bad_request"

    def __init__(self, message: str | None = None) -> None:
        self.message = message or self.__class__.__name__
        super().__init__(self.message)


class InvalidCredentialsError(AppError):
    status_code = 401
    code = "invalid_credentials"


class UnauthenticatedError(AppError):
    status_code = 401
    code = "unauthenticated"


class SessionExpiredError(AppError):
    status_code = 401
    code = "session_expired"


class AccountInactiveError(AppError):
    status_code = 401
    code = "account_inactive"


class CurrentPasswordIncorrectError(AppError):
    status_code = 400
    code = "current_password_incorrect"


class InvalidTokenError(AppError):
    status_code = 400
    code = "invalid_token"


class ForbiddenError(AppError):
    status_code = 403
    code = "forbidden"


class RegistrationClosedError(AppError):
    status_code = 403
    code = "registration_closed"


class InvalidEventCodeError(AppError):
    status_code = 403
    code = "invalid_event_code"


class NotFoundError(AppError):
    status_code = 404
    code = "not_found"


class UserNotFoundError(AppError):
    status_code = 404
    code = "user_not_found"


class EmailTakenError(AppError):
    status_code = 409
    code = "email_taken"


class CannotModifySelfError(AppError):
    status_code = 409
    code = "cannot_modify_self"


class ConflictError(AppError):
    status_code = 409
    code = "conflict"


class RateLimitError(AppError):
    status_code = 429
    code = "rate_limited"


class FeatureDisabledError(AppError):
    status_code = 503
    code = "feature_disabled"


class AiBudgetExceededError(AppError):
    """Orçamento mensal de IA esgotado: paragem dura até ao mês seguinte ou até um admin subir o limite."""

    status_code = 503
    code = "ai_budget_exceeded"


class CaptchaRequiredError(AppError):
    status_code = 400
    code = "captcha_required"


class CaptchaFailedError(AppError):
    status_code = 403
    code = "captcha_failed"


class CaptchaUnavailableError(AppError):
    """A Cloudflare não respondeu (ou o Turnstile não está configurado e é obrigatório). Fail-closed."""

    status_code = 503
    code = "captcha_unavailable"


class UpstreamError(AppError):
    status_code = 502
    code = "upstream_error"


# Declarado em todos os routers: é o que dá ao cliente gerado os tipos de erro.
COMMON_ERRORS: dict[int | str, dict[str, Any]] = {
    400: {"model": ErrorBody, "description": "Pedido inválido"},
    401: {"model": ErrorBody, "description": "Sem sessão ou credenciais inválidas"},
    403: {"model": ErrorBody, "description": "Sem permissão"},
    404: {"model": ErrorBody, "description": "Não encontrado"},
    409: {"model": ErrorBody, "description": "Conflito"},
    422: {"model": ValidationErrorBody, "description": "Dados inválidos"},
    429: {"model": ErrorBody, "description": "Demasiados pedidos"},
    500: {"model": ErrorBody, "description": "Erro interno"},
    502: {"model": ErrorBody, "description": "Falha num serviço externo"},
    503: {"model": ErrorBody, "description": "Funcionalidade indisponível"},
}


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _app_error(_: Request, exc: AppError) -> JSONResponse:
        body = ErrorBody(code=exc.code, message=exc.message)
        return JSONResponse(status_code=exc.status_code, content=body.model_dump())

    @app.exception_handler(RequestValidationError)
    async def _validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
        fields = [
            FieldError(
                field=".".join(str(p) for p in err["loc"] if p != "body"),
                type=err["type"],
                message=str(err["msg"]),
            )
            for err in exc.errors()
        ]
        body = ValidationErrorBody(message="Request validation failed", fields=fields)
        return JSONResponse(status_code=422, content=body.model_dump())

    @app.exception_handler(StarletteHTTPException)
    async def _http_error(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        code: ErrorCode = "not_found" if exc.status_code == 404 else "bad_request"
        return JSONResponse(
            status_code=exc.status_code, content=ErrorBody(code=code, message=str(exc.detail)).model_dump()
        )

    @app.exception_handler(Exception)
    async def _unexpected(_: Request, exc: Exception) -> JSONResponse:
        body = ErrorBody(code="internal_error", message="Unexpected server error")
        return JSONResponse(status_code=500, content=body.model_dump())
