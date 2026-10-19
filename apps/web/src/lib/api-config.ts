import type { CreateClientConfig } from '../client/client.gen';

// Mesmo domínio em produção (o nginx do web encaminha /api para a API); em dev, o proxy do Vite.
export const createClientConfig: CreateClientConfig = (config) => ({
  ...config,
  baseUrl: import.meta.env.VITE_API_URL ?? '',
});
