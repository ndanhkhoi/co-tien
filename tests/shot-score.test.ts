import { describe, expect, it } from 'vitest';
import { makeBall, type PhysEvent } from '../src/core/physics';
import { scoreShot, type ScoreInput } from '../src/core/shot-score';
import { makeCaromTable, makePoolTable } from '../src/core/table';

const pool = makePoolTable();
const R = pool.R;

/** Cue at the origin of a straight or cut pot of ball 1 into the top-right corner. */
function pot(cutDeg: number, extra: PhysEvent[] = [], input: Partial<ScoreInput> = {}) {
  const pk = pool.pockets[2];
  const obj = { x: pk.x - 0.35, y: pk.y + 0.25 };
  const ux = (pk.x - obj.x) / Math.hypot(pk.x - obj.x, pk.y - obj.y);
  const uy = (pk.y - obj.y) / Math.hypot(pk.x - obj.x, pk.y - obj.y);
  // Ghost ball behind the object ball on the pocket line; the cue comes in at `cutDeg` to it.
  const gx = obj.x - ux * 2 * R;
  const gy = obj.y - uy * 2 * R;
  const a = (cutDeg * Math.PI) / 180;
  const dx = ux * Math.cos(a) - uy * Math.sin(a);
  const dy = ux * Math.sin(a) + uy * Math.cos(a);
  const cue = { x: gx - dx * 0.6, y: gy - dy * 0.6 };
  const events: PhysEvent[] = [
    ...extra,
    { t: 'ball', a: 0, b: 1, speed: 2, x: gx + ux * R, y: gy + uy * R },
    { t: 'pocket', id: 1, pocket: 2, speed: 1 },
  ];
  return scoreShot({
    table: pool, before: [makeBall(0, cue.x, cue.y), makeBall(1, obj.x, obj.y)], events, cueId: 0,
    counted: [1], points: 0, isBreak: false, elevation: 0, ...input,
  });
}

describe('shot score', () => {
  it('pays a plain ball 1 and a thin cut more', () => {
    const plain = pot(0);
    expect(plain.value).toBeCloseTo(1);
    expect(plain.tier).toBe(0);
    const thin = pot(58);
    expect(thin.names).toContain('Cắt mỏng');
    expect(thin.value).toBeGreaterThan(1.7);
    expect(thin.tier).toBe(1);
  });

  it('names banks, kicks and combinations', () => {
    expect(pot(0, [{ t: 'cushion', id: 0, speed: 1, x: 0, y: 0 }]).names).toContain('Gỡ băng');
    const bank = scoreShot({
      table: pool, before: [makeBall(0, -0.5, 0), makeBall(1, 0, 0)], cueId: 0, counted: [1], points: 0, isBreak: false, elevation: 0,
      events: [{ t: 'ball', a: 0, b: 1, speed: 2, x: -R, y: 0 }, { t: 'cushion', id: 1, speed: 1, x: 0, y: 0 }, { t: 'pocket', id: 1, pocket: 0, speed: 1 }],
    });
    expect(bank.names).toContain('Bi băng');
    const combo = scoreShot({
      table: pool, before: [makeBall(0, -0.5, 0), makeBall(1, 0, 0), makeBall(2, 0.2, 0)], cueId: 0, counted: [2], points: 0, isBreak: false, elevation: 0,
      events: [{ t: 'ball', a: 0, b: 1, speed: 2, x: -R, y: 0 }, { t: 'ball', a: 1, b: 2, speed: 1, x: 0.2 - R, y: 0 }, { t: 'pocket', id: 2, pocket: 5, speed: 1 }],
    });
    expect(combo.names).toContain('Bi kết');
    expect(combo.tier).toBe(1);
  });

  it('counts a jump only over a ball in the way', () => {
    const high = { elevation: (30 * Math.PI) / 180 };
    expect(pot(0, [], high).names).not.toContain('Nhảy bi');
    const pk = pool.pockets[2];
    const obj = { x: pk.x - 0.35, y: pk.y + 0.25 };
    const cue = { x: obj.x - 0.6, y: obj.y + 0.1 };
    const mid = { x: (cue.x + obj.x) / 2, y: (cue.y + obj.y) / 2 };
    const jump = scoreShot({
      table: pool, cueId: 0, counted: [1], points: 0, isBreak: false, ...high,
      before: [makeBall(0, cue.x, cue.y), makeBall(1, obj.x, obj.y), makeBall(2, mid.x, mid.y)],
      events: [{ t: 'ball', a: 0, b: 1, speed: 2, x: obj.x - 0.02, y: obj.y }, { t: 'pocket', id: 1, pocket: 2, speed: 1 }],
    });
    expect(jump.names).toContain('Nhảy bi');
  });

  it('gives nothing extra on the break or without a score', () => {
    expect(pot(60, [], { isBreak: true }).value).toBe(1);
    expect(pot(60, [], { counted: [] }).value).toBe(0);
  });

  it('rewards three-cushion caroms', () => {
    const carom = makeCaromTable();
    const rail = (n: number): PhysEvent[] => Array.from({ length: n }, () => ({ t: 'cushion', id: 0, speed: 1, x: 0, y: 0 }));
    const events = (n: number): PhysEvent[] => [{ t: 'ball', a: 0, b: 1, speed: 1, x: 0, y: 0 }, ...rail(n), { t: 'ball', a: 0, b: 2, speed: 1, x: 0, y: 0 }];
    const base = { table: carom, before: [makeBall(0, 0, 0)], cueId: 0, counted: [], points: 1, isBreak: false, elevation: 0 };
    expect(scoreShot({ ...base, events: events(0) }).value).toBe(1);
    const three = scoreShot({ ...base, events: events(3) });
    expect(three.names).toContain('Ba băng');
    expect(three.value).toBeGreaterThan(1.5);
  });
});
