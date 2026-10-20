# ruff: noqa: E501, PLR0915, PLC0415
"""Avalia o copiloto ponta a ponta com o modelo REAL (precisa de OPENROUTER_API_KEY no .env).

Uso (via just):  just eval-copilot [--suite core|extended|all] [--only id1,id2] [--keep-db] [--concurrency 3] [--no-fail]

Suites: `core` (copilot_cases.yaml: dados, simulações, artefactos, ações, memória), `extended` (copilot_cases_extended.yaml:
cenários em linguagem natural, gráficos de qualquer tabela, lacunas de dados, pesquisa web com páginas SIMULADAS, injeção,
números impossíveis, ambiguidade) ou `all` (por omissão). A pesquisa web da avaliação nunca vai à rede.

Corre os casos de apps/api/tests/evals/copilot_cases.yaml contra uma base de dados própria (novelo_eval, criada e
semeada com os dados reais da Vitrus), pelo mesmo caminho do produto (/copilot/stream). Escreve
docs/engenharia/avaliacao-copiloto.md e data/eval/copilot-last.json, e sai com código 1 se algum limiar falhar.
"""

import argparse
import asyncio
import json
import sys
from dataclasses import asdict
from pathlib import Path

from novelo.ai.eval_copilot import Harness, aggregate, failures, load_suite, render_markdown
from novelo.ai.prompts import load
from novelo.core.config import get_settings

ROOT = Path(__file__).resolve().parent.parent
CASES_DIR = ROOT / "apps" / "api" / "tests" / "evals"
SUITES = {
    "core": [CASES_DIR / "copilot_cases.yaml"],
    "extended": [CASES_DIR / "copilot_cases_extended.yaml"],
    "all": [CASES_DIR / "copilot_cases.yaml", CASES_DIR / "copilot_cases_extended.yaml"],
}


async def main() -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--suite", choices=sorted(SUITES), default="all", help="que conjunto de casos correr")
    p.add_argument("--cases", type=Path, nargs="+", default=None, help="ficheiros de casos (substitui --suite)")
    p.add_argument("--only", default="", help="ids (ou partes de ids) separados por vírgula")
    p.add_argument("--db", default="novelo_eval")
    p.add_argument("--model", default="openai/gpt-6-luna", help="modelo do copiloto na avaliação")
    p.add_argument(
        "--keep-db", action="store_true", help="reutiliza a base de dados de avaliação (por omissão é recriada)"
    )
    p.add_argument("--concurrency", type=int, default=3)
    p.add_argument("--out", type=Path, default=ROOT / "docs" / "engenharia" / "avaliacao-copiloto.md")
    p.add_argument("--json", type=Path, default=ROOT / "data" / "eval" / "copilot-last.json")
    p.add_argument("--no-fail", action="store_true", help="não sair com código 1 se falhar (para iterar)")
    p.add_argument("--verbose", action="store_true", help="logs INFO do copiloto (números rejeitados, reservas...)")
    p.add_argument("--show", action="store_true", help="mostra a resposta final de cada caso")
    p.add_argument("--no-write", action="store_true", help="não reescrever o relatório (execuções parciais)")
    args = p.parse_args()
    if args.verbose:
        import logging

        logging.basicConfig(level=logging.INFO, format="        log: %(message)s")
        logging.getLogger("novelo.copilot").setLevel(logging.DEBUG)
        logging.getLogger("httpx").setLevel(logging.WARNING)
    if not get_settings().llm_enabled:
        print("OPENROUTER_API_KEY não está definida no .env.", file=sys.stderr)
        return 2
    cases = load_suite(args.cases or SUITES[args.suite])
    only = [s for s in args.only.split(",") if s]
    if only:
        cases = [c for c in cases if any(s in c["id"] for s in only)]
    harness = Harness(args.db, fresh=not args.keep_db, model=args.model)
    print(f"A preparar a base de dados {args.db}...", flush=True)
    await harness.setup()
    sem = asyncio.Semaphore(max(1, args.concurrency))

    async def run(case: dict) -> object:  # type: ignore[type-arg]
        async with sem:
            res = await harness.run_case(case)
            mark = "ok " if res.passed else "ERR"
            print(f"[{mark}] {res.id:34} {res.total_s:5.1f}s {res.tokens:6} tok  {res.error or ''}", flush=True)
            if args.show:
                for t in res.turns:
                    print("        > " + t.text.replace("\n", " ")[:600], flush=True)
            for c in res.checks:
                if not c.ok:
                    print(f"        - [{c.name}] {c.detail[:200]}", flush=True)
            return res

    results = list(await asyncio.gather(*[run(c) for c in cases]))
    agg = aggregate(results)  # type: ignore[arg-type]
    fails = failures(agg)
    model = args.model
    version = load("copilot")[1]
    print(
        f"\n{agg['passed']}/{agg['cases']} casos ok · P95 {agg['p95_total_s']:.1f}s · custo médio US$ {agg['mean_cost_usd']:.4f}"
    )
    for g, rate in sorted(agg["rates"].items()):
        print(f"  {g:10} {rate:.0%}")
    if fails:
        print("\nLimiares não cumpridos:\n  " + "\n  ".join(fails))
    if not args.no_write:
        args.out.write_text(render_markdown(results, agg, model, version, fails), encoding="utf-8")  # type: ignore[arg-type]
        args.json.parent.mkdir(parents=True, exist_ok=True)
        args.json.write_text(
            json.dumps(
                {
                    "aggregate": agg,
                    "failures": fails,
                    "cases": [
                        {
                            "id": r.id,
                            "passed": r.passed,
                            "total_s": r.total_s,
                            "tokens": r.tokens,
                            "cost_usd": r.cost_usd,
                            "checks": [asdict(c) for c in r.checks],
                        }
                        for r in results
                    ],
                },
                indent=2,
                default=str,
            ),
            encoding="utf-8",
        )  # type: ignore[attr-defined]
        print(f"\nEscrevi {args.out} e {args.json}")
    return 0 if args.no_fail or not fails else 1  # só os limiares reprovam; um caso isolado pode variar com o modelo


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
