/**
 * Escritor mínimo de XLSX (Office Open XML) sem dependências: uma folha, cabeçalho a negrito com filtro
 * automático e linha fixa, números e datas verdadeiros (não texto). Carregado sob demanda pelo export.
 */
import type { ColumnType } from './types';

type XlsxCell = string | number | boolean | null;

const encoder = new TextEncoder();

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) crc = (CRC_TABLE[(crc ^ byte) & 0xff] ?? 0) ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

export interface ZipEntry {
  name: string;
  data: Uint8Array;
}

async function deflateRaw(data: Uint8Array): Promise<Uint8Array | null> {
  if (typeof CompressionStream === 'undefined') return null;
  const source = new ReadableStream({
    start(controller) {
      controller.enqueue(data);
      controller.close();
    },
  });
  const packed = source.pipeThrough(new CompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(packed).arrayBuffer());
}

/** ZIP com compressão deflate quando o navegador a oferece, senão só arquivo ("stored"). */
export async function buildZip(entries: ZipEntry[]): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  const now = new Date();
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();

  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const crc = crc32(entry.data);
    const packed = await deflateRaw(entry.data);
    const body = packed && packed.length < entry.data.length ? packed : entry.data;
    const method = body === entry.data ? 0 : 8;

    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true); // nomes em UTF-8
    local.setUint16(8, method, true);
    local.setUint16(10, dosTime, true);
    local.setUint16(12, dosDate, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, body.length, true);
    local.setUint32(22, entry.data.length, true);
    local.setUint16(26, name.length, true);
    chunks.push(new Uint8Array(local.buffer), name, body);

    const dir = new DataView(new ArrayBuffer(46));
    dir.setUint32(0, 0x02014b50, true);
    dir.setUint16(4, 20, true);
    dir.setUint16(6, 20, true);
    dir.setUint16(8, 0x0800, true);
    dir.setUint16(10, method, true);
    dir.setUint16(12, dosTime, true);
    dir.setUint16(14, dosDate, true);
    dir.setUint32(16, crc, true);
    dir.setUint32(20, body.length, true);
    dir.setUint32(24, entry.data.length, true);
    dir.setUint16(28, name.length, true);
    dir.setUint32(42, offset, true);
    central.push(new Uint8Array(dir.buffer), name);

    offset += 30 + name.length + body.length;
  }

  const centralSize = central.reduce((n, c) => n + c.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, entries.length, true);
  end.setUint16(10, entries.length, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, offset, true);

  const all = [...chunks, ...central, new Uint8Array(end.buffer)];
  const out = new Uint8Array(all.reduce((n, c) => n + c.length, 0));
  let pos = 0;
  for (const c of all) {
    out.set(c, pos);
    pos += c.length;
  }
  return out;
}

/** Caracteres de controlo (exceto tab, LF e CR) não são válidos em XML 1.0. */
const stripControl = (s: string) =>
  Array.from(s)
    .filter((ch) => {
      const code = ch.charCodeAt(0);
      return code >= 0x20 || code === 0x09 || code === 0x0a || code === 0x0d;
    })
    .join('');

const escapeXml = (s: string) =>
  stripControl(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** A, B, ... Z, AA, AB ... */
export function columnRef(index: number): string {
  let n = index;
  let out = '';
  do {
    out = String.fromCharCode(65 + (n % 26)) + out;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return out;
}

/** Número de série do Excel (dias desde 1899-12-30) a partir de uma data ISO, na hora local. */
export function excelSerial(iso: string, withTime: boolean): number | null {
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (dateOnly) {
    const [, y, m, d] = dateOnly;
    return Date.UTC(Number(y), Number(m) - 1, Number(d)) / 86_400_000 + 25_569;
  }
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return null;
  const local = Date.UTC(
    dt.getFullYear(),
    dt.getMonth(),
    dt.getDate(),
    withTime ? dt.getHours() : 0,
    withTime ? dt.getMinutes() : 0,
  );
  return local / 86_400_000 + 25_569;
}

const STYLE = { header: 1, date: 2, datetime: 3 } as const;

function cellXml(ref: string, value: XlsxCell, type: ColumnType): string {
  if (value === null || value === '') return '';
  if (typeof value === 'number') return `<c r="${ref}"><v>${value}</v></c>`;
  if (typeof value === 'boolean') return `<c r="${ref}" t="b"><v>${value ? 1 : 0}</v></c>`;
  if (type === 'date' || type === 'datetime') {
    const serial = excelSerial(value, type === 'datetime');
    if (serial !== null) {
      const s = type === 'date' ? STYLE.date : STYLE.datetime;
      return `<c r="${ref}" s="${s}"><v>${serial}</v></c>`;
    }
  }
  return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
}

export function sheetXml(
  columns: { label: string; type: ColumnType }[],
  matrix: XlsxCell[][],
): string {
  const widths = columns.map((c, i) => {
    let max = c.label.length;
    for (const row of matrix.slice(0, 500)) {
      const v = row[i];
      if (v !== null && v !== undefined) max = Math.max(max, String(v).length);
    }
    return Math.min(60, Math.max(8, max + 2));
  });
  const cols = widths
    .map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`)
    .join('');
  const head = columns
    .map(
      (c, i) =>
        `<c r="${columnRef(i)}1" s="${STYLE.header}" t="inlineStr"><is><t>${escapeXml(c.label)}</t></is></c>`,
    )
    .join('');
  const body = matrix
    .map((row, r) => {
      const cells = columns
        .map((c, i) => cellXml(`${columnRef(i)}${r + 2}`, row[i] ?? null, c.type))
        .join('');
      return `<row r="${r + 2}">${cells}</row>`;
    })
    .join('');
  const last = `${columnRef(Math.max(0, columns.length - 1))}${matrix.length + 1}`;
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
    `<cols>${cols}</cols><sheetData><row r="1">${head}</row>${body}</sheetData>` +
    `<autoFilter ref="A1:${last}"/></worksheet>`
  );
}

const STYLES_XML =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
  '<numFmts count="2"><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/><numFmt numFmtId="165" formatCode="dd/mm/yyyy\\ hh:mm"/></numFmts>' +
  '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
  '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>' +
  '<fill><patternFill patternType="solid"><fgColor rgb="FFE9E4D8"/><bgColor indexed="64"/></patternFill></fill></fills>' +
  '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  '<cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
  '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>' +
  '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
  '<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs>' +
  '</styleSheet>';

const sanitizeSheetName = (name: string) =>
  name
    .replace(/[[\]:*?/\\]/g, ' ')
    .trim()
    .slice(0, 31) || 'Dados';

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export async function buildXlsx(
  sheetName: string,
  columns: { label: string; type: ColumnType }[],
  matrix: XlsxCell[][],
): Promise<Blob> {
  const xml = (s: string) => encoder.encode(s);
  const head = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  const zip = await buildZip([
    {
      name: '[Content_Types].xml',
      data: xml(
        `${head}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
          '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
          '<Default Extension="xml" ContentType="application/xml"/>' +
          '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
          '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
          '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>',
      ),
    },
    {
      name: '_rels/.rels',
      data: xml(
        `${head}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
          '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
      ),
    },
    {
      name: 'xl/workbook.xml',
      data: xml(
        `${head}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
          `<sheets><sheet name="${escapeXml(sanitizeSheetName(sheetName))}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
      ),
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      data: xml(
        `${head}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
          '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
          '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
      ),
    },
    { name: 'xl/styles.xml', data: xml(STYLES_XML) },
    { name: 'xl/worksheets/sheet1.xml', data: xml(sheetXml(columns, matrix)) },
  ]);
  return new Blob([zip as BlobPart], { type: XLSX_MIME });
}
