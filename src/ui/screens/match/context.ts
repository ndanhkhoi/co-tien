import type { Rng } from '../../../core/rng';
import type { Side } from '../../../core/rules/types';
import type { SkillCast } from '../../../game/skill-cast';
import type { SkillDef } from '../../../game/content/sects';
import type { Match } from '../../../game/match';
import type { TableView } from '../../../render/table-view';
import type { App } from '../../app';
import type { MatchOptions } from './options';
import type { MatchDom } from './dom';

export interface AimState { angle: number; side: number; vert: number; elevation: number }

/** Power and strike timing: both are advanced by the frame loop. */
interface PowerState {
  preset: number;
  presets: [number, number];
  heldPower: number | null;
  barActive: boolean;
  power: number;
  charging: boolean;
  chargeT: number;
  holdT: number;
  strikeT: number;
  strikePull: number;
}

interface Flags {
  aiActing: boolean;
  aiToken: number;
  begun: boolean;
  callBall: number | null;
  callPocket: number | null;
  disposed: boolean;
  lastTurnSide: Side | null;
  paused: boolean;
  placeConfirmed: boolean;
  placementAim: boolean;
  presenting: boolean;
  pushOut: boolean;
  showAiCue: boolean;
  targetIdx: number;
}

interface SkillState {
  placement: { side: Side; slot: number; cast: SkillCast } | null;
  pendingUltimate: { champion: string; skill: SkillDef; side: Side } | null;
  spinDrag: { id: number; x: number; y: number; side: number; vert: number; live: boolean; timer: number } | null;
  preview(cast: SkillCast): void;
  moveCast(x: number, y: number): void;
  rotateCast(deg: number): void;
}

interface TurnState {
  attempt: number;
  pottedBefore: [number, number];
  skillIdle: [number, number];
  ultAnnounced: [boolean, boolean];
}

/** Values cached so DOM writes happen only when their text or position changes. */
interface RenderState {
  handKey: string;
  powerKey: string;
  lastTick: number;
  handSize: { w: number; h: number };
  callTagKey: string;
  callTagPos: string;
  pauseWrap: HTMLElement | null;
  cutIn: HTMLElement | null;
}

export interface MatchCtx {
  /** Delta assigned at the start of each frame; helpers below read it without passing it around. */
  frameDt: number;
  hudQueued: boolean;
  ballTagTimer: number;
  app: App;
  opts: MatchOptions;
  match: Match;
  view: TableView;
  dom: MatchDom;
  rng: Rng;
  aim: AimState;
  power: PowerState;
  flags: Flags;
  skill: SkillState;
  turn: TurnState;
  renderState: RenderState;
  hasSkills: boolean;
  solo: boolean;
  lefty: boolean;
  aiCall: { ball: number | null; pocket: number } | null;
  firedCall: { ball: number | null; pocket: number } | null;
  strikePress: { id: number; t0: number } | null;
  cancelArmed: boolean;
}
