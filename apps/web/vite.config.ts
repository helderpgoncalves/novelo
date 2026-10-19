import { paraglideVitePlugin } from '@inlang/paraglide-js';
import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

// Em dev, /api vai para a API (no Docker: http://api:8000; fora do Docker: localhost:8190).
const apiTarget = process.env.API_PROXY_TARGET ?? 'http://localhost:8190';

export default defineConfig({
  plugins: [
    // Mensagens tipadas (messages/*.json -> src/paraglide). O idioma vem do URL (/pt, /en), depois da preferência guardada.
    paraglideVitePlugin({
      project: './project.inlang',
      outdir: './src/paraglide',
      strategy: ['url', 'localStorage', 'preferredLanguage', 'baseLocale'],
      urlPatterns: [
        {
          pattern: '/:path(.*)?',
          localized: [
            ['pt-PT', '/pt/:path(.*)?'],
            ['en', '/en/:path(.*)?'],
          ],
        },
      ],
    }),
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'fonts/*.woff2', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'Novelo',
        short_name: 'Novelo',
        description: 'Recolha seletiva de têxteis de Guimarães, desenhada ao menor custo.',
        lang: 'pt-PT',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#F4F1EA',
        theme_color: '#2E6B57',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icons/maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Só a casca da app fica em cache; a API (dados autenticados) nunca.
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        maximumFileSizeToCacheInBytes: 3_000_000,
      },
    }),
  ],
  resolve: { alias: { '@': '/src' } },
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
    exclude: ['node_modules', 'e2e'],
  },
});
