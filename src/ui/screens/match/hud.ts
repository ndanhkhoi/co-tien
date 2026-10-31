import { MODE_NAMES, raceName } from '../../../core/rules';
import type { Side } from '../../../core/rules/types';
import { ballCss } from '../../../core/ball-styles';
import { ASSASSIN_RUN, ASSASSIN_VALUE, ENERGY_MAX } from '../../../game/match';
import { classInfo } from '../../../game/content/sects';
import { h, tap } from '../../dom';
import { icon } from '../../icons';
import type { MatchCtx } from './context';
import type { MatchDom, CardView } from './dom';
import { canInspectSkills } from './skill';
import { controllerIsHuman, shotController } from './controller';
import { hexChips } from './hex-chips';
import type { Sheets } from './sheet';

export function miniBall(id: number): HTMLElement {
  const col = ballCss('pool', id);
  return h('i.mx-ball', { class: id > 8 ? 'stripe' : '', style: `--c:${col}`, title: `Bi ${id}` });
}

// A ball with its number painted on a white spot, so ball and number never wrap apart.
// Tapping it names the ball on the cloth, as tapping the ball itself does.
function numberedBall(id: number, showTag: (id: number) => void): HTMLElement {
  const ball = miniBall(id);
  ball.append(h('b', null, String(id)));
  return tap(h('button.mx-next-ball', { 'aria-label': `Bi ${id}: chạm để xem trên bàn` }, ball), () => showTag(id));
}

export interface HudDeps {
  renderSkills(): void;
  renderControls(): void;
  showBallTag(id: number): void;
  canAct(): boolean;
  placingNow(): boolean;
  renderHud(): void;
}

export function createHud(ctx: MatchCtx, dom: MatchDom, sheets: Sheets, deps: HudDeps): { render(): void; renderControls(): void; renderChips(): void } {
  return {
    render: () => renderHud(ctx, dom, sheets, deps),
    renderControls: () => renderControls(ctx, dom, deps),
    renderChips: () => renderChips(ctx, dom, deps),
  };
}

function renderHud(ctx: MatchCtx, dom: MatchDom, sheets: Sheets, deps: HudDeps): void {
  renderPassive(ctx, dom);
  for (const s of [0, 1] as Side[]) renderCard(ctx, dom, s);
  renderNextBall(ctx, dom, deps.showBallTag);
  renderObjective(ctx, dom);
  deps.renderSkills();
  dom.desk?.render();
  renderChips(ctx, dom, deps);
  renderControls(ctx, dom, deps);
  sheets.skill?.refresh?.();
}

function renderPassive(ctx: MatchCtx, dom: MatchDom): void {
  const { match } = ctx;
  const controller = shotController(match);
  const cls = match.passive(controller);
  // Hide the passive only when there is none: between shots it keeps its room (just invisible)
  // so the power bar and ĐÁNH above it never jump.
  dom.passiveChip.hidden = !cls;
  dom.passiveChip.classList.toggle('idle', !controllerIsHuman(match) || match.phase !== 'aim');
  const passiveLabels: Record<string, string> = {
    thanxa: match.aimLock ? 'Đã khoá ngắm · chạm để mở' : 'Khoá ngắm',
    cuongchien: 'Tăng lực · giảm xoáy',
    phaptu: match.spinAxis[controller] === 'side' ? 'Ưu tiên áp phê ngang' : 'Ưu tiên kéo / đẩy',
    hophap: match.guardUsed[controller] ? 'Đã dùng băng mềm' : 'Đặt băng mềm',
    chusu: 'Cú thủ hợp lệ để lại cát',
    anhsat: match.assassinReady[controller] ? (match.assassinChoice[controller] === 'info' ? 'Liên hoàn · xem đường' : 'Liên hoàn · thêm lực') : `Chuỗi ${match.assassinStreak[controller]}/${ASSASSIN_RUN} bi · ${match.assassinValue[controller].toFixed(1).replace('.', ',')}/${ASSASSIN_VALUE} điểm`,
    luanhoi: 'Luân phiên chiêu · hồi nhanh',
  };
  const passiveName = cls ? classInfo(cls).name : '';
  dom.passiveChip.replaceChildren(h('span.mx-passive-name', null, passiveName), h('span.mx-passive-detail', null, cls ? passiveLabels[cls] : ''));
  dom.passiveChip.setAttribute('aria-label', cls ? `${passiveName}: ${passiveLabels[cls]}` : 'Nội tại');
}

function renderCard(ctx: MatchCtx, dom: MatchDom, s: Side): void {
  const { match, opts, solo, hasSkills, turn: turnState } = ctx;
  const st = match.state;
  const c = dom.cards[s];
  const carom = match.isCarom;
  c.el.classList.toggle('active', shotController(match) === s && match.phase !== 'match-over');
  c.score.textContent = dom.desk ? dom.desk.card().score : opts.challenge ? `${turnState.attempt}/${opts.challenge.tries}` : carom ? `${st.scores[s]}/${st.caromTarget}` : String(match.rackWins[s]);
  c.sub.replaceChildren();
  renderCardSub(ctx, dom, s);
  if (!carom && !solo) renderPotted(ctx, c, s);
  const e = Math.round(match.energy[s]);
  c.ring.style.setProperty('--e', String((e / ENERGY_MAX) * 100));
  c.epill.textContent = `${e}%`;
  c.ringWrap.setAttribute('aria-label', `Năng lượng ${match.setup.players[s].name}: ${e}/${ENERGY_MAX}`);
  c.ringWrap.classList.toggle('full', hasSkills && e >= ENERGY_MAX);
  renderHexes(ctx, c, s);
}

function renderHexes(ctx: MatchCtx, c: CardView, s: Side): void {
  const chips = hexChips(ctx.match)[s];
  const key = chips.map((x) => `${x.icon}|${x.label}|${x.shotsLeft}`).join(';');
  if (key === c.hexKey) return;
  c.hexKey = key;
  c.hexes.replaceChildren(...chips.map((x) => h('span.mx-hex', {
    title: `${x.label}: còn ${x.shotsLeft} lượt`,
    'aria-label': `${x.label}, còn ${x.shotsLeft} lượt`,
  }, icon(x.icon), h('b', null, `${x.shotsLeft}`))));
  c.hexes.classList.toggle('has', chips.length > 0);
}

function renderCardSub(ctx: MatchCtx, dom: MatchDom, s: Side): void {
  const { match, opts } = ctx;
  const c = dom.cards[s];
  if (dom.desk) c.sub.append(dom.desk.card().sub);
  else if (opts.challenge) c.sub.append('lượt thử');
  else if (match.setup.mode === 'eight') renderEightSub(ctx, c, s);
  else if (match.isCarom) c.sub.append(`ván ${match.rackWins[s]}/${match.setup.raceTo}`);
  else renderFoulSub(ctx, c, s);
}

function renderEightSub(ctx: MatchCtx, c: CardView, s: Side): void {
  const { match } = ctx;
  const st = match.state;
  const g = st.groups[s];
  if (g === null) {
    c.sub.append(st.isBreak ? (match.breaker === s ? 'Phá bi' : '') : 'Bàn mở');
    return;
  }
  const ids = g === 'solid' ? [1, 2, 3, 4, 5, 6, 7] : [9, 10, 11, 12, 13, 14, 15];
  const remain = ids.filter((id) => match.balls.find((x) => x.id === id)?.onTable).length;
  c.sub.append(h('b.mx-grp', { class: g }, g === 'solid' ? 'Trơn' : 'Sọc'), remain ? `còn ${remain}` : 'tới bi 8');
}

function renderFoulSub(ctx: MatchCtx, c: CardView, s: Side): void {
  const { match } = ctx;
  const f = match.state.fouls[s];
  if (f > 0) c.sub.append(h('b.mx-foul', null, `${f} lỗi`));
  else if (s === shotController(match)) {
    const lo = match.legalTargets(s)[0];
    if (lo) c.sub.append('Bi', miniBall(lo));
  }
}

function renderPotted(ctx: MatchCtx, c: CardView, s: Side): void {
  const { match, view } = ctx;
  // Eight-ball with groups set shows the player's seven balls: pocketed ones bright, the
  // ones still on the table faded. Otherwise the balls this player has pocketed, in order.
  const g = match.setup.mode === 'eight' ? match.state.groups[s] : null;
  const tray = g
    ? (g === 'solid' ? [1, 2, 3, 4, 5, 6, 7] : [9, 10, 11, 12, 13, 14, 15]).map((id) => ({ id, left: !!match.balls.find((b) => b.id === id)?.onTable }))
    : match.potted[s].map((id) => ({ id, left: false }));
  const key = tray.map((b) => `${b.id}${b.left ? '-' : ''}`).join(',');
  if (key !== c.key) {
    c.key = key;
    c.potted.replaceChildren(...tray.map((b) => h('img.mx-pot', { src: view.ballPortrait(b.id, 36), alt: `Bi ${b.id}`, class: b.left ? 'left' : '', draggable: false })));
  }
}

function renderNextBall(ctx: MatchCtx, dom: MatchDom, showTag: (id: number) => void): void {
  const { match } = ctx;
  if (match.setup.mode !== 'nine' && match.setup.mode !== 'ten') {
    dom.nextBall.hidden = true;
    return;
  }
  // The next two balls in order, so the player can plan position for the one after.
  const [first, second] = match.balls.filter((b) => b.onTable && b.id > 0).map((b) => b.id).sort((x, y) => x - y);
  dom.nextBall.replaceChildren(...(first === undefined ? ['Hết bi'] : [
    h('span.mx-next-k', null, 'Bi tiếp theo'), numberedBall(first, showTag),
    ...(second === undefined ? [] : [h('span.mx-next-then', null, '›'), numberedBall(second, showTag)]),
  ]));
}

function renderObjective(ctx: MatchCtx, dom: MatchDom): void {
  const { match, opts } = ctx;
  const base = dom.desk ? dom.desk.plate().kicker : ctx.solo ? opts.label
    : `${MODE_NAMES[match.setup.mode]} · ${raceName(match.setup.raceTo)} · ván ${match.rackNo}`;
  dom.objKicker.textContent = base;
  dom.objText.textContent = objectiveText(ctx);
  dom.objPlate.classList.toggle('calling', match.calledNow !== null || match.calledPreview !== null);
  if (match.driftNow) dom.objText.textContent += ` · Hướng bị dắt lệch ${formatAngle(match.driftNow)}°`;
}

function objectiveText(ctx: MatchCtx): string {
  const { match, opts } = ctx;
  if (ctx.dom.desk) return ctx.dom.desk.plate().text;
  if (opts.challenge) return opts.challenge.goal;
  if (match.calledPreview !== null) return `Chỉ định bi ${match.calledPreview} · chạm bi khác của đối thủ để đổi`;
  if (match.calledNow !== null) return `Phải chạm bi ${match.calledNow} trước`;
  return match.setup.mode === 'carom-3c' ? 'Chạm bi thứ nhất, đủ 3 băng trước bi thứ hai.' : match.objective();
}

function formatAngle(value: number): string {
  return value.toFixed(1).replace('.', ',');
}

function renderControls(ctx: MatchCtx, dom: MatchDom, deps: HudDeps): void {
  const { match, power, flags, skill } = ctx;
  const act = deps.canAct();
  for (const slot of dom.slots) slot.b.disabled = !canInspectSkills(ctx);
  const passive = match.passive(shotController(match));
  dom.passiveChip.disabled = !act || passive === 'cuongchien' || passive === 'chusu' || passive === 'luanhoi' || (passive === 'hophap' && match.guardUsed[shotController(match)]) || (passive === 'anhsat' && !match.assassinReady[shotController(match)]);
  const placing = deps.placingNow();
  dom.ctrl.classList.toggle('placing', placing);
  dom.ctrl.classList.toggle('preview-aim', placing && !skill.placement && flags.placementAim);
  dom.placeMode.style.display = placing && !skill.placement ? '' : 'none';
  dom.placeMode.textContent = flags.placementAim ? 'Dời bi' : 'Ngắm thử';
  dom.placeMode.setAttribute('aria-label', flags.placementAim ? 'Chuyển sang dời bi cái' : 'Chuyển sang ngắm thử trước khi đặt bi');
  dom.ctrl.classList.toggle('off', !act);
  for (const b of [dom.rotL, dom.rotR, dom.switchBtn, dom.spinBtn, dom.upB, dom.downB, dom.leftB, dom.rightB, dom.strikeBtn]) b.disabled = !act;
  dom.powerBar.classList.toggle('off', !act || placing);
  if (!power.charging) dom.setStrikeAction(skill.placement ? 'cast' : placing ? 'place' : 'strike');
  dom.strikeBtn.classList.toggle('place', placing);
}

function renderChips(ctx: MatchCtx, dom: MatchDom, deps: HudDeps): void {
  const { match, flags } = ctx;
  dom.chips.replaceChildren();
  if (!deps.canAct()) return;
  if (match.state.pushOutAvailable && controllerIsHuman(match)) {
    dom.chips.append(tap(h('button.chip.mx-chip', { 'aria-pressed': String(flags.pushOut) }, 'Đẩy bi (push-out)'), () => {
      flags.pushOut = !flags.pushOut;
      deps.renderHud();
    }));
  }
  const ct = match.callType();
  const called = match.calledNow !== null;
  dom.objPlate.classList.toggle('calling', called || ct !== 'none');
  dom.objPlate.classList.toggle('need', !called && ct !== 'none' && flags.callPocket === null);
  if (match.calledNow !== null) {
    dom.objPlate.classList.add('calling');
    return;
  }
  if (ct !== 'none') paintCall(ctx, dom, ct);
}

function paintCall(ctx: MatchCtx, dom: MatchDom, ct: string): void {
  const { flags } = ctx;
  const ball = ct === 'ball-pocket' ? `bi ${callBallId(ctx) ?? '?'}` : '';
  dom.objKicker.textContent = 'Gọi lỗ';
  dom.objText.textContent = flags.callPocket === null
    ? `Gọi ${ball ? `${ball}, ` : ''}chạm 1 lỗ trên bàn`
    : `Gọi ${ball ? `${ball} vào ` : ''}${POCKET_NAMES[flags.callPocket]}`;
}

export function callBallId(ctx: MatchCtx): number | null {
  const { match, flags } = ctx;
  if (match.callType() === 'pocket') return 8;
  const legal = match.legalTargets();
  if (flags.callBall !== null && match.balls.some((b) => b.id === flags.callBall && b.onTable)) return flags.callBall;
  return legal[0] ?? null;
}

export const POCKET_NAMES = ['lỗ góc trên trái', 'lỗ giữa trên', 'lỗ góc trên phải', 'lỗ góc dưới trái', 'lỗ giữa dưới', 'lỗ góc dưới phải'];
