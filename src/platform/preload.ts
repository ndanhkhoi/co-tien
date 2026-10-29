import ART from 'virtual:art-manifest';
import { CHAMPIONS } from '../game/content/sects';

/**
 * Art lives in one lasting Cache Storage bucket ("art"), filled by this loader and served by the
 * service worker (vite.config.ts). Every file carries a content revision, so the set is kept in
 * step with the build file by file: a new build refetches only paintings that changed.
 *
 * 1. Loading screen — the first launch downloads the whole set (the player waits once), and
 *    a build with new art fetches just what changed. With data saver on, only the core set.
 * 2. Background — whatever is still missing, slowly, from the menus.
 * 3. Match — both champions and the table's sect, checked and decoded before the table opens.
 */

const base = new URL(import.meta.env.BASE_URL, document.baseURI).href;
const url = (path: string) => base + path;
const CACHE = 'art';
const REV = 'x-art-rev';
const DONE_KEY = 'cotien.assets';
/** Files known to be cached at their current revision during this session. */
const fresh = new Set<string>();

type Entry = [string, number, string];

function champFiles(id: string): Entry[] {
  return ART.filter(([p]) => p.startsWith(`art/champions/${id}/`));
}
function sectFiles(sect: string): Entry[] {
  return ART.filter(([p]) => p.startsWith(`art/sects/${sect}/`));
}

function coreList(champion: string): Entry[] {
  const own = CHAMPIONS.find((c) => c.id === champion);
  const set = new Map<string, Entry>();
  for (const e of ART) {
    const p = e[0];
    if (p.startsWith('art/ui/') || p.startsWith('art/table/') || p.startsWith('art/skills/') ||
      p.endsWith('/portrait.webp') || p.endsWith('/emblem.webp')) set.set(p, e);
  }
  for (const e of champFiles(champion)) set.set(e[0], e);
  if (own) for (const e of sectFiles(own.sect)) set.set(e[0], e);
  return [...set.values()];
}

const saveData = () => !!(navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;

async function openArt(): Promise<Cache | null> {
  try {
    return 'caches' in window ? await caches.open(CACHE) : null;
  } catch {
    return null;
  }
}

/** Entries missing from the cache or cached at an older revision. */
async function stale(cache: Cache | null, list: Entry[]): Promise<Entry[]> {
  const todo = list.filter(([p]) => !fresh.has(p));
  if (!cache) return todo;
  const out: Entry[] = [];
  for (let i = 0; i < todo.length; i += 48) {
    await Promise.all(todo.slice(i, i + 48).map(async (e) => {
      const hit = await cache.match(url(e[0])).catch(() => undefined);
      if (hit?.headers.get(REV) === e[2]) fresh.add(e[0]);
      else out.push(e);
    }));
  }
  return out;
}

/**
 * Bring `list` up to date in the art cache. Progress counts bytes still to download, so a build
 * that changed three paintings finishes in a moment. Returns true when every file made it.
 */
async function sync(list: Entry[], parallel: number, onProgress?: (f: number, got: number, total: number) => void, pause?: () => Promise<void>): Promise<boolean> {
  const cache = await openArt();
  const need = await stale(cache, list);
  const total = need.reduce((a, [, n]) => a + n, 0);
  let got = 0;
  let ok = true;
  let i = 0;
  onProgress?.(total ? 0 : 1, 0, total);
  const worker = async () => {
    while (i < need.length) {
      const [p, n, rev] = need[i++];
      try {
        // ?rev= skips the worker's cache route and any stale HTTP copy.
        const r = await fetch(`${url(p)}?rev=${rev}`);
        if (!r.ok) throw new Error(String(r.status));
        const blob = await r.blob();
        await cache?.put(url(p), new Response(blob, { headers: { 'content-type': 'image/webp', [REV]: rev } }));
        fresh.add(p);
      } catch {
        // Offline, blocked or storage full: the image loads on demand and the next launch retries.
        ok = false;
      }
      got += n;
      onProgress?.(got / total, got, total);
      if (pause) await pause();
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(parallel, need.length)) }, worker));
  return ok;
}

/** Drop cached files that are no longer part of the game. */
async function prune() {
  const cache = await openArt();
  if (!cache) return;
  const keep = new Set(ART.map(([p]) => url(p)));
  for (const req of await cache.keys()) if (!keep.has(req.url)) void cache.delete(req);
}

function mark(state: 'all' | 'core') {
  try {
    localStorage.setItem(DONE_KEY, `${__ART_VERSION__}:${state}`);
  } catch {
    // Storage unavailable: the loading screen will just check again next time.
  }
}
function marked(): string | null {
  try {
    return localStorage.getItem(DONE_KEY);
  } catch {
    return null;
  }
}

/** Nothing was ever downloaded on this device: the very first launch. */
export function firstLaunch(): boolean {
  return marked() === null;
}

/** True when this art version is already on the device (at least its core). */
export function coreReady(): boolean {
  return marked()?.startsWith(`${__ART_VERSION__}:`) ?? false;
}

/** Loading screen: the whole set (or the core with data saver on), with byte progress. */
export async function preloadCore(champion: string, onProgress: (f: number, got: number, total: number) => void) {
  const whole = !saveData();
  const ok = await sync(whole ? ART : coreList(champion), 6, onProgress);
  mark(ok && whole ? 'all' : 'core');
  if (ok && whole) void prune();
}

/** Keep the paintings every menu shows decoded in memory, so screens never paint blank. */
const held: HTMLImageElement[] = [];
function holdDecoded(paths: string[]) {
  for (const p of paths) {
    const img = new Image();
    img.src = url(p);
    held.push(img);
    void img.decode().catch(() => undefined);
  }
}

let background = false;
/** Whatever is still missing, slowly and without competing with play; skipped with data saver on. */
export function preloadBackground(champion?: string) {
  if (background) return;
  background = true;
  const idle = () => new Promise<void>((r) => ('requestIdleCallback' in window
    ? (window as Window & { requestIdleCallback: (f: () => void) => void }).requestIdleCallback(() => r())
    : setTimeout(r, 120)));
  setTimeout(() => {
    holdDecoded([
      ...ART.map(([p]) => p).filter((p) => /^art\/ui\/[^/]+\.webp$/.test(p) || p.startsWith('art/ui/frame/')),
      ...(champion ? champFiles(champion).filter(([p]) => p.endsWith('cutout.webp')).map(([p]) => p) : []),
    ]);
    if (marked() === `${__ART_VERSION__}:all` || saveData()) return;
    void sync(ART, 2, undefined, idle).then((ok) => {
      if (!ok) return;
      mark('all');
      void prune();
    });
  }, 1500);
}

/** Both champions and the table's sect; images are decoded so the first cut-in never stutters. */
export async function preloadMatch(champions: string[], sect: string) {
  const list = [...champions.flatMap(champFiles), ...sectFiles(sect)];
  await sync(list, 6);
  await Promise.all(list
    .filter(([p]) => p.endsWith('cutout.webp') || p.includes('/flip/') || p.endsWith('cutin.webp'))
    .map(([p]) => {
      const img = new Image();
      img.src = url(p);
      return img.decode().catch(() => undefined);
    }));
}
