"""Escreve openapi.json na raiz a partir de create_app(), sem arrancar o servidor.

Uso: `just gen` (corre isto e depois o hey-api no web). Com um argumento escreve nesse caminho em vez de
na raiz (usado por `just check-contract`, que compara sem tocar nos ficheiros do repositório).
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
target = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "openapi.json"
target.write_text(
    json.dumps(spec, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8"
)
print(f"openapi.json: {len(spec['paths'])} rotas")
