# Triagem pré-recolha

A Vitrus propôs depois do hackathon (novembro de 2026) mover a triagem para **antes da recolha**:
a peça é avaliada quando o saco ainda está em casa (ou à porta), não apenas na entrega.
Este doc analisa as duas superfícies possíveis, decide a solução e fixa o desenho técnico.

## O problema que resolve

A triagem atual é **controlo de qualidade na entrega**: o operador fotografa a peça já no ponto de
entrega (`POST /api/v1/triage`, prompt `triage_v3`), a peça entra num lote e o fluxo segue para o
passaporte, a bolsa de fibra e a evidência RAP. Chegar atrasada tem três custos:

1. **Contaminação.** O medo n.º 1 da Vitrus (21 out 2026): têxtil sujo ou molhado estraga a
   reutilização — e um saco contaminado pode estragar os outros. Hoje **14,1% do recolhido é
   rejeito** (42,34 t em 2025): viajou na viatura para ser separado no fim.
2. **Custo de recolha sem valor.** Cada tonelada de rejeito recolhida ocupa a viatura, mão de obra
   e tempo de rota sem devolver nada (a reciclagem custa mais que a fibra virgem; o valor está na
   reutilização).
3. **Previsão.** A composição da ronda só se conhece depois da entrega; o planeamento trabalha com
   taxas de captura por pressuposto.

Pré-recolha dá resposta aos três: a peça é avaliada **antes** de entrar no saco (ou da viatura), o
rejeito fica em casa (indo para o indiferenciado) e cada veredicto é um sinal anónimo e agregado
para prever a composição da ronda.

## Decisão: aconselhar, não condicionar

O veredicto é um **conselho** («vai no saco» / «não vai»), não uma condição de recolha. Ninguém
precisa de autorização para pôr um saco à porta; a recolha não recusa nada. Isto evita atrito com o
cidadão, evita criar um fluxo de exceção na operação e é coerente com o produto: o Novelo aconselha
com números, não bloqueia.

Alternativas consideradas e postas de lado:

- **Condicionar a recolha** (só sacos pré-verificados, QR de verificação colado no saco): mais
  garantia, mas exige logística de sacos marcados, pune quem não tem telemóvel e cria contestação
  à porta («porque não levaram o meu saco?»). A avaliar só se a pilotagem mostrar abuso.
- **Foto da etiqueta** (como na triagem atual): a decisão pré-recolha depende do **estado** da peça
  (limpa/seca vs. suja/molhada), não da composição. Uma foto só é mais barata e mais rápida; a
  composição continua a virar da triagem na entrega.
- **Canal WhatsApp/SMS**: onde os cidadãos já estão, mas acoplado a um fornecedor e com fotos sem
  controlo de tamanho. A página pública mobile-first chega lá pelo QR no saco ou no calendário.

## Um módulo, duas superfícies

A análise de quem fotografa — o cidadão em casa ou o operador à porta — não é uma escolha exclusiva:
as duas superfícies chamam **o mesmo módulo**. A diferença está no alcance, no custo e no sinal que
cada uma dá.

| | A. Cidadão em casa | B. Operador à porta |
| --- | --- | --- |
| Quando | ao preparar o saco, antes de o pôr à porta | na ronda, antes de carregar |
| Alcance | toda a população, 24/7, sem custo operacional | só as rondas, com tempo de rota limitado |
| Garantia | nenhuma (aconselha; o rejeito pode ainda ir para o saco) | o rejeito fica mesmo em casa |
| Educação | no momento exato da decisão (o saco) | nenhuma; o problema repete-se na ronda seguinte |
| Atrito | nenhum para a Vitrus; o cidadão fotografar é opcional | abranda a ronda (realista só para sacos suspeitos, não peça a peça) |
| Dados | agregado anónimo; freguesia facultativa e de má qualidade | autenticado; freguesia da ronda, fiável |
| Custo por veredicto | chamada ao modelo de visão (uma foto, sem etiqueta) | o mesmo |

**Decisão:** fase 1 constrói a superfície **A** (página pública «Vai no saco?»); a superfície **B**
(modo ronda do operador) chega na fase 2 sobre o mesmo endpoint, quando houver rondas reais — é lá
que o sinal para o planeamento ganha qualidade (freguesia verdadeira, autenticado, com registo
agregado por freguesia e o KPI «rejeito que não entrou na viatura»).

## Desenho técnico

Interface nova, implementação reutilizada a ~80% da triagem atual. O modelo de visão devolve JSON
validado por Pydantic e **nunca números** (não há números para devolver: só a decisão e o motivo).

```
POST /api/v1/public/pre-collection/check      (sem sessão; rate limit por IP)
  → multipart: photo (JPEG/PNG/WebP ≤ 5 MB), locale (pt-PT | en)
  ← PreCollectionAdvice {
      decision: in_bag | keep_out,   // a resposta de negócio, já derivada
      condition: reuse | recycle | reject,   // a evidência (vocabulário existente)
      reason: str,                    // uma frase curta, no idioma pedido
      confidence: 0–1,
      prompt_version, model           // preenchidos pelo servidor
    }
```

- **Feature nova `pre_collection`** na API (`features/pre_collection/`), com router, schemas e
  serviço finos; a lógica de chamar o modelo segue o padrão de `features/lots/triage.py` (foto só em
  memória, `shrink_for_vision`, `sniff_mime`, uma repetição se o JSON não validar).
- **Prompt versionado** `ai/prompts/precheck_v1.md`: estado da peça sobre a lista fechada
  `reuse/recycle/reject`, motivo numa frase, sem composição, sem marca, sem peso. Neutro em relação
  ao concelho (a regra do saco entra como texto; quando o perfil de concelho existir, vem dele).
- **Tarefa `AiTask.PRECHECK`** com modelo e limites próprios no painel `/admin/ai`, contabilidade
  separada da triagem na entrega (tokens típicos abaixo de `TRIAGE`: uma foto, sem etiqueta).
- **Limites:** `precheck_limiter` por IP (mais apertado que `triage`: uso público sem sessão). Sem
  `OPENROUTER_API_KEY` a rota responde 503, como as restantes features de IA.
- **RGPD:** igual à triagem — a foto vive só em memória durante o pedido, nunca é guardada, não se
  guarda IP nem identificador; a resposta não contém dados pessoais
  ([privacidade-fotografias](privacidade-fotografias.md)). A fase 1 não escreve nada na base de dados.
- **Web:** rota pública `/bag-check` («Vai no saco?»), mobile-first, sem sessão, reutiliza o `photo-input` e os
  estados obrigatórios (a carregar, vazio, erro, 503 sem chave). Ligada a partir do rodapé da landing. O QR do
  saco e o calendário `.ics` da Frota passam a apontar aqui (fase 2, com a Vitrus).
- **i18n** pt-PT/en; números nenhum (não há números nesta feature — só o veredicto).

## Fases

| Fase | Entrega | Estado |
| --- | --- | --- |
| 1 | Módulo + endpoint público + página «Vai no saco?» + limites + testes com adaptador falso | Feito (4 nov 2026) |
| 2 | Superfície do operador na ronda (mesmo endpoint autenticado), registo agregado anónimo por freguesia, KPI «rejeito evitado», QR no saco e no `.ics` | Proposto |
| 3 | Contadores do lado do cidadão para previsão de composição; produtores B2B (hotéis, escolas com campanha) | Hipótese |

A avaliação com verdadeiro-terreno (`just eval-triage`, já em falta no
[backlog](backlog.md) para a triagem atual) é alargada ao precheck quando houver 30 ou mais peças
fotografadas no piloto.

## Notas de multi-município

O prompt e os textos desta feature nascem **neutros em relação ao concelho**: a regra do saco
(o que entra e o que não entra) é texto de configuração, não código. Quando a fase 1 do
multi-município (perfil de concelho) existir, a regra passa a vir do perfil — em Guimarães, a regra
é a da Vitrus; noutro concelho, a do operador local.
