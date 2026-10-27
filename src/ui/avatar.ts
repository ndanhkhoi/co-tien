import { h } from './dom';

/** Character portraits shipped in public/avatars (see README for their origin). */
export const AVATARS: { id: string; name: string }[] = [
  { id: 'nobita', name: 'Nobita' },
  { id: 'doraemon', name: 'Doraemon' },
  { id: 'dorami', name: 'Dorami' },
  { id: 'shizuka', name: 'Shizuka' },
  { id: 'gian', name: 'Gian' },
  { id: 'suneo', name: 'Suneo' },
  { id: 'goku', name: 'Goku' },
  { id: 'gohan', name: 'Gohan' },
  { id: 'vegeta', name: 'Vegeta' },
  { id: 'trunks', name: 'Trunks' },
  { id: 'piccolo', name: 'Piccolo' },
  { id: 'krillin', name: 'Krillin' },
  { id: 'tien', name: 'Tenshinhan' },
  { id: 'yamcha', name: 'Yamcha' },
  { id: 'roshi', name: 'Kame-Sennin' },
  { id: 'bulma', name: 'Bulma' },
  { id: 'satan', name: 'Mr. Satan' },
  { id: 'buu', name: 'Majin Buu' },
  { id: 'cell', name: 'Cell' },
  { id: 'frieza', name: 'Frieza' },
  { id: 'beerus', name: 'Beerus' },
];

export const DEFAULT_PLAYER_AVATAR = 'nobita';
export const GUEST_AVATAR = 'trunks';
/** Quick-play AI opponents by level (Dễ, Vừa, Khó, Thần Công). */
export const AI_AVATARS = ['buu', 'cell', 'frieza', 'beerus'];
export const AI_NAMES = ['Majin Buu', 'Cell', 'Frieza', 'Beerus'];

export function avatar(id: string): HTMLElement {
  const known = AVATARS.some((a) => a.id === id) ? id : DEFAULT_PLAYER_AVATAR;
  return h('img.avatar-img', { src: `${import.meta.env.BASE_URL}avatars/${known}.webp`, alt: '', draggable: false, decoding: 'async' });
}
