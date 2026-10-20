"""Cache HTTP da rede municipal: usa `core/http_cache.py` com a versão do pacote importado.

Os dados só mudam quando o seed importa um pacote novo, por isso a versão (SHA-256 do pacote + instante da importação)
chega para validar. O ETag inclui o papel: o admin vê nomes de produtores que os outros não veem.
"""

from typing import Annotated

from fastapi import Depends

from novelo.core.http_cache import HttpCache, cache_dependency
from novelo.features.municipal import access
from novelo.features.users.models import User

SHORT_MAX_AGE_S = 300
STATIC_MAX_AGE_S = 3600


def _role_variant(user: User) -> str:
    return "admin" if user.role == "admin" else "other"


Cache = Annotated[HttpCache, Depends(cache_dependency(access.data_version, SHORT_MAX_AGE_S, _role_variant))]
StaticCache = Annotated[HttpCache, Depends(cache_dependency(access.data_version, STATIC_MAX_AGE_S, _role_variant))]
