import { Fragment, type ReactNode } from 'react';

const SEP = '\u0001';

/** Marcador para passar a uma mensagem do Paraglide e depois trocar por um nó React (ver `rich`). */
export const slot = (name: string): string => `${SEP}${name}${SEP}`;

/** Parte uma mensagem nos marcadores `slot` e intercala os nós dados, sem partir a tradução em pedaços. */
export function rich(text: string, slots: Record<string, ReactNode>): ReactNode {
  return text.split(SEP).map((part, i) =>
    i % 2 === 1 ? (
      // biome-ignore lint/suspicious/noArrayIndexKey: partes estáticas de uma frase
      <Fragment key={i}>{slots[part]}</Fragment>
    ) : (
      part
    ),
  );
}
