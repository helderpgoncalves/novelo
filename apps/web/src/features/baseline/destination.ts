// Cores dos destinos (tokens de gráfico). Usadas em barras HTML e no Sankey.
export const DESTINATIONS = [
  {
    key: 'reuse',
    label: 'Reutilização',
    className: 'bg-chart-1',
    hex: { light: '#2e6b57', dark: '#7fb39c' },
  },
  {
    key: 'recycle',
    label: 'Reciclagem',
    className: 'bg-chart-2',
    hex: { light: '#7fb39c', dark: '#2e6b57' },
  },
  {
    key: 'reject',
    label: 'Rejeito',
    className: 'bg-chart-3',
    hex: { light: '#c4a06a', dark: '#c4a06a' },
  },
] as const;

export type DestinationKey = (typeof DESTINATIONS)[number]['key'];
