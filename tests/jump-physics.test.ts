import { describe, expect, it } from 'vitest';
import { DEFAULT_PHYS, elevatedTipOffset, makeBall, simulate, step, strike, type SimWorld } from '../src/core/physics';
import { makeCaromTable } from '../src/core/table';

const table = makeCaromTable();
const world = (balls: ReturnType<typeof makeBall>[]): SimWorld => ({ table, balls, params: DEFAULT_PHYS });

describe('elevated cue strikes', () => {
  it('narrows elevated contact tolerance and transfers less rebound impulse with spin', () => {
    const clean = makeBall(0, 0, 0), offset = makeBall(0, 0, 0), edge = makeBall(0, 0, 0);
    const input = { angle: 0, speed: 3, side: 0, vert: 0, elevation: Math.PI / 3 };
    strike(clean, table.R, input);
    strike(offset, table.R, { ...input, side: 0.3 });
    strike(edge, table.R, { ...input, side: 0.6 });
    expect(elevatedTipOffset(0.3, 0, 0)).toBeCloseTo(0.3);
    expect(elevatedTipOffset(0.3, 0, input.elevation)).toBeCloseTo(0.6);
    expect(offset.vz).toBeLessThan(clean.vz!);
    expect(offset.vz).toBeGreaterThan(0);
    expect(edge.vz).toBe(0);
    const energy = (b: typeof clean) => b.vx ** 2 + b.vy ** 2 + b.vz! ** 2;
    expect(energy(offset)).toBeLessThan(energy(clean));
  });

  it('uses ballistic flight with no cloth friction while airborne', () => {
    const cue = makeBall(0, -0.5, 0);
    strike(cue, table.R, { angle: 0, speed: 3, side: 0, vert: 0, elevation: Math.PI / 3 });
    const vx = cue.vx, vz = cue.vz!;
    step(world([cue]), 0.05, []);
    expect(cue.x).toBeCloseTo(-0.5 + vx * 0.05, 7);
    expect(cue.z).toBeCloseTo(vz * 0.05 - 0.5 * DEFAULT_PHYS.g * 0.05 ** 2, 7);
    expect(cue.vx).toBe(vx);
  });

  it('clears an intervening ball only at sufficient height and eventually lands', () => {
    const cue = makeBall(0, -0.6, 0), blocker = makeBall(1, -0.35, 0);
    strike(cue, table.R, { angle: 0, speed: 3.5, side: 0, vert: 0, elevation: Math.PI / 3 });
    const w = world([cue, blocker]);
    const events: Parameters<typeof simulate>[2] = [];
    for (let i = 0; i < 20; i++) step(w, 0.01, events);
    expect(events.some(e => e.t === 'ball')).toBe(false);
    expect(blocker.x).toBe(-0.35);
    w.balls = [cue];
    simulate(w);
    expect(cue.z).toBe(0);
    expect(cue.vz).toBe(0);
  });

  it('still collides with an obstructing ball on a low trajectory', () => {
    const cue = makeBall(0, -0.6, 0), blocker = makeBall(1, -0.52, 0);
    strike(cue, table.R, { angle: 0, speed: 1, side: 0, vert: 0, elevation: 20 * Math.PI / 180 });
    const events = simulate(world([cue, blocker]));
    expect(events.some(e => e.t === 'ball')).toBe(true);
  });

  it('collides with balls at the same height but clears low physical obstacles', () => {
    const cue = makeBall(0, -0.3, 0), airborne = makeBall(1, -0.2, 0);
    cue.z = airborne.z = 0.1;
    cue.vx = 2;
    const events = simulate(world([cue, airborne]));
    expect(events.some(e => e.t === 'ball')).toBe(true);
    const jumper = makeBall(0, -0.1, 0);
    jumper.z = 0.1; jumper.vx = 2;
    const w = { ...world([jumper]), extraSegments: [{ ax: 0, ay: -0.2, bx: 0, by: 0.2 }] };
    const obstacles: Parameters<typeof simulate>[2] = [];
    step(w, 0.08, obstacles);
    expect(jumper.x).toBeGreaterThan(0);
    expect(obstacles.some(e => e.t === 'cushion')).toBe(false);
  });

  it('reports a foul event when the ball clears a cushion and leaves the bed', () => {
    const cue = makeBall(0, table.L / 2 - 0.16, 0);
    strike(cue, table.R, { angle: 0, speed: 4, side: 0, vert: 0, elevation: Math.PI / 3 });
    const events = simulate(world([cue]));
    expect(events.some(e => e.t === 'off-table' && e.id === 0)).toBe(true);
    expect(cue.onTable).toBe(false);
  });
});

import { summarize, newGameState } from '../src/core/rules/types';
import { nineBall, tenBall } from '../src/core/rules/rotation';
import { eightBall } from '../src/core/rules/eight-ball';
import { caromLibre } from '../src/core/rules/carom';

describe('balls driven off the table', () => {
  const shot = (id: number) => summarize([
    { t: 'ball', a: 0, b: 1, speed: 1, x: 0, y: 0 },
    { t: 'off-table', id, speed: 1 },
  ], 0, false, null, false, [1]);

  it('distinguishes an off-table ball from a pocket for scoring and calls', () => {
    expect(shot(9).pocketed).toEqual([]);
    expect(shot(9).offTable).toEqual([9]);
  });

  it('fouls and respots the money ball in rotation games, including push-out', () => {
    for (const [rules, id] of [[nineBall, 9], [tenBall, 10]] as const) {
      const state = newGameState(rules.mode, 0);
      state.isBreak = false;
      const summary = { ...shot(id), pushOut: true };
      const res = rules.resolve(state, [], summary);
      expect(res.foul).toBeTruthy();
      expect(res.winner).toBe(null);
      expect(res.ballInHand).toBe('anywhere');
      expect(res.respot).toContain(id);
    }
  });

  it('loses 8-ball when the eight leaves the table outside the break', () => {
    const state = newGameState('eight', 0);
    state.isBreak = false;
    expect(eightBall.resolve(state, [], shot(8)).winner).toBe(1);
  });

  it('denies carom points and replaces displaced balls', () => {
    const state = newGameState('carom-libre', 0);
    const res = caromLibre.resolve(state, [], { ...shot(2), cueContacts: [1, 2] });
    expect(res.foul).toBeTruthy();
    expect(res.points).toBe(0);
    expect(res.respot).toEqual([2]);
  });
});

import { Match } from '../src/game/match';
import { CUES, TABLES } from '../src/game/content/gear';
import { CHAMPIONS } from '../src/game/content/sects';

it('adds elevated miscue risk only for offset strokes and cancels uncontrolled jumps', () => {
  const match = new Match({ mode: 'carom-libre', raceTo: 1, tableSkin: TABLES[0], mutator: null, classic: true, seed: 42,
    players: [0, 1].map(() => ({ name: 'Kiểm tra', kind: 'human', cue: CUES[0], champion: CHAMPIONS[0].id })) as Match['setup']['players'] });
  expect(match.miscueChance(0.5, 0, 0.8)).toBe(0);
  expect(match.miscueChance(0, 0, 0.8, Math.PI / 3)).toBe(0);
  expect(match.miscueChance(0.5, 0, 0.8, Math.PI / 3)).toBeGreaterThan(0);
  match.miscueChance = () => 1;
  match.shoot({ angle: 0, power: 0.8, side: 0.8, vert: 0, elevation: Math.PI / 3, call: null, pushOut: false });
  expect(match.cueBall().vz).toBe(0);
});
