"""Comandos de manutenção: `python -m novelo.cli seed`."""

import argparse
import asyncio
import json
import logging
from pathlib import Path

from novelo.core.config import get_settings
from novelo.core.database import SessionLocal, engine
from novelo.core.logging import configure_logging
from novelo.seed import seed


async def _seed(data_dir: Path) -> None:
    async with SessionLocal() as db:
        counts = await seed(db, data_dir)
    await engine.dispose()
    print(json.dumps(counts, indent=2))


def main() -> None:
    parser = argparse.ArgumentParser(prog="novelo")
    sub = parser.add_subparsers(dest="command", required=True)
    seed_cmd = sub.add_parser("seed", help="Importa data/processed para a base de dados (idempotente)")
    seed_cmd.add_argument("--data-dir", type=Path, default=None)
    args = parser.parse_args()

    settings = get_settings()
    configure_logging(settings.log_level)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
    if args.command == "seed":
        asyncio.run(_seed(args.data_dir or settings.data_dir))


if __name__ == "__main__":
    main()
