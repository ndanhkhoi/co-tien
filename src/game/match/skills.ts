import { buildCast, PLACED_KINDS, type SkillCast } from '../skill-cast';
import { cloneBalls } from '../../core/physics';
import { other, type Side } from '../../core/rules/types';
import type { Hex } from './types';
import { champion, skillPower, type SkillDef, type SkillKind } from '../content/sects';
import { ENERGY_MAX } from './energy';
import { decoySegments, displaceBalls, swapBalls } from './tricks';
import type { Match } from './match';

/** One skill family taking effect: which cast, by whom, at what strength. */
interface KindCast {
  tier: number;
  side: Side;
  slot: number;
  cast?: SkillCast;
  target?: SkillDef['target'];
  turns?: number;
  ult?: SkillDef['ult'];
  shape?: SkillDef['shape'];
}

/** Normalised duration in recipient shots. */
function skillTurns(turns: number | undefined): number {
  return Math.max(1, turns ?? 1);
}

/** Add or refresh one hex on one side; the newer cast replaces the old stack. */
function addHex(list: Hex[], hex: Hex): void {
  const old = list.find((e) => e.kind === hex.kind && e.target === hex.target);
  if (old) Object.assign(old, hex);
  else list.push(hex);
}

export function hexFor(list: Hex[], side: Side, kind: SkillKind): Hex | undefined {
  return list.find((e) => e.kind === kind && e.target === side);
}

/** Whether a placed piece affects this shooter. */
export function appliesTo(target: Side | 'both', side: Side): boolean {
  return target === 'both' || target === side;
}

/** Whether one effect family can take effect for `side` right now. */
export function kindReady(m: Match, kind: SkillKind, side: Side): boolean {
  if (PLACED_KINDS.includes(kind)) return m.phase === 'aim' && m.state.turn === side
    && !m.activeEffects.some(e => e.kind === kind && e.target === side);
  const live = m.phase === 'aim' || m.phase === 'option';
  return ownShotReady(m, kind, side) || controlReady(m, kind, side, live) || hexReady(m, kind, side, live);
}

/** Own-shot families: only while aiming, and only one of each at a time. */
function ownShotReady(m: Match, kind: SkillKind, side: Side): boolean {
  if (m.phase !== 'aim' || m.state.turn !== side) return false;
  switch (kind) {
    case 'vision': return !m.eagle;
    case 'reveal': return !m.reveal;
    case 'spin': return m.spinBoost === 1;
    case 'power': return m.powerBoost === 1;
    case 'blast': return !m.blast;
    case 'maw': return m.mawScale === 1 && !m.isCarom;
    case 'gravity': return m.pull === 0 && !m.isCarom;
    case 'second': return !m.secondChance;
    case 'nudge': return m.placing === 'none';
    case 'displace': return !m.isCarom && m.balls.every((b) => !b.onTable || (b.vx === 0 && b.vy === 0));
    case 'swap': return !m.isCarom && m.balls.every((b) => !b.onTable || (b.vx === 0 && b.vy === 0));
    case 'decoy': return !m.activeEffects.some((e) => e.kind === 'decoy' && e.target === other(side));
    case 'teleport': return m.placing !== 'anywhere' && !m.isCarom;
    case 'puppet': return !m.puppeteer;
    default: return false;
  }
}

/** Shield and rewind: ready even when it is not your turn to shoot. */
function controlReady(m: Match, kind: SkillKind, side: Side, live: boolean): boolean {
  switch (kind) {
    case 'shield': return live && !m.shield[side];
    case 'counter': return live && !m.activeEffects.some((e) => e.kind === 'counter' && e.target === side);
    case 'rewind':
      return !!m.snapshot && m.snapshot.side === side && m.lastShooter === side
        && (m.phase === 'rack-over' ? m.lastRes?.winner !== side : live && m.state.turn !== side);
    default: return false;
  }
}

/** Opponent hexes: ready while anyone could still shoot, if not already hexed. */
function hexReady(m: Match, kind: SkillKind, side: Side, live: boolean): boolean {
  const opp = other(side);
  switch (kind) {
    case 'drain': return live && m.energy[opp] > 0;
    case 'chill': return live && !hexFor(m.hexes, opp, 'chill');
    case 'freeze': return live && !hexFor(m.hexes, opp, 'freeze');
    case 'seal': return live && !hexFor(m.hexes, opp, 'seal') && !m.isCarom;
    case 'blind': return live && !hexFor(m.hexes, opp, 'blind');
    case 'drift': return live && !hexFor(m.hexes, opp, 'drift');
    case 'called': return live && calledCandidates(m, opp).length >= 2;
    default: return false;
  }
}

/** Seal the pockets most useful to `side` (closest to its legal targets). */
export function sealPockets(m: Match, side: Side, count: number) {
  if (!m.table.pockets.length) return;
  const targets = m.legalTargets(side);
  const balls = m.balls.filter((b) => b.onTable && b.id !== m.cueId(side) && (!targets.length || targets.includes(b.id)));
  const score = m.table.pockets.map((p, i) => ({
    i, v: balls.reduce((acc, b) => acc + 1 / (0.15 + Math.hypot(b.x - p.ax, b.y - p.ay)), 0),
  }));
  score.sort((a, b) => b.v - a.v);
  m.closedPockets = [...new Set([...m.closedPockets, ...score.slice(0, count).map((x) => x.i)])];
  m.syncObstacles();
}

/** Take one skill family's effect for `side`. */
export function applyKind(m: Match, kind: SkillKind, spec: KindCast) {
  if (PLACED_KINDS.includes(kind)) { placeCast(m, kind, spec); return; }
  const pw = skillPower(kind, spec.tier) as Record<string, number>;
  if (applyTrick(m, kind, spec, pw)) return;
  if (armShot(m, kind, spec, pw)) return;
  if (applyDefense(m, kind, spec, pw)) return;
  applyHex(m, kind, spec, pw);
}

/** Families that lay something on the cloth stay there until the shot resolves. */
function placeCast(m: Match, kind: SkillKind, spec: KindCast) {
  const { tier, side, slot, cast, ult, shape, target, turns } = spec;
  m.activeEffects.push({
    ...buildCast(kind, tier, slot, { table: m.table, balls: m.balls, cueId: m.cueId(side), cast, ult, shape }),
    target: target === 'opponent' ? other(side) : target === 'both' ? 'both' : side,
    shotsLeft: skillTurns(turns),
  });
  m.syncObstacles();
}

/** Buffs that change how the caster's own shot plays out. */
function armShot(m: Match, kind: SkillKind, spec: KindCast, pw: Record<string, number>): boolean {
  const { tier, side, slot, cast, ult } = spec;
  switch (kind) {
    case 'vision':
      m.eagle = true;
      m.triplePreview = champion(m.setup.players[side].champion).sect === 'thienquang';
      m.previewSpread = ult === 'thienquang' ? 0.24 : 0.12;
      return true;
    case 'reveal': m.reveal = true; return true;
    case 'spin': m.spinBoost = pw.spin; return true;
    case 'power': m.powerBoost = pw.speed; return true;
    case 'blast': {
      const resolved = buildCast('wind', tier, slot, { table: m.table, balls: m.balls, cueId: m.cueId(side), cast }).cast;
      const directional = champion(m.setup.players[side].champion).sect === 'huyetsat';
      m.blast = { radius: pw.radius, force: pw.force, done: false, direction: directional ? resolved.direction : undefined };
      return true;
    }
    case 'maw': m.mawScale = pw.scale; return true;
    case 'gravity': m.pull = pw.pull; return true;
    case 'second': m.secondChance = true; return true;
    case 'puppet': m.puppeteer = side; return true;
    default: return false;
  }
}

/** Shield, ball placement and rewinding time. */
function applyDefense(m: Match, kind: SkillKind, spec: KindCast, pw: Record<string, number>): boolean {
  switch (kind) {
    case 'shield': m.shield[spec.side] = true; return true;
    case 'nudge': {
      const c = m.cueBall();
      m.placing = 'nudge';
      m.nudgeRadius = pw.radius;
      m.nudgeOrigin = { x: c.x, y: c.y };
      return true;
    }
    case 'teleport': m.placing = 'anywhere'; return true;
    case 'rewind': if (m.snapshot) rewindShot(m); return true;
    default: return false;
  }
}

/** Instant and armed outplay families that are not ordinary buffs or hexes. */
function applyTrick(m: Match, kind: SkillKind, spec: KindCast, pw: Record<string, number>): boolean {
  const { side, slot, cast, turns } = spec;
  const opp = other(side);
  switch (kind) {
    case 'called': {
      const ball = calledTarget(m, side, cast?.pick);
      if (ball) {
        m.called = { by: side, ball: ball.id, shotsLeft: skillTurns(turns) };
        m.calledNow = m.state.turn === opp ? ball.id : null;
      }
      return !!ball;
    }
    case 'displace': {
      const moved = displaceBalls(m, side, pw.pockets);
      if (moved.length) m.emit({ type: 'displace', side, moved });
      return true;
    }
    case 'swap': {
      const swap = swapBalls(m, side);
      if (swap) m.emit({ type: 'swap', side, balls: swap.balls, at: swap.at });
      return true;
    }
    case 'decoy': {
      m.activeEffects.push({ kind, slot, cast: cast ?? {}, terrain: {}, segments: decoySegments(m, side, pw.count).flat(), target: opp, shotsLeft: skillTurns(turns) });
      m.syncObstacles();
      return true;
    }
    case 'counter': {
      m.activeEffects.push({ kind, slot, cast: cast ?? {}, terrain: {}, segments: [], target: side, shotsLeft: 1, amount: pw.amount });
      return true;
    }
    default: return false;
  }
}

/** The ball a called skill cast by `side` orders the opponent to hit first; shared by the match and its preview. */
export function calledTarget(m: Match, side: Side, pick?: { x: number; y: number }): BallLike | undefined {
  const ids = calledCandidates(m, other(side));
  if (!pick) return nearestPocketBall(m, ids);
  return m.balls.filter((b) => b.onTable && ids.includes(b.id)).sort((a, b) => Math.hypot(a.x - pick.x, a.y - pick.y) - Math.hypot(b.x - pick.x, b.y - pick.y))[0];
}

/** Balls the opponent may be ordered to hit first: their legal targets, or every object ball on a carom table. */
function calledCandidates(m: Match, opp: Side): number[] {
  const cue = m.cueId(opp);
  const ids = m.isCarom ? m.balls.filter((b) => b.onTable).map((b) => b.id) : m.legalTargets(opp);
  return ids.filter((id) => id !== cue);
}

function nearestPocketBall(m: Match, ids: number[]): BallLike | undefined {
  return m.balls.filter((b) => b.onTable && ids.includes(b.id)).sort((a, b) => pocketDistance(m, a) - pocketDistance(m, b))[0];
}

interface BallLike { id: number; x: number; y: number }

function pocketDistance(m: Match, b: BallLike): number {
  return Math.min(...m.table.pockets.map((p) => Math.hypot(b.x - p.ax, b.y - p.ay)));
}

/** Debuffs cast on the opponent; long families live in the shared hex list. */
function applyHex(m: Match, kind: SkillKind, spec: KindCast, pw: Record<string, number>): boolean {
  const { side, turns } = spec;
  const opp = other(side);
  switch (kind) {
    case 'drain': {
      const take = Math.min(m.energy[opp], pw.amount);
      m.energy[opp] -= take;
      m.energy[side] = Math.min(ENERGY_MAX, m.energy[side] + take);
      return true;
    }
    case 'chill': addHex(m.hexes, { kind, by: side, target: opp, value: pw.tremor, shotsLeft: skillTurns(turns) }); return true;
    case 'freeze': addHex(m.hexes, { kind, by: side, target: opp, value: pw.power, shotsLeft: skillTurns(turns) }); return true;
    case 'seal': addHex(m.hexes, { kind, by: side, target: opp, value: pw.pockets, shotsLeft: skillTurns(turns) }); return true;
    case 'blind': addHex(m.hexes, { kind, by: side, target: opp, value: 1, shotsLeft: skillTurns(turns) }); return true;
    case 'drift': addHex(m.hexes, { kind, by: side, target: opp, value: pw.angle, shotsLeft: skillTurns(turns), sense: spec.cast?.sense ?? 'cw' }); return true;
    default: return false;
  }
}

/** Hoàn Chỉ: put the match back where it stood before the caster's last shot. */
function rewindShot(m: Match) {
  const s = m.snapshot!;
  const energyNow = [...m.energy] as [number, number];
  m.balls = cloneBalls(s.balls);
  m.world.balls = m.balls;
  m.state = structuredClone(s.state);
  m.rackWins = [...s.rackWins] as [number, number];
  // Energy already spent on the rewind is kept spent; the opponent keeps what they had.
  m.energy = [s.side === 0 ? energyNow[0] : s.energy[0], s.side === 1 ? energyNow[1] : s.energy[1]];
  m.placing = s.ballInHand;
  m.closedPockets = s.closed;
  m.omen = null;
  m.omenPocket = null;
  m.syncObstacles();
  m.bombId = s.bombId;
  m.bombUsed = s.bombUsed;
  m.potted = s.potted;
  m.activeEffects = structuredClone(s.activeEffects);
  m.hexes = structuredClone(s.hexes);
  m.tremorNow = s.tremorNow;
  m.freezeNow = s.freezeNow;
  m.blindNow = s.blindNow;
  m.driftNow = s.driftNow;
  m.calledNow = s.calledNow;
  m.snapshot = null;
  m.lastRes = null;
  m.phase = 'aim';
  m.emit({ type: 'turn', side: m.state.turn });
}

/** Reset every shot-scoped buff once the shot is resolved. */
export function clearShotBuffs(m: Match) {
  m.eagle = false;
  m.triplePreview = false;
  m.reveal = false;
  m.spinBoost = 1;
  m.powerBoost = 1;
  m.blast = null;
  m.mawScale = 1;
  m.pull = 0;
  m.secondChance = false;
  m.world.captureScale = m.baseCapture;
  m.world.pocketPull = 0;
}
