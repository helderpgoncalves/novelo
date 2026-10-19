"""Escreve openapi.json na raiz a partir de create_app(), sem arrancar o servidor.

Uso: `just gen` (corre isto e depois o hey-api no web).
"""

import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "apps" / "api" / "src"))
os.environ.setdefault("APP_ENV", "development")  # o OpenAPI só é exposto fora de produção

from novelo.main import create_app  # noqa: E402

spec = create_app().openapi()
(ROOT / "openapi.json").write_text(
    json.dumps(spec, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8"
)
print(f"openapi.json: {len(spec['paths'])} rotas")
