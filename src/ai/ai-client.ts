import type { AiDecision, AiRequest } from './types';

/** Runs the AI off the main thread so aiming animations never stutter. */
export class AiClient {
  private worker = this.spawn();
  private seq = 0;
  private pending = new Map<number, (d: AiDecision) => void>();

  private spawn(): Worker {
    const worker = new Worker(new URL('./ai-worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<{ id: number; decision: AiDecision }>) => {
      const cb = this.pending.get(e.data.id);
      this.pending.delete(e.data.id);
      cb?.(e.data.decision);
    };
    return worker;
  }

  think(req: AiRequest): Promise<AiDecision> {
    const id = ++this.seq;
    return new Promise((resolve) => {
      this.pending.set(id, resolve);
      this.worker.postMessage({ id, req });
    });
  }

  /**
   * Drop answers for requests made before (e.g. after leaving a match). A search still running
   * would keep a core busy for seconds, so its worker is replaced rather than left to finish.
   */
  cancelAll() {
    if (!this.pending.size) return;
    this.pending.clear();
    this.worker.terminate();
    this.worker = this.spawn();
  }
}
