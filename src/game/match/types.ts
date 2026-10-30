import type { AiProfile } from '../ai-profile';
import type { Ball, PhysEvent } from '../../core/physics';
import type {
  BallInHand, GameMode, GameState, Resolution, ShotCall, ShotSummary, Side,
} from '../../core/rules/types';
import type { SkillDef } from '../content/sects';
import type { CueDef, MutatorId, TableSkin } from '../content/gear';
import type { Omen } from '../terrain';
import type { CastEffect } from '../skill-cast';
import type { SkillKind } from '../content/sects';

export interface PlayerSetup {
  name: string;
  kind: 'human' | 'ai';
  ai?: AiProfile;
  cue: CueDef;
  /** Champion id: portrait, class passive and the three skills this player can cast. */
  champion: string;
}

export interface MatchSetup {
  mode: GameMode;
  raceTo: number;
  players: [PlayerSetup, PlayerSetup];
  mutator: MutatorId | null;
  tableSkin: TableSkin;
  /** Cổ Điển: pure billiards — no skills, no class passives, no table character. */
  classic?: boolean;
  seed?: number;
  caromTarget?: number;
  firstBreaker?: Side;
  /** Challenge mode: fixed layout and a custom judge instead of the rules. */
  layout?: Ball[];
  judge?: (shot: ShotSummary, balls: Ball[]) => { ok: boolean; why: string };
  /** Luyện thế: one player arranges `layout` freely and shoots without rules or turns. */
  practice?: boolean;
}

export interface ShotInput {
  /** Cue elevation in radians, clamped to 0–75 degrees by physics. */
  elevation?: number;
  angle: number;
  power: number;
  side: number;
  vert: number;
  call: ShotCall | null;
  pushOut: boolean;
}

export type Phase = 'aim' | 'rolling' | 'option' | 'rack-over' | 'match-over';

export type MatchEvent =
  | { type: 'shot'; side: Side; speed: number; miscue: boolean }
  | { type: 'phys'; e: PhysEvent }
  | { type: 'explode'; x: number; y: number }
  | { type: 'resolved'; res: Resolution; side: Side }
  | { type: 'energy'; side: Side; gain: number; total: number }
  | { type: 'turn'; side: Side }
  | { type: 'skill'; side: Side; champion: string; slot: number; skill: SkillDef }
  | { type: 'omen'; side: Side; omen: Omen }
  | { type: 'rack-over'; winner: Side }
  | { type: 'match-over'; winner: Side }
  | { type: 'displace'; side: Side; moved: { id: number; from: { x: number; y: number }; to: { x: number; y: number } }[] }
  | { type: 'swap'; side: Side; balls: [number, number]; at: [{ x: number; y: number }, { x: number; y: number }] }
  | { type: 'new-rack' };

export type EffectTarget = Side | 'both';

/** Opponent-facing hexes that can outlast one shot. */
export interface Hex {
  kind: SkillKind;
  by: Side;
  target: Side;
  value: number;
  shotsLeft: number;
  sense?: 'cw' | 'ccw';
}

export interface PlayerStats {
  shots: number;
  pots: number;
  fouls: number;
  bestRun: number;
  run: number;
}

/** The match as it stood before a shot; Hoàn Chỉ rewinds to it, Luyện thế undoes to it. */
export interface Snapshot {
  side: Side;
  balls: Ball[];
  state: GameState;
  energy: [number, number];
  rackWins: [number, number];
  ballInHand: BallInHand;
  closed: number[];
  bombId: number;
  bombUsed: boolean;
  pushOutAvailable: boolean;
  potted: [number[], number[]];
  activeEffects: (CastEffect & { target: EffectTarget; shotsLeft: number; amount?: number })[];
  hexes: Hex[];
  tremorNow: number;
  freezeNow: number;
  blindNow: boolean;
  driftNow: number;
  calledNow: number | null;
}
