import { UPDATE_PRIORITY, type Ticker } from 'pixi.js';
import { sound } from '../../../audio/sound';
import { haptic } from '../../../platform/device';
import { h, uiOrigin, uiScale } from '../../dom';
import type { AimView } from '../../../render/table-view';
import type { MatchCtx } from './context';
import type { MatchDom } from './dom';
import { HAND } from './layout';
import { miniBall } from './hud';

export interface FrameDeps {
  renderHud(): void;
  renderControls(): void;
  canAct(): boolean;
  placingNow(): boolean;
  startCharge(): void;
  wobbleAmp(): number;
  wobbleNow(): number;
  guideScale(): number;
  currentCall(): { ball: number | null; pocket: number } | null;
}

export function createFrameLoop(ctx: MatchCtx, dom: MatchDom, deps: FrameDeps): { tick(ticker: Ticker): void; draw(): void; start(): void; stop(): void } {
  const tick = (ticker: Ticker) => {
    const dt = Math.min(0.05, ticker.deltaMS / 1000);
    ctx.frameDt = dt;
    if (!ctx.flags.paused) ctx.match.update(dt);
    // The pause sheet can be closed by the system back gesture too.
    if (ctx.flags.paused && ctx.renderState.pauseWrap && !ctx.renderState.pauseWrap.isConnected) {
      ctx.flags.paused = false;
      ctx.renderState.pauseWrap = null;
      deps.renderHud();
    }
    // A held ĐÁNH turns into the swinging meter.
    if (ctx.strikePress && !ctx.power.charging && performance.now() - ctx.strikePress.t0 > 260 && deps.canAct()) {
      deps.startCharge();
      if (!ctx.power.charging) ctx.strikePress = null;
    }
    ctx.renderState.cutIn?.classList.toggle('paused', ctx.flags.paused);
    if (ctx.flags.paused) return;
    charge(ctx);
    placeHand(ctx, dom, deps.placingNow());
    strike(ctx, deps);
    updateView(ctx, dom, deps, dt);
    paintPower(ctx, dom);
  };
  // After the frame's updates: the table is drawn only when its picture changed.
  const draw = () => {
    if (ctx.view.shouldRender()) ctx.app.pixi.render();
  };
  return {
    tick,
    draw,
    start: () => {
      ctx.app.pixi.ticker.add(tick);
      ctx.app.pixi.ticker.add(draw, undefined, UPDATE_PRIORITY.LOW);
    },
    stop: () => {
      ctx.app.pixi.ticker.remove(tick);
      ctx.app.pixi.ticker.remove(draw);
    },
  };
}

function charge(ctx: MatchCtx): void {
  const { power, renderState, match } = ctx;
  if (!power.charging) return;
  power.holdT += ctx.frameDt;
  if (match.current.kind !== 'human') return;
  const speed = 0.9 * (1 + Math.floor(power.chargeT) * 0.14);
  power.chargeT += ctx.frameDt * speed;
  const ph = power.chargeT % 2;
  power.power = ph < 1 ? ph : 2 - ph;
  const lvl = Math.floor(power.power * 10);
  if (lvl !== renderState.lastTick) {
    renderState.lastTick = lvl;
    sound.tick(power.power);
    if (lvl >= 9) haptic(8);
  }
}



function placeHand(ctx: MatchCtx, dom: MatchDom, placing: boolean): void {
  if (placing) paintHand(ctx, dom);
  else if (ctx.renderState.handKey !== 'off') {
    ctx.renderState.handKey = 'off';
    dom.hand.style.display = 'none';
  }
}


function paintHand(ctx: MatchCtx, dom: MatchDom): void {
  const { match, view, renderState } = ctx;
  const c = match.cueBall();
  const k = uiScale();
  const sp0 = view.toScreen(c.x, c.y);
  const rect = uiOrigin();
  const sp = { x: (sp0.x - rect.left) / k, y: (sp0.y - rect.top) / k };
  const key = `${Math.round(sp.x * 2)},${Math.round(sp.y * 2)}`;
  if (key === renderState.handKey) return;
  renderState.handKey = key;
  dom.hand.style.display = '';
  // Measured once per layout: reading offset sizes every frame would force a layout each time.
  if (!renderState.handSize.w) renderState.handSize = { w: dom.hand.offsetWidth, h: dom.hand.offsetHeight };
  dom.hand.style.transform = `translate(${sp.x - renderState.handSize.w * HAND.cx}px, ${sp.y - renderState.handSize.h * HAND.cy}px)`;
}

function strike(ctx: MatchCtx, deps: { renderControls(): void }): void {
  const { power } = ctx;
  if (power.strikeT <= 0) return;
  power.strikeT += ctx.frameDt / 0.09;
  if (power.strikeT < 1.6) return;
  power.strikeT = 0;
  power.heldPower = power.strikePull;
  power.power = 0;
  deps.renderControls();
}

function updateView(ctx: MatchCtx, dom: MatchDom, deps: FrameDeps, dt: number): void {
  const { power, view } = ctx;
  if (ctx.match.aimLock) deps.wobbleAmp();
  const humanAim = humanAiming(ctx, dom);
  const placing = deps.placingNow();
  const av = humanAim || power.strikeT > 0 ? aimView(ctx, deps, { humanAim, placing }) : null;
  view.calledShot = deps.currentCall();
  placeCallTag(ctx, dom);
  view.update(dt, av);
}

function humanAiming(ctx: MatchCtx, dom: MatchDom): boolean {
  const { flags, match } = ctx;
  return !dom.desk?.arranging && match.phase === 'aim' && (isHumanTurn(ctx) || flags.showAiCue);
}

function aimView(ctx: MatchCtx, deps: FrameDeps, x: { humanAim: boolean; placing: boolean }): AimView {
  const { aim, power, flags, match } = ctx;
  const placementAim = !ctx.skill.placement && flags.placementAim;
  // Preview the cue while aiming in hand, while confirmation still gates shooting.
  const showCue = (x.humanAim || power.strikeT > 0) && (!x.placing || placementAim);
  return {
    angle: aim.angle + deps.wobbleNow(),
    pull: currentPull(ctx),
    side: aim.side,
    vert: aim.vert,
    elevation: aim.elevation,
    power: aimPower(ctx),
    showCue,
    showGuide: x.humanAim && isHumanTurn(ctx) && (!x.placing || placementAim) && match.tremorNow === 1 && power.strikeT === 0,
    guideScale: deps.guideScale(),
    fog: match.setup.mutator === 'fog',
    pocketChoices: match.callType() !== 'none' && isHumanTurn(ctx) && !x.placing,
    strike: power.strikeT > 0 ? Math.min(1, power.strikeT) : 0,
  };
}

function currentPull(ctx: MatchCtx): number {
  const { power } = ctx;
  if (power.strikeT > 0) return power.strikePull;
  if (power.charging) return power.power;
  return power.barActive ? power.preset : 0;
}

function aimPower(ctx: MatchCtx): number {
  const { aim, power } = ctx;
  const live = power.charging ? power.power : power.preset;
  return aim.elevation > 0 ? live : Math.max(live, 0.5);
}

function isHumanTurn(ctx: MatchCtx): boolean {
  return ctx.match.current.kind === 'human' && !ctx.flags.aiActing;
}

function paintPower(ctx: MatchCtx, dom: MatchDom): void {
  const { power, renderState } = ctx;
  // Power UI: the live charge while swinging, otherwise the set power.
  const shown = power.strikeT > 0 ? power.strikePull : power.charging ? power.power : power.heldPower ?? power.preset;
  const pk = `${Math.round(shown * 100)}|${power.charging}`;
  if (pk === renderState.powerKey) return;
  renderState.powerKey = pk;
  dom.powerFill.style.transform = `scaleY(${shown})`;
  dom.powerPct.textContent = String(Math.round(shown * 100));
  dom.powerBar.setAttribute('aria-valuenow', String(Math.round(shown * 100)));
  dom.powerBar.classList.toggle('hot', shown > 0.85);
  dom.powerBar.classList.toggle('live', power.charging);
}

function placeCallTag(ctx: MatchCtx, dom: MatchDom): void {
  const cs = ctx.view.calledShot;
  if (!cs || cs.pocket < 0) {
    if (ctx.renderState.callTagKey) hideCallTag(ctx, dom);
    return;
  }
  moveCallTag(ctx, dom, cs);
  const key = `${cs.ball}|${cs.pocket}|${ctx.match.turn}`;
  if (key === ctx.renderState.callTagKey) return;
  ctx.renderState.callTagKey = key;
  dom.callTag.replaceChildren(h('span.mx-ct-label', null, 'Gọi'));
  if (cs.ball !== null) dom.callTag.append(miniBall(cs.ball), h('b', null, String(cs.ball)));
  dom.callTag.style.display = '';
  dom.callTag.classList.remove('pop');
  void dom.callTag.offsetWidth;
  dom.callTag.classList.add('pop');
}

function hideCallTag(ctx: MatchCtx, dom: MatchDom): void {
  dom.callTag.style.display = 'none';
  ctx.renderState.callTagKey = '';
  ctx.renderState.callTagPos = '';
}

function moveCallTag(ctx: MatchCtx, dom: MatchDom, cs: { pocket: number }): void {
  const p = ctx.match.table.pockets[cs.pocket];
  const k = uiScale();
  const sp0 = ctx.view.toScreen(p.hx, p.hy);
  const rect = uiOrigin();
  const sp = { x: (sp0.x - rect.left) / k, y: (sp0.y - rect.top) / k };
  // Push the tag toward the table centre so it never sits off-screen.
  const dirX = -Math.sign(p.hx) || 0;
  const dirY = -Math.sign(p.hy);
  // Keep the call marker clear of the pocket hit target. It is visual-only,
  // but placing it on the mouth made the final-ball pocket look unavailable.
  const offPx = ((p.hr + 0.16) * ctx.view.pxPerM) / k;
  const pos = `${Math.round(sp.x + dirX * offPx)},${Math.round(sp.y + dirY * offPx)}`;
  if (pos === ctx.renderState.callTagPos) return;
  ctx.renderState.callTagPos = pos;
  const [x, y] = pos.split(',');
  dom.callTag.style.left = `${x}px`;
  dom.callTag.style.top = `${y}px`;
}
