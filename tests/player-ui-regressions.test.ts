import { describe, expect, it } from 'vitest';
import type { SectId } from '../src/game/content/sects';
import { finisherDuration, journeyFocus } from '../src/ui/player-focus';

describe('finisher timing', () => {
  it('keeps the champion and verdict readable before fading', () => {
    expect(finisherDuration(false)).toBe(2900);
    expect(finisherDuration(true)).toBe(1800);
  });
});

describe('journey focus', () => {
  const lands = [
    { id: 'thienquang' as SectId, open: true, beaten: true },
    { id: 'hoalinh' as SectId, open: true, beaten: false },
    { id: 'hailong' as SectId, open: false, beaten: false },
  ];

  it('keeps a returning duel on the land just played', () => {
    expect(journeyFocus('hailong', lands)).toBe('hailong');
  });

  it('opens the first unfinished land when entering from home', () => {
    expect(journeyFocus(undefined, lands)).toBe('hoalinh');
  });
});
