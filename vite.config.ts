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
      includeAssets: ['icons/*.png', 'icons/*.svg'],
      manifest: {
        id: './',
        name: 'Thần Công Bida',
        short_name: 'Thần Công',
        description: 'Game bida kỹ năng: 8 bi, 9 bi, 10 bi, bi-a phăng',
        lang: 'vi',
        display: 'fullscreen',
        orientation: 'landscape',
        background_color: '#07110d',
        theme_color: '#07110d',
        start_url: './',
        scope: './',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: { cleanupOutdatedCaches: true, globPatterns: ['**/*.{js,css,html,png,svg,webp,woff2,woff,json}'], maximumFileSizeToCacheInBytes: 6_000_000 },
    }),
  ],
  test: { include: ['tests/**/*.test.ts'], testTimeout: 60_000 },
});
