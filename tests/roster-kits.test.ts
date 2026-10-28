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
  it('carries each signature on at least three champions and gives every sect its own ultimate', () => {
    for (const sect of roster.sects) {
      const champions = roster.champions.filter(c => c.sect === sect.id);
      expect(champions).toHaveLength(5);
      expect(champions.filter(c => c.skills.some(s => s.kinds.includes(sect.signature))).length).toBeGreaterThanOrEqual(3);
      const master = CHAMPIONS.find(c => c.sect === sect.id && c.tier === 5)!;
      expect(master.skills[2].ult).toBe(sect.id);
      for (const champion of champions) expect(champion.skills).toHaveLength(3);
    }
  });
});

it('casts every champion slot with a real effect on a carom table', () => {
  for (const champion of CHAMPIONS) for (const slot of [0, 1, 2]) {
    const m = new Match({ mode: 'carom-libre', raceTo: 1, mutator: null, tableSkin: TABLES[0], seed: 42,
      players: [0, 1].map(() => ({name: champion.name, kind: 'human', cue: CUES[0], champion: champion.id})) as Match['setup']['players'] });
    m.energy[0] = 100;
    const state = () => JSON.stringify({ world: m.simulationWorld(), blast: m.blast, eagle: m.eagle, reveal: m.reveal,
      power: m.vmax(), spin: m.spinReach(), placing: m.placing, second: m.secondChance, tremor: m.tremor, shield: m.shield });
    const before = state();
    expect(m.useSkill(0, slot), `${champion.id}/${slot}`).toBe(true);
    expect(state(), `${champion.id}/${slot} must change simulation or shot information`).not.toBe(before);
  }
});
