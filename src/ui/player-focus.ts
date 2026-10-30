import type { SectId } from '../game/content/sects';

/** Kết liễu timings; the reduced version stays static and shorter. */
export const finisherDuration = (reduced: boolean) => reduced ? 1800 : 2900;

export interface JourneyFocusLand {
  id: SectId;
  open: boolean;
  beaten: boolean;
}

/** A returning journey duel names its land; a fresh map opens the first unfinished land. */
export function journeyFocus(current: SectId | undefined, lands: JourneyFocusLand[]): SectId | undefined {
  if (current) return current;
  return lands.find((land) => land.open && !land.beaten)?.id;
}
