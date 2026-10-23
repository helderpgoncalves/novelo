# Cenários e contingências

Tudo o que pode correr bem ou mal entre 19 e 28 de outubro, com **o sinal de aviso, a resposta já preparada e quem a executa**. A ideia é que, em cada situação, ninguém tenha de improvisar.

Escrito a 19 de outubro de 2026. Dono: **H** = Hélder Gonçalves, **F** = Flávio Fernandes, **HF** = ambos. Probabilidade (qualitativa, da nossa experiência e do contexto, **não calculada**): **Alta**, **Média**, **Baixa**.

Estado das funcionalidades novas a 20 de outubro: copiloto de IA, painel de IA, sensibilidade e robustez, cenário francês, recomendador de piloto e resolvedor de alertas **estão feitos e testados**; a cobertura de contentores deixou de se aplicar (a Vitrus não tem contentores de têxteis, 21 de outubro); a ferramenta de avaliação da triagem existe mas **ainda não correu** (sem imagens com verdade-terreno). Só entram na demo as que estiverem ensaiadas a 25 de outubro; ver a [ordem de corte](estrategia-para-ganhar.md#calendário-dia-a-dia-19-a-28-de-outubro).

O prazo de submissão na plataforma é **23 de outubro às 17h30**; depois, nada se edita. O júri é designado pela organização, com especialistas nas áreas temáticas e sem votação pública. Os projetos são avaliados por quatro critérios ponderados (inovação 25%, viabilidade 25%, impacto 30%, apresentação e continuidade 20%); ver [Critérios de avaliação](criterios-de-avaliacao.md).

Documentos relacionados: [Estratégia para ganhar](estrategia-para-ganhar.md) · [Mentores](mentores.md) · [Narrativa do pitch](narrativa-do-pitch.md) · [Guião de slides](pitch-slides.md) · [Registo de afirmações](../pesquisa/registo-de-afirmacoes.md).

## Índice

- [A. Cenários de pitch](#a-cenários-de-pitch), incluindo [A.4 Critérios e Regras](#a4-critérios-e-regras)
- [B. Cenários de dados](#b-cenários-de-dados)
- [C. Cenários de mentoria](#c-cenários-de-mentoria)
- [D. Cenários de concorrência](#d-cenários-de-concorrência)
- [E. Perguntas difíceis do júri](#e-perguntas-difíceis-do-júri), incluindo [E.5 Perguntas por critério](#e5-perguntas-por-critério-de-avaliação)
- [F. Cenários pós-hackathon](#f-cenários-pós-hackathon)
- [Kit de contingência](#kit-de-contingência)

---

## A. Cenários de pitch

### A.1 Quem está na sala

| Cenário | Prob. | Sinal de aviso | Resposta preparada | Dono |
| --- | --- | --- | --- | --- |
| **Júri técnico** (engenharia, investigação operacional, IA) | Média | Perguntas sobre solver, validação, métricas | Abrir "Pressupostos" e o separador de incerteza; dizer o modelo (CP-SAT para localização, VRP para rotas, semente fixa, limite de tempo) e o limite (custos são pressupostos). Frase: "A IA nunca faz contas; um verificador rejeita números fora do resultado." | H |
| **Júri de negócio** (empresas, investidores) | Média | Perguntas sobre quem paga, escala, modelo de negócio | Voltar à tese de 2028: o município paga hoje; com a RAP, os produtores pagam as peças novas e o custo eficiente fixa-se com a câmara na mesa; o Novelo dá esse custo por tonelada. Mostrar o relatório RAP e o €/t por tipo de território | H |
| **Júri institucional** (Câmara, Vitrus, universidade) | Alta | Perguntas sobre dados, território, operação | Mostrar circuitos, viaturas, alertas de qualidade e a cobertura. Pedir o piloto de 3 meses em duas freguesias. Agradecer os dados da Vitrus pelo nome | HF |
| **Júri misto sem perfil técnico** | Alta | Caras vazias quando se fala de "VRP" | Contar a história do saco ao fio; usar uma única frase-âncora; só mostrar o €/t e as toneladas | H |
| **Júri de especialistas de outra área** (o júri compara os cinco desafios na classificação geral) | Média | Perguntas fora do têxtil, pedido de "o essencial" | Abrir com o problema e o número-âncora, sem jargão; só mostrar €/t, toneladas e o QR | H |
| **Jurado conhece a Vitrus melhor do que nós** | Média | Corrige um número | "Obrigado. Esse número é da vossa folha ou nosso cálculo? Ajustamos já." Abrir o registo e atualizar na hora | H |

### A.2 Tempo e formato

| Cenário | Prob. | Sinal de aviso | Resposta preparada | Dono |
| --- | --- | --- | --- | --- |
| **Pitch cortado a 3 minutos** | Média | Organização avisa na véspera | Versão de 3 minutos em [Narrativa do pitch](narrativa-do-pitch.md#versão-de-3-minutos); manter **uma frase por critério**; cortar o slide da indústria e encurtar o de IA; demo só com o cenário B, o "E se...?" e o relatório RAP; o pedido do piloto fica sempre | H |
| **Pitch alargado a 10 minutos** | Baixa | Organização anuncia 10 | Acrescentar o piloto recomendado, a incerteza e a triagem medida; deixar 2 minutos para perguntas | HF |
| **Sem demo (só slides)** | Baixa | Sem ligação ou sem ecrã de demo | Vídeo de 60 s embutido no deck e relatório RAP em PDF pré-gerado; narrar os ecrãs com capturas | F |
| **Sem internet** | Média | Wi-Fi do local falha no ensaio | Stack local em `just dev` com dados processados; vídeo e PDF offline; partilha de ligação do telemóvel; **IA só com internet**: descrever o copiloto com vídeo | F |
| **Sem projetor ou projetor com resolução estranha** | Baixa | Ecrã a cortar ou sem HDMI | Adaptadores USB-C e HDMI no kit; deck exportado em PDF e em 16:9 e 4:3; demo no portátil e no telemóvel (PWA instalada) | F |
| **Falha do portátil** | Baixa | Bateria, ecrã azul, sem arrancar | Segundo portátil com a stack e o deck já instalados e a mesma sessão aberta; deck e vídeo também no telemóvel | HF |
| **Falha de energia ou de bateria** | Baixa | Pouca bateria na véspera | Carregadores e powerbank; ligar à corrente antes de começar | F |
| **Microfone ou ordem de apresentação alterada** | Média | Mudança de ordem de última hora | Duas pessoas sabem o pitch completo; deck sem dependência de ordem | HF |

### A.3 Falhas técnicas durante a demo

| Cenário | Prob. | Sinal de aviso | Resposta preparada | Dono |
| --- | --- | --- | --- | --- |
| **API em baixo (produção)** | Média | Ecrã a carregar, 502 | Alternar para a stack local já aberta; se a local também falhar, vídeo de 60 s; verificar a saúde `/api/v1/health` 15 minutos antes | F |
| **Base de dados vazia** | Baixa | Ponto de partida sem números | Voltar ao *seed* (`just etl` e arranque da API); manter um *dump* de segurança da base pronta | F |
| **Solver demora ou dá "infeasible"** | Média | Cenário novo a demorar mais de 20 s | **Só usar cenários pré-calculados** (A, B, francês) na demo; o "E se...?" ao vivo corre sobre eles; mostrar o estado "infeasible" como resultado legítimo (o cenário francês é inviável com os pressupostos atuais: meta 669,7 t, teto do modelo 562,6 t) | H |
| **IA sem saldo ou sem chave (OpenRouter)** | Média | 503 `ai_budget_exceeded` ou erro de chave | Verificar o saldo e o orçamento mensal no painel de IA **na véspera**; modelo de reserva configurado; sem IA o relatório RAP sai com texto fixo e o "E se..." mostra o estado de indisponibilidade; vídeo da demo com IA como plano B | F |
| **Modelo de IA lento ou a dar respostas estranhas** | Média | Latência acima de 10 s | Trocar de modelo no painel (por defeito `openai/gpt-6-luna`); 5 perguntas "E se..." de reserva já testadas com respostas em cache | F |
| **Verificador rejeita a resposta da IA** | Média | Aviso "números não verificados" | É uma funcionalidade: dizer "Aqui o verificador recusou um número que não estava no cálculo", mostrar os cartões e continuar | H |
| **Sessão expirada ou login falha** | Baixa | Redireciona para entrada | Sessão com "manter sessão iniciada" aberta antes; utilizador de demonstração com palavra-passe forte guardada fora do ecrã | F |
| **QR não lê no telemóvel do jurado** | Média | Luz, ecrã baço | QR grande e com contraste, brilho a 100%; ligação curta por baixo; abrir o passaporte no nosso telemóvel como alternativa | F |
| **Jurado não faz a pergunta "E se..."** | Média | Silêncio | Tirar uma das 5 de reserva da lista (ver [Narrativa](narrativa-do-pitch.md#roteiro-da-demo)) | H |
| **Dispositivo do jurado sem rede (PWA)** | Baixa | Passaporte a carregar | O passaporte é leve e público; ter o PDF/captura equivalente | F |
| **Um ecrã novo "em construção" quebra** | Média | E2E vermelho | Regra de corte: sem E2E verde a 25 de outubro, o ecrã **não** entra na demo | HF |

### A.4 Critérios e Regras

Os pesos são conhecidos (inovação 25%, viabilidade 25%, impacto 30%, apresentação e continuidade 20%), mas o **detalhe de cada critério está nas Regras, que ainda não lemos**. Tudo o que está abaixo é condicional: não sabemos o que as Regras dizem.

| Cenário | Prob. | Sinal de aviso | Resposta preparada | Dono |
| --- | --- | --- | --- | --- |
| **O detalhe das Regras muda a interpretação dos critérios** | Média | Um critério tem subcritérios que não previmos (por exemplo, "impacto" inclui impacto social, ou "viabilidade" inclui a financeira) | **Protocolo de uma hora:** 1) colar o texto em [Critérios de avaliação](criterios-de-avaliacao.md#colar-aqui-o-texto-das-regras); 2) sublinhar subcritérios e palavras-chave; 3) refazer a coluna "o que o júri procura" da [matriz](estrategia-para-ganhar.md#matriz-critério-prova-e-ação); 4) rever a autoavaliação e a [repartição do tempo](narrativa-do-pitch.md#repartição-do-tempo-pelos-quatro-critérios); 5) mudar slides e frases só onde um subcritério fique sem prova; 6) passar E6 do registo a verificado | HF |
| **Impacto inclui impacto social ou ambiental** | Média | A palavra "social", "ambiental" ou "comunidade" nas Regras | Reforçar a reutilização (59,4%), a economia social como parceira (artigo 22.º-C n.º 11) e a recolha mais próxima do cidadão. **Não** afirmar emissões de CO₂: não estão no modelo | H |
| **Viabilidade inclui viabilidade financeira ou de negócio** | Média | "Modelo de negócio", "sustentabilidade financeira" | Subir ao palco o custo, o investimento e o intervalo, e a hipótese de quem paga (município hoje, entidades gestoras em 2028). Dizer que o preço depende do piloto | H |
| **Inovação privilegia tecnologia nova** | Baixa | "Estado da arte", "tecnologia disruptiva" | Dar mais tempo ao "E se...?" e ao verificador, **dentro dos 65 s** de inovação; não cortar impacto nem viabilidade | H |
| **Continuidade exige equipa, escalabilidade ou plano de negócio por escrito** | Média | Pedem entrega escrita ou apresentação do plano | Preparar uma página com piloto, roadmap pós-26 out, replicabilidade e parceiros "em conversa"; mesmo conteúdo do slide 8 | HF |
| **As Regras impõem entrega escrita ou vídeo além do pitch** | Média | Prazo antes de 26 de outubro | Usar a [descrição do projeto](../marca/descricao.md), o README e o vídeo de 60 s; nada novo, só adaptado ao formato | F |
| **Perder a submissão de 23 de outubro às 17h30** (falha da plataforma, campo em falta, atraso) | Baixa | Rascunho ainda por fazer a 22 | Rascunho a 22; congelar o código às 15h00 de 23 e submeter até às 16h30; etiqueta Git da versão submetida; se a plataforma falhar, contactar a organização pelo evento e guardar capturas da tentativa | HF |
| **A produção muda depois da submissão** (deploy a cada push em `main`) | Média | Commit em `main` depois das 17h30 de 23 | Depois da submissão só entram correções; trabalho novo em ramo; verificar a versão em produção 15 minutos antes do pitch | F |
| **Dúvida sobre originalidade ou uso de IA** | Baixa | Pergunta da organização ou do júri | O histórico do Git começa a 19 de outubro; as ferramentas de IA estão identificadas na submissão e no README; **nunca reescrever o histórico** | H |
| **As Regras mudam o tempo ou proíbem a demo ao vivo** | Baixa | Duração diferente de 5 minutos ou "sem demo" | Aplicar as versões de 3 minutos ou o cenário "sem demo" de A.2; manter uma frase e uma prova por critério | H |

---

## B. Cenários de dados

### B.1 Contentores (ficheiro esperado a 20 de outubro)

| Cenário | Prob. | Sinal de aviso | Resposta preparada | Dono |
| --- | --- | --- | --- | --- |
| **Chega no formato esperado** (xlsx, csv ou geojson com coordenadas) | Média | — | `just etl`, alertas revistos, mapa e cobertura em minutos; mostrar a lacuna face à referência francesa (por verificar) | F |
| **Formato estranho** (várias folhas, cabeçalhos em pt, coordenadas em PT-TM06) | Média | Importador rejeita linhas | O importador deteta colunas e converte coordenadas; rever o ficheiro `containers_rejected.csv` e os alertas; se necessário, afinar o mapeamento de colunas à mão | F |
| **Sem tipo de contentor** | Alta | Todos ficam "outro" | Usar `--default-kind textile` **só depois de a Vitrus confirmar** que são têxteis; dizê-lo no ecrã ("assumido") | F |
| **Sem coordenadas (só morada ou freguesia)** | Média | Linhas "pendentes" | Geocodificar (Nominatim) com cuidado e marcar como estimativa; entretanto contar por freguesia; **nunca** inventar coordenadas | F |
| **Coordenadas trocadas ou fora do concelho** | Média | Pontos no mar ou em Espanha | O importador corrige trocas se a leitura trocada cair no concelho e regista alerta; o resto é rejeitado e listado | F |
| **Chega tarde (depois de 22)** | Média | Sem ficheiro a 21 | Demo com a camada "a chegar" (estado vazio explicado) e a cobertura calculada com a referência; dizê-lo: "Os dados chegam hoje; o importador já está testado" | HF |
| **Não chega** | Baixa | Sem resposta a 23 | O Novelo funciona sem eles; o slide diz "quando chegarem, entram com um comando"; usar os ecopontos públicos (por verificar) como contexto, não como dados | H |
| **Chega com informação sensível** | Baixa | Nomes, moradas privadas | Não publicar no repositório nem no deck; usar só coordenadas agregadas; ver B.4 | H |

### B.2 Custos unitários

| Cenário | Prob. | Sinal de aviso | Resposta preparada | Dono |
| --- | --- | --- | --- | --- |
| **Chegam completos** | Média | — | Substituir `params.py`; mostrar "dados da Vitrus"; repetir cenários A e B e atualizar a frase-âncora | HF |
| **Chegam parciais** (só custo por km, falta contentor) | Alta | Metade dos campos | Usar o que há e manter o resto como pressuposto assinalado; recalcular sensibilidade | F |
| **Não chegam** | Alta | Sem resposta a 22 | Apresentar o **intervalo** (P10 a P90) e o tornado: "Os pressupostos que mais mexem são estes; já pedimos os números". Dizer "estimativa" | H |
| **Chegam e contradizem o modelo** (muito mais caros ou mais baratos) | Média | €/t muda mais de 30% | A recomendação pode mudar: dizer-o abertamente ("é para isto que serve o modelo"), mostrar a nova comparação | HF |

### B.3 Correções e inconsistências

| Cenário | Prob. | Sinal de aviso | Resposta preparada | Dono |
| --- | --- | --- | --- | --- |
| **A Vitrus corrige um número** (por exemplo, 301,3 t) | Baixa | Email ou comentário do mentor | Atualizar `data/raw` apenas se o ficheiro novo for oficial; correr `just etl` e o *seed*; atualizar o [registo](../pesquisa/registo-de-afirmacoes.md) e os slides | F |
| **O plano municipal chega com números diferentes** (por exemplo, 11% em vez de 5,86%) | Média | Documento recebido | Ficar com o do documento oficial; recalcular A10, A12; reescrever o slide do problema; manter o hook europeu dos 72% [F7] | H |
| **A contagem de localidades diverge** (82 nos dados, 93 em documentos antigos) | Baixa | Pergunta do júri | Dizer "82 com pelo menos um circuito, 79 com freguesia" e abrir o ficheiro de origem | F |
| **A população muda** (outra fonte que não o INE 2021) | Baixa | Pergunta | Usar o INE (Censos 2021, 156 830) e dizer a data | F |
| **A diretiva é citada com outra redação** | Baixa | Jurado jurista | Mostrar os artigos no EUR-Lex; só usar as datas marcadas "Primária"; **não** afirmar metas de recolha | H |

### B.4 Dados e privacidade

| Cenário | Prob. | Sinal de aviso | Resposta preparada | Dono |
| --- | --- | --- | --- | --- |
| **Pergunta sobre RGPD e fotos** | Média | "As fotos ficam guardadas?" | Na triagem não (só em memória). Só se guarda uma miniatura se o operador a pedir, sem metadados, sem pessoas, apagada ao fim de 90 dias ou quando quiser (novo a 23 out 2026). Nada de quem entrega. Avaliação técnica interna, por validar com o encarregado de proteção de dados: [Privacidade das fotografias](../engenharia/privacidade-fotografias.md) | H |
| **Pedido para retirar dados da Vitrus do repositório** | Baixa | Mentor ou Vitrus | Remover de `data/raw` com `git rm` num novo commit. Reescrever o histórico **só se pedido por escrito**, porque a organização pode verificar a originalidade pelo histórico dos repositórios; avisar a equipa e a organização | HF |

---

## C. Cenários de mentoria

| Cenário | Prob. | Sinal de aviso | Resposta preparada | Dono |
| --- | --- | --- | --- | --- |
| **O mentor pede algo que não temos** (por exemplo, integração com o ERP da Vitrus ou sensores) | Média | "E se ligassem a X?" | "Não está no âmbito deste hackathon; o piloto permite validar primeiro." Anotar o pedido em "próximos passos" | H |
| **O mentor discorda do modelo** (por exemplo, custos, fator de desvio, objetivo) | Média | Corrige ou franze o sobrolho | Pedir o parâmetro que ele usaria e testá-lo ao vivo no simulador; registar a diferença; nunca defender o que não consegue demonstrar | HF |
| **O mentor oferece um contacto** (Sasia, Riopele, CITEVE, entidade gestora) | Média | "Falem com X" | Pedir apresentação por email com uma frase de contexto; enviar nesse dia a pergunta única; registar a resposta com data | H |
| **O mentor oferece um ensaio ou uma parceria** (Fibrenamics) | Baixa | "Mandem um lote" | Confirmar volume, formato e custo por escrito; não dizer "validado" antes de haver resultado; entra no plano do piloto | H |
| **O mentor não responde** | Média | Sem resposta em 24 h | Segunda mensagem curta; ir ao local (CIAJG) e pedir 5 minutos; alternativa institucional (reunião inicial da Fibrenamics, `green@`) | H |
| **O mentor pede para o projeto ser partilhado** | Média | "Mandem-me o repositório" | O repositório é público (verificado a 20 de outubro de 2026) e a propriedade intelectual é nossa [F59]; mandar o link do README e da demo; cuidado com `data/raw/` (ver [Perguntas aos orientadores](perguntas-aos-orientadores.md), Q-dados) | H |
| **Pedem dados que não podemos dar** (código, base de dados) | Baixa | Pedido insistente | Mostrar a demo e o relatório; nada de credenciais; propor reunião | H |
| **O mentor muda de ideias entre dias** | Baixa | Indicação contraditória | Anotar quem disse o quê e quando; pedir confirmação por escrito | HF |
| **Identificação errada** (Prof. Paulo Afonso é outra pessoa) | Baixa | Perfil não bate | Confirmar a identidade logo na primeira mensagem; ver [Mentores](mentores.md#prof-paulo-afonso-uminho-produção-e-sistemas) | H |

---

## D. Cenários de concorrência

Outras equipas vão resolver este desafio ou os outros quatro. Os temas prováveis e a nossa resposta:

| Concorrente provável | Prob. | O que costumam mostrar | Como nos diferenciamos | Frase de 15 s |
| --- | --- | --- | --- | --- |
| **App do cidadão** (mapa de contentores, lembretes, pontos, gamificação) | Alta | Ecrã bonito, ainda sem custos nem dados reais | Nós decidimos **onde investir e a que custo**; a app do cidadão é um canal, não a decisão. Complementar, não concorrente | "Uma boa app com contentores no sítio errado continua a custar caro. Nós dizemos onde." |
| **Sensores IoT de enchimento** | Média | Dashboard de ocupação | Custa por contentor, e o desafio pede o **menor investimento**; sensores só onde os dados o justificarem | "Sensores são o passo dez; o passo um é saber onde pôr os contentores." |
| **Marketplace de roupa usada** (revenda) | Média | Troca ou venda entre pessoas | Atua no consumo, não na recolha municipal; a reutilização já é 59,4% do que a Vitrus recolhe | "O marketplace trata da roupa que alguém quer vender; nós, da que o município tem de recolher." |
| **Blockchain / passaporte digital** | Média | Rastreabilidade imutável | O valor está **nos dados do passaporte**, não na tecnologia; um registo com histórico chega | "Preferimos um passaporte útil a uma tecnologia vistosa." |
| **Visão por computador só com fotografia** | Média | Classificação com "95%" | Nós **medimos** a exatidão com matriz de confusão (ferramenta feita, ainda sem corrida), a foto não lê a fibra, e o operador confirma | "Não prometemos 95%; medimos o nosso e dizemo-lo." |
| **Robot de triagem** (NIR) | Baixa | Equipamento caro | Investimento incompatível com o pedido; fica para a indústria (Fibrenamics, Sasia) | "A triagem ótica fica no reciclador; nós garantimos que o lote chega com composição." |
| **Veículo elétrico ou rotas só de logística** | Baixa | Otimização de rotas genérica | Nós ligamos rotas, pontos, procura e **custo por tonelada**; a viatura de têxtil parte do depósito da Vitrus (Polvoreira) | "Rotas sozinhas não respondem; o custo por tonelada, sim." |
| **Chatbot sem números** | Média | Assistente que "responde" a tudo | O nosso copiloto chama o otimizador e um verificador rejeita números inventados | "A IA conduz, o otimizador calcula." |
| **Equipa de outro desafio com a mesma app de sustentabilidade** | Baixa | — | Foco em dados reais e na tese de 2028 | — |

**Regra:** nunca criticar uma equipa em público. Posicionar, não atacar.

---

## E. Perguntas difíceis do júri

Resposta de 20 segundos e a evidência a abrir. **Estados:** as respostas usam apenas números marcados como verificados, cálculo ou estimativa no [registo](../pesquisa/registo-de-afirmacoes.md). Onde a funcionalidade está em integração, diz-se "em integração" e só se mostra se estiver ensaiada.

### E.1 Problema e valor

| # | Pergunta | Resposta (20 s) | Evidência a abrir |
| --- | --- | --- | --- |
| 1 | Porque não pôr contentores em todo o lado? | A Vitrus não quer: o têxtil de contentor vem contaminado e perde a reutilização. Também custa em contentores e recolhas onde há pouco têxtil; Sintra está a retirar centenas. Propomos uma viatura de têxtil nova, sem compactação: saco fechado à porta num dia fixo e paragens nos locais municipais e nas escolas | Simulador, cenário B; slide de 2028 |
| 2 | Qual é a vossa estimativa mais frágil? | Os custos unitários: a Vitrus ainda não os enviou. Mostramos o intervalo e os pressupostos que mais mexem | "Pressupostos" e separador de incerteza (feito) |
| 3 | Os números são reais? | Os de partida, sim: 301,3 t, destino de cada tonelada, 40 circuitos e 29 viaturas são da Vitrus; a população é do INE. As toneladas por cenário são estimativas e dizemo-lo no ecrã | Ponto de partida; Qualidade dos dados |
| 4 | Quem paga isto? | Hoje o município, sozinho. Com a RAP (regime criado até 17 de abril de 2028), os produtores pagam os custos "economicamente eficientes" das peças postas à venda depois da lei nacional; as antigas continuam a pesar no município (B17, a confirmar com a APA). Alguém tem de calcular esse custo; é o que fazemos | Relatório RAP; slide de 2028 |
| 5 | Porque é que 2028 interessa a Guimarães agora? | A lei põe as autoridades locais entre quem determina o custo eficiente (art. 22.º-A, n.º 7 e 12) e a entidade gestora não pode recusar o município (art. 22.º-C, n.º 10); quem tiver os dados negoceia melhor. E a decisão sobre o têxtil no indiferenciado (art. 22.º-A, n.º 9) toma-se na transposição, até 17 de junho de 2027 | Relatório RAP com custo por tipo de território |
| 6 | A diretiva fixa metas de recolha de têxteis? | Não. Pede cobertura do território, aumento sustentado da recolha seletiva (art. 22.º-C, n.º 9, b) e c)) e custos eficientes; a Comissão avalia metas até 31 de dezembro de 2029 (art. 41.º-A). Não afirmamos metas | Registo B14, B19 |
| 7 | Já há entidade gestora em Portugal? | A APA indicava em dezembro de 2025 que o fluxo ainda não estava aprovado; confirmamos antes do pitch | Registo B11 |
| 8 | Qual é o valor para a Vitrus em concreto? | Um painel que diz onde investir, com €/t e investimento por cenário, para a viatura de têxtil nova que a própria Vitrus indicou, e quanto se poupa em tratamento (105,64 €/t evitados por tonelada desviada) | Comparar cenários |
| 9 | Isto não é só uma folha de cálculo? | Não: otimiza localização e rotas com restrições reais, compara cenários e responde a "E se...?" sem inventar números | Simulador; "E se...?" |
| 10 | Quanto se poupa? | Cada tonelada desviada evita 105,64 € de tratamento (Vitrus). Com 60 000 €/ano, 445,8 t evitam 47 093 € por ano, mais do que os 45 828 € que a rede custa: custo líquido de −2,8 €/t (estimativa; os custos das viaturas ainda são pressupostos) | Resumo do cenário; registo H10 |
| 11 | E se a Vitrus já tem uma solução? | O Novelo é a camada de decisão sobre os dados deles; complementa e não substitui a operação | Circuitos e frota |
| 12 | Porque é que a Vitrus havia de usar isto? | Poupa tempo a comparar cenários, dá custo por tonelada para o reporte RAP e identifica erros nos dados (12 alertas encontrados) | Qualidade dos dados |

### E.2 Tecnologia e IA

| # | Pergunta | Resposta (20 s) | Evidência a abrir |
| --- | --- | --- | --- |
| 13 | E se a IA se enganar nos números? | A IA não faz contas. Traduz a pergunta em alteração ao cenário, mostra "Entendi: ..." para confirmar, e o otimizador calcula; um verificador rejeita números fora do resultado | "E se...?" ao vivo |
| 14 | A triagem por foto é fiável? | Serve de primeira triagem e gera dados; o operador confirma. A composição vem da etiqueta. Estamos a medir a exatidão com matriz de confusão (ferramenta feita, ainda sem corrida); só afirmamos o número depois | Triagem; avaliação (`just eval-triage`) |
| 15 | Que percentagem acertam? | Ainda não afirmamos um número: mede-se em 30 a 50 peças reais; mostramos o resultado quando existir | Avaliação da triagem |
| 16 | Porque não usam NIR? | É a tecnologia certa para a indústria, mas custa e não cabe no "menor investimento"; fica no reciclador. O Novelo garante o lote e a composição declarada | Tecnologia de triagem |
| 17 | Que modelo de IA usam e quanto custa? | `openai/gpt-6-luna` por defeito, via OpenRouter, com orçamento mensal e custo real por chamada visíveis no painel de administração (feito) | Painel de IA |
| 18 | E se o modelo mudar ou ficar caro? | Trocamos de modelo no painel por funcionalidade, com custo estimado por operação e modelo de reserva | Painel de IA (feito) |
| 19 | Os dados saem do país? | Na triagem, as fotos reduzidas vão ao fornecedor de IA (via OpenRouter) e a nossa API não as guarda; não guardamos dados de quem entrega. Só ficam miniaturas que o operador peça, na nossa base de dados, durante 90 dias no máximo por omissão. A retenção do lado do fornecedor não está verificada (ver [Privacidade das fotografias](../engenharia/privacidade-fotografias.md)). Dados da Vitrus ficam na nossa base de dados | Documento de IA |
| 20 | Porque OpenRouter? | Um único ponto para vários modelos, com custo por chamada e modelo de reserva | Painel de IA |
| 21 | Como evitam alucinações? | Saída estruturada, validação com esquema, verificador de números e recusa fora do âmbito | "E se...?" e copiloto (feito) |
| 22 | O copiloto pode apagar dados? | Não: só cria cenários marcados como do copiloto, com limite por pedido | Copiloto (feito) |
| 23 | Porque não blockchain no passaporte? | Um registo com histórico na base de dados chega; o valor está nos dados do lote | Passaporte do lote |
| 24 | E se a rede falhar na demo? | PWA e stack local; vídeo de 60 s e relatório pré-gerado como plano B | Plano B |
| 25 | É seguro? | Autenticação com cookies HttpOnly, palavras-passe com argon2, limites de pedidos, erros tipados; a IA responde 503 sem chave em vez de falhar | Documentação de engenharia |

### E.3 Dados, modelo e rigor

| # | Pergunta | Resposta (20 s) | Evidência a abrir |
| --- | --- | --- | --- |
| 26 | De onde vêm os 5,86% e o têxtil por habitante? | Da Vitrus e da APA: a Vitrus recolheu 43 050,5 t de indiferenciado em 2025, 84,0% do concelho (Relatório e Contas 2025), e indicou-nos a 22 de outubro os 5,86% de têxtil da APA (2025) sobre o concelho todo. Dá cerca de 3 003 t por ano ainda no lixo, 1,6 kg por habitante por mês, sempre com "estimativa". Não usamos o plano municipal: a Vitrus não o usa | Registo A8, A10, A16 e A24 |
| 27 | Como sabem o custo por quilómetro? | Pressuposto assinalado; vamos substituí-lo pelo da Vitrus; mostramos a sensibilidade para ver quanto importa | Pressupostos; tornado (feito) |
| 28 | Como validam o modelo? | Valores calculados à mão nos testes, semente fixa, comparação com dados observados e revisão por um mentor da UMinho (a pedir) | Testes e documento de dados e modelo |
| 29 | Porque assumem 1,3 de desvio nas rotas? | É um pressuposto de distância por estrada; podemos usar rotas reais (OSRM) quando houver tempo | Pressupostos |
| 30 | A meta francesa é alcançável? | Sim, no modelo e sem contentores: as 669,7 t francesas ficam entre os orçamentos de 100 000 €/ano (571,2 t) e 150 000 €/ano (695,4 t); o teto sem contentores é 772,1 t, com 2 viaturas (estimativa, 22 out 2026). Continua a ser referência, não meta: o piloto mede o que é realista | Cenários de referência (feito) |
| 31 | Porque a França é o benchmark? | É o sistema mais maduro e com dados públicos; os números vêm de imprensa e estão marcados por verificar; usamo-los como referência, não como promessa | Benchmarks internacionais |
| 32 | O que acontece se os custos forem 30% mais altos? | Mostramos no tornado e no intervalo: a recomendação aguenta ou muda; é para isso que serve | Incerteza (feito) |
| 33 | O piloto tem tamanho para medir alguma coisa? | Sim: o piso de sinal é 1,71 t em 3 meses (cerca de 1 032 peças por célula e freguesia, efeito de desenho 2), e a recomendação (Aldão e Arosa e Castelões) prevê 2,43 t, a 538 €/t (424 a 706, sem o preço da viatura); os pressupostos são nossos | Piloto (feito) |
| 34 | Porque Aldão e Arosa e Castelões? | Misturam urbano e rural, com densidade contrastante; Arosa e Castelões, a única freguesia predominantemente rural, fica sem serviço no cenário de 60 000 €/ano. É a recomendação do modelo, não uma decisão final | Piloto (feito) |
| 35 | Os 12 alertas dos dados: o que fizeram? | Mostramos cada um com o motivo e uma sugestão de resolução da IA que **só um humano aplica** | Qualidade dos dados; resolvedor (feito) |
| 36 | Têm dados de contentores? | A 20 de outubro chegou o inventário **municipal** (2 751 contentores de indiferenciado, orgânico e seletivo, 2 026 locais), já na app e no mapa. É a nossa base geográfica: onde o têxtil se perde e onde a viatura de têxtil pode parar. Contentores **de têxteis** não há, e a Vitrus não os quer (contaminação) | Mapa e rede por locais (feito) |
| 37 | Ignoram os ecopontos de Guimarães? | Os ecopontos (296 novos) não mencionam têxteis nas fontes que vimos; falta confirmar | Fontes (F16) |

### E.4 Indústria, mercado e impacto

| # | Pergunta | Resposta (20 s) | Evidência a abrir |
| --- | --- | --- | --- |
| 38 | Os recicladores querem estes lotes? | A Sasia recicla cerca de 2 000 t por mês, **quase tudo pré-consumo**; o gargalo é a qualidade e a homogeneidade; lotes triados por composição são o que falta. Estamos a testar com um reciclador | Bolsa de fibra; indústria e mercado |
| 39 | E a Fibrenamics? | É a investigação da UMinho em Guimarães: a ciência aponta não tecidos e isolamento para misturas; estamos a perceber o que aceitam de pós-consumo | Mentores; Fibrenamics |
| 40 | O que fazem ao rejeito (14,1%)? | Hoje vai para incineração ou aterro; o destino de baixo valor (não tecidos, compósitos, isolamento) é a hipótese a validar com a Fibrenamics | Sankey |
| 41 | Funciona noutro município? | Sim: usa dados abertos (INE, mapas, rede viária) mais os custos do operador local, e todos têm a mesma obrigação desde 2025 | Documentação |
| 42 | Qual é a maior limitação? | Os custos unitários e a exatidão da triagem; por isso mostramos a incerteza e medimos | Pressupostos; avaliação |
| 43 | O que fazem nos próximos 3 meses? | Piloto em duas freguesias com a Vitrus, um modo de recolha de cada tipo, comparar toneladas e custos reais com o previsto e caracterizar lotes | Piloto |
| 44 | Qual é o modelo de negócio? | O município (hoje) e as entidades gestoras (2028) pagam pelo planeamento, pelo relatório e pela rastreabilidade; o modelo exato depende do piloto | Estratégia |
| 45 | A economia social não é concorrente? | A diretiva protege-a; deve ser parceira: pode ser um modo adicional na rede | Enquadramento regulatório |
| 46 | Porque é que o cidadão haveria de separar? | Não é o foco do Novelo, mas o passaporte e a evidência por marca permitem fechar o ciclo e mostrar o resultado a quem entrega | Passaporte público |
| 47 | Quanto custa por tonelada? | Depende do cenário: estimamos um intervalo (P10 a P90) e mostramos "estimativa"; o exemplo de 60 000 €/ano dá cerca de 123 €/t no caso central (intervalo de cerca de 93 a 165), que **muda** com os custos da Vitrus | Incerteza (feito) |
| 48 | A França paga 156 €/t aos municípios? | Os produtores franceses pagam em média 156 € por tonelada colocada no mercado (secundária); o custo real de triagem é discutido (por verificar); não é comparável diretamente com o nosso €/t | Benchmarks (C4) |

### E.5 Perguntas por critério de avaliação

Doze perguntas, três por critério ou menos, que acrescem às 48 anteriores. Os códigos ligam cada uma ao critério: **I** inovação e originalidade (25%), **V** viabilidade técnica (25%), **P** impacto e relevância (30%), **C** apresentação e potencial de continuidade (20%). Fonte dos pesos: [Critérios de avaliação](criterios-de-avaliacao.md). Os números do cenário são os do modelo de 22 de outubro (registo H3 a H13), sempre com "estimativa".

| # | Pergunta | Resposta (20 s) | Evidência a abrir |
| --- | --- | --- | --- |
| **I1** | Isto já existe? | Existem peças soltas: otimizadores de rotas, apps de contentores, classificadores por foto. Na pesquisa que fizemos não encontrámos quem ligue, com dados reais do concelho, a decisão da rede, o lote até ao reciclador e o dossiê de 2028. A pesquisa não é exaustiva: se conhecerem um caso, dizem-nos e comparamos | "E se...?" e lote com QR; [Indústria e mercado](../pesquisa/industria-e-mercado.md) |
| **I2** | A novidade é só pôr IA em cima de um otimizador? | Não: a IA é a interface. A novidade é a cadeia ligada e a regra de que a IA nunca faz contas, porque um verificador rejeita números que não saíram do cálculo | Verificador a recusar um número; Sankey e relatório RAP |
| **V1** | E se a IA falhar? | O simulador, o otimizador e o relatório funcionam sem IA; sem chave a API responde 503 nas funcionalidades de IA em vez de falhar. Na demo há modelo de reserva, cinco perguntas em cache e vídeo | Painel de IA (feito); plano B |
| **V2** | E se os custos estiverem errados? | São pressupostos visíveis, com a origem de cada um. Mostramos o intervalo e o tornado (feito). Quando a Vitrus enviar os custos, substituem-se e recalcula-se; se a recomendação mudar, dizemo-lo | "Pressupostos"; incerteza (feito) |
| **V3** | Isto é mais do que um protótipo de hackathon? | Está em produção em novelo.helder.si com dados reais; só entra na demo o que tem E2E verde, e o que não está ensaiado a 25 de outubro sai | Produção; [regra de corte](estrategia-para-ganhar.md#regras-de-corte-em-função-dos-pesos) |
| **P1** | Quantas toneladas, quanto custa, para quem? | Hoje, 301,3 t por ano (dados da Vitrus). Com 60 000 €/ano, 445,8 t por ano a 102,8 € por tonelada (82,0 a 141,3 em 8 de cada 10 simulações), **estimativa**. Hoje paga o município; com a RAP, os produtores pagam o custo eficiente das peças postas à venda depois da lei nacional (o mais tardar 17 de abril de 2028) | Comparação A/B; relatório RAP |
| **P2** | E o impacto ambiental, não só o custo? | Medimos toneladas que saem do indiferenciado e o destino: 59,4% reutilização, 26,5% reciclagem, 14,1% rejeito (dados da Vitrus; duas entidades estimadas). Não calculamos emissões de CO₂: não estão no modelo e não as afirmamos | Ponto de partida; Sankey |
| **P3** | Isto resolve um problema de Guimarães ou é genérico? | De Guimarães: parte do lixo e dos contentores municipais da Vitrus, do seu depósito em Polvoreira, do custo de tratamento que a Vitrus paga (105,64 €/t) e da população das 48 freguesias do INE | Mapa; pressupostos |
| **C1** | E depois do hackathon? | Pedimos um piloto de três meses em duas freguesias, com três KPIs (toneladas, €/t, taxa de rejeito) e um piso de sinal. A seguir, trocar pressupostos por dados medidos e validar lotes com um parceiro de fibra. O repositório fica público e a propriedade é dos autores [F59] | Slide 8; [roadmap](narrativa-do-pitch.md#o-fecho-slide-8-40-s-serve-a-continuidade) |
| **C2** | Quem paga o Novelo daqui para a frente? | Hipótese a validar no piloto: o município hoje e as entidades gestoras em 2028, pelo planeamento, pelo relatório e pela rastreabilidade. Ainda não há contrato nem preço | Estratégia; pergunta 44 |
| **C3** | Funciona noutro município? | A lógica assenta em dados abertos (INE, mapas, rede viária) mais os dados e custos do operador local. Ainda **não** o testámos noutro município; é parte do roteiro depois do piloto | Documentação de dados |
| **C4** | Quem são os vossos parceiros? | Dados e desafio: Vitrus. Os mentores do desafio vêm também da Fibrenamics e da UMinho, mas ainda não há parceria nem validação; só os nomeamos como parceiros depois de os ouvirmos e de escrever o que disseram | [Mentores](mentores.md) |

**Regra:** se a pergunta não tem resposta aqui, dizer "Não sei; vamos confirmar e enviar" é melhor do que inventar.

---

## F. Cenários pós-hackathon

| Cenário | Prob. | Sinal | Resposta preparada | Dono |
| --- | --- | --- | --- | --- |
| **Ganhamos** (28 de outubro) | Média | Anúncio | Aceitar o prémio com uma frase de agradecimento à Vitrus e ao município; propor logo o piloto; registar contactos | H |
| **Não ganhamos** | Média | Anúncio | Pedir feedback ao júri e aos mentores; manter a demo online e partilhar o repositório a quem pedir; continuar o contacto com Vitrus e Fibrenamics | HF |
| **Convite para um piloto** | Média | Conversa pós-pitch | Responder em 48 h com plano de 3 meses, KPIs, piso de sinal, dados necessários e responsabilidades | H |
| **Pedido de licença ou propriedade intelectual** | Baixa | Email | A propriedade dos protótipos é dos autores [F59]; escolher uma licença antes de partilhar mais (hoje o repositório é público e não tem licença); aconselhamento jurídico se houver interesse comercial | HF |
| **Interesse em financiamento ou consórcio** | Baixa | Contacto de mentor | Reunir Vitrus, Fibrenamics e UMinho; identificar uma candidatura concreta (**hipótese**, nenhuma identificada) | H |
| **Pedido de um serviço pago** | Baixa | Município ou entidade | Definir âmbito mínimo (planeamento e relatório), preço e responsabilidade; só aceitar com custos unitários reais | H |
| **Conflito entre a equipa e a organização** (por exemplo, sobre direitos de uso) | Baixa | Contrato ou regulamento | Ler o separador Rules e o regulamento completo (ainda não os temos); perguntar à organização | HF |
| **Continuação como dissertação ou projeto UMinho** | Baixa | Conversa com o Prof. Paulo Afonso | Tema e orientador por escrito; manter o código aberto | H |
| **Fim do suporte de IA** (chave sem saldo) | Média | 503 | Orçamento mensal e alerta a 80%; desligar a IA mantém o resto a funcionar | F |

---

## Kit de contingência

| Item | Onde | Dono |
| --- | --- | --- |
| Vídeo de 60 s da demo (com e sem IA) | Telemóvel e portátil | H |
| Relatório RAP pré-gerado (PDF) dos cenários A, B e francês | Telemóvel e portátil | F |
| Deck em PDF (16:9 e 4:3) e em formato editável | Pen USB e nuvem | H |
| Stack local pronta (`just dev`) com dados processados | Portátil 1 e 2 | F |
| Cópia da base de dados *seed* | Portátil 2 | F |
| Cenários A, B e francês pré-calculados | Base de dados | F |
| 5 perguntas "E se..." de reserva, com respostas em cache | Documento e base de dados | H |
| Registo de afirmações impresso e verificado | Papel | H |
| Adaptadores HDMI e USB-C, carregadores, powerbank, rato | Mochila | F |
| Saldo e orçamento de IA verificados | Painel de IA | F |
| Telemóvel com a PWA instalada e QR de teste | Mochila | HF |

**Verificação 15 minutos antes:** saúde da API, login, cenário B abre, relatório RAP descarrega, QR lê, saldo de IA, Wi-Fi.
