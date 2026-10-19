import type { TextileDestination } from '@/client';

// Cores dos destinos (tokens de gráfico). Usadas em barras HTML e no Sankey.
export const DESTINATIONS: {
  key: TextileDestination;
  className: string;
  hex: { light: string; dark: string };
}[] = [
  { key: 'reuse', className: 'bg-chart-1', hex: { light: '#2e6b57', dark: '#7fb39c' } },
  { key: 'recycle', className: 'bg-chart-2', hex: { light: '#7fb39c', dark: '#2e6b57' } },
  { key: 'reject', className: 'bg-chart-3', hex: { light: '#c4a06a', dark: '#c4a06a' } },
];
