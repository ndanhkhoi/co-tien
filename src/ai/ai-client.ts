import type { AiDecision, AiRequest } from './types';

interface Pending {
  req: AiRequest;
  resolve: (d: AiDecision) => void;
}

/** Runs the AI off the main thread so aiming animations never stutter. */
export class AiClient {
  private worker: Worker | null = this.spawn();
  private seq = 0;
  private pending = new Map<number, Pending>();

  private spawn(): Worker {
    const worker = new Worker(new URL('./ai-worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<{ id: number; decision: AiDecision }>) => {
      const p = this.pending.get(e.data.id);
      this.pending.delete(e.data.id);
      p?.resolve(e.data.decision);
    };
    worker.onerror = (e) => {
      e.preventDefault();
      void this.recover(worker);
    };
    worker.onmessageerror = () => void this.recover(worker);
    return worker;
  }

  /**
   * A worker that fails to load (say a stale chunk after an update) or throws would leave every
   * turn waiting forever. A fresh one would most likely fail the same way, so the AI moves to the
   * main thread for the rest of the session and answers the open requests there.
   */
  private async recover(failed: Worker) {
    if (failed !== this.worker) return;
    failed.terminate();
    this.worker = null;
    const open = [...this.pending.values()];
    this.pending.clear();
    for (const p of open) p.resolve(await thinkHere(p.req));
  }

  think(req: AiRequest): Promise<AiDecision> {
    const worker = this.worker;
    if (!worker) return thinkHere(req);
    const id = ++this.seq;
    return new Promise((resolve) => {
      this.pending.set(id, { req, resolve });
      worker.postMessage({ id, req });
    });
  }

  /**
   * Drop answers for requests made before (e.g. after leaving a match). A search still running
   * would keep a core busy for seconds, so its worker is replaced rather than left to finish.
   */
  cancelAll() {
    if (!this.pending.size) return;
    this.pending.clear();
    if (!this.worker) return;
    this.worker.terminate();
    this.worker = this.spawn();
  }
}

async function thinkHere(req: AiRequest): Promise<AiDecision> {
  const { think } = await import('./brain');
  return think(req);
}
