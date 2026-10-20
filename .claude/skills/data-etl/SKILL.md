---
name: data-etl
description: Ingerir e limpar dados do Novelo (Excel da Vitrus, localizações dos contentores, INE BGRI, CAOP, OSM) para data/processed. Usar quando chegam ficheiros novos ou o ETL falha.
---

# ETL de dados

- Ficheiros brutos em `data/raw/` (nunca editar). Script: `scripts/etl/build_processed.py` (`just etl`, dependências inline PEP 723). Saídas em `data/processed/` (CSV com `\n`, UTF-8) + `summary.json`. Tudo derivado é reproduzível.
- **Já ingeridos:** `dados_textil.xlsx` (baseline 2025 por entidade, composição RSU) e `Circuitos_Viaturas_Guimaraes.xlsx` (circuitos, turnos, viaturas, alertas de qualidade).
- **Já ingerido (20 out):** pacote QGIS da Vitrus (`data/raw/vitrus-mapa-qgis/`): contentores **municipais** de outras frações (nada de têxteis) e CAOP 2019. Script `scripts/etl/municipal_containers.py` (corre depois de `build_processed.py` em `just etl`), saídas `municipal_*`, `caop_guimaraes.geojson` e `qgis/*.gpkg`; teste `apps/api/tests/unit/test_etl_municipal.py`; análise em `docs/dados/analise-contentores-municipais.md`. **Nunca misturar com `containers.csv` (têxteis).** Regra de coordenadas: decide o intervalo do valor, não o nome da coluna.
- **Por receber:** localizações dos contentores **de têxteis**. Procedimento: guardar em `data/raw/`, ler cabeçalhos e unidades, normalizar (lat/lon WGS84, freguesia CAOP, tipo de contentor, operador), validar (dentro do concelho, sem duplicados), gerar `containers.csv`, acrescentar teste em `tests/api/`, expor por endpoint e atualizar `docs/dados/analise-dados-recebidos.md`.
- **Qualidade:** registar em `data_alerts.csv`/docs tudo o que não bate (ex.: "BIO 5 sem viatura", Nova Etapa e Vitrus por percentagens). Nunca "corrigir" silenciosamente.
- **Fontes públicas:** INE BGRI 2021 (população), CAOP (freguesias), OSM (estradas e locais candidatos), TIPAU. Cada uma com fonte e data em `docs/engenharia/dados-e-modelo.md`.
- Validar sempre: totais batem com o Excel (ver `tests/api/test_baseline.py`).
