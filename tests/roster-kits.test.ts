import { describe, expect, it } from 'vitest';
import roster from '../src/game/content/roster.json';
import { Match } from '../src/game/match';
import { CUES, TABLES } from '../src/game/content/gear';
import { CHAMPIONS } from '../src/game/content/sects';

describe('sect kits', () => {
  it('has 65 distinct sets of kinds, independent of slot order', () => {
    const keys = CHAMPIONS.map(c => [...new Set(c.skills.flatMap(s => s.kinds))].sort().join(','));
    expect(CHAMPIONS).toHaveLength(65);
    expect(new Set(keys).size).toBe(65);
  });
  it('carries each signature on at least three champions', () => {
    for (const sect of roster.sects) {
      const champions = roster.champions.filter(c => c.sect === sect.id);
      expect(champions).toHaveLength(5);
      expect(champions.filter(c => c.skills.some(s => s.kinds.includes(sect.signature))).length).toBeGreaterThanOrEqual(3);
      for (const champion of champions) expect(champion.skills).toHaveLength(3);
    }
  });
  it('gives every ultimate a new mechanism, never one from skill 1', () => {
    for (const champion of CHAMPIONS) {
      const shared = champion.skills[2].kinds.filter(k => champion.skills[0].kinds.includes(k));
      expect(shared, champion.id).toEqual([]);
    }
  });
});

it.each(['eight', 'carom-libre'] as const)('casts every champion slot with a real effect on a %s table', (mode) => {
  for (const champion of CHAMPIONS) for (const slot of [0, 1, 2]) {
    const m = new Match({ mode, raceTo: 1, mutator: null, tableSkin: TABLES[0], seed: 42,
      players: [0, 1].map(() => ({name: champion.name, kind: 'human', cue: CUES[0], champion: champion.id})) as Match['setup']['players'] });
    m.state.isBreak = false;
    if (mode === 'eight') m.state.groups = ['solid', 'stripe'];
    m.energy[0] = 100;
    if (champion.skills[slot].kinds.includes('rewind')) {
      m.snapshot = {
        side: 0, balls: structuredClone(m.balls), state: structuredClone(m.state), energy: [...m.energy] as [number, number],
        rackWins: [0, 0], ballInHand: 'none', closed: [], bombId: 0, bombUsed: false, pushOutAvailable: false,
        potted: [[], []], activeEffects: [], hexes: [], tremorNow: 1, freezeNow: 1, blindNow: false, driftNow: 0, calledNow: null,
      };
      m.lastShooter = 0;
      m.state.turn = 1;
    }
    const state = () => JSON.stringify({ world: m.simulationWorld(), blast: m.blast, eagle: m.eagle, reveal: m.reveal,
      power: m.vmax(), spin: m.spinReach(), placing: m.placing, second: m.secondChance, tremor: m.tremorNow, shield: m.shield,
      hexes: m.hexes, effects: m.activeEffects, puppeteer: m.puppeteer, called: m.called, snapshot: m.snapshot, energy: m.energy });
    const before = state();
    expect(m.useSkill(0, slot), `${champion.id}/${slot}`).toBe(true);
    expect(state(), `${champion.id}/${slot} must change simulation or shot information`).not.toBe(before);
  }
});
