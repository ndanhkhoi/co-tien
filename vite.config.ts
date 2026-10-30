import { defineConfig } from 'vitest/config';
import type { Plugin } from 'vitest/config';
import pkg from './package.json' with { type: 'json' };
import { VitePWA } from 'vite-plugin-pwa';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/** Every file under public/art with its size and a content revision, for the asset loader. */
function walkArt(dir = 'public/art'): [string, number, string][] {
  return readdirSync(dir).sort().flatMap((f) => {
    const p = join(dir, f);
    const st = statSync(p);
    if (st.isDirectory()) return walkArt(p);
    if (!f.endsWith('.webp')) return [];
    const rev = createHash('sha1').update(readFileSync(p)).digest('hex').slice(0, 10);
    return [[relative('public', p).split('\\').join('/'), st.size, rev] as [string, number, string]];
  });
}
const ART = walkArt();
/** Changes only when some painting changes; the loading screen checks the art again only then. */
const ART_VERSION = createHash('sha1').update(JSON.stringify(ART)).digest('hex').slice(0, 12);

/**
 * The roster also carries the art briefs (looks, poses, icon prompts) that only the art pipeline
 * reads. The shipped game drops them; tests and scripts still read the full file.
 */
function slimRoster(): Plugin {
  return {
    name: 'slim-roster',
    apply: 'build' as const,
    // Before Vite's JSON plugin, so the file is still plain JSON here.
    enforce: 'pre' as const,
    transform(code: string, id: string) {
      if (!id.endsWith('/content/roster.json')) return null;
      const r = JSON.parse(code);
      for (const c of r.champions) {
        delete c.look; delete c.pose; delete c.expr;
        for (const s of c.skills) delete s.icon;
      }
      for (const s of r.sects) { delete s.motifs; delete s.emblem; delete s.element; }
      return { code: JSON.stringify(r), map: null };
    },
  };
}

/** `virtual:art-manifest`: the art list above. */
function artManifest() {
  const id = 'virtual:art-manifest';
  return {
    name: 'art-manifest',
    resolveId: (s: string) => (s === id ? '\0' + id : null),
    load: (s: string) => (s === '\0' + id ? `export default ${JSON.stringify(ART)};` : null),
  };
}

export default defineConfig({
  base: './',
  define: {
    __ART_VERSION__: JSON.stringify(ART_VERSION),
    __APP_VERSION__: JSON.stringify(`${pkg.version} · ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`),
  },
  build: { target: 'es2022', chunkSizeWarningLimit: 1500 },
  // Workers are bundled with their own plugin list; the AI worker imports the roster too.
  worker: { format: 'es', plugins: () => [slimRoster()] },
  plugins: [
    artManifest(),
    slimRoster(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: null,
      includeAssets: ['icons/*.png', 'favicon.ico'],
      manifest: {
        id: './',
        name: 'Cơ Tiên',
        short_name: 'Cơ Tiên',
        description: 'Bida tiên hiệp: 13 môn phái, 65 tướng, 8 bi, 9 bi, 10 bi, phăng',
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
        // A first visit is served by the worker as soon as it activates, so the art it caches is used at once.
        clientsClaim: true,
        // Code is precached. Art lives in one lasting cache ("art") that the asset loader fills and
        // keeps in step with the build, file by file (src/platform/preload.ts); the worker only
        // serves it. Loader requests carry ?rev= and go straight to the network.
        globPatterns: ['**/*.{js,css,html,png,svg,woff2,woff,json}'],
        runtimeCaching: [{
          urlPattern: ({ url }) => url.pathname.includes('/art/') && !url.searchParams.has('rev'),
          handler: 'CacheFirst',
          options: { cacheName: 'art' },
        }],
      },
    }),
  ],
  test: { include: ['tests/**/*.test.ts'], testTimeout: 60_000 },
});
