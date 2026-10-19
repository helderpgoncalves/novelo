---
name: add-api-feature
description: Procedimento para criar uma feature ou rota na API FastAPI do Novelo, ponta a ponta até ao cliente TypeScript gerado. Usar ao adicionar endpoints, schemas, modelos ou migrações.
---

# Nova feature na API

1. **Schemas primeiro** (`features/<nome>/schemas.py`): Pydantic v2, campos com `Field(description=...)`, unidades no nome (`_t`, `_eur`, `_pct`). Este é o contrato.
2. **Domínio puro** (`domain/*.py`) se houver fórmulas: sem I/O, tipado, com teste unitário de valores calculados à mão (`tests/unit/`).
3. **Service** (`service.py`): funções que recebem `AsyncSession`/dependências, sem importar FastAPI, levantam `NotFoundError`/`ConflictError`/`UpstreamError`.
4. **Router** (`router.py`): `APIRouter()` sem prefixo; `response_model` obrigatório; o nome da função é o `operationId` (`list_zones`, `create_scenario`). Rotas com OR-Tools ou CPU pesado são `def`, não `async def`.
5. **Registar** em `main.py`: `app.include_router(x_router, prefix=f"{API_PREFIX}/x", tags=["x"])`.
6. **Modelos** (`models.py`, `Base + UuidPkMixin + TimestampMixin`) → importar em `alembic/env.py` → `just migration "descrição"` → rever o ficheiro gerado → `just migrate`.
7. **Teste de API** em `tests/api/` com `TestClient(create_app())`; adapters externos trocados por falsos.
8. **Contrato:** `just gen` (skill `contract-gen`). Se mudou o web, usar os hooks gerados.
9. `just check` verde antes de commit.

Regras: erros só via `AppError`; sem lógica de negócio no router; nada de `print` (usa `logging`); dados reais de `data/processed/` via `core/config.data_dir`.
