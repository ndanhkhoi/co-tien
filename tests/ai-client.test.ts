import { afterEach, describe, expect, it, vi } from 'vitest';
import { AiClient } from '../src/ai/ai-client';
import type { AiRequest } from '../src/ai/types';
import { maxSpeed } from '../src/core/cue-power';
import { DEFAULT_PHYS, makeBall } from '../src/core/physics';
import { newGameState } from '../src/core/rules/types';

/** A worker whose script never loads: every message is swallowed and an error event follows. */
class BrokenWorker {
  static made = 0;
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: ((e: { preventDefault(): void }) => void) | null = null;
  onmessageerror: (() => void) | null = null;
  constructor() {
    BrokenWorker.made++;
  }
  postMessage() {
    setTimeout(() => this.onerror?.({ preventDefault() {} }), 0);
  }
  terminate() {}
}

function request(): AiRequest {
  const state = newGameState('nine', 0);
  state.isBreak = false;
  return {
    balls: [makeBall(0, -0.3, 0.1), makeBall(1, 0.5, -0.3), makeBall(9, 0.2, 0.3)], state, side: 0,
    profile: { level: 4, personality: 'balanced' }, maxSpeed: maxSpeed('pool', 3), ballInHand: 'none',
    closedPockets: [], params: DEFAULT_PHYS, terrain: null, extraSegments: [], captureScale: 1, seed: 1,
    option: false, pushOutAvailable: false, energy: 0, skills: [],
  };
}

afterEach(() => vi.unstubAllGlobals());

describe('AiClient', () => {
  it('still answers when the worker fails, and stops spawning broken workers', async () => {
    vi.stubGlobal('Worker', BrokenWorker);
    BrokenWorker.made = 0;
    const ai = new AiClient();
    const first = await ai.think(request());
    expect(first.shot).toBeTruthy();
    const second = await ai.think(request());
    expect(second.shot).toBeTruthy();
    expect(BrokenWorker.made).toBe(1);
  });
});
