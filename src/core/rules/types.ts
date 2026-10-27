import type { Ball, PhysEvent } from '../physics';
import type { Rng } from '../rng';
import type { TableGeom } from '../table';

export type GameMode = 'eight' | 'nine' | 'ten' | 'carom-libre' | 'carom-3c';
export type Group = 'solid' | 'stripe' | null;
export type BallInHand = 'none' | 'kitchen' | 'anywhere';
export type Side = 0 | 1;

/** What the shooter declared before the shot. */
export interface ShotCall {
  ball: number;
  pocket: number;
}

/** Facts about one shot distilled from physics events. */
export interface ShotSummary {
  isBreak: boolean;
  cueId: number;
  firstHit: number | null;
  pocketed: { id: number; pocket: number }[];
  /** A ball (any, incl. cue) reached a cushion after the first contact. */
  railAfterContact: boolean;
  /** Distinct object balls that touched a cushion during the shot. */
  objectBallsToRail: number;
  /** Distinct balls the cue ball contacted, in order. */
  cueContacts: number[];
  /** Cushions the cue ball touched before contacting its second distinct ball. */
  cueRailsBeforeSecond: number;
  call: ShotCall | null;
  pushOut: boolean;
  /** Legal first-contact targets computed before the shot (empty = any). */
  targets: number[];
  /** Object balls resting above the head string after the shot (9-ball break rule). */
  crossedHeadString: number;
}

export interface GameState {
  mode: GameMode;
  turn: Side;
  isBreak: boolean;
  groups: [Group, Group];
  scores: [number, number];
  /** Consecutive fouls per player (three-foul rule). */
  fouls: [number, number];
  ballInHand: BallInHand;
  /** Next shot may be declared a push-out (9/10-ball, shot after the break). */
  pushOutAvailable: boolean;
  /** Opponent of a push-out (or a missed 10-ball call) chooses who shoots next. */
  pendingOption: OptionKind | null;
  winner: Side | null;
  /** Carom: points to win a rack. */
  caromTarget: number;
  innings: number;
}

export interface Resolution {
  foul: string | null;
  /** Shooter continues at the table. */
  keepTurn: boolean;
  ballInHand: BallInHand;
  respot: number[];
  winner: Side | null;
  /** Short lines for the HUD banner. */
  messages: string[];
  points: number;
  /** Something worth celebrating (for UI effects). */
  highlight?: 'win' | 'group' | 'golden' | 'run';
  /** 8-ball: group the shooter takes on an open table. */
  assignGroup?: Group;
  /** The incoming player chooses: play the table as it lies, or hand it back / re-rack. */
  option?: OptionKind;
}

/**
 * - push-out / wrong-call / illegal-break-9: play as it lies, or make the other player shoot.
 * - illegal-break-8: accept the table, or re-rack and break yourself.
 */
export type OptionKind = 'push-out' | 'wrong-call' | 'illegal-break-9' | 'illegal-break-8';

export interface RuleSet {
  mode: GameMode;
  table: 'pool' | 'carom';
  rack(table: TableGeom, rng: Rng, breaker: Side): Ball[];
  /** Ball id the given side must strike with. */
  cueId(state: GameState, side: Side): number;
  /** Object balls the shooter may legally hit first. Empty means "any". */
  legalTargets(state: GameState, balls: Ball[], side: Side): number[];
  /** Whether the shooter must name ball/pocket before shooting. */
  callType(state: GameState, balls: Ball[], side: Side): 'none' | 'pocket' | 'ball-pocket';
  resolve(state: GameState, balls: Ball[], shot: ShotSummary): Resolution;
  /** One-line objective for the HUD. */
  objective(state: GameState, balls: Ball[], side: Side): string;
}

export function summarize(
  events: PhysEvent[], cueId: number, isBreak: boolean, call: ShotCall | null, pushOut: boolean, targets: number[],
  crossedHeadString = 0,
): ShotSummary {
  let firstHit: number | null = null;
  let contacted = false;
  let railAfterContact = false;
  const railBalls = new Set<number>();
  const cueContacts: number[] = [];
  let cueRails = 0;
  let cueRailsBeforeSecond = -1;
  const pocketed: { id: number; pocket: number }[] = [];
  for (const e of events) {
    if (e.t === 'ball') {
      if (e.a === cueId || e.b === cueId) {
        const other = e.a === cueId ? e.b : e.a;
        if (firstHit === null) firstHit = other;
        if (!cueContacts.includes(other)) {
          cueContacts.push(other);
          if (cueContacts.length === 2 && cueRailsBeforeSecond < 0) cueRailsBeforeSecond = cueRails;
        }
      }
      contacted = true;
    } else if (e.t === 'cushion') {
      if (contacted) railAfterContact = true;
      if (e.id !== cueId) railBalls.add(e.id);
      if (e.id === cueId) cueRails++;
    } else if (e.t === 'pocket') {
      pocketed.push({ id: e.id, pocket: e.pocket });
    }
  }
  return {
    isBreak, cueId, firstHit, pocketed, railAfterContact,
    objectBallsToRail: railBalls.size, cueContacts,
    cueRailsBeforeSecond: cueRailsBeforeSecond < 0 ? cueRails : cueRailsBeforeSecond,
    call, pushOut, targets, crossedHeadString,
  };
}

export function newGameState(mode: GameMode, breaker: Side, caromTarget = 10): GameState {
  return {
    mode, turn: breaker, isBreak: true, groups: [null, null], scores: [0, 0], fouls: [0, 0],
    ballInHand: mode.startsWith('carom') ? 'none' : 'kitchen',
    pushOutAvailable: false, pendingOption: null, winner: null, caromTarget, innings: 0,
  };
}

export const other = (s: Side): Side => (s === 0 ? 1 : 0);
