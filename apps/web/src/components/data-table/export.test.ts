import { inflateRawSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import {
  BOM,
  buildMatrix,
  csvField,
  type ExportColumn,
  exportCell,
  exportFileName,
  formatDatePt,
  toCsv,
  toJson,
  toTsv,
} from './export';
import { buildXlsx, buildZip, columnRef, crc32, excelSerial, sheetXml } from './xlsx';

const cols: ExportColumn[] = [
  { id: 'name', label: 'Nome', type: 'text', get: (r) => (r as { n: string }).n },
  { id: 'qty', label: 'Qtd', type: 'number', get: (r) => (r as { q: number | null }).q },
  { id: 'day', label: 'Dia', type: 'date', get: (r) => (r as { d: string | null }).d },
];
const data = [
  { n: 'Ronfe; "norte"', q: 1234.5, d: '2026-03-01' },
  { n: '=SOMA(A1)', q: 0.1 + 0.2, d: null },
  { n: 'linha\nnova', q: -3, d: '2026-12-31' },
];

describe('CSV para Excel pt-PT', () => {
  it('começa com BOM, usa ; e CRLF, vírgula decimal e datas dd/mm/aaaa', () => {
    const csv = toCsv(
      cols.map((c) => c.label),
      buildMatrix(cols, data, false),
      ';',
    );
    expect(csv.startsWith(BOM)).toBe(true);
    const lines = csv.slice(1).split('\r\n');
    expect(lines[0]).toBe('Nome;Qtd;Dia');
    expect(lines[1]).toBe('"Ronfe; ""norte""";1234,5;01/03/2026');
    expect(lines[2]).toBe("'=SOMA(A1);0,3;");
    expect(lines[3]).toBe('"linha\nnova";-3;31/12/2026');
  });

  it('separador vírgula usa ponto decimal; valores crus mantêm ISO', () => {
    const csv = toCsv(
      cols.map((c) => c.label),
      buildMatrix(cols, data, true),
      ',',
    );
    const lines = csv.slice(1).split('\r\n');
    expect(lines[1]).toBe('"Ronfe; ""norte""",1234.5,2026-03-01');
  });

  it('números negativos não são tratados como fórmula, texto sim', () => {
    expect(csvField(-3, ';')).toBe('-3');
    expect(csvField('-3 kg', ';')).toBe("'-3 kg");
    expect(csvField('+351', ',')).toBe("'+351");
    expect(csvField(null, ';')).toBe('');
    expect(csvField(true, ';')).toBe('true');
  });

  it('exportCell: nulos, ruído de vírgula flutuante e datas com hora', () => {
    expect(exportCell('', 'text', false)).toBeNull();
    expect(exportCell(0.1 + 0.2, 'number', false)).toBe(0.3);
    expect(exportCell(Number.NaN, 'number', false)).toBeNull();
    expect(formatDatePt('2026-03-01', false)).toBe('01/03/2026');
    expect(formatDatePt('nao-data', false)).toBe('nao-data');
    expect(exportCell('2026-03-01T10:05:00', 'datetime', false)).toMatch(/^01\/03\/2026 10:05$/);
  });
});

describe('outros formatos', () => {
  it('TSV limpa tabulações e quebras de linha', () => {
    expect(toTsv(['a', 'b'], [['x\ty', 1]])).toBe('a\tb\nx y\t1');
  });

  it('JSON usa ids como chaves e valores crus', () => {
    const json = JSON.parse(toJson(cols, data)) as Record<string, unknown>[];
    expect(json[0]).toEqual({ name: 'Ronfe; "norte"', qty: 1234.5, day: '2026-03-01' });
    expect(json[1]?.day).toBeNull();
  });

  it('nome de ficheiro com data e sem acentos', () => {
    expect(exportFileName('Circuitos atuais', 'csv', new Date(2026, 9, 20))).toBe(
      'circuitos-atuais-2026-10-20.csv',
    );
    expect(exportFileName('', 'xlsx', new Date(2026, 0, 5))).toBe('tabela-2026-01-05.xlsx');
  });
});

describe('XLSX', () => {
  it('crc32 conhecido', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
  });

  it('referências de coluna', () => {
    expect([0, 25, 26, 27, 701, 702].map(columnRef)).toEqual(['A', 'Z', 'AA', 'AB', 'ZZ', 'AAA']);
  });

  it('números de série do Excel', () => {
    expect(excelSerial('1970-01-01', false)).toBe(25569);
    expect(excelSerial('2026-03-01', false)).toBe(46082);
    expect(excelSerial('lixo', false)).toBeNull();
  });

  it('a folha tem números e datas verdadeiros e texto escapado', () => {
    const xml = sheetXml(
      [
        { label: 'A&B', type: 'text' },
        { label: 'Qtd', type: 'number' },
        { label: 'Dia', type: 'date' },
      ],
      [['x<y', 12.5, '2026-03-01']],
    );
    expect(xml).toContain('A&amp;B');
    expect(xml).toContain('x&lt;y');
    expect(xml).toContain('<c r="B2"><v>12.5</v></c>');
    expect(xml).toContain('<c r="C2" s="2"><v>46082</v></c>');
    expect(xml).toContain('<autoFilter ref="A1:C2"/>');
  });

  it('o ZIP é válido: nomes, CRC e conteúdo descomprimido', async () => {
    const blob = await buildXlsx(
      'Circuitos [1]',
      [
        { label: 'Nome', type: 'text' },
        { label: 'Qtd', type: 'number' },
      ],
      [
        ['Ronfe', 1],
        ['Selho', 2],
      ],
    );
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const view = new DataView(bytes.buffer);
    // fim do diretório central
    const eocd = bytes.length - 22;
    expect(view.getUint32(eocd, true)).toBe(0x06054b50);
    const count = view.getUint16(eocd + 10, true);
    let offset = view.getUint32(eocd + 16, true);
    const names: string[] = [];
    let sheet = '';
    for (let i = 0; i < count; i++) {
      const method = view.getUint16(offset + 10, true);
      const crc = view.getUint32(offset + 16, true);
      const packed = view.getUint32(offset + 20, true);
      const size = view.getUint32(offset + 24, true);
      const nameLen = view.getUint16(offset + 28, true);
      const local = view.getUint32(offset + 42, true);
      const name = new TextDecoder().decode(bytes.slice(offset + 46, offset + 46 + nameLen));
      names.push(name);
      const start = local + 30 + view.getUint16(local + 26, true);
      const body = bytes.slice(start, start + packed);
      const raw = method === 8 ? new Uint8Array(inflateRawSync(body)) : body;
      expect(raw.length).toBe(size);
      expect(crc32(raw)).toBe(crc);
      if (name === 'xl/worksheets/sheet1.xml') sheet = new TextDecoder().decode(raw);
      offset += 46 + nameLen;
    }
    expect(names).toEqual([
      '[Content_Types].xml',
      '_rels/.rels',
      'xl/workbook.xml',
      'xl/_rels/workbook.xml.rels',
      'xl/styles.xml',
      'xl/worksheets/sheet1.xml',
    ]);
    expect(sheet).toContain('Ronfe');
    expect(sheet).toContain('<v>2</v>');
  });

  it('buildZip com entrada vazia não rebenta', async () => {
    const zip = await buildZip([{ name: 'a.txt', data: new Uint8Array() }]);
    expect(zip.length).toBeGreaterThan(22);
  });
});
