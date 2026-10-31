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
});
