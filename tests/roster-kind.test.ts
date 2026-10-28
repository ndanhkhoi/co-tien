import { describe, expect, it } from 'vitest';
import roster from '../src/game/content/roster.json';
import { CHAMPIONS } from '../src/game/content/sects';

describe('champion kind', () => {
  it.each(roster.champions)('$id has a valid kind that survives loading', (raw) => {
    expect(['hiepkhach', 'nuhiep', 'yeu', 'linh', 'co', 'ma']).toContain(raw.kind);
    expect(CHAMPIONS.find((c) => c.id === raw.id)?.kind).toBe(raw.kind);
  });
});
