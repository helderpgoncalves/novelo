"""Migração 0012: `scenarios.modes` preenchida a partir do `result` existente, índice por data, e desfaz-se."""

import json

from sqlalchemy import create_engine, inspect, text

from tests.api.test_email_migration import alembic, scratch_url  # noqa: F401  (fixture partilhada)


def _insert(conn, label: str, result: dict | str) -> None:  # type: ignore[no-untyped-def]
    conn.execute(
        text(
            "INSERT INTO scenarios (id, label, objective, status, solver_status, params, constraints, result, "
            "tonnes_year, capex_eur, annual_cost_eur, coverage_pct, parameter_set_version) "
            "VALUES (gen_random_uuid(), :label, 'max_tonnes', 'computed', 'optimal', '{}', '{}', "
            "CAST(:result AS jsonb), 1, 1, 1, 1, 1)"
        ),
        {"label": label, "result": result if isinstance(result, str) else json.dumps(result)},
    )


def test_modes_are_backfilled_from_the_stored_result(scratch_url: str) -> None:  # noqa: F811
    assert alembic(scratch_url, "upgrade", "0011").returncode == 0
    engine = create_engine(scratch_url.replace("+asyncpg", "+psycopg2"))
    with engine.begin() as conn:
        _insert(
            conn,
            "mix",
            {
                "modes": [
                    {"mode": "street", "zones": 3},
                    {"mode": "on_demand", "zones": 0},
                    {"mode": "bring", "zones": 1},
                ]
            },
        )
        _insert(conn, "none", {"modes": []})
        _insert(conn, "legacy", {"kpis": {}})  # sem a chave `modes`
        _insert(conn, "bad", '"not-an-object"')
    up = alembic(scratch_url, "upgrade", "0012")
    assert up.returncode == 0, up.stderr[-800:]
    with engine.connect() as conn:
        modes = dict(conn.execute(text("SELECT label, modes FROM scenarios")).all())
        assert modes == {"mix": ["street", "bring"], "none": [], "legacy": [], "bad": []}
    assert ("created_at",) in {tuple(i["column_names"]) for i in inspect(engine).get_indexes("scenarios")}
    down = alembic(scratch_url, "downgrade", "0011")
    assert down.returncode == 0, down.stderr[-800:]
    assert "modes" not in {c["name"] for c in inspect(engine).get_columns("scenarios")}
    engine.dispose()
