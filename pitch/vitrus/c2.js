'use strict';
/** Parte 2: o modelo (arquitetura, procura, custos, viatura, estradas, pressupostos, IA). */
const L = require('./lib');
const { pres, C, H, MX, CW, W, slide, section, card, stat, iconRow, bullets, pill, table, arrow, stepBox, shot, text, chartBase, img, ic, THEME } = L;

function arquitetura() {
  // 14. Arquitetura
  {
    const s = slide({
      kicker: 'Anexo A2', title: 'Um contrato único liga os dados, o otimizador e a app: o que o ecrã mostra é o que a API calcula',
      time: 'anexo', core: false,
      sources: '«Arquitetura» · produção: novelo.helder.si (Coolify numa VPS)',
      notes: 'A arquitetura, para quem vai manter isto. Da esquerda para a direita. Os dados brutos, Excel e QGIS, entram por um ETL em Python que gera ficheiros limpos e regeneráveis. Esses ficheiros importam-se para uma base PostgreSQL, num seed idempotente. A API é FastAPI em Python 3.12, organizada por funcionalidades, e o domínio, as fórmulas e a otimização, são funções puras, testadas com valores calculados à mão. O otimizador é OR-Tools: CP-SAT para escolher locais e modos, e VRP para as rotas. As distâncias vêm de um OSRM nosso sobre o OpenStreetMap. A IA, via OpenRouter, só traduz perguntas e explica resultados. Depois o contrato OpenAPI é exportado e dele geramos o cliente TypeScript: a app web nunca faz fetch à mão. A app é React com TanStack, instalável como aplicação. Tudo corre em contentores, em produção numa VPS gerida pelo Coolify, com deploy a cada merge na main. O repositório é público.',
    });
    const y = 1.95; const bw = 2.2; const bh = 2.55; const g = 0.28;
    const boxes = [
      ['Database', 'Dados brutos', 'Excel da Vitrus, pacote QGIS, INE, CAOP, OSM (em data/raw, fora do Git)'],
      ['Wrench', 'ETL e base de dados', 'just etl gera data/processed; seed idempotente para o PostgreSQL'],
      ['Cpu', 'API e domínio', 'FastAPI; fórmulas e otimização em funções puras; OR-Tools'],
      ['Code', 'Contrato OpenAPI', 'Exportado e versionado; cliente TypeScript gerado (hey-api)'],
      ['Smartphone', 'App web', 'React, TanStack, Tailwind, shadcn/ui; PWA em telemóvel'],
    ];
    boxes.forEach(([icn, t, sub], i) => {
      const x = MX + i * (bw + g);
      stepBox(s, x, y, bw, bh, icn, t, sub, { subSize: 11.5 });
      if (i < boxes.length - 1) arrow(s, x + bw + 0.03, y + bh / 2, x + bw + g - 0.03, y + bh / 2);
    });
    // serviços externos
    card(s, MX, 4.8, CW, 1.85, { fill: C.background1, name: 'servicos' });
    text(s, 'Serviços ligados à API', { x: MX + 0.3, y: 4.9, w: 4, h: 0.3, fontSize: 14, bold: true, color: C.accent1 });
    iconRow(s, MX + 0.3, 5.4, 3.9, 'Route', 'OSRM próprio', 'Estradas do OpenStreetMap; km e traçado reais', { h: 1.1, descSize: 11.5, titleSize: 14 });
    iconRow(s, MX + 4.45, 5.4, 3.9, 'BrainCircuit', 'OpenRouter (IA)', 'Só traduz e explica; nunca faz contas', { h: 1.1, descSize: 11.5, titleSize: 14 });
    iconRow(s, MX + 8.6, 5.4, 3.5, 'Server', 'Coolify numa VPS', 'Deploy por contentores a cada merge na main', { h: 1.1, descSize: 11.5, titleSize: 14 });
  }

}

module.exports = function build() {
  section('03', 'O modelo', 'Da pergunta ao otimizador: como se calcula, com que pressupostos e o que a IA pode e não pode fazer.', 'Terceiro bloco: o modelo. Para quem vai dar seguimento, é a parte que importa mais: como se chega a cada número, o que é pressuposto e onde mexer.', '0:36');

  // 15. Do problema ao otimizador
  {
    const s = slide({
      kicker: 'O modelo em quatro passos', title: 'A procura, a escolha de locais, as rotas e os custos: quatro passos, e cada um é verificável',
      time: '0:40', core: true,
      sources: '«Dados e modelo», secções 1 a 3 e 8 · Beardwood, Halton e Hammersley (1959)',
      notes: 'O modelo tem quatro passos. Um: a procura. Para cada freguesia, o têxtil por desviar é a população vezes o têxtil por habitante vezes doze meses. Dois: a captura: o que se capta depende do modo que serve a zona, existente ou saco à porta, e de uma taxa de captura por modo, que é pressuposto até haver dados do terreno. Três: a escolha. O CP-SAT, do OR-Tools, decide que locais abrir e que modo serve cada zona, para maximizar as toneladas dado um orçamento, ou minimizar o custo dada uma meta. Uma zona só conta como servida se houver um ponto dentro da distância a pé. Quatro: as rotas. O VRP calcula as viagens da viatura a partir do estaleiro, com capacidade de 2 toneladas e distâncias pelas estradas reais. No fim, os KPIs: investimento, custo anual, toneladas, euros por tonelada, população coberta, têxtil reutilizável, tratamento evitado e custo líquido. Tudo determinístico, com sementes fixas e limite de tempo do solver.',
    });
    const steps = [
      ['1', 'Procura', 'D = P × q × 12', 'População × 1,596 kg/hab/mês × 12. Igual por habitante em todas as freguesias (pressuposto).'],
      ['2', 'Captura', 'C = D × c', 'Taxa de captura por modo: 18% local existente, 25% saco à porta (pressupostos a calibrar).'],
      ['3', 'Escolha (CP-SAT)', 'max Σ t·y, Σ custo·x ≤ orçamento', 'Que locais abrir e que modo serve cada zona; ou custo mínimo para uma meta.'],
      ['4', 'Rotas (VRP)', 'viatura 2 t, estaleiro, estrada', 'Viagens a partir de Polvoreira com distâncias pelo OSRM; volta da freguesia por fórmula.'],
    ];
    const bw = 2.9; const g = 0.17;
    steps.forEach(([n, t, f, d], i) => {
      const x = MX + i * (bw + g);
      L.rule(s, x, 1.95, bw, { color: H.tinta });
      text(s, n, { x: x + 0.22, y: 2.05, w: 0.6, h: 0.6, fontFace: THEME.headFontFace, fontSize: 30, bold: true, color: C.accent1, valign: 'middle' });
      text(s, t, { x: x + 0.85, y: 2.05, w: bw - 1.0, h: 0.6, fontSize: 14.5, bold: true, valign: 'middle' });
      text(s, f, { x: x + 0.22, y: 2.85, w: bw - 0.44, h: 0.5, fontFace: 'Courier New', fontSize: 11.5, bold: true, color: C.accent1, valign: 'middle' });
      text(s, d, { x: x + 0.22, y: 3.45, w: bw - 0.44, h: 1.45, fontSize: 12, color: H.cinza });
    });
    table(s, [
      ['KPI de saída', 'Como se calcula', 'Selo'],
      ['Custo anual', 'investimento ÷ vida útil + recolhas × custo + km × custo por km (viatura incluída)', 'estimativa'],
      ['€/t', 'custo anual ÷ toneladas captadas', 'estimativa'],
      ['Tratamento evitado', 'toneladas × 105,64 €/t (Vitrus)', 'estimativa'],
      ['Custo líquido', 'custo anual − tratamento evitado (pode ser negativo)', 'estimativa'],
    ], { x: MX, y: 5.0, w: CW, cols: [2.4, 8.2, 1.53], size: 12, rowH: 0.36, name: 'kpis-saida' });
  }

  // 16. Viatura dedicada
  {
    const s = slide({
      kicker: 'A viatura dedicada', title: 'Toda a recolha de têxtil é feita por uma viatura nova de caixa fechada, com pressupostos à vista',
      time: '0:43', core: true,
      sources: 'Vitrus, 22 out 2026 · Município de Vila Nova de Gaia, TED 338951-2024 (lote VII) e adjudicação TED 72690-2025 (42 500 €; confirmar no Base) · pressupostos da equipa',
      numbers: ['42 500 €', '5 312,50 €/ano', '2 t', '30 km/h', '1 820 h/ano'],
      notes: 'A viatura nova é o elemento do desenho que mais pesa no custo, por isso está toda à vista. O preço, 42 500 euros sem IVA, vem de uma adjudicação do Município de Vila Nova de Gaia, de um veículo pesado de mercadorias com caixa fechada: está no anúncio TED, e falta confirmá-lo no portal Base. Vida útil de oito anos, o que dá 5 312,50 euros por ano. Carga útil de 2 toneladas, nosso pressuposto para uma caixa fechada até cerca de 5 toneladas de peso bruto: falta validar com a ficha técnica da viatura que a Vitrus vier a escolher. Velocidade média em recolha de 30 km/h, que inclui manobras e paragens curtas; a condução medida no OSRM anda nos 40, mas as horas continuam a usar 30, por prudência. Dois minutos por saco à porta, dez minutos por local. Um turno de sete horas, cinco dias, 52 semanas: 1 820 horas por ano por viatura. Quando as horas passam disso, o modelo compra uma segunda viatura. Tudo isto são pressupostos editáveis; a Vitrus tem os valores reais.',
    });
    const items = [['42 500 €', 'preço sem IVA', 'adjudicação de Gaia (TED); pressuposto com fonte'], ['8 anos', 'vida útil', '5 312,50 € por ano'], ['2 t', 'carga útil', 'caixa fechada, sem compactação'], ['30 km/h', 'velocidade em recolha', 'inclui manobras (medido no OSRM: ~40)'], ['1 820 h', 'por viatura e ano', '7 h × 5 dias × 52 semanas'], ['2 · 10 min', 'por saco · por local', 'tempo de paragem']];
    items.forEach(([big, lab, sub], i) => {
      const col = i % 3; const row = Math.floor(i / 3);
      stat(s, MX + col * 2.95, 1.95 + row * 2.3, 2.75, 2.1, big, lab, sub, { bigSize: 26, subSize: 11 });
    });
    card(s, 9.55, 1.95, 3.2, 4.4, { fill: C.background1, name: 'regras-viatura' });
    text(s, 'Como se contam as viaturas', { x: 9.75, y: 2.07, w: 2.85, h: 0.5, fontSize: 14, bold: true, color: C.accent1 });
    bullets(s, ['Horas = km ÷ 30 + paragens × minutos', 'Viaturas = horas ÷ 1 820, arredondado para cima', '1 viatura logo que a rede recolha algo', 'Dia e viatura atribuídos por regra determinista'], { x: 9.75, y: 2.65, w: 2.85, h: 3.6, size: 12, gap: 8 });
    text(s, 'Pendente: carga útil real, preço da viatura escolhida e custos por hora e por km (Vitrus).', { x: MX, y: 6.5, w: 8.7, h: 0.4, fontSize: 12, italic: true, color: C.accent6 });
  }

  // 17. Rotas por estrada
  {
    const s = slide({
      kicker: 'Rotas por estrada', title: 'Os quilómetros vêm das estradas reais e o desvio medido é maior do que a nossa estimativa inicial',
      time: '0:46', core: false,
      sources: 'OSRM sobre OpenStreetMap (Geofabrik, extrato de 20 out 2026, ODbL) · calibração de 23 out 2026 («Rotas por estrada»)',
      notes: 'As rotas não são linhas retas. Montámos um servidor OSRM nosso sobre o OpenStreetMap de Portugal, com um perfil de furgoneta de 2,8 metros de altura, 2,1 de largura, 6 de comprimento e 3,5 toneladas, porque a Vitrus ainda não nos disse que viatura vai usar. Cada rota do ecrã diz se foi medida por estrada ou estimada. Só se o OSRM não responder, ou se um par de pontos não tiver caminho, usamos a estimativa: linha reta vezes 1,3. E calibrámos: o desvio real, estrada a dividir por linha reta, tem mediana de 1,48 nas 48 freguesias e de 1,37 em 300 locais candidatos. Ou seja, o nosso 1,3 inicial era otimista, e foi por isso que passámos a usar estrada. Uma nota importante: a volta dentro de cada freguesia, no porta a porta, é sempre estimativa por fórmula, a de Beardwood, Halton e Hammersley, porque não temos moradas de paragens para pedir ao OSRM. Cada ronda é uma viagem própria a partir do estaleiro, por isso é um teto.',
    });
    stat(s, MX, 1.95, 3.0, 1.9, '1,48', 'desvio mediano, freguesias', 'estrada ÷ linha reta; 48 freguesias', { bigSize: 32 });
    stat(s, MX + 3.2, 1.95, 3.0, 1.9, '1,37', 'desvio mediano, locais', '300 locais candidatos', { bigSize: 32 });
    stat(s, MX + 6.4, 1.95, 3.0, 1.9, '1,3', 'estimativa inicial', 'pressuposto nosso: otimista', { bigSize: 32, color: H.bronze });
    table(s, [
      ['Tipo de distância', 'Origem', 'Selo no ecrã'],
      ['Estaleiro → locais e entre locais', 'OSRM (OpenStreetMap)', 'source = road'],
      ['Sem resposta do OSRM ou sem caminho', 'linha reta × 1,3', 'source = estimate'],
      ['Volta dentro da freguesia (porta a porta)', 'fórmula 0,7124 · √(n · área) × desvio', 'sempre estimativa'],
    ], { x: MX, y: 4.1, w: 9.4, cols: [3.9, 3.5, 2.0], size: 12, rowH: 0.52, name: 'tipos-distancia' });
    card(s, 10.2, 1.95, 2.55, 4.5, { fill: C.background1, name: 'perfil-osrm' });
    text(s, 'Perfil novelo-van', { x: 10.4, y: 2.07, w: 2.2, h: 0.3, fontSize: 14, bold: true, color: C.accent1 });
    bullets(s, ['2,8 m de altura', '2,1 m de largura', '6,0 m de comprimento', '3 500 kg', '~40 km/h em condução (sem trânsito)'], { x: 10.4, y: 2.5, w: 2.2, h: 3.8, size: 12, gap: 6 });
  }

  // 18. Pressupostos
  {
    const s = slide({
      kicker: 'Pressupostos', title: 'Estes são os pressupostos que mais pesam, e a Vitrus pode substituir vários por valores reais',
      time: '0:49', core: true,
      sources: '«Dados e modelo», secção «Pressupostos» · ecrã de pressupostos da aplicação',
      notes: 'Esta tabela é o pedido de ajuda mais concreto que podemos fazer. São os pressupostos que mais mexem nos resultados. Captura de 18 por cento num local existente e 25 por cento no saco à porta: não há dado local, são pressupostos que o piloto ou a recolha real calibram. Custo por recolha, 6 euros, e por quilómetro, 1,10 euros: pedimos ao financeiro da Vitrus os euros por hora e por quilómetro das viaturas, e ainda não chegaram; quando chegarem, substituem estes dois. Vinte e cinco quilos por saco à porta. Ronda a cada duas semanas. Cada um está no ecrã de pressupostos, com a origem escrita e editável, e entra na análise de sensibilidade. A regra: nenhum valor entra no código sem uma linha na documentação com fonte. Os maiores fatores de incerteza do cenário central são precisamente a captura e a cobertura dos locais existentes, o têxtil por habitante, o custo de uma recolha e os quilos por saco.',
    });
    table(s, [
      ['Pressuposto', 'Valor', 'Selo', 'Quem o fecha'],
      ['Captura: local existente · saco à porta', '18% · 25%', 'pressuposto', 'recolha real / piloto'],
      ['Custo por recolha · por km', '6 € · 1,10 €', 'pressuposto', 'financeiro da Vitrus'],
      ['Quilos por saco à porta', '25 kg', 'pressuposto', 'recolha real'],
      ['Frequência da ronda porta a porta', 'a cada 2 semanas', 'pressuposto', 'operação da Vitrus'],
      ['Investimento num local existente', '250 € por ponto, 5 anos', 'pressuposto', 'Vitrus (tempo e custo da paragem)'],
      ['Viatura: preço · vida · carga', '42 500 € · 8 anos · 2 t', 'pressuposto com fonte', 'Vitrus (viatura escolhida)'],
      ['Têxtil no indiferenciado', '5,86%', 'estimativa (APA)', 'caracterização local'],
      ['Custo de tratamento do indiferenciado', '105,64 €/t', 'medido', 'Vitrus, 22 out 2026'],
      ['Quota de reutilização', '59,4% (50,0% a 72,9%)', 'estimativa (fluxos 2025)', 'qualidade por canal'],
    ], { x: MX, y: 1.9, w: CW, cols: [4.4, 2.9, 2.3, 2.53], size: 12, rowH: 0.44, name: 'pressupostos' });
    text(s, 'Todos editáveis em /assumptions, com a origem escrita. Nenhum valor entra no código sem uma linha na documentação com fonte.', { x: MX, y: 6.7, w: CW, h: 0.3, fontSize: 11.5, italic: true, color: H.cinza });
  }

  // 19. IA
  {
    const s = slide({
      kicker: 'Inteligência artificial', title: 'A IA traduz e explica; quem calcula é o otimizador, e um verificador rejeita números sem origem',
      time: '0:52', core: true,
      sources: '«IA» · «Funcionalidades», secção 1',
      notes: 'Esta é a regra de ouro da IA no Novelo: a IA nunca faz contas. Vejam o fluxo do «E se...?». O utilizador escreve uma pergunta em português. O modelo traduz para uma alteração estruturada, validada, com listas fechadas de freguesias, modos e parâmetros. O ecrã mostra primeiro «Entendi: ...» para o utilizador confirmar antes de calcular. O otimizador corre o cenário novo e devolve os números. O modelo escreve a explicação a partir desse resultado. E um verificador compara todos os números do texto com os do resultado: se algum não existir, a resposta é rejeitada e regenerada; à segunda falha, mostra-se só a tabela. Pergunta ambígua, o sistema pergunta de volta. Freguesia ou modo inexistente, recusa. Cada resposta guarda a pergunta, a alteração, o cenário e a versão do prompt. Sem chave de IA a aplicação arranca e as funcionalidades de IA respondem 503: o resto funciona. A triagem por foto usa o mesmo princípio: o modelo sugere, a pessoa confirma.',
    });
    const y = 2.0; const bw = 2.15; const g = 0.345;
    const flow = [['MessageSquare', 'Pergunta em português', '«E se o orçamento subir para 90 000 €?»'], ['BrainCircuit', 'Modelo traduz', 'Devolve só uma alteração estruturada, validada'], ['Eye', '«Entendi: ...»', 'O utilizador confirma antes de calcular'], ['Calculator', 'Otimizador calcula', 'OR-Tools, os mesmos cenários de sempre'], ['ShieldCheck', 'Verificador', 'Rejeita qualquer número fora do resultado']];
    flow.forEach(([icn, t, sub], i) => {
      const x = MX + i * (bw + g);
      stepBox(s, x, y, bw, 2.5, icn, t, sub, { subSize: 11.5, dark: i === 3 || i === 4 });
      if (i < flow.length - 1) arrow(s, x + bw + 0.03, y + 1.2, x + bw + g - 0.03, y + 1.2);
    });
    card(s, MX, 4.75, 6.0, 1.95, { fill: C.background1, name: 'ia-faz' });
    text(s, 'A IA faz', { x: MX + 0.25, y: 4.85, w: 5.5, h: 0.3, fontSize: 14, bold: true, color: C.accent1 });
    bullets(s, ['Traduzir perguntas para alterações validadas', 'Explicar resultados, com a fonte', 'Sugerir tipo, estado, composição e marca de uma peça (a pessoa confirma)'], { x: MX + 0.25, y: 5.22, w: 5.5, h: 1.4, size: 12.5, gap: 5 });
    card(s, 6.75, 4.75, 6.0, 1.95, { fill: C.background1, name: 'ia-nao-faz' });
    text(s, 'A IA nunca faz', { x: 7.0, y: 4.85, w: 5.5, h: 0.3, fontSize: 14, bold: true, color: C.accent6 });
    bullets(s, ['Contas: todos os números vêm do otimizador ou da base de dados', 'Decisões: só propõe; só o clique executa e fica auditado', 'Guardar fotografias: a triagem usa-as só em memória'], { x: 7.0, y: 5.22, w: 5.5, h: 1.4, size: 12.5, gap: 5 });
  }
};
module.exports.arquitetura = arquitetura;
