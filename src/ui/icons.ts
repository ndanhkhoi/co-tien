import { ballCss } from '../core/ball-styles';
import type { SkillId } from '../game/content/gear';
import { svg } from './dom';

const S = (body: string, vb = '0 0 24 24') =>
  `<svg viewBox="${vb}" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

const ICONS = {
  pencil: S('<path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M14 6l4 4"/>'),
  expand: S('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'),
  pause: S('<rect x="6" y="5" width="4" height="14" rx="1.2" fill="currentColor" stroke="none"/><rect x="14" y="5" width="4" height="14" rx="1.2" fill="currentColor" stroke="none"/>'),
  back: S('<path d="M15 5l-7 7 7 7"/>'),
  close: S('<path d="M6 6l12 12M18 6L6 18"/>'),
  coin: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#f5c542"/><circle cx="12" cy="12" r="7.2" fill="none" stroke="#a8730c" stroke-width="1.6"/><path d="M12 7.5v9M9.5 9.5h4a1.6 1.6 0 010 3.2h-3a1.6 1.6 0 000 3.2h4" stroke="#7a4f06" stroke-width="1.7" fill="none" stroke-linecap="round"/></svg>`,
  gear: S('<circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.6 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.6-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/>'),
  trophy: S('<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 01-10 0V4z"/><path d="M17 5h3v2a3 3 0 01-3 3M7 5H4v2a3 3 0 003 3"/>'),
  target: S('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/>'),
  users: S('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0113 0"/><circle cx="17" cy="9" r="2.8"/><path d="M15.5 14.2A5.5 5.5 0 0121.5 20"/>'),
  user: S('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0116 0"/>'),
  rotL: S('<path d="M4 12a8 8 0 108-8H8"/><path d="M11 1L8 4l3 3"/>'),
  rotR: S('<path d="M20 12a8 8 0 11-8-8h4"/><path d="M13 1l3 3-3 3"/>'),
  check: S('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
  lock: S('<rect x="5" y="11" width="14" height="10" rx="2.2"/><path d="M8 11V8a4 4 0 018 0v3"/>'),
  play: `<svg viewBox="0 0 24 24"><path d="M8 5.5v13l11-6.5z" fill="currentColor"/></svg>`,
  home: S('<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/>'),
  refresh: S('<path d="M20 11a8 8 0 10-2.3 6.3"/><path d="M20 4v7h-7"/>'),
  sound: S('<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 010 7M19 6a8.5 8.5 0 010 12"/>'),
  cart: S('<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.6 12.2a2 2 0 002 1.6h8.6a2 2 0 002-1.6L21.5 7H6"/>'),
  phone: S('<rect x="7" y="2" width="10" height="20" rx="2.5"/><path d="M11 18h2"/>'),
  hand: S('<path d="M8 13V5.5a1.5 1.5 0 013 0V11m0-1.5V4a1.5 1.5 0 013 0v7m0-5.5a1.5 1.5 0 013 0V13m0-4a1.5 1.5 0 013 0v5.5a7 7 0 01-7 7h-1a7 7 0 01-5.6-2.8L4 14.6a1.6 1.6 0 012.4-2.1L8 14"/>'),
  eagle: S('<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
  spin2: S('<path d="M12 3a9 9 0 109 9"/><path d="M12 7a5 5 0 105 5"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><path d="M19 2v4h4"/>'),
  nudge: S('<path d="M3 8h11a3 3 0 10-3-3M3 12h15a3 3 0 11-3 3M3 16h8"/>'),
  shield: S('<path d="M12 2.5l8 3v6c0 5-3.5 8.7-8 10-4.5-1.3-8-5-8-10v-6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>'),
  tremor: S('<path d="M2 12h3l2-5 3 10 3-12 3 14 2-7h4"/>'),
  rewind: S('<path d="M11 19L3 12l8-7v14zM21 19l-8-7 8-7v14z"/>'),
  star: `<svg viewBox="0 0 24 24"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6L2.5 9.4l6.6-.8z" fill="currentColor"/></svg>`,
};

export type IconName = keyof typeof ICONS;

export function icon(name: IconName, cls = ''): SVGElement {
  return svg(ICONS[name], cls);
}

export function skillIcon(id: SkillId): SVGElement {
  return icon(id);
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
      <text x="50" y="58" text-anchor="middle" font-family="Barlow Condensed, sans-serif" font-weight="800" font-size="${id > 9 ? 21 : 25}" fill="#111">${id}</text>
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
