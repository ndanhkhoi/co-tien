import { applySkillBlast, buildCast } from '../skill-cast';
import { powerToSpeed } from '../../core/cue-power';
import { cloneBalls, step, strike, type Ball, type PhysEvent } from '../../core/physics';
import { nearestCueSpot, respot } from '../../core/rack';
import { NO_SCORE, scoreShot, type ShotScore } from '../../core/shot-score';
import { groupOf } from '../../core/rules/eight-ball';
import { other, type OptionKind, type Resolution, type ShotSummary, type Side } from '../../core/rules/types';
import { advanceAssassin, gainEnergy, spendAssassin, ENERGY_PER_SHOT, ENERGY_PER_VALUE } from './energy';
import { endOmen } from './omen';
import { clearShotBuffs } from './skills';
import { spendTurnEffects } from './hexes';
import type { Match } from './match';
import type { ShotInput, Snapshot } from './types';

export function strikeShot(m: Match, input: ShotInput) {
  if (m.phase !== 'aim') return;
  const side = m.state.turn;
  const cue = m.cueBall();
  if (!cue.onTable) m.placeCue(m.table.headSpot.x, 0);
  m.snapshot = takeSnapshot(m, side);
  m.shotTargets = m.legalTargets(side);
  m.shotInput = input;
  m.shotEvents = [];
  m.stats[side].shots++;
  const { speed, miscue } = strikeCue(m, side, input, cue);
  armShotWorld(m, cue);
  beginRolling(m, side, speed, miscue);
}

/** Everything a rewind or a Luyện thế undo needs from before the shot. */
function takeSnapshot(m: Match, side: Side): Snapshot {
  return {
    side,
    balls: cloneBalls(m.balls),
    state: structuredClone(m.state),
    energy: [...m.energy] as [number, number],
    rackWins: [...m.rackWins] as [number, number],
    ballInHand: m.placing === 'nudge' ? 'none' : m.placing,
    closed: [...m.closedPockets],
    bombId: m.bombId,
    bombUsed: m.bombUsed,
    pushOutAvailable: m.state.pushOutAvailable,
    potted: [[...m.potted[0]], [...m.potted[1]]],
    activeEffects: structuredClone(m.activeEffects),
    hexes: structuredClone(m.hexes),
    tremorNow: m.tremorNow,
    freezeNow: m.freezeNow,
    blindNow: m.blindNow,
    driftNow: m.driftNow,
    calledNow: m.calledNow,
  };
}

/** Strike the cue ball: spin reach, the miscue roll, then the strike itself. */
function strikeCue(m: Match, side: Side, input: ShotInput, cue: Ball): { speed: number; miscue: boolean } {
  let { angle, power, side: sp, vert } = input;
  if (m.driftNow) angle += (m.hexes.find((e) => e.kind === 'drift' && e.target === side)?.sense === 'ccw' ? -1 : 1) * m.driftNow * Math.PI / 180;
  if (m.blast?.direction) m.blast.direction = { x: Math.cos(angle), y: Math.sin(angle) };
  const reach = m.spinReach(side);
  sp *= reach.side;
  vert *= reach.vert;
  let speed = powerToSpeed(power, m.vmax(side));
  const miscue = m.rng.next() < m.miscueChance((input.elevation ?? 0) > 0 ? sp : input.side, (input.elevation ?? 0) > 0 ? vert : input.vert, power, input.elevation);
  if (miscue) {
    speed *= m.rng.range(0.25, 0.5);
    angle += m.rng.range(-0.06, 0.06);
    sp = Math.sign(sp) * 0.3;
    vert = 0;
  }
  strike(cue, m.table.R, { angle, speed, side: sp, vert, elevation: miscue ? 0 : input.elevation });
  return { speed, miscue };
}

/** Shot buffs that act while the balls roll stay on until the shot resolves. */
function armShotWorld(m: Match, cue: Ball) {
  m.world.captureScale = m.mawScale * m.baseCapture * (m.omen?.capture ?? 1);
  m.world.terrain = m.terrain();
  m.syncObstacles();
  m.world.time = 0;
  if (m.omen?.jitter) shakeRestingBalls(m, cue, m.omen.jitter);
  m.world.pocketPull = m.pull;
  m.world.pullExempt = cue.id;
}

/** Địa Chấn: resting balls get a small kick in random directions when the shot starts. */
function shakeRestingBalls(m: Match, cue: Ball, jitter: number) {
  for (const b of m.balls) {
    if (!b.onTable || b.id === cue.id) continue;
    const a = m.rng.range(0, Math.PI * 2);
    const v = jitter * m.rng.range(0.4, 1);
    b.vx += Math.cos(a) * v;
    b.vy += Math.sin(a) * v;
  }
}

/** Everything that changes the moment the cue ball is struck. */
function beginRolling(m: Match, side: Side, speed: number, miscue: boolean) {
  const cd = m.cooldown[side];
  cd[0] = Math.max(0, cd[0] - 1);
  cd[1] = Math.max(0, cd[1] - 1);
  m.eagle = false;
  m.reveal = false;
  m.spinBoost = 1;
  m.tremorNow = 1;
  m.freezeNow = 1;
  m.placing = 'none';
  m.nudgeOrigin = null;
  m.aimLock = null;
  spendAssassin(m, side);
  m.phase = 'rolling';
  m.emit({ type: 'shot', side, speed, miscue });
}

/** Advance the simulation; call every frame while rolling. */
export function updateSimulation(m: Match, dt: number) {
  if (m.phase !== 'rolling') return;
  const frame: PhysEvent[] = [];
  const moving = step(m.world, dt, frame);
  for (const e of frame) {
    m.shotEvents.push(e);
    m.emit({ type: 'phys', e });
    if (e.t === 'ball' && !m.bombUsed && (e.a === m.bombId || e.b === m.bombId) && e.speed > 1.1) explode(m);
    const cueId = m.cueId();
    if (e.t === 'ball' && m.blast && !m.blast.done && (e.a === cueId || e.b === cueId)) {
      m.blast.done = true;
      applySkillBlast(m.balls, e, m.blast);
      m.emit({ type: 'explode', x: e.x, y: e.y });
    }
  }
  if (!moving) m.finishShot();
}

/** Bộc Nổ mutator: the bomb ball explodes on its first hard contact. */
function explode(m: Match) {
  const bomb = m.balls.find((b) => b.id === m.bombId);
  if (!bomb || !bomb.onTable) return;
  m.bombUsed = true;
  const radius = 0.38;
  for (const b of m.balls) {
    if (b === bomb || !b.onTable) continue;
    const dx = b.x - bomb.x;
    const dy = b.y - bomb.y;
    const d = Math.hypot(dx, dy);
    if (d > radius || d === 0) continue;
    const k = ((radius - d) / radius) * 3.2;
    b.vx += (dx / d) * k;
    b.vy += (dy / d) * k;
  }
  m.emit({ type: 'explode', x: bomb.x, y: bomb.y });
}

/** Challenge mode: the setup's own judge decides win or lose. */
export function finishChallengeShot(m: Match, side: Side, shot: ShotSummary) {
  const verdict = shot.offTable?.length
    ? { ok: false, why: 'Bi văng khỏi bàn' }
    : m.setup.judge!(shot, m.balls);
  const res: Resolution = {
    foul: verdict.ok ? null : verdict.why, keepTurn: false, ballInHand: 'none', respot: [],
    winner: verdict.ok ? 0 : 1, messages: [verdict.why], points: 0, highlight: verdict.ok ? 'win' : undefined,
  };
  m.lastRes = res;
  m.lastShooter = side;
  m.phase = 'rack-over';
  m.emit({ type: 'resolved', res, side });
  m.emit({ type: 'rack-over', winner: res.winner! });
}

/** Resolve the shot by the rules of the game mode. */
export function finishRulesShot(m: Match, side: Side, shot: ShotSummary) {
  const res = resolveShot(m, side, shot);
  respotForResolution(m, res, side);
  applyShotScore(m, side, res);
  rewardShot(m, side, res, shot);
  closeShot(m, side, res);
}

/** Adjust the raw resolution: Tái chiến and Hộ thể can still save the shot. */
function resolveShot(m: Match, side: Side, shot: ShotSummary): Resolution {
  const res = m.rules.resolve(m.state, m.balls, shot);
  m.activeEffects = m.activeEffects.filter(e => e.target !== side);
  spendTurnEffects(m, side);
  endOmen(m);
  calledFoul(m, shot, res);
  if (!res.foul && !res.keepTurn && !res.option && res.winner === null && m.secondChance) {
    res.keepTurn = true;
    res.messages.unshift('Tái chiến: được đánh tiếp!');
  }
  clearShotBuffs(m);
  const puppeted = spendPuppet(m, side, res);
  if (res.foul && !puppeted && m.shield[side] && res.winner === null) {
    m.shield[side] = false;
    res.messages.unshift('Hộ thể đỡ lỗi: không mất bi trong tay');
    res.ballInHand = 'none';
    res.option = undefined;
    res.foul = null;
  }
  return res;
}

function calledFoul(m: Match, shot: ShotSummary, res: Resolution): void {
  const called = m.calledNow;
  if (called === null || shot.firstHit === called || res.winner !== null) return;
  res.foul = `Chạm sai bi trước: phải chạm bi ${called} theo chiêu chỉ định`;
  res.ballInHand = 'anywhere';
  res.keepTurn = false;
  res.option = undefined;
  res.messages.unshift(res.foul);
}

/** Mị Cơ: the forced shot never fouls, never wins the rack for the caster, and hands the turn back. */
function spendPuppet(m: Match, side: Side, res: Resolution): boolean {
  if (m.puppeteer !== other(side)) return false;
  const caster = m.puppeteer;
  m.puppeteer = null;
  if (res.winner === caster) {
    res.winner = null;
    const key = m.balls.find((b) => b.id === 8 && !b.onTable);
    if (key && m.setup.mode === 'eight' && !res.respot.includes(8)) res.respot.push(8);
  }
  if (res.winner !== null) return true;
  res.foul = null;
  res.ballInHand = 'none';
  res.option = undefined;
  res.keepTurn = false;
  res.messages.unshift('Khuynh thành: cú đánh hộ không tính lỗi, lượt về người thi triển');
  return true;
}

/** Bring back every ball the resolution respots; a scratched cue returns in hand. */
function respotForResolution(m: Match, res: Resolution, side: Side) {
  for (const id of res.respot) {
    const ball = m.balls.find(b => b.id === id);
    if (m.rules.table === 'carom' && ball) {
      const spot = id === 2 ? m.table.footSpot : m.table.headSpot;
      const y = spot.y + (id === m.cueId(side) ? 0.1825 : 0);
      Object.assign(ball, nearestSpot(m, id, spot.x, y));
      ball.onTable = true;
      ball.vx = ball.vy = ball.wx = ball.wy = ball.wz = 0;
    } else respot(m.table, m.balls, id);
    if (ball) ball.z = ball.vz = 0;
  }
  const cue = m.cueBall(side);
  if (!cue.onTable) returnCueBall(m, cue);
}

/** Where ball `id` may rest nearest (x, y), clear of the other balls. */
function nearestSpot(m: Match, id: number, x: number, y: number) {
  return nearestCueSpot({ table: m.table, balls: m.balls, cueId: id, kitchen: false }, x, y);
}

/** A scratched cue ball comes back at the head spot, stopped. */
export function returnCueBall(m: Match, cue: Ball) {
  cue.onTable = true;
  cue.z = cue.vz = 0;
  Object.assign(cue, nearestSpot(m, cue.id, m.table.headSpot.x, 0));
}

/** Eight-ball groups and the running score the resolution awards. */
function applyShotScore(m: Match, side: Side, res: Resolution) {
  const st = m.state;
  if (res.assignGroup) {
    st.groups[side] = res.assignGroup;
    st.groups[other(side)] = res.assignGroup === 'solid' ? 'stripe' : 'solid';
  }
  st.scores[side] += res.points;
  st.fouls[side] = res.foul ? st.fouls[side] + 1 : 0;
}

/** Stats, energy and the Ảnh Sát run the shot earns. */
function rewardShot(m: Match, side: Side, res: Resolution, shot: ShotSummary) {
  const st = m.state;
  const s = m.stats[side];
  const potted = shot.pocketed.filter((p) => p.id !== 0 && !res.respot.includes(p.id));
  for (const p of potted) m.potted[side].push(p.id);
  const own = ownPots(m, side, potted.map((p) => p.id));
  if (res.foul) s.fouls++;
  s.pots += own.length + res.points;
  // Energy pays for how hard and pretty the shot was, not only for how many balls dropped.
  const score = res.foul ? judgeShot(m, [], 0, st.isBreak) : judgeShot(m, own, res.points, st.isBreak);
  const gain = score.value * ENERGY_PER_VALUE * (0.8 + 0.1 * m.setup.players[side].cue.energy);
  advanceAssassin(m, side, !res.foul && res.keepTurn ? score : NO_SCORE);
  sandGift(m, side, res);
  const total = m.homeSide(side) ? gain * 1.2 : gain;
  if (!m.setup.classic) {
    gainEnergy(m, side, total + ENERGY_PER_SHOT);
    if (res.foul) gainEnergy(m, other(side), 12);
  }
  if (res.keepTurn && (own.length > 0 || res.points > 0)) {
    s.run++;
    s.bestRun = Math.max(s.bestRun, s.run);
  } else {
    s.run = 0;
  }
}

/** Sử Chủ leaves a sand patch where the cue ball stopped, for the opponent. */
function sandGift(m: Match, side: Side, res: Resolution) {
  if (m.passive(side) !== 'chusu' || res.foul || res.keepTurn || res.option || res.winner !== null) return;
  const cue = m.cueBall(side);
  m.activeEffects.push({
    ...buildCast('sand', 1, -1, { table: m.table, balls: m.balls, cueId: m.cueId(side), cast: { point: { x: cue.x, y: cue.y } } }),
    target: other(side), shotsLeft: 1,
  });
}

/** Break flags, the resolution event, and who shoots next. */
function closeShot(m: Match, side: Side, res: Resolution) {
  const st = m.state;
  const wasBreak = st.isBreak;
  st.isBreak = false;
  st.pushOutAvailable = wasBreak && !res.foul && !res.option && res.winner === null && (st.mode === 'nine' || st.mode === 'ten');
  m.lastRes = res;
  m.lastShooter = side;
  m.emit({ type: 'resolved', res, side });
  if (res.winner !== null) return endRack(m, res.winner);
  if (res.option) return handOverOption(m, side, res.option);
  if (m.isCarom && !res.keepTurn) st.innings++;
  st.turn = res.keepTurn ? side : other(side);
  m.placing = res.keepTurn ? 'none' : res.ballInHand;
  if (m.placing !== 'none') {
    const c = m.cueBall();
    Object.assign(c, nearestCueSpot({
      table: m.table, balls: m.balls, cueId: c.id, kitchen: m.placing === 'kitchen',
    }, c.x, c.y));
  }
  m.beginTurn();
}

/** The rack is over: count the win and end the rack or the whole match. */
function endRack(m: Match, winner: Side) {
  m.rackWins[winner]++;
  const done = m.rackWins[winner] >= m.setup.raceTo;
  m.phase = done ? 'match-over' : 'rack-over';
  m.emit({ type: 'rack-over', winner });
  if (done) m.emit({ type: 'match-over', winner });
}

/** A rules question (push-out, illegal break) goes to the other side. */
function handOverOption(m: Match, side: Side, option: OptionKind) {
  const opp = other(side);
  m.state.turn = opp;
  m.state.pendingOption = option;
  m.placing = 'none';
  m.phase = 'option';
  m.emit({ type: 'turn', side: opp });
}

/** Difficulty and beauty of the shot that just ended (see shot-score.ts). */
export function judgeShot(m: Match, counted: number[], points: number, isBreak: boolean): ShotScore {
  m.lastScore = scoreShot({
    table: m.table, before: m.snapshot?.balls ?? m.balls, events: m.shotEvents, cueId: m.cueId(m.state.turn),
    counted, points, isBreak, elevation: m.shotInput?.elevation ?? 0,
  });
  return m.lastScore;
}

/** Balls this side may legitimately claim for its stats (eight-ball groups). */
function ownPots(m: Match, side: Side, ids: number[]): number[] {
  if (m.setup.mode !== 'eight') return ids;
  const g = m.state.groups[side];
  return ids.filter((id) => g === null || groupOf(id) === g || id === 8);
}
