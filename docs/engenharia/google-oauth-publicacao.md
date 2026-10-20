# Publicar o login Google (ecrã de consentimento OAuth)

Checklist para pôr o "Entrar com o Google" do Novelo **Em produção** na Google Cloud Console. O código já cumpre o que depende dele; o que só pode ser feito na consola está marcado com **[Consola]**, o que é DNS com **[DNS]**. Nunca pôr segredos neste documento (o `GOOGLE_CLIENT_ID` e o `GOOGLE_CLIENT_SECRET` vivem no Coolify, ver `ambiente.md`).

## O que o projeto já tem

| Exigência da Google | Onde está |
| --- | --- |
| Página inicial pública, sem login, no domínio verificado | `https://novelo.helder.si/` (visitantes veem a página inicial; `apps/web/src/features/landing/`) |
| Ligação à Política de Privacidade na página inicial | Rodapé da página inicial, do login e do registo, sempre visível |
| Política de Privacidade completa, com dados Google e Uso Limitado | `https://novelo.helder.si/pt/privacy` e `/en/privacy` (texto em `apps/web/src/features/legal/content.ts`) |
| Termos de Utilização | `https://novelo.helder.si/pt/terms` e `/en/terms` |
| Botão e consentimento conforme as diretrizes de marca | `apps/web/src/features/auth/google-button.tsx` ("G" oficial, 40 px, claro/escuro, texto de consentimento com ligações) |
| Âmbitos mínimos | `openid email profile` (`apps/api/src/novelo/features/auth/google.py`) |
| `robots.txt`, `sitemap.xml`, `lang`, título, descrição e Open Graph | `apps/web/public/` e `apps/web/index.html` |

Declaração de Uso Limitado (já na política, secção 4): «O uso e a transferência para qualquer outra aplicação de informações recebidas das APIs da Google respeitarão a Política de Dados do Utilizador dos Serviços de API da Google, incluindo os requisitos de Uso Limitado.» Em inglês: "Novelo's use and transfer to any other app of information received from Google APIs will adhere to Google API Services User Data Policy, including the Limited Use requirements."

## Passo a passo

### 1. Verificar o domínio no Google Search Console **[Consola] [DNS]**

A Google só aceita links de domínios que a conta do projeto verificou.

1. Abrir <https://search.google.com/search-console> com a conta Google que é **proprietária** do projeto na Cloud Console (tem de ser a mesma, ou uma com papel de Proprietário/Editor do projeto).
2. "Adicionar propriedade" e escolher **Domínio** (não "Prefixo do URL"). Escrever `helder.si`; isto cobre `novelo.helder.si` e qualquer subdomínio.
3. O Search Console mostra um registo **TXT** do tipo `google-site-verification=...` (valor próprio, copiar dali).
4. Na Cloudflare: DNS de `helder.si` > Adicionar registo > Tipo `TXT`, Nome `@`, Conteúdo o valor copiado, **Proxy não se aplica a TXT**. Guardar.
5. Voltar ao Search Console e carregar em "Verificar". Costuma ser imediato; se falhar, esperar alguns minutos (até 48 h em casos raros) e repetir. **Não apagar o registo TXT depois**: a Google volta a conferi-lo.
6. Repetir para `heldergoncalves.io` (domínio do email de suporte e do remetente), com o seu próprio TXT na zona DNS desse domínio. Se esse domínio for gerido noutro sítio, o registo vai para lá.

### 2. Ecrã de consentimento OAuth **[Consola]**

Cloud Console > APIs e serviços > **Ecrã de consentimento OAuth** (ou "Google Auth Platform" > Branding / Audience / Data access, consoante a versão da consola).

| Campo | Valor |
| --- | --- |
| Tipo de utilizador (Audience) | **Externo** |
| Nome da aplicação | `Novelo` (tem de coincidir com o nome na página inicial) |
| Email de suporte do utilizador | `novelo@heldergoncalves.io` |
| Logótipo | **120×120 px**, PNG quadrado, até 1 MB. Usar `brand/avatar/novelo-avatar-claro-512.png` redimensionado para 120×120 (ou carregar o 512×512: a Google aceita de 120 a 1000 px, quadrado). Não usar o logótipo horizontal |
| Página inicial da aplicação | `https://novelo.helder.si` |
| Ligação da política de privacidade | `https://novelo.helder.si/pt/privacy` |
| Ligação dos termos de serviço | `https://novelo.helder.si/pt/terms` |
| Domínios autorizados | `helder.si` e `heldergoncalves.io` (sem `https://` nem caminhos; têm de estar verificados no passo 1) |
| Contacto do programador (email) | `novelo@heldergoncalves.io` |

Notas: a página inicial e as duas ligações têm de estar no mesmo domínio verificado, acessíveis sem login e sem redirecionar para um ecrã de entrada. É o caso: `/` mostra a página inicial a quem não tem sessão. Podes dar as versões em inglês (`/en/...`) se a consola pedir inglês; ambas existem.

### 3. Âmbitos (Data access) **[Consola]**

Adicionar **só** `openid`, `.../auth/userinfo.email` e `.../auth/userinfo.profile`. São âmbitos **não sensíveis**: não exigem a verificação pesada (a de âmbitos sensíveis ou restritos, com segurança de terceiros). **Não adicionar mais nenhum**; qualquer âmbito extra muda o tipo de verificação e obriga a rever a política.

### 4. Credenciais OAuth (cliente Web) **[Consola]**

APIs e serviços > Credenciais > o ID de cliente OAuth do tipo "Aplicação Web":

- **Origens JavaScript autorizadas:** `https://novelo.helder.si`. (O login é por redirecionamento no servidor e não usa a biblioteca JS da Google, mas é boa prática ter a origem declarada. Para desenvolvimento local acrescentar `http://localhost:3190`, num cliente à parte de preferência.)
- **URIs de redirecionamento autorizados** (exatos, com o caminho; um carácter a mais ou a menos dá `redirect_uri_mismatch`):
  - `https://novelo.helder.si/api/v1/auth/google/callback`
  - desenvolvimento: `http://localhost:3190/api/v1/auth/google/callback`

  O caminho vem de `Settings.google_redirect_uri` (`APP_URL` + `/api/v1/auth/google/callback`); em produção `APP_URL` tem de ser `https://novelo.helder.si`.
- As chaves ficam em `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` no Coolify; nunca no Git.

### 5. Publicar a aplicação **[Consola]**

1. No ecrã de consentimento, "Estado da publicação" > **Publicar aplicação** > confirmar para passar de "Em teste" a **Em produção**. Em teste, só os utilizadores de teste entram e os tokens expiram em 7 dias.
2. Com âmbitos não sensíveis, a aplicação fica em produção logo. A Google pode mesmo assim pedir **verificação de marca** (confirma que o nome, o logótipo e as ligações são verdadeiros): mostra o aviso "verificação necessária" na consola e envia emails para o contacto do programador. Até ser aprovada, o utilizador pode ver o aviso "app não verificada" ou um limite de utilizadores novos; **não é bloqueante** para âmbitos básicos.
3. Responder aos emails da Google no mesmo dia, a partir de `novelo@heldergoncalves.io` (é a caixa que a Google usa).

### 6. Se a Google pedir um vídeo **[Consola]**

Normalmente só pedem vídeo para âmbitos sensíveis ou restritos, por isso não é esperado. Se pedirem, gravar (YouTube, "não listado") um ecrã contínuo de 1 a 2 minutos que mostre: o URL `https://novelo.helder.si` na barra; o clique em "Entrar com o Google"; o **ecrã de consentimento da Google com o nome e o ID de cliente visíveis**; a volta ao Novelo já com sessão e o nome/foto no canto; e a Política de Privacidade (secção 4) a ser aberta a partir do rodapé. Dizer em voz ou legenda que se usam só email, nome e foto para criar a conta e iniciar sessão. Ligar o URL do vídeo no pedido.

## Prazos (indicativos)

| Passo | Tempo habitual |
| --- | --- |
| Registo TXT e verificação do domínio | minutos; até 48 h em casos raros |
| Passar a "Em produção" | imediato |
| Verificação de marca (se pedida) | 2 a 3 dias úteis, por vezes até 1 a 2 semanas |
| Verificação de âmbitos sensíveis (não é o nosso caso) | 3 a 5 dias úteis a várias semanas |

São estimativas da experiência corrente com a Google, não prazos garantidos.

## Antes de carregar em "Publicar": verificação rápida

1. Abrir `https://novelo.helder.si` numa janela anónima: aparece a página inicial, sem pedir login, com "Privacidade" e "Termos" no rodapé.
2. `https://novelo.helder.si/pt/privacy` e `/pt/terms` abrem sem login; `https://novelo.helder.si/robots.txt` e `/sitemap.xml` respondem.
3. "Entrar com o Google" mostra o ecrã de consentimento com o nome **Novelo** e o logótipo, e volta à aplicação.
4. Os dados que a política declara (secção 2 e 6) continuam a ser os que o código recolhe e os subprocessadores reais. Se mudar o fornecedor de email, de IA ou de alojamento, atualizar `apps/web/src/features/legal/content.ts` **no mesmo commit**.

## Pontos a confirmar pela equipa

- Prazos de retenção dos registos de auditoria (IP e user-agent): a política diz "o tempo necessário para a segurança", sem número; definir um prazo e atualizar a secção 5 se se quiser ser mais preciso.
- Que o servidor está mesmo na Hetzner na UE (a política declara-o) e que o Resend tem o DPA aceite.
- O endereço `novelo@heldergoncalves.io` recebe e é lido (é o contacto de privacidade, de suporte e do programador).
