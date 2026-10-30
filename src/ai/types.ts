import type { SkillCast } from '../game/skill-cast';
import type { Ball } from '../core/physics';
import type { GameState, ShotCall, Side } from '../core/rules/types';
import type { PhysParams, Terrain } from '../core/physics';
import type { Segment } from '../core/table';
import type { SkillKind, SectId } from '../game/content/sects';
import type { AiProfile } from '../game/ai-profile';
// The profile lives in the game layer so match setup and career data can use it without importing ai.
export type { AiProfile, Personality } from '../game/ai-profile';

export interface AiRequest {
  balls: Ball[];
  state: GameState;
  side: Side;
  profile: AiProfile;
  /** Maximum cue-ball speed this player's cue can produce (m/s). */
  maxSpeed: number;
  spinReach?: { side: number; vert: number };
  spinMultiplier?: number;
  secondChance?: boolean;
  shield?: boolean;
  pocketPull?: number;
  blast?: { radius: number; force: number; directional?: boolean };
  ballInHand: 'none' | 'kitchen' | 'anywhere';
  closedPockets: number[];
  /** The match's real physics: table character, mutators, this shot's Thiên Tượng. */
  params: PhysParams;
  terrain: Terrain | null;
  /** Obstacles besides closed pocket mouths (roots). */
  extraSegments: Segment[];
  captureScale: number;
  seed: number;
  /** Placement bounds while planning a nudge. */
  nudge?: { x: number; y: number; radius: number };
  /** Whether the AI must answer an option (push-out / illegal break / wrong call). */
  option: boolean;
  pushOutAvailable: boolean;
  energy: number;
  /** Skills castable right now (checked by the match), with their leading effect family. */
  skills: { slot: number; kind: SkillKind; ultimate: boolean; tier?: number; kinds?: SkillKind[]; target?: 'self' | 'opponent'; ult?: SectId; shape?: 'gate' | 'roots' | 'rim'; directionalBlast?: boolean }[];
}

export interface AiShot {
  cue?: { x: number; y: number };
  angle: number;
  /** 0..1 on the power meter. */
  power: number;
  side: number;
  vert: number;
  call: ShotCall | null;
  pushOut: boolean;
}

export interface AiDecision {
  shot: AiShot | null;
  /** For options: 'play' = take the table, 'pass' = hand it back / re-rack. */
  option?: 'play' | 'pass';
  /** Skill slot to cast before shooting. */
  skill?: number;
  cast?: SkillCast;
  /** Debug: estimated success chance. */
  confidence: number;
}
