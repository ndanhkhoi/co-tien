import { describe, expect, it } from 'vitest';
import { DEFAULT_PHYS, makeBall, simulate, strike, type Ball, type SimWorld } from '../src/core/physics';
import { rackEight } from '../src/core/rack';
import { Rng } from '../src/core/rng';
import { makeCaromTable, makePoolTable } from '../src/core/table';

const pool = makePoolTable();
const world = (balls: Ball[], table = pool): SimWorld => ({ table, balls, params: DEFAULT_PHYS });

describe('physics', () => {
  it('a rolling ball comes to rest and stays on the table', () => {
    const cue = makeBall(0, -0.5, 0.1);
    strike(cue, pool.R, { angle: 0.3, speed: 2, side: 0, vert: 0 });
    const w = world([cue]);
    const ev = simulate(w);
    expect(cue.vx).toBe(0);
    expect(cue.vy).toBe(0);
    expect(cue.onTable || ev.some((e) => e.t === 'pocket')).toBe(true);
    expect(Math.abs(cue.x)).toBeLessThan(pool.L / 2);
  });

  it('a straight shot into the corner pocket drops the object ball', () => {
    const pk = pool.pockets[2]; // top-right corner
    const ob = makeBall(1, pk.ax - 0.3, pk.ay + 0.3);
    const cue = makeBall(0, ob.x - 0.4, ob.y + 0.4);
    const ang = Math.atan2(pk.ay - ob.y, pk.ax - ob.x);
    strike(cue, pool.R, { angle: ang, speed: 1.6, side: 0, vert: 0 });
    const ev = simulate(world([cue, ob]));
    expect(ev.some((e) => e.t === 'pocket' && e.id === 1)).toBe(true);
  });

  it('stun shot stops the cue ball dead on a full hit; draw brings it back; follow carries through', () => {
    const run = (vert: number) => {
      const ob = makeBall(1, 0.2, 0);
      const cue = makeBall(0, -0.2, 0);
      // A short shot so the cue ball arrives still sliding with the given spin.
      strike(cue, pool.R, { angle: 0, speed: 2.2, side: 0, vert });
      simulate(world([cue, ob]));
      return cue.x;
    };
    const stun = run(-0.25);
    const draw = run(-1);
    const follow = run(1);
    expect(draw).toBeLessThan(stun - 0.05);
    expect(follow).toBeGreaterThan(stun + 0.05);
  });

  it('side spin changes the rebound angle off a cushion', () => {
    const run = (side: number) => {
      const cue = makeBall(0, 0.3, 0);
      strike(cue, pool.R, { angle: -Math.PI / 2, speed: 1.5, side, vert: 0 });
      simulate(world([cue]));
      return cue.x;
    };
    expect(Math.abs(run(1) - run(-1))).toBeGreaterThan(0.05);
  });

  it('a hard break scatters the rack without balls leaving the table area', () => {
    const balls = rackEight(pool, new Rng(7));
    const cue = balls[0];
    strike(cue, pool.R, { angle: Math.atan2(balls[1].y - cue.y, balls[1].x - cue.x), speed: 8, side: 0, vert: 0 });
    const w = world(balls);
    const ev = simulate(w);
    const moved = balls.filter((b) => b.id !== 0 && b.onTable && Math.hypot(b.x - 0.5, b.y) > 0.15).length;
    expect(moved).toBeGreaterThan(4);
    for (const b of balls) {
      if (!b.onTable) continue;
      expect(Math.abs(b.x)).toBeLessThanOrEqual(pool.L / 2);
      expect(Math.abs(b.y)).toBeLessThanOrEqual(pool.W / 2);
    }
    // Every pocket event refers to a ball that is now off the table.
    for (const e of ev) if (e.t === 'pocket') expect(balls.find((b) => b.id === e.id)!.onTable).toBe(false);
  });

  it('carom table keeps all balls in play', () => {
    const t = makeCaromTable();
    const balls = [makeBall(0, -0.6, 0.1), makeBall(1, -0.6, -0.2), makeBall(2, 0.6, 0)];
    strike(balls[0], t.R, { angle: 0.2, speed: 6, side: 0.8, vert: 0.5 });
    simulate(world(balls, t));
    expect(balls.every((b) => b.onTable)).toBe(true);
  });
});
