import { describe, expect, it } from 'vitest';
import { Match } from '../src/game/match';
import { practiceLayout } from '../src/game/practice';
import { CUES, TABLES } from '../src/game/content/gear';

function practice(kind: 'pool' | 'carom') {
  const p = { name: 'A', kind: 'human' as const, cue: CUES[0], champion: 'tokiemnhi' };
  return new Match({
    mode: kind === 'pool' ? 'eight' : 'carom-libre', raceTo: 1, mutator: null, tableSkin: TABLES[0], classic: true,
    players: [p, { ...p, name: 'B' }], layout: practiceLayout(kind), practice: true,
  });
}

function roll(m: Match) {
  let t = 0;
  while (m.phase === 'rolling' && t++ < 2000) m.update(1 / 30);
}

describe('Luyện thế', () => {
  it('starts with the cue ball and one object ball, the rest of the set off the cloth', () => {
    const m = practice('pool');
    expect(m.balls).toHaveLength(16);
    expect(m.balls.filter((b) => b.onTable).map((b) => b.id)).toEqual([0, 1]);
    expect(m.placing).toBe('none');
    expect(practiceLayout('carom')).toHaveLength(3);
  });

  it('keeps arranged balls on the cloth, apart, and out of pocket mouths', () => {
    const m = practice('pool');
    const t = m.table;
    expect(m.arrangeBall(5, 0, 0)).toBe(true);
    // Dropped onto ball 5: snapped to the nearest free spot instead of overlapping.
    expect(m.arrangeBall(6, 0, 0)).toBe(true);
    const [b5, b6] = [5, 6].map((id) => m.balls.find((b) => b.id === id)!);
    expect(Math.hypot(b5.x - b6.x, b5.y - b6.y)).toBeGreaterThanOrEqual(2 * t.R - 1e-6);
    // Aimed straight at a corner pocket: moved clear of the mouth.
    const corner = t.pockets[0];
    expect(m.arrangeBall(7, corner.hx, corner.hy)).toBe(true);
    const b7 = m.balls.find((b) => b.id === 7)!;
    expect(Math.hypot(b7.x - corner.hx, b7.y - corner.hy)).toBeGreaterThan(corner.hr + t.R);
    expect(Math.abs(b7.x)).toBeLessThanOrEqual(t.L / 2 - t.R);
  });

  it('never removes the cue ball', () => {
    const m = practice('pool');
    m.removeBall(0);
    m.removeBall(1);
    expect(m.cueBall().onTable).toBe(true);
    expect(m.balls.find((b) => b.id === 1)!.onTable).toBe(false);
  });

  it('plays without rules or turns and returns a scratched cue ball in hand', () => {
    const m = practice('pool');
    const cue = m.cueBall();
    const corner = m.table.pockets[3];
    // Straight into a corner pocket with nothing in the way.
    m.removeBall(1);
    m.shoot({ angle: Math.atan2(corner.hy - cue.y, corner.hx - cue.x), power: 0.7, side: 0, vert: 0, call: null, pushOut: false });
    roll(m);
    expect(m.phase).toBe('aim');
    expect(m.turn).toBe(0);
    expect(m.cueBall().onTable).toBe(true);
    expect(m.placing).toBe('anywhere');
  });

  it('returns to the saved arrangement', () => {
    const m = practice('pool');
    m.arrangeBall(9, 0.3, 0.2);
    m.saveLayout();
    m.arrangeBall(9, -0.3, -0.2);
    m.retryLayout();
    const b9 = m.balls.find((b) => b.id === 9)!;
    expect(b9.x).toBeCloseTo(0.3, 3);
    expect(b9.y).toBeCloseTo(0.2, 3);
  });
});
