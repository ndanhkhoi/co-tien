import { describe, expect, it } from 'vitest';
import { maxSpeed, powerToSpeed } from '../src/core/cue-power';
import { DEFAULT_PHYS, simulate, strike } from '../src/core/physics';
import { summarize } from '../src/core/rules/types';
import { makeCaromTable, makePoolTable } from '../src/core/table';
import { challengeBalls, CHALLENGES, judgeChallenge, REFERENCE_POWER } from '../src/game/content/challenges';

describe('challenges', () => {
  it('ships 60 challenges, 12 per family, with unique ids', () => {
    expect(CHALLENGES).toHaveLength(60);
    const ids = new Set(CHALLENGES.map((c) => c.id));
    expect(ids.size).toBe(60);
    for (const f of ['straight', 'cut', 'bank', 'position', 'carom']) {
      expect(CHALLENGES.filter((c) => c.family === f)).toHaveLength(12);
    }
  });

  it('every recorded solution still solves its challenge with the current physics', () => {
    const pool = makePoolTable();
    const carom = makeCaromTable();
    const failed: string[] = [];
    for (const c of CHALLENGES) {
      const t = c.table === 'pool' ? pool : carom;
      const balls = challengeBalls(c);
      const [angle, power, side, vert] = c.solution;
      strike(balls.find((b) => b.id === 0)!, t.R, { angle, speed: powerToSpeed(power, maxSpeed(t.kind, REFERENCE_POWER)), side, vert });
      const ev = simulate({ table: t, balls, params: DEFAULT_PHYS });
      const sum = summarize({ events: ev, cueId: 0, isBreak: false, call: null, pushOut: false, targets: [] });
      if (!judgeChallenge(c, sum, balls).ok) failed.push(c.id);
    }
    expect(failed).toEqual([]);
  });
});
