# Perguntas do júri

Respostas curtas, para dizer em 20 segundos cada. Quem responde a cada tema fica decidido no dia 4.

## Sobre o problema e o valor

**"A Vitrus não pode simplesmente pôr contentores em todo o lado?"**

A Vitrus não quer: o têxtil de contentor vem contaminado e perde a reutilização, que é onde está o valor (reciclar custa mais que a fibra virgem). E um contentor custa e é recolhido mesmo onde quase não há têxtil. O Novelo propõe uma rede sem contentores: uma viatura de têxtil nova, sem compactação, recolhe o saco fechado à porta num dia fixo por freguesia e para nos locais municipais que já existem e nas escolas.

**"Os números são reais?"**

Os dados de partida sim: as 301,3 t recolhidas em 2025, o destino de cada tonelada, os 40 circuitos e 29 viaturas vêm da Vitrus; a população (156 830) vem do INE; as 43 050,5 t de indiferenciado recolhidas em 2025 e a parte do concelho que representam (84,0%) vêm do Relatório e Contas 2025 da Vitrus; os 5,86% de têxtil vêm da APA (2025), base que a própria Vitrus nos indicou a 22 de outubro ([Q6](perguntas-aos-orientadores.md#q6-o-que-significam-07-kghabmês-e-54), [registo de afirmações](../pesquisa/registo-de-afirmacoes.md)). Daí as cerca de 3 003 t por ano que ainda vão para o lixo e a captura de 9,1%, sempre apresentadas como estimativa. O custo de tratamento, 105,64 €/t, também é da Vitrus. As toneladas por cenário são estimativas do nosso modelo, e dizemos isso no ecrã. O piloto existe para as confirmar.

**"Quem paga isto?"**

Hoje, o município, sozinho. A responsabilidade alargada do produtor tem de existir até 17 de abril de 2028, mas os produtores só pagam o custo eficiente das peças postas à venda depois da lei nacional (Diretiva (UE) 2025/1892, art. 22.º-A, n.º 11). O têxtil que já está nas casas continua anos a pesar no município; a leitura exata confirmamos com a APA. Esse custo eficiente determina-se com as autoridades locais (n.º 7 e 12). Em todos os casos alguém precisa de saber o custo por tonelada, e é isso que o Novelo calcula.

**"Mais toneladas garantem material reutilizável?"**

Não, e por isso medimos toneladas reutilizáveis. A qualidade depende de quem recolhe: em 2025 a Ultriplo reutilizou 72,9% do que recolheu e a H Sarah Trading 50,0% (kg por destino), a Nova Etapa 50% (relatório) e o têxtil recolhido pela Vitrus 9,2%, com 56,9% de rejeito (relatório da To Be Green, 5,6 t). No cenário de 60 000 €/ano são 256,1 t reutilizáveis por ano, entre 215,6 e 314,1 t, a 171,5 € por tonelada reutilizável (estimativa; [registo](../pesquisa/registo-de-afirmacoes.md), A19, H1 e H2).

**"A rede só vai onde a tonelada é barata?"**

Não. A diretiva pede uma rede que não se limite às zonas rendíveis (art. 22.º-C, n.º 9, b)). O separador Cobertura de cada cenário mostra-o por tipo de território: no cenário de 60 000 €/ano, fora das freguesias urbanas fica servida 55,5% da população, contra 72,8% nas urbanas (estimativa; H4). Dizemos também o que falta: Arosa e Castelões, a única freguesia predominantemente rural, fica sem serviço neste orçamento; é uma das duas freguesias do piloto recomendado.

**"O saco de têxtil não acaba no compactador?"**

Não. Perguntámos à Vitrus a 22 de outubro: o saco iria para a caixa de compactação e estragava-se, e cabine, gancho ou caixa lateral também não são possíveis. Um compactador também não pode fazer uma volta só de têxtil, por contaminação, e não há viaturas livres à tarde. Por isso a rede usa o que a Vitrus indicou: uma viatura de têxtil nova, sem compactação (registo A21, A22, A28).

**"Uma viatura nova não contraria o 'menor investimento'?"**

É uma viatura e nenhum contentor, contra um contentor por ponto em todo o concelho. A viatura custa 42 500 € (5 312,50 € por ano em 8 anos; concurso público de Vila Nova de Gaia para uma viatura de caixa fechada). E cada tonelada que sai do lixo deixa de pagar 105,64 € de tratamento em aterro (40 €/t de taxa de gestão de resíduos e 65,64 €/t da Resinorte, valores da Vitrus). Com 60 000 €/ano, a rede custa 43 914 € por ano, viatura incluída, e o tratamento evitado é de 45 542 €: paga a operação (35 702 €) e, por pouco, o custo total (custo líquido −1 628 € por ano; estimativa; H3, H10). Nos casos pessimistas do intervalo (P90: 139,7 €/t) já não chega. Os custos por hora e por km da viatura ainda são pressupostos, à vista e com intervalo (registo A23, A25).

## Sobre a tecnologia

**"Porque não sensores de enchimento nos contentores?"**

Custam dinheiro por contentor e o desafio pede o menor investimento. O Novelo funciona sem hardware; sensores podem entrar mais tarde, nos pontos onde os dados mostrarem que compensam.

**"As rotas são reais ou linhas retas?"**

Medimos as rotas pela estrada, com o OpenStreetMap, num servidor nosso e sem custos. Os quilómetros e o traçado de cada rota vêm daí, e cada rota diz se é «por estrada» ou estimativa (só é estimativa se o servidor de mapas falhar). Há uma parte que continua a ser fórmula, e dizemo-lo no ecrã: a volta porta a porta dentro de cada freguesia, que depende da área e do número de sacos. As horas de viatura usam 30 km/h de recolha, um pressuposto; o OpenStreetMap indica cerca de 40 km/h de condução, sem trânsito. Os dados do mapa são © colaboradores do OpenStreetMap (ODbL).

**"A triagem por foto é fiável?"**

Para separar reutilizável, reciclável e rejeito, serve como primeira triagem e gera dados; o operador pode corrigir. A composição e a marca vêm da etiqueta, que é texto. Não substitui a triagem final do operador, e não dizemos que substitui.

**"Isto não é o que a To-Be-Green já faz?"**

Não. A To-Be-Green trabalha com o cidadão e a reutilização. O Novelo é para quem opera a recolha: onde, como e a que custo. São complementares.

## Sobre a IA, os lotes e os dados

**"E se a IA se enganar nos números?"**

A IA não faz contas. Traduz a pergunta numa alteração ao cenário, mostra "Entendi: ..." para confirmarmos, e quem calcula é o otimizador. Um verificador rejeita qualquer número na resposta que não venha do resultado calculado.

**"Ler a marca na etiqueta não levanta problemas de privacidade?"**

Não guardamos nada de quem entrega a peça. A triagem não guarda as fotografias: ficam marca, composição, estado e peso. Desde 23 out 2026 há uma novidade, e dizemo-la: o operador pode guardar uma miniatura da peça, mas só se a pedir, sem metadados, com confirmação de que não mostra pessoas, e é apagada ao fim de 90 dias ou quando quiser. A marca é de uma empresa, não de uma pessoa. Detalhe em [Privacidade das fotografias](../engenharia/privacidade-fotografias.md).

**"As fotos ficam guardadas?"**

Na triagem, não: existem em memória durante o pedido. Só se guarda uma miniatura se o operador a pedir, sem metadados, sem pessoas, apagada ao fim de 90 dias ou quando quiser. É uma avaliação técnica nossa, a validar com a entidade responsável pelos dados.

**"Os recicladores querem mesmo estes lotes?"**

O próprio plano municipal diz que falta têxtil limpo e homogéneo para haver mercado de matérias-primas secundárias, e, segundo o plano, só 4 dos 27 operadores licenciados da zona valorizam têxteis (plano municipal, p. 32; número por confirmar). Lotes separados por fibra são exatamente o que falta. O piloto valida com eles.

**"Porque não usam blockchain no passaporte?"**

Porque um registo com histórico na base de dados chega para rastrear lotes. O valor está nos dados que o passaporte leva, não na tecnologia por baixo.

**"Quanto custa a IA a funcionar?"**

Uma ou duas chamadas por peça triada e uma por pergunta "E se...?", com limites e cache. O custo real por peça é uma das métricas do piloto.

## Sobre o futuro

**"Funciona noutro município?"**

Sim. Usa dados abertos que todos os concelhos têm (INE, OpenStreetMap para a rede viária, CAOP) mais os custos do operador local, e todos têm a mesma obrigação de recolha.

**"O que fariam nos próximos 3 meses?"**

Um piloto em duas freguesias com a Vitrus, um modo de recolha de cada tipo, e comparar toneladas e custos reais com o previsto.

**"Qual é a maior limitação?"**

Os custos unitários. Sem os da Vitrus, usamos valores de referência. Com eles, o modelo fica muito mais preciso, e é a primeira coisa que pedimos. Logo a seguir, a viatura: o mapa assume uma furgoneta de 2,8 × 2,1 × 6 m e 3,5 t até a Vitrus indicar a verdadeira.

## Mais perguntas

As objeções que a [pesquisa](../pesquisa/README.md) acrescentou (custos inventados, comparação com a França, quem paga em 2028, economia social, indústria, diretiva) estão na [narrativa do pitch](narrativa-do-pitch.md#objeções-do-júri-e-respostas).
