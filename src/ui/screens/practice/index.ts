import { ballStyle } from '../../../core/ball-styles';
import type { TableSkin } from '../../../game/content/gear';
import {
  deleteSaved, loadSaved, practiceBalls, practiceGeom, PRACTICE_DRILLS, PRACTICE_TABLE_NAMES, SAVED_MAX,
  type PracticeSpot, type PracticeTable,
} from '../../../game/practice';
import { screenEl, type App, type Screen } from '../../app';
import { btn, h, tabs, tap, toast, uiScale } from '../../dom';
import { icon } from '../../icons';
import { matchScreen } from '../match';
import { topbar } from '../../widgets';

/** One entry of the list: a drill from the book or a position the player kept. */
interface Choice {
  key: string;
  table: PracticeTable;
  name: string;
  sub: string;
  tip: string;
  spots: PracticeSpot[];
  saved?: string;
}

let lastTable: PracticeTable = 'pool';
let lastKey = 'p-empty';

/** Luyện thế: pick a position (a drill or one of your own), look at it, then take it to the table. */
export function practiceScreen(app: App): Screen {
  const el = screenEl('practice');
  let table = lastTable;
  let key = lastKey;
  const list = h('div.scroll.pr-list', { tabindex: '0' });
  const preview = h('canvas.pr-table', { 'aria-hidden': 'true' });
  const name = h('h2.pr-name');
  const count = h('div.pr-count');
  const tip = h('p.pr-tip');
  const actions = h('div.pr-actions');
  const stage = h('div.pr-stage.sheet', null, h('div.pr-felt', null, preview), h('div.pr-info', null, name, count, tip), actions);

  const choices = (): Choice[] => [
    ...PRACTICE_DRILLS.filter((d) => d.table === table).map((d) => ({ key: d.id, table: d.table, name: d.name, sub: d.sub, tip: d.tip, spots: d.spots })),
    ...loadSaved().filter((s) => s.table === table).map((s) => ({
      key: s.id, table: s.table, name: s.name, saved: s.id, spots: s.spots,
      sub: `${s.spots.length - 1} bi · lưu ${new Date(s.at).toLocaleDateString('vi-VN')}`,
      tip: 'Thế bạn đã lưu khi luyện. Vào bàn để đánh tiếp từ đúng vị trí này.',
    })),
  ];

  const render = () => {
    const all = choices();
    let cur = all.find((c) => c.key === key);
    if (!cur) {
      cur = all[0];
      key = cur.key;
    }
    lastTable = table;
    lastKey = key;
    const drills = all.filter((c) => !c.saved);
    const mine = all.filter((c) => c.saved);
    const row = (c: Choice) => {
      const thumb = h('canvas.pr-thumb', { 'aria-hidden': 'true' });
      const b = tap(h('button.pr-item', { class: c.key === key ? 'sel' : '', 'aria-pressed': String(c.key === key) },
        thumb, h('span.grow', null, h('b', null, c.name), h('span.pr-sub', null, c.sub))), () => {
        if (key === c.key) return;
        key = c.key;
        render();
      });
      requestAnimationFrame(() => drawTable(thumb, c.table, c.spots, app.tableSkin));
      return b;
    };
    list.replaceChildren(
      h('div.section-title', null, 'Thế mẫu'),
      ...drills.map(row),
      h('div.section-title', null, `Thế của tôi · ${loadSaved().length}/${SAVED_MAX}`),
      ...(mine.length ? mine.map(row) : [h('p.pr-empty', null, 'Đang luyện, chạm Lưu thế để giữ vị trí bàn. Thế đã lưu nằm ở đây.')]),
    );
    name.textContent = cur.name;
    const balls = cur.spots.length - 1;
    count.textContent = `${PRACTICE_TABLE_NAMES[cur.table]} · bi cái${balls ? ` và ${balls} bi` : ''}`;
    tip.replaceChildren(h('b', null, 'Mẹo: '), cur.tip);
    const pick = cur;
    actions.replaceChildren(...[
      pick.saved ? btn(h('span.btn-in', null, icon('close'), 'Xoá thế'), () => {
        deleteSaved(pick.saved!);
        toast(`Đã xoá ${pick.name}`);
        key = '';
        render();
      }, 'ghost') : null,
      btn(h('span.btn-in', null, icon('play'), 'Vào bàn'), () => startPractice(app, pick)),
    ].filter((b) => b !== null));
    requestAnimationFrame(() => drawTable(preview, cur.table, cur.spots, app.tableSkin));
  };

  const bar = tabs<PracticeTable>([{ id: 'pool', label: PRACTICE_TABLE_NAMES.pool }, { id: 'carom', label: PRACTICE_TABLE_NAMES.carom }], table, (v) => {
    table = v;
    key = '';
    list.scrollTop = 0;
    render();
  });
  const header = topbar(app, 'Luyện thế', true, bar);
  header.classList.add('compact-nav');
  el.append(header, h('div.pr-body', null, list, stage));
  render();
  const redraw = () => render();
  window.addEventListener('cotien:ui-resize', redraw);
  return { el, dispose: () => window.removeEventListener('cotien:ui-resize', redraw) };
}

function startPractice(app: App, c: Choice) {
  const me = { name: app.profile.name, kind: 'human' as const, cue: app.cue, champion: app.profile.champion };
  app.go(matchScreen({
    setup: {
      mode: c.table === 'pool' ? 'eight' : 'carom-libre', raceTo: 1, mutator: null, tableSkin: app.tableSkin, classic: true,
      players: [me, { ...me, name: 'Luyện thế' }], layout: practiceBalls(c.table, c.spots), practice: true,
    },
    label: `Luyện thế · ${c.name}`,
    practice: { table: c.table, name: c.name, arrange: c.key === 'p-empty' },
    onExit: () => app.pop(),
  }));
}

const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;

interface TablePaint {
  g: CanvasRenderingContext2D;
  t: ReturnType<typeof practiceGeom>;
  k: number;
  X(x: number): number;
  Y(y: number): number;
}

/**
 * Top-down picture of a position: rails, cloth, pockets and balls, drawn from the simulation's
 * own geometry and ball colours so it matches the table you will play on.
 */
function drawTable(canvas: HTMLCanvasElement, kind: PracticeTable, spots: PracticeSpot[], skin: TableSkin) {
  const w = canvas.clientWidth;
  const hgt = canvas.clientHeight;
  if (!w || !hgt) return;
  const dpr = Math.min(3, (window.devicePixelRatio || 1) * uiScale());
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(hgt * dpr);
  const g = canvas.getContext('2d')!;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const t = practiceGeom(kind);
  const rail = t.railWidth;
  const k = Math.min(w / (t.L + 2 * rail), hgt / (t.W + 2 * rail));
  const paint = { g, t, k, X: (x: number) => w / 2 + x * k, Y: (y: number) => hgt / 2 + y * k };
  drawTableSurface(paint, skin);
  drawBalls(paint, kind, spots);
}


function drawTableSurface(p: TablePaint, skin: TableSkin) {
  const { g, t, k, X, Y } = p;
  const rail = t.railWidth;
  g.beginPath();
  g.roundRect(X(-t.L / 2 - rail), Y(-t.W / 2 - rail), (t.L + 2 * rail) * k, (t.W + 2 * rail) * k, rail * k * 0.6);
  g.fillStyle = hex(skin.rail);
  g.fill();
  g.lineWidth = Math.max(1, k * 0.008);
  g.strokeStyle = hex(skin.railDark);
  g.stroke();
  const cx = X(0);
  const cy = Y(0);
  const cloth = g.createRadialGradient(cx, cy, 0, cx, cy, (t.L / 2) * k);
  cloth.addColorStop(0, hex(skin.cloth));
  cloth.addColorStop(1, hex(skin.clothDark));
  g.fillStyle = cloth;
  g.fillRect(X(-t.L / 2), Y(-t.W / 2), t.L * k, t.W * k);
  g.fillStyle = 'rgba(255,255,255,0.55)';
  for (const d of t.diamonds) {
    g.beginPath();
    g.arc(X(d.x), Y(d.y), Math.max(0.8, k * 0.007), 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = '#121212';
  for (const pocket of t.pockets) {
    g.beginPath();
    g.arc(X(pocket.hx), Y(pocket.hy), pocket.hr * k, 0, Math.PI * 2);
    g.fill();
  }
  // Head string, faint.
  g.strokeStyle = 'rgba(255,255,255,0.18)';
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(X(t.headStringX), Y(-t.W / 2));
  g.lineTo(X(t.headStringX), Y(t.W / 2));
  g.stroke();
}


function drawBalls(p: TablePaint, kind: PracticeTable, spots: PracticeSpot[]) {
  const { t, k, X, Y } = p;
  const r = Math.max(2.2, t.R * k);
  for (const s of [...spots].sort((a, b) => (a.id === 0 ? 1 : 0) - (b.id === 0 ? 1 : 0))) {
    drawBall(p, { style: ballStyle(kind, s.id), x: X(s.x), y: Y(s.y), r });
  }
}


function drawBall(p: TablePaint, b: { style: ReturnType<typeof ballStyle>; x: number; y: number; r: number }) {
  const { g } = p;
  const { style: st, x, y, r } = b;
  g.beginPath();
  g.arc(x + r * 0.18, y + r * 0.22, r, 0, Math.PI * 2);
  g.fillStyle = 'rgba(0,0,0,0.35)';
  g.fill();
  g.save();
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.clip();
  g.fillStyle = st.stripe ? '#f4f1e6' : hex(st.color);
  g.fillRect(x - r, y - r, 2 * r, 2 * r);
  if (st.stripe) {
    g.fillStyle = hex(st.color);
    g.fillRect(x - r, y - r * 0.55, 2 * r, r * 1.1);
  }
  if (st.number && r >= 5) {
    g.fillStyle = '#f8f6ee';
    g.beginPath();
    g.arc(x, y, r * 0.48, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#161616';
    g.font = `700 ${Math.round(r * 0.72)}px "Noto Serif", serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(String(st.number), x, y + r * 0.04);
  }
  const shine = g.createRadialGradient(x - r * 0.35, y - r * 0.4, 0, x, y, r);
  shine.addColorStop(0, 'rgba(255,255,255,0.55)');
  shine.addColorStop(0.35, 'rgba(255,255,255,0.08)');
  shine.addColorStop(1, 'rgba(0,0,0,0.28)');
  g.fillStyle = shine;
  g.fillRect(x - r, y - r, 2 * r, 2 * r);
  g.restore();
}
