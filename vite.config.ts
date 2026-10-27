import { defineConfig } from 'vitest/config';
import pkg from './package.json' with { type: 'json' };
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(`${pkg.version} · ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`),
  },
  build: { target: 'es2022', chunkSizeWarningLimit: 1500 },
  worker: { format: 'es' },
  plugins: [
    VitePWA({
      registerType: 'prompt',
      injectRegister: null,
      includeAssets: ['icons/*.png', 'favicon.ico'],
      manifest: {
        id: './',
        name: 'Cơ Tiên',
        short_name: 'Cơ Tiên',
        description: 'Bida tiên hiệp: 12 môn phái, 60 tướng, 8 bi, 9 bi, 10 bi, phăng',
        lang: 'vi',
        display: 'fullscreen',
        orientation: 'landscape',
        background_color: '#efe8da',
        theme_color: '#efe8da',
        start_url: './',
        scope: './',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        // Precache code, UI art, portraits and skill icons; big art streams in and is cached on first view.
        globPatterns: ['**/*.{js,css,html,png,svg,woff2,woff,json}', 'art/ui/*.webp', 'art/champions/*/portrait.webp', 'art/skills/*.webp', 'art/sects/*/emblem.webp'],
        maximumFileSizeToCacheInBytes: 6_000_000,
        runtimeCaching: [{
          urlPattern: ({ url }) => url.pathname.includes('/art/'),
          handler: 'CacheFirst',
          options: { cacheName: 'art', expiration: { maxEntries: 2500 } },
        }],
      },
    }),
  ],
  test: { include: ['tests/**/*.test.ts'], testTimeout: 60_000 },
});
