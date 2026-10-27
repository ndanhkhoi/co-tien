import type { AiProfile } from '../ai/types';
import { maxSpeed, powerToSpeed } from '../core/cue-power';
import { cloneBalls, DEFAULT_PHYS, step, strike, type Ball, type PhysEvent, type PhysParams, type SimWorld } from '../core/physics';
import { canPlaceCue, nearestCueSpot, respot } from '../core/rack';
import { Rng } from '../core/rng';
import { RULES } from '../core/rules';
import { groupOf } from '../core/rules/eight-ball';
import {
  newGameState, other, summarize,
  type BallInHand, type GameMode, type GameState, type OptionKind, type Resolution, type RuleSet, type ShotCall, type ShotSummary, type Side,
} from '../core/rules/types';
import { makeCaromTable, makePoolTable, type TableGeom } from '../core/table';
import { skillDef, type CueDef, type MutatorId, type SkillId, type TableSkin } from './content/gear';

export interface PlayerSetup {
  name: string;
  kind: 'human' | 'ai';
  ai?: AiProfile;
  cue: CueDef;
  skills: SkillId[];
  /** Avatar key (NPC id or 'player'). */
  avatar: string;
}

export interface MatchSetup {
  mode: GameMode;
  raceTo: number;
  players: [PlayerSetup, PlayerSetup];
  mutator: MutatorId | null;
  tableSkin: TableSkin;
  seed?: number;
  caromTarget?: number;
  firstBreaker?: Side;
  /** Challenge mode: fixed layout and a custom judge instead of the rules. */
  layout?: Ball[];
  judge?: (shot: ShotSummary, balls: Ball[]) => { ok: boolean; why: string };
}

export interface ShotInput {
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
  | { type: 'turn'; side: Side }
  | { type: 'skill'; side: Side; id: SkillId }
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
}

const ENERGY_MAX = 100;

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
  stats: [PlayerStats, PlayerStats];
  /** Ball-in-hand mode for the shooter right now ('nudge' = Thổi Bi radius around origin). */
  placing: BallInHand | 'nudge' = 'kitchen';
  nudgeOrigin: { x: number; y: number } | null = null;
  closedPockets: number[] = [];
  bombId = -1;
  bombUsed = false;
  /** Shot-scoped skill flags. */
  eagle = false;
  spin2 = false;
  shield: [boolean, boolean] = [false, false];
  tremor: [boolean, boolean] = [false, false];
  /** The tremor that applies to the current shot (consumed on shoot). */
  tremorNow = false;
  lastRes: Resolution | null = null;
  lastShooter: Side = 0;
  private snapshot: Snapshot | null = null;
  private shotEvents: PhysEvent[] = [];
  private shotInput: ShotInput | null = null;
  private shotTargets: number[] = [];
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

  vmax(side: Side = this.state.turn): number {
    return maxSpeed(this.table.kind, this.setup.players[side].cue.power);
  }

  startRack() {
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
    const bonus = this.setup.tableSkin.energyBonus;
    this.energy = [Math.min(ENERGY_MAX, 20 + bonus), Math.min(ENERGY_MAX, 20 + bonus)];
    this.shield = [false, false];
    this.tremor = [false, false];
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
    this.world.closedPockets = this.closedPockets;
    this.world.extraSegments = this.closedPockets.map((i) => this.table.pockets[i].mouth);
  }

  legalTargets(side: Side = this.state.turn): number[] {
    if (this.setup.judge) return [];
    return this.rules.legalTargets(this.state, this.balls, side);
  }

  callType(side: Side = this.state.turn) {
    if (this.setup.judge) return 'none' as const;
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
      if (Math.hypot(x - o.x, y - o.y) > 0.12) return false;
    }
    return canPlaceCue(this.table, this.balls, this.cueId(), x, y, this.placing === 'kitchen');
  }

  /** Move the cue ball toward (x, y), snapping to the nearest legal spot. */
  placeCue(x: number, y: number): { x: number; y: number } {
    const cue = this.cueBall();
    if (this.placing === 'nudge') {
      const o = this.nudgeOrigin!;
      const d = Math.hypot(x - o.x, y - o.y);
      if (d > 0.12) {
        x = o.x + ((x - o.x) / d) * 0.12;
        y = o.y + ((y - o.y) / d) * 0.12;
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
  miscueChance(side: number, vert: number, power: number): number {
    if (this.spin2) return 0;
    const off = Math.hypot(side, vert);
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
    };
    this.shotTargets = this.legalTargets(side);
    this.shotInput = input;
    this.shotEvents = [];
    this.stats[side].shots++;

    let { angle, power, side: sp, vert } = input;
    const cueDef = this.setup.players[side].cue;
    // Cue spin stat sets how far the tip can reach before the miscue zone.
    const reach = Math.min(1, 0.72 + 0.07 * cueDef.spin) * (this.spin2 ? 1.5 : 1);
    sp *= reach;
    vert *= reach;
    let speed = powerToSpeed(power, this.vmax(side));
    const miscue = this.rng.next() < this.miscueChance(input.side, input.vert, power);
    if (miscue) {
      speed *= this.rng.range(0.25, 0.5);
      angle += this.rng.range(-0.06, 0.06);
      sp = Math.sign(sp) * 0.3;
      vert = 0;
    }
    strike(cue, this.table.R, { angle, speed, side: sp, vert });
    this.eagle = false;
    this.spin2 = false;
    this.tremorNow = false;
    this.placing = 'none';
    this.nudgeOrigin = null;
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
    }
    if (!moving) this.finishShot();
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
    if (this.setup.judge) {
      const verdict = this.setup.judge(shot, this.balls);
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

    if (res.foul && this.shield[side] && res.winner === null) {
      this.shield[side] = false;
      res.messages.unshift('Bảo Hộ đỡ lỗi — không mất bi trong tay');
      res.ballInHand = 'none';
      res.option = undefined;
      res.foul = null;
    }

    for (const id of res.respot) respot(this.table, this.balls, id);
    // A scratched cue ball comes back for ball in hand.
    const cue = this.cueBall(side);
    if (!cue.onTable) {
      cue.onTable = true;
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
    const ownPots = this.ownPots(side, potted.map((p) => p.id));
    if (res.foul) s.fouls++;
    s.pots += ownPots + res.points;
    const gain = (ownPots + res.points) * 12 * (0.8 + 0.1 * this.setup.players[side].cue.energy);
    this.energy[side] = Math.min(ENERGY_MAX, this.energy[side] + gain);
    if (res.foul) this.energy[opp] = Math.min(ENERGY_MAX, this.energy[opp] + 6);
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

  private ownPots(side: Side, ids: number[]): number {
    if (this.setup.mode !== 'eight') return ids.length;
    const g = this.state.groups[side];
    return ids.filter((id) => g === null || groupOf(id) === g || id === 8).length;
  }

  private beginTurn() {
    const side = this.state.turn;
    if (side !== this.lastShooter) this.rollGhost();
    this.tremorNow = this.tremor[side];
    this.tremor[side] = false;
    this.phase = 'aim';
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
    this.eagle = false;
    this.spin2 = false;
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

  canUseSkill(side: Side, id: SkillId): boolean {
    const p = this.setup.players[side];
    if (!p.skills.includes(id)) return false;
    if (this.energy[side] < skillDef(id).cost) return false;
    switch (id) {
      case 'rewind':
        return !!this.snapshot && this.snapshot.side === side && this.lastShooter === side &&
          (this.phase === 'rack-over' ? this.lastRes?.winner !== side : (this.phase === 'aim' || this.phase === 'option') && this.state.turn !== side);
      case 'eagle':
        return this.phase === 'aim' && this.state.turn === side && !this.eagle;
      case 'spin2':
        return this.phase === 'aim' && this.state.turn === side && !this.spin2;
      case 'nudge':
        return this.phase === 'aim' && this.state.turn === side && this.placing === 'none';
      case 'shield':
        return (this.phase === 'aim' || this.phase === 'option') && !this.shield[side];
      case 'tremor':
        return (this.phase === 'aim' || this.phase === 'option') && !this.tremor[other(side)] && !(this.tremorNow && this.state.turn === other(side));
    }
  }

  useSkill(side: Side, id: SkillId): boolean {
    if (!this.canUseSkill(side, id)) return false;
    this.energy[side] -= skillDef(id).cost;
    switch (id) {
      case 'eagle': this.eagle = true; break;
      case 'spin2': this.spin2 = true; break;
      case 'shield': this.shield[side] = true; break;
      case 'nudge': {
        const c = this.cueBall();
        this.placing = 'nudge';
        this.nudgeOrigin = { x: c.x, y: c.y };
        break;
      }
      case 'tremor': {
        const opp = other(side);
        if (this.state.turn === opp && this.phase === 'aim') this.tremorNow = true;
        else this.tremor[opp] = true;
        break;
      }
      case 'rewind': this.rewind(); break;
    }
    this.emit({ type: 'skill', side, id });
    return true;
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
    this.world.closedPockets = s.closed;
    this.world.extraSegments = s.closed.map((i) => this.table.pockets[i].mouth);
    this.bombId = s.bombId;
    this.bombUsed = s.bombUsed;
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
