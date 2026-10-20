"""Cache HTTP partilhada: ETag + Cache-Control `private`, 304 sem recalcular e gzip em cache dos JSON grandes.

Serve dados que só mudam por importação (seed) ou por uma ação de administração. Cada rota diz qual é a *versão* dos
seus dados (uma consulta barata); o ETag junta a versão ao caminho e à query, pelo que muda sempre que os dados mudam e
nunca confunde duas queries. As respostas são `private`: dependem da sessão e nunca se partilham entre utilizadores.
Não aplicar a dados por utilizador (ou que mudam a cada ação, como alertas e cenários).
"""

import gzip
import hashlib
from collections import OrderedDict
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Annotated, Any

from fastapi import Depends, Request, Response
from pydantic import BaseModel
from pydantic_core import to_json
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.core.database import get_db
from novelo.core.deps import CurrentUser
from novelo.features.users.models import User

REFERENCE_MAX_AGE_S = 300  # dados de referência (seed): mudam em implantações, não durante o dia
REVALIDATE_MAX_AGE_S = 0  # depende de pressupostos editáveis: valida sempre (304 barato) para ver a edição já
GZIP_MIN_BYTES = 1024
_GZIP_CACHE_MAX = 64
_gzip_cache: OrderedDict[str, bytes] = OrderedDict()

VersionFn = Callable[[AsyncSession], Awaitable[str]]
VariantFn = Callable[[User], str]


@dataclass
class HttpCache:
    request: Request
    response: Response
    etag: str
    max_age: int

    @property
    def fresh(self) -> bool:
        """O cliente já tem esta versão (If-None-Match)."""
        sent = self.request.headers.get("if-none-match", "").strip()
        tags = {t.strip().removeprefix("W/") for t in sent.split(",")}
        return sent == "*" or self.etag.removeprefix("W/") in tags

    def _headers(self) -> dict[str, str]:
        control = f"private, max-age={self.max_age}" + (", must-revalidate" if self.max_age == 0 else "")
        return {"ETag": self.etag, "Cache-Control": control, "Vary": "Cookie, Accept-Encoding"}

    def not_modified(self) -> Response:
        return Response(status_code=304, headers=self._headers())

    def stamp[T](self, payload: T) -> T:
        """Marca a resposta tipada (FastAPI serializa e valida com o `response_model`)."""
        for key, value in self._headers().items():
            self.response.headers[key] = value
        return payload

    def json_response(self, payload: BaseModel | list[Any], media_type: str = "application/json") -> Response:
        """Resposta já serializada (e comprimida se o cliente aceitar): para JSON grandes (geometrias)."""
        body = payload.model_dump_json().encode() if isinstance(payload, BaseModel) else to_json(payload, by_alias=True)
        headers = self._headers()
        if len(body) >= GZIP_MIN_BYTES and "gzip" in self.request.headers.get("accept-encoding", ""):
            key = f"{self.etag}|{hashlib.sha1(body).hexdigest()}"
            packed = _gzip_cache.get(key)
            if packed is None:
                packed = gzip.compress(body, compresslevel=6, mtime=0)
                _gzip_cache[key] = packed
                while len(_gzip_cache) > _GZIP_CACHE_MAX:
                    _gzip_cache.popitem(last=False)
            body = packed
            headers["Content-Encoding"] = "gzip"
        return Response(content=body, media_type=media_type, headers=headers)


def make_etag(version: str, request: Request, variant: str = "") -> str:
    scope = f"{request.url.path}?{request.url.query}|{variant}"
    return f'W/"{version}-{hashlib.sha1(scope.encode()).hexdigest()[:12]}"'


def cache_dependency(
    version: VersionFn, max_age: int, variant: VariantFn | None = None
) -> Callable[..., Awaitable[HttpCache]]:
    """Dependência que calcula o ETag da rota: versão dos dados (e, se preciso, uma variante do utilizador)."""

    async def dep(
        request: Request, response: Response, db: Annotated[AsyncSession, Depends(get_db)], user: CurrentUser
    ) -> HttpCache:
        etag = make_etag(await version(db), request, variant(user) if variant else "")
        return HttpCache(request, response, etag, max_age)

    return dep
