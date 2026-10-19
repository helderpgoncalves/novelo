# Avaliação da triagem por foto

Ainda não foi corrida nenhuma avaliação: não há imagens de teste com verdade-terreno.

## Como preparar

1. Cria a pasta `data/eval/triage/` e põe lá as fotografias (JPEG, PNG ou WebP) de peças reais, já classificadas por uma pessoa.
2. Na mesma pasta, cria `truth.csv` (UTF-8) com uma linha por peça:

   | Coluna | Obrigatória | Valores |
   | --- | --- | --- |
   | `file` | sim | nome da foto da peça |
   | `label_file` | não | nome da foto da etiqueta |
   | `garment_type` | sim | `tshirt`, `shirt`, `trousers`, `jumper`, `jacket`, `dress`, `skirt`, `bedding`, `towel`, `other` |
   | `condition` | sim | `reuse`, `recycle`, `reject` |
   | `brand` | não | marca como está escrita; vazio se não houver |
   | `composition` | não | `cotton:60;polyester:40` (fibras: as do esquema `Fibre`, ex.: `cotton`, `wool`, `polyester`) |

3. Garante `OPENROUTER_API_KEY` no `.env`.
4. Corre `just eval-triage` (um modelo, o configurado para a triagem) ou
   `just eval-triage --models openai/gpt-6-luna,typesafe/jev-router` para comparar vários modelos.

Este ficheiro é reescrito em cada execução. O resultado também fica em `data/eval/triage-last.json`, que o painel
de IA (`/admin/ai`) mostra. Usa pelo menos 30 peças variadas: com menos, as percentagens não dizem nada.

## O que se mede

- **Exatidão por campo**: tipo de peça, estado, marca (igualdade ignorando acentos e maiúsculas), fibra dominante e
  composição (todas as fibras a ±10 pontos percentuais).
- **Matriz de confusão** do tipo de peça e do estado, por modelo.
- **Custo e latência por peça**: custo real devolvido pelo OpenRouter; latência média e P95.
