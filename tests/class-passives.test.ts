import { describe, expect, it } from 'vitest';
import { Match } from '../src/game/match';
import { CUES, TABLES } from '../src/game/content/gear';
import { CHAMPIONS, type ClassId } from '../src/game/content/sects';

function make(cls: ClassId, classic = false) {
  const id = CHAMPIONS.find(c => c.cls === cls)!.id;
  return new Match({ mode: 'carom-libre', raceTo: 1, tableSkin: TABLES[0], mutator: null, classic, seed: 42,
    players: [0, 1].map(() => ({ name: id, kind: 'human', cue: CUES[0], champion: id })) as Match['setup']['players'] });
}

describe('class choices are physical and scoped', () => {
  it('locks direction while updating its deviation band across power and releases on direction change', () => {
    const m = make('thanxa');
    expect(m.lockAim(0.3, 0.004)).toBe(true);
    expect(m.aimBand(0.3, 0.02)).toBe(0.02);
    expect(m.aimBand(0.3, 0.001)).toBe(0.001);
    expect(m.aimLock?.angle).toBe(0.3);
    expect(m.aimBand(0.31, 0.02)).toBe(0.02);
    expect(m.aimLock).toBeNull();
  });
  it('trades spin reach for power and lets the mage choose its stronger axis', () => {
    const plain = make('thanxa');
    const fighter = make('cuongchien');
    expect(fighter.vmax()).toBeGreaterThan(plain.vmax());
    expect(fighter.spinReach().side).toBeLessThan(plain.spinReach().side);
    const mage = make('phaptu');
    expect(mage.spinReach().side).toBeGreaterThan(mage.spinReach().vert);
    expect(mage.choosePassive('vert')).toBe(true);
    expect(mage.spinReach().vert).toBeGreaterThan(mage.spinReach().side);
  });
  it('allows one soft rail per visit without forgiving fouls', () => {
    const m = make('hophap');
    expect(m.shield[0]).toBe(false);
    expect(m.useGuard()).toBe(true);
    expect(m.useGuard()).toBe(false);
    expect(m.terrain().rails![0].multiplier).toBeLessThan(1);
  });
  it('reduces recharge only when alternating basic slots', () => {
    const m = make('luanhoi');
    expect(m.useSkill(0, 0)).toBe(true);
    expect(m.cooldown[0][0]).toBe(m.skills(0)[0].cooldown);
    expect(m.useSkill(0, 1)).toBe(true);
    expect(m.cooldown[0][1]).toBe(Math.max(1, m.skills(0)[1].cooldown - 1));
  });
  it('lays sand only after a legal defensive turn and grants assassin choices after consecutive scores', () => {
    const sand = make('chusu');
    // Controlled rule resolutions isolate visit transitions from shot-search luck.
    const res = { foul: null, keepTurn: false, ballInHand: 'none' as const, respot: [], winner: null, messages: [], points: 0 };
    Object.defineProperty(sand, 'rules', { value: { ...sand.rules, resolve: () => ({ ...res }) } });
    sand.shoot({ angle: 0, power: 0, side: 0, vert: 0, call: null, pushOut: false });
    for (let i = 0; i < 3000 && sand.phase === 'rolling'; i++) sand.update(1 / 30);
    expect(sand.turn).toBe(1);
    expect(sand.activeEffects.some(e => e.kind === 'sand' && e.target === 1)).toBe(true);
    const assassin = make('anhsat');
    Object.defineProperty(assassin, 'rules', { value: { ...assassin.rules, resolve: () => ({ ...res, keepTurn: true, points: 1 }) } });
    for (let shot = 0; shot < 2; shot++) {
      assassin.shoot({ angle: 0, power: 0, side: 0, vert: 0, call: null, pushOut: false });
      for (let i = 0; i < 3000 && assassin.phase === 'rolling'; i++) assassin.update(1 / 30);
      expect(assassin.assassinReady[0]).toBe(shot === 1);
    }
    expect(assassin.choosePassive('info')).toBe(true);
    expect(assassin.passiveInfo).toBe(true);
    const speed = assassin.vmax();
    expect(assassin.choosePassive('power')).toBe(true);
    expect(assassin.passiveInfo).toBe(false);
    expect(assassin.vmax()).toBeGreaterThan(speed);
  });
  it('excludes every class choice from classic billiards', () => {
    expect(make('thanxa', true).lockAim(0, 0.1)).toBe(false);
    expect(make('hophap', true).useGuard()).toBe(false);
    expect(make('phaptu', true).choosePassive('vert')).toBe(false);
  });
});
