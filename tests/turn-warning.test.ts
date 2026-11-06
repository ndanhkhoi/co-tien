import { describe, expect, it } from 'vitest';
import { makeBall } from '../src/core/physics';
import { CUES, TABLES } from '../src/game/content/gear';
import { Match } from '../src/game/match';
import { turnWarnings, warnBeforeAim } from '../src/ui/screens/match/turn-warning';
import type { MatchCtx } from '../src/ui/screens/match/context';
import type { HeraldMsg } from '../src/ui/screens/match/herald';

function match(mode: Match['setup']['mode'] = 'eight'): Match {
  const m = new Match({ mode, raceTo: 1, tableSkin: TABLES[0], seed: 3, mutator: null, firstBreaker: 0,
    players: [
      { name: 'Bạn', kind: 'human', champion: 'tokiemnhi', cue: CUES[0] },
      { name: 'Đối thủ', kind: 'human', champion: 'ngancam', cue: CUES[0] },
    ], layout: [makeBall(0, -0.7, 0), makeBall(1, 0, 0.1), makeBall(9, 0.5, -0.2)] });
  m.state.isBreak = false;
  m.state.turn = 0;
  m.placing = 'none';
  m.beginTurn();
  return m;
}

function ctx(m: Match): MatchCtx {
  return { match: m, hasSkills: true } as MatchCtx;
}

function field(m: Match, kind: 'silk' | 'sand' | 'counter', target: 0 | 1 | 'both') {
  m.activeEffects.push({ kind, target, slot: 2, shotsLeft: 2, cast: {}, terrain: {}, segments: [] });
}

describe('warnings before aiming', () => {
  it('states every aiming constraint before any ball starts rolling', () => {
    const m = match();
    m.hexes.push(
      { kind: 'chill', by: 1, target: 0, value: 1.8, shotsLeft: 2 },
      { kind: 'drift', by: 1, target: 0, value: 2.5, sense: 'ccw', shotsLeft: 2 },
      { kind: 'blind', by: 1, target: 0, value: 1, shotsLeft: 1 },
      { kind: 'freeze', by: 1, target: 0, value: 0.7, shotsLeft: 1 },
    );
    m.beginTurn();
    m.calledNow = 9;
    m.closedPockets = [0, 2];
    expect(m.phase).toBe('aim');
    expect(turnWarnings(m, 0)).toEqual([
      'run tay ×1,8', 'hướng đánh lệch 2,5° ngược chiều kim đồng hồ', 'mất đường ngắm',
      'lực tối đa 70%', '2 lỗ bị phong', 'phải chạm bi 9 trước',
    ]);
    expect(turnWarnings(m, 1)).toEqual([]);
  });

  for (const mode of ['eight', 'nine', 'ten', 'carom-libre', 'carom-3c'] as const) {
    it(`warns immediately when Ngân Cầm changes the shot while aiming in ${mode}`, () => {
      const m = match(mode);
      expect(turnWarnings(m, 0)).toEqual([]);
      const messages: HeraldMsg[] = [];
      m.on((event) => {
        if (event.type === 'skill') warnBeforeAim(ctx(m), (message) => messages.push(message));
      });
      expect(m.useSkill(1, 1, { sense: 'ccw' })).toBe(true);
      expect(messages).toHaveLength(1);
      expect(messages[0]).toMatchObject({ immediate: true, important: true, tone: 'red' });
      expect(messages[0].line).toContain('ngược chiều kim đồng hồ');
      expect(m.phase).toBe('aim');
      expect(m.balls.every((ball) => ball.vx === 0 && ball.vy === 0)).toBe(true);
    });
  }

  it('includes shared fields, excludes the other shot and never reveals a face-down counter', () => {
    const m = match();
    field(m, 'silk', 'both');
    field(m, 'silk', 0);
    field(m, 'sand', 1);
    field(m, 'counter', 1);
    expect(turnWarnings(m, 0)).toEqual(['dải lụa trên bàn']);
  });

  it('warns the human controlling a puppeted shot about the actual shooter’s effects', () => {
    const m = match();
    m.setup.players[0].kind = 'ai';
    m.puppeteer = 1;
    m.blindNow = true;
    const messages: HeraldMsg[] = [];
    expect(warnBeforeAim(ctx(m), (message) => messages.push(message))).toBe(true);
    expect(messages[0].line).toBe('Mất đường ngắm');
  });

  it('does not warn a clean turn, an AI turn, rolling balls or a classic match', () => {
    const m = match();
    const messages: HeraldMsg[] = [];
    const send = (message: HeraldMsg) => messages.push(message);
    expect(warnBeforeAim(ctx(m), send)).toBe(false);
    m.blindNow = true;
    m.setup.players[0].kind = 'ai';
    expect(warnBeforeAim(ctx(m), send)).toBe(false);
    m.setup.players[0].kind = 'human';
    m.phase = 'rolling';
    expect(warnBeforeAim(ctx(m), send)).toBe(false);
    m.phase = 'aim';
    expect(warnBeforeAim({ ...ctx(m), hasSkills: false }, send)).toBe(false);
    expect(messages).toEqual([]);
  });
});
