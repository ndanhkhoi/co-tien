import { think } from './brain';
import type { AiRequest } from './types';

self.onmessage = (e: MessageEvent<{ id: number; req: AiRequest }>) => {
  const { id, req } = e.data;
  const decision = think(req);
  (self as unknown as Worker).postMessage({ id, decision });
};
