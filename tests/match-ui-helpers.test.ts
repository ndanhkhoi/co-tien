import { describe, expect, it } from 'vitest';
import type { Side } from '../src/core/rules/types';
import {
  controllerIsHuman, controllerPlayer, puppetHeraldLine, shotController,
} from '../src/game/match/controller';
import { hexChips } from '../src/ui/screens/match/hex-chips';

function matchWith(puppeteer: Side | null, kinds: ['human' | 'ai', 'human' | 'ai'] = ['human', 'ai']) {
  return {
    turn: 1 as Side,
    puppeteer,
    setup: {
      players: [
        { kind: kinds[0], name: 'Nguyệt Hà' },
        { kind: kinds[1], name: 'Tần Lãng' },
      ],
    },
  } as never;
}

describe('puppet controller', () => {
  it('uses the caster while puppet is armed, then returns to the turn owner', () => {
    const puppeted = matchWith(0);
    expect(shotController(puppeted)).toBe(0);
    expect(controllerPlayer(puppeted).name).toBe('Nguyệt Hà');
    expect(controllerIsHuman(puppeted)).toBe(true);

    const normal = matchWith(null);
    expect(shotController(normal)).toBe(1);
    expect(controllerIsHuman(normal)).toBe(false);
  });

  it('keeps a human recipient locked out when the AI casts puppet', () => {
    const m = matchWith(0, ['ai', 'human']);
    expect(shotController(m)).toBe(0);
    expect(controllerIsHuman(m)).toBe(false);
    expect(puppetHeraldLine(m)).toBe('Khuynh thành: Nguyệt Hà đánh hộ Tần Lãng cú này');
  });
});

describe('hex chips', () => {
  it('lists persistent hexes, placed effects and the called ball with shots left', () => {
    const [left, right] = hexChips({
      hexes: [
        { kind: 'chill', target: 0, shotsLeft: 2 },
        { kind: 'drift', target: 1, shotsLeft: 1 },
        { kind: 'seal', target: 1, shotsLeft: 3 },
      ],
      activeEffects: [
        { kind: 'decoy', target: 1, shotsLeft: 2 },
        { kind: 'counter', target: 0, shotsLeft: 1 },
      ],
      called: { by: 0, ball: 5, shotsLeft: 2 },
    } as never);
    expect(left.map((x) => [x.label, x.shotsLeft])).toEqual([
      ['Run tay', 2], ['Một chiêu đang úp', 1], ['Bi 5 chỉ định', 2],
    ]);
    expect(right.map((x) => [x.label, x.shotsLeft])).toEqual([
      ['Dắt lệch', 1], ['Phong lỗ', 3], ['Bi giả', 2],
    ]);
  });

  it('shows no chip when that side has no live effect', () => {
    expect(hexChips({ hexes: [{ kind: 'blind', target: 1, shotsLeft: 1 }] } as never)[0]).toEqual([]);
  });
});
