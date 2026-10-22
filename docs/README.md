# Documentação do Novelo

O ponto de entrada do projeto é o [README](../README.md). Só Markdown, em pt-PT. Nomes de ficheiros em português, minúsculas e hífens. Se o comportamento, os números ou os comandos mudarem, o doc muda no mesmo commit.

## Projeto

| Documento | Para quê |
| --- | --- |
| [Visão geral](projeto/visao-geral.md) | A página pública do projeto: problema, resposta, produto com capturas, critérios do júri e próximo passo (pronta a colar na TAIKAI) |
| [Proposta](projeto/proposta.md) | Análise do desafio e proposta inicial |
| [Estratégia para ganhar](projeto/estrategia-para-ganhar.md) | Documento mestre: resumo executivo, decisores, arquitetura da prova, calendário 19 a 28 out, checklist, riscos e métricas |
| [Critérios de avaliação](projeto/criterios-de-avaliacao.md) | Os 4 critérios e pesos do hackathon, a matriz critério → prova e o que falta ler nas Regras |
| [Visualizações por página](projeto/visualizacoes-por-pagina.md) | Data storytelling: princípios, 2 a 4 visuais por página com dados e prioridade, a home em detalhe, reaproveitamento na app, no RAP e nos slides, e dependências em falta |
| [Mentores](projeto/mentores.md) | Lucas Nascimento (Vitrus), Luís Miguel Oliveira (Fibrenamics) e Prof. Paulo Afonso (UMinho): perfis, abordagem e mensagens-tipo. A lista de perguntas atualizada vive em [Perguntas aos orientadores](projeto/perguntas-aos-orientadores.md) |
| [Perguntas aos orientadores](projeto/perguntas-aos-orientadores.md) | O que perguntar à Vitrus, à Fibrenamics e à organização, derivado dos dados de 20 out: 10 perguntas por impacto e urgência, perguntas por tema, anomalias nos dados, mensagens, guião de 15 minutos, registo de respostas (com as de 21 out) e regra de propagação |
| [Cenários e contingências](projeto/cenarios-e-contingencias.md) | Pitch, dados, mentoria, concorrência, 48 perguntas difíceis do júri, 12 por critério, cenário das Regras e pós-hackathon |
| [Narrativa do pitch](projeto/narrativa-do-pitch.md) | Storyline em 30 s, 3 min e 5 min, falas, roteiro da demo e objeções, com a fonte de cada número |
| [Guião de slides](projeto/pitch-slides.md) | Oito slides prontos para o deck |
| [Deck e vídeo](../pitch/README.md) | O deck em PowerPoint (`pitch/`) e o vídeo de apresentação em 16:9 e 9:16 (`video/`), gerados a partir dos dados e das capturas reais |
| [Pitch](projeto/pitch.md) | Resumo do guião de 5 minutos |
| [Perguntas do júri](projeto/perguntas-do-juri.md) | Respostas preparadas |

## Pesquisa

Tudo o que o pitch afirma assenta aqui. Nenhum número vai para um slide sem linha no registo.

| Documento | Para quê |
| --- | --- |
| [Índice da pesquisa](pesquisa/README.md) | Como usar o dossier e principais descobertas |
| [Enquadramento regulatório](pesquisa/enquadramento-regulatorio.md) | Diretiva (UE) 2025/1892, RGGR, prazos, o que Portugal ainda não tem |
| [Benchmarks internacionais](pesquisa/benchmarks-internacionais.md) | França, Catalunha, UE: kg por habitante, densidade, € por tonelada |
| [Tecnologia de triagem](pesquisa/tecnologia-de-triagem.md) | O que a foto, a etiqueta e o NIR conseguem, e os limites |
| [Indústria e mercado](pesquisa/industria-e-mercado.md) | Vale do Ave, recicladores, economia social, quem contactar |
| [Registo de afirmações](pesquisa/registo-de-afirmacoes.md) | Cada afirmação do pitch com fonte, data e estado |
| [Fontes](pesquisa/fontes.md) | Bibliografia numerada |

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
| [Deploy](engenharia/deploy.md) | Coolify na VPS, domínio, variáveis que o compose repassa, deploy manual, operação |
| [Workflow com agentes](engenharia/workflow-ia.md) | Claude Code e GLM/Z.ai/ZCode a partilhar o mesmo contexto |
| [Backlog](engenharia/backlog.md) | O que está feito e o que falta, por dia |
| [Demo e entrega](engenharia/demo-e-entrega.md) | Guião da demo e checklist |

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
