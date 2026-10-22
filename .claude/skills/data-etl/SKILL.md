---
name: data-etl
description: Ingerir e limpar dados do Novelo (Excel da Vitrus, pacote municipal QGIS, INE BGRI, CAOP, OSM) para data/processed. Usar quando chegam ficheiros novos ou o ETL falha.
---

# ETL de dados

- Ficheiros brutos em `data/raw/` (nunca editar). Script: `scripts/etl/build_processed.py` (`just etl`, dependências inline PEP 723). Saídas em `data/processed/` (CSV com `\n`, UTF-8) + `summary.json`. Tudo derivado é reproduzível.
- **Já ingeridos:** `dados_textil.xlsx` (baseline 2025 por entidade, composição RSU) e `Circuitos_Viaturas_Guimaraes.xlsx` (circuitos, turnos, viaturas, alertas de qualidade).
- **Já ingerido (20 out):** pacote QGIS da Vitrus (`data/raw/vitrus-mapa-qgis/`): contentores **municipais** de indiferenciado, orgânico e seletivo (nada de têxteis) e CAOP 2019. São a base geográfica do modelo: onde o têxtil se perde no lixo e onde a viatura de têxtil pode parar. Script `scripts/etl/municipal_containers.py` (corre depois de `build_processed.py` em `just etl`), saídas `municipal_*`, `caop_guimaraes.geojson` e `qgis/*.gpkg`; teste `apps/api/tests/unit/test_etl_municipal.py`; análise em `docs/dados/analise-contentores-municipais.md`. **Nunca misturar com `containers.csv` (têxteis).** Regra de coordenadas: decide o intervalo do valor, não o nome da coluna.
- **Contentores de têxteis: não existem** (Vitrus, 21 out 2026; a Vitrus não os quer). `containers.py` e `containers.csv` ficam só por compatibilidade. Para um ficheiro novo, o procedimento é o mesmo: guardar em `data/raw/`, ler cabeçalhos e unidades, normalizar (lat/lon WGS84, freguesia CAOP, tipo, operador), validar (dentro do concelho, sem duplicados), gerar o CSV, acrescentar teste em `tests/api/`, expor por endpoint e atualizar `docs/dados/analise-dados-recebidos.md`.
- **Procura (22 out 2026):** 43 050,5 t de indiferenciado recolhidas pela Vitrus em 2025 ÷ 0,840 (84,0% do concelho; R&C 2025, p. 8) ≈ 51 250,6 t × 5,86% de têxtil (APA, RARU 2025, p. 24) ≈ 3 003,3 t por desviar. Constantes nomeadas num só sítio (`scripts/etl/textile_base.py`); derivar, não escrever 1,596 à mão.
- **Qualidade:** registar em `data_alerts.csv`/docs tudo o que não bate (ex.: "BIO 5 sem viatura", Nova Etapa e Vitrus por percentagens). Nunca "corrigir" silenciosamente.
- **Fontes públicas:** INE BGRI 2021 (população), CAOP (freguesias), OSM (estradas e locais candidatos), TIPAU. Cada uma com fonte e data em `docs/engenharia/dados-e-modelo.md`.
- Validar sempre: totais batem com o Excel (ver `tests/api/test_baseline.py`).
