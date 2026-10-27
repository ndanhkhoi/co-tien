import type { Ticker } from 'pixi.js';
import type { AiRequest } from '../../ai/types';
import { sound } from '../../audio/sound';
import { ballCss } from '../../core/ball-styles';
import { MODE_NAMES } from '../../core/rules';
import { other, type Resolution, type ShotCall, type Side } from '../../core/rules/types';
import { Rng } from '../../core/rng';
import { champion, skillIconUrl } from '../../game/content/sects';
import { ENERGY_MAX, Match, type MatchSetup } from '../../game/match';
import { haptic, isTouchDevice, keepAwake, toggleFullscreen } from '../../platform/device';
import { TableView, type AimView } from '../../render/table-view';
import type { App, Screen } from '../app';
import { avatar } from '../avatar';
import { banner, btn, h, modal, tap, toast } from '../dom';
import { icon } from '../icons';
import { joystick } from '../joystick';
import { hintOnce } from '../hints';
import { RULES_TEXT, SKILL_RULES } from '../../game/content/rules-text';
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

const DEG = Math.PI / 180;
const POCKET_NAMES = ['lỗ góc trên trái', 'lỗ giữa trên', 'lỗ góc trên phải', 'lỗ góc dưới trái', 'lỗ giữa dưới', 'lỗ góc dưới phải'];

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
    const left = app.profile.settings.leftHanded;

    // ---------- Aim / input state ----------
    const aim = { angle: 0, side: 0, vert: 0 };
    let power = 0;
    let charging = false;
    let chargeT = 0;
    let holdT = 0;
    let cancelArmed = false;
    let strikeT = 0;
    let strikePull = 0;
    /** Ball in hand: the player moves the cue ball, then confirms with ĐẶT BI before aiming. */
    let placeConfirmed = false;
    let callPocket: number | null = null;
    /** Call announced by the AI before it lines up, and the call of the shot in flight. */
    let aiCall: ShotCall | null = null;
    let firedCall: ShotCall | null = null;
    let pushOut = false;
    let aiToken = 0;
    let aiActing = false;
    let disposed = false;
    let paused = false;
    let attempt = 1;
    let lastTick = 0;
    let showAiCue = false;

    const isHumanTurn = () => match.current.kind === 'human' && !aiActing;
    const canAct = () => isHumanTurn() && match.phase === 'aim' && strikeT === 0 && !paused;
    const placingNow = () => canAct() && match.canMoveCue && !placeConfirmed;

    // ---------- DOM ----------
    const el = h('div.screen.game');
    const pause = tap(h('button.mini-pause', { 'aria-label': 'Tạm dừng' }, icon('pause')), () => openPause());
    const cards = [playerCard(0), playerCard(1)];
    if (opts.challenge) {
      cards[1].el.style.visibility = 'hidden';
      cards[0].energy.parentElement!.style.display = 'none';
    }
    const objective = h('div.objective');

    const spinDot = h('div.dot');
    const spinBtn = h('button.spin-btn', { 'aria-label': 'Điểm áp phê: kéo để chỉnh, chạm đúp để về giữa' }, h('div.cross'), spinDot);
    const stickLabel = h('div.js-label', null, 'Xoay cơ');
    const aimStick = h('div.aim-stick', { 'aria-label': 'Cần điều khiển: đẩy trái/phải để xoay cơ; khi có bi trong tay thì đẩy để di bi' });
    const aimControls = [spinBtn, h('div.spin-label', null, 'Áp phê'), aimStick, stickLabel];

    const powerFill = h('div.fill');
    const powerPct = h('div.pct');
    const powerBar = h('div.power', null, powerFill, powerPct);
    for (let i = 1; i < 10; i++) powerBar.append(h('div.tick', { style: `bottom:${i * 10}%` }));
    const shootBtn = h('button.shoot', null, 'ĐÁNH');
    const skillsBox = h('div.skills');
    const shootControls = [skillsBox, powerBar, shootBtn];

    // Player 1 always on the left, player 2 on the right; controls swap for left-handers.
    const sideL = h('div.side.left', null, h('div.side-top', null, pause, cards[0].el), ...(left ? shootControls : aimControls));
    const sideR = h('div.side.right', null, h('div.side-top', null, cards[1].el), ...(left ? aimControls : shootControls));

    const chips = h('div.float-chips');
    const thinking = h('div.thinking', null, h('span.dots', null, h('i'), h('i'), h('i')), h('span'));
    thinking.style.display = 'none';
    // Hand over the cue ball while it is in hand.
    const handCue = h('div.hand-cue', { 'aria-hidden': 'true' }, icon('hand'));
    handCue.style.display = 'none';
    el.append(objective, sideL, sideR, chips, thinking, handCue);

    function playerCard(side: Side) {
      const av = h('div.av', null, avatar(opts.setup.players[side].champion));
      const nm = h('div.nm', null, opts.setup.players[side].name);
      const score = h('div.score');
      const sub = h('div.sub');
      // Balls this player has pocketed this rack, in order.
      const potted = h('div.potted', { 'aria-label': 'Bi đã ăn' });
      const energy = h('div.energy', null, h('i'));
      const e = h('div.scard', null, h('div.scard-head', null, av, score), nm, sub, potted, energy);
      return { el: e, sub, potted, score, energy: energy.firstElementChild as HTMLElement };
    }

    // ---------- Layout ----------
    function layout() {
      const W = window.innerWidth;
      const H = window.innerHeight;
      // offset* ignores the screen's slide-in transform, unlike getBoundingClientRect.
      const L = { right: sideL.offsetLeft + sideL.offsetWidth };
      const R = { left: sideR.offsetLeft };
      const probe = getComputedStyle(document.documentElement);
      const st = parseFloat(probe.getPropertyValue('--st')) || 0;
      const sb = parseFloat(probe.getPropertyValue('--sb')) || 0;
      const t = match.table;
      // Only the outer lip of the wooden rail may slide under the columns; pocket holes stay clear.
      const tuck = 0.004;
      const x0 = (L.right || 90) + 4;
      const x1 = (R.left || W - 90) - 4;
      const aw = x1 - x0;
      const ah = H - st - sb - 6;
      const scale = Math.min(aw / (t.L + 2 * (t.railWidth - tuck)), ah / (t.W + 2 * t.railWidth));
      const cx = x0 + aw / 2;
      const cy = st + 3 + ah / 2;
      view.layout(cx, cy, scale);
      // Pills sit on the long rails between a corner and the side pocket.
      const railMid = (t.W / 2 + t.railWidth / 2) * scale;
      const quarter = (t.L / 4) * scale;
      // Top centre stays free for toasts; the bottom rail carries the objective (left)
      // and either the call/push chips or the AI's "thinking" plate (right).
      objective.style.left = `${cx - quarter}px`;
      objective.style.top = `${cy + railMid}px`;
      chips.style.left = `${cx + quarter}px`;
      chips.style.top = `${cy + railMid}px`;
      thinking.style.left = `${cx + quarter}px`;
      thinking.style.top = `${cy + railMid}px`;
    }
    const onResize = () => layout();
    window.addEventListener('resize', onResize);
    requestAnimationFrame(layout);
    layout();

    // ---------- HUD ----------
    function renderHud() {
      const st = match.state;
      const carom = match.isCarom;
      for (const s of [0, 1] as Side[]) {
        const c = cards[s];
        c.el.classList.toggle('active', match.turn === s && match.phase !== 'match-over');
        c.sub.replaceChildren();
        c.score.textContent = opts.challenge ? `${attempt}/${opts.challenge.tries}` : carom ? `${st.scores[s]}/${st.caromTarget}` : String(match.rackWins[s]);
        if (opts.challenge) {
          c.sub.append(h('span.muted', null, 'lượt thử'));
        } else if (match.setup.mode === 'eight') {
          const g = st.groups[s];
          if (g === null) {
            c.sub.append(h('span.muted', null, st.isBreak ? (match.breaker === s ? 'Phá bi' : '') : 'Bàn mở'));
          } else {
            const ids = g === 'solid' ? [1, 2, 3, 4, 5, 6, 7] : [9, 10, 11, 12, 13, 14, 15];
            const left = ids.filter((id) => match.balls.find((x) => x.id === id)?.onTable).length;
            c.sub.append(h('span.grp', { class: g }, g === 'solid' ? 'Trơn' : 'Sọc'), h('span.muted', null, left ? `còn ${left}` : 'tới bi 8'));
          }
        } else if (carom) {
          c.sub.append(h('span.muted', null, `ván ${match.rackWins[s]}/${match.setup.raceTo}`));
        } else {
          const f = st.fouls[s];
          if (f > 0) c.sub.append(h('span', { style: 'color:var(--red);font-weight:800' }, `${f} lỗi`));
          else if (s === match.turn) {
            const lo = match.legalTargets(s)[0];
            if (lo) c.sub.append(h('span.muted', null, 'Bi'), miniBall(lo, false));
          }
        }
        c.potted.replaceChildren(...(carom || opts.challenge ? [] : match.potted[s].map((id) => miniBall(id, false))));
        c.potted.style.display = c.potted.childElementCount ? '' : 'none';
        c.energy.style.width = `${match.energy[s]}%`;
      }
      objective.replaceChildren(
        h('span.obj-mode', null, opts.challenge ? opts.label : `${MODE_NAMES[match.setup.mode]} · chạm ${match.setup.raceTo}`),
        h('span.obj-text', null, opts.challenge ? opts.challenge.goal : match.objective()),
      );
      renderSkills();
      renderChips();
      shootBtn.toggleAttribute('disabled', !canAct());
      if (!charging) shootBtn.textContent = placingNow() ? 'ĐẶT BI' : 'ĐÁNH';
      shootBtn.classList.toggle('place', placingNow());
      stickLabel.textContent = placingNow() ? 'Di bi' : 'Xoay cơ';
    }

    function miniBall(id: number, gone: boolean) {
      const col = ballCss('pool', id);
      const stripe = id > 8;
      return h('i.mini-ball', { class: `${stripe ? 'stripe' : ''} ${gone ? 'gone' : ''}`, style: `background:${col};--c:${col}` });
    }

    function humanSide(): Side | null {
      if (match.current.kind === 'human') return match.turn;
      const hs = match.setup.players.findIndex((p) => p.kind === 'human');
      return hs < 0 ? null : (hs as Side);
    }

    function renderSkills() {
      skillsBox.replaceChildren();
      const side = humanSide();
      if (side === null || opts.challenge || match.setup.classic) return;
      const champ = champion(match.setup.players[side].champion);
      if (champ.skills.some((sk) => match.canUseSkill(side, sk.slot))) {
        hintOnce(app, 'skills', 'Chiêu thức', 'Chạm nút chiêu để dùng, GIỮ để đọc mô tả. Hai chiêu nhỏ hồi lại sau vài cú; tuyệt chiêu (nút tròn) cần vòng năng lượng đầy, nạp bằng cách vào bi.');
      }
      for (const sk of champ.skills) {
        const wait = match.skillWait(side, sk.slot);
        const can = match.canUseSkill(side, sk.slot);
        const ult = sk.slot === 2;
        const b = h('button.skill', {
          class: `${ult ? 'ult' : ''} ${can ? 'ready' : 'off'}`, 'aria-label': sk.name,
          style: ult ? `--e:${Math.round((match.energy[side] / ENERGY_MAX) * 100)}` : '',
        }, h('img', { src: skillIconUrl(champ.id, sk.slot), alt: '', draggable: false }),
        !ult && wait > 0 ? h('span.cd', null, String(wait)) : null);
        // Tap casts; a long press explains the skill instead.
        let timer = 0;
        let explained = false;
        b.addEventListener('pointerdown', () => {
          explained = false;
          timer = window.setTimeout(() => {
            explained = true;
            toast(`${sk.name}${ult ? ' (tuyệt chiêu)' : ` · hồi ${sk.cooldown} cú`}: ${sk.desc}`, 'gold');
          }, 480);
        });
        const clear = () => clearTimeout(timer);
        b.addEventListener('pointerup', clear);
        b.addEventListener('pointerleave', clear);
        b.addEventListener('pointercancel', clear);
        tap(b, () => {
          if (!explained) useSkill(side, sk.slot);
        });
        skillsBox.append(b);
      }
    }

    function renderChips() {
      chips.replaceChildren();
      if (!canAct()) return;
      if (match.state.pushOutAvailable && match.current.kind === 'human') {
        chips.append(tap(h('button.fchip', { class: pushOut ? 'on' : '' }, 'Đẩy bi (push-out)'), () => {
          pushOut = !pushOut;
          renderHud();
        }));
      }
      const ct = match.callType();
      if (ct !== 'none') {
        const pk = effectiveCallPocket();
        const ballPart = ct === 'ball-pocket' ? `bi ${callBallId() ?? '?'} → ` : '';
        chips.append(h('div.fchip', { class: pk === null ? '' : 'on' }, icon('target'), pk === null ? `Gọi ${ballPart}chạm 1 lỗ` : `Gọi ${ballPart}${POCKET_NAMES[pk]}`));
      }
    }

    function useSkill(side: Side, slot: number) {
      if (match.useSkill(side, slot)) return;
      const sk = match.skills(side)[slot];
      const wait = match.skillWait(side, slot);
      if (slot === 2 && wait < 0) toast(`${sk.name}: cần đầy năng lượng (${Math.round(match.energy[side])}/${ENERGY_MAX})`, 'bad');
      else if (wait > 0) toast(`${sk.name}: hồi sau ${wait} cú`, 'bad');
      else toast(`${sk.name}: chưa dùng được lúc này`, 'bad');
    }

    // ---------- Calls ----------
    // Calls are always the player's own choice; nothing is inferred from the aim.
    let callBall: number | null = null;

    function callBallId(): number | null {
      if (match.callType() === 'pocket') return 8;
      const legal = match.legalTargets();
      if (callBall !== null && match.balls.some((b) => b.id === callBall && b.onTable)) return callBall;
      return legal[0] ?? null;
    }

    function effectiveCallPocket(): number | null {
      return callPocket;
    }

    // ---------- Aim helpers ----------
    function aimAtNearestTarget() {
      const cue = match.cueBall();
      const targets = match.legalTargets();
      const pool = match.balls.filter((b) => b.onTable && b.id !== cue.id && (targets.length === 0 || targets.includes(b.id)));
      if (!pool.length) return;
      const near = pool.reduce((a, b) => (Math.hypot(b.x - cue.x, b.y - cue.y) < Math.hypot(a.x - cue.x, a.y - cue.y) ? b : a));
      aim.angle = Math.atan2(near.y - cue.y, near.x - cue.x);
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
    function startCharge() {
      if (!canAct()) return;
      if (placingNow()) {
        placeConfirmed = true;
        haptic(15);
        sound.tap();
        renderHud();
        return;
      }
      if (match.callType() !== 'none' && effectiveCallPocket() === null) {
        toast(match.callType() === 'ball-pocket' ? 'Chạm bi muốn gọi, rồi chạm lỗ trước khi đánh' : 'Chạm vào một lỗ trên bàn để gọi trước khi đánh', 'bad');
        haptic([20, 40, 20]);
        return;
      }
      charging = true;
      chargeT = 0;
      holdT = 0;
      power = 0;
      cancelArmed = false;
      shootBtn.classList.add('pressed');
    }

    function cancelCharge() {
      charging = false;
      power = 0;
      shootBtn.classList.remove('pressed', 'cancel');
      shootBtn.textContent = 'ĐÁNH';
      powerBar.classList.remove('hot');
    }

    function releaseCharge() {
      if (!charging) return;
      shootBtn.classList.remove('pressed');
      if (cancelArmed || power < 0.02) {
        cancelCharge();
        return;
      }
      const amp = wobbleAmp();
      const finalAngle = aim.angle + wobbleNow() + rng.gauss() * amp * 0.3;
      const err = 0.012 + 0.008 * (5 - cueDef().control);
      const finalPower = Math.max(0.01, Math.min(1, power * (1 + rng.gauss() * err)));
      charging = false;
      fire(finalAngle, finalPower, aim.side, aim.vert);
    }

    function fire(angle: number, pw: number, side: number, vert: number, aiShotCall?: ShotCall | null) {
      strikePull = pw;
      strikeT = 0.0001;
      const ct = match.callType();
      const call = aiShotCall !== undefined ? aiShotCall : ct === 'none' ? null : { ball: callBallId() ?? 8, pocket: effectiveCallPocket() ?? 0 };
      firedCall = call;
      aiCall = null;
      const input = { angle, power: pw, side, vert, call, pushOut };
      // Let the cue travel through before the ball moves.
      setTimeout(() => {
        if (disposed) return;
        match.shoot(input);
        pushOut = false;
        callPocket = null;
        powerBar.classList.remove('hot');
      }, 70);
    }

    // ---------- Pointer input on the table ----------
    const canvas = app.pixi.canvas;
    let drag: { mode: 'aim' | 'cue' | 'stick'; id: number } | null = null;

    /** Is (x, y) on the cue stick behind the cue ball? Grabbing it rotates around the ball. */
    function onStick(x: number, y: number): boolean {
      const c = match.cueBall();
      const dx = -Math.cos(aim.angle);
      const dy = -Math.sin(aim.angle);
      const along = (x - c.x) * dx + (y - c.y) * dy;
      const across = Math.abs((x - c.x) * dy - (y - c.y) * dx);
      return along > match.table.R * 1.1 && along < 1.55 && across < Math.max(0.045, 34 / view.pxPerM);
    }
    const onDown = (e: PointerEvent) => {
      sound.unlock();
      if (!canAct() || charging) return;
      const p = view.toTable(e.clientX, e.clientY);
      const t = match.table;
      // Pocket call taps first.
      if (match.callType() !== 'none') {
        const hit = t.pockets.findIndex((pk, i) => !match.closedPockets.includes(i) && Math.hypot(p.x - pk.hx, p.y - pk.hy) < pk.hr * 1.6);
        if (hit >= 0) {
          callPocket = hit;
          haptic(10);
          sound.tap();
          renderHud();
          return;
        }
      }
      if (match.callType() === 'ball-pocket') {
        const hitBall = match.balls.find((b) => b.onTable && b.id !== match.cueId() && Math.hypot(p.x - b.x, p.y - b.y) < t.R * 1.6);
        if (hitBall) {
          callBall = hitBall.id;
          renderHud();
        }
      }
      const cue = match.cueBall();
      const grab = Math.max(t.R * 2.6, 30 / view.pxPerM);
      if (placingNow() && Math.hypot(p.x - cue.x, p.y - cue.y) < grab) {
        drag = { mode: 'cue', id: e.pointerId };
      } else if (onStick(p.x, p.y)) {
        drag = { mode: 'stick', id: e.pointerId };
        haptic(8);
      } else {
        drag = { mode: 'aim', id: e.pointerId };
        aim.angle = Math.atan2(p.y - cue.y, p.x - cue.x);
      }
      canvas.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id || !canAct()) return;
      const p = view.toTable(e.clientX, e.clientY);
      if (drag.mode === 'cue') {
        match.placeCue(p.x, p.y);
      } else if (drag.mode === 'stick') {
        // The butt is behind the ball: aim points from the hand through the cue ball.
        const cue = match.cueBall();
        if (Math.hypot(p.x - cue.x, p.y - cue.y) > match.table.R * 2) aim.angle = Math.atan2(cue.y - p.y, cue.x - p.x);
      } else {
        const cue = match.cueBall();
        if (Math.hypot(p.x - cue.x, p.y - cue.y) > match.table.R * 1.2) aim.angle = Math.atan2(p.y - cue.y, p.x - cue.x);
      }
    };
    const onUp = (e: PointerEvent) => {
      if (drag && e.pointerId === drag.id) drag = null;
    };
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);

    // Joystick: rotates the cue, or walks the cue ball while it is in hand. A light push
    // turns about half a degree per second; a full push sweeps the table quickly.
    joystick(aimStick, {
      enabled: () => canAct(),
      onTick: (x, y, dt) => {
        if (!canAct()) return;
        if (placingNow()) {
          const c = match.cueBall();
          match.placeCue(c.x + x * 0.7 * dt, c.y + y * 0.7 * dt);
        } else {
          aim.angle += x * 120 * DEG * dt;
        }
      },
      onStart: () => sound.unlock(),
    });

    // Hold-to-charge shoot button; slide away to cancel.
    shootBtn.addEventListener('pointerdown', (e) => {
      sound.unlock();
      startCharge();
      if (charging) shootBtn.setPointerCapture(e.pointerId);
    });
    shootBtn.addEventListener('pointermove', (e) => {
      if (!charging) return;
      const r = shootBtn.getBoundingClientRect();
      const d = Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2));
      const armed = d > r.width * 1.1;
      if (armed !== cancelArmed) {
        cancelArmed = armed;
        shootBtn.classList.toggle('cancel', armed);
        shootBtn.textContent = armed ? 'HỦY' : 'ĐÁNH';
        haptic(12);
      }
    });
    shootBtn.addEventListener('pointerup', () => releaseCharge());
    shootBtn.addEventListener('pointercancel', () => cancelCharge());

    // Keyboard for desktop.
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat && e.code === 'Space') return;
      if (e.type === 'keydown') {
        if (e.code === 'Space') {
          e.preventDefault();
          startCharge();
        }
        if (e.code === 'ArrowLeft') aim.angle -= (e.shiftKey ? 0.05 : 0.5) * DEG;
        if (e.code === 'ArrowRight') aim.angle += (e.shiftKey ? 0.05 : 0.5) * DEG;
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

    // ---------- Spin: drag on the cue-ball control ----------
    // Relative drag (like a trackpad) gives fine control on a small target; a magnified
    // ball floats beside the thumb while dragging. Double-tap returns to centre.
    let lastSpinTap = 0;
    let loupe: { el: HTMLElement; tip: HTMLElement; cap: HTMLElement } | null = null;
    let overLimit = false;

    function showLoupe() {
      const tip = h('div.tip');
      const cap = h('div.cap');
      const lp = h('div.spin-loupe', null, h('div.h'), h('div.v'), h('div.limit'), tip, cap);
      const r = spinBtn.getBoundingClientRect();
      const size = 170;
      const x = left ? r.left - size - 18 : r.right + 18;
      const y = Math.max(8, Math.min(window.innerHeight - size - 30, r.top + r.height / 2 - size / 2));
      lp.style.left = `${x}px`;
      lp.style.top = `${y}px`;
      el.append(lp);
      loupe = { el: lp, tip, cap };
      updateSpinDot();
    }

    function spinCaption(): string {
      const parts: string[] = [];
      if (aim.vert > 0.15) parts.push('Theo bi');
      else if (aim.vert < -0.15) parts.push('Kéo bi');
      if (aim.side > 0.15) parts.push('áp phê phải');
      else if (aim.side < -0.15) parts.push('áp phê trái');
      return parts.length ? parts.join(' · ') : 'Giữa bi';
    }

    // The spin ball is a joystick too: push to slide the contact point, release to keep it.
    joystick(spinBtn, {
      enabled: () => canAct(),
      onStart: () => {
        sound.unlock();
        const now = performance.now();
        if (now - lastSpinTap < 320) {
          aim.side = 0;
          aim.vert = 0;
          updateSpinDot();
          haptic(12);
        }
        lastSpinTap = now;
        showLoupe();
      },
      onTick: (x, y, dt) => {
        let sx = aim.side + x * 1.3 * dt;
        let sy = aim.vert - y * 1.3 * dt;
        const m = Math.hypot(sx, sy);
        if (m > 1) {
          sx /= m;
          sy /= m;
        }
        aim.side = sx;
        aim.vert = sy;
        const over = m > 0.82;
        if (over !== overLimit) {
          overLimit = over;
          if (over) haptic(15);
        }
        updateSpinDot();
      },
      onEnd: () => {
        loupe?.el.remove();
        loupe = null;
      },
    });

    function updateSpinDot() {
      spinDot.style.left = `${50 + aim.side * 38}%`;
      spinDot.style.top = `${50 - aim.vert * 38}%`;
      if (loupe) {
        loupe.tip.style.left = `${50 + aim.side * 41}%`;
        loupe.tip.style.top = `${50 - aim.vert * 41}%`;
        loupe.cap.textContent = spinCaption();
      }
    }

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
          if (e.miscue) {
            sound.miscue();
            banner('Trượt cơ!', true);
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
        case 'skill': {
          if (e.slot !== 2) sound.skill(); // the ultimate cut-in plays its own gong
          const who = match.setup.players[e.side].name;
          if (e.slot === 2) playCutIn(champion(e.champion), e.skill, e.side === 1);
          else toast(`${who}: ${e.skill.name}`, 'gold');
          if (e.skill.kinds.includes('rewind')) view.resync();
          view.skillFx(e.champion, e.skill, e.side);
          haptic(e.slot === 2 ? [30, 40, 60] : 25);
          renderHud();
          break;
        }
        case 'omen':
          sound.omen();
          hintOnce(app, 'omen', 'Thiên Tượng', 'Bàn của mỗi môn phái thỉnh thoảng nổi hiện tượng (gió, tuyết, nghiêng bàn…) cho đúng một cú đánh. Nó được vẽ lên bàn: tính vào đường bi! Tướng đánh trên bàn môn phái mình (Địa Lợi) không gặp Thiên Tượng.');
          banner(e.omen.name);
          toast(`${e.omen.name}: ${e.omen.desc}`, 'gold');
          view.addShake(e.omen.jitter ? 0.6 : 0.2);
          renderHud();
          break;
        case 'resolved':
          onResolved(e.res, e.side);
          break;
        case 'turn':
          onTurn();
          break;
        case 'new-rack':
          view.resync();
          break;
        case 'rack-over':
          setTimeout(() => onRackOver(e.winner), opts.challenge ? 700 : 1100);
          break;
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
      if (r.foul && !opts.challenge) {
        sound.foul();
        hintOnce(app, 'foul', 'Phạm lỗi', 'Khi một bên phạm lỗi, đối thủ được "bi trong tay": đặt bi cái ở bất kỳ đâu rồi mới đánh. Lý do lỗi hiện ở thông báo phía trên.');
        banner('Phạm lỗi', true);
        toast(r.foul, 'bad');
      }
      for (const m of r.messages) toast(m, r.highlight ? 'gold' : r.winner !== null && r.winner !== side ? 'bad' : 'good');
      if (!r.foul && (r.keepTurn || r.points)) sound.good();
      if (r.highlight === 'golden') banner('Bi vàng!');
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

    /** First-time explanations, each shown once per player, in the order situations arise. */
    function coachTurn() {
      if (opts.challenge) return;
      const mode = match.setup.mode;
      hintOnce(app, 'aim', 'Ngắm và đánh', 'Kéo trên bàn hoặc đẩy cần XOAY CƠ để ngắm (đẩy nhẹ = xoay chậm, tinh). Chạm quả bi ÁP PHÊ để chọn điểm đánh. GIỮ nút ĐÁNH để nạp lực, thả ra để đánh.');
      hintOnce(app, `rules-${mode}`, `Luật ${MODE_NAMES[mode]}`, `${RULES_TEXT[mode].goal} Xem đầy đủ trong menu tạm dừng → Luật chơi.`);
      if (match.canMoveCue) hintOnce(app, 'ballinhand', 'Bi trong tay', 'Bạn được đặt bi cái. Đẩy cần điều khiển hoặc kéo bi để di chuyển, rồi bấm ĐẶT BI để chốt vị trí.');
      if (match.callType() !== 'none') hintOnce(app, 'call', 'Gọi lỗ', 'Cú này phải gọi: chạm vào lỗ bạn định đánh bi vào (và chạm bi nếu cần) trước khi đánh. Bi vào lỗ khác không được tính.');
    }

    function onTurn() {
      placeConfirmed = false;
      cancelCharge();
      pushOut = false;
      callPocket = null;
      callBall = null;
      aiCall = null;
      firedCall = null;
      view.refreshCue();
      if (match.phase === 'option') {
        if (match.current.kind === 'ai') void aiTurn();
        else setTimeout(() => !disposed && openOption(), 500);
        return;
      }
      if (match.phase !== 'aim') return;
      if (match.current.kind === 'ai') {
        void aiTurn();
      } else {
        aim.side = 0;
        aim.vert = 0;
        updateSpinDot();
        aimAtNearestTarget();
        const twoHumans = match.setup.players.every((p) => p.kind === 'human');
        if (twoHumans) toast(`Lượt của ${match.current.name}`, 'gold');
        if (match.canMoveCue) toast('Bi trong tay: đẩy cần điều khiển (hoặc kéo bi) để di bi, rồi bấm ĐẶT BI', 'gold');
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
      thinking.style.display = '';
      (thinking.lastElementChild as HTMLElement).textContent = `${player.name} đang tính`;
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
      thinking.style.display = 'none';
      if (match.phase === 'option') {
        const choice = decision.option ?? 'play';
        toast(`${player.name} chọn ${choice === 'play' ? 'đánh tiếp' : match.state.pendingOption === 'illegal-break-8' ? 'xếp lại bi' : 'nhường lại'}`, 'gold');
        aiActing = false;
        match.chooseOption(choice);
        return;
      }
      const shot = decision.shot;
      if (!shot) {
        aiActing = false;
        return;
      }
      if (shot.call) {
        aiCall = shot.call;
        const ballTxt = match.callType() === 'ball-pocket' || shot.call.ball !== 8 ? `bi ${shot.call.ball}` : 'bi 8';
        toast(`${player.name} gọi ${ballTxt} → ${POCKET_NAMES[shot.call.pocket]}`, 'gold');
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
      // The AI's call comes from its plan, not from the human aim helpers.
      fire(shot.angle, shot.power, shot.side, shot.vert, shot.call);
    }

    function sleep(ms: number) {
      return new Promise<void>((r) => setTimeout(r, ms));
    }

    function animate(ms: number, fn: (k: number) => void, ease = (k: number) => k * k * (3 - 2 * k)) {
      return new Promise<void>((resolve) => {
        const t0 = performance.now();
        const stepFn = () => {
          if (disposed) return resolve();
          const k = Math.min(1, (performance.now() - t0) / ms);
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
      const prev = match.setup.players[other(match.turn)].name;
      const text = {
        'push-out': `${prev} vừa đẩy bi (push-out). Bạn muốn tự đánh từ vị trí này hay bắt ${prev} đánh?`,
        'wrong-call': `${prev} làm bi vào không đúng lời gọi. Bạn đánh tiếp hay bắt ${prev} đánh lại?`,
        'illegal-break-9': `Cú phá chưa đủ 3 bi (vào lỗ hoặc qua vạch đầu bàn). Nhận bàn (mất quyền push-out) hay trả lại cho ${prev}?`,
        'illegal-break-8': 'Cú phá không hợp lệ. Bạn nhận bàn như hiện tại, hay xếp lại bi và tự phá?',
      }[kind ?? 'push-out'];
      const passLabel = kind === 'illegal-break-8' ? 'Xếp lại & tự phá' : 'Nhường lại';
      modal((close) => h('div.modal', null,
        h('h2', null, 'Quyền chọn'),
        h('div', { style: 'font-weight:600;line-height:1.5' }, text),
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

    function onRackOver(winner: Side) {
      if (disposed) return;
      if (opts.challenge) {
        const ok = winner === 0;
        const r = opts.challenge.onResult(ok, attempt);
        if (ok) {
          sound.win();
          banner('Thành công!');
        } else sound.lose();
        const triesLeft = opts.challenge.tries - attempt;
        modal((close) => h('div.modal', null,
          h('h2', null, ok ? 'Hoàn thành!' : 'Chưa được'),
          h('div', { style: 'font-weight:600' }, match.lastRes?.messages[0] ?? ''),
          ok ? h('div', { style: 'display:flex;justify-content:center' }, starsBig(r.stars)) : h('div.muted', null, triesLeft > 0 ? `Còn ${triesLeft} lượt thử` : 'Hết lượt thử — thử lại từ đầu nhé'),
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
              aimAtNearestTarget();
            }, ok ? 'ghost' : ''),
          ),
        ));
        return;
      }
      if (match.phase === 'match-over') return onMatchOver(winner);
      if (match.phase !== 'rack-over') return; // rewound meanwhile
      const hs = humanSide();
      const humanLost = hs !== null && winner !== hs && match.setup.players[other(hs)].kind === 'ai';
      if (hs !== null && winner === hs) sound.win();
      else if (humanLost) sound.lose();
      banner(`${match.setup.players[winner].name} thắng ván`, humanLost);
      const rewindSlot = hs === null ? -1 : match.skills(hs).findIndex((sk) => sk.kinds[0] === 'rewind');
      const canRewind = humanLost && rewindSlot >= 0 && match.canUseSkill(hs!, rewindSlot);
      setTimeout(() => {
        if (disposed || match.phase !== 'rack-over') return;
        modal((close) => h('div.modal', null,
          h('h2', null, `Ván ${match.rackNo} · ${match.rackWins[0]} – ${match.rackWins[1]}`),
          h('div', { style: 'font-weight:600' }, `${match.setup.players[winner].name} thắng ván này. ${match.lastRes?.messages.join(' ') ?? ''}`),
          h('div.actions', null,
            canRewind ? btn(h('span', null, icon('rewind'), ` ${match.skills(hs!)[rewindSlot].name}`), () => {
              close();
              match.useSkill(hs!, rewindSlot);
            }, 'ghost') : null,
            btn('Ván tiếp', () => {
              close();
              match.nextRack();
            }),
          ),
        ));
      }, 900);
    }

    function starsBig(n: number) {
      const s = h('div', { style: 'display:flex;gap:6px' });
      for (let i = 0; i < 3; i++) {
        const st = icon('star');
        st.setAttribute('style', `width:44px;height:44px;color:${i < n ? '#f5c542' : 'rgba(255,255,255,0.15)'};animation:pop-in .4s ${i * 0.12}s both`);
        s.append(st);
      }
      return s;
    }

    function onMatchOver(winner: Side) {
      const hs = humanSide();
      const won = hs !== null && winner === hs;
      const vsAi = match.setup.players.some((p) => p.kind === 'ai');
      if (won || !vsAi) sound.win();
      else sound.lose();
      const end = opts.onEnd?.({ won, match }) ?? { lines: [] };
      keepAwake(false);
      setTimeout(() => {
        if (disposed) return;
        modal(() => h('div.modal', null,
          h('h2', null, vsAi ? (won ? 'Chiến thắng!' : 'Thất bại') : `${match.setup.players[winner].name} thắng!`),
          h('div.row', { style: 'gap:16px;align-items:center' },
            h('div', { style: 'width:72px;height:72px;border-radius:18px;overflow:hidden;flex-shrink:0' }, avatar(opts.setup.players[winner].champion)),
            h('div.grow', null,
              h('div', { style: 'font-size:28px;font-weight:900' }, `${match.rackWins[0]} – ${match.rackWins[1]}`),
              h('div.muted.small', null, `${match.stats[0].pots} bi · loạt dài nhất ${match.stats[0].bestRun} · ${match.stats[0].fouls} lỗi`),
            ),
          ),
          ...end.lines.map((l) => h('div.kv', null, h('span', null, l))),
          h('div.actions', null,
            btn('Về menu', () => opts.onExit(), 'ghost'),
            end.again ? btn('Đấu lại', () => end.again!()) : null,
          ),
        ));
      }, 1200);
    }

    function openPause() {
      if (paused) return;
      paused = true;
      cancelCharge();
      modal((close) => {
        const done = () => {
          paused = false;
          close();
          renderHud();
        };
        return h('div.modal', { style: 'width:min(380px,100%)' },
          h('h2', null, 'Tạm dừng'),
          h('div.muted.small', null, `${opts.label} · ${MODE_NAMES[match.setup.mode]}${match.setup.mutator ? ' · có biến thể bàn' : ''}`),
          btn('Tiếp tục', done),
          isTouchDevice() ? null : btn('Bật / tắt toàn màn hình', () => void toggleFullscreen(), 'ghost'),
          btn('Luật chơi', () => {
            done();
            openRules();
          }, 'ghost'),
          btn('Hướng dẫn điều khiển', () => {
            done();
            openHelp();
          }, 'ghost'),
          btn('Thoát trận', () => {
            close();
            paused = false;
            opts.onExit();
          }, 'red'),
        );
      });
    }

    function openRules() {
      const r = RULES_TEXT[match.setup.mode];
      modal((close) => h('div.modal.scroll', { style: 'width:min(640px,100%);max-height:calc(100dvh - 24px)' },
        h('h2', null, `Luật ${MODE_NAMES[match.setup.mode]}`),
        h('div', { style: 'font-weight:700' }, r.goal),
        h('ul.rules-list', null, ...r.points.map((t) => h('li', null, t))),
        match.setup.classic ? null : h('div', null, h('div.section-title', null, 'Tiên Đạo'), h('ul.rules-list', null, ...SKILL_RULES.map((t) => h('li', null, t)))),
        h('div.actions', null, btn('Đã hiểu', close)),
      ), { dismissable: true });
    }

    function openHelp() {
      const tip = (ic: Parameters<typeof icon>[0], title: string, text: string) =>
        h('div.row', { style: 'align-items:flex-start;gap:10px' },
          h('div', { style: 'width:34px;height:34px;flex-shrink:0;border-radius:10px;display:grid;place-items:center;background:rgba(245,197,66,0.15);color:var(--gold)' }, icon(ic)),
          h('div', null, h('div', { style: 'font-weight:800;font-size:13.5px' }, title), h('div.muted', { style: 'font-size:12.5px;font-weight:600;line-height:1.4' }, text)));
      modal((close) => h('div.modal', { style: 'width:min(720px,100%)' },
        h('h2', null, 'Cách chơi'),
        h('div', { style: 'display:grid;grid-template-columns:1fr 1fr;gap:12px 18px' },
          tip('hand', 'Ngắm', 'Chạm/kéo trên bàn để chỉ hướng, hoặc nắm bất kỳ đâu trên cây cơ kéo xoay quanh bi cái (càng xa càng tinh).'),
          tip('rotR', 'Cần điều khiển', 'Đẩy cần sang trái/phải để xoay cơ: đẩy nhẹ xoay rất chậm để tinh chỉnh, đẩy hết xoay nhanh.'),
          tip('target', 'Điểm áp phê', 'Giữ quả bi ÁP PHÊ rồi đẩy như cần điều khiển: lên = theo, xuống = kéo, trái/phải = áp phê ngang. Chạm đúp về giữa.'),
          tip('play', 'Nạp lực', 'GIỮ nút ĐÁNH, thả đúng lúc. Mạnh và giữ lâu thì tay run. Kéo ra xa để hủy.'),
          tip('hand', 'Bi trong tay', 'Đẩy cần điều khiển (hoặc kéo bi cái) để di bi, bấm ĐẶT BI để chốt rồi mới ngắm.'),
          tip('spin2', 'Gọi lỗ & kỹ năng', 'Khi phải gọi: chạm bi rồi chạm lỗ. Nút bát giác là kỹ năng, tiêu năng lượng.'),
        ),
        h('div.actions', null, btn('Đã hiểu', () => {
          close();
          app.profile.tutorialSeen = true;
          app.save();
        })),
      ));
    }

    // ---------- Called-shot marker ----------
    const callTag = h('div.call-tag');
    callTag.style.display = 'none';
    el.append(callTag);
    let callTagKey = '';

    function currentCall(): { ball: number | null; pocket: number } | null {
      if (match.phase === 'rolling') return firedCall;
      if (match.phase !== 'aim' || match.callType() === 'none') return null;
      if (aiActing || match.current.kind === 'ai') return aiCall;
      const pk = effectiveCallPocket();
      const ball = match.callType() === 'ball-pocket' ? callBallId() : 8;
      return pk === null && callBall === null ? null : { ball, pocket: pk ?? -1 };
    }

    function placeCallTag() {
      const cs = view.calledShot;
      if (!cs || cs.pocket < 0) {
        callTag.style.display = 'none';
        callTagKey = '';
        return;
      }
      const p = match.table.pockets[cs.pocket];
      const sp = view.toScreen(p.hx, p.hy);
      // Push the tag toward the table centre so it never sits off-screen.
      const dirX = -Math.sign(p.hx) || 0;
      const dirY = -Math.sign(p.hy);
      const off = (p.hr + 0.07) * view.pxPerM;
      callTag.style.left = `${sp.x + dirX * off}px`;
      callTag.style.top = `${sp.y + dirY * off}px`;
      const key = `${cs.ball}|${cs.pocket}|${match.turn}`;
      if (key !== callTagKey) {
        callTagKey = key;
        callTag.replaceChildren(h('span.ct-label', null, 'Gọi'));
        if (cs.ball !== null) callTag.append(miniBall(cs.ball, false), h('b', null, String(cs.ball)));
        callTag.classList.remove('pop');
        void callTag.offsetWidth;
        callTag.classList.add('pop');
      }
      callTag.style.display = '';
    }

    // ---------- Frame loop ----------
    const tick = (ticker: Ticker) => {
      const dt = Math.min(0.05, ticker.deltaMS / 1000);
      if (!paused) match.update(dt);
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
        handCue.style.display = '';
        handCue.style.transform = `translate(${sp.x}px, ${sp.y}px)`;
      } else {
        handCue.style.display = 'none';
      }
      if (strikeT > 0) {
        strikeT += dt / 0.09;
        if (strikeT >= 1.6) {
          strikeT = 0;
          power = 0;
        }
      }
      const humanAim = match.phase === 'aim' && (isHumanTurn() || showAiCue);
      // While the cue ball is being placed there is nothing to aim yet.
      const showCue = ((match.phase === 'aim' && (isHumanTurn() || showAiCue)) || strikeT > 0) && !placingNow();
      const ct = match.callType();
      const av: AimView | null = humanAim || strikeT > 0 ? {
        angle: aim.angle + wobbleNow(),
        pull: strikeT > 0 ? strikePull : power,
        side: aim.side,
        vert: aim.vert,
        power: Math.max(power, 0.5),
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
      // Power UI.
      const shown = strikeT > 0 ? strikePull : power;
      powerFill.style.height = `calc(${shown * 100}% - 6px)`;
      powerFill.style.setProperty('--h', `${powerBar.clientHeight}px`);
      powerPct.textContent = shown > 0 ? `${Math.round(shown * 100)}` : '';
      powerBar.classList.toggle('hot', shown > 0.85);
    };
    app.pixi.ticker.add(tick);

    // ---------- Start ----------
    function showVs(done: () => void) {
      const [a, b] = opts.setup.players;
      const t = opts.titles ?? ['', ''];
      const vs = h('div.vs', null,
        h('div.side', null, h('div.av', null, avatar(opts.setup.players[0].champion)), h('div.nm', null, a.name), h('div.tt', null, t[0])),
        h('div.mid', null, 'VS'),
        h('div.side.r', null, h('div.av', null, avatar(opts.setup.players[1].champion)), h('div.nm', null, b.name), h('div.tt', null, t[1])),
        opts.quote ? h('div.quote', null, `“${opts.quote}”`) : null,
      );
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
      // First-time guidance now arrives as one-time hints during play (coachTurn).
      onTurn();
      renderHud();
    };
    if (opts.challenge) begin();
    else showVs(begin);

    return {
      el,
      usesStage: true,
      onBack: () => {
        openPause();
        return true;
      },
      dispose: () => {
        disposed = true;
        aiToken++;
        off();
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

