import type { Resolution, Side } from '../../../core/rules/types';
import { other } from '../../../core/rules/types';
import { champion } from '../../../game/content/sects';
import { RULES_TEXT } from '../../../game/content/rules-text';
import { MODE_NAMES } from '../../../core/rules';
import { forceStrength } from '../../../game/terrain';
import { ENERGY_MAX } from '../../../game/match';
import { sound } from '../../../audio/sound';
import { haptic } from '../../../platform/device';
import { playFinisher } from '../../finisher';
import { hintOnce } from '../../hints';
import { h } from '../../dom';
import { icon } from '../../icons';
import type { MatchCtx } from './context';
import type { MatchDom } from './dom';
import type { HeraldMsg } from './herald';

type MatchEvent = Parameters<Parameters<MatchCtx['match']['on']>[0]>[0];

interface EventDeps {
  herald(m: HeraldMsg): void;
  setExpr(side: Side, e: 'focus' | 'joy' | 'sad' | 'cast', ms?: number): void;
  floatGain(side: Side, gain: number): void;
  scheduleHud(): void;
  hideSkillNudge(): void;
  onResolved(r: Resolution, side: Side): void;
  onTurn(): void;
  onRackOver(winner: Side): void;
}

export function subscribeMatch(ctx: MatchCtx, dom: MatchDom, deps: EventDeps): () => void {
  return ctx.match.on((e) => {
    handleEvent(ctx, dom, deps, e);
    if (e.type !== 'phys') deps.scheduleHud();
  });
}

function handleEvent(ctx: MatchCtx, dom: MatchDom, deps: EventDeps, e: MatchEvent): void {
  switch (e.type) {
    case 'phys': return physical(ctx, e.e, deps.herald);
    case 'shot': return shot(ctx, deps, e);
    case 'explode': return explode(ctx, e);
    case 'energy': return energy(ctx, dom, e, deps);
    case 'skill': return skill(ctx, deps, e);
    case 'omen': return omen(ctx, dom, e, deps.herald);
    case 'resolved': return deps.onResolved(e.res, e.side);
    case 'turn': return deps.onTurn();
    case 'new-rack': return newRack(ctx, dom, deps);
    case 'displace': return displace(ctx, e);
    case 'swap': return swap(ctx, e);
    case 'rack-over': return rackOver(ctx, dom, deps, e.winner);
  }
}

function physical(ctx: MatchCtx, p: Extract<MatchEvent, { type: 'phys' }>['e'], herald: EventDeps['herald']): void {
  if (p.t === 'ball') {
    sound.ballHit(p.speed);
    if (p.speed > 2.4) ctx.view.burst(p.x, p.y, { color: 0xffffff, count: 3, speed: 0.4, size: 0.008 });
  } else if (p.t === 'cushion') sound.cushion(p.speed);
  else if (p.t === 'pocket') pocket(ctx, p);
  else if (p.t === 'off-table') offTable(ctx, p, herald);
}

function pocket(ctx: MatchCtx, p: { pocket: number; id: number; speed: number }): void {
  sound.pocket(p.speed);
  haptic(18);
  const pk = ctx.match.table.pockets[p.pocket];
  ctx.view.ring(pk.hx, pk.hy, p.id === 0 ? 0xff5a4e : 0xffe08a, 0.03);
}

function offTable(ctx: MatchCtx, p: { id: number }, herald: EventDeps['herald']): void {
  haptic([25, 35, 25]);
  herald({ side: ctx.match.turn, tone: 'red', title: p.id === 0 ? 'Bi cái văng khỏi bàn' : `Bi ${p.id} văng khỏi bàn`, line: 'Cú đánh được xử lý theo luật lỗi văng bi.' });
}

function shot(ctx: MatchCtx, deps: EventDeps, e: Extract<MatchEvent, { type: 'shot' }>): void {
  ctx.turn.pottedBefore[0] = ctx.match.potted[0].length;
  ctx.turn.pottedBefore[1] = ctx.match.potted[1].length;
  if (e.miscue) {
    sound.miscue();
    deps.setExpr(e.side, 'sad');
    deps.herald({ side: e.side, expr: 'sad', tone: 'red', title: 'Trượt cơ!', line: 'Đầu cơ trượt khỏi bi cái' });
    haptic([30, 30, 60]);
  } else {
    sound.cueStrike(Math.min(1, e.speed / 7));
    haptic(Math.round(10 + e.speed * 5));
  }
  if (e.speed > 6.5) ctx.view.addShake(0.7);
}

function explode(ctx: MatchCtx, e: Extract<MatchEvent, { type: 'explode' }>): void {
  sound.explode();
  ctx.view.ring(e.x, e.y, 0xb23a26, 0.4);
  ctx.view.burst(e.x, e.y, { color: 0x1c1a17, count: 30, speed: 1.5, size: 0.02 });
  ctx.view.addShake(1.1);
  haptic([40, 20, 80]);
}

function energy(ctx: MatchCtx, dom: MatchDom, e: Extract<MatchEvent, { type: 'energy' }>, deps: EventDeps): void {
  deps.floatGain(e.side, e.gain);
  if (!ctx.hasSkills || ctx.match.setup.players[e.side].kind !== 'human') return;
  const full = e.total >= ENERGY_MAX;
  if (full && !ctx.turn.ultAnnounced[e.side]) announceUltimate(ctx, e.side, deps.herald);
  ctx.turn.ultAnnounced[e.side] = full;
  hintOnce(ctx.app, { key: 'energy', title: 'Năng lượng', text: 'Mỗi cú +6, mỗi bi vào +11, cú khó còn thêm. Đầy vòng (100) thì dùng tuyệt chiêu.',
    anchor: () => dom.cards[e.side].ringWrap, place: e.side === 0 ? 'right' : 'left', alignTop: true });
}

function announceUltimate(ctx: MatchCtx, side: Side, herald: EventDeps['herald']): void {
  const ult = champion(ctx.match.setup.players[side].champion).skills[2];
  herald({ side, expr: 'focus', title: 'Tuyệt chiêu đã đầy', line: `${ult.name}: chạm ô tuyệt chiêu để chuẩn bị`, ms: 3200 });
}

function skill(ctx: MatchCtx, deps: EventDeps, e: Extract<MatchEvent, { type: 'skill' }>): void {
  ctx.turn.skillIdle[e.side] = 0;
  deps.hideSkillNudge();
  if (e.slot !== 2) sound.skill(); // the ultimate cut-in plays its own gong
  if (e.slot === 2) ctx.skill.pendingUltimate = { champion: e.champion, skill: e.skill, side: e.side };
  deps.setExpr(e.side, 'cast', 2400);
  const human = ctx.match.setup.players[e.side].kind === 'human';
  deps.herald({ side: e.side, expr: 'cast', title: e.skill.name, line: e.slot === 2 ? (human ? 'Đã chuẩn bị · bấm ĐÁNH để thi triển' : 'Đã chuẩn bị · chờ cú đánh') : `${ctx.match.setup.players[e.side].name} dùng chiêu` });
  if (e.skill.kinds.includes('rewind')) ctx.view.clearTransient();
  announceQuake(ctx, deps, e);
  if (e.slot !== 2) {
    ctx.view.skillFx(e.champion, e.skill, e.side);
    haptic(25);
  }
}

function displace(ctx: MatchCtx, e: Extract<MatchEvent, { type: 'displace' }>): void {
  ctx.view.slideBalls(e.moved);
}

function swap(ctx: MatchCtx, e: Extract<MatchEvent, { type: 'swap' }>): void {
  const b = ctx.match.balls;
  ctx.view.slideBalls(e.balls.map((id, i) => {
    const ball = b.find((x) => x.id === id);
    return { id, from: e.at[i], to: ball ? { x: ball.x, y: ball.y } : e.at[i] };
  }));
}

/** Địa Chấn is announced before the shot with the same direction wording as wind. */
function announceQuake(ctx: MatchCtx, deps: EventDeps, e: Extract<MatchEvent, { type: 'skill' }>): void {
  const force = ctx.match.activeEffects.find((x) => x.kind === 'quake')?.terrain.forces?.[0];
  if (!e.skill.kinds.includes('quake') || !force) return;
  deps.herald({ side: e.side, icon: 'warning', title: 'Địa Chấn', line: `${forceDirection(force)} Bốn lỗ tránh văng bi (1,2 giây đầu).`, ms: 4200 });
}

function omen(ctx: MatchCtx, dom: MatchDom, e: Extract<MatchEvent, { type: 'omen' }>, herald: EventDeps['herald']): void {
  sound.omen();
  hintOnce(ctx.app, { key: 'omen', title: 'Thiên Tượng', text: 'Gió, tuyết, rễ cây… tác động đường bi trong một cú đánh. Quan sát dấu trên nỉ để tính đường cơ.',
    anchor: () => (ctx.lefty ? dom.ctrl : dom.dock), place: 'right', highlight: false, rail: true });
  herald({ side: null, icon: 'warning', title: e.omen.name, line: [e.omen.desc, forceDirection(e.omen.terrain?.force)].filter(Boolean).join(' '), ms: 4200 });
  ctx.view.addShake(e.omen.jitter ? 0.6 : 0.2);
}

function newRack(ctx: MatchCtx, dom: MatchDom, deps: EventDeps): void {
  ctx.view.clearTransient();
  // A sentinel, not '': an empty potted list also keys to '' and would never repaint.
  for (const c of dom.cards) c.key = '\u0000';
  ctx.turn.pottedBefore[0] = ctx.turn.pottedBefore[1] = 0;
  ctx.flags.lastTurnSide = null;
  ctx.turn.ultAnnounced[0] = ctx.turn.ultAnnounced[1] = false;
  ctx.turn.skillIdle[0] = ctx.turn.skillIdle[1] = 0;
  deps.hideSkillNudge();
}

function rackOver(ctx: MatchCtx, dom: MatchDom, deps: EventDeps, w: Side): void {
  const announce = () => {
    if (ctx.flags.disposed) return;
    if (!ctx.opts.challenge) {
      deps.setExpr(w, 'joy', 5000);
      deps.setExpr(other(w), 'sad', 5000);
      deps.herald({ side: w, expr: 'joy', title: `${ctx.match.setup.players[w].name} thắng ván`, line: ctx.match.lastRes?.messages.join(' ') || undefined, ms: 3000, important: true });
    }
    setTimeout(() => deps.onRackOver(w), ctx.opts.challenge ? 700 : 1100);
  };
  // Kết liễu: a rack won by the winner's own clean shot gets their finishing strike first.
  if (!ctx.opts.challenge && ctx.match.lastShooter === w && !ctx.match.lastRes?.foul) {
    deps.hideSkillNudge();
    void playFinisher({ stage: dom.el, champion: champion(ctx.match.setup.players[w].champion), feats: ctx.match.lastScore.names, ball: finalBall(ctx), fromRight: w === 1 }).then(announce);
  } else announce();
}

export function onResolved(x: { ctx: MatchCtx; dom: MatchDom; deps: EventDeps; r: Resolution; side: Side }): void {
  const { ctx, dom, deps, r, side } = x;
  if (dom.desk) return dom.desk.resolved();
  const potN = Math.max(0, ctx.match.potted[side].length - ctx.turn.pottedBefore[side]);
  if (r.foul && !ctx.opts.challenge) resolvedFoul(ctx, dom, deps, { r, side });
  else if (r.winner === null && (potN > 0 || r.points > 0) && r.keepTurn) resolvedGood({ ctx, deps, r, side, potN });
  else if (r.winner === null && r.messages.length) {
    if (!r.foul && (r.keepTurn || r.points)) sound.good();
    deps.herald({ side, title: r.messages[0], line: r.messages.slice(1).join(' ') || undefined });
  }
  maybeRewind(ctx, r, side);
}

function resolvedFoul(ctx: MatchCtx, dom: MatchDom, deps: EventDeps, x: { r: Resolution; side: Side }): void {
  const { r, side } = x;
  // Kept separate because the foul hint and announcement share this exact wording.
  sound.foul();
  deps.setExpr(side, 'sad', 3000);
  deps.herald({ side, expr: 'sad', tone: 'red', title: r.ballInHand !== 'none' ? 'Phạm lỗi, đối thủ được đặt bi' : 'Phạm lỗi', line: r.foul ?? '', ms: 3400 });
  hintOnce(ctx.app, { key: 'foul', title: 'Phạm lỗi', text: 'Đối thủ được đặt bi cái sau lỗi; họ có thể đặt trong vùng cho phép rồi đánh. Xem lý do trong thông báo giữa bàn.',
    anchor: () => (ctx.lefty ? dom.ctrl : dom.dock), place: 'right', highlight: false, rail: true });
}

function resolvedGood(x: { ctx: MatchCtx; deps: EventDeps; r: Resolution; side: Side; potN: number }): void {
  const { ctx, deps, r, side, potN } = x;
  sound.good();
  deps.setExpr(side, 'joy');
  // A hard or pretty shot is named, so players see what earned the extra energy.
  const sc = ctx.match.lastScore;
  const title = r.highlight === 'golden' ? 'Bi vàng!' : sc.tier === 2 ? 'Tuyệt kỹ!' : sc.tier === 1 ? 'Cú đẹp!' : ctx.match.isCarom ? 'Ghi điểm!' : potN > 1 ? `Ăn ${potN} bi!` : 'Ăn bi!';
  const feats = sc.names.join(' · ');
  deps.herald({ side, expr: 'joy', title, line: [feats, r.messages.join(' ')].filter(Boolean).join(' — ') || 'Đánh tiếp' });
}

function maybeRewind(ctx: MatchCtx, r: Resolution, side: Side): void {
  const p = ctx.match.setup.players[side];
  const rewindSlot = ctx.match.setup.classic ? -1 : ctx.match.skills(side).findIndex((sk) => sk.kinds[0] === 'rewind');
  if (p.kind === 'ai' && !r.keepTurn && r.winner !== side && rewindSlot >= 0 && (p.ai?.level ?? 1) >= 3) {
    const token = ctx.flags.aiToken;
    setTimeout(() => {
      if (ctx.flags.disposed || token !== ctx.flags.aiToken) return;
      if (ctx.rng.next() < 0.6 && ctx.match.canUseSkill(side, rewindSlot)) ctx.match.useSkill(side, rewindSlot);
    }, 800);
  }
}

/** A force on the cloth in words, as the player sees the table: "thổi sang phải, chếch xuống". */
function forceDirection(f?: { x: number; y: number }): string {
  if (!f || !Math.hypot(f.x, f.y)) return '';
  const deg = (Math.atan2(f.y, f.x) * 180) / Math.PI;
  const names = ['sang phải', 'chếch phải xuống', 'xuống dưới', 'chếch trái xuống', 'sang trái', 'chếch trái lên', 'lên trên', 'chếch phải lên'];
  return `Hướng: ${names[((Math.round(deg / 45) % 8) + 8) % 8]}, sức ${forceStrength(f)} (theo mũi tên trên nỉ).`;
}

/** The ball that decided the rack: the last one pocketed, or a carom's second ball. */
function finalBall(ctx: MatchCtx): { src: string; caption: string } | null {
  const { match, view } = ctx;
  const shot = match.lastShot;
  if (!shot) return null;
  const cue = match.cueId(match.lastShooter);
  const potted = shot.pocketed.filter((p) => p.id !== cue);
  const last = potted[potted.length - 1];
  const id = last?.id ?? (match.isCarom ? shot.cueContacts[1] : undefined);
  if (id === undefined) return null;
  const caption = match.isCarom ? 'Ghi điểm quyết định' : `Bi ${id} vào ${POCKET_NAMES[last!.pocket]}`;
  return { src: view.ballPortrait(id, 112), caption };
}

const POCKET_NAMES = ['lỗ góc trên trái', 'lỗ giữa trên', 'lỗ góc trên phải', 'lỗ góc dưới trái', 'lỗ giữa dưới', 'lỗ góc dưới phải'];

/** First-time explanations, queued in the top strip, outside the playing surface. */
export function coachTurn(ctx: MatchCtx, dom: MatchDom, humanSide: Side | null): void {
  if (ctx.solo) return;
  const mode = ctx.match.setup.mode;
  if (ctx.hasSkills) hintOnce(ctx.app, { key: 'energy', title: 'Năng lượng', text: 'Mỗi cú +6, mỗi bi vào +11, cú khó còn thêm. Đầy vòng (100) thì dùng tuyệt chiêu.',
    anchor: () => dom.cards[humanSide ?? ctx.match.turn].ringWrap, place: (humanSide ?? ctx.match.turn) === 0 ? 'right' : 'left', alignTop: true });
  const beside = ctx.lefty ? 'right' : 'left';
  hintOnce(ctx.app, { key: `rules-${mode}`, title: `Luật ${MODE_NAMES[mode]}`, text: `${RULES_TEXT[mode].goal} Xem menu tạm dừng, mục Luật chơi.`, anchor: () => (ctx.lefty ? dom.ctrl : dom.dock), place: 'right', highlight: false, rail: true });
  hintOnce(ctx.app, { key: 'ctl-aim', title: 'Ngắm', text: h('span', null, 'Kéo trên bàn để xoay cơ, chạm bi để ngắm thẳng. ', icon('rotate-left'), icon('rotate-right'), ' chỉnh từng chút, ', icon('switch-target'), ' đổi mục tiêu.'),
    anchor: () => dom.ctrl, place: beside, rail: true, alignTop: true });
  hintOnce(ctx.app, { key: 'ctl-power', title: 'Lực và đánh', text: 'Chạm thanh lực để đặt mức, kéo để tinh chỉnh, rồi chạm ĐÁNH. Hoặc giữ ĐÁNH và thả đúng lực; trượt ngón ra xa để huỷ.',
    anchor: () => dom.powerBar, place: beside });
  if (ctx.match.canMoveCue) hintOnce(ctx.app, { key: 'ctl-ballinhand', title: ctx.match.state.isBreak ? 'Đặt bi phá' : 'Đặt bi cái', text: 'Kéo bi cái hoặc chạm bàn để dời bi. Dùng nút hướng để chỉnh nhỏ. Chọn Ngắm thử để chỉnh hướng và xem đường bi trước khi bấm ĐẶT BI.',
    anchor: () => dom.dpad, place: beside });
  if (ctx.match.callType() !== 'none') hintOnce(ctx.app, { key: 'call', title: 'Gọi lỗ', text: 'Chạm bi và lỗ định đánh trước khi ra cơ. Bi vào lỗ khác không được tính.',
    anchor: () => dom.objPlate, place: 'below' });
}

