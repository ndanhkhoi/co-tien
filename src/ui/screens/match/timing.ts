import type { MatchCtx } from './context';

export type Sleep = (ms: number) => Promise<void>;

export function createTiming(ctx: MatchCtx): { sleep: Sleep; animate(ms: number, fn: (k: number) => void, ease?: (k: number) => number): Promise<void> } {
  const sleep = (ms: number) => new Promise<void>((resolve) => {
    let passed = 0;
    let last = performance.now();
    const step = () => {
      const now = performance.now();
      if (!ctx.flags.paused) passed += now - last;
      last = now;
      if (ctx.flags.disposed || passed >= ms) resolve();
      else requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
  const animate = (ms: number, fn: (k: number) => void, ease = (k: number) => k * k * (3 - 2 * k)) => new Promise<void>((resolve) => {
    let passed = 0;
    let last = performance.now();
    const step = () => {
      if (ctx.flags.disposed) return resolve();
      const now = performance.now();
      if (!ctx.flags.paused) passed += now - last;
      last = now;
      const k = Math.min(1, passed / ms);
      fn(ease(k));
      if (k < 1) requestAnimationFrame(step);
      else resolve();
    };
    requestAnimationFrame(step);
  });
  return { sleep, animate };
}
