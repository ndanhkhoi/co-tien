import { CUES, TABLES } from './content/gear';
import { CHAMPIONS } from './content/sects';

export interface Settings {
  sfx: number;
  music: number;
  haptics: boolean;
  leftHanded: boolean;
  /** Announcements over the table after shots and turns; fouls and rack wins always show. */
  herald: boolean;
}

export interface Profile {
  v: 1;
  name: string;
  /** Champion the player plays as: portrait, class passive and skills. */
  champion: string;
  /** Unlocked champions (all tier-1 champions are free). */
  champions: string[];
  /** The player has chosen a name and champion (first-run prompt done). */
  named: boolean;
  xp: number;
  coins: number;
  cues: string[];
  tables: string[];
  cue: string;
  table: string;
  settings: Settings;
  /** NPC ids beaten, with best stars (1–3). */
  career: Record<string, number>;
  /** Challenge ids with best stars. */
  challenges: Record<string, number>;
  stats: { played: number; won: number; pots: number; bestRun: number };
  tutorialSeen: boolean;
  /** Coach-mark hints already shown (ui/hints.ts). */
  hints: string[];
  /** First-run world introduction done. */
  introSeen: boolean;
  /** Story chapters read: chapter id → furthest page index. */
  storyRead: Record<string, number>;
  /** Champions met as an opponent (unlocks their Cơ Tiên Lục page). */
  met: string[];
}

// Storage key from the game's first name; kept so existing saves still load after the rename.
const KEY = 'thancong.profile.v1';

const FREE_CHAMPIONS = CHAMPIONS.filter((c) => c.tier === 1).map((c) => c.id);

export function defaultProfile(): Profile {
  return {
    v: 1,
    name: 'Cơ Thủ',
    champion: 'tokiemnhi',
    champions: FREE_CHAMPIONS,
    named: false,
    xp: 0,
    coins: 300,
    cues: ['house'],
    tables: ['thienquang'],
    cue: 'house',
    table: 'thienquang',
    settings: { sfx: 0.9, music: 0.3, haptics: true, leftHanded: false, herald: true },
    career: {},
    challenges: {},
    stats: { played: 0, won: 0, pots: 0, bestRun: 0 },
    tutorialSeen: false,
    hints: [],
    introSeen: false,
    met: [],
    storyRead: {},
  };
}

function sanitize(p: Partial<Profile>): Profile {
  const d = defaultProfile();
  const out: Profile = { ...d, ...p, settings: { ...d.settings, ...(p.settings ?? {}) }, stats: { ...d.stats, ...(p.stats ?? {}) } };
  out.cues = (out.cues ?? []).filter((id) => CUES.some((c) => c.id === id));
  if (!out.cues.includes('house')) out.cues.unshift('house');
  out.tables = (out.tables ?? []).filter((id) => TABLES.some((t) => t.id === id));
  if (!out.tables.includes('thienquang')) out.tables.unshift('thienquang');
  if (!out.cues.includes(out.cue)) out.cue = 'house';
  if (!out.tables.includes(out.table)) out.table = 'thienquang';
  out.champions = [...new Set([...FREE_CHAMPIONS, ...(out.champions ?? []).filter((id) => CHAMPIONS.some((c) => c.id === id))])];
  if (!out.champions.includes(out.champion)) out.champion = 'tokiemnhi';
  out.settings.herald = out.settings.herald !== false;
  out.hints = Array.isArray(out.hints) ? out.hints : [];
  out.met = Array.isArray(out.met) ? out.met : [];
  out.storyRead = out.storyRead && typeof out.storyRead === 'object' ? out.storyRead : {};
  // Fields from older saves.
  delete (out as Partial<Profile> & { avatar?: string; skills?: unknown }).avatar;
  delete (out as Partial<Profile> & { avatar?: string; skills?: unknown }).skills;
  return out;
}

export function loadProfile(): Profile {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return sanitize(JSON.parse(raw));
  } catch {
    // Private mode / corrupted save: start fresh.
  }
  return defaultProfile();
}

export function saveProfile(p: Profile) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // Storage full or blocked; the game keeps running with in-memory progress.
  }
}

/** Shareable save code (base64 of the JSON, prefixed for sanity checks). */
export function exportCode(p: Profile): string {
  const json = JSON.stringify(p);
  return 'TC1.' + btoa(unescape(encodeURIComponent(json)));
}

export function importCode(code: string): Profile | null {
  const c = code.trim();
  if (!c.startsWith('TC1.')) return null;
  try {
    return sanitize(JSON.parse(decodeURIComponent(escape(atob(c.slice(4))))));
  } catch {
    return null;
  }
}

/** Level n needs 120·(n−1)² XP. */
export function levelOf(xp: number): number {
  return Math.floor(1 + Math.sqrt(xp / 120));
}

export function levelProgress(xp: number): { level: number; into: number; need: number } {
  const level = levelOf(xp);
  const base = 120 * (level - 1) ** 2;
  const next = 120 * level ** 2;
  return { level, into: xp - base, need: next - base };
}
