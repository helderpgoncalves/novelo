import { paraglideVitePlugin } from '@inlang/paraglide-js';
import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';
import paraglideOptions from './paraglide.options.mjs';

// Em dev, /api vai para a API (no Docker: http://api:8000; fora do Docker: localhost:8190).
const apiTarget = process.env.API_PROXY_TARGET ?? 'http://localhost:8190';

export default defineConfig({
  plugins: [
    // Mensagens tipadas (messages/*.json -> src/paraglide). O idioma vem do URL (/pt, /en), depois da preferência guardada.
    paraglideVitePlugin(paraglideOptions as Parameters<typeof paraglideVitePlugin>[0]),
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    react(),
    tailwindcss(),
    VitePWA({
      // Prompt: a versão nova espera pelo toque em "Atualizar" (ver lib/pwa.ts) em vez de trocar a app a meio de uma tarefa.
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'favicon.ico', 'fonts/*.woff2', 'icons/apple-touch-icon.png'],
      manifest: {
        id: '/',
        name: 'Novelo',
        short_name: 'Novelo',
        description: 'Recolha seletiva de têxteis de Guimarães, desenhada ao menor custo.',
        lang: 'pt-PT',
        dir: 'ltr',
        start_url: '/?source=pwa',
        scope: '/',
        display: 'standalone',
        display_override: ['standalone', 'minimal-ui'],
        orientation: 'any',
        categories: ['business', 'productivity', 'utilities'],
        shortcuts: [
          {
            name: 'Simulador',
            short_name: 'Simulador',
            description: 'Desenhar a rede ao menor custo',
            url: '/simulator?source=shortcut',
            icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
          },
          {
            name: 'Copiloto',
            short_name: 'Copiloto',
            description: 'Perguntar ao copiloto em linguagem natural',
            url: '/chat?source=shortcut',
            icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
          },
          {
            name: 'Cobertura da rede',
            short_name: 'Cobertura',
            description: 'Onde a recolha já chega e onde falta',
            url: '/coverage?source=shortcut',
            icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
          },
          {
            name: 'Triagem',
            short_name: 'Triagem',
            description: 'Classificar uma peça com a câmara',
            url: '/triage?source=shortcut',
            icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
          },
        ],
        background_color: '#F4F1EA',
        theme_color: '#F4F1EA',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: '/icons/maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        screenshots: [
          {
            src: '/screenshots/mobile-home.png',
            sizes: '780x1688',
            type: 'image/png',
            form_factor: 'narrow',
            label: 'Ponto de partida da rede de recolha',
          },
          {
            src: '/screenshots/mobile-map.png',
            sizes: '780x1688',
            type: 'image/png',
            form_factor: 'narrow',
            label: 'Mapa da rede',
          },
          {
            src: '/screenshots/desktop-home.png',
            sizes: '1440x900',
            type: 'image/png',
            form_factor: 'wide',
            label: 'Ponto de partida da rede de recolha',
          },
        ],
      },
      workbox: {
        // Só a casca da app fica em cache; a API (dados autenticados) nunca.
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/robots\.txt$/, /^\/sitemap\.xml$/],
        globPatterns: ['**/*.{js,mjs,css,html,svg,png,woff2}'],
        globIgnores: ['screenshots/**'],
        maximumFileSizeToCacheInBytes: 3_000_000,
      },
    }),
  ],
  resolve: { alias: { '@': '/src' } },
  // O worker do MapLibre não sobrevive à pré-otimização de dependências do Vite em dev.
  optimizeDeps: { exclude: ['maplibre-gl'] },
  server: {
    proxy: { '/api': { target: apiTarget, changeOrigin: true } },
    watch: { usePolling: process.env.CHOKIDAR_USEPOLLING === 'true' },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id: string) =>
          id.includes('node_modules/echarts') || id.includes('node_modules/zrender')
            ? 'echarts'
            : undefined,
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
    // Threads: arranque mais barato que processos; cada ficheiro continua isolado.
    pool: 'threads',
    exclude: ['node_modules', 'e2e'],
  },
});
