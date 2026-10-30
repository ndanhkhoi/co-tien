import { buildCast, PLACED_KINDS, type SkillCast } from '../../game/skill-cast';
import { UPDATE_PRIORITY, type Ticker } from 'pixi.js';
import type { AiRequest } from '../../ai/types';
import { sound } from '../../audio/sound';
import { preloadMatch } from '../../platform/preload';
import { ballCss } from '../../core/ball-styles';
import { MODE_NAMES, raceName } from '../../core/rules';
import { other, type Resolution, type ShotCall, type Side } from '../../core/rules/types';
import { Rng } from '../../core/rng';
import { type SkillDef, champion, classInfo, cutoutUrl, exprUrl, portraitUrl, sect, sectArtUrl, skillIconUrl, winUrl } from '../../game/content/sects';
import { RULES_TEXT, SKILL_RULES } from '../../game/content/rules-text';
import { ASSASSIN_RUN, ASSASSIN_VALUE, ENERGY_MAX, Match, type MatchSetup } from '../../game/match';
import { haptic, isTouchDevice, keepAwake, toggleFullscreen } from '../../platform/device';
import { TableView, type AimView } from '../../render/table-view';
import type { App, Screen } from '../app';
import { avatar } from '../avatar';
import { btn, h, modal, stars, tap, uiOrigin, uiScale } from '../dom';
import { clearHints, hintOnce, hintTurn } from '../hints';
import { icon, type IconName } from '../icons';
import { playCutIn } from '../skill-cutin';
import { playFinisher } from '../finisher';
import { forceStrength } from '../../game/terrain';
import { practiceDesk, type PracticeSetup } from './practice-desk';

interface MatchResult {
  won: boolean;
  match: Match;
}

export interface MatchOptions {
  setup: MatchSetup;
  titles?: [string, string];
  /** Optional VS intro line (NPC). */
  quote?: string;
  /** Heading for HUD centre ("Sự nghiệp", "Thử thách 3"...). */
  label: string;
  /** Rack/challenge overrides for the end-of-rack dialog. */
  challenge?: { tries: number; goal: string; marks?: { pocket?: number; zone?: [number, number, number] }; onResult: (ok: boolean, attempt: number) => { stars: number; next?: () => void } };
  /** Match end: return reward lines to show and optional actions. */
  onEnd?: (r: MatchResult) => { lines: string[]; again?: () => void };
  onExit: () => void;
  /** Luyện thế: the left column becomes the practice desk; no rules, no opponent. */
  practice?: PracticeSetup;
}

type Expr = 'focus' | 'joy' | 'sad' | 'cast';
type Ball = ReturnType<Match['cueBall']>;

interface HeraldMsg {
  /** Whose face to show; null shows `icon` instead. */
  side: Side | null;
  expr?: Expr | null;
  icon?: IconName;
  title: string;
  line?: string;
  tone?: 'ink' | 'red';
  ms?: number;
  /** Shown even when the player turned announcements off (a rack won). Fouls always show. */
  important?: boolean;
}

const DEG = Math.PI / 180;
const POCKET_NAMES = ['lỗ góc trên trái', 'lỗ giữa trên', 'lỗ góc trên phải', 'lỗ góc dưới trái', 'lỗ giữa dưới', 'lỗ góc dưới phải'];
const HAND_URL = `${import.meta.env.BASE_URL}art/ui/hand-ball.webp`;
/** Painted hand: ball centre and radius as fractions of the 285×320 image. */
const HAND = { w: 285, h: 320, cx: 0.153, cy: 0.239, r: 0.144 };
const SPIN_PRESETS: { label: string; side: number; vert: number }[] = [
  { label: 'Giữa', side: 0, vert: 0 },
  { label: 'Trô', side: 0, vert: -0.2 },
  { label: 'Cule', side: 0, vert: 0.55 },
  { label: 'Giật', side: 0, vert: -0.6 },
  { label: 'Trái', side: -0.55, vert: 0 },
  { label: 'Phải', side: 0.55, vert: 0 },
];

const hex6 = (n: number) => '#' + n.toString(16).padStart(6, '0');

function frag(...kids: (Node | string)[]): DocumentFragment {
  const f = document.createDocumentFragment();
  f.append(...kids);
  return f;
}

export function matchScreen(opts: MatchOptions) {
  return (app: App): Screen => {
    // Both champions and the table's sect load (and decode) while the duel intro plays.
    void preloadMatch(opts.setup.players.map((p) => p.champion), opts.setup.tableSkin.sect);
    const match = new Match(opts.setup);
    // Exposed for automated browser checks.
    (window as unknown as { __match?: Match }).__match = match;
    const view = new TableView(app.pixi, match);
    (window as unknown as { __view?: TableView }).__view = view;
    // Everyone in this match now has an unlocked Cơ Tiên Lục page.
    for (const pl of opts.setup.players) if (!app.profile.met.includes(pl.champion)) app.profile.met.push(pl.champion);
    app.save();
    view.goal = opts.challenge?.marks ?? null;
    app.pixi.stage.addChild(view.root);
    const rng = new Rng();
    const lefty = app.profile.settings.leftHanded;
    const hasSkills = !opts.challenge && !match.setup.classic;
    /** One player against the table: challenges and Luyện thế. */
    const solo = !!(opts.challenge || opts.practice);

    // ---------- Aim / input state ----------
    const aim = { angle: 0, side: 0, vert: 0, elevation: 0 };
    /** Power the player set on the power bar; a tap on ĐÁNH shoots with it. */
    let preset = 0.55;
    // Each seat keeps its own bar setting (Song Đấu), and the bar keeps showing the last shot's
    // power while the balls roll: it only returns to a player's setting when their turn starts.
    const presets: [number, number] = [0.55, 0.55];
    let heldPower: number | null = null;
    let barActive = false;
    /** Live charge (hold ĐÁNH) or the shot in flight. */
    let power = 0;
    let charging = false;
    let chargeT = 0;
    let holdT = 0;
    let cancelArmed = false;
    let strikePress: { id: number; t0: number } | null = null;
    let strikeT = 0;
    let strikePull = 0;
    /** Ball in hand permits a shot preview; ĐẶT BI still gates shooting. */
    let placeConfirmed = false;
    let placementAim = false;
    let skillPlacement: { side: Side; slot: number; cast: SkillCast } | null = null;
    const cancelPlacement = () => {
      skillPlacement = null; match.castPreview = []; cancelCast.hidden = true; castSense.hidden = true; renderHud();
    };
    const cancelCast = btn(frag(icon('close'), 'Huỷ'), cancelPlacement);
    cancelCast.hidden = true;
    cancelCast.classList.add('small', 'ghost');
    cancelCast.setAttribute('aria-label', 'Huỷ đặt chiêu');
    const castSense = btn(frag(icon('replay'), 'Đổi'), () => {
      if (!skillPlacement) return;
      previewCast({ ...skillPlacement.cast, sense: skillPlacement.cast.sense === 'cw' ? 'ccw' : 'cw', hardness: skillPlacement.cast.hardness === 'soft' ? 'hard' : 'soft' });
    });
    castSense.hidden = true;
    castSense.classList.add('small', 'ghost');
    castSense.setAttribute('aria-label', 'Đổi chiều xoáy hoặc băng mềm/cứng');
    function previewCast(cast: SkillCast) {
      if (!skillPlacement) return;
      const { side, slot } = skillPlacement;
      if (slot === -1) {
        match.castPreview = [buildCast('railcraft', 1, -1, match.table, match.balls, match.cueId(side), { ...cast, hardness: 'soft' })];
        skillPlacement.cast = match.castPreview[0].cast;
        return;
      }
      const sk = match.skills(side)[slot];
      match.castPreview = sk.kinds.filter(k => PLACED_KINDS.includes(k)).map(k => buildCast(k, sk.tier, slot, match.table, match.balls, match.cueId(side), cast, sk.ult, sk.shape));
      skillPlacement.cast = match.castPreview[0]?.cast ?? cast;
    }
    function moveCast(x: number, y: number) {
      if (!skillPlacement) return;
      const c = match.cueBall();
      previewCast({ ...skillPlacement.cast, point: { x, y }, rail: undefined, direction: { x: x - c.x, y: y - c.y } });
    }
    let callPocket: number | null = null;
    let callBall: number | null = null;
    /** Call announced by the AI before it lines up, and the call of the shot in flight. */
    let aiCall: ShotCall | null = null;
    let firedCall: ShotCall | null = null;
    let pushOut = false;
    let aiToken = 0;
    let aiActing = false;
    let disposed = false;
    let presenting = false;
    let pendingUltimate: { champion: string; skill: SkillDef; side: Side } | null = null;
    let cutIn: HTMLElement | null = null;
    let begun = false;
    let paused = false;
    let pauseWrap: HTMLElement | null = null;
    let attempt = 1;
    /** Skill nudges: own turns since the human last cast, and whether a full bar was announced. */
    const skillIdle: [number, number] = [0, 0];
    const ultAnnounced: [boolean, boolean] = [false, false];
    let lastTick = 0;
    let showAiCue = false;
    let targetIdx = -1;
    let lastTurnSide: Side | null = null;
    const pottedBefore: [number, number] = [0, 0];
    /** Last values written to the DOM by the frame loop. */
    let handKey = '';
    let powerKey = '';

    const isHumanTurn = () => match.current.kind === 'human' && !aiActing;
    const canAct = () => !desk?.arranging && isHumanTurn() && match.phase === 'aim' && strikeT === 0 && !paused && !presenting;
    const canInspectSkills = () => !presenting && !paused && strikeT === 0;
    const placingNow = () => canAct() && (!!skillPlacement || match.canMoveCue && !placeConfirmed);
    const canAdjustAim = () => canAct() && !skillPlacement && (!placingNow() || placementAim);
    const nameOf = (s: Side) => match.setup.players[s].name;
    const champOf = (s: Side) => match.setup.players[s].champion;

    // Expressions load before they are needed so swaps never flash empty.
    for (const p of opts.setup.players) {
      for (const e of ['focus', 'joy', 'sad', 'cast'] as const) new Image().src = exprUrl(p.champion, e);
      new Image().src = winUrl(p.champion);
    }

    // ---------- DOM ----------
    const el = h('div.screen.game.mx', { class: lefty ? 'lefty' : '' });
    const probe = h('div.mx-probe', { 'aria-hidden': 'true' });

    // Top strip: pause, both players, objective / herald in the middle.
    const pauseBtn = tap(h('button.icon-btn.mx-pause', { 'aria-label': 'Tạm dừng' }, icon('pause')), () => openPause());
    const cards = [playerCard(0), playerCard(1)];
    const objKicker = h('div.mx-obj-k');
    const objText = h('div.mx-obj-t');
    const objPlate = h('div.mx-obj', null, objKicker, objText);
    const nextBall = h('div.mx-next', { 'aria-live': 'polite' });
    const heraldEl = h('div.mx-herald', { role: 'status', 'aria-live': 'polite' });
    const center = h('div.mx-center', null, objPlate);
    const topBar = h('div.mx-top', null, pauseBtn, cards[0].el, center, cards[1].el);
    if (solo) cards[1].el.style.visibility = 'hidden';

    // Skill dock.
    const slots = [0, 1, 2].map((slot) => {
      const img = h('img.mx-sk-img', { alt: '', draggable: false });
      const state = h('span.mx-sk-state');
      const name = h('span.mx-sk-name');
      const b = tap(h('button.mx-skill', { class: slot === 2 ? 'ult' : '' }, h('span.mx-sk-art', null, img), name, state), () => openSkill(slot));
      return { b, img, state, name, key: '' };
    });
    const dock = h('div.mx-col.mx-dock', { 'aria-label': 'Chiêu thức' }, ...slots.map((s) => s.b));
    if (!hasSkills) dock.style.display = 'none';
    // Luyện thế takes the skill column (practice has no skills).
    const desk = opts.practice ? practiceDesk({
      match, view, screen: el, setup: opts.practice,
      refresh: () => renderHud(),
      reaim: () => aimFirstTarget(),
      showBallTag: (id) => showBallTag(id),
      hideBallTag: () => {
        clearTimeout(ballTagTimer);
        ballTag.classList.remove('show');
      },
      herald: (m) => herald({ side: null, icon: 'target', ...m }),
    }) : null;
    if (desk) {
      dock.style.display = '';
      dock.classList.add('mx-practice');
      dock.setAttribute('aria-label', 'Luyện thế');
      dock.replaceChildren(desk.el);
    }

    // Controls column.
    const rotL = h('button.mx-btn', { 'aria-label': 'Xoay cơ sang trái (giữ để xoay nhanh)' }, icon('rotate-left'));
    const rotR = h('button.mx-btn', { 'aria-label': 'Xoay cơ sang phải (giữ để xoay nhanh)' }, icon('rotate-right'));
    const switchBtn = tap(h('button.mx-btn', { 'aria-label': 'Đổi bi mục tiêu' }, icon('switch-target')), () => switchTarget());
    const spinDot = h('i.mx-cb-dot');
    const spinBtn = tap(h('button.mx-btn.mx-spinbtn', { 'aria-label': 'Áp phê: giữ để chỉnh nhanh trên bi lớn, chạm để mở bảng chỉnh chính xác' }, h('span.mx-cueball', null, spinDot)), () => { if (!spinBtn.dataset.held) openSpin(); });
    // Quick spin: hold (or start dragging) the small cue ball and a large one opens beside it.
    // The finger then steers the tip point across the large ball; letting go closes it.
    // A plain tap still opens the precise sheet.
    const peekTip = h('i.mx-bb-tip');
    const peekBall = h('div.mx-bigball', { 'aria-hidden': 'true' }, h('i.mx-bb-limit'), h('i.mx-bb-h'), h('i.mx-bb-v'), peekTip);
    const peekCap = h('div.mx-peek-cap');
    const spinPeek = h('div.mx-spinpeek', { 'aria-hidden': 'true' }, peekBall, peekCap);
    el.append(spinPeek);
    let spinDrag: { id: number; x: number; y: number; side: number; vert: number; live: boolean; timer: number } | null = null;
    const paintPeek = () => {
      peekTip.style.left = `${50 + aim.side * 46}%`;
      peekTip.style.top = `${50 - aim.vert * 46}%`;
      peekCap.textContent = spinCaption();
    };
    const openPeek = () => {
      if (!spinDrag || spinDrag.live) return;
      spinDrag.live = true;
      // Marked now: the tap handler runs before ours on release and must not open the sheet.
      spinBtn.dataset.held = '1';
      const k = uiScale();
      const r = spinBtn.getBoundingClientRect();
      const ui = document.getElementById('ui')!.getBoundingClientRect();
      // Beside the controls column, centred on the button, kept inside the frame.
      const size = 170;
      const left = lefty ? (r.right - ui.left) / k + 12 : (r.left - ui.left) / k - size - 12;
      const top = Math.max(8, Math.min(475 - size - 40, (r.top - ui.top) / k + r.height / k / 2 - size / 2));
      spinPeek.style.left = `${left}px`;
      spinPeek.style.top = `${top}px`;
      paintPeek();
      spinPeek.classList.add('show');
      haptic(10);
    };
    spinBtn.addEventListener('pointerdown', (e) => {
      if (e.button > 0 || !canAct()) return;
      spinDrag = { id: e.pointerId, x: e.clientX, y: e.clientY, side: aim.side, vert: aim.vert, live: false, timer: window.setTimeout(openPeek, 220) };
      spinBtn.setPointerCapture(e.pointerId);
    });
    spinBtn.addEventListener('pointermove', (e) => {
      if (!spinDrag || e.pointerId !== spinDrag.id) return;
      const dx = e.clientX - spinDrag.x;
      const dy = e.clientY - spinDrag.y;
      if (!spinDrag.live) {
        if (Math.hypot(dx, dy) <= 8) return;
        clearTimeout(spinDrag.timer);
        openPeek();
      }
      // Finger travel is measured against the large ball, so the whole face is in easy reach.
      const span = 170 * uiScale() * 0.46;
      let sx = spinDrag.side + dx / span;
      let sy = spinDrag.vert - dy / span;
      const m = Math.hypot(sx, sy);
      if (m > 1) { sx /= m; sy /= m; }
      aim.side = sx;
      aim.vert = sy;
      updateSpinDot();
      paintPeek();
    });
    const endSpinDrag = (e: PointerEvent) => {
      if (spinDrag?.id !== e.pointerId) return;
      clearTimeout(spinDrag.timer);
      if (spinDrag.live) {
        haptic(8);
        spinPeek.classList.remove('show');
        setTimeout(() => delete spinBtn.dataset.held, 0);
      }
      spinDrag = null;
    };
    spinBtn.addEventListener('pointerup', endSpinDrag);
    spinBtn.addEventListener('pointercancel', endSpinDrag);
    const aimPad = h('div.mx-pad', null,
      h('div.mx-pair', null, rotL, rotR),
      h('div.mx-pair', null, switchBtn, spinBtn),
    );
    // One painted pad (art/ui/dpad.webp); each button is a transparent quarter of it.
    const arrow = (dir: string, label: string) => h('button.mx-dpad-b', { type: 'button', class: dir, 'aria-label': label });
    const upB = arrow('up', 'Dời bi lên');
    const downB = arrow('down', 'Dời bi xuống');
    const leftB = arrow('left', 'Dời bi sang trái');
    const rightB = arrow('right', 'Dời bi sang phải');
    const dpad = h('div.mx-dpad', null, upB, leftB, rightB, downB);
    const placeMode = btn('Ngắm thử', () => {
      if (!placingNow() || skillPlacement) return;
      placementAim = !placementAim;
      renderControls();
    });
    placeMode.classList.add('small', 'ghost', 'mx-place-mode');
    placeMode.style.display = 'none';
    const powerFill = h('i.mx-pfill');
    const powerPct = h('span.mx-ppct.num');
    const powerTrack = h('div.mx-ptrack', null, powerFill);
    for (let i = 1; i < 10; i++) powerTrack.append(h('i.mx-ptick', { style: `bottom:${i * 10}%` }));
    const powerBar = h('div.mx-power', { role: 'slider', 'aria-label': 'Lực đánh', 'aria-valuemin': '0', 'aria-valuemax': '100' },
      h('div.mx-phead', null, icon('power'), powerPct), powerTrack);
    const strikeArt = h('img.mx-action-art', { src: `${import.meta.env.BASE_URL}art/ui/actions/strike.webp`, alt: '', draggable: false });
    const strikeBtn = h('button.mx-strike', { 'aria-label': 'Đánh' }, strikeArt);
    function setStrikeAction(action: 'strike' | 'place' | 'cast' | 'cancel') {
      if (strikeArt.dataset.action === action) return;
      strikeArt.dataset.action = action;
      strikeArt.src = `${import.meta.env.BASE_URL}art/ui/actions/${action}.webp`;
      strikeBtn.setAttribute('aria-label', { strike: 'Đánh', place: 'Đặt bi cái tại đây', cast: 'Thi triển chiêu tại đây', cancel: 'Huỷ cú đánh' }[action]);
    }
    const passiveChip = btn('Nội tại', () => {
      if (!canAct()) return;
      const cls = match.passive(match.turn);
      if (cls === 'thanxa') match.aimLock ? match.aimLock = null : match.lockAim(aim.angle, wobbleAmp());
      if (cls === 'phaptu') match.choosePassive(match.spinAxis[match.turn] === 'side' ? 'vert' : 'side');
      if (cls === 'hophap') {
        skillPlacement = { side: match.turn, slot: -1, cast: {} };
        previewCast({ point: match.cueBall() });
        cancelCast.hidden = false; castSense.hidden = true;
      }
      if (cls === 'anhsat') match.choosePassive(match.assassinChoice[match.turn] === 'info' ? 'power' : 'info');
      renderHud();
    });
    passiveChip.classList.add('mx-passive');
    // Off-table controls only: the push-out toggle lives in the controls column, and the pocket
    // call is read in the objective plate. Nothing sits on the rails, where it could hide a pocket.
    const chips = h('div.mx-chips');
    const ctrl = h('div.mx-col.mx-ctrl', null, placeMode, aimPad, dpad, powerBar, strikeBtn, h('div.mx-castrow', null, cancelCast, castSense), chips, passiveChip);

    const callTag = h('div.mx-calltag');
    callTag.style.display = 'none';
    const hand = h('img.mx-hand', { src: HAND_URL, alt: '', draggable: false, 'aria-hidden': 'true' });
    hand.style.display = 'none';
    el.append(probe, hand, topBar, dock, ctrl, callTag, nextBall, heraldEl);

    function playerCard(side: Side) {
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
      return { el: card, face, ring, ringWrap, epill, score, sub, potted, temp: null as Expr | null, focus: false, timer: 0, key: '' };
    }

    // ---------- Layout ----------
    let handSize = { w: 0, h: 0 };
    function layout() {
      handSize = { w: 0, h: 0 };
      handKey = '';
      // HUD offsets are layout px inside the scaled #ui; the table canvas works in screen px.
      const k = uiScale();
      const ui = document.getElementById('ui')!;
      const rect = ui.getBoundingClientRect();
      const W = ui.clientWidth;
      const H = ui.clientHeight;
      // Before the screen is attached nothing has a size yet: use the usual column widths.
      const live = probe.offsetWidth > 0;
      const insetL = live ? probe.offsetLeft : 0;
      const insetR = live ? W - probe.offsetLeft - probe.offsetWidth : 0;
      const insetB = live ? H - probe.offsetTop - probe.offsetHeight : 0;
      // offset* ignores the screen's slide-in transform, unlike getBoundingClientRect.
      const colL = lefty ? ctrl : dock;
      const colR = lefty ? dock : ctrl;
      const targetWidth = nextBall.hidden || !nextBall.textContent ? 0 : nextBall.offsetWidth;
      const leftEdge = !live ? 104 : colL.offsetWidth ? colL.offsetLeft + colL.offsetWidth : insetL + (!lefty && targetWidth ? targetWidth + 8 : 4);
      const rightEdge = !live ? W - 128 : colR.offsetWidth ? colR.offsetLeft : W - insetR - (lefty && targetWidth ? targetWidth + 8 : 4);
      const top = live ? topBar.offsetTop + topBar.offsetHeight : 84;
      // Breathing room between the rails and the side columns, so the table never looks glued on.
      const sideGap = live ? 14 : 2;
      const bounds = {
        left: leftEdge + sideGap,
        right: W - rightEdge + sideGap,
        top: top + 2,
        bottom: insetB + 2,
      };
      const fitted = view.fit(window.innerWidth, window.innerHeight, { left: rect.left + bounds.left * k, right: window.innerWidth - rect.right + bounds.right * k, top: rect.top + bounds.top * k, bottom: window.innerHeight - rect.bottom + bounds.bottom * k });
      const scale = fitted.scale / k;
      const t = match.table;
      // The painted ball in the hand is drawn a little larger than the real one: it is lifted off the cloth.
      const handW = (t.R * scale * 1.3) / HAND.r;
      hand.style.width = `${handW}px`;
      hand.style.height = `${(handW * HAND.h) / HAND.w}px`;
      handKey = '';
    }
    const onResize = () => layout();
    window.addEventListener('resize', onResize);
    window.addEventListener('cotien:ui-resize', onResize);
    requestAnimationFrame(layout);
    layout();

    // ---------- HUD (event driven) ----------
    function renderHud() {
      const cls = match.passive(match.turn);
      // Hide the passive only when there is none: between shots it keeps its room (just invisible)
      // so the power bar and ĐÁNH above it never jump.
      passiveChip.hidden = !cls;
      passiveChip.classList.toggle('idle', match.current.kind !== 'human' || match.phase !== 'aim');
      const passiveLabels: Record<string, string> = {
        thanxa: match.aimLock ? 'Đã khoá ngắm · chạm để mở' : 'Khoá ngắm',
        cuongchien: 'Tăng lực · giảm xoáy',
        phaptu: match.spinAxis[match.turn] === 'side' ? 'Ưu tiên áp phê ngang' : 'Ưu tiên kéo / đẩy',
        hophap: match.guardUsed[match.turn] ? 'Đã dùng băng mềm' : 'Đặt băng mềm',
        chusu: 'Cú thủ hợp lệ để lại cát',
        anhsat: match.assassinReady[match.turn] ? (match.assassinChoice[match.turn] === 'info' ? 'Liên hoàn · xem đường' : 'Liên hoàn · thêm lực') : `Chuỗi ${match.assassinStreak[match.turn]}/${ASSASSIN_RUN} bi · ${match.assassinValue[match.turn].toFixed(1).replace('.', ',')}/${ASSASSIN_VALUE} điểm`,
        luanhoi: 'Luân phiên chiêu · hồi nhanh',
      };
      const passiveName = cls ? classInfo(cls).name : '';
      passiveChip.replaceChildren(h('span.mx-passive-name', null, passiveName), h('span.mx-passive-detail', null, cls ? passiveLabels[cls] : ''));
      passiveChip.setAttribute('aria-label', cls ? `${passiveName}: ${passiveLabels[cls]}` : 'Nội tại');
      const st = match.state;
      const carom = match.isCarom;
      for (const s of [0, 1] as Side[]) {
        const c = cards[s];
        c.el.classList.toggle('active', match.turn === s && match.phase !== 'match-over');
        c.score.textContent = desk ? desk.card().score : opts.challenge ? `${attempt}/${opts.challenge.tries}` : carom ? `${st.scores[s]}/${st.caromTarget}` : String(match.rackWins[s]);
        c.sub.replaceChildren();
        if (desk) {
          c.sub.append(desk.card().sub);
        } else if (opts.challenge) {
          c.sub.append('lượt thử');
        } else if (match.setup.mode === 'eight') {
          const g = st.groups[s];
          if (g === null) {
            c.sub.append(st.isBreak ? (match.breaker === s ? 'Phá bi' : '') : 'Bàn mở');
          } else {
            const ids = g === 'solid' ? [1, 2, 3, 4, 5, 6, 7] : [9, 10, 11, 12, 13, 14, 15];
            const remain = ids.filter((id) => match.balls.find((x) => x.id === id)?.onTable).length;
            c.sub.append(h('b.mx-grp', { class: g }, g === 'solid' ? 'Trơn' : 'Sọc'), remain ? `còn ${remain}` : 'tới bi 8');
          }
        } else if (carom) {
          c.sub.append(`ván ${match.rackWins[s]}/${match.setup.raceTo}`);
        } else {
          const f = st.fouls[s];
          if (f > 0) c.sub.append(h('b.mx-foul', null, `${f} lỗi`));
          else if (s === match.turn) {
            const lo = match.legalTargets(s)[0];
            if (lo) c.sub.append('Bi', miniBall(lo));
          }
        }
        if (!carom && !solo) {
          // Eight-ball with groups set shows the player's seven balls: pocketed ones bright, the
          // ones still on the table faded. Otherwise the balls this player has pocketed, in order.
          const g = match.setup.mode === 'eight' ? st.groups[s] : null;
          const tray = g
            ? (g === 'solid' ? [1, 2, 3, 4, 5, 6, 7] : [9, 10, 11, 12, 13, 14, 15]).map((id) => ({ id, left: !!match.balls.find((b) => b.id === id)?.onTable }))
            : match.potted[s].map((id) => ({ id, left: false }));
          const key = tray.map((b) => `${b.id}${b.left ? '-' : ''}`).join(',');
          if (key !== c.key) {
            c.key = key;
            c.potted.replaceChildren(...tray.map((b) => h('img.mx-pot', { src: view.ballPortrait(b.id, 36), alt: `Bi ${b.id}`, class: b.left ? 'left' : '', draggable: false })));
          }
        }
        const e = Math.round(match.energy[s]);
        c.ring.style.setProperty('--e', String((e / ENERGY_MAX) * 100));
        c.epill.textContent = `${e}%`;
        c.ringWrap.setAttribute('aria-label', `Năng lượng ${nameOf(s)}: ${e}/${ENERGY_MAX}`);
        c.ringWrap.classList.toggle('full', hasSkills && e >= ENERGY_MAX);
      }
      if (match.setup.mode === 'nine' || match.setup.mode === 'ten') {
        // The next two balls in order, so the player can plan position for the one after.
        const [first, second] = match.balls.filter((b) => b.onTable && b.id > 0).map((b) => b.id).sort((x, y) => x - y);
        nextBall.replaceChildren(...(first === undefined ? ['Hết bi'] : [
          h('span.mx-next-k', null, 'Bi tiếp theo'), numberedBall(first),
          ...(second === undefined ? [] : [h('span.mx-next-then', null, '›'), numberedBall(second)]),
        ]));
      } else nextBall.hidden = true;
      objKicker.textContent = desk ? desk.plate().kicker : solo ? opts.label : `${MODE_NAMES[match.setup.mode]} · ${raceName(match.setup.raceTo)} · ván ${match.rackNo}`;
      objText.textContent = desk ? desk.plate().text : opts.challenge ? opts.challenge.goal : match.setup.mode === 'carom-3c' ? 'Chạm bi thứ nhất, đủ 3 băng trước bi thứ hai.' : match.objective();
      renderSkills();
      desk?.render();
      renderChips();
      renderControls();
      skillSheet?.refresh();
    }

    function renderControls() {
      const act = canAct();
      for (const slot of slots) slot.b.disabled = !canInspectSkills();
      const passive = match.passive(match.turn);
      passiveChip.disabled = !act || passive === 'cuongchien' || passive === 'chusu' || passive === 'luanhoi' || (passive === 'hophap' && match.guardUsed[match.turn]) || (passive === 'anhsat' && !match.assassinReady[match.turn]);
      const placing = placingNow();
      ctrl.classList.toggle('placing', placing);
      ctrl.classList.toggle('preview-aim', placing && !skillPlacement && placementAim);
      placeMode.style.display = placing && !skillPlacement ? '' : 'none';
      placeMode.textContent = placementAim ? 'Dời bi' : 'Ngắm thử';
      placeMode.setAttribute('aria-label', placementAim ? 'Chuyển sang dời bi cái' : 'Chuyển sang ngắm thử trước khi đặt bi');
      ctrl.classList.toggle('off', !act);
      for (const b of [rotL, rotR, switchBtn, spinBtn, upB, downB, leftB, rightB, strikeBtn]) b.disabled = !act;
      powerBar.classList.toggle('off', !act || placing);
      if (!charging) {
        setStrikeAction(skillPlacement ? 'cast' : placing ? 'place' : 'strike');
      }
      strikeBtn.classList.toggle('place', placing);
    }

    /** A force on the cloth in words, as the player sees the table: "thổi sang phải, chếch xuống". */
    function forceDirection(f?: { x: number; y: number }): string {
      if (!f || !Math.hypot(f.x, f.y)) return '';
      const deg = (Math.atan2(f.y, f.x) * 180) / Math.PI;
      const names = ['sang phải', 'chếch phải xuống', 'xuống dưới', 'chếch trái xuống', 'sang trái', 'chếch trái lên', 'lên trên', 'chếch phải lên'];
      return `Hướng: ${names[((Math.round(deg / 45) % 8) + 8) % 8]}, sức ${forceStrength(f)} (theo mũi tên trên nỉ).`;
    }

    /** The ball that decided the rack: the last one pocketed, or a carom's second ball. */
    function finalBall() {
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

    function miniBall(id: number) {
      const col = ballCss('pool', id);
      return h('i.mx-ball', { class: id > 8 ? 'stripe' : '', style: `--c:${col}`, title: `Bi ${id}` });
    }

    // A ball with its number painted on a white spot, so ball and number never wrap apart.
    // Tapping it names the ball on the cloth, as tapping the ball itself does.
    function numberedBall(id: number) {
      const ball = miniBall(id);
      ball.append(h('b', null, String(id)));
      return tap(h('button.mx-next-ball', { 'aria-label': `Bi ${id}: chạm để xem trên bàn` }, ball), () => showBallTag(id));
    }

    function humanSide(): Side | null {
      if (match.current.kind === 'human') return match.turn;
      const hs = match.setup.players.findIndex((p) => p.kind === 'human');
      return hs < 0 ? null : (hs as Side);
    }

    function renderChips() {
      chips.replaceChildren();
      if (!canAct()) return;
      if (match.state.pushOutAvailable && match.current.kind === 'human') {
        chips.append(tap(h('button.chip.mx-chip', { 'aria-pressed': String(pushOut) }, 'Đẩy bi (push-out)'), () => {
          pushOut = !pushOut;
          renderHud();
        }));
      }
      const ct = match.callType();
      objPlate.classList.toggle('calling', ct !== 'none');
      objPlate.classList.toggle('need', ct !== 'none' && callPocket === null);
      if (ct !== 'none') {
        const ball = ct === 'ball-pocket' ? `bi ${callBallId() ?? '?'}` : '';
        objKicker.textContent = 'Gọi lỗ';
        objText.textContent = callPocket === null
          ? `Gọi ${ball ? `${ball}, ` : ''}chạm 1 lỗ trên bàn`
          : `Gọi ${ball ? `${ball} vào ` : ''}${POCKET_NAMES[callPocket]}`;
      }
    }

    // ---------- Expressions ----------
    function applyFace(side: Side) {
      const c = cards[side];
      const e = c.temp ?? (c.focus ? 'focus' : null);
      const src = e ? exprUrl(champOf(side), e) : portraitUrl(champOf(side));
      if (c.face.getAttribute('src') !== src) {
        c.face.src = src;
        c.ring.classList.remove('swap');
        void c.ring.offsetWidth;
        c.ring.classList.add('swap');
      }
    }
    function setExpr(side: Side, e: Expr, ms = 2600) {
      const c = cards[side];
      c.temp = e;
      clearTimeout(c.timer);
      c.timer = window.setTimeout(() => {
        c.temp = null;
        if (!disposed) applyFace(side);
      }, ms);
      applyFace(side);
    }
    function setFocus(side: Side, on: boolean) {
      cards[side].focus = on;
      applyFace(side);
    }

    function floatGain(side: Side, gain: number) {
      if (!hasSkills || gain < 1) return;
      const f = h('span.mx-gain.num', { 'aria-hidden': 'true' }, `+${Math.round(gain)}`);
      cards[side].ringWrap.append(f);
      setTimeout(() => f.remove(), 1200);
    }

    // ---------- Herald: transient announcements over the table ----------
    const heraldQ: HeraldMsg[] = [];
    let heraldTimer = 0;
    let heraldOn = false;
    let thinkingSide: Side | null = null;

    function herald(m: HeraldMsg) {
      if (disposed) return;
      if (!app.profile.settings.herald && !m.important && m.tone !== 'red') return;
      heraldQ.push(m);
      // Old news is dropped rather than shown late.
      if (heraldQ.length > 3) heraldQ.splice(0, heraldQ.length - 3);
      if (!heraldOn) nextHerald();
    }
    function nextHerald() {
      clearTimeout(heraldTimer);
      const m = heraldQ.shift();
      if (!m) {
        heraldOn = false;
        idleHerald();
        return;
      }
      heraldOn = true;
      const len = m.title.length + (m.line?.length ?? 0);
      // Shorter while more news waits.
      const ms = m.ms ?? Math.min(4200, 1600 + len * 30) * (heraldQ.length ? 0.7 : 1);
      showHerald(m, false, ms);
      heraldTimer = window.setTimeout(nextHerald, ms);
    }
    function showHerald(m: HeraldMsg, thinking: boolean, ms = 0) {
      const face = m.side !== null
        ? h('img.mx-h-face', { src: m.expr ? exprUrl(champOf(m.side), m.expr) : portraitUrl(champOf(m.side)), alt: '', draggable: false })
        : h('span.mx-h-icon', null, icon(m.icon ?? 'info'));
      heraldEl.className = `mx-herald show ${m.tone ?? 'ink'}${thinking ? ' thinking' : ''}`;
      heraldEl.replaceChildren(face,
        h('div.mx-h-text', null, h('div.mx-h-title', null, m.title), m.line ? h('div.mx-h-line', null, m.line) : null),
      );
      // Any tap closes an announcement; the cross says so and the hairline shows the time left.
      if (thinking) heraldEl.append(icon('thinking', 'mx-h-think'));
      else heraldEl.append(h('button.mx-h-close', { type: 'button', 'aria-label': 'Đóng thông báo' }, icon('close')),
        h('i.mx-h-timer', { style: `--ms:${Math.round(ms)}ms`, 'aria-hidden': 'true' }));
      center.classList.add('heralding');
    }
    // Any touch, click or key dismisses the current announcement: the player is acting, and the
    // banner must never stand between them and the cue ball they are placing.
    const dismissHerald = () => {
      if (!heraldOn) return;
      heraldQ.length = 0;
      clearTimeout(heraldTimer);
      heraldOn = false;
      idleHerald();
    };
    el.addEventListener('pointerdown', dismissHerald, true);
    app.pixi.canvas.addEventListener('pointerdown', dismissHerald, true);
    window.addEventListener('keydown', dismissHerald, true);
    function idleHerald() {
      if (thinkingSide !== null) {
        showHerald({ side: thinkingSide, expr: 'focus', title: `${nameOf(thinkingSide)} đang tính…` }, true);
      } else {
        // Fade the stroke away instead of cutting it off.
        heraldEl.className = heraldEl.classList.contains('show') ? 'mx-herald leaving' : 'mx-herald';
        setTimeout(() => {
          if (heraldEl.classList.contains('leaving')) heraldEl.className = 'mx-herald';
        }, 260);
        center.classList.remove('heralding');
      }
    }
    function setThinking(side: Side | null) {
      thinkingSide = side;
      if (!heraldOn) idleHerald();
    }

    // ---------- Skill dock ----------
    function renderSkills() {
      const side = humanSide();
      if (!hasSkills || side === null) return;
      const champ = champion(champOf(side));
      let anyReady = false;
      for (const sk of champ.skills) {
        const s = slots[sk.slot];
        const key = `${champ.id}-${sk.slot}`;
        if (s.key !== key) {
          s.key = key;
          s.img.src = skillIconUrl(champ.id, sk.slot);
          s.name.textContent = sk.name;
        }
        const wait = match.skillWait(side, sk.slot);
        const can = canInspectSkills() && match.canUseSkill(side, sk.slot);
        anyReady ||= can;
        const ult = sk.slot === 2;
        s.b.classList.toggle('ready', can);
        s.b.classList.toggle('cool', !ult && wait > 0);
        s.b.classList.toggle('charging', ult && wait < 0);
        const pct = Math.round((match.energy[side] / ENERGY_MAX) * 100);
        s.b.style.setProperty('--e', String(Math.min(100, pct)));
        // Short words inside the pill so it never spills past the slot on narrow phones.
        if (ult && wait < 0) s.state.replaceChildren(icon('energy'), h('span', null, `${pct}%`));
        else if (!ult && wait > 0) s.state.replaceChildren(icon('cooldown'), h('span', null, `${wait} lượt`));
        // Ready needs no tick: the painted ring around the slot already says so.
        else s.state.replaceChildren(h('span', null, can ? 'Sẵn sàng' : 'Chờ'));
        s.b.setAttribute('aria-label', `${sk.name}${ult ? ' (tuyệt chiêu)' : ''}: ${can ? 'sẵn sàng' : skillBlock(side, sk.slot) ?? ''}. Chạm để xem.`);
      }
      if (begun && anyReady && isHumanTurn()) {
        hintOnce(app, { key: 'skill-dock', title: 'Chiêu thức', text: 'Chạm ô sáng để đọc và dùng chiêu. Hai chiêu đầu hồi chiêu theo lượt đánh của bạn; tuyệt chiêu cần đầy thanh năng lượng.',
          anchor: () => dock, place: lefty ? 'left' : 'right', rail: true });
      }
    }

    function skillBlock(side: Side, slot: number): string | null {
      if (match.canUseSkill(side, slot)) return null;
      const wait = match.skillWait(side, slot);
      if (slot === 2 && wait < 0) return `Cần đầy thanh năng lượng: ${Math.round(match.energy[side])}/${ENERGY_MAX}`;
      if (wait > 0) return `Hồi chiêu: còn ${wait} lượt đánh của bạn`;
      if (match.phase === 'rolling') return 'Chờ bi dừng lăn';
      if (match.phase === 'rack-over' || match.phase === 'match-over') return 'Ván đã kết thúc';
      if (match.turn !== side || aiActing) return 'Chưa dùng được lúc này, đợi tới lượt bạn';
      return 'Hiệu ứng đang có tác dụng hoặc chưa hợp lúc này';
    }

    let skillSheet: { el: HTMLElement; catcher: HTMLElement; refresh: () => void } | null = null;
    let spinSheet: { el: HTMLElement; catcher: HTMLElement } | null = null;

    function closeSheets() {
      for (const s of [skillSheet, spinSheet]) {
        s?.el.remove();
        s?.catcher.remove();
      }
      skillSheet = null;
      spinSheet = null;
      dock.classList.remove('sheet-open');
      ctrl.classList.remove('sheet-open');
    }

    function openSkill(slot: number) {
      if (!canInspectSkills()) return;
      const side = humanSide();
      if (side === null) return;
      closeSheets();
      sound.unlock();
      const sk = match.skills(side)[slot];
      const champ = champion(champOf(side));
      const ult = slot === 2;
      const req = h('div.mx-sc-req');
      const reason = h('div.mx-sc-reason');
      const useBtn = btn(frag(icon(ult ? 'ultimate' : 'energy'), 'Dùng'), () => {
        if (!canInspectSkills() || !match.canUseSkill(side, slot)) return;
        closeSheets();
        if (sk.kinds.some(k => PLACED_KINDS.includes(k))) {
          skillPlacement = { side, slot, cast: { direction: { x: Math.cos(aim.angle), y: Math.sin(aim.angle) } } };
          previewCast(skillPlacement.cast);
          cancelCast.hidden = false; castSense.hidden = false;
          renderHud();
        } else match.useSkill(side, slot);
      }, 'big');
      const closeBtn = tap(h('button.icon-btn.small.mx-sc-x', { 'aria-label': 'Đóng' }, icon('close')), () => closeSheets());
      const box = h('div.mx-sheet.mx-skillcard', { role: 'dialog', 'aria-label': sk.name },
        closeBtn,
        h('div.mx-sc-head', null,
          h('img.mx-sc-icon', { src: skillIconUrl(champ.id, slot), alt: '', draggable: false }),
          h('div.mx-sc-titles', null,
            h('div.mx-sc-kicker', null, ult ? 'Tuyệt chiêu' : `Chiêu ${slot + 1}`, ' · ', champ.name),
            h('div.mx-sc-name', null, sk.name))),
        h('div.mx-sc-desc', null, sk.desc),
        req,
        h('div.mx-sc-foot', null, reason, useBtn));
      const catcher = h('div.mx-catch');
      catcher.addEventListener('pointerdown', () => closeSheets());
      el.append(catcher, box);
      dock.classList.add('sheet-open');
      const refresh = () => {
        const e = Math.round(match.energy[side]);
        req.replaceChildren(ult
          ? frag(icon('energy'), e >= ENERGY_MAX
            ? h('span', null, 'Năng lượng đã đầy, dùng được ngay')
            : h('span', null, `Cần đầy thanh năng lượng (${ENERGY_MAX}) · đang có `, h('b.num', null, String(e))))
          : frag(icon('cooldown'), h('span', null, `Hồi chiêu: ${sk.cooldown} lượt đánh của bạn`)));
        const why = skillBlock(side, slot);
        reason.textContent = why ?? 'Sẵn sàng';
        reason.classList.toggle('ok', !why);
        useBtn.disabled = !!why || !canInspectSkills();
      };
      refresh();
      skillSheet = { el: box, catcher, refresh };
    }

    // ---------- Spin ----------
    function spinCaption(): string {
      const parts: string[] = [];
      if (aim.vert > 0.15) parts.push('Cule (theo bi)');
      else if (aim.vert < -0.35) parts.push('Giật (kéo bi)');
      else if (aim.vert < -0.1) parts.push('Trô (dừng bi)');
      if (aim.side > 0.15) parts.push('phê phải');
      else if (aim.side < -0.15) parts.push('phê trái');
      return parts.length ? parts.join(' · ') : 'Giữa bi';
    }

    function updateSpinDot() {
      spinDot.style.left = `${50 + aim.side * 40}%`;
      spinDot.style.top = `${50 - aim.vert * 40}%`;
    }

    function openSpin() {
      if (!canAct()) return;
      closeSheets();
      const tip = h('i.mx-bb-tip');
      const cap = h('div.mx-sp-cap');
      const ball = h('div.mx-bigball', { role: 'application', 'aria-label': 'Chạm vào bi cái để chọn điểm đánh' }, h('i.mx-bb-limit'), h('i.mx-bb-h'), h('i.mx-bb-v'), tip);
      let over = false;
      const paint = () => {
        tip.style.left = `${50 + aim.side * 46}%`;
        tip.style.top = `${50 - aim.vert * 46}%`;
        cap.textContent = spinCaption();
        updateSpinDot();
        presetBtns.forEach((b, i) => b.setAttribute('aria-pressed', String(Math.abs(SPIN_PRESETS[i].side - aim.side) < 0.02 && Math.abs(SPIN_PRESETS[i].vert - aim.vert) < 0.02)));
      };
      const setFrom = (e: PointerEvent) => {
        const r = ball.getBoundingClientRect();
        let sx = ((e.clientX - r.left) / r.width - 0.5) / 0.46;
        let sy = -((e.clientY - r.top) / r.height - 0.5) / 0.46;
        const m = Math.hypot(sx, sy);
        if (m > 1) {
          sx /= m;
          sy /= m;
        }
        aim.side = sx;
        aim.vert = sy;
        const o = m > 0.82;
        if (o !== over) {
          over = o;
          if (o) haptic(15);
        }
        paint();
      };
      let pid: number | null = null;
      ball.addEventListener('pointerdown', (e) => {
        pid = e.pointerId;
        ball.setPointerCapture(pid);
        setFrom(e);
      });
      ball.addEventListener('pointermove', (e) => e.pointerId === pid && setFrom(e));
      ball.addEventListener('pointerup', () => (pid = null));
      ball.addEventListener('pointercancel', () => (pid = null));
      const presetBtns = SPIN_PRESETS.map((p) => tap(h('button.chip.mx-sp-chip', null, p.label), () => {
        aim.side = p.side;
        aim.vert = p.vert;
        paint();
      }));
      const elevationText = h('span', null, `Nâng cơ: ${Math.round(aim.elevation * 180 / Math.PI)}°`);
      const elevation = h('input', { type: 'range', min: 0, max: 75, step: 1, value: Math.round(aim.elevation * 180 / Math.PI), 'aria-label': 'Góc nâng cơ (độ)' });
      elevation.addEventListener('input', () => {
        aim.elevation = Number(elevation.value) * Math.PI / 180;
        elevationText.textContent = `Nâng cơ: ${elevation.value}°`;
      });
      const box = h('div.mx-sheet.mx-spinsheet', { role: 'dialog', 'aria-label': 'Áp phê' },
        tap(h('button.icon-btn.small.mx-sc-x', { 'aria-label': 'Đóng' }, icon('close')), () => closeSheets()),
        h('div.mx-sp-ballwrap', null, ball),
        h('div.mx-sp-side', null,
          h('div.mx-sp-title', null, icon('spin'), 'Áp phê'),
          h('div.mx-sp-body.scroll', { tabindex: 0, 'aria-label': 'Điểm đánh và góc nâng cơ' },
            cap,
            h('div.mx-sp-presets', null, ...presetBtns),
            h('label.mx-elevation', null, elevationText, elevation),
            h('p.mx-jump-help', null, 'Nâng cơ 45–65°, đánh sát tâm, dùng lực theo khoảng cách. Góc cao giảm tầm ngang và khó dùng áp phê; lệch tâm giảm độ bật, lệch nhiều dễ trượt cơ. Quá nhẹ đụng bi chắn; quá mạnh có thể văng bàn.')),
          btn('Xong', () => closeSheets(), 'small block')));
      const catcher = h('div.mx-catch');
      catcher.addEventListener('pointerdown', () => closeSheets());
      el.append(catcher, box);
      ctrl.classList.add('sheet-open');
      spinSheet = { el: box, catcher };
      paint();
    }

    // ---------- Calls ----------
    // Calls are always the player's own choice; nothing is inferred from the aim.
    function callBallId(): number | null {
      if (match.callType() === 'pocket') return 8;
      const legal = match.legalTargets();
      if (callBall !== null && match.balls.some((b) => b.id === callBall && b.onTable)) return callBall;
      return legal[0] ?? null;
    }

    // ---------- Aim helpers ----------
    function aimAt(b: { x: number; y: number }) {
      const cue = match.cueBall();
      if (Math.hypot(b.x - cue.x, b.y - cue.y) < 1e-6) return;
      aim.angle = Math.atan2(b.y - cue.y, b.x - cue.x);
    }

    /** Balls the switch button cycles through: legal targets first (lowest ball / own group), nearest first. */
    function targetList(): Ball[] {
      const cue = match.cueBall();
      const legal = match.legalTargets();
      const live = match.balls.filter((b) => b.onTable && b.id !== cue.id);
      const pool = legal.length ? live.filter((b) => legal.includes(b.id)) : live;
      const list = pool.length ? pool : live;
      const d = (b: Ball) => Math.hypot(b.x - cue.x, b.y - cue.y);
      return list.sort((a, b) => (legal.length ? legal.indexOf(a.id) - legal.indexOf(b.id) : 0) || d(a) - d(b));
    }

    function aimFirstTarget() {
      const list = targetList();
      targetIdx = 0;
      if (list[0]) aimAt(list[0]);
    }

    function switchTarget() {
      if (!canAdjustAim()) return;
      const list = targetList();
      if (!list.length) return;
      targetIdx = (targetIdx + 1) % list.length;
      const b = list[targetIdx];
      aimAt(b);
      view.ring(b.x, b.y, 0xffffff, 0.02);
    }

    function rotate(deg: number) {
      if (!canAdjustAim()) return;
      aim.angle += deg * DEG;
    }

    function nudgeCue(dx: number, dy: number, metres: number) {
      if (!placingNow()) return;
      if (skillPlacement) {
        const p = skillPlacement.cast.point!;
        moveCast(p.x + dx * metres, p.y + dy * metres);
        return;
      }
      const c = match.cueBall();
      match.placeCue(c.x + dx * metres, c.y + dy * metres);
    }

    const cueDef = () => match.current.cue;

    /** Hand tremor amplitude (radians) for the current hold. */
    function wobbleAmp(): number {
      const control = cueDef().control;
      const base = 0.0034 * (1.3 - control * 0.2);
      const fatigue = 1 + Math.max(0, holdT - 1.8) * 0.75;
      return match.aimBand(aim.angle, base * (0.2 + 1.7 * (charging ? power : preset) ** 2) * fatigue * match.tremorNow);
    }

    function wobbleNow(): number {
      if (!charging) return 0;
      const t = performance.now() / 1000;
      return wobbleAmp() * (0.62 * Math.sin(t * 7.3) + 0.38 * Math.sin(t * 13.1 + 1.7));
    }

    function guideScale(): number {
      return 0.55 + 0.12 * cueDef().aim;
    }

    // ---------- Shooting ----------
    /** Checks before any shot; false (with a message) when the player must do something first. */
    function readyToShoot(): boolean {
      if (!canAct() || placingNow()) return false;
      if (match.callType() !== 'none' && callPocket === null) {
        herald({ side: null, icon: 'target', tone: 'red', title: 'Chưa gọi lỗ',
          line: match.callType() === 'ball-pocket' ? 'Chạm bi muốn gọi, rồi chạm một lỗ trên bàn' : 'Chạm một lỗ trên bàn để gọi trước khi đánh' });
        haptic([20, 40, 20]);
        return false;
      }
      return true;
    }

    function confirmPlace() {
      if (!placingNow()) return;
      if (skillPlacement) {
        const { side, slot, cast } = skillPlacement;
        if (slot === -1) match.useGuard(cast); else match.useSkill(side, slot, cast);
        skillPlacement = null; match.castPreview = []; cancelCast.hidden = true; castSense.hidden = true;
        renderHud();
        return;
      }
      placeConfirmed = true;
      haptic(15);
      sound.tap();
      renderHud();
    }

    function startCharge() {
      if (!readyToShoot()) return;
      charging = true;
      chargeT = 0;
      holdT = 0;
      power = 0;
      cancelArmed = false;
      strikeBtn.classList.add('charging');
      setFocus(match.turn, true);
    }

    function cancelCharge() {
      if (charging) setFocus(match.turn, false);
      charging = false;
      power = 0;
      strikePress = null;
      strikeBtn.classList.remove('charging', 'cancel', 'pressed');
      renderControls();
    }

    function releaseCharge() {
      if (!charging) return;
      strikeBtn.classList.remove('charging', 'pressed');
      if (cancelArmed || power < 0.02) {
        cancelCharge();
        return;
      }
      const amp = wobbleAmp();
      const finalAngle = aim.angle + wobbleNow() + rng.gauss() * amp * 0.3;
      charging = false;
      setFocus(match.turn, false);
      shootWith(finalAngle, power);
    }

    /** Quick tap on ĐÁNH: shoot at the power set on the bar, with the hand's tremor at that power. */
    function fireAtPreset() {
      if (!readyToShoot()) return;
      power = preset;
      holdT = 0;
      const amp = wobbleAmp();
      const ph = rng.next() * Math.PI * 2;
      const w = amp * (0.62 * Math.sin(ph) + 0.38 * Math.sin(ph * 1.8 + 1.7));
      shootWith(aim.angle + w + rng.gauss() * amp * 0.3, preset);
    }

    function shootWith(angle: number, pw: number) {
      const err = 0.012 + 0.008 * (5 - cueDef().control);
      const finalPower = Math.max(0.01, Math.min(1, pw * (1 + rng.gauss() * err)));
      fire(angle, finalPower, aim.side, aim.vert);
    }

    async function fire(angle: number, pw: number, side: number, vert: number, aiShotCall?: ShotCall | null) {
      if (presenting || disposed || paused || match.phase !== 'aim') return;
      presenting = true;
      closeSheets();
      renderControls();
      const ultimate = pendingUltimate;
      pendingUltimate = null;
      if (ultimate) {
        cutIn = playCutIn(champion(ultimate.champion), ultimate.skill, ultimate.side === 1);
        await sleep(1500);
        cutIn.remove();
        cutIn = null;
        if (disposed) return;
        view.skillFx(ultimate.champion, ultimate.skill, ultimate.side);
        haptic([30, 40, 60]);
        await sleep(900);
        if (disposed) return;
      }
      strikePull = pw;
      strikeT = 0.0001;
      if (match.current.kind === 'human') presets[match.turn] = preset;
      const ct = match.callType();
      const call = aiShotCall !== undefined ? aiShotCall : ct === 'none' ? null : { ball: callBallId() ?? 8, pocket: callPocket ?? 0 };
      firedCall = call;
      aiCall = null;
      const input = { angle, power: pw, side, vert, elevation: aiShotCall !== undefined ? 0 : aim.elevation, call, pushOut };
      renderControls();
      // Let the cue travel through before the ball moves.
      void sleep(70).then(() => {
        if (disposed) return;
        match.shoot(input);
        presenting = false;
        pushOut = false;
        callPocket = null;
      });
    }

    // ---------- Pointer input on the table ----------
    const canvas = app.pixi.canvas;
    let drag: { id: number; mode: 'aim' | 'cue'; sx: number; sy: number; lastA: number; moved: boolean; cue0: { x: number; y: number }; p0: { x: number; y: number } } | null = null;

    const onDown = (e: PointerEvent) => {
      sound.unlock();
      if (!paused && !drag && desk?.down(e)) return;
      if (!canAct() || charging || drag) return;
      const p = view.toTable(e.clientX, e.clientY);
      const t = match.table;
      if (skillPlacement) moveCast(p.x, p.y);
      // Pocket call taps first.
      if (match.callType() !== 'none' && !placingNow()) {
        const hit = t.pockets.findIndex((pk, i) => !match.closedPockets.includes(i) && Math.hypot(p.x - pk.hx, p.y - pk.hy) < pk.hr * 1.6);
        if (hit >= 0) {
          callPocket = hit;
          haptic(10);
          sound.tap();
          renderHud();
          return;
        }
      }
      if (match.callType() === 'ball-pocket' && !placingNow()) {
        const hitBall = match.balls.find((b) => b.onTable && b.id !== match.cueId() && Math.hypot(p.x - b.x, p.y - b.y) < t.R * 1.6);
        if (hitBall) {
          callBall = hitBall.id;
          renderHud();
        }
      }
      const cue = match.cueBall();
      drag = {
        id: e.pointerId, mode: placingNow() && (!placementAim || skillPlacement) ? 'cue' : 'aim', sx: e.clientX, sy: e.clientY, moved: false,
        lastA: Math.atan2(p.y - cue.y, p.x - cue.x), cue0: { x: cue.x, y: cue.y }, p0: p,
      };
      canvas.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (desk?.move(e)) return;
      if (!drag || e.pointerId !== drag.id || !canAct()) return;
      if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 6) return;
      drag.moved = true;
      const p = view.toTable(e.clientX, e.clientY);
      if (skillPlacement) { moveCast(p.x, p.y); return; }
      if (drag.mode === 'cue') {
        // The ball keeps its offset from the finger, so the finger never hides it.
        match.placeCue(drag.cue0.x + p.x - drag.p0.x, drag.cue0.y + p.y - drag.p0.y);
        return;
      }
      // Relative dial around the cue ball: the cue turns by the finger's angle change, and
      // gears down further away from the ball for precise adjustments.
      const cue = match.cueBall();
      const a = Math.atan2(p.y - cue.y, p.x - cue.x);
      const rpx = Math.hypot(p.x - cue.x, p.y - cue.y) * view.pxPerM;
      if (rpx > 22) {
        const da = Math.atan2(Math.sin(a - drag.lastA), Math.cos(a - drag.lastA));
        const k = Math.max(0.35, Math.min(1, 1 - (rpx - 150) / 450));
        aim.angle += da * k;
      }
      drag.lastA = a;
    };
    const onUp = (e: PointerEvent) => {
      if (desk?.up(e)) return;
      if (!drag || e.pointerId !== drag.id) return;
      const d = drag;
      drag = null;
      if (d.moved || !canAct() || e.type === 'pointercancel') return;
      // A tap: place the ball there, aim straight at a tapped ball, or aim at the tapped spot.
      const p = view.toTable(e.clientX, e.clientY);
      if (d.mode === 'cue') {
        if (skillPlacement) moveCast(p.x, p.y);
        else match.placeCue(p.x, p.y);
        return;
      }
      const cue = match.cueBall();
      const grab = Math.max(match.table.R * 1.8, 16 / view.pxPerM);
      const hit = match.balls
        .filter((b) => b.onTable && b.id !== cue.id && Math.hypot(p.x - b.x, p.y - b.y) < grab)
        .sort((a, b) => Math.hypot(p.x - a.x, p.y - a.y) - Math.hypot(p.x - b.x, p.y - b.y))[0];
      if (hit) {
        aimAt(hit);
        showBallTag(hit.id);
        const list = targetList();
        targetIdx = Math.max(-1, list.findIndex((b) => b.id === hit.id));
        haptic(8);
      } else if (Math.hypot(p.x - cue.x, p.y - cue.y) > match.table.R * 1.5) {
        aimAt(p);
      }
    };
    /** A tapped ball names itself for a moment, just above it on the cloth. */
    const ballTag = h('div.mx-balltag', { 'aria-live': 'polite' });
    el.append(ballTag);
    let ballTagTimer = 0;
    function showBallTag(id: number) {
      const b = match.balls.find((x) => x.id === id);
      if (!b) return;
      const k = uiScale();
      const at = view.toScreen(b.x, b.y);
      const rect = uiOrigin();
      const label = id === match.cueId() ? 'Bi cái' : match.isCarom ? (id === 2 ? 'Bi đỏ' : 'Bi đối thủ') : `Bi ${id}`;
      ballTag.replaceChildren(h('img.mx-bt-ball', { src: view.ballPortrait(id, 40), alt: '' }), h('span', null, label));
      ballTag.style.left = `${(at.x - rect.left) / k}px`;
      ballTag.style.top = `${(at.y - rect.top) / k - match.table.R * view.pxPerM / k - 6}px`;
      ballTag.classList.remove('show');
      void ballTag.offsetWidth;
      ballTag.classList.add('show');
      clearTimeout(ballTagTimer);
      ballTagTimer = window.setTimeout(() => ballTag.classList.remove('show'), 1400);
    }

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);

    // ---------- Hold-to-repeat buttons ----------
    function holdRepeat(b: HTMLButtonElement, step: () => void, hold: (dt: number, t: number) => void) {
      let id: number | null = null;
      let raf = 0;
      let t0 = 0;
      let last = 0;
      b.addEventListener('pointerdown', (e) => {
        if (e.button > 0 || b.disabled || id !== null) return;
        sound.unlock();
        id = e.pointerId;
        b.setPointerCapture(id);
        b.classList.add('pressed');
        step();
        haptic(6);
        t0 = last = performance.now();
        const loop = () => {
          if (id === null || disposed) return;
          const now = performance.now();
          const held = (now - t0) / 1000;
          if (held > 0.3) hold(Math.min(0.05, (now - last) / 1000), held - 0.3);
          last = now;
          raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
      });
      const end = (e: PointerEvent) => {
        if (e.pointerId !== id) return;
        id = null;
        cancelAnimationFrame(raf);
        b.classList.remove('pressed');
      };
      b.addEventListener('pointerup', end);
      b.addEventListener('pointercancel', end);
      b.addEventListener('lostpointercapture', end);
    }
    // One tap = 0.1°; holding sweeps faster and faster.
    const rotRate = (t: number) => Math.min(40, 1 + 14 * t * t);
    holdRepeat(rotL, () => rotate(-0.1), (dt, t) => rotate(-rotRate(t) * dt));
    holdRepeat(rotR, () => rotate(0.1), (dt, t) => rotate(rotRate(t) * dt));
    // One tap = 3 mm; holding walks the ball, then runs.
    const walk = (t: number) => Math.min(0.6, 0.05 + 0.5 * t * t);
    holdRepeat(upB, () => nudgeCue(0, -1, 0.003), (dt, t) => nudgeCue(0, -1, walk(t) * dt));
    holdRepeat(downB, () => nudgeCue(0, 1, 0.003), (dt, t) => nudgeCue(0, 1, walk(t) * dt));
    holdRepeat(leftB, () => nudgeCue(-1, 0, 0.003), (dt, t) => nudgeCue(-1, 0, walk(t) * dt));
    holdRepeat(rightB, () => nudgeCue(1, 0, 0.003), (dt, t) => nudgeCue(1, 0, walk(t) * dt));

    // ---------- Power bar: drag to set the power ----------
    let barId: number | null = null;
    const setPreset = (v: number) => {
      heldPower = null;
      preset = Math.max(0.05, Math.min(1, v));
      const lvl = Math.floor(preset * 10);
      if (lvl !== lastTick) {
        lastTick = lvl;
        sound.tick(preset);
      }
    };
    // A tap sets the power where it lands; a drag fine-tunes from the current value at a
    // reduced rate (the full track height is worth about two thirds of the range).
    let barDrag: { y: number; from: number; moved: boolean } | null = null;
    const trackLevel = (e: PointerEvent) => {
      const r = powerTrack.getBoundingClientRect();
      return 1 - (e.clientY - r.top) / r.height;
    };
    powerBar.addEventListener('pointerdown', (e) => {
      if (!canAct() || placingNow() || charging || barId !== null) return;
      sound.unlock();
      barId = e.pointerId;
      powerBar.setPointerCapture(barId);
      barActive = true;
      barDrag = { y: e.clientY, from: preset, moved: false };
    });
    powerBar.addEventListener('pointermove', (e) => {
      if (e.pointerId !== barId || !barDrag || !canAct()) return;
      const dy = e.clientY - barDrag.y;
      if (!barDrag.moved && Math.abs(dy) < 4) return;
      barDrag.moved = true;
      setPreset(barDrag.from - dy / (powerTrack.getBoundingClientRect().height * 1.5));
    });
    const barEnd = (e: PointerEvent) => {
      if (e.pointerId !== barId) return;
      if (barDrag && !barDrag.moved && e.type === 'pointerup' && canAct()) setPreset(trackLevel(e));
      barDrag = null;
      barId = null;
      barActive = false;
    };
    powerBar.addEventListener('pointerup', barEnd);
    powerBar.addEventListener('pointercancel', barEnd);

    // ---------- Strike: tap = preset power, hold = swinging meter; slide away to cancel ----------
    strikeBtn.addEventListener('pointerdown', (e) => {
      if (e.button > 0 || !canAct() || strikePress) return;
      sound.unlock();
      if (placingNow()) {
        confirmPlace();
        return;
      }
      strikePress = { id: e.pointerId, t0: performance.now() };
      strikeBtn.setPointerCapture(e.pointerId);
      strikeBtn.classList.add('pressed');
    });
    strikeBtn.addEventListener('pointermove', (e) => {
      if (!strikePress || e.pointerId !== strikePress.id) return;
      const r = strikeBtn.getBoundingClientRect();
      const d = Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2));
      const armed = d > Math.max(r.width, r.height) * 1.1;
      if (armed !== cancelArmed) {
        cancelArmed = armed;
        strikeBtn.classList.toggle('cancel', armed);
        setStrikeAction(armed ? 'cancel' : 'strike');
        haptic(12);
      }
    });
    strikeBtn.addEventListener('pointerup', (e) => {
      if (!strikePress || e.pointerId !== strikePress.id) return;
      strikePress = null;
      strikeBtn.classList.remove('pressed');
      if (charging) releaseCharge();
      else if (cancelArmed) cancelCharge();
      else fireAtPreset();
      cancelArmed = false;
      strikeBtn.classList.remove('cancel');
    });
    strikeBtn.addEventListener('pointercancel', () => cancelCharge());

    // Keyboard and wheel for desktop.
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable=true]')) return;
      if (skillSheet || spinSheet || paused || document.querySelector('.modal-wrap')) {
        if (e.type === 'keydown' && e.code === 'Escape') app.back();
        return;
      }
      if (e.type === 'keydown') {
        if (skillPlacement && e.code === 'Escape') { cancelPlacement(); return; }
        if (skillPlacement && e.code === 'KeyR') {
          previewCast({ ...skillPlacement.cast, sense: skillPlacement.cast.sense === 'cw' ? 'ccw' : 'cw', hardness: skillPlacement.cast.hardness === 'soft' ? 'hard' : 'soft' });
          return;
        }
        if (e.code.startsWith('Arrow') && canAct()) e.preventDefault();
        if (e.code === 'Space') {
          e.preventDefault();
          if (!e.repeat) {
            if (placingNow()) confirmPlace();
            else startCharge();
          }
        }
        if (e.code === 'Enter' && !e.repeat) {
          if (placingNow()) confirmPlace();
          else if (!charging) fireAtPreset();
        }
        const fine = e.shiftKey ? 0.05 : 0.5;
        if (placingNow() && (!placementAim || skillPlacement)) {
          const m = e.shiftKey ? 0.002 : 0.01;
          if (e.code === 'ArrowLeft') nudgeCue(-1, 0, m);
          if (e.code === 'ArrowRight') nudgeCue(1, 0, m);
          if (e.code === 'ArrowUp') nudgeCue(0, -1, m);
          if (e.code === 'ArrowDown') nudgeCue(0, 1, m);
        } else {
          if (e.code === 'ArrowLeft') rotate(-fine);
          if (e.code === 'ArrowRight') rotate(fine);
          if (e.code === 'ArrowUp' && canAct()) setPreset(preset + 0.05);
          if (e.code === 'ArrowDown' && canAct()) setPreset(preset - 0.05);
        }
        if (e.code === 'Tab' && canAct()) {
          e.preventDefault();
          switchTarget();
        }
        if (e.code === 'Escape') app.back();
      } else if (e.code === 'Space') {
        releaseCharge();
      }
    };
    const onWheel = (e: WheelEvent) => {
      if (!canAdjustAim()) return;
      aim.angle += Math.sign(e.deltaY) * 0.06 * DEG;
    };
    // Rotating to portrait or squeezing the window hides the table: pause instead of playing blind.
    const onBlocked = () => {
      if (!disposed && !paused && match.phase !== 'match-over') openPause();
    };
    window.addEventListener('cotien:blocked', onBlocked);
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKey);
    canvas.addEventListener('wheel', onWheel, { passive: true });

    // ---------- Match events ----------
    const off = match.on((e) => {
      switch (e.type) {
        case 'phys': {
          const p = e.e;
          if (p.t === 'ball') {
            sound.ballHit(p.speed);
            if (p.speed > 2.4) view.burst(p.x, p.y, { color: 0xffffff, count: 3, speed: 0.4, size: 0.008 });
          } else if (p.t === 'cushion') {
            sound.cushion(p.speed);
          } else if (p.t === 'pocket') {
            sound.pocket(p.speed);
            haptic(18);
            const pk = match.table.pockets[p.pocket];
            view.ring(pk.hx, pk.hy, p.id === 0 ? 0xff5a4e : 0xffe08a, 0.03);
          } else if (p.t === 'off-table') {
            haptic([25, 35, 25]);
            herald({ side: match.turn, tone: 'red', title: p.id === 0 ? 'Bi cái văng khỏi bàn' : `Bi ${p.id} văng khỏi bàn`, line: 'Cú đánh được xử lý theo luật lỗi văng bi.' });
          }
          break;
        }
        case 'shot':
          pottedBefore[0] = match.potted[0].length;
          pottedBefore[1] = match.potted[1].length;
          if (e.miscue) {
            sound.miscue();
            setExpr(e.side, 'sad');
            herald({ side: e.side, expr: 'sad', tone: 'red', title: 'Trượt cơ!', line: 'Đầu cơ trượt khỏi bi cái' });
            haptic([30, 30, 60]);
          } else {
            sound.cueStrike(Math.min(1, e.speed / 7));
            haptic(Math.round(10 + e.speed * 5));
          }
          if (e.speed > 6.5) view.addShake(0.7);
          break;
        case 'explode':
          sound.explode();
          view.ring(e.x, e.y, 0xb23a26, 0.4);
          view.burst(e.x, e.y, { color: 0x1c1a17, count: 30, speed: 1.5, size: 0.02 });
          view.addShake(1.1);
          haptic([40, 20, 80]);
          break;
        case 'energy':
          floatGain(e.side, e.gain);
          if (hasSkills && match.setup.players[e.side].kind === 'human') {
            const full = e.total >= ENERGY_MAX;
            if (full && !ultAnnounced[e.side]) {
              const ult = champion(champOf(e.side)).skills[2];
              herald({ side: e.side, expr: 'focus', title: 'Tuyệt chiêu đã đầy', line: `${ult.name}: chạm ô tuyệt chiêu để chuẩn bị`, ms: 3200 });
            }
            ultAnnounced[e.side] = full;
          }
          if (hasSkills && match.setup.players[e.side].kind === 'human') {
            hintOnce(app, { key: 'energy', title: 'Năng lượng', text: 'Mỗi cú +6, mỗi bi vào +11, cú khó còn thêm. Đầy vòng (100) thì dùng tuyệt chiêu.',
              anchor: () => cards[e.side].ringWrap, place: e.side === 0 ? 'right' : 'left', alignTop: true });
          }
          break;
        case 'skill': {
          skillIdle[e.side] = 0;
          hideSkillNudge();
          if (e.slot !== 2) sound.skill(); // the ultimate cut-in plays its own gong
          if (e.slot === 2) pendingUltimate = { champion: e.champion, skill: e.skill, side: e.side };
          setExpr(e.side, 'cast', 2400);
          herald({ side: e.side, expr: 'cast', title: e.skill.name, line: e.slot === 2 ? (match.setup.players[e.side].kind === 'human' ? 'Đã chuẩn bị · bấm ĐÁNH để thi triển' : 'Đã chuẩn bị · chờ cú đánh') : `${nameOf(e.side)} dùng chiêu` });
          if (e.skill.kinds.includes('rewind')) view.resync();
          if (e.slot !== 2) view.skillFx(e.champion, e.skill, e.side);
          if (e.slot !== 2) haptic(25);
          break;
        }
        case 'omen':
          sound.omen();
          hintOnce(app, { key: 'omen', title: 'Thiên Tượng', text: 'Gió, tuyết, rễ cây… tác động đường bi trong một cú đánh. Quan sát dấu trên nỉ để tính đường cơ.',
            anchor: () => (lefty ? ctrl : dock), place: 'right', highlight: false, rail: true });
          herald({ side: null, icon: 'warning', title: e.omen.name, line: [e.omen.desc, forceDirection(e.omen.terrain?.force)].filter(Boolean).join(' '), ms: 4200 });
          view.addShake(e.omen.jitter ? 0.6 : 0.2);
          break;
        case 'resolved':
          onResolved(e.res, e.side);
          break;
        case 'turn':
          onTurn();
          break;
        case 'new-rack':
          view.resync();
          // A sentinel, not '': an empty potted list also keys to '' and would never repaint.
          for (const c of cards) c.key = '\u0000';
          pottedBefore[0] = pottedBefore[1] = 0;
          lastTurnSide = null;
          ultAnnounced[0] = ultAnnounced[1] = false;
          skillIdle[0] = skillIdle[1] = 0;
          hideSkillNudge();
          break;
        case 'rack-over': {
          const w = e.winner;
          const announce = () => {
            if (disposed) return;
            if (!opts.challenge) {
              setExpr(w, 'joy', 5000);
              setExpr(other(w), 'sad', 5000);
              herald({ side: w, expr: 'joy', title: `${nameOf(w)} thắng ván`, line: match.lastRes?.messages.join(' ') || undefined, ms: 3000, important: true });
            }
            setTimeout(() => onRackOver(w), opts.challenge ? 700 : 1100);
          };
          // Kết liễu: a rack won by the winner's own clean shot gets their finishing strike first.
          if (!opts.challenge && match.lastShooter === w && !match.lastRes?.foul) {
            hideSkillNudge();
            void playFinisher({ stage: el, champion: champion(champOf(w)), feats: match.lastScore.names, ball: finalBall(), fromRight: w === 1 }).then(announce);
          } else announce();
          break;
        }
      }
      if (e.type !== 'phys') scheduleHud();
    });

    let hudQueued = false;
    function scheduleHud() {
      if (hudQueued) return;
      hudQueued = true;
      requestAnimationFrame(() => {
        hudQueued = false;
        if (!disposed) renderHud();
      });
    }

    function onResolved(r: Resolution, side: Side) {
      if (desk) return desk.resolved();
      const potN = Math.max(0, match.potted[side].length - pottedBefore[side]);
      if (r.foul && !opts.challenge) {
        sound.foul();
        setExpr(side, 'sad', 3000);
        herald({ side, expr: 'sad', tone: 'red', title: r.ballInHand !== 'none' ? 'Phạm lỗi, đối thủ được đặt bi' : 'Phạm lỗi', line: r.foul, ms: 3400 });
        hintOnce(app, { key: 'foul', title: 'Phạm lỗi', text: 'Đối thủ được đặt bi cái sau lỗi; họ có thể đặt trong vùng cho phép rồi đánh. Xem lý do trong thông báo giữa bàn.',
          anchor: () => (lefty ? ctrl : dock), place: 'right', highlight: false, rail: true });
      } else if (r.winner === null && (potN > 0 || r.points > 0) && r.keepTurn) {
        sound.good();
        setExpr(side, 'joy');
        // A hard or pretty shot is named, so players see what earned the extra energy.
        const sc = match.lastScore;
        const title = r.highlight === 'golden' ? 'Bi vàng!' : sc.tier === 2 ? 'Tuyệt kỹ!' : sc.tier === 1 ? 'Cú đẹp!' : match.isCarom ? 'Ghi điểm!' : potN > 1 ? `Ăn ${potN} bi!` : 'Ăn bi!';
        const feats = sc.names.join(' · ');
        herald({ side, expr: 'joy', title, line: [feats, r.messages.join(' ')].filter(Boolean).join(' — ') || 'Đánh tiếp' });
      } else if (r.winner === null && r.messages.length) {
        if (!r.foul && (r.keepTurn || r.points)) sound.good();
        herald({ side, title: r.messages[0], line: r.messages.slice(1).join(' ') || undefined });
      }
      // AI may answer a missed shot with Hồi Cục.
      const p = match.setup.players[side];
      const rewindSlot = match.setup.classic ? -1 : match.skills(side).findIndex((sk) => sk.kinds[0] === 'rewind');
      if (p.kind === 'ai' && !r.keepTurn && r.winner !== side && rewindSlot >= 0 && (p.ai?.level ?? 1) >= 3) {
        const token = aiToken;
        setTimeout(() => {
          if (disposed || token !== aiToken) return;
          if (rng.next() < 0.6 && match.canUseSkill(side, rewindSlot)) match.useSkill(side, rewindSlot);
        }, 800);
      }
    }

    /** First-time explanations, queued in the top strip, outside the playing surface. */
    function coachTurn() {
      if (solo) return;
      const mode = match.setup.mode;
      if (hasSkills) {
        const side = humanSide() ?? match.turn;
        hintOnce(app, { key: 'energy', title: 'Năng lượng', text: 'Mỗi cú +6, mỗi bi vào +11, cú khó còn thêm. Đầy vòng (100) thì dùng tuyệt chiêu.',
          anchor: () => cards[side].ringWrap, place: side === 0 ? 'right' : 'left', alignTop: true });
      }
      const beside = lefty ? 'right' : 'left';
      hintOnce(app, { key: `rules-${mode}`, title: `Luật ${MODE_NAMES[mode]}`, text: `${RULES_TEXT[mode].goal} Xem menu tạm dừng, mục Luật chơi.`, anchor: () => (lefty ? ctrl : dock), place: 'right', highlight: false, rail: true });
      hintOnce(app, { key: 'ctl-aim', title: 'Ngắm', text: h('span', null, 'Kéo trên bàn để xoay cơ, chạm bi để ngắm thẳng. ', icon('rotate-left'), icon('rotate-right'), ' chỉnh từng chút, ', icon('switch-target'), ' đổi mục tiêu.'),
        anchor: () => ctrl, place: beside, rail: true, alignTop: true });
      hintOnce(app, { key: 'ctl-power', title: 'Lực và đánh', text: 'Chạm thanh lực để đặt mức, kéo để tinh chỉnh, rồi chạm ĐÁNH. Hoặc giữ ĐÁNH và thả đúng lực; trượt ngón ra xa để huỷ.',
        anchor: () => powerBar, place: beside });
      if (match.canMoveCue) {
        hintOnce(app, { key: 'ctl-ballinhand', title: match.state.isBreak ? 'Đặt bi phá' : 'Đặt bi cái', text: 'Kéo bi cái hoặc chạm bàn để dời bi. Dùng nút hướng để chỉnh nhỏ. Chọn Ngắm thử để chỉnh hướng và xem đường bi trước khi bấm ĐẶT BI.',
          anchor: () => dpad, place: beside });
      }
      if (match.callType() !== 'none') {
        hintOnce(app, { key: 'call', title: 'Gọi lỗ', text: 'Chạm bi và lỗ định đánh trước khi ra cơ. Bi vào lỗ khác không được tính.',
          anchor: () => objPlate, place: 'below' });
      }
    }

    function onTurn() {
      aim.elevation = 0;
      pendingUltimate = null;
      placeConfirmed = false;
      placementAim = false;
      cancelCharge();
      closeSheets();
      pushOut = false;
      callPocket = null;
      callBall = null;
      aiCall = null;
      firedCall = null;
      targetIdx = -1;
      view.refreshCue();
      if (match.phase === 'option') {
        if (match.current.kind === 'ai') void aiTurn();
        else setTimeout(() => !disposed && openOption(), 500);
        return;
      }
      if (match.phase !== 'aim') return;
      const side = match.turn;
      const changed = lastTurnSide !== side;
      lastTurnSide = side;
      if (match.current.kind === 'ai') {
        void aiTurn();
      } else {
        aim.side = 0;
        aim.vert = 0;
        heldPower = null;
        preset = presets[side];
        updateSpinDot();
        aimFirstTarget();
        if (match.canMoveCue) {
          const placingTitle = match.state.isBreak ? 'Đặt bi phá' : 'Đặt bi cái';
          herald({ side, title: changed && !solo ? `Lượt của ${nameOf(side)}` : placingTitle, line: `${placingTitle}: dời bi, Ngắm thử, rồi ĐẶT BI` });
        }
        else if (changed && !solo) herald({ side, title: `Lượt của ${nameOf(side)}`, line: match.objective() });
        hintTurn(app);
        coachTurn();
        if (hasSkills) {
          // Players used to plain billiards forget their kit: after a turn without casting,
          // point at a ready skill once the turn announcement has had its moment.
          const idle = skillIdle[side]++;
          if (idle >= 1) setTimeout(() => nudgeSkill(side), 1900);
        }
      }
    }

    const skillNudge = h('button.mx-skillnudge', { type: 'button' });
    el.append(skillNudge);
    let nudgeTimer = 0;
    function hideSkillNudge() {
      clearTimeout(nudgeTimer);
      skillNudge.classList.remove('show');
      slots.forEach((s) => s.b.classList.remove('nudge'));
    }
    function nudgeSkill(side: Side) {
      if (disposed || match.turn !== side || !canAct() || skillSheet) return;
      const ready = champion(champOf(side)).skills.filter((sk) => match.canUseSkill(side, sk.slot));
      const sk = ready.find((x) => x.slot === 2) ?? ready[0];
      if (!sk) return;
      const slot = slots[sk.slot].b;
      skillNudge.replaceChildren(h('b', null, sk.name), sk.slot === 2 ? 'Tuyệt chiêu sẵn sàng · chạm để dùng' : 'Chiêu sẵn sàng · chạm để dùng');
      skillNudge.onclick = () => { hideSkillNudge(); openSkill(sk.slot); };
      skillNudge.style.top = `${slot.offsetTop + dock.offsetTop + slot.offsetHeight / 2}px`;
      skillNudge.classList.add('show');
      slot.classList.add('nudge');
      clearTimeout(nudgeTimer);
      nudgeTimer = window.setTimeout(hideSkillNudge, 4500);
    }

    // ---------- AI ----------
    async function aiTurn() {
      const token = ++aiToken;
      const side = match.turn;
      const player = match.setup.players[side];
      aiActing = true;
      showAiCue = false;
      setFocus(side, true);
      setThinking(side);
      renderHud();
      if (match.phase === 'aim') {
        if (match.passive(side) === 'hophap') match.useGuard();
        if (match.passive(side) === 'phaptu') match.choosePassive(match.isCarom ? 'side' : 'vert');
        if (match.passive(side) === 'anhsat') match.choosePassive('power');
      }
      const view0 = match.aiView();
      const req: AiRequest = {
        balls: view0.balls, state: view0.state, side, profile: player.ai!, maxSpeed: match.vmax(side), spinReach: match.spinReach(side), secondChance: match.secondChance, shield: match.shield[side], pocketPull: match.pull, blast: match.blast ? { radius: match.blast.radius, force: match.blast.force, directional: !!match.blast.direction } : undefined,
        ballInHand: match.placing === 'nudge' ? 'none' : match.placing, closedPockets: view0.closedPockets,
        params: match.params, terrain: match.terrain(),
        extraSegments: match.obstacles().slice(match.closedPockets.length), captureScale: match.simulationWorld().captureScale ?? 1, seed: (Math.random() * 1e9) | 0, option: match.phase === 'option',
        pushOutAvailable: match.state.pushOutAvailable, energy: match.energy[side],
        skills: match.skills(side).filter((sk) => match.canUseSkill(side, sk.slot)).map((sk) => ({ slot: sk.slot, kind: match.effectiveKind(sk.kinds[0]), ultimate: sk.slot === 2, tier: sk.tier, kinds: sk.kinds.map(k => match.effectiveKind(k)), target: sk.target, ult: sk.ult, shape: sk.shape, directionalBlast: champion(match.current.champion).sect === 'huyetsat' })),
      };
      const started = performance.now();
      const decision = await app.ai.think(req);
      const minThink = 350 + rng.next() * 400;
      const wait = minThink - (performance.now() - started);
      if (wait > 0) await sleep(wait);
      if (disposed || token !== aiToken) return;
      setThinking(null);
      if (match.phase === 'option') {
        const choice = decision.option ?? 'play';
        herald({ side, title: `${player.name} chọn ${choice === 'play' ? 'đánh tiếp' : match.state.pendingOption === 'illegal-break-8' ? 'xếp lại bi' : 'nhường lại'}` });
        aiActing = false;
        setFocus(side, false);
        match.chooseOption(choice);
        return;
      }
      const shot = decision.shot;
      if (!shot) {
        aiActing = false;
        setFocus(side, false);
        return;
      }
      if (shot.call) {
        aiCall = shot.call;
        const ballTxt = match.callType() === 'ball-pocket' || shot.call.ball !== 8 ? `bi ${shot.call.ball}` : 'bi 8';
        herald({ side, expr: 'focus', icon: 'target', title: `${player.name} gọi ${ballTxt}`, line: POCKET_NAMES[shot.call.pocket] });
      }
      if (decision.skill !== undefined && match.canUseSkill(side, decision.skill)) {
        match.useSkill(side, decision.skill, decision.cast);
        await sleep(decision.skill === 2 ? 1400 : 450);
      }
      showAiCue = true;
      // Walk the cue ball to its spot.
      if (shot.cue && match.canMoveCue) {
        const c = match.cueBall();
        const from = { x: c.x, y: c.y };
        await animate(380, (k) => {
          c.x = from.x + (shot.cue!.x - from.x) * k;
          c.y = from.y + (shot.cue!.y - from.y) * k;
        });
        match.placeCue(shot.cue.x, shot.cue.y);
      }
      if (disposed || token !== aiToken) return;
      // Swing the cue around like a player lining up.
      aim.elevation = 0;
      const a0 = aim.angle;
      let da = shot.angle - a0;
      da = Math.atan2(Math.sin(da), Math.cos(da));
      await animate(300 + Math.abs(da) * 120, (k) => {
        aim.angle = a0 + da * k;
        aim.side = shot.side * k;
        aim.vert = shot.vert * k;
      });
      await sleep(120 + rng.next() * 160);
      if (disposed || token !== aiToken) return;
      // Charge, then strike.
      charging = true;
      holdT = 0;
      await animate(200 + shot.power * 450, (k) => {
        power = shot.power * k;
      }, (k) => k);
      charging = false;
      if (disposed || token !== aiToken) return;
      aiActing = false;
      setFocus(side, false);
      // The AI's call comes from its plan, not from the human aim helpers.
      fire(shot.angle, shot.power, shot.side, shot.vert, shot.call);
    }

    // Presentation waits use active match time so an AI cannot strike behind the pause sheet.
    function sleep(ms: number) {
      return new Promise<void>((resolve) => {
        let elapsed = 0;
        let last = performance.now();
        const step = () => {
          const now = performance.now();
          if (!paused) elapsed += now - last;
          last = now;
          if (disposed || elapsed >= ms) resolve();
          else requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });
    }

    function animate(ms: number, fn: (k: number) => void, ease = (k: number) => k * k * (3 - 2 * k)) {
      return new Promise<void>((resolve) => {
        let elapsed = 0;
        let last = performance.now();
        const stepFn = () => {
          if (disposed) return resolve();
          const now = performance.now();
          if (!paused) elapsed += now - last;
          last = now;
          const k = Math.min(1, elapsed / ms);
          fn(ease(k));
          if (k < 1) requestAnimationFrame(stepFn);
          else resolve();
        };
        requestAnimationFrame(stepFn);
      });
    }

    // ---------- Dialogs ----------
    function openOption() {
      const kind = match.state.pendingOption;
      const prev = nameOf(other(match.turn));
      const text = {
        'push-out': `${prev} vừa đẩy bi (push-out). Bạn muốn tự đánh từ vị trí này hay bắt ${prev} đánh?`,
        'wrong-call': `${prev} làm bi vào không đúng lời gọi. Bạn đánh tiếp hay bắt ${prev} đánh lại?`,
        'illegal-break-9': `Cú phá chưa đủ 3 bi (vào lỗ hoặc qua vạch đầu bàn). Nhận bàn (mất quyền push-out) hay trả lại cho ${prev}?`,
        'illegal-break-8': 'Cú phá không hợp lệ. Bạn nhận bàn như hiện tại, hay xếp lại bi và tự phá?',
      }[kind ?? 'push-out'];
      const passLabel = kind === 'illegal-break-8' ? 'Xếp lại & tự phá' : 'Nhường lại';
      modal((close) => h('div.modal.mx-modal', null,
        h('h2', null, 'Quyền chọn'),
        h('p.mx-mtext', null, text),
        h('div.actions', null,
          btn(passLabel, () => {
            close();
            match.chooseOption('pass');
          }, 'ghost'),
          btn('Tôi đánh', () => {
            close();
            match.chooseOption('play');
          }),
        ),
      ), { backDismissable: false });
    }

    /** Result sheet with the champion's art on the left. */
    function artModal(art: string, build: (close: () => void) => (Node | null)[]) {
      return modal((close) => h('div.modal.mx-modal.mx-result', null,
        h('div.mx-res-art', null, h('img', { src: art, alt: '', draggable: false })),
        h('div.mx-res-body', null, ...build(close))), { backDismissable: false });
    }

    function onRackOver(winner: Side) {
      if (disposed) return;
      if (opts.challenge) {
        const ok = winner === 0;
        const r = opts.challenge.onResult(ok, attempt);
        if (ok) sound.win();
        else sound.lose();
        setExpr(0, ok ? 'joy' : 'sad', 6000);
        const triesLeft = opts.challenge.tries - attempt;
        artModal(ok ? winUrl(champOf(0)) : exprUrl(champOf(0), 'sad'), (close) => [
          h('h2', null, ok ? 'Hoàn thành!' : 'Chưa được'),
          h('p.mx-mtext', null, match.lastRes?.messages[0] ?? ''),
          h('p.mx-mgoal', null, h('b', null, 'Mục tiêu: '), opts.challenge!.goal, h('span', null, ` · lượt ${attempt}/${opts.challenge!.tries}`)),
          ok ? stars(r.stars) : h('p.muted', null, triesLeft > 0 ? `Còn ${triesLeft} lượt thử` : 'Hết lượt thử. Thử lại từ đầu nhé'),
          h('div.actions', null,
            btn('Về danh sách', () => {
              close();
              opts.onExit();
            }, 'ghost'),
            ok && r.next ? btn('Thử thách tiếp', () => {
              close();
              r.next!();
            }) : null,
            btn(ok ? 'Chơi lại' : 'Thử lại', () => {
              close();
              attempt = ok || triesLeft <= 0 ? 1 : attempt + 1;
              match.retryLayout();
              aimFirstTarget();
              renderHud();
            }, ok ? 'ghost' : ''),
          ),
        ]);
        return;
      }
      if (match.phase === 'match-over') return onMatchOver(winner);
      if (match.phase !== 'rack-over') return; // rewound meanwhile
      const hs = humanSide();
      const humanLost = hs !== null && winner !== hs && match.setup.players[other(hs)].kind === 'ai';
      if (hs !== null && winner === hs) sound.win();
      else if (humanLost) sound.lose();
      const rewindSlot = hs === null ? -1 : match.skills(hs).findIndex((sk) => sk.kinds[0] === 'rewind');
      const canRewind = humanLost && rewindSlot >= 0 && match.canUseSkill(hs!, rewindSlot);
      setTimeout(() => {
        if (disposed || match.phase !== 'rack-over') return;
        artModal(exprUrl(champOf(winner), 'joy'), (close) => [
          h('div.mx-res-kicker', null, `Ván ${match.rackNo}`),
          h('h2', null, `${nameOf(winner)} thắng ván`),
          h('div.mx-res-score.num', null, `${match.rackWins[0]} – ${match.rackWins[1]}`),
          h('p.mx-mtext', null, match.lastRes?.messages.join(' ') ?? ''),
          h('div.actions', null,
            canRewind ? btn(frag(icon('rewind'), match.skills(hs!)[rewindSlot].name), () => {
              close();
              match.useSkill(hs!, rewindSlot);
            }, 'ghost') : null,
            btn('Ván tiếp', () => {
              close();
              match.nextRack();
            }),
          ),
        ]);
      }, 900);
    }

    function onMatchOver(winner: Side) {
      const hs = humanSide();
      const won = hs !== null && winner === hs;
      const vsAi = match.setup.players.some((p) => p.kind === 'ai');
      if (won || !vsAi) sound.win();
      else sound.lose();
      const end = opts.onEnd?.({ won, match }) ?? { lines: [] };
      keepAwake(false);
      const me = hs ?? 0;
      setTimeout(() => {
        if (disposed) return;
        artModal(winUrl(champOf(winner)), () => [
          h('div.mx-res-kicker', null, `${opts.label} · ${MODE_NAMES[match.setup.mode]}`),
          h('h2', null, vsAi ? (won ? 'Chiến thắng!' : 'Thất bại') : `${nameOf(winner)} thắng!`),
          h('div.mx-res-score.num', null, `${match.rackWins[0]} – ${match.rackWins[1]}`),
          h('p.muted', null, `${match.stats[me].pots} bi · loạt dài nhất ${match.stats[me].bestRun} · ${match.stats[me].fouls} lỗi`),
          end.lines.length ? h('div.mx-res-lines', null, ...end.lines.map((l) => h('div.kv', null, h('span', null, l)))) : null,
          h('div.actions', null,
            btn('Về menu', () => opts.onExit(), 'ghost'),
            end.again ? btn('Đấu lại', () => end.again!()) : null,
          ),
        ]);
      }, 1200);
    }

    function openPause() {
      if (paused) return;
      closeSheets();
      paused = true;
      cutIn?.classList.add('paused');
      cancelCharge();
      const s = app.profile.settings;
      const resume = () => {
        paused = false;
        pauseWrap = null;
        renderHud();
      };
      const done = () => closePause();
      const closePause = modal((close) => {
        // Quick switches: painted icon, label, on/off state; one tap flips them.
        const quick = (ic: IconName, label: string, on: () => boolean, flip: () => void) => {
          const b = tap(h('button.mx-pq', { type: 'button' }, icon(ic), h('span', null, label), h('b.mx-pq-state')), () => {
            flip();
            app.save();
            paint();
          });
          const paint = () => {
            b.setAttribute('aria-pressed', String(on()));
            b.querySelector('.mx-pq-state')!.textContent = on() ? 'Bật' : 'Tắt';
          };
          paint();
          return b;
        };
        // Who is at the table and how it stands, from the HUD's own cards.
        const side = (sd: Side) => h('div.mx-ps-side', { class: sd ? 'r' : '' },
          h('span.mx-ps-av', null, avatar(champOf(sd))),
          h('span.mx-ps-who', null, h('b', null, nameOf(sd)), h('span', null, cards[sd].sub.textContent || '')),
          h('span.mx-ps-score.num', null, cards[sd].score.textContent || '0'));
        const box = h('div.modal.mx-modal.mx-pausebox', null,
          h('div.mx-pause-main', null,
            h('div.mx-pause-head', null,
              h('h2', null, 'Tạm dừng'),
              h('div.mx-pause-sub', null, `${opts.label} · ${MODE_NAMES[match.setup.mode]}${match.setup.mutator ? ' · có biến thể bàn' : ''}`)),
            h('div.mx-pause-board', null, side(0), solo ? null : h('span.mx-ps-vs', null, 'đấu'), solo ? null : side(1)),
            h('div.mx-pause-quick', null,
              quick('sound', 'Âm thanh', () => s.sfx > 0, () => {
                s.sfx = s.sfx > 0 ? 0 : 0.9;
                app.applySettings();
              }),
              quick('music', 'Nhạc nền', () => s.music > 0, () => {
                s.music = s.music > 0 ? 0 : 0.3;
                app.applySettings();
                if (s.music > 0) sound.startMusic();
                else sound.stopMusic();
              }),
              quick('info', 'Thông báo', () => s.herald, () => {
                s.herald = !s.herald;
              }))),
          h('div.mx-pause-actions', null,
            btn(frag(icon('play'), 'Tiếp tục'), done, 'block big'),
            btn(frag(icon('scroll'), 'Luật chơi'), openRules, 'secondary block'),
            btn(frag(icon('hint'), 'Cách điều khiển'), openHelp, 'secondary block'),
            isTouchDevice() ? null : btn(frag(icon('fullscreen'), 'Toàn màn hình'), () => void toggleFullscreen(), 'secondary block'),
            btn(frag(icon('back'), 'Thoát trận'), () => {
              // Leaving throws the match away, so ask once more.
              modal((closeAsk) => h('div.modal.mx-modal.mx-leave-ask', null,
                h('h2', null, 'Thoát trận?'),
                h('p.mx-mtext', null, 'Trận đang đấu sẽ kết thúc ngay và không được tính.'),
                h('div.actions', null,
                  btn('Ở lại', closeAsk, 'secondary'),
                  btn(frag(icon('back'), 'Thoát'), () => {
                    closeAsk();
                    close();
                    opts.onExit();
                  })),
              ), { dismissable: true });
            }, 'ghost block mx-leave'),
          ),
        );
        queueMicrotask(() => (pauseWrap = box.parentElement));
        return box;
      }, { onClose: resume });
    }

    function openRules() {
      const r = RULES_TEXT[match.setup.mode];
      modal((close) => h('div.modal.scroll.mx-modal.mx-rules', null,
        h('h2', null, `Luật ${MODE_NAMES[match.setup.mode]}`),
        h('p.mx-mtext', null, r.goal),
        h('ul.mx-list', null, ...r.points.map((t) => h('li', null, t))),
        match.setup.classic ? null : h('div', null, h('div.section-title', null, 'Tiên Đạo'), h('ul.mx-list', null, ...SKILL_RULES.map((t) => h('li', null, t)))),
        h('div.actions', null, btn('Đã hiểu', close)),
      ), { dismissable: true });
    }

    function openHelp() {
      const tip = (ic: IconName, title: string, text: string) =>
        h('div.mx-help-item', null, h('span.mx-help-ic', null, icon(ic)), h('div', null, h('b', null, title), h('div', null, text)));
      modal((close) => h('div.modal.scroll.mx-modal.mx-help', null,
        h('h2', null, 'Cách điều khiển'),
        h('div.mx-help-grid', null,
          tip('rotate-right', 'Ngắm', 'Kéo trên bàn để xoay cơ; kéo xa bi cái thì xoay chậm, tinh. Chạm một bi để ngắm thẳng. Nút xoay: chạm = 0,1°, giữ = xoay nhanh dần.'),
          tip('switch-target', 'Đổi mục tiêu', 'Nhảy lần lượt qua các bi hợp lệ: bi nhỏ nhất ở 9/10 bi, bi nhóm mình ở 8 bi.'),
          tip('spin', 'Áp phê', 'Kéo trên bi cái nhỏ để chỉnh nhanh điểm đánh. Cần chính xác thì chạm để mở bi lớn, chạm điểm đánh hoặc chọn nhanh Giữa, Trô, Cule, Giật, Trái, Phải.'),
          tip('power', 'Lực', 'Chạm thanh lực để đặt mức, kéo lên xuống để tinh chỉnh, rồi chạm ĐÁNH. Hoặc giữ ĐÁNH cho lực dao động, thả đúng lúc; trượt ra xa để huỷ.'),
          tip('place', match.state.isBreak ? 'Đặt bi phá' : 'Đặt bi cái', 'Kéo bi cái, chạm chỗ muốn đặt, hoặc dùng 4 nút mũi tên. Chọn Ngắm thử để chỉnh hướng; Dời bi để quay lại. Bấm ĐẶT BI để chốt.'),
          tip('energy', 'Chiêu và năng lượng', 'Chạm ô chiêu để đọc rồi bấm Dùng. Năng lượng tăng mỗi cú đánh, mỗi bi vào (cú càng khó càng nhiều) và khi đối thủ lỗi; cần đầy thanh năng lượng để dùng tuyệt chiêu.'),
          tip('target', 'Gọi lỗ', 'Khi phải gọi: chạm bi (nếu cần) rồi chạm lỗ trên bàn trước khi đánh.'),
          tip('settings', 'Bàn phím', 'Mũi tên xoay (Shift = tinh), lên/xuống chỉnh lực, Tab đổi mục tiêu, Enter đánh, giữ Space nạp lực, lăn chuột xoay tinh.'),
        ),
        h('div.actions', null, btn('Đã hiểu', () => {
          close();
          app.profile.tutorialSeen = true;
          app.save();
        })),
      ), { dismissable: true });
    }

    // ---------- Called-shot marker ----------
    let callTagKey = '';
    let callTagPos = '';

    function currentCall(): { ball: number | null; pocket: number } | null {
      if (match.phase === 'rolling') return firedCall;
      if (match.phase !== 'aim' || match.callType() === 'none') return null;
      if (aiActing || match.current.kind === 'ai') return aiCall;
      const ball = match.callType() === 'ball-pocket' ? callBallId() : 8;
      return callPocket === null && callBall === null ? null : { ball, pocket: callPocket ?? -1 };
    }

    function placeCallTag() {
      const cs = view.calledShot;
      if (!cs || cs.pocket < 0) {
        if (callTagKey) {
          callTag.style.display = 'none';
          callTagKey = '';
          callTagPos = '';
        }
        return;
      }
      const p = match.table.pockets[cs.pocket];
      const k = uiScale();
      const sp0 = view.toScreen(p.hx, p.hy);
      const rect = uiOrigin();
      const sp = { x: (sp0.x - rect.left) / k, y: (sp0.y - rect.top) / k };
      // Push the tag toward the table centre so it never sits off-screen.
      const dirX = -Math.sign(p.hx) || 0;
      const dirY = -Math.sign(p.hy);
      // Keep the call marker clear of the pocket hit target. It is visual-only,
      // but placing it on the mouth made the final-ball pocket look unavailable.
      const offPx = ((p.hr + 0.16) * view.pxPerM) / k;
      const pos = `${Math.round(sp.x + dirX * offPx)},${Math.round(sp.y + dirY * offPx)}`;
      if (pos !== callTagPos) {
        callTagPos = pos;
        const [x, y] = pos.split(',');
        callTag.style.left = `${x}px`;
        callTag.style.top = `${y}px`;
      }
      const key = `${cs.ball}|${cs.pocket}|${match.turn}`;
      if (key !== callTagKey) {
        callTagKey = key;
        callTag.replaceChildren(h('span.mx-ct-label', null, 'Gọi'));
        if (cs.ball !== null) callTag.append(miniBall(cs.ball), h('b', null, String(cs.ball)));
        callTag.style.display = '';
        callTag.classList.remove('pop');
        void callTag.offsetWidth;
        callTag.classList.add('pop');
      }
    }

    // ---------- Frame loop (no DOM writes unless something changed) ----------
    const tick = (ticker: Ticker) => {
      const dt = Math.min(0.05, ticker.deltaMS / 1000);
      if (!paused) match.update(dt);
      // The pause sheet can be closed by the system back gesture too.
      if (paused && pauseWrap && !pauseWrap.isConnected) {
        paused = false;
        pauseWrap = null;
        renderHud();
      }
      // A held ĐÁNH turns into the swinging meter.
      if (strikePress && !charging && performance.now() - strikePress.t0 > 260 && canAct()) {
        startCharge();
        if (!charging) strikePress = null;
      }
      cutIn?.classList.toggle('paused', paused);
      if (paused) return;
      // Charging meter: triangle wave that speeds up each half cycle.
      if (charging && match.current.kind === 'human') {
        holdT += dt;
        const speed = 0.9 * (1 + Math.floor(chargeT) * 0.14);
        chargeT += dt * speed;
        const ph = chargeT % 2;
        power = ph < 1 ? ph : 2 - ph;
        const lvl = Math.floor(power * 10);
        if (lvl !== lastTick) {
          lastTick = lvl;
          sound.tick(power);
          if (lvl >= 9) haptic(8);
        }
      } else if (charging) {
        holdT += dt;
      }
      if (placingNow() && !skillPlacement && !placementAim) {
        const c = match.cueBall();
        const k = uiScale();
        const sp0 = view.toScreen(c.x, c.y);
        const rect = uiOrigin();
        const sp = { x: (sp0.x - rect.left) / k, y: (sp0.y - rect.top) / k };
        const key = `${Math.round(sp.x * 2)},${Math.round(sp.y * 2)}`;
        if (key !== handKey) {
          handKey = key;
          hand.style.display = '';
          // Measured once per layout: reading offset sizes every frame would force a layout each time.
          if (!handSize.w) handSize = { w: hand.offsetWidth, h: hand.offsetHeight };
          hand.style.transform = `translate(${sp.x - handSize.w * HAND.cx}px, ${sp.y - handSize.h * HAND.cy}px)`;
        }
      } else if (handKey !== 'off') {
        handKey = 'off';
        hand.style.display = 'none';
      }
      if (strikeT > 0) {
        strikeT += dt / 0.09;
        if (strikeT >= 1.6) {
          strikeT = 0;
          heldPower = strikePull;
          power = 0;
          renderControls();
        }
      }
      const humanAim = !desk?.arranging && match.phase === 'aim' && (isHumanTurn() || showAiCue);
      // Preview the cue while aiming in hand, while confirmation still gates shooting.
      const showCue = (humanAim || strikeT > 0) && (!placingNow() || !skillPlacement && placementAim);
      const ct = match.callType();
      const pull = strikeT > 0 ? strikePull : charging ? power : barActive ? preset : 0;
      if (match.aimLock) wobbleAmp();
      const av: AimView | null = humanAim || strikeT > 0 ? {
        angle: aim.angle + wobbleNow(),
        pull,
        side: aim.side,
        vert: aim.vert,
        elevation: aim.elevation,
        power: aim.elevation > 0 ? (charging ? power : preset) : Math.max(charging ? power : preset, 0.5),
        showCue,
        showGuide: humanAim && isHumanTurn() && (!placingNow() || !skillPlacement && placementAim) && match.tremorNow === 1 && strikeT === 0,
        guideScale: guideScale(),
        fog: match.setup.mutator === 'fog',
        pocketChoices: ct !== 'none' && isHumanTurn() && !placingNow(),
        strike: strikeT > 0 ? Math.min(1, strikeT) : 0,
      } : null;
      view.calledShot = currentCall();
      placeCallTag();
      view.update(dt, av);
      // Power UI: the live charge while swinging, otherwise the set power.
      const shown = strikeT > 0 ? strikePull : charging ? power : heldPower ?? preset;
      const pk = `${Math.round(shown * 100)}|${charging}`;
      if (pk !== powerKey) {
        powerKey = pk;
        powerFill.style.transform = `scaleY(${shown})`;
        powerPct.textContent = String(Math.round(shown * 100));
        powerBar.setAttribute('aria-valuenow', String(Math.round(shown * 100)));
        powerBar.classList.toggle('hot', shown > 0.85);
        powerBar.classList.toggle('live', charging);
      }
    };
    app.pixi.ticker.add(tick);
    // After the frame's updates: the table is drawn only when its picture changed.
    const draw = () => {
      if (view.shouldRender()) app.pixi.render();
    };
    app.pixi.ticker.add(draw, undefined, UPDATE_PRIORITY.LOW);

    // ---------- Start ----------
    function showVs(done: () => void) {
      const t = opts.titles ?? ['', ''];
      const side = (s: Side) => h('div.mx-vs-side', { class: s ? 'r' : '' },
        h('div.mx-vs-av', null, avatar(champOf(s))),
        h('div.mx-vs-name', null, nameOf(s)),
        h('div.mx-vs-title', null, t[s] || champion(champOf(s)).name));
      const vs = h('div.mx-vs', null, side(0), h('div.mx-vs-mid', null, 'VS'), side(1),
        opts.quote ? h('div.mx-vs-quote', null, `“${opts.quote}”`) : null);
      el.append(vs);
      const finish = () => {
        vs.remove();
        done();
      };
      tap(vs, finish);
      setTimeout(() => vs.isConnected && finish(), opts.quote ? 3200 : 2000);
    }

    keepAwake(true);
    updateSpinDot();
    renderHud();
    const begin = () => {
      if (disposed) return;
      begun = true;
      onTurn();
      renderHud();
    };
    if (solo) begin();
    else showVs(begin);

    return {
      el,
      usesStage: true,
      // The opponent's homeland hangs behind the table.
      backdrop: sectArtUrl(champion(opts.setup.players[1].champion).sect, 'splash'),
      cast: [cutoutUrl(champOf(0)), solo ? null : cutoutUrl(champOf(1))],
      onBack: () => {
        if (skillSheet || spinSheet) {
          closeSheets();
          return true;
        }
        openPause();
        return true;
      },
      dispose: () => {
        disposed = true;
        aiToken++;
        off();
        clearTimeout(heraldTimer);
        for (const c of cards) clearTimeout(c.timer);
        clearHints();
        app.ai.cancelAll();
        app.pixi.ticker.remove(tick);
        app.pixi.ticker.remove(draw);
        window.removeEventListener('resize', onResize);
        window.removeEventListener('cotien:ui-resize', onResize);
        cutIn?.remove();
        window.removeEventListener('keydown', onKey);
        window.removeEventListener('keydown', dismissHerald, true);
        app.pixi.canvas.removeEventListener('pointerdown', dismissHerald, true);
        window.removeEventListener('keyup', onKey);
        canvas.removeEventListener('pointerdown', onDown);
        canvas.removeEventListener('pointermove', onMove);
        canvas.removeEventListener('pointerup', onUp);
        canvas.removeEventListener('pointercancel', onUp);
        canvas.removeEventListener('wheel', onWheel);
        window.removeEventListener('cotien:blocked', onBlocked);
        document.querySelectorAll('.modal-wrap').forEach((m) => m.remove());
        app.pixi.stage.removeChild(view.root);
        view.destroy();
        keepAwake(false);
      },
    };
  };
}
