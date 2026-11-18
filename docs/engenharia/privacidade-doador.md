# RGPD da conta de doador: o que está implementado

Implementação do [ADR «RGPD da conta de doador»](adr/rgpd-conta-de-doador.md) (bilhete #66, 18 nov 2026):
política por finalidades com prazos por categoria, consentimento em duas camadas, 13 anos, retenção dos
logs de entrada, apagamento com as três proteções e exportação (portabilidade). Tudo o que aqui falta
remete para o ADR — este doc descreve o CÓMO, não o quê.

## Política de privacidade: uma fonte, tipada

A política vive num único sítio: `apps/api/src/novelo/features/privacy/policy.py` (`policy()` +
`POLICY_VERSION = "doadores-2026-11"`). É uma estrutura Pydantic de **finalidades × categorias ×
prazos**, exposta por `GET /api/v1/public/privacy-policy`, e a página pública `/politica-dados`
(web) desenha-a tal e qual — **não há segunda cópia** em TypeScript nem em Markdown. Mudou a
política: muda-se o módulo, sobe-se a versão, a página segue.

Finalidades cobertas (com a base legal do ADR): conta e entrada (`conta`), sacos (`sacos`), pedidos
de recolha (`pedidos`), pontos (`pontos`), triagem (`triagem`), logs de autenticação
(`logs_autenticacao`), marketing (`marketing`) e parcerias (`parcerias`). Os prazos publicados são os
que o código aplica — cada categoria traz `applied_by`, o apontador para onde o prazo vive no código
(documentação viva).

## Consentimento: duas camadas, registo append-only

- **Camadas**: `marketing` (comunicações da Vitrus) e `partnerships` (ofertas de parceiros) são
  finalidades distintas com decisões distintas — nunca um "aceito tudo" (granularidade do EDPB
  05/2020). O **soft opt-in nunca vale para parceiros** (CNPD DIRETRIZ/2022/1).
- **Por defeito tudo desligado**: zero partilha por defeito; o parceiro nunca recebe dados — só vê o
  código pseudónimo do resgate (#65).
- **Registo**: tabela `donor_consents` (migração `0027`), **append-only** — dar e retirar inserem uma
  linha nova (com `user_id`, `purpose`, `granted`, `policy_version`, `source` e `seq` global que
  desempata o `created_at` dentro da transação, como no livro de pontos). A história É a prova do
  art. 7.º/1 RGPD. Cada decisão passa também pela auditoria (`consent.grant` / `consent.withdraw`).
- **Endpoints**: `GET /cidadao/consents` (estado corrente das duas camadas) e `PUT /cidadao/consents`
  (uma decisão de cada vez), com papel `donor` como portão.
- **Web**: separador «Privacidade» na carteira `/cidadao` (toggles, ligação à política, exportação e
  apagamento).

## 13 anos

A idade declarada recusa a conta abaixo de 13 na criação (`age_below_minimum`, 422, com o número na
mensagem). O consentimento é **estruturalmente impossível** abaixo dos 13: as rotas de consentimento
exigem papel `donor` e o papel só nasce com a conta, e a conta não nasce abaixo de 13.

## Retenção dos logs de OTP/magic link: 12 meses, por JOB diário

Os `login_tokens` (magic link e quick join: `ip`, `user_agent`, propósito) são conservados **12
meses** (ADR; categoria própria na política).

**Mecanismo escolhido: job em loop no arranque da API** (`privacy/service.py::retention_loop`,
ligado no `lifespan` em `main.py`, atraso de 30 s, de 24 em 24 h — o mesmo padrão da purga das
miniaturas em `photo_store.purge_loop`).

**Porquê não purga à leitura** (o padrão das moradas de #60): os tokens nunca são listados nem lidos
em bloco — escrevem-se no pedido de entrada e consomem-se um a um na verificação; não existe caminho
de leitura onde a purga pudesse viver, por isso a purga à leitura nunca dispararia. O corte de 12
meses é calculado por `domain/privacy.py::retention_cutoff` (calendário puro, meses que clampam a
fins de mês curtos, testado com valores calculados à mão).

## Apagar a conta: as três proteções e depois o apagamento

1. **Pré-aviso obrigatório**: `GET /cidadao/account/delete-preview` devolve o saldo atual (livro de
   pontos, FIFO), a **linha do tempo FIFO** (quanto expira em cada data futura — derivada SEMPRE de
   `domain.points.fifo_balance`, em `domain/privacy.py::expiry_timeline`, nunca recalculada à parte)
   e as contagens do que se perde. O web junta o texto.
2. **Resgatar antes**: enquanto a conta existir, o saldo continua utilizável; o ecrã de apagar mostra
   o saldo e liga ao saldo (a entrada do resgate chega com o #65). O pré-aviso é carregado só dentro
   da folha de confirmação.
3. **«Pontos não são dinheiro nem conversíveis»**: escrito no ecrã e devolvido pela API
   (`points_are_not_money`).

O apagamento em si (`POST /cidadao/account/delete`, corpo com o **email da conta escrito à mão**,
comparação em tempo constante):

- linha da `users` **apagada** — as FKs fazem o resto: SET NULL em sacos, livro de pontos, pedidos e
  consentimentos (os **agregados sobrevivem**, art. 17.º/3/d com 89.º/1); CASCADE em sessões, tokens,
  copiloto e afins;
- dados pessoais de nível inferior purgados à mão: **apelidos dos sacos** a nulo (texto livre) e
  **moradas dos pedidos a nulo JÁ** (não esperam os 12 meses; fica a freguesia);
- emails transacionais e convites do email apagados; impersonações terminadas;
- auditoria lavrada primeiro (`account.delete_self` com factos sem email) e depois **esfregada**
  (`audit.scrub_user`: sem email do alvo, sem IP/dispositivo do próprio) — o facto fica, a pessoa não;
- o email da conta fica livre para uma nova conta (sem lápide que o bloqueie).

O apagamento por administradores (`DELETE /users/{id}`, já existente) mantém-se para contas de
equipa; o de doador é self-service e não passa por ele.

## Exportação (portabilidade, art. 20.º)

`GET /cidadao/account/export` devolve JSON legível por máquina com `Content-Disposition:
attachment`: perfil (email, nome, `donor_code`, idade declarada), consentimentos (histórico
completo), sacos, pedidos de recolha (com a morada — é dado do próprio) e o livro de pontos
completo. **Nunca inclui derivados** (calibração, confirmações de conformidade, pontuações) —
WP29 242 rev.01, p. 10. O web transforma em ficheiro descarregável.

## A morada nunca passa ao planeamento (costura de regressão)

O planeamento lê **só** a tabela `calibration_aggregates` (#62); os eventos (pedidos com morada) só
são lidos na recomputação dos agregados, que não guarda morada. Dois testes de regressão
(`tests/api/test_privacy.py`) fecham a costura com um marcador impossível de colidir:

- `test_request_address_never_reaches_calibration_aggregates` — recálculo com um pedido com morada
  marcadora; nenhum agregado contém a morada;
- `test_request_address_never_reaches_a_computed_scenario` — cenário calculado por API com o pedido
  marcador; a morada não aparece em lado nenhum da resposta.

## Testes

- **Puro**: `tests/unit/test_privacy.py` — corte de retenção (clamp de meses) e linha do tempo FIFO,
  valores calculados à mão.
- **API**: `tests/api/test_privacy.py` — política pública estruturada (finalidades × categorias ×
  prazos), consentimento granular e auditável (append-only + auditoria), portais de papel, 13+,
  exportação, pré-aviso, apagamento (anónima com agregados vivos), reutilização do email, purga de
  logs de entrada e as costuras da morada.
