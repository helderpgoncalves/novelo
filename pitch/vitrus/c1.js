'use strict';
/** Parte 1: capa, resumo, desafio e dados. */
const L = require('./lib');
const { pres, C, H, MX, CW, W, slide, section, card, stat, iconRow, bullets, pill, table, arrow, stepBox, shot, text, chartBase, img, ic, THEME } = L;

const DIAS_2028 = Math.round((Date.UTC(2028, 3, 17) - Date.UTC(2026, 10, 12)) / 86400000); // 522

module.exports = function build() {
  // ------------------------------------------------------------------ 1. Capa
  {
    const s = pres.addSlide({ masterName: 'CAPA' });
    L.GUIAO.push({
      n: L.bump(), kind: 'capa', section: '', title: 'Novelo: do saco ao fio', time: '0:00', core: true, app: null,
      notes: 'Bom dia. Obrigado por nos receberem e, antes de tudo, pelos dados: sem os números que a Vitrus abriu, nada do que vamos mostrar existiria. Esta sessão é longa de propósito. Não é um pitch: é a apresentação completa do trabalho, com o aplicativo a funcionar em paralelo, para que quem pode dar seguimento a isto tenha tudo na mão, números, pressupostos, limites e dúvidas. Cada número tem origem e um selo: medido, estimativa ou pressuposto. Se alguma coisa não estiver clara, interrompam-nos.',
    });
    s.addNotes('Bom dia. Obrigado por nos receberem e, antes de tudo, pelos dados: sem os números que a Vitrus abriu, nada do que vamos mostrar existiria. Esta sessão é longa de propósito: é a apresentação completa do trabalho, com a aplicação a funcionar em paralelo, para que quem pode dar seguimento tenha tudo na mão: números, pressupostos, limites e dúvidas. Cada número tem origem e um selo: medido, estimativa ou pressuposto. Se alguma coisa não estiver clara, interrompam-nos.');
    s.addImage({ path: path_('brand/logotipo/novelo-logotipo-negativo@3x.png'), x: MX, y: 0.6, w: 2.6, h: 2.6 * (197 / 640), altText: 'Novelo' });
    text(s, 'APRESENTAÇÃO COMPLETA À VITRUS E AO MUNICÍPIO DE GUIMARÃES', { x: MX, y: 2.0, w: 6.6, h: 0.5, fontSize: 12, bold: true, charSpacing: 2, color: H.areia });
    text(s, 'Do saco ao fio', { x: MX, y: 2.55, w: 6.6, h: 1.2, fontFace: THEME.headFontFace, fontSize: 60, bold: true, color: C.background2, valign: 'top' });
    text(s, 'A rede de recolha de têxteis de Guimarães ao menor custo: dados reais, números verificáveis, sem um único contentor novo.', { x: MX, y: 3.9, w: 6.3, h: 1.3, fontSize: 19, color: H.verdeClaro });
    text(s, [
      { text: 'Guimarães · 12 de novembro de 2026', options: { breakLine: true, bold: true, color: C.background2 } },
      { text: 'Flávio Fernandes e Hélder Gonçalves', options: { breakLine: true, color: C.background2 } },
      { text: 'Projeto vencedor · Hack4Guimarães 2035 · Desafio 5 TexVitrus', options: { color: H.areia } },
    ], { x: MX, y: 5.75, w: 6.6, h: 1.1, fontSize: 14 });
    s.addShape(pres.ShapeType.rect, { x: 7.55, y: 0.6, w: 5.2, h: 6.3, fill: { color: C.background2 }, line: { color: C.background2, width: 0 }, objectName: 'fundo-mapa' });
    s.addImage({ path: img('mapa-candidatos.png'), x: 7.7, y: 0.85, w: 4.9, h: 5.5, sizing: { type: 'contain', w: 4.9, h: 5.5 }, altText: 'Mapa de Guimarães com os 1 273 locais candidatos' });
  }

  // ------------------------------------------------------------------ 2. Resumo
  {
    const s = slide({
      kicker: 'Resumo', title: 'Sem um único contentor novo, a rede desvia 431 t por ano do aterro e o tratamento evitado paga a operação',
      time: '0:02', core: true,
      sources: 'Cenário B, 60 000 €/ano, rotas pela estrada, 23 out 2026 (modelo; estimativa) · Vitrus, 22 out 2026 (105,64 €/t) · 301,3 t medido (Vitrus, 2025)',
      notes: 'Em uma página, o trabalho inteiro. A pergunta que o Hack4Guimarães pôs foi: qual é a rede de recolha de têxteis de menor custo? A resposta que sai dos dados da Vitrus e do otimizador: uma viatura nova só para o têxtil, de caixa fechada e sem compactação; saco fechado à porta num dia fixo por freguesia; e paragens em locais municipais e escolas que já existem. Nenhum contentor novo, que é o que a Vitrus nos disse que não quer. Com 60 mil euros por ano: 431 toneladas, a 101,9 euros por tonelada. O aterro evitado, 45 542 euros a 105,64 euros por tonelada, paga a operação: o custo líquido é de menos 1 628 euros por ano. Dois avisos honestos: isto é estimativa de modelo, não medição; e é o caso central, com intervalo, que mostramos mais à frente. O que é medido, é medido: as 301,3 toneladas recolhidas em 2025. Tudo o resto tem selo.',
    });
    iconRow(s, MX, 1.95, 6.2, 'CircleHelp', 'A pergunta', 'Qual é a rede de recolha de têxteis de Guimarães de menor custo, sem contentores novos, com os dados reais da Vitrus?', { h: 1.3, descSize: 13.5, titleSize: 16 });
    iconRow(s, MX, 3.45, 6.2, 'Target', 'A resposta', 'Uma viatura nova só para o têxtil: saco fechado à porta num dia fixo por freguesia e paragens em locais municipais e escolas que já existem.', { h: 1.3, descSize: 13.5, titleSize: 16 });
    iconRow(s, MX, 4.95, 6.2, 'CircleCheck', 'O estado', 'Plataforma em produção, com rotas medidas pelas estradas e cada número com origem e selo: medido, estimativa ou pressuposto.', { h: 1.3, descSize: 13.5, titleSize: 16 });
    stat(s, 7.3, 1.9, 2.7, 2.3, '431,1 t/ano', 'desviadas do aterro', 'cenário B, 60 000 €/ano · estimativa', { bigSize: 30 });
    stat(s, 10.15, 1.9, 2.6, 2.3, '101,9 €/t', 'custo por tonelada', '43 914 € ÷ 431,1 t · estimativa', { bigSize: 30 });
    stat(s, 7.3, 4.4, 2.7, 2.3, '45 542 €', 'tratamento evitado', '431,1 t × 105,64 €/t (Vitrus)', { bigSize: 30 });
    stat(s, 10.15, 4.4, 2.6, 2.3, '−1 628 €/ano', 'custo líquido', 'caso central · estimativa', { bigSize: 26, color: H.bronze });
  }

  // ------------------------------------------------------------------ 3. Como ler
  {
    const s = slide({
      kicker: 'Como ler esta apresentação', title: 'Cada número diz de onde vem: medido, estimativa ou pressuposto',
      time: '0:05', core: true,
      sources: 'Regra do projeto (regras do projeto): nunca inventar um valor; «Dados e modelo»',
      notes: 'Antes de entrar nos números, a regra da casa. Nenhum valor entra no modelo sem uma de três origens. Medido: vem dos dados que a Vitrus enviou, como as 301,3 toneladas ou os 105,64 euros por tonelada. Estimativa: derivado por conta a partir de dados e de uma fonte, como as 3 003 toneladas por desviar, que são 5,86 por cento do indiferenciado, base da APA. Pressuposto: um valor nosso, com a fonte escrita e editável no ecrã de pressupostos, como o preço da viatura ou os 30 km/h. No ecrã isto aparece sempre como selo. Vamos usar estas três palavras ao longo de toda a sessão. À direita está o plano: oito blocos, com a aplicação aberta nos blocos quatro e cinco. A sessão completa leva cerca de duas horas, com a conversa; se o tempo apertar, há um caminho curto de 25 minutos marcado no guião.',
    });
    const y0 = 1.95; const bh = 1.5;
    [['Medido', 'Vem dos dados da Vitrus, do INE ou da APA, sem conta nossa que o altere.', 'Ex.: 301,3 t recolhidas em 2025; 105,64 €/t de aterro.', C.accent1],
      ['Estimativa', 'Derivado por conta a partir de valores medidos e de uma fonte indicada.', 'Ex.: ≈ 3 003,3 t/ano por desviar; 431,1 t do cenário B.', C.accent2],
      ['Pressuposto', 'Valor da equipa com fonte escrita, visível e editável no ecrã.', 'Ex.: viatura 42 500 €; 30 km/h; 6 € por recolha.', C.accent3]].forEach(([t, d, ex, col], i) => {
      const y = y0 + i * (bh + 0.1);
      L.rule(s, MX, y, 5.9, { color: H.tinta });
      s.addShape(pres.ShapeType.rect, { x: MX, y: y + 0.2, w: 0.2, h: 0.2, fill: { color: col }, line: { color: col, width: 0 }, objectName: 'amostra-selo' });
      text(s, t, { x: MX + 0.35, y: y + 0.12, w: 5.5, h: 0.36, fontFace: THEME.headFontFace, fontSize: 20, bold: true });
      text(s, d, { x: MX, y: y + 0.58, w: 5.9, h: 0.45, fontSize: 12.5 });
      text(s, ex, { x: MX, y: y + 1.06, w: 5.9, h: 0.3, fontSize: 11, color: H.cinza });
    });
    table(s, [
      ['Bloco', 'Tema', 'Aplicação', 'Tempo'],
      ['00', 'Introdução', '', '10 min'],
      ['01', 'O desafio e os números', '', '10 min'],
      ['02', 'Os dados recebidos', 'mapas', '7 min'],
      ['03', 'O modelo', '', '8 min'],
      ['04', 'Resultados e cenários', 'ao vivo', '35 min'],
      ['05', 'A prova: do saco ao fio', 'ao vivo', '20 min'],
      ['06', 'Triagem à escala', '', '8 min'],
      ['07', 'Riscos e validação', '', '7 min'],
      ['08', 'Seguimento e conversa', '', '10 min e aberto'],
      ['09', 'Quem somos e agradecimento', '', '5 min'],
    ], { x: 6.9, y: 1.9, w: 5.85, cols: [0.75, 2.75, 1.05, 1.3], size: 12.5, rowH: 0.4, align: ['center', 'left', 'center', 'center'], name: 'agenda' });
    text(s, 'Duração total: cerca de 2 horas, com a conversa. Há um caminho curto de 25 minutos no guião.', { x: 6.9, y: 6.55, w: 5.85, h: 0.4, fontSize: 11.5, italic: true, color: H.cinza });
  }

  require('./c0')();

  // ================================================================== 01 O desafio
  section('01', 'O desafio e os números', 'De onde partimos: o que a Vitrus recolhe, o que fica no lixo e o que muda em 2028.', 'Começamos pelo princípio: o desafio, as restrições que a Vitrus nos deu, e os números do problema, todos com origem.', '0:08');

  // 4. Desafio e restrições
  {
    const s = slide({
      kicker: 'O desafio', title: 'A Vitrus deu três restrições que desenharam a rede: sem contentores, sem compactador, com meio novo',
      time: '0:09', core: true,
      sources: 'Vitrus, 20, 21 e 22 out 2026 e 4 nov 2026 (reuniões e respostas por escrito) · «Dados e modelo»',
      notes: 'O desafio TexVitrus pedia a rede de menor custo. Mas a Vitrus, nas semanas a seguir ao hackathon, foi-nos dando restrições que mudaram o desenho, e é importante que fiquem escritas. Primeira, a 21 de outubro: não querem contentores de têxteis, porque a contaminação estraga a reutilização, que é onde está o valor; e reciclar custa mais do que fibra virgem, por isso a reciclagem não conta como receita. Segunda, a 22 de outubro: o saco de têxtil não pode ir no compactador do porta a porta, nem há volta de têxtil num compactador, e não há viaturas livres à tarde, porque a folha de turnos tinha um erro. Terceira, o caminho que a Vitrus indicou: a aquisição de um meio novo de recolha. Por isso toda a recolha do nosso modelo é feita por uma viatura nova, de caixa fechada e sem compactação, a partir do estaleiro da Polvoreira. E a 4 de novembro a Vitrus sugeriu mover parte da triagem para o munícipe, em casa. Voltaremos a isso no bloco seis.',
    });
    table(s, [
      ['Data', 'O que a Vitrus nos disse', 'O que mudou no desenho'],
      ['20 out', 'Pacote QGIS: 2 751 contentores municipais, 2 026 locais', 'Base geográfica real'],
      ['21 out', 'Não querem contentores de têxteis; reciclar custa mais que fibra virgem', 'Sem contentores; sem receita de reciclagem'],
      ['22 out', 'Saco não vai no compactador; sem viaturas livres à tarde; «meio novo de recolha»', 'Viatura dedicada de caixa fechada'],
      ['22 out', 'Indiferenciado 84,0% do concelho; aterro 105,64 €/t; estaleiro em Polvoreira', 'Procura, custo evitado e origem das rotas'],
      ['4 nov', 'Sugestão: triagem pelo munícipe, em casa', 'Análise do bloco 06; «Vai no saco?»'],
    ], { x: MX, y: 1.9, w: 7.7, cols: [0.85, 4.1, 2.75], size: 12, rowH: 0.62, name: 'cronologia' });
    iconRow(s, 8.75, 1.9, 4.0, 'Trash2', 'Sem contentores novos', 'Locais que já existem e saco fechado entregue à mão.', { h: 1.05, descSize: 12 });
    iconRow(s, 8.75, 3.1, 4.0, 'Truck', 'Uma viatura nova', 'Caixa fechada, sem compactação, a partir de Polvoreira.', { h: 1.05, descSize: 12 });
    iconRow(s, 8.75, 4.3, 4.0, 'Route', 'Rotas pelas estradas', 'Quilómetros medidos no OpenStreetMap, não em linha reta.', { h: 1.05, descSize: 12 });
    iconRow(s, 8.75, 5.5, 4.0, 'ShieldCheck', 'Contaminação em foco', 'O medo n.º 1 é têxtil sujo ou molhado: controlo à entrada.', { h: 1.05, descSize: 12 });
  }

  // 5. Quatro números
  {
    const s = slide({
      kicker: 'O problema em quatro números', title: '9 em cada 10 kg de têxtil ainda vão para o lixo, e em 2028 a fatura muda de dono',
      time: '0:12', core: true,
      sources: 'Vitrus 2025 (301,3 t, medido) · 51 250,6 t × 5,86% (APA, RARU 2025, p. 24; estimativa) · Vitrus, 22 out 2026 (105,64 €/t) · Diretiva (UE) 2025/1892',
      numbers: ['301,3 t', '≈ 3 003,3 t/ano', '105,64 €/t', '17 abr 2028'],
      notes: 'Quatro números, todos da Vitrus ou públicos. Trezentas e uma toneladas de têxtil recolhidas à parte em 2025, pelas quatro entidades que trabalham connosco: medido. Cerca de 3 003 toneladas por ano continuam no indiferenciado: estimativa, que explico já no diapositivo a seguir. 105,64 euros é o que custa cada tonelada de indiferenciado tratada, 40 euros de taxa de gestão de resíduos mais 65,64 da tarifa da Resinorte: cada tonelada que desviamos deixa de custar isto ao município. E o relógio: 17 de abril de 2028, prazo da responsabilidade alargada do produtor. Daqui a ' + DIAS_2028 + ' dias. Conta de cabeça: nove em cada dez quilos de têxtil que Guimarães gera ainda vão para o lixo.',
    });
    const cw = 2.85; const gap = 0.243; const y = 1.95; const h = 3.1;
    [['301,3 t', 'recolhidas à parte em 2025', 'medido · 4 entidades · 0,16 kg/hab/mês', C.accent1],
      ['≈ 3 003 t/ano', 'ainda no indiferenciado', 'estimativa · 1,596 kg/hab/mês', C.accent2],
      ['105,64 €/t', 'custo de aterro evitado', '40 € TGR + 65,64 € Resinorte · Vitrus', C.accent1],
      [`${DIAS_2028} dias`, 'até 17 abr 2028', 'RAP têxtil · Diretiva (UE) 2025/1892', C.accent3]].forEach(([big, lab, sub, col], i) => {
      const x = MX + i * (cw + gap);
      stat(s, x, y, cw, h, big, lab, sub, { bigSize: 38, color: col, labelSize: 14, subSize: 12 });
    });
    L.rule(s, MX, 5.4, CW, { color: H.tinta });
    text(s, [
      { text: 'Captura atual: 9,1%. ', options: { bold: true, color: C.accent1 } },
      { text: 'Guimarães gera cerca de 3 304,6 t de têxtil por ano (3 003,3 t no indiferenciado + 301,3 t recolhidas à parte, estimativa); a rede atual capta 301,3 t. Cerca de 9 em cada 10 kg vão para o lixo.' },
    ], { x: MX, y: 5.55, w: CW, h: 1.0, fontSize: 16, valign: 'top' });
  }

  // 6. Destino do recolhido
  {
    const s = slide({
      kicker: 'O que a Vitrus já recolhe', title: 'Do que se recolhe, 59,4% é reutilizado, 26,5% reciclado e 14,1% é rejeito',
      time: '0:15', core: false,
      sources: 'Vitrus, destinos 2025 (H Sarah Trading e Ultriplo: kg pesados; Nova Etapa: percentagens do relatório; Vitrus: amostra To Be Green de 5,6 t) · dados tratados do projeto',
      notes: 'Para onde vão as 301,3 toneladas. Quatro entidades: a H Sarah Trading com 118,6 toneladas, a Ultriplo com 134,1, a Nova Etapa com 42,9 e a recolha própria da Vitrus, que é só uma amostra de 5,6 toneladas, com a To Be Green. No total, 59,4 por cento vai para reutilização, 26,5 para reciclagem e 14,1 para rejeito, 42,3 toneladas. Duas notas de rigor. Primeira: dois destes valores são pesados, kg exatos por destino, na Sarah e na Ultriplo; os da Nova Etapa e da Vitrus são percentagens de relatório aplicadas ao total, e por isso entram na quota central mas não nos intervalos. Segunda: só a reutilização conta como receita no nosso modelo, porque reciclar custa mais do que fibra virgem, como a Vitrus nos disse. Por isso o valor está em levar têxtil limpo e seco até à reutilização.',
    });
    s.addChart(pres.charts.BAR, [
      { name: 'Reutilização', labels: ['Ultriplo', 'H Sarah Trading', 'Nova Etapa', 'Vitrus (amostra)'], values: [97.7, 59.3, 21.4, 0.5] },
      { name: 'Reciclagem', labels: ['Ultriplo', 'H Sarah Trading', 'Nova Etapa', 'Vitrus (amostra)'], values: [17.0, 43.9, 17.2, 1.9] },
      { name: 'Rejeito', labels: ['Ultriplo', 'H Sarah Trading', 'Nova Etapa', 'Vitrus (amostra)'], values: [19.4, 15.4, 4.3, 3.2] },
    ], Object.assign(chartBase(), {
      x: MX, y: 1.85, w: 7.6, h: 4.9, barDir: 'bar', barGrouping: 'stacked', chartColors: [H.floresta, H.areia, H.terra],
      showLegend: true, legendPos: 'b', showValue: true, dataLabelPosition: 'ctr', dataLabelFormatCode: '#,##0.0', dataLabelColor: 'FFFFFF',
      showTitle: true, title: 'Toneladas por destino e entidade, 2025', titleFontSize: 13, titleColor: H.tinta,
      valAxisHidden: false, valAxisLabelFormatCode: '#,##0', catAxisOrientation: 'maxMin',
    }));
    stat(s, 8.55, 1.9, 4.2, 1.5, '59,4%', 'reutilização · 179,0 t', 'a única fração com receita no modelo', { bigSize: 30 });
    stat(s, 8.55, 3.55, 4.2, 1.5, '26,5%', 'reciclagem · 79,9 t', 'custa mais que fibra virgem (Vitrus)', { bigSize: 30, color: H.bronze });
    stat(s, 8.55, 5.2, 4.2, 1.5, '14,1%', 'rejeito · 42,3 t', 'viajou na viatura para ser separado no fim', { bigSize: 30, color: C.accent6 });
  }

  // 7. Rejeito por canal
  {
    const s = slide({
      kicker: 'A contaminação', title: 'O rejeito depende do canal: sem controlo à entrada chega a 56,9%',
      time: '0:17', core: false,
      sources: 'Vitrus 2025; relatório To Be Green (amostra de 5,6 t: LIXO + DESPERDÍCIOS 56,88%; estimativa) · cálculo sobre dados tratados do projeto',
      notes: 'A razão pela qual a Vitrus tem medo de contentores é esta. Entre as entidades que triam profissionalmente, o rejeito anda entre 10 e 14,5 por cento. Mas na amostra da recolha da própria Vitrus, onde não há controlo à entrada, o relatório da To Be Green deu 56,9 por cento de lixo e desperdícios. É uma amostra pequena, 5,6 toneladas, por isso dizemo-lo: estimativa. Mas diz tudo sobre o que acontece quando o têxtil chega sem qualquer verificação. Este é o número que fundamenta duas decisões nossas: a rede sem contentores e, mais à frente, a verificação à porta dentro da proposta de triagem em camadas. À escala do alvo, se o canal sem controlo tivesse esta taxa, seriam cerca de 1 709 toneladas por ano desperdiçadas.',
    });
    s.addChart(pres.charts.BAR, [{ name: 'Rejeito (% do recolhido)', labels: ['Recolha Vitrus\n(amostra, sem controlo)', 'Ultriplo', 'H Sarah Trading', 'Nova Etapa'], values: [56.9, 14.5, 13.0, 10.0] }], Object.assign(chartBase(), {
      x: MX, y: 1.85, w: 7.4, h: 4.9, barDir: 'col', chartColors: [H.terra, H.floresta, H.floresta, H.floresta], showLegend: false,
      showValue: true, dataLabelPosition: 'outEnd', dataLabelFormatCode: '0.0"%"', showTitle: true, title: 'Rejeito por canal, 2025 (% do recolhido)', titleFontSize: 13, titleColor: H.tinta,
      valAxisMaxVal: 70, valAxisMinVal: 0, valAxisLabelFormatCode: '0"%"', barGapWidthPct: 60,
    }));
    iconRow(s, 8.4, 1.95, 4.35, 'TriangleAlert', '56,9% sem controlo', 'Amostra de 5,6 t (estimativa): mais de metade é lixo e desperdício.', { h: 1.2, descSize: 12.5 });
    iconRow(s, 8.4, 3.35, 4.35, 'ShieldCheck', '10% a 14,5% com triagem', 'Os parceiros que triam profissionalmente já sabem separar.', { h: 1.2, descSize: 12.5 });
    iconRow(s, 8.4, 4.75, 4.35, 'Calculator', '≈ 1 709 t/ano', '56,9% × 3 003,3 t: o que se desperdiçaria à escala do alvo sem controlo (estimativa).', { h: 1.4, descSize: 12.5 });
  }

  // 8. Derivação das 3 003 t
  {
    const s = slide({
      kicker: 'De onde vêm as 3 003 toneladas', title: 'O têxtil por desviar sai de dados da Vitrus e da APA, e por isso é estimativa',
      time: '0:19', core: true,
      sources: 'Vitrus, Relatório e Contas 2025, p. 8 · APA, RARU 2025, p. 24 · INE, Censos 2021 (156 830 hab.) · «Dados e modelo», secção 1',
      numbers: ['43 050,5 t', '0,840', '51 250,6 t', '5,86%', '3 003,3 t', '1,596 kg/hab/mês', '9,1%'],
      notes: 'Mostro a conta, porque é a mais importante do modelo e a que mais discutimos. A Vitrus recolhe 43 050,5 toneladas de indiferenciado, que são 84,0 por cento do concelho, segundo o Relatório e Contas de 2025, página 8. Dividindo, o concelho todo produz cerca de 51 250,6 toneladas. A APA, no RARU de 2025, página 24, diz que 5,86 por cento do indiferenciado nacional é têxtil. Aplicado ao concelho: cerca de 3 003,3 toneladas por ano. Por habitante, são 1,596 quilos por mês. A ressalva que fazemos sempre: 5,86 por cento é a média nacional, não uma caracterização do lixo de Guimarães, e o modelo aplica-a igual a todas as freguesias. Uma caracterização local do indiferenciado é um dos dados que mais valor tem para afinar isto. E duas bases que já não usamos: 0,7 quilos por habitante por mês, do plano municipal, que a Vitrus não conhece; e 5,4 por cento sobre 43 051 toneladas, que só contava a parte da Vitrus.',
    });
    const y = 2.0; const bw = 2.0; const bh = 1.45; const g = 0.5;
    const boxes = [
      ['43 050,5 t', 'indiferenciado recolhido pela Vitrus em 2025', 'Vitrus · R&C 2025, p. 8', C.accent1],
      ['÷ 0,840', 'a Vitrus recolhe 84,0% do concelho', 'Vitrus, 22 out 2026', C.accent1],
      ['≈ 51 250,6 t', 'indiferenciado do concelho', 'estimativa', C.accent2],
      ['× 5,86%', 'têxtil no indiferenciado', 'APA · RARU 2025, p. 24', C.accent1],
      ['≈ 3 003,3 t', 'por desviar, por ano', 'estimativa', C.accent2],
    ];
    boxes.forEach(([big, lab, src, col], i) => {
      const x = MX + i * (bw + g);
      card(s, x, y, bw, bh * 1.35, { name: 'passo-conta' });
      text(s, big, { x: x + 0.12, y: y + 0.12, w: bw - 0.24, h: 0.6, fontFace: THEME.headFontFace, fontSize: 21, bold: true, color: col === C.accent2 ? H.bronze : C.accent1, valign: 'middle', align: 'center', fit: 'shrink' });
      text(s, lab, { x: x + 0.12, y: y + 0.78, w: bw - 0.24, h: 0.65, fontSize: 11.5, bold: true, align: 'center' });
      text(s, src, { x: x + 0.12, y: y + 1.5, w: bw - 0.24, h: 0.4, fontSize: 10, color: H.cinza, align: 'center', italic: true });
      if (i < boxes.length - 1) arrow(s, x + bw + 0.05, y + 0.95, x + bw + g - 0.05, y + 0.95);
    });
    table(s, [
      ['Derivado', 'Conta', 'Resultado'],
      ['Por habitante', '3 003,3 t ÷ 156 830 hab. ÷ 12 meses', '1,596 kg/hab/mês (estimativa)'],
      ['Gerado', '3 003,3 t + 301,3 t recolhidas à parte', '≈ 3 304,6 t/ano (estimativa)'],
      ['Captura atual', '301,3 t ÷ 3 304,6 t', '9,1% (estimativa)'],
    ], { x: MX, y: 4.35, w: 7.4, cols: [1.7, 3.5, 2.2], size: 12, rowH: 0.45, name: 'derivados' });
    card(s, 8.4, 4.35, 4.35, 2.3, { fill: C.background1, name: 'nota-bases' });
    text(s, 'Bases que já não usamos', { x: 8.6, y: 4.47, w: 3.95, h: 0.3, fontSize: 14, bold: true, color: C.accent6 });
    bullets(s, ['0,7 kg/hab/mês (1 317 t, captura 22,9%): plano municipal que a Vitrus não conhece', '43 051 t × 5,4% = 2 324,8 t: só a parte da Vitrus e uma percentagem de um estudo local de 2016'], { x: 8.6, y: 4.85, w: 3.95, h: 1.7, size: 11.5, gap: 5 });
  }

  // 9. Diretiva
  {
    const s = slide({
      kicker: 'O relógio de 2028', title: 'Em abril de 2028 quem paga a rede passa a ser o produtor, e Guimarães precisa de chegar com números próprios',
      time: '0:21', core: true,
      sources: 'Diretiva (UE) 2025/1892 (art. 22.º-A n.º 7, 11, 12; art. 22.º-C n.º 9, al. b)) · «Dados e modelo», secção 10 · Passaporte Digital do Produto: contexto do plano municipal, por confirmar',
      notes: 'O que a diretiva muda, em três ideias. Primeira: até 17 de abril de 2028 cada Estado-Membro tem de criar a responsabilidade alargada do produtor para os têxteis: são os produtores, as marcas, que passam a pagar o custo da recolha e do tratamento. Segunda: esse custo é o custo eficiente, determinado com as autoridades locais, artigo 22.º-A, números 7, 11 e 12. Quem chegar a essa mesa a saber o seu custo por tonelada, defende o seu número. Terceira: a rede de recolha não se pode limitar às zonas onde é mais rendível; artigo 22.º-C, número 9, alínea b). Daí a nossa matriz de cobertura por tipo de território, que mostramos no bloco quatro. E há uma quarta, a ecomodulação: as taxas podem variar com o tipo de produto, o que torna valiosa a evidência por marca e por composição que a triagem recolhe. Tudo isto é o que o relatório RAP do Novelo reúne.',
    });
    // linha do tempo
    const ty = 2.75;
    s.addShape(pres.ShapeType.line, { x: MX + 0.3, y: ty, w: CW - 0.6, h: 0, line: { color: H.tinta, width: 1 }, objectName: 'linha-tempo' });
    [['2025', 'Diretiva (UE) 2025/1892', 'cria o regime RAP têxtil'], ['12 nov 2026', 'Hoje', 'a rede e os números a fechar'], ['2027', 'Passaporte Digital', 'dos têxteis (por confirmar)'], ['17 abr 2028', 'Prazo da RAP têxtil', 'os produtores passam a pagar']].forEach(([d, t, sub], i) => {
      const x = MX + 0.3 + i * ((CW - 0.6) / 3);
      s.addShape(pres.ShapeType.rect, { x: x - 0.09, y: ty - 0.09, w: 0.18, h: 0.18, fill: { color: i === 3 ? C.accent3 : i === 1 ? C.accent2 : C.accent1 }, line: { color: i === 3 ? C.accent3 : i === 1 ? C.accent2 : C.accent1, width: 0 }, objectName: 'marco' });
      const ax = Math.min(Math.max(x - 1.2, MX), W - MX - 2.4);
      text(s, d, { x: ax, y: ty - 0.75, w: 2.4, h: 0.4, fontFace: THEME.headFontFace, fontSize: 18, bold: true, align: i === 0 ? 'left' : i === 3 ? 'right' : 'center', color: i === 3 ? C.accent3 : C.text1 });
      text(s, t, { x: ax, y: ty + 0.25, w: 2.4, h: 0.3, fontSize: 12.5, bold: true, align: i === 0 ? 'left' : i === 3 ? 'right' : 'center' });
      text(s, sub, { x: ax, y: ty + 0.55, w: 2.4, h: 0.5, fontSize: 11, color: H.cinza, align: i === 0 ? 'left' : i === 3 ? 'right' : 'center' });
    });
    const cy = 4.2; const cw = 3.9; const g = 0.215;
    [['Custo eficiente', 'Fixado com as autoridades locais (art. 22.º-A, n.º 7, 11 e 12). Guimarães precisa do seu €/t por tipo de território.'],
      ['Rede para todos', 'Não se limita às zonas rendíveis (art. 22.º-C, n.º 9, al. b)). A matriz de cobertura do Novelo mede-o.'],
      ['Ecomodulação', 'As taxas podem variar por tipo de produto. A evidência por marca e composição é a base local.']].forEach(([t, d], i) => {
      const x = MX + i * (cw + g);
      L.rule(s, x, cy, cw, { color: H.tinta });
      text(s, t, { x, y: cy + 0.15, w: cw, h: 0.4, fontFace: THEME.headFontFace, fontSize: 20, bold: true });
      text(s, d, { x, y: cy + 0.7, w: cw - 0.2, h: 1.6, fontSize: 13, color: C.text1 });
    });
  }

  // ================================================================== 02 Dados
  section('02', 'Os dados recebidos', 'O que a Vitrus nos enviou, como o tratámos e onde estão os limites.', 'Segundo bloco: os dados. Quem vai dar seguimento a isto precisa de saber exatamente o que recebemos, de onde vem cada ficheiro e o que ainda falta.', '0:24');

  // 10. Fontes
  {
    const s = slide({
      kicker: 'Fontes de dados', title: 'Todos os números do modelo vêm de sete fontes, e cada uma está identificada com data e uso',
      time: '0:25', core: false,
      sources: '«Análise dos dados recebidos» · «Dados e modelo», secção «Fontes de dados» · dados tratados do projeto',
      notes: 'A lista completa das fontes. Da Vitrus: os Excel de circuitos e viaturas e de têxtil por entidade e por destino; o Relatório e Contas de 2025; e o pacote QGIS de contentores municipais, de 20 de outubro. Os ficheiros originais ficam guardados à parte e não são públicos, porque são vossos. Do INE: população por freguesia, Censos 2021, e a tipologia de áreas urbanas. A CAOP 2019 dá os contornos oficiais das freguesias. Do OpenStreetMap, num extrato da Geofabrik de Portugal, vêm as estradas para as rotas. Da APA, o 5,86 por cento. Cada ficheiro tem o seu SHA-256 registado no seed: se alguém mudar um dado, o sistema sabe. E os dados tratados regeneram-se a partir dos originais.',
    });
    table(s, [
      ['Fonte', 'O que contém', 'Data', 'Uso no modelo'],
      ['Vitrus · Excel de têxtil', 'Totais anuais por entidade e por destino (4 entidades, 2025)', '2025', 'Ponto de partida; destinos; quota de reutilização'],
      ['Vitrus · Circuitos e viaturas', '40 circuitos, 29 viaturas, 82 localidades, folha de turnos', '2025', 'Contexto; acessibilidade; hábito de dias fixos'],
      ['Vitrus · Pacote QGIS', '2 751 contentores municipais em 2 026 locais; CAOP 2019', '20 out 2026', 'Locais candidatos; produtores B2B; densidade'],
      ['Vitrus · R&C 2025 e respostas', '84,0% do concelho; aterro 105,64 €/t; estaleiro', '22 out 2026', 'Procura; custo evitado; origem das rotas'],
      ['APA · RARU 2025', '5,86% de têxtil no indiferenciado (p. 24)', '2025', 'Procura de têxtil por desviar'],
      ['INE · Censos 2021 e TIPAU', '156 830 hab. por freguesia; tipologia urbano-rural', '2021', 'Procura por zona; matriz de cobertura'],
      ['OpenStreetMap · Geofabrik', 'Estradas de Portugal (OSRM próprio, ODbL)', '20 out 2026', 'Km e traçado das rotas'],
    ], { x: MX, y: 1.9, w: CW, cols: [2.9, 4.4, 1.3, 3.53], size: 12, rowH: 0.55, name: 'fontes-dados' });
    text(s, 'Os ficheiros originais da Vitrus ficam guardados à parte e não são públicos. Cada um tem uma impressão digital (SHA-256) registada, e os dados tratados regeneram-se a partir deles.', { x: MX, y: 6.45, w: CW, h: 0.45, fontSize: 12, italic: true, color: H.cinza });
  }

  // 11. Rede municipal
  {
    const s = slide({
      kicker: 'A rede municipal', title: 'A Vitrus tem 2 751 contentores em 2 026 locais, e nenhum é de têxteis',
      time: '0:28', core: true,
      sources: 'Vitrus, pacote QGIS de 20 out 2026 (SHA-256 registado) · CAOP 2019 · dados tratados do projeto · «Análise dos contentores municipais»',
      notes: 'O pacote QGIS que a Vitrus nos enviou a 20 de outubro é a base geográfica de tudo. São 2 751 contentores de outras frações: profundidade, superfície, orgânico coletivo, orgânico de produtores e resíduos verdes. Agrupámo-los em 2 026 locais: 1 573 públicos, 452 de produtores e um misto. Atenção: nenhum destes contentores é de têxteis. Servem para saber onde a viatura já passa e onde as pessoas já vão. No mapa, a verde, os 1 187 locais públicos com contentor de rua, que são os candidatos a paragem; a cinzento, os que só têm orgânico ou verdes; e a areia, os produtores: restauração, escolas, lares. Notem a concentração no centro e em Azurém, e como as freguesias do norte têm poucos pontos. Tudo está exportável em GeoJSON para o vosso QGIS.',
    });
    s.addImage({ path: img('mapa-rede-municipal.png'), x: MX, y: 1.75, w: 5.0, h: 5.1, sizing: { type: 'contain', w: 5.0, h: 5.1 }, altText: 'Mapa dos 2 026 locais da rede municipal' });
    stat(s, 6.0, 1.9, 2.3, 1.55, '2 751', 'contentores', 'aceites; 2 722 com coordenada', { bigSize: 28 });
    stat(s, 8.45, 1.9, 2.15, 1.55, '2 026', 'locais', 'agrupados por proximidade', { bigSize: 28 });
    stat(s, 10.75, 1.9, 2.0, 1.55, '48', 'freguesias', '156 830 habitantes', { bigSize: 28 });
    table(s, [
      ['Tipo de local', 'Locais'],
      ['Públicos com contentor de rua (profundidade, superfície, plataforma)', '1 187'],
      ['Públicos só com orgânico coletivo ou verdes', '387'],
      ['Produtores (restauração, escolas, lares, hotelaria…)', '452'],
    ], { x: 6.0, y: 3.7, w: 6.75, cols: [5.3, 1.45], size: 12, rowH: 0.5, align: ['left', 'right'], boldFirst: false, name: 'tipos-local' });
    text(s, 'Um dos 1 187 é um local «misto» (um produtor com contentor de superfície, em Moreira de Cónegos). Exportação GeoJSON, CSV e XLSX no ecrã /municipal.', { x: 6.0, y: 5.85, w: 6.75, h: 0.8, fontSize: 12, color: H.cinza, italic: true });
  }

  // 12. Candidatos
  {
    const s = slide({
      kicker: 'Onde pode parar a viatura', title: 'Há 1 273 candidatos a paragem: 1 187 locais públicos e 86 escolas, e nenhum recebe contentor',
      time: '0:31', core: true,
      sources: 'dados tratados do projeto (textile_candidate, coord_precision, producer_types) · verificado a 11 nov 2026',
      numbers: ['1 187', '86', '1 273', '837', '350'],
      notes: 'Esta é a lista de onde pode parar a viatura, e verificámo-la ficheiro a ficheiro. Candidatos públicos: 1 187, locais que têm pelo menos um contentor de rua, ou seja profundidade, superfície ou plataforma. Não entram os 387 que só têm orgânico ou resíduos verdes. Pontos assistidos: 86 escolas da rede municipal, que já têm uma campanha de têxteis com a Vitrus; no ficheiro não são marcados como candidatos, mas o modelo trata-os como pontos assistidos, onde o têxtil é entregue dentro, com pessoas. Total: 1 273. E dois avisos que dão trabalho: 350 dos 1 187 têm coordenada aproximada, cerca de 100 metros, e têm de ser confirmados no terreno. Reparem no mapa: concentram-se nas freguesias do norte. E um dos 1 187 é um local de um grande produtor, em Moreira de Cónegos. O que nunca acontece: nenhum destes locais recebe um contentor de têxteis. A paragem é um encontro anunciado, o saco entrega-se à mão.',
    });
    s.addImage({ path: img('mapa-candidatos.png'), x: MX, y: 1.75, w: 5.0, h: 5.1, sizing: { type: 'contain', w: 5.0, h: 5.1 }, altText: 'Mapa dos 1 273 candidatos' });
    // funil
    const fx = 6.0; const fw = 6.75;
    const rows = [['2 026', 'locais da rede municipal', 1.0, C.text2], ['1 573 + 1', 'públicos e um misto', 0.86, C.accent1], ['1 187', 'com contentor de rua: candidatos públicos', 0.74, C.accent1], ['+ 86', 'escolas (pontos assistidos)', 0.64, C.accent2], ['= 1 273', 'candidatos a paragem', 0.56, C.accent3]];
    rows.forEach(([big, lab, frac, col], i) => {
      const y = 1.85 + i * 0.78; const w = fw * frac; const x = fx + (fw - w) / 2;
      s.addShape(pres.ShapeType.rect, { x, y, w, h: 0.66, fill: { color: col }, line: { color: col, width: 0 }, objectName: 'funil' });
      text(s, [{ text: `${big}  `, options: { bold: true, fontSize: 17 } }, { text: lab, options: { fontSize: 12 } }], { x: x + 0.1, y, w: w - 0.2, h: 0.66, color: C.background1, valign: 'middle', align: 'center' });
    });
    iconRow(s, 6.0, 5.85, 3.2, 'MapPin', '837 precisas', 'coordenada fiável', { h: 0.8, descSize: 12, titleSize: 14 });
    iconRow(s, 9.4, 5.85, 3.4, 'TriangleAlert', '350 aproximadas', 'confirmar no terreno (~100 m)', { h: 0.8, descSize: 12, titleSize: 14 });
  }

  // 13. Qualidade dos dados
  {
    const s = slide({
      kicker: 'Qualidade e limites', title: 'Conhecemos os limites dos dados: aqui está o que ainda está por resolver',
      time: '0:34', core: false,
      sources: 'dados tratados do projeto · alertas de qualidade dos dados · «Análise dos dados recebidos»',
      notes: 'Para quem vai trabalhar com isto, os limites dos dados, sem maquilhagem. Primeiro, circuitos: dos 40 circuitos, 9 não têm viatura na folha de turnos; a Vitrus já nos disse que a folha tem erros, e que esses circuitos circulam, por isso contamos todas as passagens. Duas viaturas nunca foram atribuídas a nenhum turno. Segundo, geografia: das 82 localidades dos circuitos, 79 ficam em freguesia pela regra de nome ou de ponto, e 3 ficam por resolver, estão nos alertas, não escondidas. Terceiro, contentores: 2 751 aceites, 3 rejeitados e 29 pendentes de coordenada. Quarto: não temos têxtil por freguesia nem por contentor, a Vitrus não tem dados de deposição de têxtil; por isso a procura por freguesia é proporcional à população. Quinto: só há um ano de têxtil, 2025, por isso não há backtest temporal e não fingimos um. Cada um destes pontos tem uma ação possível, e vários dependem só de os pedirmos à Vitrus.',
    });
    table(s, [
      ['Limite', 'Estado hoje', 'O que o resolve'],
      ['Circuitos sem viatura na folha de turnos', '9 de 40; a Vitrus diz que a folha tem erros', 'Folha de turnos corrigida'],
      ['Viaturas sem turno', '2 de 29 nunca atribuídas', 'Confirmar se estão ativas'],
      ['Localidades sem freguesia', '3 de 82 por resolver (nos alertas)', 'Confirmação da Vitrus'],
      ['Coordenada de contentores', '29 pendentes, 3 rejeitados; 350 locais candidatos aproximados', 'Validação no terreno'],
      ['Têxtil por freguesia ou contentor', 'Não existe; procura proporcional à população', 'Caracterização do indiferenciado'],
      ['Série temporal', 'Só 2025, totais anuais; sem backtest', 'Kg mensais por entidade'],
      ['Custos por hora e por km das viaturas', 'Por receber do financeiro da Vitrus', 'Os dois valores'],
    ], { x: MX, y: 1.9, w: CW, cols: [3.9, 4.8, 3.43], size: 12.5, rowH: 0.56, name: 'limites-dados' });
  }
};

function path_(rel) {
  return require('node:path').join(__dirname, '../../', rel);
}
