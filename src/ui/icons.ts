import { ballCss } from '../core/ball-styles';
import { svg } from './dom';

/**
 * Painted ink icons (public/art/ui/icons, ordered through the game-art skill). No hand-drawn SVG,
 * emoji or icon fonts: every glyph in the UI is one of these.
 */
const FILES = [
  'strike', 'place', 'pause', 'settings', 'back', 'rotate-left', 'rotate-right', 'switch-target', 'spin', 'power',
  'scroll', 'lock', 'coin', 'sound', 'music', 'fullscreen', 'edit', 'close', 'trophy', 'target', 'users', 'user',
  'check', 'play', 'home', 'replay', 'shop', 'install', 'star', 'star-empty', 'warning', 'info', 'journey',
  'quick-match', 'collection', 'story', 'codex', 'energy', 'ultimate', 'cooldown', 'hint', 'vision', 'nudge',
  'shield', 'tremor', 'rewind', 'thinking', 'turn',
] as const;

/** Older names used across the code base. */
const ALIAS = {
  pencil: 'edit', expand: 'fullscreen', gear: 'settings', rotL: 'rotate-left', rotR: 'rotate-right',
  refresh: 'replay', cart: 'shop', phone: 'install', hand: 'place', eagle: 'vision', spin2: 'spin',
} as const;

export type IconName = (typeof FILES)[number] | keyof typeof ALIAS;

const BASE = new URL(`${import.meta.env.BASE_URL}art/ui/icons/`, document.baseURI).href;

export function iconUrl(name: IconName): string {
  return `${BASE}${(ALIAS as Record<string, string>)[name] ?? name}.webp`;
}

export function icon(name: IconName, cls = ''): HTMLImageElement {
  const img = document.createElement('img');
  img.className = cls ? `ico ${cls}` : 'ico';
  img.src = iconUrl(name);
  img.alt = '';
  img.draggable = false;
  img.decoding = 'async';
  return img;
}

/** Painted pool ball for menus (solid / stripe with number). */
export function ballArt(id: number, size = 120): SVGElement {
  const col = ballCss('pool', id);
  const stripe = id > 8;
  const uid = `b${id}_${Math.random().toString(36).slice(2, 7)}`;
  return svg(`<svg viewBox="0 0 100 100" width="${size}" height="${size}">
    <defs>
      <radialGradient id="${uid}s" cx="0.36" cy="0.3" r="0.75"><stop offset="0" stop-color="#fff" stop-opacity="0.55"/><stop offset="0.35" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.55"/></radialGradient>
      <clipPath id="${uid}c"><circle cx="50" cy="50" r="46"/></clipPath>
    </defs>
    <ellipse cx="54" cy="94" rx="34" ry="6" fill="rgba(0,0,0,0.35)"/>
    <g clip-path="url(#${uid}c)">
      <rect width="100" height="100" fill="${stripe ? '#f4f1e6' : col}"/>
      ${stripe ? `<rect y="24" width="100" height="52" fill="${col}"/>` : ''}
      <circle cx="50" cy="50" r="20" fill="#f6f3e8"/>
      <text x="50" y="58" text-anchor="middle" font-family="Be Vietnam Pro, sans-serif" font-weight="600" font-size="${id > 9 ? 21 : 25}" fill="#111">${id}</text>
      <circle cx="50" cy="50" r="46" fill="url(#${uid}s)"/>
      <ellipse cx="34" cy="26" rx="12" ry="7" fill="#fff" opacity="0.55" transform="rotate(-30 34 26)"/>
    </g>
  </svg>`);
}

/** Cue stick art for menus. */
export function cueArt(colors: { shaft: number; wrap: number; butt: number; accent: number; ferrule: number }): SVGElement {
  const c = (n: number) => '#' + n.toString(16).padStart(6, '0');
  return svg(`<svg viewBox="0 0 300 20" preserveAspectRatio="none" style="width:100%;height:16px">
    <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.45"/><stop offset="0.45" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.4"/></linearGradient></defs>
    <path d="M2 8.6 L150 7 L150 13 L2 11.4 Z" fill="${c(colors.shaft)}"/>
    <rect x="0" y="8.4" width="3" height="3.2" fill="#3d6fa8"/>
    <rect x="3" y="8.3" width="6" height="3.4" fill="${c(colors.ferrule)}"/>
    <path d="M150 7 L154 6.9 L154 13.1 L150 13 Z" fill="${c(colors.accent)}"/>
    <path d="M154 6.9 L198 6 L198 14 L154 13.1 Z" fill="${c(colors.butt)}"/>
    <path d="M160 10 L198 6.3 L198 8.6 Z M160 10 L198 13.7 L198 11.4 Z" fill="${c(colors.accent)}" opacity="0.85"/>
    <path d="M198 6 L256 5 L256 15 L198 14 Z" fill="${c(colors.wrap)}"/>
    <path d="M256 5 L296 4.4 L296 15.6 L256 15 Z" fill="${c(colors.butt)}"/>
    <rect x="256" y="5" width="2" height="10" fill="${c(colors.accent)}"/>
    <rect x="296" y="4.4" width="4" height="11.2" rx="1" fill="#111"/>
    <path d="M2 8.6 L296 4.4 L296 15.6 L2 11.4 Z" fill="url(#g)"/>
  </svg>`);
}
