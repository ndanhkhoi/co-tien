import { describe, expect, it } from 'vitest';
import roster from '../src/game/content/roster.json';

describe('champion skill identities', () => {
  const skills = roster.champions.flatMap(champion => champion.skills);

  it('gives all 195 skills unique names', () => {
    expect(skills).toHaveLength(195);
    const names = skills.map(skill => skill.name.normalize('NFC').trim());
    expect(new Set(names).size).toBe(195);
  });

  it('gives all 195 skills unique icon prompts', () => {
    const prompts = skills.map(skill => skill.icon.trim());
    expect(new Set(prompts).size).toBe(195);
  });

  it('uses the same opening word at most twice per sect', () => {
    for (const sect of roster.sects) {
      const counts = new Map<string, number>();
      for (const champion of roster.champions.filter(champion => champion.sect === sect.id)) {
        for (const skill of champion.skills) {
          const first = skill.name.normalize('NFC').trim().split(/\s+/)[0].toLocaleLowerCase('vi');
          counts.set(first, (counts.get(first) ?? 0) + 1);
        }
      }
      for (const [word, count] of counts) {
        expect(count, `${sect.id}: ${word}`).toBeLessThanOrEqual(2);
      }
    }
  });
});
