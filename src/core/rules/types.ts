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
  /** Balls driven off the table, distinct from pocketed balls. */
  offTable?: number[];
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

export interface SummarizeInput {
  events: PhysEvent[];
  cueId: number;
  isBreak: boolean;
  call: ShotCall | null;
  pushOut: boolean;
  targets: number[];
  crossedHeadString?: number;
}

interface SummaryState {
  firstHit: number | null;
  contacted: boolean;
  railAfterContact: boolean;
  railBalls: Set<number>;
  cueContacts: number[];
  cueRails: number;
  cueRailsBeforeSecond: number;
  pocketed: { id: number; pocket: number }[];
  offTable: number[];
}

function newSummaryState(): SummaryState {
  return {
    firstHit: null,
    contacted: false,
    railAfterContact: false,
    railBalls: new Set<number>(),
    cueContacts: [],
    cueRails: 0,
    cueRailsBeforeSecond: -1,
    pocketed: [],
    offTable: [],
  };
}

function noteBallEvent(s: SummaryState, e: Extract<PhysEvent, { t: 'ball' }>, cueId: number) {
  s.contacted = true;
  if (e.a !== cueId && e.b !== cueId) return;
  const other = e.a === cueId ? e.b : e.a;
  if (s.firstHit === null) s.firstHit = other;
  if (!s.cueContacts.includes(other)) {
    s.cueContacts.push(other);
    if (s.cueContacts.length === 2 && s.cueRailsBeforeSecond < 0) s.cueRailsBeforeSecond = s.cueRails;
  }
}

function noteCushionEvent(s: SummaryState, e: Extract<PhysEvent, { t: 'cushion' }>, cueId: number) {
  if (s.contacted) s.railAfterContact = true;
  if (e.id !== cueId) s.railBalls.add(e.id);
  if (e.id === cueId) s.cueRails++;
}

function applySummaryEvent(s: SummaryState, e: PhysEvent, cueId: number) {
  if (e.t === 'ball') noteBallEvent(s, e, cueId);
  else if (e.t === 'cushion') noteCushionEvent(s, e, cueId);
  else if (e.t === 'off-table') {
    if (!s.offTable.includes(e.id)) s.offTable.push(e.id);
  } else s.pocketed.push({ id: e.id, pocket: e.pocket });
}

export function summarize(input: SummarizeInput): ShotSummary {
  const s = newSummaryState();
  for (const e of input.events) applySummaryEvent(s, e, input.cueId);
  const cueRailsBeforeSecond = s.cueRailsBeforeSecond < 0 ? s.cueRails : s.cueRailsBeforeSecond;
  return {
    isBreak: input.isBreak,
    cueId: input.cueId,
    firstHit: s.firstHit,
    pocketed: s.pocketed,
    offTable: s.offTable,
    railAfterContact: s.railAfterContact,
    objectBallsToRail: s.railBalls.size,
    cueContacts: s.cueContacts,
    cueRailsBeforeSecond,
    call: input.call,
    pushOut: input.pushOut,
    targets: input.targets,
    crossedHeadString: input.crossedHeadString ?? 0,
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
