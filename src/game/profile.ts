import { CUES, TABLES, type SkillId } from './content/gear';

export interface Settings {
  sfx: number;
  music: number;
  haptics: boolean;
  leftHanded: boolean;
  /** Aim guide length helper on top of the cue's aim stat. */
  longGuide: boolean;
}

export interface Profile {
  v: 1;
  name: string;
  /** Portrait id (see ui/avatar.ts). */
  avatar: string;
  /** The player has chosen a name and portrait (first-run prompt done). */
  named: boolean;
  xp: number;
  coins: number;
  cues: string[];
  tables: string[];
  cue: string;
  table: string;
  skills: SkillId[];
  settings: Settings;
  /** NPC ids beaten, with best stars (1–3). */
  career: Record<string, number>;
  /** Challenge ids with best stars. */
  challenges: Record<string, number>;
  stats: { played: number; won: number; pots: number; bestRun: number };
  tutorialSeen: boolean;
}

const KEY = 'thancong.profile.v1';

export function defaultProfile(): Profile {
  return {
    v: 1,
    name: 'Cơ Thủ',
    avatar: 'nobita',
    named: false,
    xp: 0,
    coins: 300,
    cues: ['house'],
    tables: ['classic'],
    cue: 'house',
    table: 'classic',
    skills: ['eagle', 'spin2'],
    settings: { sfx: 0.9, music: 0.3, haptics: true, leftHanded: false, longGuide: false },
    career: {},
    challenges: {},
    stats: { played: 0, won: 0, pots: 0, bestRun: 0 },
    tutorialSeen: false,
  };
}

function sanitize(p: Partial<Profile>): Profile {
  const d = defaultProfile();
  const out: Profile = { ...d, ...p, settings: { ...d.settings, ...(p.settings ?? {}) }, stats: { ...d.stats, ...(p.stats ?? {}) } };
  out.cues = (out.cues ?? []).filter((id) => CUES.some((c) => c.id === id));
  if (!out.cues.includes('house')) out.cues.unshift('house');
  out.tables = (out.tables ?? []).filter((id) => TABLES.some((t) => t.id === id));
  if (!out.tables.includes('classic')) out.tables.unshift('classic');
  if (!out.cues.includes(out.cue)) out.cue = 'house';
  if (!out.tables.includes(out.table)) out.table = 'classic';
  out.skills = (out.skills ?? []).slice(0, 2);
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
