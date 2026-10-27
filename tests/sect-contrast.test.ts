import { describe, expect, it } from 'vitest';
import { ballStyle } from '../src/core/ball-styles';
import { SECT_TABLES } from '../src/game/content/sects';

/** CIE76 ΔE between two sRGB colours. */
function deltaE(a: number, b: number): number {
  const lab = (c: number) => {
    const lin = (u: number) => (u <= 0.04045 ? u / 12.92 : ((u + 0.055) / 1.055) ** 2.4);
    const [r, g, bl] = [(c >> 16) & 255, (c >> 8) & 255, c & 255].map((v) => lin(v / 255));
    const x = (0.4124 * r + 0.3576 * g + 0.1805 * bl) / 0.95047;
    const y = 0.2126 * r + 0.7152 * g + 0.0722 * bl;
    const z = (0.0193 * r + 0.1192 * g + 0.9505 * bl) / 1.08883;
    const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
    return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
  };
  const [l1, a1, b1] = lab(a);
  const [l2, a2, b2] = lab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}

describe('sect tables', () => {
  it('keep every pool ball readable on the felt (ΔE ≥ 25)', () => {
    for (const t of SECT_TABLES) {
      for (let id = 0; id <= 8; id++) {
        const d = deltaE(t.cloth, ballStyle('pool', id).color);
        expect(d, `${t.id} vs ball ${id}`).toBeGreaterThanOrEqual(25);
      }
    }
  });
});
