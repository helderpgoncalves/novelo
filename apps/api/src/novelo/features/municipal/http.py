"""Cache HTTP da rede municipal: ETag + Cache-Control, 304 sem recalcular e gzip dos JSON grandes.

Os dados só mudam quando o seed importa um pacote novo, por isso a versão (SHA-256 do pacote + instante da importação)
chega para validar. As respostas são `private`: dependem da sessão (e, nos nomes de produtores, do papel).
"""

import gzip
import hashlib
from collections import OrderedDict
from dataclasses import dataclass
from typing import Annotated

from fastapi import Depends, Request, Response
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.core.database import get_db
from novelo.core.deps import CurrentUser
from novelo.features.municipal import access

SHORT_MAX_AGE_S = 300
STATIC_MAX_AGE_S = 3600
GZIP_MIN_BYTES = 1024
_GZIP_CACHE_MAX = 64
_gzip_cache: OrderedDict[str, bytes] = OrderedDict()


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
        return {
            "ETag": self.etag,
            "Cache-Control": f"private, max-age={self.max_age}",
            "Vary": "Cookie, Accept-Encoding",
        }

    def not_modified(self) -> Response:
        return Response(status_code=304, headers=self._headers())

    def stamp[T: BaseModel](self, payload: T) -> T:
        """Marca a resposta tipada (FastAPI serializa e valida com o `response_model`)."""
        for key, value in self._headers().items():
            self.response.headers[key] = value
        return payload

    def json_response(self, payload: BaseModel, media_type: str = "application/json") -> Response:
        """Resposta já serializada (e comprimida se o cliente aceitar): para GeoJSON grande."""
        body = payload.model_dump_json().encode()
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


async def _build(request: Request, response: Response, db: AsyncSession, user_role: str, max_age: int) -> HttpCache:
    version = await access.data_version(db)
    scope = f"{request.url.path}?{request.url.query}|{'admin' if user_role == 'admin' else 'other'}"
    etag = f'W/"{version}-{hashlib.sha1(scope.encode()).hexdigest()[:12]}"'
    return HttpCache(request, response, etag, max_age)


async def _short_cache(
    request: Request, response: Response, db: Annotated[AsyncSession, Depends(get_db)], user: CurrentUser
) -> HttpCache:
    return await _build(request, response, db, user.role, SHORT_MAX_AGE_S)


async def _static_cache(
    request: Request, response: Response, db: Annotated[AsyncSession, Depends(get_db)], user: CurrentUser
) -> HttpCache:
    return await _build(request, response, db, user.role, STATIC_MAX_AGE_S)


Cache = Annotated[HttpCache, Depends(_short_cache)]
StaticCache = Annotated[HttpCache, Depends(_static_cache)]
