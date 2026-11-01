import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import roster from '../src/game/content/roster.json';

type Entry = [path: string, size: number, revision: string];

function walkArt(dir = 'public/art'): Entry[] {
  return readdirSync(dir).sort().flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return walkArt(path);
    if (!name.endsWith('.webp')) return [];
    const revision = createHash('sha1').update(readFileSync(path)).digest('hex').slice(0, 10);
    return [[relative('public', path), statSync(path).size, revision] as Entry];
  });
}

const ART = walkArt();
type Champion = { id: string; gallery?: unknown[] };

const ON_DEMAND = /^art\/champions\/[^/]+\/pose-\d+\.webp$/;
const championFiles = (art: Entry[], id: string) => art.filter(([path]) => path.startsWith(`art/champions/${id}/`));

function demandAware(art: Entry[]): string[] {
  return art.map(([path]) => path).filter((path) => !ON_DEMAND.test(path));
}

function coreList(art: Entry[], champion: string, sect: string): string[] {
  const paths = art.map(([path]) => path);
  const set = new Set(paths.filter((path) => path.startsWith('art/ui/') || path.startsWith('art/table/') ||
    path.startsWith('art/skills/') || path.endsWith('/portrait.webp') || path.endsWith('/emblem.webp')));
  for (const path of championFiles(art, champion).map(([path]) => path)) set.add(path);
  for (const path of paths.filter((path) => path.startsWith(`art/sects/${sect}/`))) set.add(path);
  return [...set].filter((path) => !ON_DEMAND.test(path));
}

function manifestHasOnDemand(entries: Entry[]): boolean {
  return entries.some(([path]) => ON_DEMAND.test(path));
}

describe('on-demand art loading', () => {
  it('keeps gallery poses out of first, core and background downloads', () => {
    const cases = [['whole', demandAware(ART)], ['core', coreList(ART, 'ngancam', 'thienhuong')]] as const;
    for (const [name, paths] of cases) {
      expect(paths.some((path) => ON_DEMAND.test(path)), name).toBe(false);
    }
    expect(manifestHasOnDemand(ART)).toBe(true);
  });

  it('describes four possible gallery paintings for every champion', () => {
    const champions = roster.champions as Champion[];
    expect(champions).toHaveLength(65);
    expect(champions.reduce((sum, champion) => sum + (champion.gallery?.length ?? 0), 0)).toBe(260);
  });
});
