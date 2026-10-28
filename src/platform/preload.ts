import ART from 'virtual:art-manifest';
import { CHAMPIONS } from '../game/content/sects';

/**
 * Asset loading in three tiers:
 * 1. core — blocking loading screen on the first launch and after every update: UI, portraits,
 *    skill icons, table art, plus the player's own champion and sect;
 * 2. background — everything else, fetched slowly once the player is in the menus;
 * 3. match — both champions and the table's sect, fetched and decoded when a match opens.
 * Fetching through the service worker fills its art cache, so later views are instant.
 */

const base = new URL(import.meta.env.BASE_URL, document.baseURI).href;
const url = (path: string) => base + path;
const done = new Set<string>();
const DONE_KEY = 'cotien.assets';

type Entry = [string, number];

function champFiles(id: string): Entry[] {
  return ART.filter(([p]) => p.startsWith(`art/champions/${id}/`));
}
function sectFiles(sect: string): Entry[] {
  return ART.filter(([p]) => p.startsWith(`art/sects/${sect}/`));
}

function coreList(champion: string): Entry[] {
  const own = CHAMPIONS.find((c) => c.id === champion);
  const set = new Map<string, number>();
  for (const [p, n] of ART) {
    if (p.startsWith('art/ui/') || p.startsWith('art/table/') || p.startsWith('art/skills/') ||
      p.endsWith('/portrait.webp') || p.endsWith('/emblem.webp')) set.set(p, n);
  }
  for (const [p, n] of champFiles(champion)) set.set(p, n);
  if (own) for (const [p, n] of sectFiles(own.sect)) set.set(p, n);
  return [...set];
}

/** Fetches a list with limited parallelism; progress counts bytes so big files weigh more. */
async function fetchAll(list: Entry[], parallel: number, onProgress?: (f: number) => void, pause?: () => Promise<void>) {
  const total = list.reduce((a, [, n]) => a + n, 0) || 1;
  let got = 0;
  let i = 0;
  const worker = async () => {
    while (i < list.length) {
      const [p, n] = list[i++];
      if (!done.has(p)) {
        try {
          const r = await fetch(url(p));
          if (r.ok) await r.blob();
          done.add(p);
        } catch {
          // Offline or blocked: the image simply loads on demand later.
        }
      }
      got += n;
      onProgress?.(got / total);
      if (pause) await pause();
    }
  };
  await Promise.all(Array.from({ length: parallel }, worker));
}

/** True when the core set for this build is already on the device. */
export function coreReady(): boolean {
  try {
    return localStorage.getItem(DONE_KEY) === __ART_CACHE__;
  } catch {
    return false;
  }
}

export async function preloadCore(champion: string, onProgress: (f: number) => void) {
  await fetchAll(coreList(champion), 6, onProgress);
  try {
    localStorage.setItem(DONE_KEY, __ART_CACHE__);
  } catch {
    // Storage unavailable: the loading screen will just show again next time.
  }
}

let background = false;
/** Everything else, slowly, without competing with gameplay; skipped when the user saves data. */
export function preloadBackground() {
  if (background) return;
  background = true;
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  if (conn?.saveData) return;
  const rest = ART.filter(([p]) => !done.has(p));
  const idle = () => new Promise<void>((r) => ('requestIdleCallback' in window
    ? (window as Window & { requestIdleCallback: (f: () => void) => void }).requestIdleCallback(() => r())
    : setTimeout(r, 120)));
  setTimeout(() => void fetchAll(rest, 2, undefined, idle), 2500);
}

/** Both champions and the table's sect; images are decoded so the first cut-in never stutters. */
export async function preloadMatch(champions: string[], sect: string) {
  const list = [...champions.flatMap(champFiles), ...sectFiles(sect)];
  await fetchAll(list, 6);
  await Promise.all(list
    .filter(([p]) => p.endsWith('cutout.webp') || p.includes('/flip/') || p.endsWith('cutin.webp'))
    .map(([p]) => {
      const img = new Image();
      img.src = url(p);
      return img.decode().catch(() => undefined);
    }));
}
