import { sound } from '../../audio/sound';
import type { Match } from '../../game/match';
import { practiceBalls, practiceIds, saveLayout, spotsOf, PRACTICE_DRILLS, type PracticeTable } from '../../game/practice';
import { haptic } from '../../platform/device';
import type { TableView } from '../../render/table-view';
import { btn, h, tap, toast, uiScale } from '../dom';
import { icon } from '../icons';

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
  let shots = 0;
  let scored = 0;
  /** Ball dragged on the cloth or out of the tray, with the finger's offset from its centre. */
  let drag: { id: number; pointer: number; dx: number; dy: number; fromTray: boolean; moved: boolean; sx: number; sy: number } | null = null;
  let picked: number | null = null;

  const seg = (label: string, on: () => boolean, go: () => void) => {
    const b = tap(h('button.pd-seg-b', { type: 'button' }, label), go);
    return { b, on };
  };
  const segs = [seg('Xếp bi', () => arranging, () => setArranging(true)), seg('Đánh', () => !arranging, () => setArranging(false))];
  const segBar = h('div.pd-seg', { role: 'tablist', 'aria-label': 'Chế độ luyện' }, ...segs.map((s) => s.b));

  // Arranging: the tray and two whole-table actions.
  const trayIds = practiceIds(setup.table).filter((id) => id !== match.cueId());
  const trayBalls = trayIds.map((id) => {
    const img = h('img', { alt: '', draggable: false, src: view.ballPortrait(id, 64) });
    const b = h('button.pd-ball', { type: 'button', 'aria-label': ballName(id) }, img);
    b.addEventListener('pointerdown', (e) => trayDown(e, id, b));
    b.addEventListener('pointermove', trayMove);
    b.addEventListener('pointerup', (e) => trayUp(e, id));
    b.addEventListener('pointercancel', (e) => trayUp(e, id, true));
    return { id, b };
  });
  const tray = h('div.pd-tray', { class: carom ? 'few' : '' }, ...trayBalls.map((x) => x.b));
  // One whole-table action: clear a table with balls on it, or lay out the full set on an empty one.
  const anyOut = () => trayIds.some((id) => match.balls.find((b) => b.id === id)!.onTable);
  const wholeTable = btn('Dọn bàn', () => {
    if (anyOut()) {
      for (const id of trayIds) match.liftBall(id);
    } else {
      const drill = PRACTICE_DRILLS.find((d) => d.id === (carom ? 'c-open' : 'p-break'))!;
      const cue = match.cueBall();
      match.setPosition(practiceBalls(setup.table, [...drill.spots.filter((s) => s.id !== 0), { id: 0, x: cue.x, y: cue.y }]));
    }
    afterLayout();
  }, 'secondary small block');
  const arrangeView = h('div.pd-view.pd-arrange', null,
    h('div.pd-hint', null, h('b', null, 'Khay bi'), ' · chạm hoặc kéo bi ra bàn, kéo ra mép để cất.'),
    tray,
    wholeTable);

  // Shooting: tally, take back, back to the start, keep, and the full-path aid.
  const shotsN = h('b.num');
  const scoredN = h('b.num');
  const undo = btn(h('span.btn-in', null, icon('replay'), 'Đánh lại'), () => {
    if (!match.undoShot()) return;
    sound.tap();
    host.reaim();
    host.refresh();
  }, 'small block');
  const restart = btn('Về thế đầu', () => {
    match.retryLayout();
    host.reaim();
    host.refresh();
  }, 'secondary small block');
  const keep = btn('Lưu thế', () => {
    const saved = saveLayout(setup.table, spotsOf(match.balls));
    if (saved) toast(`Đã lưu ${saved.name} vào Thế của tôi`, 'good');
    else toast('Chưa lưu được: trình duyệt đang chặn bộ nhớ', 'bad');
  }, 'ghost small block');
  const sight = tap(h('button.pd-sight', { type: 'button', 'aria-pressed': 'false' }, icon('vision'), h('span', null, 'Đường đi')), () => {
    match.sight = !match.sight;
    sight.setAttribute('aria-pressed', String(match.sight));
    sight.setAttribute('aria-label', match.sight ? 'Đang hiện đường đi của mọi bi' : 'Hiện đường đi của mọi bi');
  });
  const shootView = h('div.pd-view.pd-shoot', null,
    h('div.pd-tally', null,
      h('div', null, shotsN, h('span', null, 'cú')),
      h('div', null, scoredN, h('span', null, carom ? 'điểm' : 'bi vào'))),
    undo, restart, keep, sight);

  const el = h('div.pd', null, segBar, arrangeView, shootView);
  const ghost = h('img.pd-ghost', { alt: '', draggable: false });
  host.screen.append(ghost);

  function ballName(id: number) {
    if (id === match.cueId()) return 'Bi cái';
    if (carom) return id === 2 ? 'Bi đỏ' : 'Bi vàng';
    return `Bi ${id}`;
  }

  function setArranging(on: boolean) {
    if (on === arranging || match.phase !== 'aim') return;
    arranging = on;
    picked = null;
    drag = null;
    if (!on) {
      match.markPosition();
      host.reaim();
    }
    sound.tap();
    host.refresh();
  }

  function afterLayout() {
    picked = null;
    view.resync();
    host.reaim();
    host.refresh();
  }

  const onCloth = (x: number, y: number) => Math.abs(x) < t.L / 2 + t.R && Math.abs(y) < t.W / 2 + t.R;

  /** Ghost ball under the finger while a ball is off the cloth (in the tray or being put away). */
  function showGhost(e: PointerEvent, id: number | null) {
    if (id === null) {
      ghost.classList.remove('show');
      return;
    }
    const rect = document.getElementById('ui')!.getBoundingClientRect();
    const k = uiScale();
    ghost.src = view.ballPortrait(id, 64);
    ghost.style.left = `${(e.clientX - rect.left) / k}px`;
    ghost.style.top = `${(e.clientY - rect.top) / k}px`;
    ghost.classList.add('show');
  }

  // ---------- Tray ----------
  function trayDown(e: PointerEvent, id: number, b: HTMLElement) {
    if (!arranging || match.phase !== 'aim' || drag) return;
    sound.unlock();
    b.setPointerCapture(e.pointerId);
    drag = { id, pointer: e.pointerId, dx: 0, dy: 0, fromTray: true, moved: false, sx: e.clientX, sy: e.clientY };
  }
  function trayMove(e: PointerEvent) {
    if (!drag?.fromTray || e.pointerId !== drag.pointer) return;
    if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 8) return;
    drag.moved = true;
    dragTo(e);
  }
  function trayUp(e: PointerEvent, id: number, cancel = false) {
    if (!drag?.fromTray || e.pointerId !== drag.pointer) return;
    const d = drag;
    drag = null;
    showGhost(e, null);
    if (cancel) return;
    if (d.moved) {
      settle(d.id);
      return;
    }
    // A tap toggles: a tray ball goes to the free spot nearest the foot spot, a ball on the cloth comes back.
    const ball = match.balls.find((b) => b.id === id)!;
    if (ball.onTable) {
      match.liftBall(id);
      if (picked === id) picked = null;
    } else if (match.placeBall(id, t.footSpot.x, t.footSpot.y)) {
      picked = id;
      host.showBallTag(id);
    } else toast('Bàn đã kín, không còn chỗ đặt bi', 'bad');
    haptic(8);
    view.resync();
    host.refresh();
  }

  /** Follow the finger: on the cloth the ball itself moves, off it a ghost ball does. */
  function dragTo(e: PointerEvent) {
    const p = view.toTable(e.clientX, e.clientY);
    const x = p.x - drag!.dx;
    const y = p.y - drag!.dy;
    const id = drag!.id;
    if (onCloth(x, y)) {
      showGhost(e, null);
      match.placeBall(id, x, y);
    } else {
      // Off the edge: the cue ball stops at the cushion; object balls lift, ready to go back to the tray.
      if (id === match.cueId()) match.placeBall(id, x, y);
      else {
        match.liftBall(id);
        showGhost(e, id);
      }
    }
    view.resync();
    host.refresh();
  }

  function settle(id: number) {
    const ball = match.balls.find((b) => b.id === id)!;
    if (ball.onTable) {
      picked = id;
      host.showBallTag(id);
    } else if (picked === id) picked = null;
    haptic(8);
    host.refresh();
  }

  // ---------- Cloth ----------
  function down(e: PointerEvent): boolean {
    if (!arranging) return false;
    if (match.phase !== 'aim' || drag) return true;
    const p = view.toTable(e.clientX, e.clientY);
    const grab = Math.max(t.R * 1.8, 22 / view.pxPerM);
    const hit = match.balls
      .filter((b) => b.onTable && Math.hypot(p.x - b.x, p.y - b.y) < grab)
      .sort((a, b) => Math.hypot(p.x - a.x, p.y - a.y) - Math.hypot(p.x - b.x, p.y - b.y))[0];
    if (hit) {
      drag = { id: hit.id, pointer: e.pointerId, dx: p.x - hit.x, dy: p.y - hit.y, fromTray: false, moved: false, sx: e.clientX, sy: e.clientY };
      (e.target as Element).setPointerCapture?.(e.pointerId);
      picked = hit.id;
      host.showBallTag(hit.id);
      haptic(8);
    } else if (picked !== null && match.balls.find((b) => b.id === picked)?.onTable) {
      // A tap on bare cloth moves the ball last touched there.
      match.placeBall(picked, p.x, p.y);
      view.resync();
    }
    host.refresh();
    return true;
  }
  function move(e: PointerEvent): boolean {
    if (!arranging) return false;
    if (!drag || drag.fromTray || e.pointerId !== drag.pointer) return true;
    if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 4) return true;
    drag.moved = true;
    dragTo(e);
    return true;
  }
  function up(e: PointerEvent): boolean {
    if (!arranging) return false;
    if (!drag || drag.fromTray || e.pointerId !== drag.pointer) return true;
    const d = drag;
    drag = null;
    showGhost(e, null);
    if (d.moved) settle(d.id);
    return true;
  }

  function resolved() {
    const shot = match.lastShot;
    if (!shot) return;
    shots++;
    const cue = match.cueId();
    const pots = shot.pocketed.filter((p) => p.id !== cue).map((p) => p.id);
    const scratch = shot.pocketed.some((p) => p.id === cue) || (shot.offTable ?? []).includes(cue);
    const point = carom && shot.cueContacts.length >= 2;
    scored += carom ? (point ? 1 : 0) : pots.length;
    const left = match.balls.some((b) => b.onTable && b.id !== cue);
    const feats = match.lastScore.names.join(' · ') || undefined;
    if (scratch) host.herald({ title: 'Bi cái rơi', line: 'Đặt lại bi cái rồi đánh tiếp, hoặc Đánh lại cú vừa rồi.', tone: 'red', ms: 2200 });
    else if (point) host.herald({ title: 'Ghi điểm', line: feats, ms: 1600 });
    else if (pots.length) host.herald({ title: pots.length > 1 ? `Vào ${pots.length} bi` : `Vào bi ${pots[0]}`, line: [feats, left ? '' : 'Sạch bàn. Về thế đầu để luyện lại.'].filter(Boolean).join(' — ') || undefined, ms: left ? 1600 : 2400 });
    else if (shot.firstHit === null) host.herald({ title: 'Không chạm bi', ms: 1300 });
  }

  function render() {
    for (const s of segs) {
      const on = s.on();
      s.b.setAttribute('aria-selected', String(on));
      s.b.setAttribute('role', 'tab');
    }
    arrangeView.hidden = !arranging;
    shootView.hidden = arranging;
    const aim = match.phase === 'aim';
    for (const s of segs) s.b.disabled = !aim;
    for (const { id, b } of trayBalls) {
      const ball = match.balls.find((x) => x.id === id)!;
      b.classList.toggle('on', ball.onTable);
      b.classList.toggle('picked', picked === id);
      b.setAttribute('aria-label', `${ballName(id)}: ${ball.onTable ? 'trên bàn, chạm để cất' : 'trong khay, chạm để đặt'}`);
    }
    wholeTable.textContent = anyOut() ? 'Dọn bàn' : 'Đủ bộ';
    shotsN.textContent = String(shots);
    scoredN.textContent = String(scored);
    undo.disabled = !match.canUndo;
    restart.disabled = !aim;
    keep.disabled = !aim;
  }

  return {
    el,
    get arranging() { return arranging; },
    down, move, up, resolved, render,
    plate: () => ({
      kicker: `Luyện thế · ${setup.name}`,
      text: arranging ? 'Xếp bi xong thì chạm Đánh'
        : carom ? 'Chạm đủ hai bi để ghi điểm' : 'Đánh tự do, lỡ tay thì Đánh lại',
    }),
    card: () => ({
      score: String(carom ? scored : match.potted[0].length),
      sub: carom ? 'điểm' : 'bi trong lỗ',
    }),
  };
}
