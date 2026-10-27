import type { TableKind } from './table';

/**
 * Aramith traditional set colours (WPA names: yellow, blue, red, purple, orange, green,
 * maroon, black). Stripes 9–15 repeat 1–7 as a centred band on white.
 */
const POOL_COLORS: Record<number, number> = {
  0: 0xf6f3e8,
  1: 0xf4c20d,
  2: 0x1c3f99,
  3: 0xcc2131,
  4: 0x4c2275,
  5: 0xec6d1b,
  6: 0x14653a,
  7: 0x74202f,
  8: 0x131313,
};

export interface BallStyle {
  color: number;
  stripe: boolean;
  /** Number printed in the two opposite white circles (0 = none). */
  number: number;
  /** Pool cue ball uses the TV-style red measle dots, which also make spin visible. */
  dots: boolean;
}

export function ballStyle(kind: TableKind, id: number): BallStyle {
  if (kind === 'carom') {
    // 0 white, 1 yellow, 2 red.
    const color = id === 0 ? 0xf6f3e8 : id === 1 ? 0xf2c40f : 0xc81e2c;
    return { color, stripe: false, number: 0, dots: false };
  }
  if (id === 0) return { color: POOL_COLORS[0], stripe: false, number: 0, dots: true };
  const base = id > 8 ? id - 8 : id;
  return { color: POOL_COLORS[base], stripe: id > 8, number: id, dots: false };
}

export function ballCss(kind: TableKind, id: number): string {
  return '#' + ballStyle(kind, id).color.toString(16).padStart(6, '0');
}
