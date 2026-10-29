import { applySkillBlast, buildCast, mergeTerrain, PLACED_KINDS, type SkillCast, type CastEffect } from './skill-cast';
import type { AiProfile } from '../ai/types';
import { maxSpeed, powerToSpeed } from '../core/cue-power';
import { cloneBalls, DEFAULT_PHYS, elevatedTipOffset, step, strike, type Ball, type PhysEvent, type PhysParams, type SimWorld } from '../core/physics';
import { canPlaceCue, nearestCueSpot, respot } from '../core/rack';
import { canRest } from './practice';
import { NO_SCORE, scoreShot, type ShotScore } from '../core/shot-score';
import { Rng } from '../core/rng';
import { RULES } from '../core/rules';
import { groupOf } from '../core/rules/eight-ball';
import {
  newGameState, other, summarize,
  type BallInHand, type GameMode, type GameState, type OptionKind, type Resolution, type RuleSet, type ShotCall, type ShotSummary, type Side,
} from '../core/rules/types';
import { makeCaromTable, makePoolTable, type TableGeom } from '../core/table';
import { champion, skillPower, type ClassId, type SkillDef, type SkillKind } from './content/sects';
import type { CueDef, MutatorId, TableSkin } from './content/gear';
import { OMEN_CHANCE, rollOmen, type Omen } from './terrain';

/** Ảnh Sát's run: at least this many balls in a row… */
export const ASSASSIN_RUN = 4;
/** …worth this much shot value together, so four hangers alone are not enough. */
export const ASSASSIN_VALUE = 5;
/** Energy for every shot, and per point of shot value (1 per plain ball, more for hard shots). */
export const ENERGY_PER_SHOT = 6;
export const ENERGY_PER_VALUE = 11;

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
  | { type: 'new-rack' };

export interface PlayerStats {
  shots: number;
  pots: number;
  fouls: number;
  bestRun: number;
  run: number;
}

interface Snapshot {
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
}

export const ENERGY_MAX = 100;
const ENERGY_START = 30;

export class Match {
  readonly setup: MatchSetup;
  readonly table: TableGeom;
  readonly rules: RuleSet;
  readonly rng: Rng;
  readonly params: PhysParams;
  state: GameState;
  balls: Ball[] = [];
  phase: Phase = 'aim';
  rackNo = 0;
  rackWins: [number, number] = [0, 0];
  breaker: Side;
  energy: [number, number] = [0, 0];
  /** Own shots left before each basic skill (slot 0, 1) can be cast again. */
  cooldown: [[number, number], [number, number]] = [[0, 0], [0, 0]];
  stats: [PlayerStats, PlayerStats];
  /** Object balls each side has pocketed this rack, in order (respotted balls excluded). */
  potted: [number[], number[]] = [[], []];
  /** Ball-in-hand mode for the shooter right now ('nudge' = Thổi Bi radius around origin). */
  placing: BallInHand | 'nudge' = 'kitchen';
  nudgeOrigin: { x: number; y: number } | null = null;
  closedPockets: number[] = [];
  bombId = -1;
  bombUsed = false;
  /** Shot-scoped buffs from the shooter's own skill. */
  eagle = false;
  reveal = false;
  spinBoost = 1;
  powerBoost = 1;
  triplePreview = false;
  previewSpread = 0.12;
  blast: { radius: number; force: number; done: boolean; direction?: { x: number; y: number } } | null = null;
  mawScale = 1;
  pull = 0;
  secondChance = false;
  nudgeRadius = 0.12;
  /** Lasting effects. */
  shield: [boolean, boolean] = [false, false];
  /** Debuffs waiting for each side's next turn (tremor multiplier, power multiplier, pockets sealed). */
  tremor: [number, number] = [1, 1];
  freeze: [number, number] = [1, 1];
  seal: [number, number] = [0, 0];
  /** Debuffs on the shot being lined up now. */
  tremorNow = 1;
  freezeNow = 1;
  /** Pocket capture size from the table's character (Hư Không), on every shot. */
  private baseCapture = 1;
  /** Thiên Tượng waiting on the shot being lined up, and the pocket it closed. */
  omen: Omen | null = null;
  private omenPocket: number | null = null;
  lastRes: Resolution | null = null;
  lastShooter: Side = 0;
  /** What happened on the last shot, for the HUD to name it. */
  lastShot: ShotSummary | null = null;
  lastScore: ShotScore = NO_SCORE;
  /** Luyện thế: draw every ball's full path while aiming. */
  sight = false;
  private snapshot: Snapshot | null = null;
  private shotEvents: PhysEvent[] = [];
  private shotInput: ShotInput | null = null;
  private shotTargets: number[] = [];
  activeEffects: (CastEffect & { target: Side })[] = [];
  castPreview: CastEffect[] = [];
  aimLock: { angle: number; band: number } | null = null;
  spinAxis: ['side' | 'vert', 'side' | 'vert'] = ['side', 'side'];
  guardUsed: [boolean, boolean] = [false, false];
  assassinReady: [boolean, boolean] = [false, false];
  /** Ảnh Sát: balls scored in the current unbroken run since the last advantage was spent. */
  assassinStreak: [number, number] = [0, 0];
  /** Ảnh Sát: shot value (see shot-score.ts) of that run. */
  assassinValue: [number, number] = [0, 0];
  assassinChoice: ['info' | 'power', 'info' | 'power'] = ['info', 'info'];
  lastBasic: [number | null, number | null] = [null, null];

  lockAim(angle: number, band: number): boolean {
    if (this.phase !== 'aim' || this.passive(this.turn) !== 'thanxa') return false;
    this.aimLock = { angle, band };
    return true;
  }

  aimBand(angle: number, normal: number): number {
    if (!this.aimLock) return normal;
    const difference = Math.atan2(Math.sin(angle - this.aimLock.angle), Math.cos(angle - this.aimLock.angle));
    if (Math.abs(difference) > 0.00001) { this.aimLock = null; return normal; }
    this.aimLock.band = normal;
    return normal;
  }

  choosePassive(choice: 'side' | 'vert' | 'info' | 'power', side = this.turn): boolean {
    if (side !== this.turn || this.phase !== 'aim') return false;
    if (this.passive(side) === 'phaptu' && (choice === 'side' || choice === 'vert')) {
      this.spinAxis[side] = choice; return true;
    }
    if (this.passive(side) === 'anhsat' && this.assassinReady[side] && (choice === 'info' || choice === 'power')) {
      this.assassinChoice[side] = choice; return true;
    }
    return false;
  }

  useGuard(cast?: SkillCast): boolean {
    const side = this.turn;
    if (this.phase !== 'aim' || this.passive(side) !== 'hophap' || this.guardUsed[side]) return false;
    this.activeEffects.push({ ...buildCast('railcraft', 1, -1, this.table, this.balls, this.cueId(), { ...cast, hardness: 'soft' }), target: side });
    this.guardUsed[side] = true;
    return true;
  }

  get passiveInfo(): boolean {
    return this.passive(this.turn) === 'anhsat' && this.assassinReady[this.turn] && this.assassinChoice[this.turn] === 'info';
  }

  spinReach(side = this.turn) {
    const reach = Math.min(1, 0.72 + 0.07 * this.setup.players[side].cue.spin) * this.spinBoost;
    const cls = this.passive(side);
    return {
      side: reach * (cls === 'cuongchien' ? 0.75 : cls === 'phaptu' ? this.spinAxis[side] === 'side' ? 1.2 : 0.8 : 1),
      vert: reach * (cls === 'cuongchien' ? 0.75 : cls === 'phaptu' ? this.spinAxis[side] === 'vert' ? 1.2 : 0.8 : 1),
    };
  }

  strikePreview(cue: Ball, input: ShotInput) {
    const reach = this.spinReach();
    strike(cue, this.table.R, { angle: input.angle, speed: powerToSpeed(input.power, this.vmax()), side: input.side * reach.side, vert: input.vert * reach.vert, elevation: input.elevation });
  }
  terrain() { return mergeTerrain(this.omen?.terrain, ...this.activeEffects.filter(e => e.target === this.turn).map(e => e.terrain)); }
  simulationWorld(): SimWorld {
    return { table: this.table, balls: this.balls, params: this.params, terrain: this.terrain(), extraSegments: this.obstacles(), closedPockets: this.closedPockets, captureScale: this.mawScale * this.baseCapture * (this.omen?.capture ?? 1), pocketPull: this.pull, pullExempt: this.cueId(), time: 0 };
  }
  private world: SimWorld;
  private listeners: ((e: MatchEvent) => void)[] = [];

  constructor(setup: MatchSetup) {
    this.setup = setup;
    this.rules = RULES[setup.mode];
    this.table = this.rules.table === 'pool' ? makePoolTable() : makeCaromTable();
    if (setup.mutator === 'tight') {
      for (const p of this.table.pockets) p.r *= 0.8;
    }
    this.rng = new Rng(setup.seed ?? (Math.random() * 2 ** 32) >>> 0);
    this.params = setup.mutator === 'ice'
      ? { ...DEFAULT_PHYS, muRoll: 0.0045, muSlide: 0.13, spinDecel: 18 }
      : { ...DEFAULT_PHYS };
    const ph = setup.classic ? undefined : setup.tableSkin.phys;
    if (ph) {
      this.params.muRoll *= ph.muRoll ?? 1;
      this.params.muSlide *= ph.muSlide ?? 1;
      this.params.eCushion = Math.min(0.92, this.params.eCushion * (ph.eCushion ?? 1));
      this.baseCapture = ph.capture ?? 1;
    }
    this.breaker = setup.firstBreaker ?? 0;
    this.state = newGameState(setup.mode, this.breaker, setup.caromTarget ?? 10);
    this.stats = [this.blankStats(), this.blankStats()];
    this.world = { table: this.table, balls: this.balls, params: this.params };
    this.startRack();
  }

  private blankStats(): PlayerStats {
    return { shots: 0, pots: 0, fouls: 0, bestRun: 0, run: 0 };
  }

  on(fn: (e: MatchEvent) => void): () => void {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((f) => f !== fn);
    };
  }

  private emit(e: MatchEvent) {
    for (const f of this.listeners) f(e);
  }

  get turn(): Side {
    return this.state.turn;
  }

  get current(): PlayerSetup {
    return this.setup.players[this.state.turn];
  }

  get isCarom(): boolean {
    return this.table.kind === 'carom';
  }

  cueId(side: Side = this.state.turn): number {
    return this.rules.cueId(this.state, side);
  }

  cueBall(side: Side = this.state.turn): Ball {
    return this.balls.find((b) => b.id === this.cueId(side))!;
  }

  /** Class whose passive applies to `side` (none in Cổ Điển or challenges). */
  passive(side: Side): ClassId | null {
    if (this.setup.classic || this.setup.judge) return null;
    return champion(this.setup.players[side].champion).cls;
  }

  /** Địa Lợi: a champion playing on their own sect's table. */
  homeSide(side: Side): boolean {
    if (this.setup.classic || this.setup.judge) return false;
    return champion(this.setup.players[side].champion).sect === this.setup.tableSkin.sect;
  }

  /** Every fixed obstacle on the cloth right now: closed pocket mouths and Thiên Tượng pieces. */
  obstacles() {
    return [...this.closedPockets.map((i) => this.table.pockets[i].mouth), ...(this.omen?.segments ?? []), ...this.activeEffects.filter(e => e.target === this.turn).flatMap(e => e.segments)];
  }

  private syncObstacles() {
    this.world.closedPockets = this.closedPockets;
    this.world.extraSegments = this.obstacles();
  }

  private rollOmenFor(side: Side) {
    this.omen = null;
    if (this.setup.classic || this.setup.judge || this.homeSide(side) || this.rng.next() >= OMEN_CHANCE) return;
    const omen = rollOmen(this.setup.tableSkin.sect, this.rng, this.table, this.balls);
    if (!omen) return;
    this.omen = omen;
    if (omen.closePocket) {
      const open = this.table.pockets.map((_, i) => i).filter((i) => !this.closedPockets.includes(i));
      if (open.length > 1) {
        this.omenPocket = this.rng.pick(open);
        this.closedPockets = [...this.closedPockets, this.omenPocket];
      }
    }
    this.syncObstacles();
    this.emit({ type: 'omen', side, omen });
  }

  /** Lift this shot's Thiên Tượng once the balls have stopped. */
  private endOmen() {
    if (this.omenPocket !== null) this.closedPockets = this.closedPockets.filter((i) => i !== this.omenPocket);
    this.omen = null;
    this.omenPocket = null;
    this.world.terrain = null;
    this.syncObstacles();
  }

  vmax(side: Side = this.state.turn): number {
    const base = maxSpeed(this.table.kind, this.setup.players[side].cue.power) * (this.passive(side) === 'cuongchien' ? 1.1 : 1);
    return side === this.state.turn ? base * this.powerBoost * this.freezeNow * (this.passive(side) === 'anhsat' && this.assassinReady[side] && this.assassinChoice[side] === 'power' ? 1.12 : 1) : base;
  }

  private clearShotBuffs() {
    this.eagle = false;
    this.triplePreview = false;
    this.reveal = false;
    this.spinBoost = 1;
    this.powerBoost = 1;
    this.blast = null;
    this.mawScale = 1;
    this.pull = 0;
    this.secondChance = false;
    this.world.captureScale = this.baseCapture;
    this.world.pocketPull = 0;
  }

  startRack() {
    this.activeEffects = [];
    this.castPreview = [];
    this.rackNo++;
    const breaker = this.breaker;
    const target = this.state.caromTarget;
    this.state = newGameState(this.setup.mode, breaker, target);
    this.balls = this.setup.layout ? cloneBalls(this.setup.layout) : this.rules.rack(this.table, this.rng, breaker);
    this.world.balls = this.balls;
    this.placing = this.isCarom || this.setup.layout ? 'none' : 'kitchen';
    if (this.setup.layout) this.state.isBreak = false;
    this.nudgeOrigin = null;
    this.bombUsed = false;
    this.bombId = -1;
    if (this.setup.mutator === 'bomb' && !this.isCarom) {
      const key = this.setup.mode === 'eight' ? 8 : this.setup.mode === 'nine' ? 9 : 10;
      const ids = this.balls.filter((b) => b.id !== 0 && b.id !== key && b.id !== 1).map((b) => b.id);
      this.bombId = this.rng.pick(ids);
    }
    this.energy = [ENERGY_START, ENERGY_START];
    this.cooldown = [[0, 0], [0, 0]];
    this.shield = [false, false];
    this.guardUsed = [false, false];
    this.assassinReady = [false, false];
    this.assassinStreak = [0, 0];
    this.assassinValue = [0, 0];
    this.lastBasic = [null, null];
    this.aimLock = null;
    this.tremor = [1, 1];
    this.freeze = [1, 1];
    this.seal = [0, 0];
    this.clearShotBuffs();
    this.omen = null;
    this.omenPocket = null;
    this.world.terrain = null;
    this.potted = [[], []];
    this.snapshot = null;
    this.lastRes = null;
    this.rollGhost();
    this.phase = 'aim';
    this.emit({ type: 'new-rack' });
    this.emit({ type: 'turn', side: this.state.turn });
  }

  private rollGhost() {
    this.closedPockets = [];
    if (this.setup.mutator === 'ghost' && this.table.pockets.length) {
      this.closedPockets = [this.rng.int(0, this.table.pockets.length - 1)];
    }
    this.syncObstacles();
  }

  legalTargets(side: Side = this.state.turn): number[] {
    if (this.setup.judge || this.setup.practice) return [];
    return this.rules.legalTargets(this.state, this.balls, side);
  }

  callType(side: Side = this.state.turn) {
    if (this.setup.judge || this.setup.practice) return 'none' as const;
    return this.rules.callType(this.state, this.balls, side);
  }

  objective(side: Side = this.state.turn) {
    return this.rules.objective(this.state, this.balls, side);
  }

  /** True when the shooter may move the cue ball before shooting. */
  get canMoveCue(): boolean {
    return this.phase === 'aim' && this.placing !== 'none';
  }

  canPlace(x: number, y: number): boolean {
    if (this.placing === 'none') return false;
    if (this.placing === 'nudge') {
      const o = this.nudgeOrigin!;
      if (Math.hypot(x - o.x, y - o.y) > this.nudgeRadius) return false;
    }
    return canPlaceCue(this.table, this.balls, this.cueId(), x, y, this.placing === 'kitchen');
  }

  /** Move the cue ball toward (x, y), snapping to the nearest legal spot. */
  placeCue(x: number, y: number): { x: number; y: number } {
    const cue = this.cueBall();
    if (this.placing === 'nudge') {
      const o = this.nudgeOrigin!;
      const d = Math.hypot(x - o.x, y - o.y);
      const r = this.nudgeRadius;
      if (d > r) {
        x = o.x + ((x - o.x) / d) * r;
        y = o.y + ((y - o.y) / d) * r;
      }
      if (!canPlaceCue(this.table, this.balls, cue.id, x, y, false)) return { x: cue.x, y: cue.y };
      cue.x = x;
      cue.y = y;
      return { x, y };
    }
    const spot = nearestCueSpot(this.table, this.balls, cue.id, x, y, this.placing === 'kitchen');
    cue.x = spot.x;
    cue.y = spot.y;
    cue.onTable = true;
    return spot;
  }

  /** Miscue chance for a tip offset (normalised) and power. */
  miscueChance(side: number, vert: number, power: number, elevation = 0): number {
    if (this.spinBoost > 1 && elevation === 0) return 0;
    const off = elevatedTipOffset(side, vert, elevation);
    if (off <= 0.82) return 0;
    return Math.min(0.9, (off - 0.82) * 3.2 * (0.35 + power));
  }

  shoot(input: ShotInput) {
    if (this.phase !== 'aim') return;
    const side = this.state.turn;
    const cue = this.cueBall();
    if (!cue.onTable) this.placeCue(this.table.headSpot.x, 0);
    this.snapshot = {
      side,
      balls: cloneBalls(this.balls),
      state: structuredClone(this.state),
      energy: [...this.energy] as [number, number],
      rackWins: [...this.rackWins] as [number, number],
      ballInHand: this.placing === 'nudge' ? 'none' : this.placing,
      closed: [...this.closedPockets],
      bombId: this.bombId,
      bombUsed: this.bombUsed,
      pushOutAvailable: this.state.pushOutAvailable,
      potted: [[...this.potted[0]], [...this.potted[1]]],
    };
    this.shotTargets = this.legalTargets(side);
    this.shotInput = input;
    this.shotEvents = [];
    this.stats[side].shots++;

    let { angle, power, side: sp, vert } = input;
    if (this.blast?.direction) this.blast.direction = { x: Math.cos(angle), y: Math.sin(angle) };
    const reach = this.spinReach(side);
    sp *= reach.side;
    vert *= reach.vert;
    let speed = powerToSpeed(power, this.vmax(side));
    const miscue = this.rng.next() < this.miscueChance((input.elevation ?? 0) > 0 ? sp : input.side, (input.elevation ?? 0) > 0 ? vert : input.vert, power, input.elevation);
    if (miscue) {
      speed *= this.rng.range(0.25, 0.5);
      angle += this.rng.range(-0.06, 0.06);
      sp = Math.sign(sp) * 0.3;
      vert = 0;
    }
    strike(cue, this.table.R, { angle, speed, side: sp, vert, elevation: miscue ? 0 : input.elevation });
    // Shot buffs that act while the balls roll stay on until the shot resolves.
    this.world.captureScale = this.mawScale * this.baseCapture * (this.omen?.capture ?? 1);
    this.world.terrain = this.terrain();
    this.syncObstacles();
    this.world.time = 0;
    if (this.omen?.jitter) {
      for (const b of this.balls) {
        if (!b.onTable || b.id === cue.id) continue;
        const a = this.rng.range(0, Math.PI * 2);
        const v = this.omen.jitter * this.rng.range(0.4, 1);
        b.vx += Math.cos(a) * v;
        b.vy += Math.sin(a) * v;
      }
    }
    const cd = this.cooldown[side];
    cd[0] = Math.max(0, cd[0] - 1);
    cd[1] = Math.max(0, cd[1] - 1);
    this.world.pocketPull = this.pull;
    this.world.pullExempt = cue.id;
    this.eagle = false;
    this.reveal = false;
    this.spinBoost = 1;
    this.tremorNow = 1;
    this.freezeNow = 1;
    this.placing = 'none';
    this.nudgeOrigin = null;
    this.aimLock = null;
    // A spent advantage needs a fresh run of balls before it comes back.
    if (this.assassinReady[side]) this.assassinStreak[side] = this.assassinValue[side] = 0;
    this.assassinReady[side] = false;
    this.phase = 'rolling';
    this.emit({ type: 'shot', side, speed, miscue });
  }

  /** Advance the simulation; call every frame while rolling. */
  update(dt: number) {
    if (this.phase !== 'rolling') return;
    const frame: PhysEvent[] = [];
    const moving = step(this.world, dt, frame);
    for (const e of frame) {
      this.shotEvents.push(e);
      this.emit({ type: 'phys', e });
      if (e.t === 'ball' && !this.bombUsed && (e.a === this.bombId || e.b === this.bombId) && e.speed > 1.1) {
        this.explode();
      }
      const cueId = this.cueId();
      if (e.t === 'ball' && this.blast && !this.blast.done && (e.a === cueId || e.b === cueId)) {
        this.blast.done = true;
        this.blastAt(e.x, e.y, this.blast.radius, this.blast.force);
      }
    }
    if (!moving) this.finishShot();
  }

  /** Skill explosion at a contact point: pushes every ball in range away from it. */
  private blastAt(x: number, y: number, radius: number, force: number) {
    applySkillBlast(this.balls, x, y, radius, force, this.blast?.direction);
    this.emit({ type: 'explode', x, y });
  }

  private explode() {
    const bomb = this.balls.find((b) => b.id === this.bombId);
    if (!bomb || !bomb.onTable) return;
    this.bombUsed = true;
    const radius = 0.38;
    for (const b of this.balls) {
      if (b === bomb || !b.onTable) continue;
      const dx = b.x - bomb.x;
      const dy = b.y - bomb.y;
      const d = Math.hypot(dx, dy);
      if (d > radius || d === 0) continue;
      const k = ((radius - d) / radius) * 3.2;
      b.vx += (dx / d) * k;
      b.vy += (dy / d) * k;
    }
    this.emit({ type: 'explode', x: bomb.x, y: bomb.y });
  }

  private finishShot() {
    const side = this.state.turn;
    const opp = other(side);
    const input = this.shotInput!;
    const crossed = this.balls.filter((b) => b.onTable && b.id !== 0 && b.x < this.table.headStringX).length;
    const shot = summarize(this.shotEvents, this.cueId(side), this.state.isBreak, input.call, input.pushOut, this.shotTargets, crossed);
    this.lastShot = shot;
    if (this.setup.practice) return this.finishPracticeShot(side, shot);
    if (this.setup.judge) {
      const verdict = shot.offTable?.length
        ? { ok: false, why: 'Bi văng khỏi bàn' }
        : this.setup.judge(shot, this.balls);
      const res: Resolution = {
        foul: verdict.ok ? null : verdict.why, keepTurn: false, ballInHand: 'none', respot: [],
        winner: verdict.ok ? 0 : 1, messages: [verdict.why], points: 0, highlight: verdict.ok ? 'win' : undefined,
      };
      this.lastRes = res;
      this.lastShooter = side;
      this.phase = 'rack-over';
      this.emit({ type: 'resolved', res, side });
      this.emit({ type: 'rack-over', winner: res.winner! });
      return;
    }
    const res = this.rules.resolve(this.state, this.balls, shot);
    const st = this.state;
    this.activeEffects = this.activeEffects.filter(e => e.target !== side);
    this.endOmen();

    if (!res.foul && !res.keepTurn && !res.option && res.winner === null && this.secondChance) {
      res.keepTurn = true;
      res.messages.unshift('Tái chiến — được đánh tiếp!');
    }
    this.clearShotBuffs();
    if (res.foul && this.shield[side] && res.winner === null) {
      this.shield[side] = false;
      res.messages.unshift('Hộ thể đỡ lỗi — không mất bi trong tay');
      res.ballInHand = 'none';
      res.option = undefined;
      res.foul = null;
    }

    for (const id of res.respot) {
      const ball = this.balls.find(b => b.id === id);
      if (this.rules.table === 'carom' && ball) {
        const spot = id === 2 ? this.table.footSpot : this.table.headSpot;
        const y = spot.y + (id === this.cueId(side) ? 0.1825 : 0);
        Object.assign(ball, nearestCueSpot(this.table, this.balls, id, spot.x, y, false));
        ball.onTable = true;
        ball.vx = ball.vy = ball.wx = ball.wy = ball.wz = 0;
      } else respot(this.table, this.balls, id);
      if (ball) ball.z = ball.vz = 0;
    }
    // A scratched cue ball comes back for ball in hand.
    const cue = this.cueBall(side);
    if (!cue.onTable) {
      cue.onTable = true;
      cue.z = cue.vz = 0;
      Object.assign(cue, nearestCueSpot(this.table, this.balls, cue.id, this.table.headSpot.x, 0, false));
    }

    if (res.assignGroup) {
      st.groups[side] = res.assignGroup;
      st.groups[opp] = res.assignGroup === 'solid' ? 'stripe' : 'solid';
    }
    st.scores[side] += res.points;
    st.fouls[side] = res.foul ? st.fouls[side] + 1 : 0;

    // Stats and energy.
    const s = this.stats[side];
    const potted = shot.pocketed.filter((p) => p.id !== 0 && !res.respot.includes(p.id));
    for (const p of potted) this.potted[side].push(p.id);
    const own = this.ownPots(side, potted.map((p) => p.id));
    const ownPots = own.length;
    if (res.foul) s.fouls++;
    s.pots += ownPots + res.points;
    // Energy pays for how hard and pretty the shot was, not only for how many balls dropped.
    const score = res.foul ? this.judgeShot([], 0, st.isBreak) : this.judgeShot(own, res.points, st.isBreak);
    let gain = score.value * ENERGY_PER_VALUE * (0.8 + 0.1 * this.setup.players[side].cue.energy);
    // Ảnh Sát needs an unbroken run of at least ASSASSIN_RUN balls worth ASSASSIN_VALUE together.
    const scored = !res.foul && res.keepTurn ? score : NO_SCORE;
    this.assassinStreak[side] = scored.count > 0 ? this.assassinStreak[side] + scored.count : 0;
    this.assassinValue[side] = scored.count > 0 ? this.assassinValue[side] + scored.value : 0;
    this.assassinReady[side] = this.passive(side) === 'anhsat' && scored.count > 0
      && this.assassinStreak[side] >= ASSASSIN_RUN && this.assassinValue[side] >= ASSASSIN_VALUE;
    if (this.passive(side) === 'chusu' && !res.foul && !res.keepTurn && !res.option && res.winner === null) {
      this.activeEffects.push({ ...buildCast('sand', 1, -1, this.table, this.balls, this.cueId(side), { point: { x: cue.x, y: cue.y } }), target: opp });
    }
    if (this.homeSide(side)) gain *= 1.2;
    if (!this.setup.classic) {
      this.gainEnergy(side, gain + ENERGY_PER_SHOT);
      if (res.foul) this.gainEnergy(opp, 12);
    }
    if (res.keepTurn && (ownPots > 0 || res.points > 0)) {
      s.run++;
      s.bestRun = Math.max(s.bestRun, s.run);
    } else {
      s.run = 0;
    }

    const wasBreak = st.isBreak;
    st.isBreak = false;
    st.pushOutAvailable = wasBreak && !res.foul && !res.option && res.winner === null && (st.mode === 'nine' || st.mode === 'ten');
    this.lastRes = res;
    this.lastShooter = side;
    this.emit({ type: 'resolved', res, side });

    if (res.winner !== null) {
      this.rackWins[res.winner]++;
      const done = this.rackWins[res.winner] >= this.setup.raceTo;
      this.phase = done ? 'match-over' : 'rack-over';
      this.emit({ type: 'rack-over', winner: res.winner });
      if (done) this.emit({ type: 'match-over', winner: res.winner });
      return;
    }

    if (res.option) {
      st.turn = opp;
      st.pendingOption = res.option;
      this.placing = 'none';
      this.phase = 'option';
      this.emit({ type: 'turn', side: opp });
      return;
    }

    if (this.isCarom && !res.keepTurn) st.innings++;
    st.turn = res.keepTurn ? side : opp;
    this.placing = res.keepTurn ? 'none' : res.ballInHand;
    if (this.placing !== 'none') {
      const c = this.cueBall();
      Object.assign(c, nearestCueSpot(this.table, this.balls, c.id, c.x, c.y, this.placing === 'kitchen'));
    }
    this.beginTurn();
  }

  /** Luyện thế: no rules and no turns; a scratched cue ball comes back in hand anywhere. */
  private finishPracticeShot(side: Side, shot: ShotSummary) {
    const cue = this.cueBall(side);
    const scratched = !cue.onTable;
    const pots = shot.pocketed.filter((p) => p.id !== cue.id).map((p) => p.id);
    this.potted[side].push(...pots);
    this.judgeShot(scratched ? [] : pots, this.isCarom && shot.cueContacts.length >= 2 ? 1 : 0, false);
    if (scratched) {
      cue.onTable = true;
      cue.z = cue.vz = 0;
      Object.assign(cue, nearestCueSpot(this.table, this.balls, cue.id, this.table.headSpot.x, 0, false));
    }
    const res: Resolution = {
      foul: null, keepTurn: true, ballInHand: scratched ? 'anywhere' : 'none', respot: [], winner: null, points: 0, messages: [],
    };
    this.lastRes = res;
    this.lastShooter = side;
    this.emit({ type: 'resolved', res, side });
    this.placing = res.ballInHand;
    this.beginTurn();
  }

  /** Luyện thế: move ball `id`, from the cloth or the tray, to the free spot nearest (x, y). */
  placeBall(id: number, x: number, y: number): boolean {
    const b = this.balls.find((v) => v.id === id);
    if (!b || !this.setup.practice || this.phase !== 'aim') return false;
    const spot = this.restSpot(id, x, y);
    if (!spot) return false;
    Object.assign(b, { x: spot.x, y: spot.y, z: 0, vx: 0, vy: 0, vz: 0, wx: 0, wy: 0, wz: 0, onTable: true });
    this.snapshot = null;
    return true;
  }

  /** Nearest spot to (x, y) where `id` may rest, by spiral search; null on a full table. */
  private restSpot(id: number, x: number, y: number): { x: number; y: number } | null {
    const t = this.table;
    const cx = Math.max(-t.L / 2, Math.min(t.L / 2, x));
    const cy = Math.max(-t.W / 2, Math.min(t.W / 2, y));
    if (canRest(t, this.balls, id, cx, cy)) return { x: cx, y: cy };
    for (let r = 0.004; r < t.L; r += 0.004) {
      for (let a = 0; a < 32; a++) {
        const px = cx + Math.cos((a / 32) * Math.PI * 2) * r;
        const py = cy + Math.sin((a / 32) * Math.PI * 2) * r;
        if (canRest(t, this.balls, id, px, py)) return { x: px, y: py };
      }
    }
    return null;
  }

  /** Luyện thế: carry an object ball back to the tray. The cue ball always stays. */
  liftBall(id: number): boolean {
    const b = this.balls.find((v) => v.id === id);
    if (!b || !b.onTable || id === this.cueId() || !this.setup.practice || this.phase !== 'aim') return false;
    b.onTable = false;
    this.snapshot = null;
    return true;
  }

  /** Luyện thế: lay out a whole position; "Về thế" comes back to it. */
  setPosition(balls: Ball[]) {
    if (!this.setup.practice || this.phase === 'rolling') return;
    this.setup.layout = cloneBalls(balls);
    this.potted = [[], []];
    this.snapshot = null;
    this.retryLayout();
  }

  /** Luyện thế: the position on the cloth now becomes the one "Về thế" returns to. */
  markPosition() {
    if (!this.setup.practice) return;
    this.setup.layout = cloneBalls(this.balls);
    this.placing = 'none';
  }

  /** Luyện thế: the last shot can still be taken back. */
  get canUndo(): boolean {
    return !!this.setup.practice && !!this.snapshot && this.phase === 'aim';
  }

  /** Luyện thế: put every ball back where it rested before the last shot. */
  undoShot(): boolean {
    const s = this.snapshot;
    if (!this.canUndo || !s) return false;
    this.balls = cloneBalls(s.balls);
    this.world.balls = this.balls;
    this.potted = s.potted;
    this.placing = s.ballInHand;
    this.snapshot = null;
    this.lastRes = null;
    this.emit({ type: 'new-rack' });
    this.emit({ type: 'turn', side: this.state.turn });
    return true;
  }

  private gainEnergy(side: Side, amount: number) {
    const before = this.energy[side];
    this.energy[side] = Math.min(ENERGY_MAX, before + amount);
    this.emit({ type: 'energy', side, gain: this.energy[side] - before, total: this.energy[side] });
  }

  private ownPots(side: Side, ids: number[]): number[] {
    if (this.setup.mode !== 'eight') return ids;
    const g = this.state.groups[side];
    return ids.filter((id) => g === null || groupOf(id) === g || id === 8);
  }

  /** Difficulty and beauty of the shot that just ended (see shot-score.ts). */
  private judgeShot(counted: number[], points: number, isBreak: boolean): ShotScore {
    this.lastScore = scoreShot({
      table: this.table, before: this.snapshot?.balls ?? this.balls, events: this.shotEvents, cueId: this.cueId(this.state.turn),
      counted, points, isBreak, elevation: this.shotInput?.elevation ?? 0,
    });
    return this.lastScore;
  }

  private beginTurn() {
    const side = this.state.turn;
    if (side !== this.lastShooter) { this.rollGhost(); this.guardUsed[side] = false; }
    this.aimLock = null;
    this.tremorNow = this.tremor[side];
    this.tremor[side] = 1;
    this.freezeNow = this.freeze[side];
    this.freeze[side] = 1;
    if (this.seal[side] > 0) {
      this.sealPockets(side, this.seal[side]);
      this.seal[side] = 0;
    }
    this.phase = 'aim';
    // Roll first: the AI plans its shot as soon as it hears about the turn.
    this.rollOmenFor(side);
    this.syncObstacles();
    this.emit({ type: 'turn', side });
  }

  /** Answer a pending option. 'play' = chooser shoots now; 'pass' = other side shoots (or re-rack for 8-ball). */
  chooseOption(choice: 'play' | 'pass') {
    if (this.phase !== 'option') return;
    const st = this.state;
    const kind = st.pendingOption as OptionKind;
    const chooser = st.turn;
    st.pendingOption = null;
    if (kind === 'illegal-break-8') {
      if (choice === 'pass') {
        this.breaker = chooser;
        this.startRack();
        return;
      }
      this.placing = 'none';
    } else if (kind === 'illegal-break-9') {
      // Accepting the table forfeits the push-out; handing it back lets the breaker push.
      st.pushOutAvailable = choice === 'pass';
    } else {
      st.pushOutAvailable = false;
    }
    if (choice === 'pass') st.turn = other(chooser);
    this.placing = 'none';
    this.beginTurn();
  }

  /** Challenge retry: same layout again. */
  retryLayout() {
    this.rackNo++;
    this.balls = cloneBalls(this.setup.layout!);
    this.world.balls = this.balls;
    this.placing = 'none';
    this.phase = 'aim';
    this.lastRes = null;
    this.clearShotBuffs();
    this.emit({ type: 'new-rack' });
    this.emit({ type: 'turn', side: 0 });
  }

  nextRack() {
    if (this.phase !== 'rack-over') return;
    // Alternate break.
    this.breaker = other(this.breaker);
    this.startRack();
  }

  // ---- Skills ----

  skills(side: Side): SkillDef[] {
    return champion(this.setup.players[side].champion).skills;
  }

  /** Seal the pockets most useful to `side` (closest to its legal targets). */
  private sealPockets(side: Side, count: number) {
    if (!this.table.pockets.length) return;
    const targets = this.legalTargets(side);
    const balls = this.balls.filter((b) => b.onTable && b.id !== this.cueId(side) && (!targets.length || targets.includes(b.id)));
    const score = this.table.pockets.map((p, i) => ({
      i, v: balls.reduce((acc, b) => acc + 1 / (0.15 + Math.hypot(b.x - p.ax, b.y - p.ay)), 0),
    }));
    score.sort((a, b) => b.v - a.v);
    this.closedPockets = [...new Set([...this.closedPockets, ...score.slice(0, count).map((x) => x.i)])];
    this.syncObstacles();
  }

  /** Whether one effect family can take effect for `side` right now. */
  private kindReady(kind: SkillKind, side: Side): boolean {
    const myAim = this.phase === 'aim' && this.state.turn === side;
    const opp = other(side);
    const live = this.phase === 'aim' || this.phase === 'option';
    if (PLACED_KINDS.includes(kind)) return myAim && !this.activeEffects.some(e => e.kind === kind && e.target === side);
    switch (kind) {
      case 'rewind':
        return !!this.snapshot && this.snapshot.side === side && this.lastShooter === side &&
          (this.phase === 'rack-over' ? this.lastRes?.winner !== side : live && this.state.turn !== side);
      case 'vision': return myAim && !this.eagle;
      case 'reveal': return myAim && !this.reveal;
      case 'spin': return myAim && this.spinBoost === 1;
      case 'power': return myAim && this.powerBoost === 1;
      case 'blast': return myAim && !this.blast;
      case 'maw': return myAim && this.mawScale === 1 && !this.isCarom;
      case 'gravity': return myAim && this.pull === 0 && !this.isCarom;
      case 'second': return myAim && !this.secondChance;
      case 'nudge': return myAim && this.placing === 'none';
      case 'teleport': return myAim && this.placing !== 'anywhere' && !this.isCarom;
      case 'shield': return live && !this.shield[side];
      case 'drain': return live && this.energy[opp] > 0;
      case 'chill': return live && this.tremor[opp] === 1 && !(this.state.turn === opp && this.tremorNow > 1);
      case 'freeze': return live && this.freeze[opp] === 1 && !(this.state.turn === opp && this.freezeNow < 1);
      case 'seal': return live && this.seal[opp] === 0 && !this.isCarom;
    }
    return false;
  }

  /**
   * Carom tables have no pockets: pocket families turn into their nearest table effect so
   * every champion keeps three working skills in every game type.
   */
  effectiveKind(kind: SkillKind): SkillKind {
    if (!this.isCarom) return kind;
    const swap: Partial<Record<SkillKind, SkillKind>> = { shield: 'railcraft', seal: 'chill', maw: 'spin', gravity: 'vision', teleport: 'nudge' };
    return swap[kind] ?? kind;
  }

  /** 0 = ready, otherwise own shots left (basic) or energy missing (ultimate, negative). */
  skillWait(side: Side, slot: number): number {
    if (slot === 2) return this.energy[side] >= ENERGY_MAX ? 0 : this.energy[side] - ENERGY_MAX;
    return this.cooldown[side][slot];
  }

  canUseSkill(side: Side, slot: number): boolean {
    if (this.setup.judge || this.setup.classic) return false;
    if (this.skillWait(side, slot) !== 0) return false;
    return this.skills(side)[slot].kinds.some(k => this.kindReady(this.effectiveKind(k), side));
  }

  useSkill(side: Side, slot: number, cast?: SkillCast): boolean {
    if (!this.canUseSkill(side, slot)) return false;
    const sk = this.skills(side)[slot];
    if (slot === 2) this.energy[side] = 0;
    else {
      const alternate = this.passive(side) === 'luanhoi' && this.lastBasic[side] !== null && this.lastBasic[side] !== slot;
      this.cooldown[side][slot] = Math.max(1, sk.cooldown - (alternate ? 1 : 0));
      this.lastBasic[side] = slot;
    }
    // Cast the entire package, including families already active.
    sk.kinds.map((k) => this.effectiveKind(k)).forEach((k) => {
      this.applyKind(k, sk.tier, side, slot, cast, sk.target, sk.ult, sk.shape);
    });
    this.emit({ type: 'skill', side, champion: this.setup.players[side].champion, slot, skill: sk });
    return true;
  }

  private applyKind(kind: SkillKind, tier: number, side: Side, slot: number, cast?: SkillCast, target?: 'self' | 'opponent', ult?: SkillDef['ult'], shape?: SkillDef['shape']) {
    if (PLACED_KINDS.includes(kind)) {
      this.activeEffects.push({ ...buildCast(kind, tier, slot, this.table, this.balls, this.cueId(side), cast, ult, shape), target: target === 'opponent' ? other(side) : side });
      this.syncObstacles();
      return;
    }
    const pw = skillPower(kind, tier) as Record<string, number>;
    const opp = other(side);
    const oppNow = this.state.turn === opp && this.phase === 'aim';
    switch (kind) {
      case 'vision': this.eagle = true; this.triplePreview = champion(this.setup.players[side].champion).sect === 'thienquang'; this.previewSpread = ult === 'thienquang' ? 0.24 : 0.12; break;
      case 'reveal': this.reveal = true; break;
      case 'spin': this.spinBoost = pw.spin; break;
      case 'power': this.powerBoost = pw.speed; break;
      case 'blast': {
        const resolved = buildCast('wind', tier, slot, this.table, this.balls, this.cueId(side), cast).cast;
        this.blast = { radius: pw.radius, force: pw.force, done: false, direction: champion(this.setup.players[side].champion).sect === 'huyetsat' ? resolved.direction : undefined }; break;
      }
      case 'maw': this.mawScale = pw.scale; break;
      case 'gravity': this.pull = pw.pull; break;
      case 'second': this.secondChance = true; break;
      case 'shield': this.shield[side] = true; break;
      case 'nudge': {
        const c = this.cueBall();
        this.placing = 'nudge';
        this.nudgeRadius = pw.radius;
        this.nudgeOrigin = { x: c.x, y: c.y };
        break;
      }
      case 'teleport': this.placing = 'anywhere'; break;
      case 'drain': {
        const take = Math.min(this.energy[opp], pw.amount);
        this.energy[opp] -= take;
        this.energy[side] = Math.min(ENERGY_MAX, this.energy[side] + take);
        break;
      }
      case 'chill':
        if (oppNow) this.tremorNow = pw.tremor;
        else this.tremor[opp] = pw.tremor;
        break;
      case 'freeze':
        if (oppNow) this.freezeNow = pw.power;
        else this.freeze[opp] = pw.power;
        break;
      case 'seal':
        if (oppNow) this.sealPockets(opp, pw.pockets);
        else this.seal[opp] = pw.pockets;
        break;
      case 'rewind': if (this.snapshot) this.rewind(); break;
    }
  }

  private rewind() {
    const s = this.snapshot!;
    const energyNow = [...this.energy] as [number, number];
    this.balls = cloneBalls(s.balls);
    this.world.balls = this.balls;
    this.state = structuredClone(s.state);
    this.rackWins = [...s.rackWins] as [number, number];
    // Energy already spent on the rewind is kept spent; the opponent keeps what they had.
    this.energy = [s.side === 0 ? energyNow[0] : s.energy[0], s.side === 1 ? energyNow[1] : s.energy[1]];
    this.placing = s.ballInHand;
    this.closedPockets = s.closed;
    this.omen = null;
    this.omenPocket = null;
    this.syncObstacles();
    this.bombId = s.bombId;
    this.bombUsed = s.bombUsed;
    this.potted = s.potted;
    this.snapshot = null;
    this.lastRes = null;
    this.phase = 'aim';
    this.emit({ type: 'turn', side: this.state.turn });
  }

  /** Shared state snapshot for the AI worker. */
  aiView() {
    return {
      balls: cloneBalls(this.balls),
      state: structuredClone(this.state),
      closedPockets: [...this.closedPockets],
    };
  }
}
