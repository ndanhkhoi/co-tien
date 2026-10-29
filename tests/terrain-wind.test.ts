import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rng';
import { makePoolTable } from '../src/core/table';
import { forceStrength, MAX_FORCE, rollOmen } from '../src/game/terrain';

describe('wind', () => {
  it('keeps one direction for the whole turn and varies in strength', () => {
    const t = makePoolTable();
    const seen = new Set<string>();
    for (let seed = 1; seed < 60; seed++) {
      const o = rollOmen('thienquang', new Rng(seed), t, [])!;
      const { force, gust } = o.terrain!;
      expect(Math.hypot(force!.x, force!.y)).toBeLessThanOrEqual(MAX_FORCE);
      // The gust factor 1 - amp + amp·sin(ωt) must never go negative (a reversed wind).
      expect(1 - 2 * gust!.amp).toBeGreaterThanOrEqual(0);
      seen.add(forceStrength(force!));
    }
    expect(seen.size).toBe(3);
  });
});
