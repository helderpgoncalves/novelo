import { defineConfig } from '@hey-api/openapi-ts';

// Cliente gerado a partir do contrato da API. Nunca editar src/client à mão: `just gen`.
export default defineConfig({
  input: '../../openapi.json',
  output: { path: 'src/client', clean: true },
  plugins: [
    '@hey-api/typescript',
    { name: '@hey-api/client-fetch', runtimeConfigPath: '@/lib/api-config' },
    '@hey-api/sdk',
    'zod',
    '@tanstack/react-query',
  ],
});
