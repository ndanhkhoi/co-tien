import { finisherFrameUrl } from '../game/content/sects';
import { hasArt } from '../platform/preload';

/** Frame 6 lands with the physical strike at 0.74 s. */
export const FINISHER_STRIKE_FRAME = 5;
/** Two frames are visible at each cross-fade, so the painted body never disappears. */
export const FINISHER_FRAME_TIMES = [0, 0.1, 0.22, 0.34, 0.48, 0.66, 0.9, 1.08] as const;

export function finisherFrameUrls(id: string): string[] {
  return Array.from({ length: 8 }, (_, i) => finisherFrameUrl(id, i + 1));
}

/** The eight-frame version runs only when every frame ships; preloadMatch fetches the complete set. */
export function hasFinisherFrames(id: string): boolean {
  return finisherFrameUrls(id).every((src) => hasArt(src));
}
