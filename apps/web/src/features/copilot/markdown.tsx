import type { ReactNode } from 'react';

// Markdown mínimo e seguro: parágrafos, listas, **negrito** e `código`. Nunca interpreta HTML nem links,
// porque o texto vem de um modelo e é desenhado só com elementos React.

const INLINE = /(\*\*[^*]+\*\*|`[^`]+`)/g;

function renderInline(text: string): ReactNode[] {
  return text.split(INLINE).map((part, i) => {
    const key = `${i}-${part.slice(0, 8)}`;
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4)
      return <strong key={key}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2)
      return (
        <code key={key} className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">
          {part.slice(1, -1)}
        </code>
      );
    return part;
  });
}

type Block = { kind: 'p'; lines: string[] } | { kind: 'ul' | 'ol'; items: string[] };

const BULLET = /^\s*[-*•]\s+(.*)$/;
const ORDERED = /^\s*\d+[.)]\s+(.*)$/;
const HEADING = /^#{1,6}\s+(.*)$/;

export function parseBlocks(source: string): Block[] {
  const blocks: Block[] = [];
  for (const raw of source.replace(/\r\n/g, '\n').split('\n')) {
    const line = raw.trimEnd();
    const last = blocks[blocks.length - 1];
    if (!line.trim()) {
      blocks.push({ kind: 'p', lines: [] });
      continue;
    }
    const bullet = BULLET.exec(line);
    const ordered = ORDERED.exec(line);
    const kind = bullet ? 'ul' : ordered ? 'ol' : 'p';
    const text =
      (bullet ?? ordered)?.[1] ??
      (HEADING.exec(line)?.[1] ? `**${HEADING.exec(line)?.[1]}**` : line);
    if (kind === 'p') {
      if (last?.kind === 'p') last.lines.push(text);
      else blocks.push({ kind: 'p', lines: [text] });
    } else if (last?.kind === kind) last.items.push(text);
    else blocks.push({ kind, items: [text] });
  }
  return blocks.filter((b) => (b.kind === 'p' ? b.lines.length > 0 : b.items.length > 0));
}

export function SafeMarkdown({ text }: { text: string }) {
  return (
    <div className="space-y-2 text-sm leading-relaxed [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5">
      {parseBlocks(text).map((b, i) => {
        const key = `${b.kind}-${i}`;
        if (b.kind === 'p') return <p key={key}>{renderInline(b.lines.join(' '))}</p>;
        const Tag = b.kind;
        return (
          <Tag key={key} className="space-y-1">
            {b.items.map((item, j) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: lista estática derivada do texto
              <li key={`${j}-${item.slice(0, 8)}`}>{renderInline(item)}</li>
            ))}
          </Tag>
        );
      })}
    </div>
  );
}
