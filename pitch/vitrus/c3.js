'use strict';
/** Parte 3: resultados e cenários (demonstração 1). Os números vêm de data/*.json (API local, 11 nov 2026). */
const fs = require('node:fs');
const path = require('node:path');
const L = require('./lib');
const { pres, C, H, MX, CW, W, slide, section, card, stat, iconRow, bullets, pill, table, arrow, stepBox, shot, framed, text, chartBase, img, ic, THEME, nf } = L;

const rd = (f) => JSON.parse(fs.readFileSync(path.join(__dirname, 'data', f), 'utf8'));
const SCEN = rd('scenarios.json');
const B = rd('scenario-b.json');
const COV = rd('scenario-b-coverage.json');
const SENS = rd('scenario-b-sensitivity.json');
const S = (re) => {
  const x = SCEN.find((s) => re.test(s.label));
  if (!x) throw new Error(`cenário não encontrado: ${re}`);
  return x;
};
const TRAT = 105.64;
const avoided = (t) => t * TRAT;

module.exports = function build() {
  const K = B.result.kpis;

  section('04', 'Resultados e cenários', 'O que o otimizador devolve: comparar desenhos, orçamentos, cobertura e incerteza. Aqui a aplicação está aberta.', 'Quarto bloco: os resultados, com a aplicação aberta. Cada diapositivo tem o ecrã correspondente e o número que o resume; o que dizemos aqui é o que se vê lá. Se alguma coisa falhar ao vivo, os ecrãs estão nos diapositivos.', '0:55');

  // R1. Ponto de partida
  {
    const s = slide({
      kicker: 'Demonstração 1 · Ponto de partida', title: 'A primeira página põe os números da Vitrus à vista, cada um com o seu selo',
      time: '0:56', core: true,
      sources: 'novelo.helder.si (stack de dev local com dados reais, 11 nov 2026) · Vitrus 2025 · APA RARU 2025',
      app: { route: '/', steps: ['Mostrar a faixa de situação: 301,3 t medido; 9,1% estimativa; ≈ 3 003 t por desviar; dias até 17 abr 2028', 'Apontar os selos «medido» e «estimativa»: a regra da casa', 'Descer ao mapa «Onde se perde» e ao Top 10 de freguesias por têxtil por desviar', 'Mostrar a barra de confiança dos dados no fundo'], planB: 'diapositivo com a captura do ecrã' },
      notes: 'Esta é a página que se abre todos os dias. A faixa de cima são os mesmos quatro números de há bocado: 301,3 toneladas recolhidas, o selo «medido»; 9,1 por cento do têxtil gerado, «estimativa»; cerca de 3 003 toneladas por ano ainda no lixo, «estimativa»; e os dias até 17 de abril de 2028. Reparem nos selos: nenhum número aqui se apresenta como dado quando é estimativa. Em baixo, o mapa mostra onde o têxtil se perde, freguesia a freguesia, e o Top 10: Creixomil, Azurém, Oliveira São Paio e São Sebastião, Ponte. Atenção à nota: o têxtil por freguesia é proporcional à população, porque não há dados de têxtil por freguesia. A barra de confiança, no fundo, separa medido, estimado e em falta; à medida que houver recolha, o estimado vai passando a medido.',
    });
    shot(s, 'app-home.png', MX, 1.8, 7.9, 'Ponto de partida: 301,3 t medido, 9,1% estimativa, ≈ 3 003 t por desviar, dias até 17/04/2028 (agora 523, na data da captura)');
    iconRow(s, 8.95, 1.9, 3.8, 'ShieldCheck', 'Selos em todo o lado', 'Medido ou estimativa, sem exceção.', { h: 1.1, descSize: 12 });
    iconRow(s, 8.95, 3.15, 3.8, 'Map', 'Onde o têxtil se perde', 'Mapa e Top 10 por freguesia (proporcional à população).', { h: 1.2, descSize: 12 });
    iconRow(s, 8.95, 4.55, 3.8, 'Gauge', 'Confiança dos dados', 'Medido, estimado, em falta: evolui com a recolha.', { h: 1.2, descSize: 12 });
  }

  // R2. A vs B
  {
    const A = S(/Cenário A/);
    const Bs = S(/Cenário B · sem contentores \(proposta\) · 60 000 €\/ano$/);
    const s = slide({
      kicker: 'Demonstração 1 · Cenários A e B', title: 'A mesma pergunta, dois desenhos: o contentor de rua capta mais, mas a Vitrus não o quer e o modelo não conta a contaminação',
      time: '1:00', core: true,
      sources: 'Cenários «Demo · Cenário A» e «Demo · Cenário B», 60 000 €/ano, rotas pela estrada (11 nov 2026; modelo; estimativa) · Vitrus, 21 out 2026 (contaminação)',
      numbers: [`${nf(A.tonnes_year, 1)} t`, `${nf(Bs.tonnes_year, 1)} t`],
      app: { route: '/scenarios → Comparar', steps: ['Abrir a comparação A/B (Cenário A × Cenário B)', 'Ler a linha «Têxtil captado»: B fica 221 t abaixo de A', 'Apontar «Custo por tonelada» e «Custo anual»', 'Mostrar a caixa «Robustez da comparação»: 91% das amostras dão A melhor em €/t, e dizer porquê', 'Concluir: o contentor de rua é só referência'], planB: 'diapositivo com a captura' },
      notes: 'A comparação lado a lado. O cenário A é o modelo clássico: contentores de têxtil de rua por todo o concelho. O cenário B é o desenho que a Vitrus indicou: viatura nova, saco fechado à porta e paragens em locais que já existem, sem contentores. Honestidade primeiro: no modelo, o A capta mais, 652 toneladas contra 431, e fica mais barato por tonelada, 71,7 contra 101,9 euros. E a caixa de robustez diz que em 91 por cento das amostras o A ganha em euros por tonelada. Porque então propomos o B? Primeiro, porque a Vitrus não quer contentores, e com razão: o têxtil de contentor vem contaminado e perde a reutilização. Segundo, porque o modelo não desconta essa contaminação: o pressuposto de captura do contentor de rua, 28,6 por cento, é mais alto do que o do local existente, 18 por cento, mas nenhum dos dois traz a qualidade. Por isso o A fica como referência, nunca como proposta. A comparação existe para que a decisão seja vossa, com números à frente.',
    });
    shot(s, 'app-compare-ab.png', MX, 1.8, 6.6, 'Comparação A × B no ecrã /scenarios/compare');
    table(s, [
      ['', 'A · contentor de rua (referência)', 'B · sem contentores (proposta)'],
      ['Têxtil captado', `${nf(A.tonnes_year, 1)} t`, `${nf(Bs.tonnes_year, 1)} t`],
      ['Custo anual', `${nf(A.annual_cost_eur)} €`, `${nf(Bs.annual_cost_eur)} €`],
      ['Custo por tonelada', `${nf(A.eur_per_tonne, 1)} €/t`, `${nf(Bs.eur_per_tonne, 1)} €/t`],
      ['População coberta', `${nf(A.coverage_pct, 1)}%`, `${nf(Bs.coverage_pct, 1)}%`],
      ['Captura (pressuposto)', '28,6%', '18% e 25%'],
      ['Contaminação', 'não contada no modelo', 'controlo à porta e à entrada'],
    ], { x: 7.65, y: 1.85, w: 5.1, cols: [1.7, 1.75, 1.65], size: 11.5, rowH: 0.52, name: 'ab' });
    card(s, 7.65, 5.65, 5.1, 1.1, { fill: C.background1, name: 'nota-ab' });
    text(s, 'A fica como referência: a Vitrus não quer contentores de têxtil e o modelo não conta a contaminação.', { x: 7.85, y: 5.75, w: 4.7, h: 0.9, fontSize: 12.5, bold: true, color: C.accent6, valign: 'middle' });
  }

  // R3. Cenário B em números
  {
    const s = slide({
      kicker: 'Demonstração 1 · Cenário B em números', title: `Com 60 000 € por ano a rede gasta ${nf(K.annual_cost_eur)} €, capta ${nf(K.tonnes_year, 1)} t e o tratamento evitado cobre o custo`,
      time: '1:05', core: true,
      sources: 'Cenário «Demo · Cenário B · sem contentores (proposta) · 60 000 €/ano», rotas pela estrada (modelo; estimativa; 11 nov 2026) · 105,64 €/t (Vitrus) · ecrã /scenarios/{id}',
      numbers: [`${nf(K.tonnes_year, 1)} t`, `${nf(K.eur_per_tonne, 1)} €/t`, `${nf(K.avoided_treatment_eur)} €`, `${nf(K.net_annual_cost_eur)} €`, `${nf(K.reusable_t, 1)} t`],
      app: { route: '/scenarios/{Cenário B}', steps: ['Ler os quatro cartões: 431,1 t, 102 €/t, 43 914 €, 57 000 € de investimento', 'Ler «Em resumo»: 60 000 €/ano, 431,1 t (14% dos 3 003 t), 102 €/t', 'Descer: Desviado do lixo 14,4%, 1 viatura, tratamento evitado 45 542 €, custo líquido −1 628 €', 'Ver «Têxtil reutilizável»: 256,1 t (215,6 a 314,1)'], planB: 'diapositivo' },
      notes: `Este é o cenário B em detalhe. Com 60 mil euros por ano de orçamento, a rede gasta ${nf(K.annual_cost_eur)} euros e capta ${nf(K.tonnes_year, 1)} toneladas, a ${nf(K.eur_per_tonne, 1)} euros por tonelada. O custo decompõe-se assim: operação, ${nf(K.opex_eur_year)} euros, que são as recolhas e os quilómetros; a viatura, 42 500 euros em oito anos, 5 312,50 euros por ano; e o investimento de 250 euros por local, anualizado, 2 900 euros. O tratamento evitado: ${nf(K.tonnes_year, 1)} toneladas vezes 105,64, são ${nf(K.avoided_treatment_eur)} euros. O custo líquido para o município é de menos ${nf(Math.abs(K.net_annual_cost_eur))} euros por ano: o aterro evitado paga a rede toda e sobra, por pouco, 3,7 por cento. Uma ressalva que fazemos sempre: não é uma folga garantida. O percentil 90 do custo por tonelada, 139,7, está acima dos 105,64 do aterro evitado: nos casos pessimistas, não chega. Do que se capta, cerca de ${nf(K.reusable_t, 0)} toneladas são reutilizáveis, com um intervalo de ${nf(K.reusable_t_low, 0)} a ${nf(K.reusable_t_high, 0)}, o que dá ${nf(K.eur_per_reusable_t, 1)} euros por tonelada reutilizável. A cobertura de população é de ${nf(K.coverage_pct, 1)} por cento e a viatura trabalha ${nf(K.vehicle_days_week, 2)} dias por semana, ${nf(K.vehicle_hours_year)} horas por ano, ${nf(K.km_year)} quilómetros.`,
    });
    const cw = 2.0; const g = 0.12;
    const items = [
      [`${nf(K.tonnes_year, 1)} t`, 'captadas por ano', `${nf(K.tonnes_year / 3003.3 * 100, 1)}% do por desviar`],
      [`${nf(K.eur_per_tonne, 1)} €/t`, 'custo por tonelada', 'custo anual ÷ toneladas'],
      [`${nf(K.annual_cost_eur)} €`, 'custo anual', `operação ${nf(K.opex_eur_year)} €`],
      [`${nf(K.avoided_treatment_eur)} €`, 'tratamento evitado', '× 105,64 €/t'],
      [`−${nf(Math.abs(K.net_annual_cost_eur))} €`, 'custo líquido', 'custo − evitado'],
      [`${nf(K.reusable_t, 1)} t`, 'reutilizáveis', `${nf(K.reusable_t_low, 1)} a ${nf(K.reusable_t_high, 1)} t`],
    ];
    items.forEach(([big, lab, sub], i) => stat(s, MX + i * (cw + g), 1.85, cw, 1.75, big, lab, sub, { bigSize: 24, labelSize: 12.5, subSize: 10.5, color: i === 4 ? C.accent2 : C.accent1 }));
    s.addChart(pres.charts.DOUGHNUT, [{ name: 'Custo anual', labels: ['Operação (recolhas e km)', 'Viatura (42 500 € em 8 anos)', 'Locais (250 € por ponto, 5 anos)'], values: [K.opex_eur_year, K.vehicle_annual_eur, K.annual_cost_eur - K.opex_eur_year - K.vehicle_annual_eur] }], {
      x: MX, y: 3.85, w: 5.6, h: 2.95, holeSize: 55, chartColors: [H.floresta, H.areia, H.verdeClaro], showLegend: true, legendPos: 'r', legendFontSize: 11, legendFontFace: 'Arial', legendColor: H.tinta,
      showPercent: false, showValue: true, dataLabelFormatCode: '#,##0" €"', dataLabelColor: 'FFFFFF', dataLabelFontSize: 10, dataLabelFontFace: 'Arial', showTitle: true, title: 'Para onde vai o custo anual', titleFontSize: 12, titleFontFace: 'Arial', titleColor: H.tinta,
    });
    table(s, [
      ['Dimensão da rede', 'Valor'],
      ['Pontos de recolha', `${K.points} (investimento ${nf(K.capex_eur - K.vehicle_capex_eur)} €)`],
      ['Viatura', `${K.vehicles} · ${nf(K.vehicle_days_week, 2)} dias/semana · ${nf(K.vehicle_hours_year, 0)} h/ano`],
      ['Quilómetros por ano', `${nf(K.km_year)} km`],
      ['Cobertura de população', `${nf(K.coverage_pct, 1)}%`],
      ['Desviado do lixo', `${nf(K.tonnes_year / 3003.3 * 100, 1)}% do por desviar`],
    ], { x: 6.5, y: 3.85, w: 6.25, cols: [2.6, 3.65], size: 11.5, rowH: 0.48, name: 'dimensao-b' });
  }

  // R4. O que cada orçamento compra
  {
    const rows = [
      ['40 000 €', S(/Por freguesia · 40 000/)], ['60 000 € (B)', S(/Cenário B · sem contentores \(proposta\) · 60 000 €\/ano$/)], ['90 000 €', S(/Por freguesia · 90 000/)], ['150 000 €', S(/Por freguesia · 150 000/)], ['Teto do modelo', S(/Teto do modelo/)],
    ];
    const s = slide({
      kicker: 'Demonstração 1 · Orçamentos', title: 'Cada orçamento compra uma quantidade de têxtil a um custo por tonelada, e o euro extra fica mais caro',
      time: '1:10', core: true,
      sources: 'Cenários «Demo · Por freguesia» (40, 90 e 150 mil €), B (60 mil €) e teto do modelo sem limite de orçamento; rotas pela estrada; 11 nov 2026 (modelo; estimativa)',
      numbers: rows.map(([, r]) => `${nf(r.tonnes_year, 1)} t`),
      app: { route: '/scenarios (cadeia de orçamentos)', steps: ['Selecionar os cenários 40, 60, 90 e 150 mil € e abrir a comparação', 'Ler as toneladas e o €/t de cada um', 'Dizer: quem propõe o orçamento responde com esta curva; quem corta, também', 'Mostrar a robustez da comparação (percentagem de amostras)'], planB: 'diapositivo com a curva' },
      notes: 'A pergunta de toda a gestão: e se o orçamento for outro? Aqui está a cadeia. Com 40 mil euros por ano, a rede capta 364 toneladas a 66 euros por tonelada, e nem gasta o orçamento todo, porque o otimizador só abre o que compensa. Com 60 mil, o nosso B, 431 toneladas a 101,9. Com 90 mil, 525 toneladas, mas já a 139 euros por tonelada. Com 150 mil, 677 toneladas a 187 euros por tonelada. E o teto do modelo, sem limite de orçamento, 772 toneladas a 229 euros por tonelada: é o máximo que o modelo consegue sem contentores. Reparem na forma: cada euro extra compra menos têxtil, porque as primeiras toneladas estão nas freguesias densas e as últimas nas dispersas. É a fronteira de decisão: quem propõe o orçamento da rede responde com esta curva; quem corta o orçamento, também. E a comparação diz a robustez: em quantas amostras de incerteza a conclusão se mantém.',
    });
    s.addChart(pres.charts.BAR, [{ name: 'Têxtil captado (t/ano)', labels: rows.map(([l]) => l), values: rows.map(([, r]) => Number(r.tonnes_year.toFixed(1))) }], Object.assign(chartBase(), {
      x: MX, y: 1.85, w: 6.3, h: 4.85, barDir: 'col', chartColors: [H.floresta, H.floresta, H.floresta, H.floresta, H.areia], showLegend: false, showValue: true, dataLabelPosition: 'outEnd', dataLabelFormatCode: '#,##0.0',
      showTitle: true, title: 'Têxtil captado por orçamento anual (t/ano)', titleFontSize: 13, titleColor: H.tinta, valAxisMinVal: 0, valAxisMaxVal: 900, barGapWidthPct: 55,
    }));
    table(s, [
      ['Orçamento', 'Gasto', 'Têxtil', '€/t', 'Cobertura'],
      ...rows.map(([l, r]) => [l, `${nf(r.annual_cost_eur)} €`, `${nf(r.tonnes_year, 1)} t`, nf(r.eur_per_tonne, 1), `${nf(r.coverage_pct, 1)}%`]),
    ], { x: 7.2, y: 1.9, w: 5.55, cols: [1.5, 1.1, 1.0, 0.8, 1.15], size: 12, rowH: 0.5, align: ['left', 'right', 'right', 'right', 'right'], name: 'cadeia' });
    card(s, 7.2, 5.15, 5.55, 1.55, { fill: C.background1, name: 'nota-cadeia' });
    text(s, [
      { text: 'Leitura: ', options: { bold: true, color: C.accent1 } },
      { text: 'de 60 para 150 mil € o orçamento sobe 2,5 vezes e o têxtil só 1,6 vezes; o custo por tonelada quase duplica. A curva decide até onde compensa ir.' },
    ], { x: 7.4, y: 5.28, w: 5.15, h: 1.3, fontSize: 13, valign: 'middle' });
  }

  // R5. Por freguesia ou por locais reais
  {
    const rowsDef = [
      ['Por freguesia (B)', S(/Cenário B · sem contentores \(proposta\) · 60 000 €\/ano$/), 'local existente e saco à porta'],
      ['Locais reais, 300 m, públicos e escolas', S(/Locais reais · 60 000 €\/ano$/), '207 locais abertos'],
      ['Locais reais, 500 m, públicos e escolas', S(/raio 500 m · 60 000/), 'maior alcance a pé'],
      ['Só locais públicos, 300 m', S(/Só locais públicos/), 'sem escolas'],
      ['Só escolas (30 000 €/ano)', S(/Pontos assistidos/), 'pontos assistidos'],
    ];
    const s = slide({
      kicker: 'Demonstração 1 · Duas formas de desenhar a rede', title: 'Por locais reais a rede serve mais gente (até 95,7%), mas custa mais por tonelada do que por freguesia',
      time: '1:15', core: false,
      sources: 'Cenários «Demo · Locais reais» e B; 60 000 €/ano (30 000 €/ano nas escolas); rotas pela estrada; 11 nov 2026 (modelo; estimativa; os cenários por locais variam cerca de ±1% entre execuções) · 105,64 €/t (Vitrus)',
      notes: 'A ferramenta desenha a rede de duas formas. Por freguesia: o modelo decide, para cada freguesia, o modo de recolha, local existente ou saco à porta, e põe um ponto no centro. Por locais reais: escolhe, entre os 1 273 candidatos, quais abrir, e uma paragem só conta como servida se estiver dentro do raio a pé, 300 ou 500 metros. Os números do mesmo orçamento, 60 mil euros: por freguesia, 431 toneladas e 70,4 por cento de cobertura; por locais reais a 300 metros, 475 toneladas e 87,8 por cento; a 500 metros, 550 toneladas e 95,7 por cento, mas com um custo por tonelada maior, 125 e 107 euros. O custo líquido sobe porque o saco à porta é mais caro agora que cada ronda sai do estaleiro, e o otimizador prefere paragens nos locais. Só com escolas, a rede fica curta: 180 toneladas e 30 por cento de cobertura. Uma nota de método: os cenários por locais têm o solver limitado por tempo e variam cerca de 1 por cento entre execuções e máquinas; só o cenário por freguesia é determinístico.',
    });
    table(s, [
      ['Rede', 'Gasto', 'Têxtil', '€/t', 'Cobertura', 'Líquido*'],
      ...rowsDef.map(([l, r]) => [l, `${nf(r.annual_cost_eur)} €`, `${nf(r.tonnes_year, 1)} t`, nf(r.eur_per_tonne, 1), `${nf(r.coverage_pct, 1)}%`, `${nf(r.annual_cost_eur - avoided(r.tonnes_year))} €`]),
    ], { x: MX, y: 1.9, w: CW, cols: [4.4, 1.5, 1.4, 1.2, 1.7, 1.93], size: 12.5, rowH: 0.6, align: ['left', 'right', 'right', 'right', 'right', 'right'], name: 'redes' });
    text(s, '* Líquido = custo anual − (toneladas × 105,64 €/t); negativo quer dizer que o aterro evitado paga mais do que a rede custa. Estimativa.', { x: MX, y: 5.65, w: CW, h: 0.4, fontSize: 11.5, italic: true, color: H.cinza });
    iconRow(s, MX, 6.05, 5.9, 'Map', 'Por freguesia', 'Um modo por freguesia; determinístico.', { h: 0.8, descSize: 11.5, titleSize: 13.5, circle: 0.5 });
    iconRow(s, MX + 6.2, 6.05, 5.9, 'MapPin', 'Por locais reais', 'Escolhe entre 1 273 candidatos; solver com limite de tempo.', { h: 0.8, descSize: 11.5, titleSize: 13.5, circle: 0.5 });
  }

  // R6. Rotas e viatura (rede no mapa)
  {
    const plan = B.result.collection_plan;
    const onDem = plan.filter((p) => p.channel === 'on_demand');
    const ex = plan.filter((p) => p.channel === 'existing');
    const sum = (a, k) => a.reduce((t, x) => t + (x[k] || 0), 0);
    const s = slide({
      kicker: 'Demonstração 1 · Rede e rotas', title: 'O plano de recolha diz o dia, a viatura e os quilómetros de cada freguesia, e as rotas seguem as estradas',
      time: '1:20', core: true,
      sources: 'Cenário B (resultado e collection_plan; 11 nov 2026; modelo; estimativa) · rotas OSRM sobre OpenStreetMap · estaleiro de Polvoreira (Vitrus)',
      numbers: [`${nf(sum(onDem, 'tonnes_year'), 1)} t`, `${nf(sum(ex, 'tonnes_year'), 1)} t`, '1 viatura'],
      app: { route: '/scenarios/{B} → Rede e rotas', steps: ['Abrir o separador «Rede e rotas» e mostrar o mapa com as rotas a partir do depósito', 'Dar zoom a uma rota: etiqueta «Por estrada»', 'Mostrar a tabela «Rotas»: viatura, modo, paragens, carga, distância, condução', 'Dizer: o motorista não navega pela app; a rota é o plano do dia'], planB: 'diapositivo' },
      notes: `O plano do dia da viatura. O mapa mostra, a verde, as freguesias servidas por locais existentes e, a outra cor, as de saco à porta; o traço cheio são as rotas, que seguem as estradas. A viatura sai do estaleiro da Polvoreira. Neste cenário, o saco à porta serve ${onDem.length} freguesias, com ${nf(sum(onDem, 'tonnes_year'), 1)} toneladas; e as paragens em locais existentes servem ${ex.length} freguesias, com ${nf(sum(ex, 'tonnes_year'), 1)} toneladas. O plano de recolha dá, para cada freguesia e canal, o dia da semana, a viatura, a frequência, a cada duas semanas, os quilos por ronda, e os quilómetros e horas por ano. As regras de atribuição são deterministas: as tarefas entram por ordem decrescente de horas, e cada uma fica no par viatura e dia com menos horas. O motorista não navega pela aplicação: a rota é o plano do dia. Hoje, com uma viatura, ocupa ${nf(K.vehicle_days_week, 2)} dias por semana: sobra capacidade, e o modelo só compra uma segunda viatura quando as horas passam de 1 820 por ano.`,
    });
    shot(s, 'app-scenario-b-network.png', MX, 1.8, 7.4, 'Rede e rotas do cenário B: viatura a partir do depósito, rotas pelas estradas');
    stat(s, 8.4, 1.9, 2.1, 1.7, '1 viatura', 'dedicada', `${nf(K.vehicle_days_week, 2)} dias/sem.`, { bigSize: 22, labelSize: 12 });
    stat(s, 10.65, 1.9, 2.1, 1.7, `${nf(K.km_year)} km`, 'por ano', `${nf(K.vehicle_hours_year, 0)} h/ano`, { bigSize: 22, labelSize: 12 });
    table(s, [
      ['Canal', 'Freguesias', 'Têxtil', 'Km/ano'],
      ['Saco à porta', String(onDem.length), `${nf(sum(onDem, 'tonnes_year'), 1)} t`, nf(sum(onDem, 'km_year'))],
      ['Locais existentes', String(ex.length), `${nf(sum(ex, 'tonnes_year'), 1)} t`, nf(sum(ex, 'km_year'))],
    ], { x: 8.4, y: 3.85, w: 4.35, cols: [1.45, 1.15, 0.9, 0.85], size: 11.5, rowH: 0.45, align: ['left', 'right', 'right', 'right'], name: 'canais' });
    text(s, 'Ronda a cada 2 semanas (26 por ano); dia e viatura por regra determinista; o motorista segue o plano do dia, não navega pela app.', { x: 8.4, y: 5.4, w: 4.35, h: 1.2, fontSize: 12, color: H.cinza, italic: true });
  }

  // R7. Cobertura e equidade
  {
    const eq = COV.equity;
    const tip = COV.by_tipau || COV.tipau || [];
    const s = slide({
      kicker: 'Demonstração 1 · Cobertura', title: `A rede serve ${nf(eq.urban_covered_pct, 1)}% da população urbana e ${nf(eq.non_urban_covered_pct, 1)}% do resto, e é isso que a diretiva pede para medir`,
      time: '1:25', core: true,
      sources: 'dados do ecrã (cenário B; 11 nov 2026; estimativa) · INE: TIPAU e Censos 2021 · Diretiva (UE) 2025/1892, art. 22.º-C, n.º 9, al. b)',
      numbers: [`${nf(eq.urban_covered_pct, 1)}%`, `${nf(eq.non_urban_covered_pct, 1)}%`, nf(eq.non_urban_vs_urban, 3)],
      app: { route: '/scenarios/{B} → Cobertura', steps: ['Mostrar a citação da diretiva (art. 22.º-C, n.º 9, al. b)', 'Ler «Não limitado às zonas rendíveis»: 55,5% contra 72,8%', 'Mostrar o quadro por tipo de território (APU, AMU, APR) e o concelho', 'Dizer: Arosa e Castelões fica sem serviço neste orçamento; é onde o modelo começa'], planB: 'diapositivo' },
      notes: 'A diretiva obriga a que a rede não se limite às zonas rendíveis. O Novelo mede-o com a matriz de cobertura, por tipologia de território do INE. Neste cenário, a população das freguesias predominantemente urbanas servida é 72,8 por cento; nas outras, mediamente urbanas e rurais, 21 370 habitantes, é 55,5 por cento. A razão entre as duas é 0,762: um indica a mesma cobertura. A freguesia predominantemente rural é uma só, Arosa e Castelões, com 699 habitantes, e fica sem recolha neste orçamento: a ronda até lá não compensa ao lado das outras. Isto é uma conversa de gestão, e a ferramenta põe-na em números: quanto custa subir essa cobertura? Foi por isso que escolhemos Arosa e Castelões para o ensaio das duas freguesias: é precisamente o sítio onde o modelo, com este orçamento, deixa de chegar.',
    });
    s.addChart(pres.charts.BAR, [{ name: 'População servida (%)', labels: ['Predominantemente urbanas (APU)', 'Mediamente urbanas (AMU)', 'Predominantemente rurais (APR)', 'Concelho'], values: [72.8, 57.4, 0, 70.4] }], Object.assign(chartBase(), {
      x: MX, y: 1.85, w: 6.4, h: 4.2, barDir: 'bar', chartColors: [H.floresta, H.floresta, H.terra, H.areia], showLegend: false, showValue: true, dataLabelPosition: 'outEnd', dataLabelFormatCode: '0.0"%"', showTitle: true, title: 'População servida por tipologia (cenário B, 60 000 €/ano)', titleFontSize: 12.5, titleColor: H.tinta,
      valAxisMaxVal: 100, valAxisMinVal: 0, valAxisLabelFormatCode: '0"%"', catAxisOrientation: 'maxMin', barGapWidthPct: 50,
    }));
    table(s, [
      ['TIPAU', 'Freg.', 'Habitantes', 'Servida', 'Têxtil', '€/t'],
      ['Urbana (APU)', '36', '135 460', '72,8%', '390,2 t', '102'],
      ['Mediamente (AMU)', '11', '20 671', '57,4%', '40,9 t', '103'],
      ['Rural (APR)', '1', '699', '0,0%', '0,0 t', '—'],
      ['Concelho', '48', '156 830', '70,4%', '431,1 t', '102'],
    ], { x: 7.3, y: 1.9, w: 5.45, cols: [1.65, 0.6, 1.0, 0.85, 0.8, 0.55], size: 11.5, rowH: 0.5, align: ['left', 'right', 'right', 'right', 'right', 'right'], name: 'tipau' });
    card(s, 7.3, 4.65, 5.45, 1.95, { fill: C.background1, name: 'equidade' });
    text(s, 'Não limitado às zonas rendíveis', { x: 7.5, y: 4.75, w: 5.0, h: 0.3, fontSize: 14, bold: true, color: C.accent1 });
    text(s, `Fora das urbanas (${nf(eq.non_urban_population)} hab.): ${nf(eq.non_urban_covered_pct, 1)}% servida, contra ${nf(eq.urban_covered_pct, 1)}% nas urbanas; razão ${nf(eq.non_urban_vs_urban, 3)} (1 = igual). Arosa e Castelões (699 hab.) fica sem serviço com este orçamento.`, { x: 7.5, y: 5.12, w: 5.0, h: 1.4, fontSize: 12.5 });
    text(s, 'Matriz completa: proximidade (% da área a ≤ 300 m de um local), acessibilidade (dias de circuito), densidade e volume previsto por freguesia.', { x: MX, y: 6.2, w: 6.4, h: 0.6, fontSize: 11.5, italic: true, color: H.cinza });
  }

  // R8. Incerteza
  {
    const tor = SENS.tornado.slice(0, 7);
    const lab = { 'modes.existing.coverage_factor': 'Cobertura do local existente', 'modes.existing.capture_rate': 'Captura do local existente', kg_per_inhab_month: 'Têxtil por habitante (Vitrus/APA)', cost_per_collection_eur: 'Custo de uma recolha', on_demand_kg_per_pickup: 'Kg por saco à porta', 'modes.existing.collections_per_year': 'Recolhas por ano (local existente)', 'modes.on_demand.capture_rate': 'Captura do saco à porta', 'modes.on_demand.coverage_factor': 'Cobertura do saco à porta' };
    const sel = []; const seen = new Set();
    for (const t of SENS.tornado) { const l = lab[t.key] || t.key; const sig = `${Math.round(t.swing_eur_per_tonne * 10)}`; if (seen.has(sig)) continue; seen.add(sig); sel.push([l, t]); if (sel.length === 6) break; }
    const s = slide({
      kicker: 'Demonstração 1 · Incerteza', title: 'O intervalo provável do custo é de 82 a 140 €/t e quatro dos cinco maiores fatores são pressupostos sem dado',
      time: '1:30', core: true,
      sources: `Monte Carlo sobre o plano do cenário B: ${SENS.n_samples} amostras, semente ${SENS.seed}, ±${SENS.swing * 100}%, distribuição triangular (11 nov 2026; estimativa) · «Dados e modelo», secção 5`,
      numbers: [`${nf(SENS.eur_per_tonne.p10, 1)}`, `${nf(SENS.eur_per_tonne.p50, 1)}`, `${nf(SENS.eur_per_tonne.p90, 1)}`],
      app: { route: '/scenarios/{B} → Incerta', steps: ['Abrir «Incerta» e mostrar «Quanto pode errar?»', 'Ler o intervalo provável: €/t entre P10 e P90, custo anual, toneladas', 'Apontar «Que pressupostos pesam mais» (tornado) e os selos «pressuposto»', 'Dizer: 4 de 5 fatores são pressupostos sem dado da Vitrus; é onde os dados reais mais ajudam'], planB: 'diapositivo' },
      notes: `Todo o cenário traz o seu intervalo. Não resolvemos o otimizador outra vez em cada amostra: reavaliamos o modelo de custos sobre o plano já proposto, com os pressupostos perturbados em mais ou menos 30 por cento, 500 amostras e semente fixa, para responder à pergunta «o plano proposto aguenta se os pressupostos estiverem errados?». O resultado: o custo por tonelada vai de ${nf(SENS.eur_per_tonne.p10, 1)} no percentil 10 a ${nf(SENS.eur_per_tonne.p90, 1)} no percentil 90, com mediana ${nf(SENS.eur_per_tonne.p50, 1)}. As toneladas, de ${nf(SENS.tonnes.p10, 0)} a ${nf(SENS.tonnes.p90, 0)}. Dois factos para a gestão. Primeiro: o percentil 90, 139,7, está acima dos 105,64 euros de aterro evitado; nos casos pessimistas, o aterro evitado não paga a rede. Segundo: o tornado mostra o que mais pesa: a cobertura e a captura do local existente, mais ou menos 53,5 euros por tonelada cada; o têxtil por habitante, 38,4; o custo de uma recolha, 38,1; os quilos por saco, 28,7. Quatro dos cinco maiores são pressupostos sem dado da Vitrus: é onde os dados reais mais ajudam.`,
    });
    s.addChart(pres.charts.BAR, [{ name: 'Variação do €/t (±30%)', labels: sel.map(([l]) => l), values: sel.map(([, t]) => Number(t.swing_eur_per_tonne.toFixed(1))) }], Object.assign(chartBase(), {
      x: MX, y: 1.85, w: 6.9, h: 4.85, barDir: 'bar', chartColors: [H.areia, H.verdeClaro, H.areia, H.areia, H.areia, H.areia], showLegend: false, showValue: true, dataLabelPosition: 'outEnd', dataLabelFormatCode: '0.0', showTitle: true, title: 'Que pressupostos pesam mais (variação do €/t com ±30%)', titleFontSize: 12.5, titleColor: H.tinta,
      catAxisOrientation: 'maxMin', valAxisMinVal: 0, valAxisMaxVal: 65, barGapWidthPct: 45, catAxisLabelFontSize: 10.5,
    }));
    stat(s, 7.8, 1.9, 1.6, 1.6, nf(SENS.eur_per_tonne.p10, 1), '€/t · P10', 'otimista', { bigSize: 24, labelSize: 12 });
    stat(s, 9.5, 1.9, 1.6, 1.6, nf(SENS.eur_per_tonne.p50, 1), '€/t · P50', 'central', { bigSize: 24, labelSize: 12 });
    stat(s, 11.2, 1.9, 1.55, 1.6, nf(SENS.eur_per_tonne.p90, 1), '€/t · P90', 'pessimista', { bigSize: 24, labelSize: 12, color: C.accent6 });
    card(s, 7.8, 3.75, 4.95, 2.95, { fill: C.background1, name: 'leitura-incerteza' });
    text(s, 'O que isto quer dizer', { x: 8.0, y: 3.85, w: 4.55, h: 0.3, fontSize: 14, bold: true, color: C.accent1 });
    bullets(s, ['O aterro evitado (105,64 €/t) paga a rede no caso central, mas não no P90 (139,7 €/t)', `Toneladas: ${nf(SENS.tonnes.p10, 0)} a ${nf(SENS.tonnes.p90, 0)} t (P10 a P90)`, '4 de 5 dos maiores fatores são pressupostos sem dado', 'Os dados da Vitrus fecham a maior parte da incerteza', 'Verde claro: dado da Vitrus ou da APA; areia: pressuposto'], { x: 8.0, y: 4.25, w: 4.55, h: 2.4, size: 12, gap: 6 });
  }

  // R9. E se...?
  {
    const s = slide({
      kicker: 'Demonstração 1 · «E se...?»', title: 'Pergunta-se em português e o otimizador responde com números verificados, nunca a IA',
      time: '1:35', core: true,
      sources: 'pergunta sobre o cenário B (3 perguntas do seed de demonstração; modelo de linguagem real; 11 nov 2026; estimativa) · «IA»',
      numbers: ['525,3 t', '139,1 €/t', '397,5 t', '428,9 t'],
      app: { route: '/scenarios/{B} → E se...?', steps: ['Perguntar a alguém da sala: «Dêem-me uma pergunta sobre esta rede»', 'Escrever a pergunta tal como foi dita', 'Esperar o «Entendi: ...» e confirmar', 'Ler a diferença em toneladas, €/t e custo; dizer que a IA nunca faz contas', 'Plano B: «E se o orçamento subir de 60 000 para 90 000 €?» (em cache)'], planB: 'pergunta de reserva em cache' },
      notes: 'O momento ao vivo. Pedimos a alguém da sala uma pergunta sobre a rede, em português, e escrevemo-la tal como foi dita. O Novelo mostra primeiro «Entendi: ...» para confirmarmos que percebeu bem. Só depois o otimizador corre. Quem calcula é o otimizador, o mesmo que fez os cenários todos; a IA só traduz a pergunta e explica o resultado, e um verificador rejeita qualquer número que não tenha saído da conta. À direita estão três exemplos já guardados. Se o orçamento subir de 60 para 90 mil euros: 525,3 toneladas, mas 139,1 euros por tonelada. Se Creixomil e Azurém só tiverem recolha a pedido: 397,5 toneladas, 105,4 euros por tonelada, menos têxtil e custo parecido. Se a captura da recolha a pedido for 30 por cento mais baixa: 428,9 toneladas, 100,1 euros por tonelada, quase nada muda, porque o saco à porta pesa pouco neste cenário. Cada resposta guarda a pergunta, a alteração, o cenário e a versão do prompt: tudo auditável.',
    });
    shot(s, 'app-scenario-b-whatif.png', MX, 1.8, 6.6, 'Ecrã «E se...?» com as perguntas sugeridas');
    table(s, [
      ['Pergunta', 'Têxtil', '€/t', 'Custo'],
      ['E se o orçamento passar de 60 000 para 90 000 €/ano?', '525,3 t', '139,1', '73 083 €'],
      ['E se Creixomil e Azurém só tiverem recolha a pedido?', '397,5 t', '105,4', '41 905 €'],
      ['E se a captura da recolha a pedido for 30% mais baixa?', '428,9 t', '100,1', '42 946 €'],
    ], { x: 7.65, y: 1.9, w: 5.1, cols: [2.6, 0.85, 0.7, 0.95], size: 11, rowH: 0.78, align: ['left', 'right', 'right', 'right'], name: 'perguntas' });
    iconRow(s, 7.65, 5.3, 5.1, 'ShieldCheck', 'O verificador', 'Todos os números do texto têm de existir no resultado; senão, a resposta é rejeitada e gerada de novo.', { h: 1.4, descSize: 12 });
  }

  // R10. Duas freguesias
  {
    const s = slide({
      kicker: 'Demonstração 1 · Duas freguesias', title: 'A ferramenta desenha a rede à escala que se quiser: aqui, Aldão e Arosa e Castelões, as duas que o modelo aponta para começar',
      time: '1:40', core: true,
      sources: 'dados do ecrã (k = 2; 23 out 2026) e cenário «Duas freguesias» (11 nov 2026; modelo; estimativa) · «Dados e modelo», secção 5',
      numbers: ['1,71 t', '2,43 t', '538 €/t', '9,7 t'],
      app: { route: '/pilot e /scenarios/{Duas freguesias}', steps: ['Abrir /pilot: mostrar as duas freguesias recomendadas e porquê (território, densidade, hábito de dias fixos, custo de arranque)', 'Abrir o cenário «Duas freguesias»: rota até Arosa e Castelões', 'Mostrar o plano de recolha das duas freguesias: dia, ronda, kg por ronda', 'Dizer: não é um pedido; mostra a escala a que a ferramenta trabalha'], planB: 'diapositivo' },
      notes: 'Mostrámos a rede do concelho. Mas a ferramenta desenha a rede à escala que se quiser. A título de exemplo, escolhemos duas freguesias com o próprio modelo: o ecrã do piloto faz uma pesquisa exaustiva e determinista e recomenda Aldão e a União das freguesias de Arosa e Castelões, porque juntas dão contraste: uma urbana, outra rural; densidades diferentes; ambas com três dias por semana de passagem do circuito de indiferenciado, o que dá hábito de pôr o lixo à porta em dias fixos; e custo de arranque baixo. O que o modelo prevê para três meses: 2,43 toneladas, com um intervalo de 1,87 a 2,99, acima do piso mínimo de 1,71 toneladas, que é o que é preciso recolher para medir a taxa de rejeito com três pontos percentuais de margem. Custo em regime: 538 euros por tonelada, entre 424 e 706, sem contar a viatura, que é da rede inteira e num ensaio pode ser alugada. Honestidade: como cenário autónomo, com a viatura toda a pagar-se só para duas freguesias, são 9,7 toneladas por ano a mais de mil euros por tonelada, o que serve para aprender a escala e não para desenhar a rede. Não estamos a pedir nada: se quiserem, está pronto.',
    });
    shot(s, 'app-duas-network.png', MX, 1.8, 6.5, 'Cenário «Duas freguesias»: rota do estaleiro até Aldão e Arosa e Castelões');
    table(s, [
      ['Ensaio de 3 meses (modelo)', 'Valor'],
      ['Freguesias', 'Aldão + Arosa e Castelões'],
      ['Piso de sinal (medir o rejeito, ±3 p.p.)', '1,71 t'],
      ['Previsto (P10 a P90)', '2,43 t (1,87 a 2,99)'],
      ['Custo em regime (sem a viatura)', '538 €/t (424 a 706)'],
      ['Combinações viáveis', '1 128 de 1 128'],
    ], { x: 7.45, y: 1.9, w: 5.3, cols: [3.0, 2.3], size: 11.5, rowH: 0.5, name: 'duas-pilot' });
    card(s, 7.45, 5.1, 5.3, 1.6, { fill: C.background1, name: 'nota-duas' });
    text(s, 'Como cenário autónomo, a viatura paga-se toda por duas freguesias: 9,7 t/ano a 1 057 €/t. Serve para aprender a escala; a rede é a do concelho.', { x: 7.65, y: 5.2, w: 4.9, h: 1.4, fontSize: 12.5, color: C.accent6, bold: true, valign: 'middle' });
  }

  // R11. De onde estamos para onde se pode chegar
  {
    const s = slide({
      kicker: 'A escala do possível', title: 'Do que se recolhe hoje ao teto do modelo sem contentores há uma margem de 2,6 vezes, e o potencial é quase 10 vezes maior',
      time: '1:45', core: false,
      sources: 'Vitrus 2025 (301,3 t) · cenário B · referência francesa 4,27 kg/hab/ano (por verificar) · teto do modelo, 23 out 2026 («Dados e modelo», secção 5; estimativa) · 3 003,3 t: APA e Vitrus',
      notes: 'Para pôr as coisas em escala. Hoje recolhem-se 301,3 toneladas. O cenário B chega a 431. A meta francesa, 4,27 quilos por habitante por ano, daria 669,7 toneladas; é uma referência de contentores de rua, por verificar, e só a usamos para comparar. O teto do modelo sem contentores, orçamento sem limite, são 772 toneladas, a 229 euros por tonelada e com duas viaturas; o teto com contentores de rua, só referência, seria 1 283 toneladas. E o potencial de têxtil por desviar são 3 003 toneladas. Quer dizer: com os modos que a Vitrus aceita, a rede chega a cerca de um quarto do potencial; o resto depende de coisas que o modelo ainda não tem: comportamento dos munícipes, canal B2B, triagem em casa. Por isso a conversa sobre a triagem e sobre os dados é a conversa que decide até onde se chega.',
    });
    s.addChart(pres.charts.BAR, [{ name: 'Toneladas por ano', labels: ['Recolhido hoje (2025)', 'Cenário B (60 000 €)', 'Meta francesa (por verificar)', 'Teto sem contentores', 'Teto com contentores (só referência)'], values: [301.3, 431.1, 669.7, 772.1, 1282.6] }], Object.assign(chartBase(), {
      x: MX, y: 1.85, w: 7.8, h: 4.85, barDir: 'bar', chartColors: [H.floresta, H.floresta, H.verdeClaro, H.areia, H.cinza], showLegend: false, showValue: true, dataLabelPosition: 'outEnd', dataLabelFormatCode: '#,##0.0', showTitle: true, title: 'Toneladas de têxtil por ano', titleFontSize: 13, titleColor: H.tinta,
      catAxisOrientation: 'maxMin', valAxisMinVal: 0, valAxisMaxVal: 1500, barGapWidthPct: 45,
    }));
    stat(s, 8.75, 1.9, 4.0, 1.7, '≈ 3 003 t', 'potencial por desviar', 'estimativa (APA × Vitrus); o teto sem contentores é 26%', { bigSize: 28, subSize: 11 });
    stat(s, 8.75, 3.8, 4.0, 1.7, '772,1 t', 'teto sem contentores', '228,9 €/t, 2 viaturas, 6,15 dias/semana (estimativa)', { bigSize: 28, subSize: 11, color: H.bronze });
    text(s, 'O que falta para ir mais longe: comportamento dos munícipes, canal B2B e triagem em casa. É o que o bloco 06 discute.', { x: 8.75, y: 5.7, w: 4.0, h: 1.0, fontSize: 12, italic: true, color: H.cinza });
  }
};
