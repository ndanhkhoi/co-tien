import { sound } from '../../../audio/sound';
import type { Match } from '../../../game/match';
import { practiceBalls, practiceIds, saveLayout, spotsOf, PRACTICE_DRILLS, type PracticeTable } from '../../../game/practice';
import { haptic } from '../../../platform/device';
import type { TableView } from '../../../render/table-view';
import type { TableGeom } from '../../../core/table';
import { btn, h, tap, toast, uiOrigin, uiScale } from '../../dom';
import { icon } from '../../icons';

/** What the match screen tells the practice desk about the table it sits beside. */
export interface PracticeSetup {
  table: PracticeTable;
  /** Position name for the HUD ("Cắt mỏng", "Thế 3"). */
  name: string;
  /** Open on the arranging view (an empty table) instead of ready to shoot. */
  arrange: boolean;
}

export interface DeskHost {
  match: Match;
  view: TableView;
  /** Screen root, for the ball that follows the finger out of the tray. */
  screen: HTMLElement;
  setup: PracticeSetup;
  refresh(): void;
  /** Point the cue at the first ball again after the layout changed. */
  reaim(): void;
  showBallTag(id: number): void;
  hideBallTag(): void;
  herald(m: { title: string; line?: string; tone?: 'ink' | 'red'; ms?: number }): void;
}

export interface PracticeDesk {
  el: HTMLElement;
  readonly arranging: boolean;
  /** Pointer handlers on the table canvas; true when the desk took the event. */
  down(e: PointerEvent): boolean;
  move(e: PointerEvent): boolean;
  up(e: PointerEvent): boolean;
  /** Top plate and the player card for the HUD. */
  plate(): { kicker: string; text: string };
  card(): { score: string; sub: string };
  /** After every shot: count it and say what happened. */
  resolved(): void;
  render(): void;
}

interface DeskDrag {
  id: number;
  pointer: number;
  dx: number;
  dy: number;
  fromTray: boolean;
  moved: boolean;
  sx: number;
  sy: number;
}

interface DeskState {
  drag: DeskDrag | null;
  picked: number | null;
  shots: number;
  scored: number;
}

/**
 * Luyện thế's side panel. Two views: "Xếp bi" lays the position out (a tray holds every ball not
 * on the cloth; drag a ball onto the table or off its edge), "Đánh" shoots it freely with the last
 * shot always one tap from being taken back.
 */
export function practiceDesk(host: DeskHost): PracticeDesk {
  const { match, view, setup } = host;
  const carom = setup.table === 'carom';
  const t = match.table;
  let arranging = setup.arrange;
  const state: DeskState = { drag: null, picked: null, shots: 0, scored: 0 };

  const ui = buildDeskUi(host, carom, {
    isArranging: () => arranging,
    setMode: setArranging,
    trayDown: (e, id, b) => trayDownBall(move, e, id, b),
    trayMove: (e) => trayMoveBall(move, e),
    trayUp: (e, id, cancel = false) => trayUpBall({ ...move, t }, e, id, cancel),
    afterLayout,
    ballName: (id: number) => ballName(match, carom, id),
  });
  const { segs, trayBalls, wholeTable, arrangeView, shotsN, scoredN, undo, restart, keep, shootView, el, ghost } = ui;

  function setArranging(on: boolean) {
    if (on === arranging || match.phase !== 'aim') return;
    arranging = on;
    state.picked = null;
    state.drag = null;
    if (!on) {
      match.markPosition();
      host.reaim();
    }
    sound.tap();
    host.refresh();
  }

  function afterLayout() {
    state.picked = null;
    view.resync();
    host.reaim();
    host.refresh();
  }

  const onCloth = (x: number, y: number) => Math.abs(x) < t.L / 2 + t.R && Math.abs(y) < t.W / 2 + t.R;

  const move = deskMove(host, state, onCloth, showGhost);
  const dragTo = (e: PointerEvent) => dragBall(move, e);
  const settle = (id: number) => settleBall(move, id);

  /** Ghost ball under the finger while a ball is off the cloth (in the tray or being put away). */
  function showGhost(e: PointerEvent, id: number | null) {
    if (id === null) {
      ghost.classList.remove('show');
      return;
    }
    const rect = uiOrigin();
    const k = uiScale();
    ghost.src = view.ballPortrait(id, 64);
    ghost.style.left = `${(e.clientX - rect.left) / k}px`;
    ghost.style.top = `${(e.clientY - rect.top) / k}px`;
    ghost.classList.add('show');
  }

  // ---------- Cloth ----------
  const cloth = clothHandlers(host, state, { showGhost, dragTo, settle }, () => arranging);

  function resolved() {
    const shot = match.lastShot;
    if (!shot) return;
    state.shots++;
    resolvedShot(host, carom, shot, state);
  }

  function render() {
    renderDesk({
      segs, arrangeView, shootView, trayBalls, wholeTable, shotsN, scoredN, undo, restart, keep,
      host, arranging, shots: state.shots, scored: state.scored, picked: state.picked,
      ballName: (id: number) => ballName(match, carom, id),
    });
  }

  return {
    el,
    get arranging() { return arranging; },
    down: cloth.down, move: cloth.move, up: cloth.up, resolved, render,
    plate: () => ({
      kicker: `Luyện thế · ${setup.name}`,
      text: arranging ? 'Xếp bi xong thì chạm Đánh'
        : carom ? 'Chạm đủ hai bi để ghi điểm' : 'Đánh tự do, lỡ tay thì Đánh lại',
    }),
    card: () => ({
      score: String(carom ? state.scored : match.potted[0].length),
      sub: carom ? 'điểm' : 'bi trong lỗ',
    }),
  };
}

function ballName(match: Match, carom: boolean, id: number) {
  if (id === match.cueId()) return 'Bi cái';
  if (carom) return id === 2 ? 'Bi đỏ' : 'Bi vàng';
  return `Bi ${id}`;
}

interface DeskMove {
  host: DeskHost;
  state: DeskState;
  onCloth(x: number, y: number): boolean;
  showGhost(e: PointerEvent, id: number | null): void;
}

function deskMove(host: DeskHost, state: DeskState, onCloth: DeskMove['onCloth'], showGhost: DeskMove['showGhost']): DeskMove {
  return { host, state, onCloth, showGhost };
}

function trayDownBall(x: DeskMove, e: PointerEvent, id: number, b: HTMLElement) {
  const { host, state } = x;
  if (host.match.phase !== 'aim' || state.drag) return;
  sound.unlock();
  b.setPointerCapture(e.pointerId);
  state.drag = { id, pointer: e.pointerId, dx: 0, dy: 0, fromTray: true, moved: false, sx: e.clientX, sy: e.clientY };
}

function trayMoveBall(x: DeskMove, e: PointerEvent) {
  const { host, state } = x;
  if (!state.drag?.fromTray || e.pointerId !== state.drag.pointer) return;
  if (!state.drag.moved && Math.hypot(e.clientX - state.drag.sx, e.clientY - state.drag.sy) < 8) return;
  if (!state.drag.moved) host.hideBallTag();
  state.drag.moved = true;
  dragBall(x, e);
}

function trayUpBall(x: DeskMove & { t: TableGeom }, e: PointerEvent, id: number, cancel: boolean) {
  const { host, state, t } = x;
  if (!state.drag?.fromTray || e.pointerId !== state.drag.pointer) return;
  const d = state.drag;
  state.drag = null;
  x.showGhost(e, null);
  if (cancel) return;
  if (d.moved) return settleBall(x, d.id);
  // A tap toggles: a tray ball goes to the free spot nearest the foot spot, a ball on the cloth comes back.
  const ball = host.match.balls.find((b) => b.id === id)!;
  if (ball.onTable) {
    host.match.liftBall(id);
    if (state.picked === id) state.picked = null;
  } else if (host.match.placeBall(id, t.footSpot.x, t.footSpot.y)) {
    state.picked = id;
    host.showBallTag(id);
  } else toast('Bàn đã kín, không còn chỗ đặt bi', 'bad');
  haptic(8);
  host.view.resync();
  host.refresh();
}

/** Follow the finger: on the cloth the ball itself moves, off it a ghost ball does. */
function dragBall(x: DeskMove, e: PointerEvent) {
  const { host, state, onCloth, showGhost } = x;
  const p = host.view.toTable(e.clientX, e.clientY);
  const px = p.x - state.drag!.dx;
  const py = p.y - state.drag!.dy;
  const id = state.drag!.id;
  if (onCloth(px, py)) {
    showGhost(e, null);
    host.match.placeBall(id, px, py);
  } else {
    // Off the edge: the cue ball stops at the cushion; object balls lift, ready to go back to the tray.
    if (id === host.match.cueId()) host.match.placeBall(id, px, py);
    else {
      host.match.liftBall(id);
      showGhost(e, id);
    }
  }
  host.view.resync();
  host.refresh();
}

function settleBall(x: DeskMove, id: number) {
  const { host, state } = x;
  const ball = host.match.balls.find((b) => b.id === id)!;
  if (ball.onTable) state.picked = id;
  else if (state.picked === id) state.picked = null;
  haptic(8);
  host.refresh();
}

interface DeskHandlers {
  trayDown(e: PointerEvent, id: number, b: HTMLElement): void;
  trayMove(e: PointerEvent): void;
  trayUp(e: PointerEvent, id: number, cancel?: boolean): void;
  afterLayout(): void;
  isArranging(): boolean;
  setMode(on: boolean): void;
  ballName(id: number): string;
}

function buildDeskUi(host: DeskHost, carom: boolean, handlers: DeskHandlers) {
  const { match, view, setup } = host;
  const seg = (label: string, on: () => boolean, go: () => void) => ({ b: tap(h('button.pd-seg-b', { type: 'button' }, label), go), on });
  const segs = [seg('Xếp bi', handlers.isArranging, () => handlers.setMode(true)), seg('Đánh', () => !handlers.isArranging(), () => handlers.setMode(false))];
  const segBar = h('div.pd-seg', { role: 'tablist', 'aria-label': 'Chế độ luyện' }, ...segs.map((s) => s.b));

  const trayIds = practiceIds(setup.table).filter((id) => id !== match.cueId());
  const trayBalls = trayIds.map((id) => {
    const img = h('img', { alt: '', draggable: false, src: view.ballPortrait(id, 64) });
    const b = h('button.pd-ball', { type: 'button', 'aria-label': handlers.ballName(id) }, img);
    b.addEventListener('pointerdown', (e) => handlers.trayDown(e, id, b));
    b.addEventListener('pointermove', handlers.trayMove);
    b.addEventListener('pointerup', (e) => handlers.trayUp(e, id));
    b.addEventListener('pointercancel', (e) => handlers.trayUp(e, id, true));
    return { id, b };
  });
  const tray = h('div.pd-tray', { class: carom ? 'few' : '' }, ...trayBalls.map((x) => x.b));
  const anyOut = () => trayIds.some((id) => match.balls.find((b) => b.id === id)!.onTable);
  const wholeTable = btn('Dọn bàn', () => {
    resetWholeTable(host, trayIds, anyOut);
    handlers.afterLayout();
  }, 'secondary small block');
  const arrangeView = h('div.pd-view.pd-arrange', null,
    h('div.pd-hint', null, h('b', null, 'Khay bi'), ' · chạm hoặc kéo bi ra bàn, kéo ra mép để cất.'),
    tray,
    wholeTable);

  const shotsN = h('b.num');
  const scoredN = h('b.num');
  const undo = undoShot(host);
  const restart = restartLayout(host);
  const keep = keepLayout(host);
  const sight = sightToggle(host);
  const shootView = h('div.pd-view.pd-shoot', null,
    h('div.pd-tally', null,
      h('div', null, shotsN, h('span', null, 'cú')),
      h('div', null, scoredN, h('span', null, carom ? 'điểm' : 'bi vào'))),
    undo, restart, keep, sight);

  const el = h('div.pd', null, segBar, arrangeView, shootView);
  const ghost = h('img.pd-ghost', { alt: '', draggable: false });
  host.screen.append(ghost);
  return { segs, trayBalls, anyOut, wholeTable, arrangeView, shotsN, scoredN, undo, restart, keep, shootView, el, ghost };
}

function resetWholeTable(host: DeskHost, trayIds: number[], anyOut: () => boolean) {
  const { match, setup } = host;
  if (anyOut()) {
    for (const id of trayIds) match.liftBall(id);
    return;
  }
  const carom = setup.table === 'carom';
  const drill = PRACTICE_DRILLS.find((d) => d.id === (carom ? 'c-open' : 'p-break'))!;
  const cue = match.cueBall();
  match.setPosition(practiceBalls(setup.table, [...drill.spots.filter((s) => s.id !== 0), { id: 0, x: cue.x, y: cue.y }]));
}

function undoShot(host: DeskHost) {
  return btn(h('span.btn-in', null, icon('replay'), 'Đánh lại'), () => {
    if (!host.match.undoShot()) return;
    sound.tap();
    host.reaim();
    host.refresh();
  }, 'small block');
}

function restartLayout(host: DeskHost) {
  return btn('Về thế đầu', () => {
    host.match.retryLayout();
    host.reaim();
    host.refresh();
  }, 'secondary small block');
}

function keepLayout(host: DeskHost) {
  return btn('Lưu thế', () => {
    const saved = saveLayout(host.setup.table, spotsOf(host.match.balls));
    if (saved) toast(`Đã lưu ${saved.name} vào Thế của tôi`, 'good');
    else toast('Chưa lưu được: trình duyệt đang chặn bộ nhớ', 'bad');
  }, 'ghost small block');
}

function sightToggle(host: DeskHost) {
  const sight = tap(h('button.pd-sight', { type: 'button', 'aria-pressed': 'false' }, icon('vision'), h('span', null, 'Đường đi')), () => {
    host.match.sight = !host.match.sight;
    sight.setAttribute('aria-pressed', String(host.match.sight));
    sight.setAttribute('aria-label', host.match.sight ? 'Đang hiện đường đi của mọi bi' : 'Hiện đường đi của mọi bi');
  });
  return sight;
}

function clothHandlers(host: DeskHost, state: DeskState, x: { showGhost(e: PointerEvent, id: number | null): void; dragTo(e: PointerEvent): void; settle(id: number): void }, isArranging: () => boolean) {
  const { match, view } = host;
  const t = match.table;
  function down(e: PointerEvent): boolean {
    if (!isArranging()) return false;
    if (match.phase !== 'aim' || state.drag) return true;
    const p = view.toTable(e.clientX, e.clientY);
    const grab = Math.max(t.R * 1.8, 22 / view.pxPerM);
    const hit = match.balls
      .filter((b) => b.onTable && Math.hypot(p.x - b.x, p.y - b.y) < grab)
      .sort((a, b) => Math.hypot(p.x - a.x, p.y - a.y) - Math.hypot(p.x - b.x, p.y - b.y))[0];
    if (hit) {
      state.drag = { id: hit.id, pointer: e.pointerId, dx: p.x - hit.x, dy: p.y - hit.y, fromTray: false, moved: false, sx: e.clientX, sy: e.clientY };
      (e.target as Element).setPointerCapture?.(e.pointerId);
      state.picked = hit.id;
      haptic(8);
    } else if (state.picked !== null && match.balls.find((b) => b.id === state.picked)?.onTable) {
      // A tap on bare cloth moves the ball last touched there.
      match.placeBall(state.picked, p.x, p.y);
      view.resync();
    }
    host.refresh();
    return true;
  }
  function move(e: PointerEvent): boolean {
    if (!isArranging()) return false;
    if (!state.drag || state.drag.fromTray || e.pointerId !== state.drag.pointer) return true;
    if (!state.drag.moved && Math.hypot(e.clientX - state.drag.sx, e.clientY - state.drag.sy) < 6) return true;
    if (!state.drag.moved) host.hideBallTag();
    state.drag.moved = true;
    x.dragTo(e);
    return true;
  }
  function up(e: PointerEvent): boolean {
    if (!isArranging()) return false;
    if (!state.drag || state.drag.fromTray || e.pointerId !== state.drag.pointer) return true;
    const d = state.drag;
    state.drag = null;
    x.showGhost(e, null);
    // A tap names the ball; a drag only moves it.
    if (d.moved) x.settle(d.id);
    else host.showBallTag(d.id);
    return true;
  }
  return { down, move, up };
}

function resolvedShot(host: DeskHost, carom: boolean, shot: NonNullable<Match['lastShot']>, state: DeskState) {
  const { match } = host;
  const cue = match.cueId();
  const pots = shot.pocketed.filter((p) => p.id !== cue).map((p) => p.id);
  const scratch = shot.pocketed.some((p) => p.id === cue) || (shot.offTable ?? []).includes(cue);
  const point = carom && shot.cueContacts.length >= 2;
  state.scored += carom ? (point ? 1 : 0) : pots.length;
  const left = match.balls.some((b) => b.onTable && b.id !== cue);
  const feats = match.lastScore.names.join(' · ') || undefined;
  announceShot(host, { carom, pots, scratch, point, feats, left, firstHit: shot.firstHit });
}

interface ShotAnnouncement {
  carom: boolean;
  pots: number[];
  scratch: boolean;
  point: boolean;
  feats?: string;
  left: boolean;
  firstHit: number | null;
}

function announceShot(host: DeskHost, shot: ShotAnnouncement) {
  if (shot.scratch) host.herald({ title: 'Bi cái rơi', line: 'Đặt lại bi cái rồi đánh tiếp, hoặc Đánh lại cú vừa rồi.', tone: 'red', ms: 2200 });
  else if (shot.point) host.herald({ title: 'Ghi điểm', line: shot.feats, ms: 1600 });
  else if (shot.pots.length) host.herald({ title: shot.pots.length > 1 ? `Vào ${shot.pots.length} bi` : `Vào bi ${shot.pots[0]}`, line: [shot.feats, shot.left ? '' : 'Sạch bàn. Về thế đầu để luyện lại.'].filter(Boolean).join(' — ') || undefined, ms: shot.left ? 1600 : 2400 });
  else if (shot.firstHit === null) host.herald({ title: 'Không chạm bi', ms: 1300 });
}

interface DeskRender {
  segs: { b: HTMLButtonElement; on(): boolean }[];
  arrangeView: HTMLElement;
  shootView: HTMLElement;
  trayBalls: { id: number; b: HTMLButtonElement }[];
  wholeTable: HTMLButtonElement;
  shotsN: HTMLElement;
  scoredN: HTMLElement;
  undo: HTMLButtonElement;
  restart: HTMLButtonElement;
  keep: HTMLButtonElement;
  host: DeskHost;
  arranging: boolean;
  shots: number;
  scored: number;
  picked: number | null;
  ballName(id: number): string;
}

function renderDesk(x: DeskRender) {
  const { segs, arrangeView, shootView, trayBalls, host, arranging, picked } = x;
  for (const s of segs) {
    const on = s.on();
    s.b.setAttribute('aria-selected', String(on));
    s.b.setAttribute('role', 'tab');
  }
  arrangeView.hidden = !arranging;
  shootView.hidden = arranging;
  const aim = host.match.phase === 'aim';
  for (const s of segs) s.b.disabled = !aim;
  for (const { id, b } of trayBalls) {
    const ball = host.match.balls.find((item) => item.id === id)!;
    b.classList.toggle('on', ball.onTable);
    b.classList.toggle('picked', picked === id);
    b.setAttribute('aria-label', `${x.ballName(id)}: ${ball.onTable ? 'trên bàn, chạm để cất' : 'trong khay, chạm để đặt'}`);
  }
  const out = trayBalls.some(({ id }) => host.match.balls.find((b) => b.id === id)!.onTable);
  x.wholeTable.textContent = out ? 'Dọn bàn' : 'Đủ bộ';
  x.shotsN.textContent = String(x.shots);
  x.scoredN.textContent = String(x.scored);
  x.undo.disabled = !host.match.canUndo;
  x.restart.disabled = !aim;
  x.keep.disabled = !aim;
}
