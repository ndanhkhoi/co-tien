import { champion, portraitUrl, sect } from '../../../game/content/sects';
import { haptic } from '../../../platform/device';
import type { Side } from '../../../core/rules/types';
import { btn, h, tap, uiScale } from '../../dom';
import { icon } from '../../icons';
import type { MatchOptions } from './options';
import type { AimState, MatchCtx } from './context';
import { spinCaption, updateSpinDot } from './spin';

interface SlotView {
  b: HTMLButtonElement;
  img: HTMLImageElement;
  state: HTMLElement;
  name: HTMLElement;
  key: string;
}

export interface CardView {
  el: HTMLElement;
  face: HTMLImageElement;
  ring: HTMLElement;
  ringWrap: HTMLElement;
  epill: HTMLElement;
  score: HTMLElement;
  sub: HTMLElement;
  potted: HTMLElement;
  temp: 'focus' | 'joy' | 'sad' | 'cast' | null;
  focus: boolean;
  timer: number;
  key: string;
}

interface PracticeDesk {
  el: HTMLElement;
  arranging: boolean;
  render(): void;
  card(): { score: string; sub: string | Node };
  plate(): { kicker: string; text: string };
  resolved(): void;
  down(e: PointerEvent): boolean;
  move(e: PointerEvent): boolean;
  up(e: PointerEvent): boolean;
}

export interface MatchDom {
  el: HTMLElement;
  probe: HTMLElement;
  pauseBtn: HTMLElement;
  cards: [CardView, CardView];
  objKicker: HTMLElement;
  objText: HTMLElement;
  objPlate: HTMLElement;
  nextBall: HTMLElement;
  heraldEl: HTMLElement;
  center: HTMLElement;
  topBar: HTMLElement;
  slots: SlotView[];
  dock: HTMLElement;
  desk: PracticeDesk | null;
  rotL: HTMLButtonElement;
  rotR: HTMLButtonElement;
  switchBtn: HTMLButtonElement;
  spinDot: HTMLElement;
  spinBtn: HTMLButtonElement;
  spinPeek: HTMLElement;
  aimPad: HTMLElement;
  upB: HTMLButtonElement;
  downB: HTMLButtonElement;
  leftB: HTMLButtonElement;
  rightB: HTMLButtonElement;
  dpad: HTMLElement;
  placeMode: HTMLButtonElement;
  powerFill: HTMLElement;
  powerPct: HTMLElement;
  powerTrack: HTMLElement;
  powerBar: HTMLElement;
  strikeArt: HTMLImageElement;
  strikeBtn: HTMLButtonElement;
  cancelCast: HTMLButtonElement;
  castSense: HTMLButtonElement;
  passiveChip: HTMLButtonElement;
  chips: HTMLElement;
  ctrl: HTMLElement;
  callTag: HTMLElement;
  hand: HTMLImageElement;
  ballTag: HTMLElement;
  skillNudge: HTMLElement;
  setStrikeAction: (action: 'strike' | 'place' | 'cast' | 'cancel') => void;
  paintPeek: () => void;
}

const HAND_URL = `${import.meta.env.BASE_URL}art/ui/hand-ball.webp`;

export const frag = (...kids: (Node | string)[]): DocumentFragment => {
  const f = document.createDocumentFragment();
  f.append(...kids);
  return f;
};

function playerCard(opts: MatchOptions, side: Side, hex6: (n: number) => string, hasSkills: boolean): CardView {
  const p = opts.setup.players[side];
  const c = champion(p.champion);
  const face = h('img.mx-face', { src: portraitUrl(p.champion), alt: c.name, draggable: false, decoding: 'async' });
  face.style.background = hex6(sect(c.sect).main);
  const ring = h('div.mx-ring', null, face);
  const epill = h('span.mx-epill.num');
  // Whose turn: a painted arrow bobs over the active player's portrait.
  const ringWrap = h('div.mx-ringwrap', { 'aria-label': 'Năng lượng' }, ring, epill, h('span.mx-turnmark', { 'aria-hidden': 'true' }, icon('turn')));
  if (!hasSkills) ringWrap.classList.add('no-energy');
  const score = h('span.mx-score.num');
  const sub = h('span.mx-sub');
  const potted = h('div.mx-potted', { 'aria-label': 'Bi đã ăn' });
  const card = h('div.mx-card', { class: side ? 'p2' : 'p1' }, ringWrap,
    h('div.mx-info', null, h('div.mx-name', null, p.name), h('div.mx-line', null, score, sub), potted));
  return { el: card, face, ring, ringWrap, epill, score, sub, potted, temp: null, focus: false, timer: 0, key: '' };
}

export interface DomHost {
  hex6: (n: number) => string;
  openPause(): void;
  openSkill(slot: number): void;
  openSpin(): void;
  switchTarget(): void;
  renderControls(): void;
  renderHud(): void;
  createDesk(el: HTMLElement): PracticeDesk | null;
  canAct(): boolean;
  placingNow(): boolean;
  wobbleAmp(): number;
  startGuard(): void;
  cancelPlacement(): void;
  toggleSense(): void;
}

export function createMatchDom(ctx: MatchCtx, opts: MatchOptions, host: DomHost): MatchDom {
  const el = h('div.screen.game.mx', { class: ctx.lefty ? 'lefty' : '' });
  const dom: MatchDom = {
    el,
    probe: h('div.mx-probe', { 'aria-hidden': 'true' }),
    pauseBtn: tap(h('button.icon-btn.mx-pause', { 'aria-label': 'Tạm dừng' }, icon('pause')), () => host.openPause()),
    cards: [playerCard(opts, 0, host.hex6, ctx.hasSkills), playerCard(opts, 1, host.hex6, ctx.hasSkills)],
    objKicker: h('div.mx-obj-k'),
    objText: h('div.mx-obj-t'),
    objPlate: null!,
    nextBall: h('div.mx-next', { 'aria-live': 'polite' }),
    heraldEl: h('div.mx-herald', { role: 'status', 'aria-live': 'polite' }),
    center: null!,
    topBar: null!,
    slots: [0, 1, 2].map((slot) => {
      const img = h('img.mx-sk-img', { alt: '', draggable: false });
      const state = h('span.mx-sk-state');
      const name = h('span.mx-sk-name');
      const b = tap(h('button.mx-skill', { class: slot === 2 ? 'ult' : '' }, h('span.mx-sk-art', null, img), name, state), () => host.openSkill(slot));
      return { b, img, state, name, key: '' };
    }),
    dock: null!,
    desk: null,
    rotL: h('button.mx-btn', { 'aria-label': 'Xoay cơ sang trái (giữ để xoay nhanh)' }, icon('rotate-left')),
    rotR: h('button.mx-btn', { 'aria-label': 'Xoay cơ sang phải (giữ để xoay nhanh)' }, icon('rotate-right')),
    switchBtn: tap(h('button.mx-btn', { 'aria-label': 'Đổi bi mục tiêu' }, icon('switch-target')), () => host.switchTarget()),
    spinDot: h('i.mx-cb-dot'),
    spinBtn: null!,
    spinPeek: null!,
    aimPad: null!,
    upB: null!,
    downB: null!,
    leftB: null!,
    rightB: null!,
    dpad: null!,
    placeMode: null!,
    powerFill: h('i.mx-pfill'),
    powerPct: h('span.mx-ppct.num'),
    powerTrack: null!,
    powerBar: null!,
    strikeArt: h('img.mx-action-art', { src: `${import.meta.env.BASE_URL}art/ui/actions/strike.webp`, alt: '', draggable: false }),
    strikeBtn: null!,
    cancelCast: null!,
    castSense: null!,
    passiveChip: null!,
    chips: h('div.mx-chips'),
    ctrl: null!,
    callTag: h('div.mx-calltag'),
    hand: h('img.mx-hand', { src: HAND_URL, alt: '', draggable: false, 'aria-hidden': 'true' }),
    ballTag: h('div.mx-balltag', { 'aria-live': 'polite' }),
    skillNudge: h('button.mx-skillnudge', { type: 'button' }),
    setStrikeAction: () => {},
    paintPeek: () => {},
  };
  buildCastControls(dom, host);
  finishTop(dom, ctx);
  finishDock(dom, ctx, host);
  finishControls(dom, ctx, host);
  finishOverlays(dom);
  dom.setStrikeAction = setStrikeAction(dom);
  return dom;
}

function buildCastControls(dom: MatchDom, castHost: { cancelPlacement(): void; toggleSense(): void }): void {
  dom.cancelCast = btn(frag(icon('close'), 'Huỷ'), () => castHost.cancelPlacement());
  dom.cancelCast.hidden = true;
  dom.cancelCast.classList.add('small', 'ghost');
  dom.cancelCast.setAttribute('aria-label', 'Huỷ đặt chiêu');
  dom.castSense = btn(frag(icon('replay'), 'Đổi'), () => castHost.toggleSense());
  dom.castSense.hidden = true;
  dom.castSense.classList.add('small', 'ghost');
  dom.castSense.setAttribute('aria-label', 'Đổi chiều xoáy hoặc băng mềm/cứng');
}

function finishTop(dom: MatchDom, ctx: MatchCtx): void {
  dom.objPlate = h('div.mx-obj', null, dom.objKicker, dom.objText);
  dom.center = h('div.mx-center', null, dom.objPlate);
  dom.topBar = h('div.mx-top', null, dom.pauseBtn, dom.cards[0].el, dom.center, dom.cards[1].el);
  if (ctx.solo) dom.cards[1].el.style.visibility = 'hidden';
}

function finishDock(dom: MatchDom, ctx: MatchCtx, host: {
  openSkill(slot: number): void;
  createDesk(el: HTMLElement): PracticeDesk | null;
}): void {
  dom.dock = h('div.mx-col.mx-dock', { 'aria-label': 'Chiêu thức' }, ...dom.slots.map((s) => s.b));
  if (!ctx.hasSkills) dom.dock.style.display = 'none';
  dom.desk = host.createDesk(dom.el);
  if (dom.desk) {
    dom.dock.style.display = '';
    dom.dock.classList.add('mx-practice');
    dom.dock.setAttribute('aria-label', 'Luyện thế');
    dom.dock.replaceChildren(dom.desk.el);
  }
}

function finishControls(dom: MatchDom, ctx: MatchCtx, host: DomHost): void {
  const spinBtn = tap(h('button.mx-btn.mx-spinbtn', { 'aria-label': 'Áp phê: giữ để chỉnh nhanh trên bi lớn, chạm để mở bảng chỉnh chính xác' }, h('span.mx-cueball', null, dom.spinDot)), () => { if (!spinBtn.dataset.held) host.openSpin(); });
  dom.spinBtn = spinBtn;
  buildPeek(dom, ctx.aim);
  dom.aimPad = h('div.mx-pad', null,
    h('div.mx-pair', null, dom.rotL, dom.rotR),
    h('div.mx-pair', null, dom.switchBtn, spinBtn),
  );
  // One painted pad (art/ui/dpad.webp); each button is a transparent quarter of it.
  const arrow = (dir: string, label: string) => h('button.mx-dpad-b', { type: 'button', class: dir, 'aria-label': label });
  dom.upB = arrow('up', 'Dời bi lên');
  dom.downB = arrow('down', 'Dời bi xuống');
  dom.leftB = arrow('left', 'Dời bi sang trái');
  dom.rightB = arrow('right', 'Dời bi sang phải');
  dom.dpad = h('div.mx-dpad', null, dom.upB, dom.leftB, dom.rightB, dom.downB);
  dom.placeMode = btn('Ngắm thử', () => {
    if (!host.placingNow() || ctx.skill.placement) return;
    ctx.flags.placementAim = !ctx.flags.placementAim;
    host.renderControls();
  });
  dom.placeMode.classList.add('small', 'ghost', 'mx-place-mode');
  dom.placeMode.style.display = 'none';
  buildPowerBar(dom);
  dom.strikeBtn = h('button.mx-strike', { 'aria-label': 'Đánh' }, dom.strikeArt);
  dom.passiveChip = buildPassive(dom, ctx, host);
  dom.ctrl = h('div.mx-col.mx-ctrl', null, dom.placeMode, dom.aimPad, dom.dpad, dom.powerBar, dom.strikeBtn,
    h('div.mx-castrow', null, dom.cancelCast, dom.castSense), dom.chips, dom.passiveChip);
}

function buildPowerBar(dom: MatchDom): void {
  dom.powerTrack = h('div.mx-ptrack', null, dom.powerFill);
  for (let i = 1; i < 10; i++) dom.powerTrack.append(h('i.mx-ptick', { style: `bottom:${i * 10}%` }));
  dom.powerBar = h('div.mx-power', { role: 'slider', 'aria-label': 'Lực đánh', 'aria-valuemin': '0', 'aria-valuemax': '100' },
    h('div.mx-phead', null, icon('power'), dom.powerPct), dom.powerTrack);
}

function setStrikeAction(dom: MatchDom) {
  return (action: 'strike' | 'place' | 'cast' | 'cancel') => {
    if (dom.strikeArt.dataset.action === action) return;
    dom.strikeArt.dataset.action = action;
    dom.strikeArt.src = `${import.meta.env.BASE_URL}art/ui/actions/${action}.webp`;
    dom.strikeBtn.setAttribute('aria-label', { strike: 'Đánh', place: 'Đặt bi cái tại đây', cast: 'Thi triển chiêu tại đây', cancel: 'Huỷ cú đánh' }[action]);
  };
}

function buildPeek(dom: MatchDom, aim: AimState): void {
  const peekTip = h('i.mx-bb-tip');
  const peekBall = h('div.mx-bigball', { 'aria-hidden': 'true' }, h('i.mx-bb-limit'), h('i.mx-bb-h'), h('i.mx-bb-v'), peekTip);
  const peekCap = h('div.mx-peek-cap');
  dom.spinPeek = h('div.mx-spinpeek', { 'aria-hidden': 'true' }, peekBall, peekCap);
  dom.el.append(dom.spinPeek);
  dom.paintPeek = () => {
    peekTip.style.left = `${50 + aim.side * 46}%`;
    peekTip.style.top = `${50 - aim.vert * 46}%`;
    peekCap.textContent = spinCaption(aim);
  };
}

function buildPassive(dom: MatchDom, ctx: MatchCtx, host: DomHost): HTMLButtonElement {
  const { aim, match } = ctx;
  const passiveChip = btn('Nội tại', () => {
    if (!host.canAct()) return;
    const cls = match.passive(match.turn);
    if (cls === 'thanxa') match.aimLock ? match.aimLock = null : match.lockAim(aim.angle, host.wobbleAmp());
    if (cls === 'phaptu') match.choosePassive(match.spinAxis[match.turn] === 'side' ? 'vert' : 'side');
    if (cls === 'hophap') {
      host.startGuard();
      dom.cancelCast.hidden = false;
      dom.castSense.hidden = true;
    }
    if (cls === 'anhsat') match.choosePassive(match.assassinChoice[match.turn] === 'info' ? 'power' : 'info');
    host.renderHud();
  });
  passiveChip.classList.add('mx-passive');
  return passiveChip;
}

function finishOverlays(dom: MatchDom): void {
  dom.callTag.style.display = 'none';
  dom.hand.style.display = 'none';
  // Off-table controls only: the push-out toggle lives in the controls column, and the pocket
  // call is read in the objective plate. Nothing sits on the rails, where it could hide a pocket.
  dom.el.append(dom.probe, dom.hand, dom.topBar, dom.dock, dom.ctrl, dom.callTag, dom.nextBall, dom.heraldEl, dom.ballTag, dom.skillNudge);
}

export function attachSpinInput(dom: MatchDom, ctx: MatchCtx, canAct: () => boolean): void {
  const { aim, skill } = ctx;
  dom.spinBtn.addEventListener('pointerdown', (e) => {
    if (e.button > 0 || !canAct()) return;
    skill.spinDrag = { id: e.pointerId, x: e.clientX, y: e.clientY, side: aim.side, vert: aim.vert, live: false, timer: window.setTimeout(() => openPeek(dom, ctx), 220) };
    dom.spinBtn.setPointerCapture(e.pointerId);
  });
  dom.spinBtn.addEventListener('pointermove', (e) => moveSpinPeek(dom, ctx, e));
  const end = (e: PointerEvent) => endSpinDrag(dom, ctx, e);
  dom.spinBtn.addEventListener('pointerup', end);
  dom.spinBtn.addEventListener('pointercancel', end);
}

function openPeek(dom: MatchDom, ctx: MatchCtx): void {
  const drag = ctx.skill.spinDrag;
  if (!drag || drag.live) return;
  drag.live = true;
  // Marked now: the tap handler runs before ours on release and must not open the sheet.
  dom.spinBtn.dataset.held = '1';
  const k = uiScale();
  const r = dom.spinBtn.getBoundingClientRect();
  const ui = document.getElementById('ui')!.getBoundingClientRect();
  // Beside the controls column, centred on the button, kept inside the frame.
  const size = 170;
  const left = ctx.lefty ? (r.right - ui.left) / k + 12 : (r.left - ui.left) / k - size - 12;
  const top = Math.max(8, Math.min(475 - size - 40, (r.top - ui.top) / k + r.height / k / 2 - size / 2));
  dom.spinPeek.style.left = `${left}px`;
  dom.spinPeek.style.top = `${top}px`;
  dom.paintPeek();
  dom.spinPeek.classList.add('show');
  haptic(10);
}

function moveSpinPeek(dom: MatchDom, ctx: MatchCtx, e: PointerEvent): void {
  const drag = ctx.skill.spinDrag;
  const { aim } = ctx;
  if (!drag || e.pointerId !== drag.id) return;
  const dx = e.clientX - drag.x;
  const dy = e.clientY - drag.y;
  if (!drag.live) {
    if (Math.hypot(dx, dy) <= 8) return;
    clearTimeout(drag.timer);
    openPeek(dom, ctx);
  }
  // Finger travel is measured against the large ball, so the whole face is in easy reach.
  const span = 170 * uiScale() * 0.46;
  let sx = drag.side + dx / span;
  let sy = drag.vert - dy / span;
  const m = Math.hypot(sx, sy);
  if (m > 1) { sx /= m; sy /= m; }
  aim.side = sx;
  aim.vert = sy;
  updateSpinDot(dom.spinDot, aim);
  dom.paintPeek();
}

function endSpinDrag(dom: MatchDom, ctx: MatchCtx, e: PointerEvent): void {
  const drag = ctx.skill.spinDrag;
  if (drag?.id !== e.pointerId) return;
  clearTimeout(drag.timer);
  if (drag.live) {
    haptic(8);
    dom.spinPeek.classList.remove('show');
    setTimeout(() => delete dom.spinBtn.dataset.held, 0);
  }
  ctx.skill.spinDrag = null;
}

