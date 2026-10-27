import { expect, it } from 'vitest';
import { think } from '../src/ai/brain';
import type { AiRequest } from '../src/ai/types';
import { DEFAULT_PHYS, makeBall } from '../src/core/physics';
import { newGameState } from '../src/core/rules/types';
import { Match } from '../src/game/match';
import { CUES, TABLES } from '../src/game/content/gear';
import { CHAMPIONS } from '../src/game/content/sects';

it('uses basic skills and ultimates across seeded AI 8-ball racks', () => {
  const started = performance.now();
  let uses = 0;
  let ultimates = 0;
  const racks = 3;
  for (let g = 0; g < racks; g++) {
    const m = new Match({
      mode: 'eight', raceTo: 1, mutator: null, tableSkin: TABLES[0], seed: 100 + g,
      firstBreaker: (g % 2) as 0 | 1,
      players: ['tokiemnhi', 'haclang'].map((id) => ({
        name: id, kind: 'ai', ai: { level: 2, personality: 'balanced' }, cue: CUES[0], champion: id,
      })) as Match['setup']['players'],
    });
    m.on((e) => {
      if (e.type === 'skill') {
        uses++;
        if (e.slot === 2) ultimates++;
      }
    });
    let shots = 0;
    while (m.phase !== 'match-over' && shots++ < 150) {
      const side = m.turn;
      const v = m.aiView();
      const request: AiRequest = {
        ...v, side, profile: m.current.ai!, maxSpeed: m.vmax(side),
        ballInHand: m.placing === 'nudge' ? 'none' : m.placing,
        params: m.params, terrain: m.omen?.terrain ?? null,
        extraSegments: m.omen?.segments ?? [], captureScale: m.omen?.capture ?? 1,
        seed: shots * 31 + g, option: m.phase === 'option',
        pushOutAvailable: m.state.pushOutAvailable, energy: m.energy[side],
        skills: m.skills(side).filter((s) => m.canUseSkill(side, s.slot)).map((s) => ({
          slot: s.slot, kind: m.effectiveKind(s.kinds[0]), ultimate: s.slot === 2,
          tier: s.tier,
        })),
      };
      const d = think(request);
      if (m.phase === 'option') {
        m.chooseOption(d.option ?? 'play');
        continue;
      }
      if (d.skill !== undefined) expect(m.useSkill(side, d.skill)).toBe(true);
      expect(d.shot).not.toBeNull();
      if (d.shot!.cue) m.placeCue(d.shot!.cue.x, d.shot!.cue.y);
      m.shoot(d.shot!);
      let frames = 0;
      while (m.phase === 'rolling' && frames++ < 1800) m.update(1 / 30);
      expect(m.phase).not.toBe('rolling');
    }
    expect(m.phase).toBe('match-over');
  }
  const average = uses / racks;
  console.info(`Skill usage: ${average.toFixed(2)} per rack; ${ultimates} ultimates; ${Math.round(performance.now() - started)} ms`);
  expect(average).toBeGreaterThanOrEqual(3);
  expect(average).toBeLessThanOrEqual(10);
  expect(ultimates).toBeGreaterThan(0);
}, 20_000);

it('charges every shot, awards 12 on a foul, and reports capped gains', () => {
  const m = new Match({
    mode: 'eight', raceTo: 1, mutator: null, tableSkin: TABLES[0], seed: 42,
    players: [
      { name: 'A', kind: 'human', cue: CUES[0], champion: 'tokiemnhi' },
      { name: 'B', kind: 'human', cue: CUES[0], champion: 'haclang' },
    ],
  });
  expect(m.energy).toEqual([30, 30]);
  m.energy = [97, 50];
  m.shield = [false, false];
  const gains: { side: number; gain: number; total: number }[] = [];
  m.on((e) => { if (e.type === 'energy') gains.push(e); });
  // Shoot away from the rack: no contact is a foul, but still charges the shooter.
  m.shoot({ angle: Math.PI, power: 0.03, side: 0, vert: 0, call: null, pushOut: false });
  for (let i = 0; m.phase === 'rolling' && i < 1800; i++) m.update(1 / 30);
  expect(m.lastRes?.foul).toBeTruthy();
  expect(m.energy).toEqual([100, 62]);
  expect(gains).toEqual([
    { type: 'energy', side: 0, gain: 3, total: 100 },
    { type: 'energy', side: 1, gain: 12, total: 62 },
  ]);
});

it('keeps basic cooldowns at 2–3 own shots, with the Luan Hoi reduction', () => {
  for (const c of CHAMPIONS) {
    for (const s of c.skills.slice(0, 2)) {
      expect(s.cooldown).toBeGreaterThanOrEqual(c.cls === 'luanhoi' ? 1 : 2);
      expect(s.cooldown).toBeLessThanOrEqual(c.cls === 'luanhoi' ? 2 : 3);
    }
  }
});

it('prioritizes a ready placement ultimate and returns a legal cue position', () => {
  const state = newGameState('nine', 0);
  state.isBreak = false;
  const m = new Match({
    mode: 'nine', raceTo: 1, mutator: null, tableSkin: TABLES[0], seed: 42,
    layout: [makeBall(0, -0.3, 0.1), makeBall(1, 0.5, -0.3), makeBall(9, 0.2, 0.3)],
    players: [
      { name: 'A', kind: 'ai', cue: CUES[0], champion: 'vodienkhach' },
      { name: 'B', kind: 'ai', cue: CUES[0], champion: 'haclang' },
    ],
  });
  m.energy[0] = 100;
  const d = think({
    balls: m.aiView().balls, state, side: 0, profile: { level: 1, personality: 'balanced' },
    maxSpeed: m.vmax(0), ballInHand: 'none', closedPockets: [], params: DEFAULT_PHYS,
    terrain: null, extraSegments: [], captureScale: 1, seed: 3, option: false,
    pushOutAvailable: false, energy: 100,
    skills: [
      { slot: 0, kind: 'teleport', ultimate: false },
      { slot: 2, kind: 'teleport', ultimate: true },
    ],
  });
  expect(d.skill).toBe(2);
  expect(d.shot?.cue).toBeDefined();
  expect(m.useSkill(0, d.skill!)).toBe(true);
  expect(m.canPlace(d.shot!.cue!.x, d.shot!.cue!.y)).toBe(true);
});
