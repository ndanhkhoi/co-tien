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
