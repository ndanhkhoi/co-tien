import { expect, it } from 'vitest';
import { makeBall, step, DEFAULT_PHYS, segmentDistance } from '../src/core/physics';
import { makeCaromTable, makePoolTable } from '../src/core/table';
import { buildCast, mergeTerrain, applySkillBlast } from '../src/game/skill-cast';
import type { SkillKind, UltId } from '../src/game/content/sects';

const cases: [UltId, SkillKind][] = [
  ['hoalinh', 'wind'], ['bangphach', 'slick'], ['thienco', 'bumper'], ['docvu', 'spinwash'],
  ['hailong', 'railcraft'], ['uminh', 'bumper'], ['tinhtu', 'well'], ['kimsa', 'sand'],
  ['vanthu', 'bumper'], ['hukhong', 'well'], ['thienhuong', 'vortex'],
];
it.each(cases)('%s creates distinct physical geometry on pool and carom', (ult, kind) => {
  for (const table of [makePoolTable(), makeCaromTable()]) {
    const balls = [makeBall(0, -0.6, 0), makeBall(1, 0.65, 0.25)];
    const cast = { point: { x: 0, y: 0 }, direction: { x: 1, y: 0 } };
    const basic = buildCast(kind, 5, 2, { table, balls, cueId: 0, cast });
    const effect = buildCast(kind, 5, 2, { table, balls, cueId: 0, cast, ult });
    expect({ terrain: effect.terrain, segments: effect.segments }).not.toEqual({ terrain: basic.terrain, segments: basic.segments });
    for (const s of effect.segments) for (const b of balls) expect(segmentDistance(b.x, b.y, s)).toBeGreaterThan(table.R * 2);
    const world = { balls, table, params: DEFAULT_PHYS, terrain: mergeTerrain(effect.terrain), extraSegments: effect.segments };
    for (let i = 0; i < 60; i++) step(world, 1 / 60, null);
    expect(balls.every(b => b.vx === 0 && b.vy === 0)).toBe(true);
  }
});
it('opposed wind acts only in its own zone and reverses across the axis', () => {
  const table = makeCaromTable(), cue = makeBall(0, -0.6, 0);
  const effect = buildCast('wind', 5, 2, { table, balls: [cue], cueId: 0, cast: { point: { x: 0, y: 0 }, direction: { x: 1, y: 0 } }, ult: 'hoalinh' });
  const forces = effect.terrain.forces!;
  expect(forces[0].x).toBe(-forces[1].x);
  expect(forces.every(f => f.region?.r === 0.13)).toBe(true);
});
it('directional blast affects only the forward cone and pushes along its axis', () => {
  const balls = [makeBall(0, 0.1, 0.02), makeBall(1, -0.1, 0), makeBall(2, 0, 0.1)];
  applySkillBlast(balls, { x: 0, y: 0 }, { radius: 0.3, force: 1, direction: { x: 2, y: 0 } });
  expect(balls[0].vx).toBeGreaterThan(0);
  expect(balls.every(b => b.vy === 0)).toBe(true);
  expect(balls.slice(1).every(b => b.vx === 0)).toBe(true);
});
it.each(['gate', 'roots'] as const)('relocates the entire %s around occupied geometry', shape => {
  const table = makePoolTable();
  const balls = [makeBall(0, 0, 0), makeBall(1, 0.08, -0.1), makeBall(2, -0.08, 0.1)];
  const effect = buildCast('bumper', 4, 0, { table, balls, cueId: 0, cast: { point: { x: 0, y: 0 }, direction: { x: 1, y: 0 } }, shape });
  expect(effect.segments).toHaveLength(2);
  for (const s of effect.segments) for (const b of balls) expect(segmentDistance(b.x, b.y, s)).toBeGreaterThan(table.R * 2.1);
});
