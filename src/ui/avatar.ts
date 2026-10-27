import type { AvatarLook } from '../game/content/career';
import { svg } from './dom';

/** Flat illustrated portrait built from a few parameters. */
export function avatar(look: AvatarLook): SVGElement {
  const { skin, hair, shirt, style } = look;
  const id = Math.random().toString(36).slice(2, 8);
  const hairBack = style === 1 ? `<path d="M22 44c0-22 12-32 28-32s28 10 28 32v34H22z" fill="${hair}"/>` : '';
  const hairTop = [
    `<path d="M29 40c0-15 9-24 21-24s21 9 21 24c-4-7-11-11-21-11s-17 4-21 11z" fill="${hair}"/>`,
    `<path d="M28 42c0-16 9-26 22-26s22 10 22 26c-5-9-12-13-22-13s-17 4-22 13z" fill="${hair}"/>`,
    `<path d="M31 36c3-7 10-11 19-11s16 4 19 11c-5-3-11-4-19-4s-14 1-19 4z" fill="${hair}" opacity="0.5"/>`,
    `<path d="M24 36c2-13 12-20 26-20s24 7 26 20H24z" fill="${shirt}"/><path d="M22 36h40c6 0 10 2 12 4H22z" fill="${shirt}" style="filter:brightness(0.75)"/>`,
    `<circle cx="50" cy="15" r="8" fill="${hair}"/><path d="M29 40c0-15 9-24 21-24s21 9 21 24c-4-7-11-11-21-11s-17 4-21 11z" fill="${hair}"/>`,
    `<path d="M28 40l4-16 6 6 4-12 6 9 5-11 4 11 6-7 3 13 4-3c-2 5-4 8-6 10-5-7-11-10-20-10s-15 3-20 10z" fill="${hair}"/>`,
  ][style] ?? '';
  const glasses = look.glasses
    ? `<g fill="rgba(180,220,255,0.25)" stroke="#111" stroke-width="2"><rect x="34" y="44" width="12" height="9" rx="3"/><rect x="54" y="44" width="12" height="9" rx="3"/><path d="M46 48h8"/></g>`
    : '';
  const beard = look.beard ? `<path d="M36 58c2 10 8 14 14 14s12-4 14-14c-4 4-9 5-14 5s-10-1-14-5z" fill="${hair}" opacity="0.9"/>` : '';
  return svg(`<svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" style="width:100%;height:100%;display:block">
    <defs><radialGradient id="bg${id}" cx="0.5" cy="0.35" r="0.8"><stop offset="0" stop-color="#2c4a3c"/><stop offset="1" stop-color="#0d1a14"/></radialGradient></defs>
    <rect width="100" height="100" fill="url(#bg${id})"/>
    ${hairBack}
    <path d="M16 100c2-18 15-28 34-28s32 10 34 28z" fill="${shirt}"/>
    <path d="M42 72h16v8a8 8 0 01-16 0z" fill="${skin}" style="filter:brightness(0.9)"/>
    <ellipse cx="50" cy="48" rx="20" ry="23" fill="${skin}"/>
    <ellipse cx="30" cy="50" rx="3.5" ry="5" fill="${skin}"/><ellipse cx="70" cy="50" rx="3.5" ry="5" fill="${skin}"/>
    <circle cx="42" cy="49" r="2.2" fill="#1a1a1a"/><circle cx="58" cy="49" r="2.2" fill="#1a1a1a"/>
    <path d="M38 43.5q4-2.5 8 0M54 43.5q4-2.5 8 0" stroke="${hair}" stroke-width="2.2" fill="none" stroke-linecap="round"/>
    <path d="M45 61q5 3.5 10 0" stroke="#7a3a2a" stroke-width="2" fill="none" stroke-linecap="round"/>
    ${beard}${glasses}${hairTop}
  </svg>`);
}

export const PLAYER_LOOK: AvatarLook = { skin: '#e6b48c', hair: '#151515', shirt: '#1f7a4a', style: 0 };
export const GUEST_LOOK: AvatarLook = { skin: '#d9a57f', hair: '#3a2416', shirt: '#b8442e', style: 1 };
export const AI_LOOKS: AvatarLook[] = [
  { skin: '#e9b98f', hair: '#222', shirt: '#3a6ea5', style: 0 },
  { skin: '#c98f62', hair: '#444', shirt: '#7a3b8f', style: 3 },
  { skin: '#f1c7a5', hair: '#3b2416', shirt: '#2fa37a', style: 1 },
  { skin: '#d4a073', hair: '#fafafa', shirt: '#1b1b1b', style: 2, beard: true },
];
