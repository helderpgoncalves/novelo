# Documentação do Novelo

O ponto de entrada do projeto é o [README](../README.md). Só Markdown, em pt-PT. Nomes de ficheiros em português, minúsculas e hífens. Se o comportamento, os números ou os comandos mudarem, o doc muda no mesmo commit.

## Projeto

| Documento | Para quê |
| --- | --- |
| [Visão geral](projeto/visao-geral.md) | A página pública do projeto: problema, resposta, produto com capturas, o que já está provado e próximo passo (pronta a colar na TAIKAI) |
| [Proposta](projeto/proposta.md) | Análise do desafio e proposta inicial |
| [Visualizações por página](projeto/visualizacoes-por-pagina.md) | Data storytelling: princípios, 2 a 4 visuais por página com dados e prioridade, a home em detalhe, reaproveitamento na app, no RAP e nos slides, e dependências em falta |

## Engenharia

| Documento | Para quê |
| --- | --- |
| [Arquitetura](engenharia/arquitetura.md) | Camadas, contrato OpenAPI, base de dados, autenticação, qualidade |
| [Funcionalidades](engenharia/features.md) | O que cada funcionalidade e cada ecrã faz, e o estado de implementação |
| [Dados e modelo](engenharia/dados-e-modelo.md) | Fórmulas, pressupostos e calibração |
| [IA](engenharia/ia.md) | OpenRouter, prompts versionados, verificador, triagem |
| [Copiloto](engenharia/copiloto.md) | Conversa em streaming, ferramentas, artefactos, ações, memória, persona, interface web, avaliação e limitações |
| [Avaliação do copiloto](engenharia/avaliacao-copiloto.md) | Resultado gerado por `just eval-copilot` (última corrida: 67 casos) |
| [Avaliação da triagem](engenharia/avaliacao-triagem.md) | Como medir a triagem por foto; ainda sem corrida |
| [Ambiente](engenharia/ambiente.md) | Variáveis `.env`, Resend e `EMAIL_TRANSPORT`, Google OAuth, OpenRouter, magic link, entrada por QR e limites de convidados |
| [Emails](engenharia/emails.md) | Envio e entrega dos emails: estados, códigos de erro, webhook do Resend, supressões, alertas e *runbook* «não recebi o email» |
| [Testes e verificação](engenharia/testes.md) | `just check-fast` / `check` / `e2e`, paralelismo, BD por worker, tempos medidos e como depurar testes lentos |
| [Seed de demonstração](engenharia/seed-demo.md) | Os 6 lotes com fotografias reais e os 7 cenários de demonstração: o que cria, o que é real e o que é pressuposto, como repetir e limpar |
| [Rotas por estrada](engenharia/rotas-reais.md) | OSRM próprio sobre o OpenStreetMap: arquitetura, fallback, serviço, variáveis, comandos, calibração do desvio e da velocidade, limitações |
| [Privacidade das fotografias](engenharia/privacidade-fotografias.md) | Miniatura opcional por peça: finalidade, o que se guarda, fluxo, base jurídica proposta, riscos, retenção, direitos, subcontratante, segurança e triagem de DPIA (avaliação técnica interna, não aconselhamento jurídico) |
| [Deploy](engenharia/deploy.md) | Coolify na VPS, domínio, variáveis que o compose repassa, deploy manual, operação |
| [Workflow com agentes](engenharia/workflow-ia.md) | Claude Code e GLM/Z.ai/ZCode a partilhar o mesmo contexto |
| [Backlog](engenharia/backlog.md) | O que está feito e o que falta, por dia |

## Dados

| Documento | Para quê |
| --- | --- |
| [Análise dos dados recebidos](dados/analise-dados-recebidos.md) | Fontes, qualidade, limites, onde cada dado se usa e as respostas da Vitrus de 21 e 22 out 2026 (sem contentores de têxteis; saco fora do compactador e viatura de têxtil nova; 5,86% sobre o indiferenciado do concelho; tratamento a 105,64 €/t) |
| [Análise dos contentores municipais](dados/analise-contentores-municipais.md) | Pacote QGIS de 20 out (não é de têxteis): campos, problemas e tratamento, cobertura, produtores, candidatos, CAOP 2019, como abrir no QGIS |

## Marca

| Documento | Para quê |
| --- | --- |
| [Guia de marca](marca/guia-de-marca.md) | Cores, tipografia, símbolo, construção do logótipo, `just brand` e `just check-brand` |
| [Linguagem dither](marca/linguagem-dither.md) | Pontos de meio-tom como imagem da marca: princípios, rampas, gerador e tabela de ativos |
| [Landing: direção](marca/landing-direcao.md) | Pesquisa de referências, direção, tipografia, hero, painel de entrada, checklist móvel e SEO ponta a ponta |
| [Descrição](marca/descricao.md) | Textos da página do projeto |

Para agentes de código: [AGENTS.md](../AGENTS.md) (fonte única) e [CLAUDE.md](../CLAUDE.md).
