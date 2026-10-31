import { describe, expect, it } from 'vitest';
import { CHAMPIONS } from '../src/game/content/sects';
import { skillUsage } from '../src/game/content/skill-usage';

describe('skill usage text', () => {
  it('tells how to use every skill of every champion', () => {
    for (const c of CHAMPIONS) for (const sk of c.skills) expect(skillUsage(sk), `${c.id}/${sk.slot}`).not.toBe('');
  });
  it('tells a called-ball skill that the game picks the ball', () => {
    expect(skillUsage({ kinds: ['called', 'blind'] })).toContain('tự chỉ định');
  });
  it('applies own-shot buffs of a rewind package to the replayed shot', () => {
    const text = skillUsage({ kinds: ['rewind', 'power'] });
    expect(text).toContain('đánh lại');
    expect(text).not.toContain('trước khi đánh');
  });
});
