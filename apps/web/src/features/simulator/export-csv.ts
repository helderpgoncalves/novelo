import type { Allocation } from '@/client';
import { m } from '@/paraglide/messages';

const cell = (value: string | number | null | undefined) => {
  const text =
    value == null ? '' : typeof value === 'number' ? String(value).replace('.', ',') : value;
  return /[;"\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

/** CSV por freguesia (separador `;` e vírgula decimal, para abrir direto no Excel em pt-PT). */
export function allocationsToCsv(allocations: Allocation[]): string {
  const head = [
    m.alloc_parish(),
    m.alloc_mode(),
    m.alloc_population(),
    m.alloc_points(),
    m.alloc_tonnes(),
    m.alloc_capex(),
  ];
  const rows = allocations.map((a) =>
    [a.parish_name, a.modes.join(' + '), a.population, a.points, a.tonnes, a.capex_eur]
      .map(cell)
      .join(';'),
  );
  return `﻿${[head.map(cell).join(';'), ...rows].join('\r\n')}\r\n`;
}

export function downloadCsv(filename: string, csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
