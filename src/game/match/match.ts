import { buildCast, mergeTerrain, type CastEffect, type SkillCast } from '../skill-cast';
import { maxSpeed, powerToSpeed } from '../../core/cue-power';
import { cloneBalls, DEFAULT_PHYS, elevatedTipOffset, strike, type Ball, type PhysEvent, type PhysParams, type SimWorld } from '../../core/physics';
import { canPlaceCue, nearestCueSpot } from '../../core/rack';
import { NO_SCORE, type ShotScore } from '../../core/shot-score';
import { Rng } from '../../core/rng';
import { RULES } from '../../core/rules';
import {
  newGameState, other, summarize,
  type BallInHand, type GameState, type OptionKind, type Resolution, type RuleSet, type ShotSummary, type Side,
} from '../../core/rules/types';
import { makeCaromTable, makePoolTable, type TableGeom } from '../../core/table';
import { champion, type ClassId, type SkillDef, type SkillKind } from '../content/sects';
import type { Omen } from '../terrain';
import { ENERGY_MAX, startEnergy } from './energy';
import { absorbSkill, armTurnHexes } from './hexes';
import { rollGhost, rollOmenFor } from './omen';
import { appliesTo, applyKind, clearShotBuffs, kindReady } from './skills';
import { finishChallengeShot, finishRulesShot, strikeShot, updateSimulation } from './shot';
import { finishPracticeShot, liftPracticeBall, markPracticePosition, placePracticeBall, setPracticePosition, undoPracticeShot } from './practice';
import type { EffectTarget, Hex, MatchEvent, MatchSetup, Phase, PlayerStats, PlayerSetup, ShotInput, Snapshot } from './types';

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
  /** Debuffs waiting for each side's shots (tremor, power loss, sealed pockets, sight). */
  hexes: Hex[] = [];
  /** Debuffs on the shot being lined up now. */
  tremorNow = 1;
  freezeNow = 1;
  blindNow = false;
  driftNow = 0;
  calledNow: number | null = null;
  /** Called-ball challenge waiting for its recipient. */
  called: { by: Side; ball: number; shotsLeft: number } | null = null;
  /** Mị Cơ: the side who will take the opponent's next shot. */
  puppeteer: Side | null = null;
  /** Đắm Đuối: the face-down counter waiting for an opponent skill. */
  counter: (typeof this.activeEffects)[number] | null = null;
  /** Thiên Tượng waiting on the shot being lined up, and the pocket it closed. */
  omen: Omen | null = null;
  omenPocket: number | null = null;
  lastRes: Resolution | null = null;
  lastShooter: Side = 0;
  /** What happened on the last shot, for the HUD to name it. */
  lastShot: ShotSummary | null = null;
  lastScore: ShotScore = NO_SCORE;
  /** Luyện thế: draw every ball's full path while aiming. */
  sight = false;
  /** State shared with the match systems in this folder (shot, skills, omen, practice). */
  snapshot: Snapshot | null = null;
  shotEvents: PhysEvent[] = [];
  shotInput: ShotInput | null = null;
  shotTargets: number[] = [];
  /** Pocket capture size from the table's character (Hư Không), on every shot. */
  baseCapture = 1;
  activeEffects: (CastEffect & { target: EffectTarget; shotsLeft: number; amount?: number })[] = [];
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
  /** The live physics world the match steps. */
  world: SimWorld;
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

  emit(e: MatchEvent) {
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
    return [...this.closedPockets.map((i) => this.table.pockets[i].mouth), ...(this.omen?.segments ?? []), ...this.activeEffects.filter(e => appliesTo(e.target, this.turn)).flatMap(e => e.segments)];
  }

  syncObstacles() {
    this.world.closedPockets = this.closedPockets;
    this.world.extraSegments = this.obstacles();
  }

  vmax(side: Side = this.state.turn): number {
    const base = maxSpeed(this.table.kind, this.setup.players[side].cue.power) * (this.passive(side) === 'cuongchien' ? 1.1 : 1);
    return side === this.state.turn ? base * this.powerBoost * this.freezeNow * (this.passive(side) === 'anhsat' && this.assassinReady[side] && this.assassinChoice[side] === 'power' ? 1.12 : 1) : base;
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
    this.energy = startEnergy();
    this.cooldown = [[0, 0], [0, 0]];
    this.shield = [false, false];
    this.hexes = [];
    this.called = null;
    this.puppeteer = null;
    this.counter = null;
    this.called = null;
    this.puppeteer = null;
    this.counter = null;
    this.guardUsed = [false, false];
    this.assassinReady = [false, false];
    this.assassinStreak = [0, 0];
    this.assassinValue = [0, 0];
    this.lastBasic = [null, null];
    this.aimLock = null;
    clearShotBuffs(this);
    this.omen = null;
    this.omenPocket = null;
    this.world.terrain = null;
    this.potted = [[], []];
    this.snapshot = null;
    this.lastRes = null;
    rollGhost(this);
    this.phase = 'aim';
    this.emit({ type: 'new-rack' });
    this.emit({ type: 'turn', side: this.state.turn });
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
    this.activeEffects.push({
      ...buildCast('railcraft', 1, -1, { table: this.table, balls: this.balls, cueId: this.cueId(), cast: { ...cast, hardness: 'soft' } }),
      target: side, shotsLeft: 1,
    });
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

  terrain() { return mergeTerrain(this.omen?.terrain, ...this.activeEffects.filter(e => appliesTo(e.target, this.turn)).map(e => e.terrain)); }

  simulationWorld(): SimWorld {
    return { table: this.table, balls: this.balls, params: this.params, terrain: this.terrain(), extraSegments: this.obstacles(), closedPockets: this.closedPockets, captureScale: this.mawScale * this.baseCapture * (this.omen?.capture ?? 1), pocketPull: this.pull, pullExempt: this.cueId(), time: 0 };
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
    return canPlaceCue({
      table: this.table, balls: this.balls, cueId: this.cueId(), kitchen: this.placing === 'kitchen',
    }, x, y);
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
      if (!canPlaceCue({ table: this.table, balls: this.balls, cueId: cue.id, kitchen: false }, x, y)) {
        return { x: cue.x, y: cue.y };
      }
      cue.x = x;
      cue.y = y;
      return { x, y };
    }
    const spot = nearestCueSpot({
      table: this.table, balls: this.balls, cueId: cue.id, kitchen: this.placing === 'kitchen',
    }, x, y);
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
    strikeShot(this, input);
  }

  /** Advance the simulation; call every frame while rolling. */
  update(dt: number) {
    updateSimulation(this, dt);
  }

  /** Resolve the shot that just ended, by practice, challenge or rules mode. */
  finishShot() {
    const side = this.state.turn;
    const input = this.shotInput!;
    const crossed = this.balls.filter((b) => b.onTable && b.id !== 0 && b.x < this.table.headStringX).length;
    const shot = summarize({
      events: this.shotEvents, cueId: this.cueId(side), isBreak: this.state.isBreak, call: input.call,
      pushOut: input.pushOut, targets: this.shotTargets, crossedHeadString: crossed,
    });
    this.lastShot = shot;
    if (this.setup.practice) return finishPracticeShot(this, side, shot);
    if (this.setup.judge) return finishChallengeShot(this, side, shot);
    finishRulesShot(this, side, shot);
  }

  /** Luyện thế: move ball `id`, from the cloth or the tray, to the free spot nearest (x, y). */
  placeBall(id: number, x: number, y: number): boolean {
    return placePracticeBall(this, id, x, y);
  }

  /** Luyện thế: carry an object ball back to the tray. The cue ball always stays. */
  liftBall(id: number): boolean {
    return liftPracticeBall(this, id);
  }

  /** Luyện thế: lay out a whole position; "Về thế" comes back to it. */
  setPosition(balls: Ball[]) {
    setPracticePosition(this, balls);
  }

  /** Luyện thế: the position on the cloth now becomes the one "Về thế" returns to. */
  markPosition() {
    markPracticePosition(this);
  }

  /** Luyện thế: the last shot can still be taken back. */
  get canUndo(): boolean {
    return !!this.setup.practice && !!this.snapshot && this.phase === 'aim';
  }

  /** Luyện thế: put every ball back where it rested before the last shot. */
  undoShot(): boolean {
    return undoPracticeShot(this);
  }

  beginTurn() {
    const side = this.state.turn;
    if (side !== this.lastShooter) { rollGhost(this); this.guardUsed[side] = false; }
    this.aimLock = null;
    this.phase = 'aim';
    armTurnHexes(this, side);
    // Roll first: the AI plans its shot as soon as it hears about the turn.
    rollOmenFor(this, side);
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
    clearShotBuffs(this);
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
    return this.skills(side)[slot].kinds.some(k => kindReady(this, this.effectiveKind(k), side));
  }

  useSkill(side: Side, slot: number, cast?: SkillCast): boolean {
    if (!this.canUseSkill(side, slot)) return false;
    const sk = this.skills(side)[slot];
    const absorbed = absorbSkill(this, side);
    if (slot === 2) this.energy[side] = 0;
    else {
      const alternate = this.passive(side) === 'luanhoi' && this.lastBasic[side] !== null && this.lastBasic[side] !== slot;
      this.cooldown[side][slot] = Math.max(1, sk.cooldown - (alternate ? 1 : 0));
      this.lastBasic[side] = slot;
    }
    if (absorbed) return true;
    // Cast the entire package, including families already active.
    sk.kinds.map((k) => this.effectiveKind(k)).forEach((k) => {
      applyKind(this, k, { tier: sk.tier, side, slot, cast, target: sk.target, turns: sk.turns, ult: sk.ult, shape: sk.shape });
    });
    this.emit({ type: 'skill', side, champion: this.setup.players[side].champion, slot, skill: sk });
    return true;
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
