import type { Ball } from '../core/physics';
import type { GameState, ShotCall, Side } from '../core/rules/types';
import type { PhysParams, Terrain } from '../core/physics';
import type { Segment } from '../core/table';
import type { SkillKind } from '../game/content/sects';

export type Personality = 'balanced' | 'aggressive' | 'defensive' | 'trickster';

export interface AiProfile {
  /** 1 Dễ · 2 Vừa · 3 Khó · 4 Tông Sư */
  level: 1 | 2 | 3 | 4;
  personality: Personality;
}

export interface AiRequest {
  balls: Ball[];
  state: GameState;
  side: Side;
  profile: AiProfile;
  /** Maximum cue-ball speed this player's cue can produce (m/s). */
  maxSpeed: number;
  ballInHand: 'none' | 'kitchen' | 'anywhere';
  closedPockets: number[];
  /** The match's real physics: table character, mutators, this shot's Thiên Tượng. */
  params: PhysParams;
  terrain: Terrain | null;
  /** Obstacles besides closed pocket mouths (roots). */
  extraSegments: Segment[];
  captureScale: number;
  seed: number;
  /** Whether the AI must answer an option (push-out / illegal break / wrong call). */
  option: boolean;
  pushOutAvailable: boolean;
  energy: number;
  /** Skills castable right now (checked by the match), with their leading effect family. */
  skills: { slot: number; kind: SkillKind; ultimate: boolean }[];
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
  /** Debug: estimated success chance. */
  confidence: number;
}
