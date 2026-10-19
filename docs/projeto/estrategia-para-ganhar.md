# Estratégia para ganhar

**Tese.** A Vitrus perguntou como criar uma recolha seletiva de têxteis "com o menor investimento e o menor custo de operação". A resposta que ganha não é um contentor melhor: é **uma ferramenta que diz, com números, onde investir, que modo usar em cada zona e quanto custa cada tonelada**, e que entrega ao município o dossiê para reclamar esse custo aos produtores em 2028.

Baseado no [dossier de pesquisa](../pesquisa/README.md) e no [registo de afirmações](../pesquisa/registo-de-afirmacoes.md). Escrito a 19 de outubro de 2026.

## O desafio, lido com atenção

> Como criar um serviço de recolha seletiva de têxteis pós-consumo que garanta material reutilizável e reciclável, com o menor investimento e o menor custo de operação?

| Parte da pergunta | O que significa | Como respondemos |
| --- | --- | --- |
| "serviço de recolha seletiva" | Um serviço, não um equipamento | Rede de modos combináveis (rua, pontos existentes, a pedido) |
| "garanta material reutilizável e reciclável" | Qualidade à entrada importa | Triagem logo à partida, lotes por composição e estado |
| "menor investimento" | CAPEX | Pontos em locais existentes e recolha a pedido sem km novos |
| "menor custo de operação" | OPEX | Otimizador de rotas sobre os circuitos e viaturas atuais |
| "menor" (as duas coisas) | Comparar cenários | Simulador com orçamento, cenários e €/t |

**Os três caminhos que o desafio sugere** ("por onde começar"):

| Caminho | O risco de o fazer sozinho | O que o Novelo faz |
| --- | --- | --- |
| Recolha mais próxima do cidadão | Mais contentores = mais custo e problemas de gestão (Sintra, Humana) | Otimiza onde, com quanto, e em que modo |
| Triagem logo à partida com imagem | Foto não vê a fibra; exatidão por medir | Triagem assistida com confirmação, e **avaliação medida** |
| Ligação à indústria do Vale do Ave | Recicladores precisam de lotes homogéneos, não de sacos | Lote com passaporte e bolsa de fibra |

**A nossa posição:** os três caminhos não são alternativos, são a mesma cadeia. O Novelo é a camada de decisão que liga os três, **do saco ao fio**.

## O que o júri vai valorizar (hipóteses)

> **Os critérios do Hack4Guimarães 2035 não são públicos.** Não os encontrámos no regulamento nem na imprensa [F21] [F22]. Perguntar à organização e ao mentor hoje. O que segue são **hipóteses** a partir de guias de hackathons e do tipo de desafio, a validar.

| Hipótese de critério | Porque é plausível | Como a cobrimos | Evidência a mostrar |
| --- | --- | --- | --- |
| **Problema real e bem compreendido** | O desafio é de uma empresa (Vitrus), que atribui o prémio | Números reais da Vitrus e do INE, regulação 2025 e 2028 | Slide do problema com fontes |
| **Uso dos dados disponíveis** | O desafio lista "dados disponíveis" | Todos os ficheiros usados; contentores quando chegarem | Ecrã de qualidade de dados |
| **Impacto: investimento e custo** | É a pergunta | €/t, investimento, custo anual, por cenário | Comparação A/B |
| **Viabilidade** | Guias de júris falam em "pode continuar depois do hackathon?" [F38] | Piloto de 3 meses em 2 freguesias; custos como pressuposto visível | Recomendador de piloto (em construção) |
| **Demo a funcionar** | Standard dos júris | Demo em direto com plano B em vídeo | Demo ensaiada 3 vezes |
| **Inovação (IA com sentido)** | É a vantagem da equipa | IA conduz o otimizador, nunca inventa números | "E se...?" ao vivo |
| **Clareza do pitch** | Sempre | Uma ideia central, um número âncora | Narrativa e frases-âncora |

## Diferenciadores do Novelo

| Diferenciador | Porque conta | Estado a 19 out |
| --- | --- | --- |
| **Dados reais da Vitrus em todo o lado** (301,3 t, 40 circuitos, 29 viaturas) | Ninguém mais os tem | Feito |
| **Otimizador com três modos combináveis**, não uma folha de cálculo | Responde a "menor investimento e menor custo" | Feito |
| **A IA não faz contas; um verificador rejeita números inventados** | Confiança de quem decide | Feito |
| **Relatório RAP em PDF** com custo por tipo de território | Fala a linguagem de 2028 | Feito |
| **Lote com QR, passaporte público e bolsa de fibra** | Liga recolha à indústria | Feito |
| **Cobertura de contentores e lacuna face à referência francesa** | Um número que o júri nunca viu | Em construção (contentores chegam a 20 out) |
| **Análise de sensibilidade e robustez** | Transforma a ausência de custos em argumento | Em construção |
| **Cenário de "desempenho francês"** | Dá uma meta externa credível | Em construção |
| **Recomendador de piloto** (2 freguesias, KPIs a medir) | O pedido final do pitch | Em construção |
| **Copiloto de IA com ferramentas** | Conduz o simulador em conversa | Em construção |
| **Triagem com avaliação medida** (matriz de confusão) | "Medimos", não "prometemos" | Em construção |
| **Resolvedor de alertas de qualidade e briefing do relatório** | Automação | Em construção |

**Regra de corte:** só entra no pitch o que estiver integrado, testado e ensaiado **na véspera (25 de outubro)**. O que estiver "em construção" nessa data fica para a secção "próximos passos".

## Riscos e respostas

| Risco | Gravidade | Resposta |
| --- | --- | --- |
| Os custos unitários da Vitrus não chegam | Alta | Análise de sensibilidade: mostrar que a recomendação aguenta ±30% nos custos; dizer "estimativa" no ecrã |
| Contentores chegam com formato inesperado | Média | Importador tolerante já preparado; plano B: demo sem a camada |
| O júri pergunta pelas fontes dos 5,4% e dos "4 de 27" | Alta | Pedir já o documento ao mentor; até lá, não pôr esses números em slide |
| "Foi a IA que acertou?" | Média | Avaliação medida da triagem; o operador confirma |
| A França é só um benchmark; "não é meta" | Baixa | Dizer "referência" e mostrar também o potencial como teto |
| O desafio é da Vitrus: se o modelo ignora a operação real | Alta | Rotas e viaturas atuais já no modelo; falar com o Lucas sobre restrições |
| Falha de rede ou portátil na demo | Média | Vídeo de 60 s e relatório pré-gerado |
| Prometer demasiado ("substitui a triagem") | Alta | Lista "o que prometemos e o que não" em [Tecnologia de triagem](../pesquisa/tecnologia-de-triagem.md#o-que-prometemos-e-o-que-não) |
| Datas da regulação mal ditas | Média | Só usar as datas marcadas como Primária no registo |
| Equipa cansada no dia 26 | Média | Ensaios no dia 25 e dormir; congelar o código a 24 à noite |

## Plano dia a dia

Propostas de responsabilidade; ajustar entre os dois. **H** = Hélder Gonçalves, **F** = Flávio Fernandes.

```mermaid
gantt
    dateFormat  YYYY-MM-DD
    axisFormat  %d
    section Vitrus e mentores
    Perguntas ao Lucas e ao Prof. Paulo    :a1, 2026-10-19, 1d
    Receber contentores e custos            :a2, 2026-10-20, 1d
    Contactos à indústria (Sasia, CITEVE)   :a3, 2026-10-20, 3d
    section Produto
    Backend: cobertura, sensibilidade, copiloto :b1, 2026-10-19, 2d
    Ecrãs novos e integração                :b2, 2026-10-21, 2d
    Congelar código                         :milestone, b3, 2026-10-24, 0d
    section Pitch
    Narrativa e números verificados         :c1, 2026-10-20, 3d
    Deck e vídeo plano B                    :c2, 2026-10-23, 2d
    Ensaios (3) e perguntas do júri         :c3, 2026-10-25, 1d
    Pitch                                   :milestone, c4, 2026-10-26, 0d
    Resultados                              :milestone, c5, 2026-10-28, 0d
```

| Dia | Foco | Hélder | Flávio | Fim do dia |
| --- | --- | --- | --- | --- |
| **Seg 19** | Arranque | Confirmar inscrição; falar com o Lucas (perguntas abaixo); pedir o plano municipal | Backend em curso (cobertura, sensibilidade, copiloto); `just check` verde | Perguntas enviadas, inscrição confirmada |
| **Ter 20** | Dados novos | Receber contentores e custos; correr ETL; escrever a Sasia, Recutex e CITEVE | Camada de contentores e cobertura no mapa e no simulador | Contentores no mapa, lacuna calculada |
| **Qua 21** | Integrar | Rever números e registo; ligar com o Prof. Paulo (revisão do modelo) | Ecrãs: sensibilidade, cenário francês, recomendador de piloto | Três cenários prontos (A, B, francês) |
| **Qui 22** | Copiloto e triagem | Medir a triagem (30 a 50 peças); resposta de um reciclador | Copiloto no web (⌘K) e resolvedor de alertas | Avaliação da triagem publicada |
| **Sex 23** | Fechar produto | Narrativa final; slides em rascunho | Polimento, E2E completo, imagens de produção | **Código congelado à noite** |
| **Sáb 24** | Deck | Deck e guião; vídeo de 60 s | Plano B (relatório pré-gerado, dados offline); deploy no Coolify | Deck v1 e vídeo |
| **Dom 25** | Ensaio | 3 ensaios cronometrados, perguntas do júri | Ensaio técnico (rede, projetor, telemóvel do jurado para o QR) | Registo de afirmações impresso e verificado |
| **Seg 26** | **Pitch** | Apresenta | Opera a demo | — |
| **Qua 28** | Resultados | — | — | — |

## Perguntas para os mentores e contactos

### Lucas Nascimento (Vitrus Ambiente), mentor

Prioridade máxima, hoje. Enviar por escrito e marcar 15 minutos.

1. **Custos:** custo por recolha, por quilómetro e por contentor (aquisição, instalação, manutenção); vida útil; custo de mão de obra por turno.
2. **Depósito:** localização real de onde saem os circuitos e para onde vai o material.
3. **Contentores:** quantos têxteis existem, de que operador, que estado, e quando chega o ficheiro.
4. **Preços:** a que preço a Vitrus ou os operadores vendem a reutilização, a reciclagem e quanto custa o rejeito.
5. **Plano municipal:** enviar o documento de onde vêm os 5,4%, os 0,7 kg por habitante por mês e os "4 de 27 operadores".
6. **Júri:** critérios de avaliação, duração do pitch, quem está no júri.
7. **Restrições operacionais:** o que não se pode propor (turnos, sindicatos, contratos, equipamentos).
8. **Piloto:** haveria disponibilidade para um piloto de 3 meses em duas freguesias?
9. **RAP:** a Vitrus sabe quem será a candidata a entidade gestora?

### Prof. Paulo Afonso (UMinho, Produção e Sistemas)

1. Revisão de 15 minutos ao modelo: localização (CP-SAT), rotas (VRP), fator de desvio 1,3 e metodologia de sensibilidade.
2. Opinião sobre a metodologia de cobertura (raio a pé) e o recomendador de piloto.
3. Apoio académico ou espaço para avaliar o piloto.

### Contactos à indústria e à economia social

| Contacto | Mensagem curta | Prova que queremos |
| --- | --- | --- |
| **Sasia** (Miguel Silva, administrador) | "Estamos a desenhar lotes de têxtil pós-consumo por composição para o Vale do Ave. A que critérios de composição, cor e limpeza compram, e a que preço?" | Uma frase com critérios e preço |
| **Recutex** | Mesma pergunta | Se trabalham com pós-consumo |
| **CITEVE** | "Pode comentar o passaporte do lote e a classificação por fibra? Há ligação ao RegioGreenTex?" | Validação técnica e rede |
| **Humana** (ou outra entidade de economia social) | "Como articulam novos pontos municipais com os vossos? Têm dados de triagem?" | Parceria e dados reais |
| **Wippytex** | "Como trabalham com 30 municípios e o que pedem às câmaras?" | Boas práticas |
| **Município / Let's Go Circular** | "Pode partilhar o plano de ação de circularidade têxtil?" | A fonte dos 5,4% |

## O que nunca fazer no pitch

- Dizer um número que não esteja no [registo](../pesquisa/registo-de-afirmacoes.md).
- Dizer que a IA "identifica a fibra" ou "substitui a triagem".
- Afirmar que a diretiva fixa metas de recolha de têxteis.
- Mostrar uma funcionalidade "em construção" sem a ter ensaiado.
- Comparar-nos à França como se fosse uma promessa.

Ver [Narrativa do pitch](narrativa-do-pitch.md) e [Guião de slides](pitch-slides.md).
