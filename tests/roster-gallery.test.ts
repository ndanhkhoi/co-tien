import { describe, expect, it } from 'vitest';
import roster from '../src/game/content/roster.json';

describe('champion gallery briefs', () => {
  it('gives each of the 65 champions exactly 4 gallery entries', () => {
    expect(roster.champions).toHaveLength(65);
    for (const c of roster.champions) {
      expect(c, `Champion ${c.id} missing gallery`).toHaveProperty('gallery');
      const g = (c as unknown as { gallery: Array<{ label: string; pose: string }> }).gallery;
      expect(g, `${c.id} must have exactly 4 gallery entries`).toHaveLength(4);
    }
  });

  it('ensures each gallery label is non-empty, <= 14 chars, and unique per champion', () => {
    const forbidden = new Set(['toàn thân', 'thắng', 'kết liễu']);

    for (const c of roster.champions) {
      const g = (c as unknown as { gallery: Array<{ label: string; pose: string }> }).gallery;
      const labels = new Set<string>();

      for (const item of g) {
        const label = item.label.trim();
        expect(label.length, `${c.id} has empty label`).toBeGreaterThan(0);
        expect(label.length, `${c.id} label '${label}' exceeds 14 characters`).toBeLessThanOrEqual(14);
        expect(forbidden.has(label.toLowerCase()), `${c.id} label '${label}' cannot be a standard mode name`).toBe(false);

        const words = label.split(/\s+/);
        expect(words.length, `${c.id} label '${label}' must have 2-4 words`).toBeGreaterThanOrEqual(2);
        expect(words.length, `${c.id} label '${label}' must have 2-4 words`).toBeLessThanOrEqual(4);

        expect(labels.has(label), `${c.id} duplicate label: '${label}'`).toBe(false);
        labels.add(label);
      }
    }
  });

  it('ensures every pose is non-empty and unique across the entire roster', () => {
    const allPoses = new Set<string>();

    for (const c of roster.champions) {
      const g = (c as unknown as { gallery: Array<{ label: string; pose: string }> }).gallery;
      for (const item of g) {
        const pose = item.pose.trim();
        expect(pose.length, `${c.id} has empty pose`).toBeGreaterThan(0);
        expect(allPoses.has(pose), `Duplicate pose found: '${pose}'`).toBe(false);
        allPoses.add(pose);
      }
    }

    expect(allPoses.size).toBe(260);
  });
  it('uses the pronouns of the champion the look describes', () => {
    // The look names who the champion is; a pose brief saying "his" for a woman paints the wrong person.
    const woman = /\b(woman|girl|queen|lady|mistress|maiden|priestess|granny|ferrywoman|huntress)\b|\b(she|her)\b/i;
    const man = /\b(man|boy|king|lord|monk|priest|wolfman|old man)\b|\b(he|his|him)\b/i;
    for (const c of roster.champions as Array<{ id: string; look: string; gallery: Array<{ pose: string }> }>) {
      const isWoman = woman.test(c.look) && !/\b(man|boy|priest|monk)\b/i.test(c.look.split(',')[0]);
      const isMan = !isWoman && man.test(c.look);
      const poses = c.gallery.map((g) => g.pose).join(' ');
      if (isWoman) expect(/\b(his|him|he)\b/.test(poses), `${c.id} is a woman but a brief says he/his`).toBe(false);
      if (isMan) expect(/\b(her|she)\b/.test(poses), `${c.id} is a man but a brief says she/her`).toBe(false);
    }
  });
});
