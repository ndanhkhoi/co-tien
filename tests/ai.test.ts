import { describe, expect, it } from 'vitest';
import { think } from '../src/ai/brain';
import type { AiRequest } from '../src/ai/types';
import { maxSpeed } from '../src/core/cue-power';
import { DEFAULT_PHYS, makeBall } from '../src/core/physics';
import { newGameState } from '../src/core/rules/types';
import { Match } from '../src/game/match';
import { CUES, TABLES } from '../src/game/content/gear';

function req(over: Partial<AiRequest>): AiRequest {
  return {
    balls: [], state: newGameState('nine', 0), side: 0, profile: { level: 4, personality: 'balanced' },
    maxSpeed: maxSpeed('pool', 3), ballInHand: 'none', closedPockets: [], params: DEFAULT_PHYS, terrain: null, extraSegments: [], captureScale: 1, seed: 1, option: false,
    pushOutAvailable: false, energy: 0, skills: [], ...over,
  };
}

function playShot(m: Match, d: ReturnType<typeof think>): void {
  if (d.shot!.cue) m.placeCue(d.shot!.cue.x, d.shot!.cue.y);
  m.shoot(d.shot!);
  let t = 0;
  while (m.phase === 'rolling' && t < 60) {
    m.update(1 / 30);
    t += 1 / 30;
  }
}


function shortAngle(a: number, b: number): number {
  return Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
}

describe('AI', () => {
  it('finds and makes an easy pot', () => {
    const state = newGameState('nine', 0);
    state.isBreak = false;
    const balls = [makeBall(0, -0.3, 0.1), makeBall(1, 0.5, -0.3), makeBall(9, 0.2, 0.3)];
    const t0 = performance.now();
    const d = think(req({ balls, state }));
    const ms = performance.now() - t0;
    expect(d.shot).not.toBeNull();
    expect(d.confidence).toBeGreaterThan(0.3);
    expect(ms).toBeLessThan(4000);
  });

  it("ranks a puppet shot by the caster's next table ease", () => {
    const state = newGameState('nine', 0);
    state.isBreak = false;
    state.groups = ['solid', 'stripe'];
    const balls = [makeBall(0, -0.4, 0), makeBall(1, 0.5, -0.28), makeBall(9, 0.2, 0.3)];
    const forced = think(req({ balls, state, side: 1, benefitingSide: 0 }));
    expect(forced.shot).not.toBeNull();
    expect(forced.skill).toBeUndefined();
    // The shot remains planned from the recipient's cue ball, not an invented caster cue.
    const aim = Math.atan2(balls[1].y - balls[0].y, balls[1].x - balls[0].x);
    expect(shortAngle(forced.shot!.angle, aim)).toBeLessThan(0.1);
  });

  it('a level-4 AI wins most 9-ball racks against a level-1 AI', () => {
    let wins = 0;
    const games = 4;
    for (let g = 0; g < games; g++) {
      const m = new Match({
        mode: 'nine', raceTo: 1, mutator: null, tableSkin: TABLES[0], classic: true, seed: 100 + g, firstBreaker: (g % 2) as 0 | 1,
        players: [
          { name: 'A', kind: 'ai', ai: { level: 4, personality: 'balanced' }, cue: CUES[0], champion: 'tokiemnhi' },
          { name: 'B', kind: 'ai', ai: { level: 1, personality: 'balanced' }, cue: CUES[0], champion: 'haclang' },
        ],
      });
      let guard = 0;
      while (m.phase !== 'match-over' && guard++ < 200) {
        const side = m.turn;
        const p = m.setup.players[side];
        const view = m.aiView();
        const d = think(req({
          balls: view.balls, state: view.state, side, profile: p.ai!, maxSpeed: m.vmax(side),
          ballInHand: m.placing === 'nudge' ? 'none' : m.placing, closedPockets: view.closedPockets,
          option: m.phase === 'option', pushOutAvailable: m.state.pushOutAvailable, seed: guard * 31 + g,
        }));
        if (m.phase === 'option') {
          m.chooseOption(d.option ?? 'play');
          continue;
        }
        playShot(m, d);
      }
      expect(m.phase).toBe('match-over');
      if (m.rackWins[0] > m.rackWins[1]) wins++;
    }
    expect(wins).toBeGreaterThanOrEqual(3);
  }, 240_000);
});
