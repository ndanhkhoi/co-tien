import type { Ball } from '../core/physics';
import type { GameState, ShotCall, Side } from '../core/rules/types';
import type { SkillId } from '../game/content/gear';

export type Personality = 'balanced' | 'aggressive' | 'defensive' | 'trickster';

export interface AiProfile {
  /** 1 Dễ · 2 Vừa · 3 Khó · 4 Thần Công */
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
  ice: boolean;
  seed: number;
  /** Whether the AI must answer an option (push-out / illegal break / wrong call). */
  option: boolean;
  pushOutAvailable: boolean;
  energy: number;
  skills: SkillId[];
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
  /** Skill to fire before shooting. */
  skill?: SkillId;
  /** Debug: estimated success chance. */
  confidence: number;
}
