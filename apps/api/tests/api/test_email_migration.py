"""Migração 0011: cria `email_deliveries` e `email_suppressions` (e desfaz-se), sem divergir dos modelos."""

import os
import subprocess
import sys
import uuid
from collections.abc import Iterator
from pathlib import Path

import pytest
from sqlalchemy import create_engine, inspect, text

from tests.conftest import TEST_DB

API_DIR = Path(__file__).resolve().parents[2]


@pytest.fixture
def scratch_url() -> Iterator[str]:
    name = f"novelo_mig_{uuid.uuid4().hex[:8]}"
    base = TEST_DB.rsplit("/", 1)[0]
    admin = create_engine(base.replace("+asyncpg", "+psycopg2") + "/postgres", isolation_level="AUTOCOMMIT")
    try:
        with admin.connect() as conn:
            conn.execute(text(f'CREATE DATABASE "{name}"'))
    except Exception:
        admin.dispose()
        pytest.skip("sem Postgres")
    yield f"{base}/{name}"
    with admin.connect() as conn:
        conn.execute(text(f'DROP DATABASE IF EXISTS "{name}" WITH (FORCE)'))
    admin.dispose()


def alembic(url: str, *args: str) -> subprocess.CompletedProcess[str]:
    env = {**os.environ, "DATABASE_URL": url}
    return subprocess.run(
        [sys.executable, "-m", "alembic", *args],
        check=False,
        cwd=API_DIR,
        env=env,
        capture_output=True,
        text=True,
        timeout=120,
    )


def test_upgrade_matches_models_and_downgrades(scratch_url: str) -> None:
    up = alembic(scratch_url, "upgrade", "head")
    assert up.returncode == 0, up.stderr[-800:]
    engine = create_engine(scratch_url.replace("+asyncpg", "+psycopg2"))
    insp = inspect(engine)
    assert {"email_deliveries", "email_suppressions"} <= set(insp.get_table_names())
    indexed = {tuple(i["column_names"]) for i in insp.get_indexes("email_deliveries")}
    assert {
        ("to_email",),
        ("status",),
        ("created_at",),
        ("provider_message_id",),
        ("user_id",),
        ("invitation_id",),
    } <= indexed
    columns = {c["name"] for c in insp.get_columns("email_deliveries")}
    assert columns == {
        "id", "to_email", "template", "user_id", "invitation_id", "provider_message_id", "status", "error_code",
        "attempts", "created_at", "sent_at", "delivered_at", "updated_at",
    }  # fmt: skip
    check = alembic(scratch_url, "check")  # os modelos e a migração não divergem
    assert check.returncode == 0, check.stdout[-800:] + check.stderr[-800:]
    down = alembic(scratch_url, "downgrade", "0010")
    assert down.returncode == 0, down.stderr[-800:]
    assert "email_deliveries" not in inspect(engine).get_table_names()
    engine.dispose()
