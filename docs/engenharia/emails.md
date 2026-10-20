# Emails: envio, entrega e diagnóstico

Objetivo: **ninguém fica à espera de um email que nunca saiu**, e o administrador sabe sempre se cada email foi enviado, entregue ou falhou. O fornecedor é o [Resend](https://resend.com); as variáveis estão em [Ambiente](ambiente.md#resend-email).

## O que sabemos de cada email

Cada envio fica registado em `email_deliveries` (**só metadados**: destinatário, modelo, estado, código de erro, tentativas e datas; nunca o assunto, o corpo, links nem tokens). Estados:

| Estado | Significado |
| --- | --- |
| `queued` | Registado, ainda não tentado (ou o processo caiu a meio) |
| `sent` | **O Resend aceitou o email.** Não quer dizer que chegou à caixa de correio |
| `delivered` | O servidor de destino aceitou (confirmado pelo webhook ou pela chave de leitura) |
| `delayed` | O Resend ainda está a tentar entregar (`email.delivery_delayed`) |
| `bounced` | Devolvido. Se for permanente, o endereço entra na lista de supressão |
| `complained` | O destinatário marcou como spam. O endereço entra na lista de supressão |
| `failed` | Não saiu: ver `error_code` |
| `skipped` | Não se tentou de propósito: destinatário suprimido (`suppressed_*`) ou sem administradores (`no_recipients`) |

Um estado só avança (`delivered` nunca volta a `sent`) e os eventos repetidos são ignorados.

### Quanto sabemos depende do que está configurado (`delivery_tracking`)

| Valor | Configuração | Estado máximo |
| --- | --- | --- |
| `provider_accepted_only` | só `RESEND_API_KEY` | `sent` |
| `webhook` | + `RESEND_WEBHOOK_SECRET` | `delivered`, `bounced`, `complained`... |
| `api` | + `RESEND_READ_API_KEY` | idem, por consulta |
| `api+webhook` | os dois | idem, com o webhook como caminho principal |

### Códigos de erro (`error_code`)

| Código | Causa | Repete? | O que fazer |
| --- | --- | --- | --- |
| `timeout`, `network` | O Resend não respondeu em 4 s / falha de rede | sim | Normalmente passa sozinho |
| `provider_down` | Resend com erro 5xx | sim | Ver [status.resend.com](https://status.resend.com) |
| `rate_limited` | 429; respeita `Retry-After` | sim | Reduzir o ritmo |
| `quota_exceeded` | Quota diária/mensal esgotada | não | Subir o plano no Resend |
| `provider_auth` | Chave `RESEND_API_KEY` inválida ou sem permissão | não | Gerar nova chave e atualizar no Coolify |
| `domain_not_verified` | Domínio do `EMAIL_FROM` não verificado | não | Verificar o domínio no Resend (DNS abaixo) |
| `invalid_recipient` | Endereço de destino inválido | não | Corrigir o email da pessoa |
| `provider_4xx` | Outro erro do pedido | não | Ver o log da API (`request_id`) |
| `not_configured` | Sem chave do Resend (ou `EMAIL_TRANSPORT=log` em produção) | não | Definir `RESEND_API_KEY` |
| `circuit_open` | O disjuntor está aberto (ver abaixo) | não | Esperar 30 s; ver a causa nos erros anteriores |
| `suppressed_bounced`, `suppressed_complained`, `suppressed_manual` | Destinatário na lista de supressão | não | Remover a supressão se for engano |
| `bounced_permanent`, `bounced_transient`, `complained`, `failed` | Vindos do webhook | n/a | Ver o email no Resend |
| `unexpected` | Erro inesperado no envio | não | Ver o log |
| `no_recipients` | (`skipped`) Não há administradores ativos com email | n/a | Criar/ativar um administrador |

## Arquitetura

- `adapters/email.py`: `ResendSender.send()` devolve o id do fornecedor e levanta `EmailSendError(error_code, transient)`; envia `Idempotency-Key`, `X-Entity-Ref-ID` e `reply_to`. `ResendReader` consulta `GET /emails/{id}` com a chave de leitura. `LogSender` (dev) e `UnavailableSender` (produção sem chave).
- `features/email_log/service.py`: **`deliver()` é o único ponto de envio.** Regista, tenta até 3 vezes em cerca de 12 s (backoff exponencial com *jitter*, respeita `Retry-After`) só para erros transitórios, usa a mesma chave de idempotência em todas as tentativas (um reenvio de rede nunca duplica o email), respeita a lista de supressão e passa por um **disjuntor em memória** (5 falhas seguidas do fornecedor abrem-no 30 s; um erro de destinatário não conta). Nunca levanta exceções de envio: a falha fica no registo e nos logs (destinatário mascarado `l***@dominio.pt`, com o `request_id`). Com `strict=True` (pedidos do próprio utilizador) levanta `503 email_unavailable` ou `409 email_suppressed`.
- `features/email_log/monitor.py`: lista, resumo, alertas, reconciliação e supressões. `webhook.py`: assinatura Svix. `dns_health.py`: verificação de DNS.
- `features/auth/entry.py`: o que sai para **cada estado** do email introduzido no login ou na recuperação de palavra-passe (o cliente recebe sempre 204):

| Estado do email | O que sai |
| --- | --- |
| Conta ativa (aprovada ou por aprovar) | Link de entrada (ou de recuperação) |
| Conta desativada ou recusada | Aviso curto, sem link: «fala com o administrador» |
| Sem conta, convite por aceitar (pendente ou expirado) | O convite de novo, com token novo (o anterior deixa de valer). Máximo 1 a cada 5 min e 5 por dia por convite. Auditoria `invitation.self_resend` |
| Sem conta, convite revogado/aceite ou email desconhecido | Email neutro «não encontrámos uma conta» com ligação para criar conta (ou pedir acesso, se o registo estiver fechado). 1 por destinatário a cada 30 min e `EMAIL_NOT_FOUND_PER_HOUR` por hora no total |

Se o envio falhar, **todos** os casos respondem `503 email_unavailable` (não revela se a conta existe). Se o reenvio do convite falhar, o token anterior é reposto.

### Registo e aprovação

Quem se regista (palavra-passe ou Google) fica `approval_status=pending` e recebe «recebemos o teu pedido»; os administradores recebem o aviso de contas por aprovar (no máximo 1 a cada 10 min, contado na base de dados). Convites e QR do evento nascem aprovados e **não** recebem este email. Se o registo não puder sequer ser avisado (sem fornecedor em produção) responde `503 email_unavailable` e não cria a conta. Aprovar/recusar devolve `email_warning` se o email da decisão não saiu (a ação fica feita). As listas de contas trazem `approval_email` (estado do email de pedido/decisão). **Lembrete:** se há contas pendentes há mais de 24 h, o primeiro pedido de administrador (`GET /auth/me`, `GET /users/summary`) envia um resumo aos administradores, no máximo 1 por 24 h (bloqueio na base de dados, sem *scheduler*).

### Supressões

`email_suppressions` guarda os endereços que não recebem emails: ressalto **permanente** e queixa de spam (via webhook) ou bloqueio manual do administrador. Atrasos e ressaltos transitórios não suprimem. Antes de enviar, `deliver()` consulta a lista: não envia, regista `skipped` com `suppressed_*` e o fluxo mostra o motivo (`email_suppressed`, ou `email_warning` nas ações do administrador). Remover a supressão: `DELETE /users/emails/suppressions/{id}`.

### Alertas (banner no UI e email ao administrador mais antigo, no máximo 1 a cada 6 h)

`provider_not_configured`, `provider_auth_invalid`, `domain_not_verified`, `failures_last_hour` (3 ou mais), `high_failure_rate` (> 20 % com pelo menos 5 envios na última hora), `webhook_silent` (webhook configurado sem eventos há 24 h com envios recentes) e `no_admin_recipients`. Estão em `GET /users/emails/summary` e o número em `GET /auth/me` (`email_alerts`). `GET /ready` traz `email`: `ok`, `not_configured` ou `failing`.

## O que a pessoa e o administrador veem (web)

- **«Verifica o teu email»** (link de entrada e recuperar palavra-passe): diz o que pedimos (nunca que chegou), reenvio com contagem de 30 s e a dica do convite. `503 email_unavailable` troca-o por um ecrã de problema com tentar de novo, Google, palavra-passe e suporte; `409 email_suppressed` tem mensagem própria; `429` bloqueia o botão outra vez.
- **Pendente de aprovação:** consulta `GET /auth/approval-status` a cada 20 s (e ao voltar ao separador) até haver decisão; mostra o estado do email de confirmação (`confirmation_email`) e, se não saiu, «Reenviar email».
- **Utilizadores → Convites:** coluna de entrega por convite, «Copiar link do convite» (link novo copiado uma vez, o anterior deixa de valer) e «Ver emails deste convite». Convidar mostra o estado real do envio.
- **Utilizadores → Contas:** `approval_email` por pessoa e, se aprovar/recusar não avisou, o aviso com «Reenviar email».
- **Utilizadores → Auditoria → Emails** (`?tab=audit&view=emails`): alertas com a correção, o que sabemos de cada envio, DNS, tabela de envios e endereços bloqueados. Um banner discreto em toda a app avisa os administradores quando `email_alerts > 0`.

## Configurar a entrega verificada (3 opções)

### 1. Webhook (recomendado; funciona com a chave de envio)

1. Resend → **Webhooks** → *Add Webhook* → **Endpoint** `https://novelo.helder.si/api/v1/webhooks/resend`.
2. Eventos: `email.sent`, `email.delivered`, `email.delivery_delayed`, `email.bounced`, `email.complained`, `email.failed`.
3. Copiar o *Signing Secret* (`whsec_...`) e pô-lo no Coolify como `RESEND_WEBHOOK_SECRET` (Environment Variables da aplicação, **segredo**); fazer *Redeploy*.
4. Verificar: administrador → **Utilizadores → Auditoria → Emails → Enviar email de teste**; o estado passa de `sent` a `delivered` em segundos. Sem o segredo o endpoint responde 503 e fica desativado.

O endpoint verifica a assinatura Svix (`svix-id`, `svix-timestamp`, `svix-signature`) sobre o corpo bruto, com tolerância de 5 min e comparação de tempo constante; limita o corpo a 64 KB e os pedidos por IP; é idempotente e ignora eventos e ids desconhecidos (responde 200). Não precisa de sessão: a assinatura é a autenticação.

### 2. Chave de leitura (opcional)

A chave de envio é **restrita a envio** (401 em `GET /emails`). Para consultar o estado crie outra chave com **acesso total** e ponha-a em `RESEND_READ_API_KEY`. Com ela, ao abrir a lista/resumo (cache de 60 s, até 20 consultas, concorrência 3, timeout curto) e no botão **Atualizar estado** (`POST /users/emails/refresh`), os envios em `sent`/`delayed` com menos de 72 h são sincronizados com `GET https://api.resend.com/emails/{id}`. Erros são ignorados (só log). **Riscos:** uma chave de acesso total também apaga domínios, chaves e emails; guarde-a só no Coolify, nunca no código, em logs ou no browser, rode-a se houver suspeita de fuga e prefira o webhook sempre que possível. Nunca é usada para enviar.

### 3. Painel do Resend

[resend.com/emails](https://resend.com/emails) mostra cada envio e o seu evento. No Novelo, `provider_message_id` (na lista de emails) é o id a procurar. É o recurso manual quando não há webhook nem chave.

## DNS do remetente

`GET /users/emails/health` (cache de 10 min, consulta por DoH da Cloudflare) verifica o domínio do `EMAIL_FROM`: DKIM `resend._domainkey`, SPF em `send.<domínio>` (com `amazonses.com`), MX `send.<domínio>` (retorno) e DMARC `_dmarc` (aviso se `p=none`). Cada verificação diz `ok`, `warn`, `fail` ou `unknown` e o que adicionar.

## Verificar depois de cada deploy

```
NOVELO_URL=https://novelo.helder.si SMOKE_COOKIE='access_token=...; refresh_token=...' python scripts/smoke_email.py
```

Usa a API (nunca o Resend): confere `/ready`, o resumo, o DNS, envia um email de teste ao administrador e espera pelo estado final. Sai com 0 (tudo bem), 1 (email falhou ou alerta crítico) ou 2 (API inacessível). Em dev pode usar `SMOKE_ADMIN_EMAIL` e `SMOKE_ADMIN_PASSWORD`; em produção o login exige Turnstile, por isso usa `SMOKE_COOKIE`.

## Runbook: «um utilizador diz que não recebeu o email»

1. **Pedir o email exato** com que tentou. Em **Utilizadores → Auditoria → Emails** (ou «Ver emails deste convite», na linha do convite) pesquisar por esse endereço (`GET /users/emails?q=`).
2. **Não há registo nenhum?** O pedido nem chegou ao envio: verificar `GET /ready` (`email`) e o banner de alertas. Pode ter escrito o email errado ou ter sido travado pelos limites (3 por 10 min por email; neutro 1 a cada 30 min; convite 1 a cada 5 min).
3. Ver o **estado**:
   - `failed`: ler o `error_code` (tabela acima) e agir (chave, domínio, destinatário). Depois reenviar (convite: *Reenviar*; conta: *Reenviar email*; ou pedir ao utilizador para repetir).
   - `skipped` `suppressed_*`: o endereço foi devolvido ou marcado como spam. Confirmar com a pessoa e, se for engano, remover a supressão.
   - `sent` há mais de 15 min (e há webhook): sem confirmação. Ver o evento em [resend.com/emails](https://resend.com/emails) (id em `provider_message_id`) ou carregar em **Atualizar estado**.
   - `delivered`: chegou ao servidor de destino. Pedir para verificar o spam/promoções e se a caixa aceita o remetente `EMAIL_FROM`.
   - `bounced`: o servidor de destino recusou (caixa inexistente ou cheia). Corrigir o endereço.
4. **Convite que falhou:** em Convites, *Copiar link* (`POST /users/invitations/{id}/link`) e enviar por outro canal; o link é mostrado uma só vez e o anterior deixa de valer.
5. **Saída para a pessoa em qualquer fluxo:** entrar com Google ou palavra-passe, ou escrever para o suporte (`EMAIL_SUPPORT`).
6. Se vários emails falham ao mesmo tempo: ver o banner de alertas, o DNS (`/users/emails/health`), o [estado do Resend](https://status.resend.com) e **Enviar teste**.

## Privacidade

`email_deliveries` guarda o email do destinatário e metadados; **nunca** assunto, corpo, links nem tokens. Os logs mascaram o endereço (`l***@dominio.pt`). Eliminar uma conta apaga os seus registos de envio (a supressão mantém-se por segurança). As ações de administração (copiar link, bloquear/desbloquear, teste, reenvios) ficam na auditoria.
