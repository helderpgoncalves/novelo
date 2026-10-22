# Perguntas do júri

Respostas curtas, para dizer em 20 segundos cada. Quem responde a cada tema fica decidido no dia 4.

## Sobre o problema e o valor

**"A Vitrus não pode simplesmente pôr contentores em todo o lado?"**

A Vitrus não quer: o têxtil de contentor vem contaminado e perde a reutilização, que é onde está o valor (reciclar custa mais que a fibra virgem). E um contentor custa e é recolhido mesmo onde quase não há têxtil. O Novelo propõe uma rede sem contentores: paragem em locais onde a viatura já passa e recolha a pedido nos circuitos que existem.

**"Os números são reais?"**

Os dados de partida sim: as 301,3 t recolhidas em 2025, o destino de cada tonelada, os 40 circuitos e 29 viaturas vêm da Vitrus; a população (156 830) vem do INE; as 43 051 t de resíduos urbanos recolhidas em 2025 vêm da Vitrus e os 5,4% de têxtil vêm da APA, valor que a própria Vitrus nos indicou a 21 de outubro ([Q6](perguntas-aos-orientadores.md#q6-o-que-significam-07-kghabmês-e-54), [registo de afirmações](../pesquisa/registo-de-afirmacoes.md)). Daí as cerca de 2 324,8 t por ano que ainda vão para o lixo e a captura de 11,5%, sempre apresentadas como estimativa. As toneladas por cenário são estimativas do nosso modelo, e dizemos isso no ecrã. O piloto existe para as confirmar.

**"Quem paga isto?"**

Hoje, o município, sozinho. A responsabilidade alargada do produtor tem de existir até 17 de abril de 2028, mas os produtores só pagam o custo eficiente das peças postas à venda depois da lei nacional (Diretiva (UE) 2025/1892, art. 22.º-A, n.º 11). O têxtil que já está nas casas continua anos a pesar no município; a leitura exata confirmamos com a APA. Esse custo eficiente determina-se com as autoridades locais (n.º 7 e 12). Em todos os casos alguém precisa de saber o custo por tonelada, e é isso que o Novelo calcula.

**"Mais toneladas garantem material reutilizável?"**

Não, e por isso medimos toneladas reutilizáveis. A qualidade depende de quem recolhe: em 2025 a Ultriplo reutilizou 72,9% do que recolheu e a H Sarah Trading 50,0% (kg por destino), a Nova Etapa 50% (relatório) e o têxtil recolhido pela Vitrus 9,2%, com 56,9% de rejeito (relatório da To Be Green, 5,6 t). No cenário de 60 000 €/ano são 235,6 t reutilizáveis por ano, entre 198,3 e 288,9 t, a 203,1 € por tonelada reutilizável (estimativa; [registo](../pesquisa/registo-de-afirmacoes.md), A19, H1 e H2).

**"A rede só vai onde a tonelada é barata?"**

Não. A diretiva pede uma rede que não se limite às zonas rendíveis (art. 22.º-C, n.º 9, b)). O separador Cobertura de cada cenário mostra-o por tipo de território: no cenário de 60 000 €/ano, fora das freguesias urbanas fica servida 68,8% da população, contra 76,0% nas urbanas, a um €/t mais alto (estimativa; H4).

**"O saco de têxtil não acaba no compactador?"**

Não pode: no compactador, o saco mistura-se com o lixo e perde a reutilização, a contaminação que a Vitrus quer evitar. No planeamento de turnos que a Vitrus nos deu (semana de 21 a 25 de setembro de 2026), numa tarde de dia útil cerca de 15 das 29 viaturas não têm circuito. É um plano B: uma delas pode levar os sacos à parte. Falta validar com a Vitrus se o tipo de caixa e a equipa servem (A20).

## Sobre a tecnologia

**"Porque não sensores de enchimento nos contentores?"**

Custam dinheiro por contentor e o desafio pede o menor investimento. O Novelo funciona sem hardware; sensores podem entrar mais tarde, nos pontos onde os dados mostrarem que compensam.

**"A triagem por foto é fiável?"**

Para separar reutilizável, reciclável e rejeito, serve como primeira triagem e gera dados; o operador pode corrigir. A composição e a marca vêm da etiqueta, que é texto. Não substitui a triagem final do operador, e não dizemos que substitui.

**"Isto não é o que a To-Be-Green já faz?"**

Não. A To-Be-Green trabalha com o cidadão e a reutilização. O Novelo é para quem opera a recolha: onde, como e a que custo. São complementares.

## Sobre a IA, os lotes e os dados

**"E se a IA se enganar nos números?"**

A IA não faz contas. Traduz a pergunta numa alteração ao cenário, mostra "Entendi: ..." para confirmarmos, e quem calcula é o otimizador. Um verificador rejeita qualquer número na resposta que não venha do resultado calculado.

**"Ler a marca na etiqueta não levanta problemas de privacidade?"**

Não guardamos nada de quem entrega a peça. As fotografias são apagadas depois de processadas; ficam marca, composição, estado e peso. A marca é de uma empresa, não de uma pessoa.

**"Os recicladores querem mesmo estes lotes?"**

O próprio plano municipal diz que falta têxtil limpo e homogéneo para haver mercado de matérias-primas secundárias, e, segundo o plano, só 4 dos 27 operadores licenciados da zona valorizam têxteis (plano municipal, p. 32; número por confirmar). Lotes separados por fibra são exatamente o que falta. O piloto valida com eles.

**"Porque não usam blockchain no passaporte?"**

Porque um registo com histórico na base de dados chega para rastrear lotes. O valor está nos dados que o passaporte leva, não na tecnologia por baixo.

**"Quanto custa a IA a funcionar?"**

Uma ou duas chamadas por peça triada e uma por pergunta "E se...?", com limites e cache. O custo real por peça é uma das métricas do piloto.

## Sobre o futuro

**"Funciona noutro município?"**

Sim. Usa dados abertos que todos os concelhos têm (INE, mapas, rede viária) mais os custos do operador local, e todos têm a mesma obrigação de recolha.

**"O que fariam nos próximos 3 meses?"**

Um piloto em duas freguesias com a Vitrus, um modo de recolha de cada tipo, e comparar toneladas e custos reais com o previsto.

**"Qual é a maior limitação?"**

Os custos unitários. Sem os da Vitrus, usamos valores de referência. Com eles, o modelo fica muito mais preciso, e é a primeira coisa que pedimos.

## Mais perguntas

As objeções que a [pesquisa](../pesquisa/README.md) acrescentou (custos inventados, comparação com a França, quem paga em 2028, economia social, indústria, diretiva) estão na [narrativa do pitch](narrativa-do-pitch.md#objeções-do-júri-e-respostas).
