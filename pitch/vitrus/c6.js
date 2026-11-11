'use strict';
/** Parte 6: quem somos, a vitória no Hack4Guimarães, a imprensa e o agradecimento final. */
const path = require('node:path');
const L = require('./lib');
const { pres, C, H, MX, CW, W, slide, section, table, text, bullets, rule, vrule, img, THEME } = L;

module.exports = function build() {
  section('09', 'Quem somos', 'A equipa, o Hack4Guimarães 2035 e o que a imprensa escreveu.', 'Para fechar, dois minutos sobre quem somos, o que aconteceu no Hack4Guimarães e o que se escreveu. Não é para falar de nós: é para que fique claro de onde vem este trabalho.', 'final');

  // Equipa
  {
    const s = slide({
      kicker: 'Quem somos', title: 'Dois engenheiros informáticos de Barcelos desenharam, programaram e puseram o Novelo em produção',
      core: false,
      sources: 'ECO, 3 nov 2026 · O Minho, 28 out 2026 · Rádio Alto Minho, 29 out 2026 · Mais Guimarães, 28 out 2026',
      notes: 'Quem somos, em poucas palavras. Hélder Gonçalves e Flávio Fernandes, os dois de Barcelos, com formação em Engenharia Informática na Universidade Politécnica de Viana do Castelo. Um traço que a imprensa notou e que nos define melhor do que um currículo: os dois vêm do ciclismo, e o Hélder foi ciclista profissional no pelotão nacional até aos 25 anos. É uma escola de paciência e de regularidade, que ajuda num trabalho como este. O Novelo nasceu em cinco dias de maratona no Hack4Guimarães, e a parte de que mais nos orgulhamos é a seguinte: quando os mentores da Vitrus nos disseram que não querem contentores de têxtil nem o camião do lixo, refizemos o modelo em dois dias. Desde então, ligámos os dados reais, as rotas pelas estradas e o relatório para 2028, e a plataforma está em produção.',
    });
    const cw = 5.85;
    [['Hélder Gonçalves', ['Natural de Barcelos', 'Licenciado em Engenharia Informática (UNIPVC)', 'Foi ciclista profissional no pelotão nacional até aos 25 anos']],
      ['Flávio Fernandes', ['Natural de Barcelos', 'Engenharia Informática (UNIPVC)', 'Formação desportiva no ciclismo, tal como o Hélder']]].forEach(([nome, items], i) => {
      const x = MX + i * (cw + 0.43);
      rule(s, x, 1.9, cw, { color: H.tinta });
      text(s, nome, { x, y: 2.05, w: cw, h: 0.7, fontFace: THEME.headFontFace, fontSize: 34, bold: true });
      bullets(s, items, { x, y: 2.95, w: cw, h: 1.9, size: 15, gap: 9 });
    });
    const y = 5.0;
    [['5 dias', 'de maratona no Hack4Guimarães 2035, de 19 a 23 de outubro de 2026'], ['2 dias', 'a refazer o modelo depois de os mentores da Vitrus dizerem que não querem contentores nem o camião do lixo'], ['Em produção', 'plataforma com dados reais da Vitrus, rotas pelas estradas e relatório RAP']].forEach(([big, lab], i) => {
      const x = MX + i * 4.1;
      rule(s, x, y, 3.85, { color: H.linha });
      text(s, big, { x, y: y + 0.1, w: 3.85, h: 0.55, fontFace: THEME.headFontFace, fontSize: 28, bold: true, color: C.accent1 });
      text(s, lab, { x, y: y + 0.7, w: 3.85, h: 0.9, fontSize: 12, color: H.cinza });
    });
  }

  // A vitória
  {
    const s = slide({
      kicker: 'Hack4Guimarães 2035', title: 'O Novelo ganhou o concurso geral do Hack4Guimarães 2035 e o desafio TexVitrus, 8 500 € em prémios',
      core: false,
      sources: 'Mais Guimarães, 28 out 2026 · O Minho, 28 out 2026 · O Amarense, 30 out 2026 · Imagem: Município de Guimarães, via Jornal T (2 nov 2026)',
      numbers: ['1.º lugar', '7 500 €', '1 000 €', '8 500 €'],
      notes: 'O reconhecimento, com os factos. O Hack4Guimarães 2035 foi uma maratona de cinco dias, de 19 a 23 de outubro de 2026; as equipas apresentaram a 26 de outubro; e a entrega de prémios foi a 28 de outubro, no encerramento do Mês da Economia de Guimarães, com a presença do presidente da Câmara, Ricardo Araújo, e do presidente da CCDR-Norte, Álvaro Santos. O Novelo ficou em primeiro lugar no concurso geral, 7 500 euros, e ganhou também o desafio TexVitrus, lançado pela Vitrus Ambiente, 1 000 euros: 8 500 euros no total. A fotografia é da cerimónia, do Município de Guimarães, publicada pelo Jornal T. Dizemo-lo para uma razão só: foi esse desafio, e foram os dados que a Vitrus abriu, que tornaram o resto possível.',
    });
    s.addImage({ path: path.join(__dirname, 'img/foto-premio.png'), x: MX, y: 1.85, w: 6.3, h: 3.02, altText: 'Hélder Gonçalves e Flávio Fernandes com o cheque do 1.º lugar do Hack4Guimarães 2035, na cerimónia de 28 de outubro de 2026' });
    text(s, 'Entrega de prémios, 28 de outubro de 2026, no encerramento do Mês da Economia de Guimarães. Imagem: Município de Guimarães, via Jornal T.', { x: MX, y: 4.97, w: 6.3, h: 0.5, fontSize: 10.5, color: H.cinza });
    text(s, 'A cerimónia contou com o presidente da Câmara Municipal de Guimarães, Ricardo Araújo, e com o presidente da CCDR-Norte, Álvaro Santos (O Minho, Mais Guimarães).', { x: MX, y: 5.62, w: 6.3, h: 0.8, fontSize: 12.5 });
    text(s, '1.º lugar', { x: 7.4, y: 1.8, w: 5.3, h: 1.1, fontFace: THEME.headFontFace, fontSize: 56, bold: true, color: C.accent1 });
    text(s, 'Hack4Guimarães 2035, concurso geral', { x: 7.4, y: 2.85, w: 5.3, h: 0.4, fontSize: 15, bold: true });
    table(s, [
      ['Prémio', 'Valor'],
      ['Concurso geral', '7 500 €'],
      ['Desafio TexVitrus (Vitrus Ambiente)', '1 000 €'],
      ['Total', '8 500 €'],
    ], { x: 7.4, y: 3.45, w: 5.35, cols: [3.95, 1.4], size: 13.5, rowH: 0.45, align: ['left', 'right'], name: 'premios' });
    table(s, [
      ['Calendário', ''],
      ['19 a 23 de outubro', 'Maratona de cinco dias'],
      ['26 de outubro', 'Apresentação ao júri'],
      ['28 de outubro', 'Entrega de prémios'],
    ], { x: 7.4, y: 5.4, w: 5.35, cols: [2.3, 3.05], size: 12, rowH: 0.34, name: 'calendario-hack' });
  }

  // Imprensa
  {
    const s = slide({
      kicker: 'Na imprensa', title: 'Dez órgãos de comunicação noticiaram o Novelo entre 28 de outubro e 3 de novembro',
      core: false,
      sources: 'Capturas dos artigos (primeiro ecrã), obtidas a 11 nov 2026 · direitos de cada órgão de comunicação',
      notes: 'O que se escreveu. Dez órgãos de comunicação noticiaram o projeto entre 28 de outubro e 3 de novembro: o ECO, o Jornal T, o O Minho, o E24, o O Amarense, a Rádio Alto Minho, a Rádio Fundação, o Mais Guimarães, a Portugal Têxtil e a FashionNetwork. Mostramos seis, só para se ver o tom. Não é o que mais importa, mas serve para dizer duas coisas: o problema dos têxteis em Guimarães interessa a quem lê, e a Vitrus e o Município ficaram associados a uma resposta concreta a esse problema, em vez de a mais um estudo.',
    });
    const items = [
      ['eco', 'ECO · 3 nov', 'Dois jovens de Barcelos querem desatar o nó da recolha de resíduos têxteis em Guimarães'],
      ['ominho', 'O Minho · 28 out', 'Engenheiros de Barcelos ganham prémio de 7.500 euros por inovação na gestão dos resíduos têxteis'],
      ['e24', 'E24 · 29 out', 'Guimarães: Plataforma «Novelo» vence Hack4Guimarães e combate lixo têxtil'],
      ['oamarense', 'O Amarense · 30 out', 'Dois jovens de Barcelos vencem Hack4Guimarães 2035 com plataforma para recolha de resíduos têxteis'],
      ['radioaltominho', 'Rádio Alto Minho · 29 out', '«Novelo»: projeto de estudante e antigo aluno da UNIPVC vence dois prémios em Guimarães'],
      ['radiofundacao', 'Rádio Fundação · 29 out', 'Projeto «Novelo» vence o Hack4Guimarães 2035 e o desafio TextVitrus'],
    ];
    const cw = 3.85; const g = 0.29; const ih = cw * (899 / 2160);
    items.forEach(([f, outlet, title], i) => {
      const col = i % 3; const row = Math.floor(i / 3);
      const x = MX + col * (cw + g); const y = 1.8 + row * 2.45;
      s.addImage({ path: path.join(__dirname, `img/newsc-${f}.png`), x, y, w: cw, h: ih, line: { color: H.linha, width: 0.75 }, altText: `${outlet}: ${title}` });
      text(s, outlet, { x, y: y + ih + 0.08, w: cw, h: 0.25, fontSize: 11.5, bold: true });
      text(s, title, { x, y: y + ih + 0.34, w: cw, h: 0.45, fontSize: 10.5, color: H.cinza });
    });
    text(s, 'Também: Jornal T, Mais Guimarães, Portugal Têxtil e FashionNetwork.', { x: MX, y: 6.62, w: CW, h: 0.3, fontSize: 11.5, color: H.cinza });
  }

  // Citações
  {
    const s = slide({
      kicker: 'Na imprensa', title: 'O que a imprensa escreveu sobre o problema e sobre a solução',
      core: false,
      sources: 'ECO, 3 nov 2026 (Hélder Gonçalves) · Mais Guimarães, 28 out 2026 · O Minho, 28 out 2026 (Vitrus Ambiente)',
      notes: 'Três frases, de três artigos. A primeira é do Hélder ao ECO e resume o projeto: ajudar o município a decidir como recolher mais têxtil, ao menor custo, para que do saco se possa voltar ao fio. A segunda, do Mais Guimarães, diz o problema: nove em cada dez quilos de têxtil descartado acabam no lixo comum. A terceira é da própria Vitrus, citada pelo O Minho: a reflexão sobre novas soluções para a economia circular e a valorização destes materiais. É esta última que nos interessa mais: o desafio era da Vitrus, e é com a Vitrus que queremos continuar.',
    });
    const q = [
      ['«O Novelo ajuda o município a decidir como recolher mais têxtil, ao menor custo, para que do saco se possa voltar ao fio.»', 'Hélder Gonçalves, ao ECO (3 nov 2026)'],
      ['«…nove em cada dez quilos de têxtil descartado acabam no lixo comum.»', 'Mais Guimarães (28 out 2026)'],
      ['«…reflexão sobre novas soluções para a economia circular e a valorização destes materiais.»', 'Vitrus Ambiente, citada pelo O Minho (28 out 2026)'],
    ];
    q.forEach(([t, who], i) => {
      const y = 1.85 + i * 1.65;
      rule(s, MX, y, CW, { color: i === 0 ? H.tinta : H.linha });
      text(s, t, { x: MX, y: y + 0.15, w: 10.6, h: 0.95, fontFace: THEME.headFontFace, fontSize: i === 0 ? 26 : 22, bold: i === 0, valign: 'top' });
      text(s, who, { x: MX, y: y + (i === 1 ? 0.78 : 1.15), w: CW, h: 0.3, fontSize: 12, color: H.cinza });
    });
  }

  // Agradecimento final
  {
    const s = pres.addSlide({ masterName: 'CAPA' });
    const notes = 'Para acabar, o agradecimento. À Vitrus Ambiente, pelo desafio, pelos dados e pela franqueza com que os mentores nos disseram o que não queriam: foi isso que desenhou a rede. Ao Município de Guimarães, e ao senhor presidente, pela oportunidade de apresentar este trabalho. E a vós todos, pelo tempo. Somos o Hélder Gonçalves e o Flávio Fernandes, e o Novelo está em novelo.helder.si. Agora, a vossa vez: tudo o que quiserem perguntar, discutir ou criticar.';
    L.GUIAO.push({ n: L.bump(), kind: 'fecho', section: '09 · Quem somos', title: 'Obrigado', time: 'final', core: true, app: null, notes });
    s.addNotes(notes);
    s.addImage({ path: path.join(__dirname, 'img/fundo-agradecimento.jpg'), x: 0, y: 0, w: W, h: 7.5, altText: 'Fundo: vista de Guimarães em trama de pontos (dither), da marca Novelo' });
    s.addImage({ path: path.join(__dirname, '../../brand/logotipo/novelo-logotipo-negativo@3x.png'), x: 0.8, y: 0.65, w: 2.3, h: 2.3 * (197 / 640), altText: 'Novelo' });
    text(s, 'Obrigado.', { x: 0.8, y: 1.55, w: 9.5, h: 2.1, fontFace: THEME.headFontFace, fontSize: 120, bold: true, color: C.background2, valign: 'middle' });
    text(s, 'À Vitrus Ambiente e ao Município de Guimarães, pelo desafio, pelos dados e pela confiança.', { x: 0.8, y: 3.8, w: 6.6, h: 1.0, fontSize: 20, color: C.background2 });
    text(s, [
      { text: 'Hélder Gonçalves', options: { breakLine: true } },
      { text: 'Flávio Fernandes', options: {} },
    ], { x: 0.8, y: 5.1, w: 8, h: 1.5, fontFace: THEME.headFontFace, fontSize: 44, bold: true, color: C.background2, valign: 'top' });
    text(s, 'Novelo · Hack4Guimarães 2035 · Desafio TexVitrus · Guimarães, 12 de novembro de 2026', { x: 0.8, y: 6.75, w: 9, h: 0.35, fontSize: 12.5, color: H.areia });
    s.addShape(pres.ShapeType.rect, { x: 10.7, y: 4.85, w: 2.0, h: 2.0, fill: { color: C.background2 }, line: { color: C.background2, width: 0 }, objectName: 'fundo-qr' });
    s.addImage({ path: path.join(__dirname, '../qr-novelo.png'), x: 10.78, y: 4.93, w: 1.84, h: 1.84, altText: 'QR para novelo.helder.si' });
    text(s, 'novelo.helder.si', { x: 10.7, y: 6.9, w: 2.0, h: 0.3, fontSize: 12.5, bold: true, color: C.background2, align: 'center' });
  }
};
