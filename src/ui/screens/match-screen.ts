import type { Ticker } from 'pixi.js';
import type { AiRequest } from '../../ai/types';
import { sound } from '../../audio/sound';
import { ballCss } from '../../core/ball-styles';
import { MODE_NAMES } from '../../core/rules';
import { other, type Resolution, type ShotCall, type Side } from '../../core/rules/types';
import { Rng } from '../../core/rng';
import { champion, exprUrl, portraitUrl, sect, skillIconUrl, winUrl } from '../../game/content/sects';
import { RULES_TEXT, SKILL_RULES } from '../../game/content/rules-text';
import { ENERGY_MAX, Match, type MatchSetup } from '../../game/match';
import { haptic, isTouchDevice, keepAwake, toggleFullscreen } from '../../platform/device';
import { TableView, type AimView } from '../../render/table-view';
import type { App, Screen } from '../app';
import { avatar } from '../avatar';
import { btn, h, item, modal, stars, tap, toggle } from '../dom';
import { clearHints, hintOnce } from '../hints';
import { icon, type IconName } from '../icons';
import { playCutIn } from '../skill-cutin';

export interface MatchResult {
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

    // ---------- Aim / input state ----------
    const aim = { angle: 0, side: 0, vert: 0 };
    /** Power the player set on the power bar; a tap on ĐÁNH shoots with it. */
    let preset = 0.55;
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
    /** Ball in hand: the player moves the cue ball, then confirms with ĐẶT BI before aiming. */
    let placeConfirmed = false;
    let callPocket: number | null = null;
    let callBall: number | null = null;
    /** Call announced by the AI before it lines up, and the call of the shot in flight. */
    let aiCall: ShotCall | null = null;
    let firedCall: ShotCall | null = null;
    let pushOut = false;
    let aiToken = 0;
    let aiActing = false;
    let disposed = false;
    let begun = false;
    let paused = false;
    let pauseWrap: HTMLElement | null = null;
    let attempt = 1;
    let lastTick = 0;
    let showAiCue = false;
    let targetIdx = -1;
    let lastTurnSide: Side | null = null;
    const pottedBefore: [number, number] = [0, 0];
    /** Last values written to the DOM by the frame loop. */
    let handKey = '';
    let powerKey = '';

    const isHumanTurn = () => match.current.kind === 'human' && !aiActing;
    const canAct = () => isHumanTurn() && match.phase === 'aim' && strikeT === 0 && !paused;
    const placingNow = () => canAct() && match.canMoveCue && !placeConfirmed;
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
    const center = h('div.mx-center', null, objPlate, heraldEl);
    const topBar = h('div.mx-top', null, pauseBtn, cards[0].el, center, cards[1].el);
    if (opts.challenge) cards[1].el.style.visibility = 'hidden';

    // Skill dock.
    const slots = [0, 1, 2].map((slot) => {
      const img = h('img.mx-sk-img', { alt: '', draggable: false });
      const state = h('span.mx-sk-state');
      const name = h('span.mx-sk-name');
      const b = tap(h('button.mx-skill', { class: slot === 2 ? 'ult' : '' }, h('span.mx-sk-art', null, img, state), name), () => openSkill(slot));
      return { b, img, state, name, key: '' };
    });
    const dock = h('div.mx-col.mx-dock', { 'aria-label': 'Chiêu thức' }, ...slots.map((s) => s.b));
    if (!hasSkills) dock.style.display = 'none';

    // Controls column.
    const rotL = h('button.mx-btn', { 'aria-label': 'Xoay cơ sang trái (giữ để xoay nhanh)' }, icon('rotate-left'));
    const rotR = h('button.mx-btn', { 'aria-label': 'Xoay cơ sang phải (giữ để xoay nhanh)' }, icon('rotate-right'));
    const switchBtn = tap(h('button.mx-btn', { 'aria-label': 'Đổi bi mục tiêu' }, icon('switch-target')), () => switchTarget());
    const spinDot = h('i.mx-cb-dot');
    const spinBtn = tap(h('button.mx-btn.mx-spinbtn', { 'aria-label': 'Áp phê: chọn điểm đánh trên bi cái' }, h('span.mx-cueball', null, spinDot)), () => openSpin());
    const aimPad = h('div.mx-pad', null,
      h('div.mx-pair', null, rotL, rotR),
      h('div.mx-pair', null, switchBtn, spinBtn),
    );
    const arrow = (deg: number, label: string) => h('button.mx-btn.mx-arrow', { 'aria-label': label }, icon('turn', `rot${deg}`));
    const upB = arrow(270, 'Dời bi lên');
    const downB = arrow(90, 'Dời bi xuống');
    const leftB = arrow(180, 'Dời bi sang trái');
    const rightB = arrow(0, 'Dời bi sang phải');
    const dpad = h('div.mx-dpad', null, h('span'), upB, h('span'), leftB, h('span.mx-dpad-c', null, icon('place')), rightB, h('span'), downB, h('span'));
    const powerFill = h('i.mx-pfill');
    const powerPct = h('span.mx-ppct.num');
    const powerTrack = h('div.mx-ptrack', null, powerFill);
    for (let i = 1; i < 10; i++) powerTrack.append(h('i.mx-ptick', { style: `bottom:${i * 10}%` }));
    const powerBar = h('div.mx-power', { role: 'slider', 'aria-label': 'Lực đánh', 'aria-valuemin': '0', 'aria-valuemax': '100' },
      h('div.mx-phead', null, icon('power'), powerPct), powerTrack);
    const strikeIcon = icon('strike');
    const strikeLabel = h('span.mx-st-label', null, 'ĐÁNH');
    const strikeBtn = h('button.mx-strike', { 'aria-label': 'Đánh' }, strikeIcon, strikeLabel);
    const ctrl = h('div.mx-col.mx-ctrl', null, aimPad, dpad, powerBar, strikeBtn);

    const chips = h('div.mx-chips');
    const callTag = h('div.mx-calltag');
    callTag.style.display = 'none';
    const hand = h('img.mx-hand', { src: HAND_URL, alt: '', draggable: false, 'aria-hidden': 'true' });
    hand.style.display = 'none';
    el.append(probe, hand, topBar, dock, ctrl, chips, callTag, nextBall);

    function playerCard(side: Side) {
      const p = opts.setup.players[side];
      const c = champion(p.champion);
      const face = h('img.mx-face', { src: portraitUrl(p.champion), alt: c.name, draggable: false, decoding: 'async' });
      face.style.background = hex6(sect(c.sect).main);
      const ring = h('div.mx-ring', null, face);
      const epill = h('span.mx-epill.num');
      const ringWrap = h('div.mx-ringwrap', { 'aria-label': 'Năng lượng' }, ring, epill);
      if (!hasSkills) ringWrap.classList.add('no-energy');
      const score = h('span.mx-score.num');
      const sub = h('span.mx-sub');
      const potted = h('div.mx-potted', { 'aria-label': 'Bi đã ăn' });
      const card = h('div.mx-card', { class: side ? 'p2' : 'p1' }, ringWrap,
        h('div.mx-info', null, h('div.mx-name', null, p.name), h('div.mx-line', null, score, sub), potted));
      return { el: card, face, ring, ringWrap, epill, score, sub, potted, temp: null as Expr | null, focus: false, timer: 0, key: '' };
    }

    // ---------- Layout ----------
    function layout() {
      const W = window.innerWidth;
      const H = window.innerHeight;
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
      const bounds = {
        left: leftEdge + 2,
        right: W - rightEdge + 2,
        top: top + 2,
        bottom: insetB + 2,
      };
      const { cx, cy, scale } = view.fit(W, H, bounds);
      const t = match.table;
      // Chips sit on the bottom rail, between the side pocket and a corner, never on the cloth.
      const railMid = (t.W / 2 + t.railWidth / 2) * scale;
      chips.style.left = `${cx}px`;
      chips.style.top = `${cy + railMid}px`;
      // The painted ball in the hand is drawn a little larger than the real one: it is lifted off the cloth.
      const handW = (t.R * scale * 1.3) / HAND.r;
      hand.style.width = `${handW}px`;
      hand.style.height = `${(handW * HAND.h) / HAND.w}px`;
      handKey = '';
    }
    const onResize = () => layout();
    window.addEventListener('resize', onResize);
    requestAnimationFrame(layout);
    layout();

    // ---------- HUD (event driven) ----------
    function renderHud() {
      const st = match.state;
      const carom = match.isCarom;
      for (const s of [0, 1] as Side[]) {
        const c = cards[s];
        c.el.classList.toggle('active', match.turn === s && match.phase !== 'match-over');
        c.score.textContent = opts.challenge ? `${attempt}/${opts.challenge.tries}` : carom ? `${st.scores[s]}/${st.caromTarget}` : String(match.rackWins[s]);
        c.sub.replaceChildren();
        if (opts.challenge) {
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
        if (!carom && !opts.challenge) {
          const key = match.potted[s].join(',');
          if (key !== c.key) {
            c.key = key;
            c.potted.replaceChildren(...match.potted[s].map((id) => miniBall(id)));
          }
        }
        const e = Math.round(match.energy[s]);
        c.ring.style.setProperty('--e', String((e / ENERGY_MAX) * 100));
        c.epill.textContent = `${e}%`;
        c.ringWrap.setAttribute('aria-label', `Năng lượng ${nameOf(s)}: ${e}/${ENERGY_MAX}`);
        c.ringWrap.classList.toggle('full', hasSkills && e >= ENERGY_MAX);
      }
      if (match.setup.mode === 'nine' || match.setup.mode === 'ten') {
        const id = match.balls.filter((b) => b.onTable && b.id > 0).reduce((lo, b) => Math.min(lo, b.id), Infinity);
        nextBall.replaceChildren('Bi tiếp theo', Number.isFinite(id) ? miniBall(id) : '', Number.isFinite(id) ? String(id) : 'Hết bi');
      } else nextBall.hidden = true;
      objKicker.textContent = opts.challenge ? opts.label : `${MODE_NAMES[match.setup.mode]} · chạm ${match.setup.raceTo} · ván ${match.rackNo}`;
      objText.textContent = opts.challenge ? opts.challenge.goal : match.objective();
      renderSkills();
      renderChips();
      renderControls();
      skillSheet?.refresh();
    }

    function renderControls() {
      const act = canAct();
      const placing = placingNow();
      ctrl.classList.toggle('placing', placing);
      ctrl.classList.toggle('off', !act);
      for (const b of [rotL, rotR, switchBtn, spinBtn, upB, downB, leftB, rightB, strikeBtn]) b.disabled = !act;
      powerBar.classList.toggle('off', !act || placing);
      if (!charging) {
        strikeLabel.textContent = placing ? 'ĐẶT BI' : 'ĐÁNH';
        strikeIcon.src = icon(placing ? 'place' : 'strike').src;
        strikeBtn.setAttribute('aria-label', placing ? 'Đặt bi cái tại đây' : 'Đánh');
      }
      strikeBtn.classList.toggle('place', placing);
    }

    function miniBall(id: number) {
      const col = ballCss('pool', id);
      return h('i.mx-ball', { class: id > 8 ? 'stripe' : '', style: `--c:${col}`, title: `Bi ${id}` });
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
      if (ct !== 'none') {
        const ballPart = ct === 'ball-pocket' ? `bi ${callBallId() ?? '?'} → ` : '';
        chips.append(h('div.chip.mx-chip', { class: callPocket === null ? 'need' : 'set' }, icon('target'),
          callPocket === null ? `Gọi ${ballPart}chạm 1 lỗ` : `Gọi ${ballPart}${POCKET_NAMES[callPocket]}`));
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

    // ---------- Herald: turn banner in the top strip, never on the cloth ----------
    const heraldQ: HeraldMsg[] = [];
    let heraldTimer = 0;
    let heraldOn = false;
    let thinkingSide: Side | null = null;

    function herald(m: HeraldMsg) {
      if (disposed) return;
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
      showHerald(m, false);
      const len = m.title.length + (m.line?.length ?? 0);
      // Shorter while more news waits.
      const ms = m.ms ?? Math.min(4200, 1600 + len * 30) * (heraldQ.length ? 0.7 : 1);
      heraldTimer = window.setTimeout(nextHerald, ms);
    }
    function showHerald(m: HeraldMsg, thinking: boolean) {
      const face = m.side !== null
        ? h('img.mx-h-face', { src: m.expr ? exprUrl(champOf(m.side), m.expr) : portraitUrl(champOf(m.side)), alt: '', draggable: false })
        : h('span.mx-h-icon', null, icon(m.icon ?? 'info'));
      heraldEl.className = `mx-herald show ${m.tone ?? 'ink'}${thinking ? ' thinking' : ''}`;
      heraldEl.replaceChildren(face,
        h('div.mx-h-text', null, h('div.mx-h-title', null, m.title), m.line ? h('div.mx-h-line', null, m.line) : null),
      );
      if (thinking) heraldEl.append(icon('thinking', 'mx-h-think'));
      center.classList.add('heralding');
    }
    function idleHerald() {
      if (thinkingSide !== null) {
        showHerald({ side: thinkingSide, expr: 'focus', title: `${nameOf(thinkingSide)} đang tính…` }, true);
      } else {
        heraldEl.className = 'mx-herald';
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
        const can = match.canUseSkill(side, sk.slot);
        anyReady ||= can;
        const ult = sk.slot === 2;
        s.b.classList.toggle('ready', can);
        s.b.classList.toggle('cool', !ult && wait > 0);
        s.b.classList.toggle('charging', ult && wait < 0);
        const pct = Math.round((match.energy[side] / ENERGY_MAX) * 100);
        s.b.style.setProperty('--e', String(Math.min(100, pct)));
        if (ult && wait < 0) s.state.replaceChildren(icon('energy'), `${pct}%`);
        else if (!ult && wait > 0) s.state.replaceChildren(icon('cooldown'), String(wait));
        else s.state.replaceChildren(icon(can ? 'check' : 'info'), can ? 'Sẵn sàng' : 'Chờ');
        s.b.setAttribute('aria-label', `${sk.name}${ult ? ' (tuyệt chiêu)' : ''}: ${can ? 'sẵn sàng' : skillBlock(side, sk.slot) ?? ''}. Chạm để xem.`);
      }
      if (begun && anyReady && isHumanTurn()) {
        hintOnce(app, 'skill-dock', 'Chiêu thức', 'Ô sáng viền đỏ là chiêu dùng được. Chạm một ô để đọc mô tả, rồi bấm Dùng. Hai chiêu đầu hồi lại sau vài lượt; tuyệt chiêu cần đầy năng lượng.',
          { anchor: () => dock, place: lefty ? 'left' : 'right', rail: true });
      }
    }

    function skillBlock(side: Side, slot: number): string | null {
      if (match.canUseSkill(side, slot)) return null;
      const wait = match.skillWait(side, slot);
      if (slot === 2 && wait < 0) return `Cần đầy năng lượng: ${Math.round(match.energy[side])}/${ENERGY_MAX}`;
      if (wait > 0) return `Đang hồi: còn ${wait} lượt của bạn`;
      if (match.phase === 'rolling') return 'Chờ bi dừng lăn';
      if (match.phase === 'rack-over' || match.phase === 'match-over') return 'Ván đã kết thúc';
      if (match.turn !== side || aiActing) return 'Chưa dùng được lúc này — đợi tới lượt bạn';
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
        if (!match.canUseSkill(side, slot)) return;
        closeSheets();
        match.useSkill(side, slot);
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
          ? frag(icon('energy'), h('span', null, `Cần ${ENERGY_MAX} năng lượng · đang có `, h('b.num', null, String(e))))
          : frag(icon('cooldown'), h('span', null, `Dùng xong hồi lại sau ${sk.cooldown} lượt của bạn`)));
        const why = skillBlock(side, slot);
        reason.textContent = why ?? 'Sẵn sàng';
        reason.classList.toggle('ok', !why);
        useBtn.disabled = !!why;
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
      const box = h('div.mx-sheet.mx-spinsheet', { role: 'dialog', 'aria-label': 'Áp phê' },
        tap(h('button.icon-btn.small.mx-sc-x', { 'aria-label': 'Đóng' }, icon('close')), () => closeSheets()),
        h('div.mx-sp-ballwrap', null, ball),
        h('div.mx-sp-side', null,
          h('div.mx-sp-title', null, icon('spin'), 'Áp phê'),
          cap,
          h('div.mx-sp-presets', null, ...presetBtns),
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
      if (!canAct() || placingNow()) return;
      const list = targetList();
      if (!list.length) return;
      targetIdx = (targetIdx + 1) % list.length;
      const b = list[targetIdx];
      aimAt(b);
      view.ring(b.x, b.y, 0xffffff, 0.02);
    }

    function rotate(deg: number) {
      if (!canAct() || placingNow()) return;
      aim.angle += deg * DEG;
    }

    function nudgeCue(dx: number, dy: number, metres: number) {
      if (!placingNow()) return;
      const c = match.cueBall();
      match.placeCue(c.x + dx * metres, c.y + dy * metres);
    }

    const cueDef = () => match.current.cue;

    /** Hand tremor amplitude (radians) for the current hold. */
    function wobbleAmp(): number {
      const control = cueDef().control;
      const base = 0.0034 * (1.3 - control * 0.2);
      const fatigue = 1 + Math.max(0, holdT - 1.8) * 0.75;
      return base * (0.2 + 1.7 * power * power) * fatigue * match.tremorNow;
    }

    function wobbleNow(): number {
      if (!charging) return 0;
      const t = performance.now() / 1000;
      return wobbleAmp() * (0.62 * Math.sin(t * 7.3) + 0.38 * Math.sin(t * 13.1 + 1.7));
    }

    function guideScale(): number {
      // Thần Xạ passive: a quarter longer object-ball hint.
      return (0.55 + 0.12 * cueDef().aim) * (match.passive(match.turn) === 'thanxa' ? 1.25 : 1);
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

    function fire(angle: number, pw: number, side: number, vert: number, aiShotCall?: ShotCall | null) {
      closeSheets();
      strikePull = pw;
      strikeT = 0.0001;
      const ct = match.callType();
      const call = aiShotCall !== undefined ? aiShotCall : ct === 'none' ? null : { ball: callBallId() ?? 8, pocket: callPocket ?? 0 };
      firedCall = call;
      aiCall = null;
      const input = { angle, power: pw, side, vert, call, pushOut };
      renderControls();
      // Let the cue travel through before the ball moves.
      void sleep(70).then(() => {
        if (disposed) return;
        match.shoot(input);
        pushOut = false;
        callPocket = null;
      });
    }

    // ---------- Pointer input on the table ----------
    const canvas = app.pixi.canvas;
    let drag: { id: number; mode: 'aim' | 'cue'; sx: number; sy: number; lastA: number; moved: boolean; cue0: { x: number; y: number }; p0: { x: number; y: number } } | null = null;

    const onDown = (e: PointerEvent) => {
      sound.unlock();
      if (!canAct() || charging || drag) return;
      const p = view.toTable(e.clientX, e.clientY);
      const t = match.table;
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
        id: e.pointerId, mode: placingNow() ? 'cue' : 'aim', sx: e.clientX, sy: e.clientY, moved: false,
        lastA: Math.atan2(p.y - cue.y, p.x - cue.x), cue0: { x: cue.x, y: cue.y }, p0: p,
      };
      canvas.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id || !canAct()) return;
      if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 6) return;
      drag.moved = true;
      const p = view.toTable(e.clientX, e.clientY);
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
      if (!drag || e.pointerId !== drag.id) return;
      const d = drag;
      drag = null;
      if (d.moved || !canAct() || e.type === 'pointercancel') return;
      // A tap: place the ball there, aim straight at a tapped ball, or aim at the tapped spot.
      const p = view.toTable(e.clientX, e.clientY);
      if (d.mode === 'cue') {
        match.placeCue(p.x, p.y);
        return;
      }
      const cue = match.cueBall();
      const grab = Math.max(match.table.R * 1.8, 16 / view.pxPerM);
      const hit = match.balls
        .filter((b) => b.onTable && b.id !== cue.id && Math.hypot(p.x - b.x, p.y - b.y) < grab)
        .sort((a, b) => Math.hypot(p.x - a.x, p.y - a.y) - Math.hypot(p.x - b.x, p.y - b.y))[0];
      if (hit) {
        aimAt(hit);
        const list = targetList();
        targetIdx = Math.max(-1, list.findIndex((b) => b.id === hit.id));
        haptic(8);
      } else if (Math.hypot(p.x - cue.x, p.y - cue.y) > match.table.R * 1.5) {
        aimAt(p);
      }
    };
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
    const setBar = (e: PointerEvent) => {
      const r = powerTrack.getBoundingClientRect();
      preset = Math.max(0.05, Math.min(1, 1 - (e.clientY - r.top) / r.height));
      const lvl = Math.floor(preset * 10);
      if (lvl !== lastTick) {
        lastTick = lvl;
        sound.tick(preset);
      }
    };
    powerBar.addEventListener('pointerdown', (e) => {
      if (!canAct() || placingNow() || charging || barId !== null) return;
      sound.unlock();
      barId = e.pointerId;
      powerBar.setPointerCapture(barId);
      barActive = true;
      setBar(e);
    });
    powerBar.addEventListener('pointermove', (e) => e.pointerId === barId && canAct() && setBar(e));
    const barEnd = (e: PointerEvent) => {
      if (e.pointerId !== barId) return;
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
        strikeLabel.textContent = armed ? 'HỦY' : 'ĐÁNH';
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
        if (placingNow()) {
          const m = e.shiftKey ? 0.002 : 0.01;
          if (e.code === 'ArrowLeft') nudgeCue(-1, 0, m);
          if (e.code === 'ArrowRight') nudgeCue(1, 0, m);
          if (e.code === 'ArrowUp') nudgeCue(0, -1, m);
          if (e.code === 'ArrowDown') nudgeCue(0, 1, m);
        } else {
          if (e.code === 'ArrowLeft') rotate(-fine);
          if (e.code === 'ArrowRight') rotate(fine);
          if (e.code === 'ArrowUp' && canAct()) preset = Math.min(1, preset + 0.05);
          if (e.code === 'ArrowDown' && canAct()) preset = Math.max(0.05, preset - 0.05);
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
      if (!canAct()) return;
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
            if (p.speed > 2.4) view.burst(p.x, p.y, 0xffffff, 3, 0.4, 0.008);
          } else if (p.t === 'cushion') {
            sound.cushion(p.speed);
          } else {
            sound.pocket(p.speed);
            haptic(18);
            const pk = match.table.pockets[p.pocket];
            view.ring(pk.hx, pk.hy, p.id === 0 ? 0xff5a4e : 0xffe08a, 0.03);
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
          view.burst(e.x, e.y, 0x1c1a17, 30, 1.5, 0.02);
          view.addShake(1.1);
          haptic([40, 20, 80]);
          break;
        case 'energy':
          floatGain(e.side, e.gain);
          if (hasSkills && match.setup.players[e.side].kind === 'human') {
            hintOnce(app, 'energy', 'Năng lượng', 'Vòng quanh chân dung là năng lượng: +8 mỗi cú đánh, +14 mỗi bi của mình vào lỗ, +12 khi đối thủ phạm lỗi. Đầy vòng thì tuyệt chiêu (ô thứ ba) dùng được.',
              { anchor: () => cards[e.side].ringWrap, place: e.side === 0 ? 'right' : 'left', alignTop: true });
          }
          break;
        case 'skill': {
          if (e.slot !== 2) sound.skill(); // the ultimate cut-in plays its own gong
          if (e.slot === 2) playCutIn(champion(e.champion), e.skill, e.side === 1);
          setExpr(e.side, 'cast', 2400);
          herald({ side: e.side, expr: 'cast', title: e.skill.name, line: `${nameOf(e.side)} ${e.slot === 2 ? 'tung tuyệt chiêu' : 'dùng chiêu'}` });
          if (e.skill.kinds.includes('rewind')) view.resync();
          view.skillFx(e.champion, e.skill, e.side);
          haptic(e.slot === 2 ? [30, 40, 60] : 25);
          break;
        }
        case 'omen':
          sound.omen();
          hintOnce(app, 'omen', 'Thiên Tượng', 'Bàn của mỗi môn phái thỉnh thoảng nổi hiện tượng (gió, tuyết, nghiêng bàn…) cho đúng một cú đánh. Nó được vẽ lên bàn: tính vào đường bi! Tướng đánh trên bàn môn phái mình không gặp Thiên Tượng.',
            { anchor: () => (lefty ? ctrl : dock), place: 'right', highlight: false, rail: true });
          herald({ side: null, icon: 'warning', title: e.omen.name, line: e.omen.desc, ms: 4200 });
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
          for (const c of cards) c.key = '';
          break;
        case 'rack-over': {
          const w = e.winner;
          if (!opts.challenge) {
            setExpr(w, 'joy', 5000);
            setExpr(other(w), 'sad', 5000);
            herald({ side: w, expr: 'joy', title: `${nameOf(w)} thắng ván`, line: match.lastRes?.messages.join(' ') || undefined, ms: 3000 });
          }
          setTimeout(() => onRackOver(w), opts.challenge ? 700 : 1100);
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
      const potN = Math.max(0, match.potted[side].length - pottedBefore[side]);
      if (r.foul && !opts.challenge) {
        sound.foul();
        setExpr(side, 'sad', 3000);
        herald({ side, expr: 'sad', tone: 'red', title: r.ballInHand !== 'none' ? 'Lỗi — bi trong tay' : 'Phạm lỗi', line: r.foul, ms: 3400 });
        hintOnce(app, 'foul', 'Phạm lỗi', 'Khi một bên phạm lỗi, đối thủ được "bi trong tay": đặt bi cái ở chỗ cho phép rồi mới đánh. Lý do lỗi hiện ở dải trên cùng.',
          { anchor: () => (lefty ? ctrl : dock), place: 'right', highlight: false, rail: true });
      } else if (r.winner === null && (potN > 0 || r.points > 0) && r.keepTurn) {
        sound.good();
        setExpr(side, 'joy');
        const title = r.highlight === 'golden' ? 'Bi vàng!' : match.isCarom ? 'Ghi điểm!' : potN > 1 ? `Ăn ${potN} bi!` : 'Ăn bi!';
        herald({ side, expr: 'joy', title, line: r.messages.join(' ') || 'Đánh tiếp' });
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

    /** First-time explanations, each shown once per player, beside the control they explain. */
    function coachTurn() {
      if (opts.challenge) return;
      const mode = match.setup.mode;
      if (hasSkills) {
        const side = humanSide() ?? match.turn;
        hintOnce(app, 'energy', 'Năng lượng', 'Vòng quanh chân dung: +8 mỗi cú đánh, +14 mỗi bi của mình vào lỗ, +12 khi đối thủ phạm lỗi. Đầy 100 năng lượng thì dùng được tuyệt chiêu ở ô thứ ba.',
          { anchor: () => cards[side].ringWrap, place: side === 0 ? 'right' : 'left', alignTop: true });
      }
      const beside = lefty ? 'right' : 'left';
      hintOnce(app, `rules-${mode}`, `Luật ${MODE_NAMES[mode]}`, `${RULES_TEXT[mode].goal} Xem đầy đủ trong menu tạm dừng → Luật chơi.`, { anchor: () => (lefty ? ctrl : dock), place: 'right', highlight: false, rail: true });
      hintOnce(app, 'ctl-aim', 'Ngắm', 'Kéo trên bàn để xoay cơ — kéo xa bi cái thì xoay chậm, tinh hơn. Chạm một bi để ngắm thẳng vào nó. Hai nút xoay chỉnh từng chút (giữ để xoay nhanh), nút đổi mục tiêu nhảy qua các bi hợp lệ, bi cái nhỏ là áp phê.',
        { anchor: () => aimPad, place: beside });
      hintOnce(app, 'ctl-power', 'Lực và đánh', 'Kéo thanh lực để chọn lực, rồi chạm ĐÁNH. Hoặc giữ ĐÁNH cho lực tự dao động và thả đúng lúc; trượt ngón ra xa để huỷ.',
        { anchor: () => powerBar, place: beside });
      if (match.canMoveCue) {
        hintOnce(app, 'ctl-ballinhand', 'Bi trong tay', 'Kéo bi cái trên bàn, chạm chỗ muốn đặt, hoặc dùng 4 nút mũi tên để dời từng chút. Bấm ĐẶT BI để chốt rồi mới ngắm.',
          { anchor: () => dpad, place: beside });
      }
      if (match.callType() !== 'none') {
        hintOnce(app, 'call', 'Gọi lỗ', 'Cú này phải gọi: chạm vào lỗ bạn định đánh bi vào (và chạm bi nếu cần) trước khi đánh. Bi vào lỗ khác không được tính.',
          { anchor: () => chips, place: 'above' });
      }
    }

    function onTurn() {
      placeConfirmed = false;
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
        updateSpinDot();
        aimFirstTarget();
        if (match.canMoveCue) herald({ side, title: changed ? `Lượt của ${nameOf(side)}` : 'Bi trong tay', line: 'Bi trong tay — kéo bi hoặc dùng mũi tên, rồi ĐẶT BI' });
        else if (changed) herald({ side, title: `Lượt của ${nameOf(side)}`, line: match.objective() });
        coachTurn();
      }
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
      const view0 = match.aiView();
      const req: AiRequest = {
        balls: view0.balls, state: view0.state, side, profile: player.ai!, maxSpeed: match.vmax(side),
        ballInHand: match.placing === 'nudge' ? 'none' : match.placing, closedPockets: view0.closedPockets,
        params: match.params, terrain: match.omen?.terrain ?? null,
        extraSegments: match.omen?.segments ?? [], captureScale: match.omen?.capture ?? 1, seed: (Math.random() * 1e9) | 0, option: match.phase === 'option',
        pushOutAvailable: match.state.pushOutAvailable, energy: match.energy[side],
        skills: match.skills(side).filter((sk) => match.canUseSkill(side, sk.slot)).map((sk) => ({ slot: sk.slot, kind: match.effectiveKind(sk.kinds[0]), ultimate: sk.slot === 2, tier: sk.tier })),
      };
      const started = performance.now();
      const decision = await app.ai.think(req);
      const minThink = 550 + rng.next() * 600;
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
        match.useSkill(side, decision.skill);
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
      const a0 = aim.angle;
      let da = shot.angle - a0;
      da = Math.atan2(Math.sin(da), Math.cos(da));
      await animate(420 + Math.abs(da) * 160, (k) => {
        aim.angle = a0 + da * k;
        aim.side = shot.side * k;
        aim.vert = shot.vert * k;
      });
      await sleep(180 + rng.next() * 250);
      if (disposed || token !== aiToken) return;
      // Charge, then strike.
      charging = true;
      holdT = 0;
      await animate(260 + shot.power * 650, (k) => {
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
      ));
    }

    /** Result sheet with the champion's art on the left. */
    function artModal(art: string, build: (close: () => void) => (Node | null)[]) {
      return modal((close) => h('div.modal.mx-modal.mx-result', null,
        h('div.mx-res-art', null, h('img', { src: art, alt: '', draggable: false })),
        h('div.mx-res-body', null, ...build(close))));
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
          ok ? stars(r.stars) : h('p.muted', null, triesLeft > 0 ? `Còn ${triesLeft} lượt thử` : 'Hết lượt thử — thử lại từ đầu nhé'),
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
      cancelCharge();
      const s = app.profile.settings;
      const done = () => {
        paused = false;
        pauseWrap = null;
        closePause();
        renderHud();
      };
      const closePause = modal((close) => {
        const box = h('div.modal.mx-modal.mx-pausebox', null,
          h('div.mx-pause-head', null,
            h('h2', null, 'Tạm dừng'),
            h('div.muted.small', null, `${opts.label} · ${MODE_NAMES[match.setup.mode]}${match.setup.mutator ? ' · có biến thể bàn' : ''}`)),
          h('div.mx-pause-grid', null,
            h('div.mx-pause-col', null,
              btn(frag(icon('play'), 'Tiếp tục'), done, 'block big'),
              btn(frag(icon('scroll'), 'Luật chơi'), () => {
                done();
                openRules();
              }, 'ghost block'),
              btn(frag(icon('hint'), 'Cách điều khiển'), () => {
                done();
                openHelp();
              }, 'ghost block'),
            ),
            h('div.mx-pause-col', null,
              h('div.list', null,
                item('Âm thanh', toggle(s.sfx > 0, (on) => {
                  s.sfx = on ? 0.9 : 0;
                  app.applySettings();
                  app.save();
                }, 'Âm thanh'), { icon: 'sound' }),
                item('Nhạc nền', toggle(s.music > 0, (on) => {
                  s.music = on ? 0.3 : 0;
                  app.applySettings();
                  if (on) sound.startMusic();
                  else sound.stopMusic();
                  app.save();
                }, 'Nhạc nền'), { icon: 'music' }),
              ),
              isTouchDevice() ? null : btn(frag(icon('fullscreen'), 'Toàn màn hình'), () => void toggleFullscreen(), 'ghost block small'),
              btn(frag(icon('back'), 'Thoát trận'), () => {
                close();
                paused = false;
                pauseWrap = null;
                opts.onExit();
              }, 'ghost block small mx-leave'),
            ),
          ),
        );
        queueMicrotask(() => (pauseWrap = box.parentElement));
        return box;
      });
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
          tip('spin', 'Áp phê', 'Chạm bi cái nhỏ để mở bi lớn, chạm điểm đánh hoặc chọn nhanh Giữa, Trô, Cule, Giật, Trái, Phải.'),
          tip('power', 'Lực', 'Kéo thanh lực để chọn lực rồi chạm ĐÁNH. Hoặc giữ ĐÁNH cho lực dao động, thả đúng lúc; trượt ra xa để huỷ.'),
          tip('place', 'Bi trong tay', 'Kéo bi cái, chạm chỗ muốn đặt, hoặc dùng 4 nút mũi tên; bấm ĐẶT BI để chốt.'),
          tip('energy', 'Chiêu và năng lượng', 'Chạm ô chiêu để đọc rồi bấm Dùng. Năng lượng tăng mỗi cú đánh, mỗi bi vào và khi đối thủ lỗi; đầy thì dùng được tuyệt chiêu.'),
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
      const sp = view.toScreen(p.hx, p.hy);
      // Push the tag toward the table centre so it never sits off-screen.
      const dirX = -Math.sign(p.hx) || 0;
      const dirY = -Math.sign(p.hy);
      const offPx = (p.hr + 0.07) * view.pxPerM;
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
      if (placingNow()) {
        const c = match.cueBall();
        const sp = view.toScreen(c.x, c.y);
        const hw = hand.offsetWidth;
        const key = `${Math.round(sp.x * 2)},${Math.round(sp.y * 2)},${hw}`;
        if (key !== handKey) {
          handKey = key;
          hand.style.display = '';
          hand.style.transform = `translate(${sp.x - hw * HAND.cx}px, ${sp.y - hand.offsetHeight * HAND.cy}px)`;
        }
      } else if (handKey !== 'off') {
        handKey = 'off';
        hand.style.display = 'none';
      }
      if (strikeT > 0) {
        strikeT += dt / 0.09;
        if (strikeT >= 1.6) {
          strikeT = 0;
          power = 0;
          renderControls();
        }
      }
      const humanAim = match.phase === 'aim' && (isHumanTurn() || showAiCue);
      // While the cue ball is being placed there is nothing to aim yet.
      const showCue = (humanAim || strikeT > 0) && !placingNow();
      const ct = match.callType();
      const pull = strikeT > 0 ? strikePull : charging ? power : barActive ? preset : 0;
      const av: AimView | null = humanAim || strikeT > 0 ? {
        angle: aim.angle + wobbleNow(),
        pull,
        side: aim.side,
        vert: aim.vert,
        power: Math.max(charging ? power : preset, 0.5),
        showCue,
        showGuide: humanAim && isHumanTurn() && match.tremorNow === 1 && strikeT === 0,
        guideScale: guideScale(),
        fog: match.setup.mutator === 'fog',
        pocketChoices: ct !== 'none' && isHumanTurn(),
        strike: strikeT > 0 ? Math.min(1, strikeT) : 0,
      } : null;
      view.calledShot = currentCall();
      placeCallTag();
      view.update(dt, av);
      // Power UI: the live charge while swinging, otherwise the set power.
      const shown = strikeT > 0 ? strikePull : charging ? power : preset;
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
    if (opts.challenge) begin();
    else showVs(begin);

    return {
      el,
      usesStage: true,
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
        window.removeEventListener('resize', onResize);
        window.removeEventListener('keydown', onKey);
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
