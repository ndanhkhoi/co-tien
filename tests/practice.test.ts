import { beforeEach, describe, expect, it } from 'vitest';
import { Match } from '../src/game/match';
import {
  canRest, deleteSaved, loadSaved, practiceBalls, practiceGeom, PRACTICE_DRILLS, sanitizeSaved, saveLayout, SAVED_MAX, spotsOf,
  type PracticeTable,
} from '../src/game/practice';
import { CUES, TABLES } from '../src/game/content/gear';

function practice(kind: PracticeTable, drill = PRACTICE_DRILLS.find((d) => d.table === kind)!) {
  const p = { name: 'A', kind: 'human' as const, cue: CUES[0], champion: 'tokiemnhi' };
  return new Match({
    mode: kind === 'pool' ? 'eight' : 'carom-libre', raceTo: 1, mutator: null, tableSkin: TABLES[0], classic: true,
    players: [p, { ...p, name: 'B' }], layout: practiceBalls(kind, drill.spots), practice: true,
  });
}

function roll(m: Match) {
  let t = 0;
  while (m.phase === 'rolling' && t++ < 3000) m.update(1 / 30);
}

const at = (m: Match, id: number) => m.balls.find((b) => b.id === id)!;

describe('Luyện thế drills', () => {
  it('every drill is a legal resting position with the cue ball on the cloth', () => {
    for (const d of PRACTICE_DRILLS) {
      const t = practiceGeom(d.table);
      expect(d.spots.some((s) => s.id === 0), d.id).toBe(true);
      expect(new Set(d.spots.map((s) => s.id)).size, d.id).toBe(d.spots.length);
      for (const s of d.spots) expect(canRest(t, d.spots, s.id, s.x, s.y), `${d.id} ball ${s.id}`).toBe(true);
    }
  });

  it('keeps the full set: balls off the drill wait in the tray', () => {
    const m = practice('pool');
    expect(m.balls).toHaveLength(16);
    expect(m.balls.filter((b) => b.onTable).map((b) => b.id)).toEqual([0, 1]);
    expect(practice('carom').balls).toHaveLength(3);
  });
});

describe('Luyện thế table', () => {
  it('places balls apart and out of pocket mouths', () => {
    const m = practice('pool');
    const t = m.table;
    expect(m.placeBall(5, 0, 0)).toBe(true);
    expect(m.placeBall(6, 0, 0)).toBe(true);
    expect(Math.hypot(at(m, 5).x - at(m, 6).x, at(m, 5).y - at(m, 6).y)).toBeGreaterThanOrEqual(2 * t.R - 1e-6);
    const corner = t.pockets[0];
    expect(m.placeBall(7, corner.hx, corner.hy)).toBe(true);
    expect(Math.hypot(at(m, 7).x - corner.hx, at(m, 7).y - corner.hy)).toBeGreaterThan(corner.hr + t.R);
  });

  it('lifts object balls back to the tray but never the cue ball', () => {
    const m = practice('pool');
    expect(m.liftBall(0)).toBe(false);
    expect(m.liftBall(1)).toBe(true);
    expect(m.cueBall().onTable).toBe(true);
    expect(at(m, 1).onTable).toBe(false);
  });

  it('shoots without rules or turns and hands back a scratched cue ball', () => {
    const m = practice('pool');
    m.liftBall(1);
    const cue = m.cueBall();
    const corner = m.table.pockets[3];
    m.shoot({ angle: Math.atan2(corner.hy - cue.y, corner.hx - cue.x), power: 0.7, side: 0, vert: 0, call: null, pushOut: false });
    roll(m);
    expect(m.phase).toBe('aim');
    expect(m.turn).toBe(0);
    expect(m.cueBall().onTable).toBe(true);
    expect(m.placing).toBe('anywhere');
  });

  it('takes the last shot back exactly', () => {
    const m = practice('pool', PRACTICE_DRILLS.find((d) => d.id === 'p-straight')!);
    const before = spotsOf(m.balls);
    const cue = m.cueBall();
    const ball = at(m, 1);
    m.shoot({ angle: Math.atan2(ball.y - cue.y, ball.x - cue.x), power: 0.6, side: 0, vert: 0, call: null, pushOut: false });
    roll(m);
    expect(spotsOf(m.balls)).not.toEqual(before);
    expect(m.canUndo).toBe(true);
    expect(m.undoShot()).toBe(true);
    expect(spotsOf(m.balls)).toEqual(before);
    expect(m.potted[0]).toEqual([]);
    expect(m.canUndo).toBe(false);
  });

  it('returns to the marked position', () => {
    const m = practice('pool');
    m.placeBall(9, 0.3, 0.2);
    m.markPosition();
    m.placeBall(9, -0.3, -0.2);
    m.retryLayout();
    expect(at(m, 9).x).toBeCloseTo(0.3, 3);
    expect(at(m, 9).y).toBeCloseTo(0.2, 3);
  });

  it('switches to a whole new position', () => {
    const m = practice('pool');
    const brk = PRACTICE_DRILLS.find((d) => d.id === 'p-break')!;
    m.setPosition(practiceBalls('pool', brk.spots));
    expect(m.balls.filter((b) => b.onTable)).toHaveLength(16);
    expect(m.canUndo).toBe(false);
  });
});

describe('Thế của tôi', () => {
  const store = new Map<string, string>();
  beforeEach(() => {
    store.clear();
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    };
  });

  it('saves, names and deletes positions, newest first', () => {
    const a = saveLayout('pool', [{ id: 0, x: 0, y: 0 }]);
    const b = saveLayout('carom', [{ id: 0, x: 0.1, y: 0 }, { id: 2, x: 0.5, y: 0 }]);
    expect(a?.name).toBe('Thế 1');
    expect(b?.name).toBe('Thế 2');
    expect(loadSaved().map((s) => s.name)).toEqual(['Thế 2', 'Thế 1']);
    deleteSaved(a!.id);
    expect(loadSaved().map((s) => s.name)).toEqual(['Thế 2']);
    for (let i = 0; i < SAVED_MAX + 3; i++) saveLayout('pool', [{ id: 0, x: 0, y: 0 }]);
    expect(loadSaved()).toHaveLength(SAVED_MAX);
  });

  it('drops malformed entries instead of failing', () => {
    store.set('cotien.practice.v1', '{not json');
    expect(loadSaved()).toEqual([]);
    expect(sanitizeSaved({ saved: [
      { table: 'snooker', spots: [{ id: 0, x: 0, y: 0 }] },
      { table: 'pool', spots: [{ id: 3, x: 0, y: 0 }] },
      { table: 'pool', name: 'ok', spots: [{ id: 0, x: 0, y: 0 }, { id: 0, x: 1, y: 0 }, { id: 99, x: 0, y: 0 }, { id: 4, x: Infinity, y: 0 }, { id: 5, x: 9, y: 0 }] },
    ] })).toEqual([{ id: 's0', table: 'pool', name: 'ok', spots: [{ id: 0, x: 0, y: 0 }], at: 0 }]);
  });
});
