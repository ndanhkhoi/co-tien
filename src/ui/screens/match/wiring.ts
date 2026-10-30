import type { App, Screen } from '../../app';
import { preloadMatch } from '../../../platform/preload';
import { exprUrl, winUrl } from '../../../game/content/sects';
import { Match } from '../../../game/match';
import { rotateDirection } from '../../../game/skill-cast';
import { Rng } from '../../../core/rng';
import { TableView } from '../../../render/table-view';
import { practiceDesk } from '../practice/desk';
import type { MatchOptions } from './options';
import type { MatchCtx } from './context';
import { attachSpinInput, createMatchDom, type MatchDom } from './dom';
import { createLayout } from './layout';
import { createHud } from './hud';
import { createExpressions } from './expressions';
import { createHerald, type HeraldMsg } from './herald';
import { controllerIsHuman } from './controller';
import { createSkillDock, humanSide, previewCast } from './skill';
import { createSpin, updateSpinDot } from './spin';
import { removeSheets, type Sheets } from './sheet';
import { createAim } from './aim';
import { createShooting } from './shooting';
import { createTableInput } from './table-input';
import { createControls } from './controls';
import { createTiming } from './timing';
import { subscribeMatch, onResolved, coachTurn } from './match-events';
import { createTurn } from './turn';
import { createAiTurn } from './ai-turn';
import { createDialogs } from './dialogs';
import { currentCall } from './call-marker';
import { createFrameLoop } from './frame-loop';
import { createStart, screenBackdrop } from './start';
import { clearHints } from '../../hints';
import { keepAwake } from '../../../platform/device';
import { sound } from '../../../audio/sound';

export function buildScreen(app: App, opts: MatchOptions): Screen {
  const ctx = createCtx(app, opts);
  const sections = createSections(ctx);
  return finishScreen(ctx, sections);
}

function createCtx(app: App, opts: MatchOptions): MatchCtx {
  void preloadMatch(opts.setup.players.map((p) => p.champion), opts.setup.tableSkin.sect);
  const match = new Match(opts.setup);
  (window as unknown as { __match?: Match }).__match = match;
  const view = new TableView(app.pixi, match);
  (window as unknown as { __view?: TableView }).__view = view;
  if (!opts.randomOpponents) {
    for (const pl of opts.setup.players) {
      if (!app.profile.met.includes(pl.champion)) app.profile.met.push(pl.champion);
    }
    app.save();
  }
  for (const p of opts.setup.players) {
    for (const e of ['focus', 'joy', 'sad', 'cast'] as const) new Image().src = exprUrl(p.champion, e);
    new Image().src = winUrl(p.champion);
  }
  view.goal = opts.challenge?.marks ?? null;
  app.pixi.stage.addChild(view.root);
  return {
    app, opts, match, view, dom: null!, rng: new Rng(),
    frameDt: 0, hudQueued: false, ballTagTimer: 0,
    aim: { angle: 0, side: 0, vert: 0, elevation: 0 },
    power: { preset: 0.55, presets: [0.55, 0.55], heldPower: null, barActive: false, power: 0, charging: false, chargeT: 0, holdT: 0, strikeT: 0, strikePull: 0 },
    flags: { aiActing: false, aiToken: 0, begun: false, callBall: null, callPocket: null, disposed: false, lastTurnSide: null, paused: false, placeConfirmed: false, placementAim: false, presenting: false, pushOut: false, showAiCue: false, targetIdx: -1 },
    skill: { placement: null, pendingUltimate: null, spinDrag: null, preview: () => {}, moveCast: () => {}, rotateCast: () => {} },
    turn: { attempt: 1, pottedBefore: [0, 0], skillIdle: [0, 0], ultAnnounced: [false, false] },
    renderState: { handKey: '', powerKey: '', lastTick: 0, handSize: { w: 0, h: 0 }, callTagKey: '', callTagPos: '', pauseWrap: null, cutIn: null },
    hasSkills: !opts.challenge && !match.setup.classic,
    solo: !!(opts.challenge || opts.practice),
    lefty: app.profile.settings.leftHanded,
    aiCall: null, firedCall: null, strikePress: null, cancelArmed: false,
  };
}

interface MatchSections {
  dom: MatchDom;
  sheets: Sheets;
  layout: ReturnType<typeof createLayout>;
  hud: ReturnType<typeof createHud>;
  expressions: ReturnType<typeof createExpressions>;
  herald: ReturnType<typeof createHerald>;
  skills: ReturnType<typeof createSkillDock>;
  spin: ReturnType<typeof createSpin>;
  aim: ReturnType<typeof createAim>;
  shooting: ReturnType<typeof createShooting>;
  tableInput: ReturnType<typeof createTableInput>;
  controls: ReturnType<typeof createControls>;
  timing: ReturnType<typeof createTiming>;
  turn: ReturnType<typeof createTurn>;
  ai: ReturnType<typeof createAiTurn>;
  dialogs: ReturnType<typeof createDialogs>;
  loop: ReturnType<typeof createFrameLoop>;
  start: ReturnType<typeof createStart> | null;
  offEvents: () => void;
}

interface LateCallbacks {
  renderHud(): void;
  openPause(): void;
  openSkill(slot: number): void;
  openSpin(): void;
  aimFirstTarget(): void;
  showBallTag(id: number): void;
  aiTurn(): void;
  openOption(): void;
  cancelCharge(): void;
  renderControls(): void;
  startCharge(): void;
  switchTarget(): void;
}

function createSections(ctx: MatchCtx): MatchSections {
  const { app, opts, match, view } = ctx;
  const sheets: Sheets = { skill: null, spin: null };
  const closeSheets = () => removeSheets(ctx.dom, sheets);
  const guards = createGuards(ctx);
  // These listeners own callbacks created later, so their callbacks stay mutable properties.
  const late: LateCallbacks = {
    renderHud: () => {}, openPause: () => {}, openSkill: () => {}, openSpin: () => {}, aimFirstTarget: () => {},
    showBallTag: () => {}, aiTurn: () => {}, openOption: () => {}, cancelCharge: () => {}, renderControls: () => {}, startCharge: () => {}, switchTarget: () => {},
  };
  ctx.skill.preview = (cast) => previewCast(ctx, cast);
  ctx.skill.moveCast = (x, y) => moveCast(ctx, x, y);
  ctx.skill.rotateCast = (deg) => rotateCast(ctx, deg);
  const layout = createLayoutProxy(ctx);
  const dom = createMatchDom(ctx, opts, {
    openPause: () => late.openPause(),
    openSkill: (slot) => late.openSkill(slot),
    openSpin: () => late.openSpin(),
    switchTarget: () => late.switchTarget(),
    renderControls: () => late.renderControls(),
    renderHud: () => late.renderHud(),
    createDesk: (el) => opts.practice ? practiceDesk({
      match, view, screen: el, setup: opts.practice,
      refresh: late.renderHud,
      reaim: late.aimFirstTarget,
      showBallTag: (id) => late.showBallTag(id),
      hideBallTag: () => hideBallTag(ctx),
      herald: (m) => lateHerald?.({ side: null, icon: 'target', ...m }),
    }) : null,
    canAct: guards.canAct,
    placingNow: guards.placingNow,
    wobbleAmp: () => sections.aim.wobbleAmp(),
    startGuard: () => startGuard(ctx, sections.dom),
    cancelPlacement: () => cancelPlacement(ctx, sections.dom, sections.hud.render),
    toggleSense: () => toggleSense(ctx),
  });
  ctx.dom = dom;
  layout.attach();
  const expressions = createExpressions(ctx, dom);
  let lateHerald: ((m: HeraldMsg) => void) | null = null;
  const herald = createHerald(ctx, dom);
  lateHerald = herald.herald;
  const skills = createSkillDock(ctx, dom, sheets, { closeSheets, renderHud: () => late.renderHud(), canInspectSkills: guards.canInspectSkills });
  const spin = createSpin(ctx.aim, dom, sheets, { canAct: guards.canAct, closeSheets });
  const timing = createTiming(ctx);
  const aim = createAim(ctx, { canAdjustAim: guards.canAdjustAim, placingNow: guards.placingNow });
  const shooting = createShooting(ctx, dom, {
    canAct: guards.canAct, placingNow: guards.placingNow, closeSheets,
    renderControls: () => late.renderControls(), renderHud: () => late.renderHud(),
    herald: herald.herald, setFocus: expressions.setFocus,
    wobbleAmp: aim.wobbleAmp, wobbleNow: aim.wobbleNow, sleep: timing.sleep,
  });
  const tableInput = createTableInput(ctx, dom, {
    canAct: guards.canAct, canAdjustAim: guards.canAdjustAim, placingNow: guards.placingNow,
    renderHud: () => late.renderHud(), aimAt: aim.aimAt, targetList: aim.targetList, showBallTag: (id) => late.showBallTag(id),
  });
  const hud = createHud(ctx, dom, sheets, {
    renderSkills: skills.render, renderControls: () => late.renderControls(),
    showBallTag: (id) => late.showBallTag(id), canAct: guards.canAct, placingNow: guards.placingNow,
    renderHud: () => late.renderHud(),
  });
  const sections = buildSections({ ctx, dom, sheets, layout, expressions, herald, skills, spin, timing, aim, shooting, tableInput, hud, guards, late, closeSheets, app, opts });
  return sections;
}

function createGuards(ctx: MatchCtx): {
  isHumanTurn(): boolean; canAct(): boolean; canInspectSkills(): boolean;
  placingNow(): boolean; canAdjustAim(): boolean;
} {
  return {
    isHumanTurn: () => controllerIsHuman(ctx.match) && !ctx.flags.aiActing,
    canAct: () => !ctx.dom.desk?.arranging && controllerIsHuman(ctx.match) && !ctx.flags.aiActing && ctx.match.phase === 'aim' && ctx.power.strikeT === 0 && !ctx.flags.paused && !ctx.flags.presenting,
    canInspectSkills: () => !ctx.flags.presenting && !ctx.flags.paused && ctx.power.strikeT === 0,
    placingNow: () => !ctx.dom.desk?.arranging && controllerIsHuman(ctx.match) && !ctx.flags.aiActing && ctx.match.phase === 'aim' && ctx.power.strikeT === 0 && !ctx.flags.paused && !ctx.flags.presenting && (!!ctx.skill.placement || ctx.match.canMoveCue && !ctx.flags.placeConfirmed),
    canAdjustAim: () => !ctx.dom.desk?.arranging && controllerIsHuman(ctx.match) && !ctx.flags.aiActing && ctx.match.phase === 'aim' && ctx.power.strikeT === 0 && !ctx.flags.paused && !ctx.flags.presenting && !ctx.skill.placement && (!ctx.match.canMoveCue || ctx.flags.placeConfirmed || ctx.flags.placementAim),
  };
}

function createLayoutProxy(ctx: MatchCtx): { attach(): void; layout(): void; dispose(): void } {
  let impl: ReturnType<typeof createLayout> | null = null;
  return {
    attach: () => (impl = createLayout(ctx)),
    layout: () => impl?.layout(),
    dispose: () => impl?.dispose(),
  };
}

function startGuard(ctx: MatchCtx, dom: MatchDom): void {
  const aim = ctx.aim;
  ctx.skill.placement = { side: ctx.match.turn, slot: -1, cast: { direction: { x: Math.cos(aim.angle), y: Math.sin(aim.angle) } } };
  previewCast(ctx, ctx.skill.placement.cast);
  dom.cancelCast.hidden = false;
  dom.castSense.hidden = true;
}

function cancelPlacement(ctx: MatchCtx, dom: MatchDom, renderHud: () => void): void {
  ctx.skill.placement = null;
  ctx.match.castPreview = [];
  dom.cancelCast.hidden = true;
  dom.castSense.hidden = true;
  renderHud();
}

function toggleSense(ctx: MatchCtx): void {
  const placement = ctx.skill.placement;
  if (!placement) return;
  previewCast(ctx, { ...placement.cast, sense: placement.cast.sense === 'cw' ? 'ccw' : 'cw', hardness: placement.cast.hardness === 'soft' ? 'hard' : 'soft' });
}

function hideBallTag(ctx: MatchCtx): void {
  clearTimeout(ctx.ballTagTimer);
  ctx.dom.ballTag.classList.remove('show');
}

function buildSections(x: {
  ctx: MatchCtx; dom: MatchDom; sheets: Sheets;
  layout: ReturnType<typeof createLayoutProxy>;
  expressions: ReturnType<typeof createExpressions>;
  herald: ReturnType<typeof createHerald>;
  skills: ReturnType<typeof createSkillDock>;
  spin: ReturnType<typeof createSpin>;
  timing: ReturnType<typeof createTiming>;
  aim: ReturnType<typeof createAim>;
  tableInput: ReturnType<typeof createTableInput>;
  shooting: ReturnType<typeof createShooting>;
  hud: ReturnType<typeof createHud>;
  guards: ReturnType<typeof createGuards>;
  late: LateCallbacks;
  closeSheets(): void; app: App; opts: MatchOptions;
}): MatchSections {
  const { ctx, dom, sheets, expressions, herald, skills, timing, aim, spin, tableInput, shooting, hud, guards, late } = x;
  const dialogs = createDialogs(ctx, dom, {
    cancelCharge: shooting.cancelCharge, closeSheets: x.closeSheets, renderHud: hud.render,
    setExpr: expressions.setExpr, aimFirstTarget: aim.aimFirstTarget,
    humanSide: () => humanSide(ctx), onMatchOver: () => {},
  });
  const ai = createAiTurn(ctx, {
    renderHud: hud.render, herald: herald.herald, setFocus: expressions.setFocus,
    setThinking: herald.setThinking, sleep: timing.sleep, animate: timing.animate,
    fire: shooting.fire,
  });
  const turn = createTurn(ctx, dom, sheets, {
    herald: herald.herald, coachTurn: () => coachTurn(ctx, dom, humanSide(ctx)),
    aimFirstTarget: aim.aimFirstTarget, cancelCharge: shooting.cancelCharge, closeSheets: x.closeSheets,
    aiTurn: ai.turn, openOption: dialogs.openOption, canAct: guards.canAct, openSkill: skills.open,
  });
  const resolved = (r: Parameters<typeof onResolved>[0]['r'], side: Parameters<typeof onResolved>[0]['side']) => onResolved({ ctx, dom, deps: eventDeps, r, side });
  const eventDeps = {
    herald: herald.herald, setExpr: expressions.setExpr, floatGain: expressions.floatGain,
    scheduleHud: () => scheduleHud(ctx, hud.render), hideSkillNudge: turn.hideNudge,
    onResolved: resolved, onTurn: turn.turn, onRackOver: dialogs.onRackOver,
  };
  const controls = createControls(ctx, dom, sheets, {
    canAct: guards.canAct, placingNow: guards.placingNow,
    confirmPlace: shooting.confirmPlace, startCharge: shooting.startCharge,
    cancelCharge: shooting.cancelCharge, releaseCharge: shooting.releaseCharge,
    fireAtPreset: shooting.fireAtPreset, rotate: aim.rotate, rotateCast: aim.rotateCast, nudgeCue: aim.nudgeCue,
    setPreset: (v) => setPreset(ctx, v), canAdjustAim: guards.canAdjustAim,
    cancelPlacement: () => cancelPlacement(ctx, dom, hud.render), toggleSense: () => toggleSense(ctx),
    openPause: dialogs.openPause, back: () => ctx.app.back(), switchTarget: aim.switchTarget,
  });
  const loop = createFrameLoop(ctx, dom, {
    renderHud: hud.render, renderControls: hud.renderControls, canAct: guards.canAct,
    placingNow: guards.placingNow, startCharge: shooting.startCharge,
    wobbleAmp: aim.wobbleAmp, wobbleNow: aim.wobbleNow, guideScale: aim.guideScale,
    currentCall: () => currentCall(ctx),
  });
  assignLate(late, { hud, skills, spin, aim, shooting, tableInput, ai, dialogs, controls });
  const offEvents = subscribeMatch(ctx, dom, eventDeps);
  attachInputs(ctx, dom, guards.canAct);
  return { dom, sheets, layout: x.layout, hud, expressions, herald, skills, spin, aim, shooting, tableInput, controls, timing, turn, ai, dialogs, loop, start: null, offEvents };
}

function assignLate(late: LateCallbacks, s: {
  hud: ReturnType<typeof createHud>; skills: ReturnType<typeof createSkillDock>;
  spin: ReturnType<typeof createSpin>; aim: ReturnType<typeof createAim>;
  shooting: ReturnType<typeof createShooting>; tableInput: ReturnType<typeof createTableInput>;
  ai: ReturnType<typeof createAiTurn>; dialogs: ReturnType<typeof createDialogs>;
  controls: ReturnType<typeof createControls>;
}): void {
  late.renderHud = s.hud.render;
  late.renderControls = s.hud.renderControls;
  late.openSkill = (slot: number) => s.skills.open(slot);
  late.openSpin = s.spin.open;
  late.aimFirstTarget = s.aim.aimFirstTarget;
  late.showBallTag = s.tableInput.showBallTag;
  late.aiTurn = () => void s.ai.turn();
  late.openOption = s.dialogs.openOption;
  late.cancelCharge = s.shooting.cancelCharge;
  late.startCharge = s.shooting.startCharge;
  late.switchTarget = s.aim.switchTarget;
  late.openPause = s.dialogs.openPause;
}

function attachInputs(ctx: MatchCtx, dom: MatchDom, canAct: () => boolean): void {
  attachSpinInput(dom, ctx, canAct);
}

function scheduleHud(ctx: MatchCtx, renderHud: () => void): void {
  if (ctx.hudQueued) return;
  ctx.hudQueued = true;
  requestAnimationFrame(() => {
    ctx.hudQueued = false;
    if (!ctx.flags.disposed) renderHud();
  });
}

function setPreset(ctx: MatchCtx, v: number): void {
  const { power, renderState } = ctx;
  power.heldPower = null;
  power.preset = Math.max(0.05, Math.min(1, v));
  const lvl = Math.floor(power.preset * 10);
  if (lvl !== renderState.lastTick) {
    renderState.lastTick = lvl;
    tick(power.preset);
  }
}

function tick(preset: number): void {
  sound.tick(preset);
}

function finishScreen(ctx: MatchCtx, s: MatchSections): Screen {
  const { dom } = ctx;
  updateSpinDot(dom.spinDot, ctx.aim);
  s.hud.render();
  s.loop.start();
  createStart(ctx, { onTurn: s.turn.turn, renderHud: s.hud.render });
  const backdrop = screenBackdrop(ctx);
  return {
    el: dom.el,
    usesStage: true,
    // The opponent's homeland hangs behind the table.
    backdrop: backdrop.backdrop,
    cast: backdrop.cast,
    onBack: () => {
      if (s.sheets.skill || s.sheets.spin) {
        removeSheets(s.dom, s.sheets);
        return true;
      }
      s.dialogs.openPause();
      return true;
    },
    dispose: () => {
      ctx.flags.disposed = true;
      ctx.flags.aiToken++;
      s.offEvents();
      s.herald.dispose();
      s.expressions.dispose();
      s.tableInput.dispose();
      s.controls();
      s.layout.dispose();
      clearHints();
      ctx.app.ai.cancelAll();
      s.loop.stop();
      ctx.renderState.cutIn?.remove();
      document.querySelectorAll('.modal-wrap').forEach((m) => m.remove());
      ctx.app.pixi.stage.removeChild(ctx.view.root);
      ctx.view.destroy();
      keepAwake(false);
    },
  };
}


function moveCast(ctx: MatchCtx, x: number, y: number): void {
  const placement = ctx.skill.placement;
  if (!placement) return;
  previewCast(ctx, { ...placement.cast, point: { x, y }, rail: undefined });
}

function rotateCast(ctx: MatchCtx, deg: number): void {
  const placement = ctx.skill.placement;
  if (!placement) return;
  previewCast(ctx, { ...placement.cast, direction: rotateDirection(placement.cast.direction, deg) });
}
