export type SwipeStart = { x: number; y: number } | null;

/** Advance when the gesture is a clear horizontal swipe; returns its signed direction. */
export function swipeDirection(start: SwipeStart, e: PointerEvent): 1 | -1 | null {
  if (!start) return null;
  const dx = e.clientX - start.x;
  const dy = e.clientY - start.y;
  if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) return dx < 0 ? 1 : -1;
  return null;
}
