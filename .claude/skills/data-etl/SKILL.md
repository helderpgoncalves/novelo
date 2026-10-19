---
name: data-etl
description: Ingerir e limpar dados do Novelo (Excel da Vitrus, localizações dos contentores, INE BGRI, CAOP, OSM) para data/processed. Usar quando chegam ficheiros novos ou o ETL falha.
---

# ETL de dados

- Ficheiros brutos em `data/raw/` (nunca editar). Script: `scripts/etl/build_processed.py` (`just etl`, dependências inline PEP 723). Saídas em `data/processed/` (CSV com `\n`, UTF-8) + `summary.json`. Tudo derivado é reproduzível.
- **Já ingeridos:** `dados_textil.xlsx` (baseline 2025 por entidade, composição RSU) e `Circuitos_Viaturas_Guimaraes.xlsx` (circuitos, turnos, viaturas, alertas de qualidade).
- **A chegar (20 out):** localizações dos contentores. Procedimento: guardar em `data/raw/`, ler cabeçalhos e unidades, normalizar (lat/lon WGS84, freguesia CAOP, tipo de contentor, operador), validar (dentro do concelho, sem duplicados), gerar `containers.csv`, acrescentar teste em `tests/api/`, expor por endpoint e atualizar `docs/dados/analise-dados-recebidos.md`.
- **Qualidade:** registar em `data_alerts.csv`/docs tudo o que não bate (ex.: "BIO 5 sem viatura", Nova Etapa e Vitrus por percentagens). Nunca "corrigir" silenciosamente.
- **Fontes públicas:** INE BGRI 2021 (população), CAOP (freguesias), OSM (estradas e locais candidatos), TIPAU. Cada uma com fonte e data em `docs/engenharia/dados-e-modelo.md`.
- Validar sempre: totais batem com o Excel (ver `tests/api/test_baseline.py`).
