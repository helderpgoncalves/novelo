"""Avalia a triagem por foto contra uma verdade-terreno e compara modelos.

Uso (via just):  just eval-triage [--models a,b,c] [--dir data/eval/triage] [--limit N]

Lê `<dir>/truth.csv` (file, label_file, garment_type, condition, brand, composition) e as imagens da pasta,
corre o modelo de visão peça a peça e escreve:
  - docs/engenharia/avaliacao-triagem.md  (exatidão, matrizes de confusão, custo e latência)
  - data/eval/triage-last.json            (o painel /admin/ai mostra este ficheiro)
Sem imagens, escreve o modelo vazio com as instruções. Só o modelo de visão é chamado; nada é guardado no servidor.
"""

import argparse
import asyncio
import sys
from datetime import UTC, datetime
from pathlib import Path

from novelo.adapters.openrouter import OpenRouterClient
from novelo.ai.eval_triage import (
    TriageEvalReport,
    evaluate_model,
    load_truth,
    render_empty_template,
    render_markdown,
    save_report,
)
from novelo.ai.prompts import load
from novelo.core.config import get_settings

ROOT = Path(__file__).resolve().parent.parent


def _args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--dir", type=Path, default=ROOT / "data" / "eval" / "triage", help="pasta com imagens e truth.csv")
    p.add_argument("--csv", type=Path, default=None, help="CSV de verdade-terreno (por omissão <dir>/truth.csv)")
    p.add_argument(
        "--models", default="", help="slugs separados por vírgula; por omissão, o modelo de visão configurado"
    )
    p.add_argument("--limit", type=int, default=0, help="só as primeiras N peças (0 = todas)")
    p.add_argument("--out", type=Path, default=ROOT / "docs" / "engenharia" / "avaliacao-triagem.md")
    p.add_argument("--json", type=Path, default=ROOT / "data" / "eval" / "triage-last.json")
    return p.parse_args()


async def main() -> int:
    a = _args()
    csv_path = a.csv or a.dir / "truth.csv"
    rows = load_truth(csv_path) if csv_path.is_file() else []
    if a.limit:
        rows = rows[: a.limit]
    missing = [r.file for r in rows if not (a.dir / r.file).is_file()]
    missing += [r.label_file for r in rows if r.label_file and not (a.dir / r.label_file).is_file()]
    if missing:
        print(f"Imagens em falta em {a.dir}: {', '.join(missing[:10])}", file=sys.stderr)
        return 2
    if not rows:
        a.out.write_text(render_empty_template(), encoding="utf-8")
        print(f"Sem imagens/truth.csv em {a.dir}. Escrevi o modelo vazio em {a.out}.")
        return 0
    if not get_settings().llm_enabled:
        print("OPENROUTER_API_KEY não está definida no .env.", file=sys.stderr)
        return 2

    client = OpenRouterClient()
    models = [m.strip() for m in a.models.split(",") if m.strip()] or [client.model_for("triage")]
    await client.aclose()
    results = []
    for model in models:
        print(f"A avaliar {model} em {len(rows)} peças...", flush=True)
        c = OpenRouterClient()
        try:
            results.append(await evaluate_model(c, rows, a.dir, model=model))
        finally:
            await c.aclose()
    report = TriageEvalReport(
        generated_at=datetime.now(UTC), prompt_version=load("triage")[1], images=len(rows), models=results
    )
    a.out.write_text(render_markdown(report), encoding="utf-8")
    save_report(a.json, report)

    print(f"\n{'modelo':42} {'tipo':>6} {'estado':>7} {'marca':>6} {'fibra':>6} {'lat.':>7} {'US$/peça':>10} falhas")
    for m in results:
        x = m.accuracy
        cost = "n/d" if m.avg_cost_usd is None else f"{m.avg_cost_usd:.5f}"
        print(
            f"{m.model:42} {x['garment_type']:>6.0%} {x['condition']:>7.0%} {x['brand']:>6.0%} "
            f"{x['dominant_fibre']:>6.0%} {m.avg_latency_s:>6.1f}s {cost:>10} {m.failures}/{m.pieces}"
        )
    print(f"\nEscrevi {a.out} e {a.json}")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
