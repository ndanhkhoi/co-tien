import { describe, expect, it } from 'vitest';
import { DEFAULT_PHYS, makeBall, step, type SimWorld } from '../src/core/physics';
import { buildCast } from '../src/game/skill-cast';
import { calledTarget, Match } from '../src/game/match';
import { CUES, TABLES } from '../src/game/content/gear';
import { CHAMPIONS, type SkillDef, type SkillKind } from '../src/game/content/sects';
import { think } from '../src/ai/brain';
import type { AiRequest } from '../src/ai/types';

function players(champion = 'tokiemnhi') {
  return [0, 1].map(i => ({ name: String(i), kind: 'human' as const, cue: CUES[0], champion })) as Match['setup']['players'];
}

function fixtureSkill(kinds: SkillDef['kinds'], turns?: number): SkillDef {
  return { slot: 0, name: 'Fixture', kinds, tier: 5, turns, cooldown: 1, desc: '' };
}

function withSkill(kinds: SkillDef['kinds'], turns?: number): Match {
  const m = new Match({ mode: 'eight', raceTo: 1, mutator: null, tableSkin: TABLES[0], seed: 7, players: players() });
  CHAMPIONS[0].skills[0] = fixtureSkill(kinds, turns);
  return m;
}

function settle(m: Match): void {
  for (let i = 0; i < 4000 && m.phase === 'rolling'; i++) m.update(1 / 30);
}

describe('lasting engine', () => {
  it('keeps one stack per hex and spends it after each recipient shot', () => {
    const m = withSkill(['chill'], 2);
    expect(m.useSkill(0, 0)).toBe(true);
    const hex = m.hexes[0];
    expect(hex).toMatchObject({ kind: 'chill', target: 1, shotsLeft: 2 });
    expect(m.useSkill(0, 0)).toBe(false);
    m.shoot({ angle: 0, power: 0.03, side: 0, vert: 0, call: null, pushOut: false });
    settle(m);
    m.shoot({ angle: 0, power: 0.03, side: 0, vert: 0, call: null, pushOut: false });
    settle(m);
    expect(hex.shotsLeft).toBe(1);
    m.shoot({ angle: 0, power: 0.03, side: 0, vert: 0, call: null, pushOut: false });
    settle(m);
    m.shoot({ angle: 0, power: 0.03, side: 0, vert: 0, call: null, pushOut: false });
    settle(m);
    expect(m.hexes).toHaveLength(0);
  });

  it('caps durations by slot and tier', () => {
    for (const c of CHAMPIONS) for (const s of c.skills) {
      const cap = s.slot === 2 && c.tier === 5 ? 3 : 2;
      expect(s.turns ?? 1).toBeLessThanOrEqual(cap);
    }
  });
});

describe('new families', () => {
  it('blind and drift arm without multiplying', () => {
    const m = withSkill(['blind', 'drift'], 2);
    m.useSkill(0, 0, { sense: 'ccw' });
    expect(m.hexes.map(h => h.kind).sort()).toEqual(['blind', 'drift']);
    expect(m.hexes.find(h => h.kind === 'drift')).toMatchObject({ sense: 'ccw' });
  });

  it('called ball turns wrong first contact into ball in hand', () => {
    const m = new Match({ mode: 'eight', raceTo: 1, mutator: null, tableSkin: TABLES[0], seed: 7, layout: [makeBall(0, -0.4, 0), makeBall(1, 0, 0.08), makeBall(2, 0, -0.08)], players: players() });
    CHAMPIONS[0].skills[0] = fixtureSkill(['called']);
    m.state.isBreak = false;
    m.state.groups = ['stripe', 'solid'] as Match['state']['groups'];
    m.useSkill(0, 0, { pick: { x: 0, y: -0.08 } });
    m.state.turn = 1;
    m.beginTurn();
    const blank = { foul: null, keepTurn: false, ballInHand: 'none', respot: [], winner: null, messages: [], points: 0 };
    Object.defineProperty(m, 'rules', { value: { ...m.rules, resolve: () => blank } });
    m.shoot({ angle: Math.atan2(0.08, 0.4), power: 0.2, side: 0, vert: 0, call: null, pushOut: false });
    settle(m);
    expect(m.lastShot?.firstHit).toBe(1);
    expect(m.lastRes?.foul).toContain('bi 2');
    expect(m.lastRes?.ballInHand).toBe('anywhere');
  });

  it('marks the tapped ball, and the ball nearest a pocket when nothing was tapped', () => {
    const layout = [makeBall(0, -0.4, 0), makeBall(1, 0, 0), makeBall(2, 1.1, 0.5)];
    const make = () => {
      const m = new Match({ mode: 'eight', raceTo: 1, mutator: null, tableSkin: TABLES[0], seed: 7, layout, players: players() });
      CHAMPIONS[0].skills[0] = fixtureSkill(['called']);
      m.state.isBreak = false;
      m.state.groups = ['stripe', 'solid'] as Match['state']['groups'];
      return m;
    };
    const auto = make();
    expect(calledTarget(auto, 0)?.id).toBe(2);
    auto.useSkill(0, 0);
    expect(auto.called?.ball).toBe(2);
    const tapped = make();
    expect(calledTarget(tapped, 0, { x: 0.02, y: 0 })?.id).toBe(1);
    tapped.useSkill(0, 0, { pick: { x: 0.02, y: 0 } });
    expect(tapped.called?.ball).toBe(1);
  });

  it('displace and swap keep every ball on a legal clear resting spot', () => {
    const layout = [makeBall(0, -0.6, 0), makeBall(1, 1.2, -0.55), makeBall(9, 1.15, 0.55), makeBall(10, -0.2, 0.2)];
    const displace = new Match({ mode: 'nine', raceTo: 1, mutator: null, tableSkin: TABLES[0], seed: 7, layout, players: players() });
    CHAMPIONS[0].skills[0] = fixtureSkill(['displace']);
    displace.state.groups = ['solid', 'stripe'];
    const events: number[] = [];
    displace.on(e => { if (e.type === 'displace') events.push(e.moved.length); });
    expect(displace.useSkill(0, 0)).toBe(true);
    expect(events[0]).toBeGreaterThan(0);
    for (const b of displace.balls) expect(Math.hypot(b.x, b.y)).toBeLessThan(1.4);

    const swap = new Match({ mode: 'eight', raceTo: 1, mutator: null, tableSkin: TABLES[0], seed: 7, layout, players: players() });
    CHAMPIONS[0].skills[0] = fixtureSkill(['swap']);
    swap.state.groups = ['solid', 'stripe'];
    expect(swap.useSkill(0, 0)).toBe(true);
    expect(swap.balls.find(b => b.id === 1)?.y).toBeGreaterThan(0);
  });

  it('decoys are fixed circular obstacles, counter absorbs, and puppet clears a foul', () => {
    const m = withSkill(['decoy']);
    m.state.isBreak = false;
    m.state.groups = ['stripe', 'solid'];
    expect(m.useSkill(0, 0)).toBe(true);
    const decoy = m.activeEffects.find(e => e.kind === 'decoy')!;
    expect(decoy.segments.length).toBeGreaterThanOrEqual(24);
    const counter = withSkill(['counter']);
    counter.energy[1] = 20;
    counter.useSkill(0, 0);
    counter.state.turn = 1;
    counter.beginTurn();
    CHAMPIONS[0].skills[0] = fixtureSkill(['drain']);
    expect(counter.useSkill(1, 0)).toBe(true);
    expect(counter.cooldown[1][0]).toBe(1);
    expect(counter.activeEffects.some(e => e.kind === 'drain')).toBe(false);
    expect(counter.energy[0]).toBe(75);

    const puppet = withSkill(['puppet']);
    expect(puppet.useSkill(0, 0)).toBe(true);
    expect(puppet.puppeteer).toBe(0);
    puppet.state.turn = 1;
    puppet.beginTurn();
    puppet.state.isBreak = false;
    const cue = puppet.balls.find(b => b.id === 0)!;
    const object = puppet.balls.find(b => b.id === 1)!;
    const angle = Math.atan2(object.y - cue.y, object.x - cue.x);
    puppet.shoot({ angle, power: 0.9, side: 1, vert: 0, call: null, pushOut: false });
    settle(puppet);
    expect(puppet.lastRes?.foul).toBeNull();
    expect(puppet.state.turn).toBe(0);
    expect(puppet.puppeteer).toBeNull();
  });

  it('silk bends a moving ball and quake rests after its time window', () => {
    const table = new Match({ mode: 'eight', raceTo: 1, mutator: null, tableSkin: TABLES[0], seed: 7, players: players() }).table;
    const base = [makeBall(0, -0.3, 0)];
    const silk = buildCast('silk', 5, 0, { table, balls: base, cueId: 0, cast: { point: { x: 0, y: 0 }, direction: { x: 1, y: 0 } } });
    expect(silk.terrain.vortices).toHaveLength(3);
    const w: SimWorld = { table, balls: base, params: DEFAULT_PHYS, terrain: silk.terrain };
    base[0].vx = 1;
    for (let i = 0; i < 100; i++) step(w, 1 / 60, null);
    expect(base[0].y).not.toBe(0);

    const quakeBalls = [makeBall(0, -0.3, 0), makeBall(1, 0.3, 0)];
    const quake = buildCast('quake', 7, 2, { table, balls: quakeBalls, cueId: 0, cast: { point: { x: 0, y: 0 }, direction: { x: 1, y: 0 } } });
    const q: SimWorld = { table, balls: quakeBalls, params: DEFAULT_PHYS, terrain: quake.terrain, time: 0 };
    for (let i = 0; i < 30; i++) step(q, 1 / 60, null);
    expect(quakeBalls[0].x).toBeGreaterThan(-0.31);
    for (let i = 0; i < 300; i++) step(q, 1 / 60, null);
    expect(quakeBalls.every(b => b.vx === 0 && b.vy === 0)).toBe(true);
  });
});

it('AI plans with every new family on pool and carom', () => {
  const kinds: SkillKind[] = ['blind', 'drift', 'called', 'displace', 'swap', 'decoy', 'counter', 'puppet', 'silk', 'quake'];
  for (const mode of ['eight', 'carom-libre'] as const) {
    for (const kind of kinds) {
      const m = new Match({ mode, raceTo: 1, mutator: null, tableSkin: TABLES[0], seed: 7, players: players() });
      const req: AiRequest = {
        balls: m.aiView().balls, state: m.state, side: 0, profile: { level: 2, personality: 'balanced' }, maxSpeed: 5,
        ballInHand: 'none', closedPockets: [], params: m.params, terrain: null, extraSegments: [], captureScale: 1,
        seed: 5, option: false, pushOutAvailable: false, energy: 100, blind: true, calledBall: 1, driftAngle: 1,
        skills: [{ slot: 0, kind, ultimate: false, tier: 5, kinds: [kind] }],
      };
      expect(think(req).shot, `${mode}/${kind}`).not.toBeNull();
    }
  }
});
