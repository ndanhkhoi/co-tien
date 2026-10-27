import type { AiDecision, AiRequest } from './types';

/** Runs the AI off the main thread so aiming animations never stutter. */
export class AiClient {
  private worker: Worker;
  private seq = 0;
  private pending = new Map<number, (d: AiDecision) => void>();

  constructor() {
    this.worker = new Worker(new URL('./ai-worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = (e: MessageEvent<{ id: number; decision: AiDecision }>) => {
      const cb = this.pending.get(e.data.id);
      this.pending.delete(e.data.id);
      cb?.(e.data.decision);
    };
  }

  think(req: AiRequest): Promise<AiDecision> {
    const id = ++this.seq;
    return new Promise((resolve) => {
      this.pending.set(id, resolve);
      this.worker.postMessage({ id, req });
    });
  }

  /** Drop answers for requests made before (e.g. after leaving a match). */
  cancelAll() {
    this.pending.clear();
  }
}
