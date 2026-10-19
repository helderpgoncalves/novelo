# IA no Novelo

A IA traduz e explica; **nunca faz contas**. Todos os números vêm do otimizador ou da base de dados.

## Fornecedor

Todos os modelos passam pelo **OpenRouter** (API compatível com OpenAI), através de `apps/api/src/novelo/adapters/openrouter.py`. A classe `OpenRouterClient.structured()` pede JSON que cumpra um esquema Pydantic (`response_format` com `json_schema`, temperatura 0), volta a pedir uma vez se a validação falhar e levanta erros tipados (`FeatureDisabledError`, `UpstreamError`). O adaptador é injetado com `Depends`; nos testes troca-se por falsos.

Sem `OPENROUTER_API_KEY` a API arranca normalmente e as funcionalidades de IA respondem **503**. Os modelos configuram-se em `LLM_MODEL_TEXT` e `LLM_MODEL_VISION` (ver [Ambiente](ambiente.md)); o de visão tem de aceitar imagens.

## Funcionalidades

| Funcionalidade | Entrada | Saída validada | Prompt |
| --- | --- | --- | --- |
| "E se...?" | Pergunta em português, cenário atual e listas fechadas de freguesias e modos | Alteração estruturada (`ScenarioDelta`) | `ai/prompts/whatif_v1.md` |
| Explicação | Factos do otimizador em JSON | Texto curto em português | `ai/prompts/explain_v1.md` |
| Triagem por foto | Duas fotos (peça e etiqueta) | Tipo, estado, composição, marca, confiança | `ai/prompts/triage_v1.md` |

Os prompts são ficheiros versionados (`_v1`); mudar o comportamento é criar `_v2`. Cada corrida do "E se...?" guarda a pergunta, a alteração, o cenário e a versão do prompt, para ser auditável.

## O verificador de números

`ai/verify.py` recolhe todos os números da explicação (aceita vírgula ou ponto decimal e separador de milhares) e compara-os com os números dos factos. Se algum não existir nos factos, a explicação é rejeitada e gerada outra vez; à segunda falha, o ecrã mostra só a tabela de KPIs.

## "E se...?" passo a passo

1. O decisor escreve a pergunta; o modelo devolve o `ScenarioDelta` (freguesias e modos dentro das listas fechadas).
2. O ecrã mostra "Entendi: ..." para o decisor confirmar.
3. Só depois, o otimizador corre o cenário novo (rota síncrona em threadpool, com limite de tempo e sementes fixas).
4. O modelo escreve a explicação sobre o resultado, e o verificador valida-a.
5. Pergunta ambígua ou fora das listas: recusa explícita, em vez de adivinhar.

## Triagem sem guardar fotos

As fotos são enviadas ao modelo, processadas e descartadas: **não se guardam**. Ficam só tipo, estado, composição, marca e peso estimado, depois de o operador os confirmar ou corrigir. Nunca se guardam dados de quem entregou a peça. O peso estimado vem de uma tabela de pesos médios por tipo de peça (pressuposto, marcado como "estimativa"). As rotas de IA têm limite de pedidos.

## Testes

`tests/unit/test_verify.py` e `tests/unit/test_openrouter.py` cobrem o verificador e o cliente; `tests/api/test_whatif.py` e `tests/api/test_lots.py` cobrem as rotas com um adaptador falso.
