---
name: llm-feature
description: Features de IA do Novelo via OpenRouter ("E se...?" com ScenarioDelta, triagem por foto, explicações verificadas, evals). Usar ao tocar em ai/, prompts ou adapters/openrouter.py.
---

# IA com rédea curta

- **Cliente:** `adapters/openrouter.py` (`OpenRouterClient.structured(system, user, schema)`); modelos em `LLM_MODEL_TEXT` / `LLM_MODEL_VISION` (slugs em openrouter.ai/models). Sem chave ⇒ `FeatureDisabledError` (503).
- **Saída estruturada sempre:** `ScenarioDelta`, `TriageResult` em Pydantic; temperatura 0; uma repetição se não validar.
- **O modelo não faz contas.** "E se...?": (1) modelo → `ScenarioDelta` com listas fechadas de freguesias/modos; (2) ecrã mostra "Entendi: …" para confirmar; (3) OR-Tools calcula; (4) modelo escreve a explicação a partir do JSON; (5) **verificador** rejeita qualquer número que não exista no JSON; 2ª falha ⇒ só tabela.
- **Triagem por foto = controlo de qualidade na entrega.** O problema da Vitrus é a contaminação (têxtil sujo ou molhado perde a reutilização); a foto confirma o estado no momento em que o saco é entregue.
- **Modos no "E se...?":** por omissão `existing` e `on_demand`; `street` (contentor de rua) só se o utilizador o pedir como referência. A Vitrus não quer contentores de têxtil.
- Pergunta ambígua ⇒ perguntar de volta. Fora das listas ⇒ recusa com sugestões.
- **Prompts** em `ai/prompts/` com versão (`whatif_v2.md`, `explain_v1.md`, `triage_v2.md`); a versão fica guardada em cada resposta.
- **Testes:** perguntas com delta esperado em `tests/api/test_whatif.py`, sempre com adaptador falso (sem chamar a API real). Detalhe em `docs/engenharia/ia.md`.
- **Custo e privacidade:** timeout, limite de pedidos por IP em `/whatif` e `/triage`, cache por pergunta+cenário; fotos apagadas após processar; só se guardam marca, composição, estado e peso.
- Testes com `httpx.MockTransport` (ver `tests/unit/test_openrouter.py`); nunca chamar a API real em testes.
