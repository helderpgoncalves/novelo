"""Prompts versionados. A versão fica guardada em cada resposta que o modelo produz (auditoria)."""

from pathlib import Path

_DIR = Path(__file__).parent


def load(name: str) -> tuple[str, str]:
    """Devolve (texto, versão). O ficheiro chama-se `<nome>_v<N>.md`; a versão mais alta ganha."""
    candidates = sorted(_DIR.glob(f"{name}_v*.md"), key=lambda p: int(p.stem.rsplit("_v", 1)[1]))
    if not candidates:
        raise FileNotFoundError(f"Sem prompt para {name}")
    path = candidates[-1]
    return path.read_text(encoding="utf-8"), f"v{path.stem.rsplit('_v', 1)[1]}"
