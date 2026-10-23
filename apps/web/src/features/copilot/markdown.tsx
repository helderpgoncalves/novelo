import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

// Markdown seguro para texto de um modelo: parágrafos, títulos, listas, citações, tabelas, código,
// **negrito**, *itálico*, `código` e ligações http(s)/internas. Nunca interpreta HTML: tudo vira elementos React.

export type Block =
  | { kind: 'p'; text: string }
  | { kind: 'h'; level: number; text: string }
  | { kind: 'ul' | 'ol'; items: string[] }
  | { kind: 'quote'; text: string }
  | { kind: 'code'; text: string }
  | { kind: 'hr' }
  | { kind: 'table'; head: string[]; rows: string[][] };

const BULLET = /^\s*[-*•]\s+(.*)$/;
const ORDERED = /^\s*\d+[.)]\s+(.*)$/;
const HEADING = /^(#{1,6})\s+(.*)$/;
const FENCE = /^\s*```/;
const RULE = /^\s*([-*_])(\s*\1){2,}\s*$/;
const TABLE_SEP = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;

const cells = (line: string): string[] =>
  line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim());

export function parseBlocks(source: string): Block[] {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let i = 0;
  const startsBlock = (line: string) =>
    FENCE.test(line) ||
    HEADING.test(line) ||
    BULLET.test(line) ||
    ORDERED.test(line) ||
    line.trimStart().startsWith('>') ||
    RULE.test(line);

  while (i < lines.length) {
    const line = (lines[i] ?? '').trimEnd();
    if (!line.trim()) {
      i += 1;
      continue;
    }
    if (FENCE.test(line)) {
      const code: string[] = [];
      i += 1;
      while (i < lines.length && !FENCE.test(lines[i] ?? '')) {
        code.push(lines[i] ?? '');
        i += 1;
      }
      i += 1; // fecha (ou fim do texto, se o bloco ainda está a chegar)
      blocks.push({ kind: 'code', text: code.join('\n') });
      continue;
    }
    const heading = HEADING.exec(line);
    if (heading) {
      blocks.push({ kind: 'h', level: (heading[1] ?? '#').length, text: heading[2] ?? '' });
      i += 1;
      continue;
    }
    if (RULE.test(line)) {
      blocks.push({ kind: 'hr' });
      i += 1;
      continue;
    }
    if (line.includes('|') && TABLE_SEP.test(lines[i + 1] ?? '')) {
      const head = cells(line);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && (lines[i] ?? '').includes('|') && (lines[i] ?? '').trim()) {
        rows.push(cells(lines[i] ?? ''));
        i += 1;
      }
      blocks.push({ kind: 'table', head, rows });
      continue;
    }
    if (line.trimStart().startsWith('>')) {
      const quote: string[] = [];
      while (i < lines.length && (lines[i] ?? '').trimStart().startsWith('>')) {
        quote.push((lines[i] ?? '').replace(/^\s*>\s?/, ''));
        i += 1;
      }
      blocks.push({ kind: 'quote', text: quote.join(' ') });
      continue;
    }
    const kind = BULLET.test(line) ? 'ul' : ORDERED.test(line) ? 'ol' : null;
    if (kind) {
      const items: string[] = [];
      const re = kind === 'ul' ? BULLET : ORDERED;
      while (i < lines.length) {
        const m = re.exec(lines[i] ?? '');
        if (m) {
          items.push(m[1] ?? '');
          i += 1;
        } else if ((lines[i] ?? '').trim() && /^\s{2,}\S/.test(lines[i] ?? '') && items.length) {
          items[items.length - 1] += ` ${(lines[i] ?? '').trim()}`;
          i += 1;
        } else break;
      }
      blocks.push({ kind, items });
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && (lines[i] ?? '').trim() && !startsBlock(lines[i] ?? '')) {
      if (para.length && (lines[i] ?? '').includes('|') && TABLE_SEP.test(lines[i + 1] ?? ''))
        break;
      para.push((lines[i] ?? '').trim());
      i += 1;
    }
    if (para.length === 0) {
      para.push(line.trim());
      i += 1;
    }
    blocks.push({ kind: 'p', text: para.join(' ') });
  }
  return blocks;
}

const INLINE =
  /(\*\*[^*\n]+\*\*|`[^`\n]+`|\[[^\]\n]+\]\(\s*[^)\s]+\s*\)|(?<![\w*])\*[^*\s][^*\n]*\*(?![\w*]))/g;

const SAFE_HREF = /^(https?:\/\/|mailto:)/i;

function renderLink(label: string, href: string, key: string): ReactNode {
  if (href.startsWith('/api/')) {
    // Ficheiros da API (PDF do relatório): descarregam-se, não são rotas do web.
    return (
      <a
        key={key}
        href={href}
        target="_blank"
        rel="noreferrer noopener"
        className="text-primary underline underline-offset-2"
      >
        {label}
      </a>
    );
  }
  if (href.startsWith('/') && !href.startsWith('//')) {
    return (
      <Link key={key} to={href as never} className="text-primary underline underline-offset-2">
        {label}
      </Link>
    );
  }
  if (SAFE_HREF.test(href)) {
    return (
      <a
        key={key}
        href={href}
        target="_blank"
        rel="noreferrer noopener"
        className="text-primary underline underline-offset-2"
      >
        {label}
      </a>
    );
  }
  return label;
}

export function renderInline(text: string): ReactNode[] {
  return text.split(INLINE).map((part, i) => {
    const key = `${i}-${part.slice(0, 8)}`;
    if (!part) return null;
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4)
      return <strong key={key}>{renderInline(part.slice(2, -2))}</strong>;
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2)
      return (
        <code key={key} className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">
          {part.slice(1, -1)}
        </code>
      );
    const link = /^\[([^\]]+)\]\(\s*([^)\s]+)\s*\)$/.exec(part);
    if (link) return renderLink(link[1] ?? '', link[2] ?? '', key);
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2)
      return <em key={key}>{part.slice(1, -1)}</em>;
    return part;
  });
}

export function SafeMarkdown({ text, className }: { text: string; className?: string }) {
  return (
    <div
      data-testid="copilot-text"
      className={
        className ??
        'space-y-3 text-[0.9375rem] leading-relaxed [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5'
      }
    >
      {parseBlocks(text).map((b, i) => {
        const key = `${b.kind}-${i}`;
        switch (b.kind) {
          case 'p':
            return <p key={key}>{renderInline(b.text)}</p>;
          case 'h':
            return (
              <p key={key} className="font-semibold text-base">
                {renderInline(b.text)}
              </p>
            );
          case 'quote':
            return (
              <blockquote key={key} className="border-l-2 pl-3 text-muted-foreground">
                {renderInline(b.text)}
              </blockquote>
            );
          case 'hr':
            return <hr key={key} className="border-border" />;
          case 'code':
            return (
              <pre
                key={key}
                className="overflow-x-auto rounded-lg bg-muted p-3 font-mono text-[0.8125rem] leading-relaxed"
              >
                <code>{b.text}</code>
              </pre>
            );
          case 'table':
            return (
              <div key={key} className="overflow-x-auto rounded-lg ring-1 ring-foreground/10">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {b.head.map((h, c) => (
                        // biome-ignore lint/suspicious/noArrayIndexKey: colunas fixas da tabela do texto
                        <TableHead key={c}>{renderInline(h)}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {b.rows.map((row, r) => (
                      // biome-ignore lint/suspicious/noArrayIndexKey: linhas fixas da tabela do texto
                      <TableRow key={r}>
                        {row.map((cell, c) => (
                          // biome-ignore lint/suspicious/noArrayIndexKey: células fixas da tabela do texto
                          <TableCell key={c}>{renderInline(cell)}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            );
          default: {
            const Tag = b.kind;
            return (
              <Tag key={key} className="space-y-1">
                {b.items.map((item, j) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: lista estática derivada do texto
                  <li key={`${j}-${item.slice(0, 8)}`}>{renderInline(item)}</li>
                ))}
              </Tag>
            );
          }
        }
      })}
    </div>
  );
}

/** Os excertos vêm em Markdown: nas listas mostram-se como texto simples. */
export const plainText = (text: string): string =>
  text
    .replace(/[*_`#>]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
