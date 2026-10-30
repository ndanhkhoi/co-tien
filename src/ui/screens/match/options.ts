import type { Match } from '../../../game/match';
import type { PracticeSetup } from '../practice/desk';

export interface MatchOptions {
  setup: Match['setup'];
  titles?: [string, string];
  /** Optional VS intro line (NPC). */
  quote?: string;
  /** Heading for HUD centre ("Sự nghiệp", "Thử thách 3"...). */
  label: string;
  /** Rack/challenge overrides for the end-of-rack dialog. */
  challenge?: { tries: number; goal: string; marks?: { pocket?: number; zone?: [number, number, number] }; onResult: (ok: boolean, attempt: number) => { stars: number; next?: () => void } };
  /** Match end: return reward lines to show and optional actions. */
  onEnd?: (r: { won: boolean; match: Match }) => { lines: string[]; again?: () => void };
  onExit: () => void;
  /** Luyện thế: the left column becomes the practice desk; no rules, no opponent. */
  practice?: PracticeSetup;
}
