import { expect, it } from 'vitest';
import { cloneBalls, DEFAULT_PHYS, makeBall, step, type SimWorld } from '../src/core/physics';
import { makeCaromTable } from '../src/core/table';
import { buildCast, mergeTerrain, PLACED_KINDS } from '../src/game/skill-cast';
import { Match } from '../src/game/match';
import { CUES, TABLES } from '../src/game/content/gear';

const table = makeCaromTable();
function world(kind?: typeof PLACED_KINDS[number]): SimWorld {
  const balls = [makeBall(0, -0.3, 0)];
  const effect = kind && buildCast(kind, 3, 0, table, balls, 0, { point: { x: 0, y: 0.06 }, direction: { x: 0, y: 1 }, hardness: 'hard' });
  return { table, balls, params: DEFAULT_PHYS, terrain: effect ? mergeTerrain(effect.terrain) : null, extraSegments: effect ? effect.segments : [] };
}
it.each(PLACED_KINDS)('%s leaves resting balls stationary', kind => {
  const w = world(kind), initial = cloneBalls(w.balls);
  for (let i = 0; i < 100; i++) step(w, 1 / 30, null);
  expect(w.balls).toEqual(initial);
});
it.each(PLACED_KINDS)('%s measurably changes a moving shot', kind => {
  const run = (effect: boolean) => {
    const w = world(effect ? kind : undefined), b = w.balls[0];
    if (kind === 'railcraft') {
      b.x = 0; b.y = -table.W / 2 + 0.2;
      if (effect) w.terrain = buildCast(kind, 3, 0, table, w.balls, 0, { rail: { index: 0, position: 0.5 }, hardness: 'hard' }).terrain;
    }
    b.vx = kind === 'railcraft' ? 0 : 1.2; b.vy = kind === 'railcraft' ? -1.2 : 0; b.wx = -b.vy / table.R; b.wy = b.vx / table.R; b.wz = 50;
    for (let i = 0; i < 90; i++) step(w, 1 / 120, null);
    return [b.x, b.y, b.vx, b.vy, b.wz];
  };
  expect(run(true).some((v, i) => Math.abs(v - run(false)[i]) > 1e-5)).toBe(true);
});
it('a high speed ball cannot tunnel through a bumper or gain energy', () => {
  const w = world('bumper'), b = w.balls[0];
  b.y = 0.06; b.vx = 12; b.wy = 12 / table.R;
  const events: Parameters<typeof step>[2] = [];
  step(w, 0.04, events);
  expect(events.some(e => e.t === 'cushion')).toBe(true);
  expect(b.x).toBeLessThan(0);
  expect(Math.hypot(b.vx, b.vy)).toBeLessThan(12);
});
it('hard railcraft never adds collision energy', () => {
  const w = world('railcraft'), b = w.balls[0];
  const rail = table.segments[0];
  w.terrain = { rails: [{ ...rail, multiplier: 10 }] };
  b.x = 0; b.y = -table.W / 2 + table.R + 0.01; b.vy = -2; b.wx = 2 / table.R;
  step(w, 0.03, null);
  expect(Math.hypot(b.vx, b.vy)).toBeLessThanOrEqual(2);
});
it('match and prediction use identical active terrain and strike parameters', () => {
  const m = new Match({
    mode: 'carom-libre', raceTo: 1, mutator: null, tableSkin: TABLES[0], seed: 42,
    players: [0, 1].map(() => ({ name: 'A', kind: 'human', cue: CUES[0], champion: 'tokiemnhi' })) as Match['setup']['players'],
  });
  for (const kind of PLACED_KINDS) m.activeEffects.push({ ...buildCast(kind, 2, 2, m.table, m.balls, m.cueId()), target: m.turn });
  const input = { angle: 0.4, power: 0.45, side: 0.1, vert: 0.2, call: null, pushOut: false };
  const prediction = { ...m.simulationWorld(), balls: cloneBalls(m.balls) };
  m.strikePreview(prediction.balls.find(b => b.id === m.cueId())!, input);
  m.shoot(input);
  for (let i = 0; i < 20; i++) { step(prediction, 1 / 120, null); m.update(1 / 120); }
  expect(m.balls).toEqual(prediction.balls);
});
it('merges omen and skill forces and overlapping friction without replacing either', () => {
  const terrain = mergeTerrain({ force: { x: 1, y: 0 }, patches: [{ x: 0, y: 0, r: 2, roll: 0.5, slide: 1 }] }, { force: { x: 1, y: 1 }, wells: [{ x: 0, y: 0, r: 1, a: 1 }] });
  expect(terrain.forces).toHaveLength(2);
  expect(terrain.patches).toHaveLength(1);
  expect(terrain.wells).toHaveLength(1);
  const b = makeBall(0, 0, 0); b.vx = 0.3; b.wy = b.vx / table.R;
  const speed = b.vx;
  step({ table, balls: [b], params: DEFAULT_PHYS, terrain }, 0.1, null);
  expect(Math.hypot(b.vx, b.vy)).toBeLessThan(speed);
});
it('casts the whole ultimate package even when an earlier family is already active', async () => {
  const { CHAMPIONS } = await import('../src/game/content/sects');
  const champion = CHAMPIONS[0], original = champion.skills[2];
  champion.skills[2] = { ...original, kinds: ['vision', 'wind', 'sand'], target: 'opponent' };
  try {
    const m = new Match({ mode: 'carom-libre', raceTo: 1, mutator: null, tableSkin: TABLES[0], seed: 42,
      players: [0, 1].map(() => ({ name: 'A', kind: 'human', cue: CUES[0], champion: champion.id })) as Match['setup']['players'] });
    m.eagle = true; m.energy[m.turn] = 100;
    expect(m.useSkill(m.turn, 2)).toBe(true);
    expect(m.activeEffects.map(e => e.kind)).toEqual(['wind', 'sand']);
    expect(m.activeEffects.every(e => e.slot === 2 && e.target !== m.turn)).toBe(true);
    expect(m.terrain().patches).toHaveLength(0);
  } finally { champion.skills[2] = original; }
});
