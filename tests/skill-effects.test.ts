import { describe, expect, it } from 'vitest';
import { makeBall } from '../src/core/physics';
import { Match } from '../src/game/match';
import { CUES, TABLES } from '../src/game/content/gear';
import { CHAMPIONS, describeKind, type SkillDef, type SkillKind } from '../src/game/content/sects';
import { addNoise } from '../src/ai/skill-choice';
import { Rng } from '../src/core/rng';
import type { Ctx } from '../src/ai/search-context';

const players = () => [0, 1].map((i) => ({ name: String(i), kind: 'human' as const, cue: CUES[0], champion: 'tokiemnhi' })) as Match['setup']['players'];
const fixture = (kinds: SkillKind[], tier = 3): SkillDef => ({ slot: 0, name: 'Fixture', kinds, tier, cooldown: 1, desc: '' });

function lane(kinds: SkillKind[], tier: number, mode: Match['setup']['mode'] = 'eight') {
  const m = new Match({ mode, raceTo: 1, mutator: null, tableSkin: TABLES[0], seed: 3, players: players(),
    layout: [makeBall(0, -0.95, 0), makeBall(1, 1.0, 0.48), makeBall(9, 0.9, -0.45), makeBall(2, 0.2, 0.3)] });
  m.state.isBreak = false;
  m.placing = 'none';
  CHAMPIONS[0].skills[0] = fixture(kinds, tier);
  return m;
}

/** Heading of the cue ball once it has crossed the middle of the table. */
function exitHeading(m: Match, cast: Parameters<Match['useSkill']>[2] | null): number {
  if (cast) expect(m.useSkill(0, 0, cast)).toBe(true);
  m.shoot({ angle: 0, power: 0.45, side: 0, vert: 0, call: null, pushOut: false });
  const c = m.balls[0];
  for (let i = 0; i < 6000 && c.x < 0.1; i++) m.update(1 / 120);
  return Math.atan2(c.vy, c.vx) * 180 / Math.PI;
}

describe('table zones bend a rolling ball enough to see', () => {
  for (const [kind, offset] of [['vortex', 0], ['well', 0.08], ['silk', 0.08]] as const) {
    it(`${kind} turns a crossing ball by at least 8 degrees at tier 3`, () => {
      const plain = exitHeading(lane([kind], 3), null);
      const bent = exitHeading(lane([kind], 3), { point: { x: -0.3, y: offset }, direction: { x: 1, y: 0 }, sense: 'cw' });
      expect(Math.abs(bent - plain)).toBeGreaterThan(8);
    });
  }

    it('turns a ball through the swirl centre by about the angle the skill card states', () => {
    const plain = exitHeading(lane(['vortex'], 3), null);
    const bent = exitHeading(lane(['vortex'], 3), { point: { x: -0.3, y: 0 }, direction: { x: 1, y: 0 }, sense: 'cw' });
    const stated = Number(/khoảng (\d+)°/.exec(describeKind('vortex', 3))![1]);
    expect(Math.abs(bent - plain)).toBeGreaterThan(stated * 0.6);
    expect(Math.abs(bent - plain)).toBeLessThan(stated * 1.4);
  });

it('never moves a resting ball', () => {
    const m = lane(['vortex'], 7);
    m.useSkill(0, 0, { point: { x: 0.2, y: 0.3 }, direction: { x: 1, y: 0 }, sense: 'cw' });
    const ball = m.balls.find((b) => b.id === 2)!;
    const at = { x: ball.x, y: ball.y };
    m.shoot({ angle: Math.PI, power: 0.05, side: 0, vert: 0, call: null, pushOut: false });
    for (let i = 0; i < 6000 && m.phase === 'rolling'; i++) m.update(1 / 60);
    expect({ x: ball.x, y: ball.y }).toEqual(at);
  });
});

describe('hexes cast during the opponent turn reach that shot', () => {
  it('arms tremor for the shot being lined up', () => {
    const m = lane(['chill'], 3);
    m.state.turn = 1;
    m.beginTurn();
    expect(m.tremorNow).toBe(1);
    expect(m.useSkill(0, 0)).toBe(true);
    expect(m.tremorNow).toBeGreaterThan(1);
  });
});

describe('swap', () => {
  it('trades the caster farthest ball for the opponent ball nearest a pocket', () => {
    const m = lane(['swap'], 5);
    m.state.groups = ['solid', 'stripe'];
    const nine = m.balls.find((b) => b.id === 9)!;
    const near = { x: nine.x, y: nine.y };
    expect(m.useSkill(0, 0)).toBe(true);
    const own = m.balls.find((b) => b.id === 2)!;
    expect({ x: own.x, y: own.y }).toEqual(near);
  });

  it('is not castable when both sides would trade the same ball', () => {
    const m = lane(['swap'], 5, 'eight');
    m.balls = m.balls.filter((b) => b.id === 0 || b.id === 2);
    m.world.balls = m.balls;
    expect(m.canUseSkill(0, 0)).toBe(false);
  });
});

describe('rotation games keep every skill working', () => {
  it('turns opponent-ball families into shared-table effects in nine ball', () => {
    const m = lane(['called'], 4, 'nine');
    expect(m.effectiveKind('called')).toBe('seal');
    expect(m.effectiveKind('swap')).toBe('teleport');
    expect(m.effectiveKind('displace')).toBe('chill');
    expect(m.canUseSkill(0, 0)).toBe(true);
  });
});

describe('AI feels the hexes', () => {
  it('shakes wider under Run Tay and only half reads a drift', () => {
    const shot = { angle: 0, power: 0.5, side: 0, vert: 0, call: null };
    const spread = (req: Partial<Ctx['req']>) => {
      const ctx = { req: { profile: { level: 3, personality: 'balanced' }, ...req }, tune: { aimSigma: 0.01, powerSigma: 0 }, rng: new Rng(5) } as unknown as Ctx;
      const xs = Array.from({ length: 400 }, () => addNoise(ctx, shot as never).angle);
      const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
      return { mean, sd: Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length) };
    };
    expect(spread({ tremor: 3 }).sd).toBeGreaterThan(spread({}).sd * 2.5);
    expect(spread({ driftAngle: 2 }).mean).toBeCloseTo(-1 * Math.PI / 180, 2);
  });
});
