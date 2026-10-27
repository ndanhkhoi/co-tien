import { describe, expect, it } from 'vitest';
import { makeBall, type Ball } from '../src/core/physics';
import { rackEight, rackNine, rackTen } from '../src/core/rack';
import { Rng } from '../src/core/rng';
import { caromThree } from '../src/core/rules/carom';
import { eightBall } from '../src/core/rules/eight-ball';
import { nineBall, tenBall } from '../src/core/rules/rotation';
import { newGameState, type ShotSummary } from '../src/core/rules/types';
import { makePoolTable } from '../src/core/table';

const t = makePoolTable();

function shot(p: Partial<ShotSummary>): ShotSummary {
  return {
    isBreak: false, cueId: 0, firstHit: null, pocketed: [], railAfterContact: true, objectBallsToRail: 0,
    cueContacts: [], cueRailsBeforeSecond: 0, call: null, pushOut: false, targets: [], crossedHeadString: 0, ...p,
  };
}

const ballsWith = (ids: number[]): Ball[] => [makeBall(0, -0.5, 0), ...ids.map((id, i) => makeBall(id, 0.1 * i, 0.2))];

describe('racks (WPA)', () => {
  it('8-ball: 8 in the centre of row three, one solid and one stripe in the back corners, apex on foot spot', () => {
    for (let seed = 1; seed < 30; seed++) {
      const balls = rackEight(t, new Rng(seed)).slice(1);
      expect(balls).toHaveLength(15);
      const apex = balls.reduce((a, b) => (b.x < a.x ? b : a));
      expect(Math.abs(apex.x - t.footSpot.x)).toBeLessThan(0.001);
      const rowX = (i: number) => t.footSpot.x + i * Math.sqrt(3) * t.R;
      const eight = balls.find((b) => b.id === 8)!;
      expect(Math.abs(eight.x - rowX(2))).toBeLessThan(0.002);
      expect(Math.abs(eight.y)).toBeLessThan(0.001);
      const back = balls.filter((b) => Math.abs(b.x - rowX(4)) < 0.002).sort((a, b) => a.y - b.y);
      const corners = [back[0].id, back[4].id];
      expect(corners.filter((id) => id < 8)).toHaveLength(1);
      expect(corners.filter((id) => id > 8)).toHaveLength(1);
    }
  });

  it('9-ball: diamond with the 9 on the foot spot and the 1 at the apex', () => {
    const balls = rackNine(t, new Rng(3)).slice(1);
    const nine = balls.find((b) => b.id === 9)!;
    expect(Math.hypot(nine.x - t.footSpot.x, nine.y - t.footSpot.y)).toBeLessThan(0.001);
    const one = balls.find((b) => b.id === 1)!;
    expect(one.x).toBe(Math.min(...balls.map((b) => b.x)));
  });

  it('10-ball: 1 at the apex on the foot spot, 10 in the centre of row three', () => {
    const balls = rackTen(t, new Rng(5)).slice(1);
    const one = balls.find((b) => b.id === 1)!;
    expect(Math.abs(one.x - t.footSpot.x)).toBeLessThan(0.001);
    const ten = balls.find((b) => b.id === 10)!;
    expect(Math.abs(ten.y)).toBeLessThan(0.001);
  });
});

describe('8-ball', () => {
  it('assigns the group of the first legally pocketed ball on an open table', () => {
    const s = newGameState('eight', 0);
    s.isBreak = false;
    const r = eightBall.resolve(s, ballsWith([1, 9]), shot({ firstHit: 3, pocketed: [{ id: 3, pocket: 0 }], targets: [1, 3, 9] }));
    expect(r.foul).toBeNull();
    expect(r.assignGroup).toBe('solid');
    expect(r.keepTurn).toBe(true);
  });

  it('pocketing the 8 early loses; pocketing it in the called pocket wins', () => {
    const s = newGameState('eight', 0);
    s.isBreak = false;
    s.groups = ['solid', 'stripe'];
    const early = eightBall.resolve(s, ballsWith([1]), shot({ firstHit: 1, pocketed: [{ id: 8, pocket: 2 }], targets: [1] }));
    expect(early.winner).toBe(1);
    const ok = eightBall.resolve(s, ballsWith([]), shot({ firstHit: 8, pocketed: [{ id: 8, pocket: 2 }], targets: [8], call: { ball: 8, pocket: 2 } }));
    expect(ok.winner).toBe(0);
    const wrongPocket = eightBall.resolve(s, ballsWith([]), shot({ firstHit: 8, pocketed: [{ id: 8, pocket: 3 }], targets: [8], call: { ball: 8, pocket: 2 } }));
    expect(wrongPocket.winner).toBe(1);
    const scratch = eightBall.resolve(s, ballsWith([]), shot({ firstHit: 8, pocketed: [{ id: 8, pocket: 2 }, { id: 0, pocket: 1 }], targets: [8], call: { ball: 8, pocket: 2 } }));
    expect(scratch.winner).toBe(1);
  });

  it('a break with no ball pocketed and fewer than four to a rail gives the incoming player the option', () => {
    const s = newGameState('eight', 0);
    const r = eightBall.resolve(s, ballsWith([]), shot({ isBreak: true, firstHit: 1, objectBallsToRail: 2 }));
    expect(r.option).toBe('illegal-break-8');
  });

  it('a scratch on the break is ball in hand above the head string; 8 on the break is spotted', () => {
    const s = newGameState('eight', 0);
    const r = eightBall.resolve(s, ballsWith([]), shot({ isBreak: true, firstHit: 1, pocketed: [{ id: 8, pocket: 0 }, { id: 0, pocket: 3 }] }));
    expect(r.ballInHand).toBe('kitchen');
    expect(r.respot).toContain(8);
    expect(r.winner).toBeNull();
  });

  it('wrong ball first and no rail after contact are fouls with ball in hand anywhere', () => {
    const s = newGameState('eight', 0);
    s.isBreak = false;
    s.groups = ['solid', 'stripe'];
    const wrong = eightBall.resolve(s, ballsWith([1, 9]), shot({ firstHit: 9, targets: [1] }));
    expect(wrong.foul).not.toBeNull();
    expect(wrong.ballInHand).toBe('anywhere');
    const noRail = eightBall.resolve(s, ballsWith([1, 9]), shot({ firstHit: 1, targets: [1], railAfterContact: false }));
    expect(noRail.foul).not.toBeNull();
  });
});

describe('9-ball', () => {
  it('requires the lowest ball first and wins on a legal 9 (including combinations)', () => {
    const s = newGameState('nine', 0);
    s.isBreak = false;
    const combo = nineBall.resolve(s, ballsWith([3]), shot({ firstHit: 2, targets: [2], pocketed: [{ id: 9, pocket: 1 }] }));
    expect(combo.winner).toBe(0);
    const foul = nineBall.resolve(s, ballsWith([3]), shot({ firstHit: 3, targets: [2], pocketed: [{ id: 9, pocket: 1 }] }));
    expect(foul.winner).toBeNull();
    expect(foul.respot).toContain(9);
  });

  it('three consecutive fouls lose the rack', () => {
    const s = newGameState('nine', 0);
    s.isBreak = false;
    s.fouls = [2, 0];
    const r = nineBall.resolve(s, ballsWith([3]), shot({ firstHit: null, targets: [2] }));
    expect(r.winner).toBe(1);
  });

  it('three-ball break rule gives the incoming player the option', () => {
    const s = newGameState('nine', 0);
    const r = nineBall.resolve(s, ballsWith([]), shot({ isBreak: true, firstHit: 1, objectBallsToRail: 6, crossedHeadString: 1 }));
    expect(r.foul).toBeNull();
    expect(r.option).toBe('illegal-break-9');
  });

  it('a push-out suspends wrong-ball and rail fouls and hands the choice to the opponent', () => {
    const s = newGameState('nine', 0);
    s.isBreak = false;
    const r = nineBall.resolve(s, ballsWith([2]), shot({ firstHit: null, railAfterContact: false, pushOut: true, targets: [2] }));
    expect(r.foul).toBeNull();
    expect(r.option).toBe('push-out');
  });
});

describe('10-ball', () => {
  it('spots an early 10 and only wins when the called 10 is the last ball', () => {
    const s = newGameState('ten', 0);
    s.isBreak = false;
    const early = tenBall.resolve(s, ballsWith([2]), shot({ firstHit: 2, targets: [2], call: { ball: 10, pocket: 1 }, pocketed: [{ id: 10, pocket: 1 }] }));
    expect(early.winner).toBeNull();
    expect(early.respot).toContain(10);
    const last = tenBall.resolve(s, ballsWith([]), shot({ firstHit: 10, targets: [10], call: { ball: 10, pocket: 1 }, pocketed: [{ id: 10, pocket: 1 }] }));
    expect(last.winner).toBe(0);
  });

  it('a ball pocketed against the call is not a foul but gives the opponent the option', () => {
    const s = newGameState('ten', 0);
    s.isBreak = false;
    const r = tenBall.resolve(s, ballsWith([3]), shot({ firstHit: 2, targets: [2], call: { ball: 2, pocket: 0 }, pocketed: [{ id: 3, pocket: 4 }] }));
    expect(r.foul).toBeNull();
    expect(r.keepTurn).toBe(false);
    expect(r.option).toBe('wrong-call');
  });
});

describe('three-cushion', () => {
  it('scores only with three cushions before the second ball', () => {
    const s = newGameState('carom-3c', 0, 5);
    s.isBreak = false;
    expect(caromThree.resolve(s, [], shot({ cueContacts: [2, 1], cueRailsBeforeSecond: 3 })).points).toBe(1);
    expect(caromThree.resolve(s, [], shot({ cueContacts: [2, 1], cueRailsBeforeSecond: 2 })).points).toBe(0);
  });
});
