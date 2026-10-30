import { makeBall, type Ball } from '../core/physics';
import { rackEight } from '../core/rack';
import { Rng } from '../core/rng';
import { makeCaromTable, makePoolTable, type TableGeom } from '../core/table';

/**
 * Luyện thế: a free table. The player picks a position (a drill or one of their own), may lay
 * the balls out by hand, then shoots it again and again without rules, turns or an opponent.
 */
export type PracticeTable = 'pool' | 'carom';

/** One ball resting on the cloth, in table metres. */
export interface PracticeSpot { id: number; x: number; y: number }

export interface PracticeDrill {
  id: string;
  table: PracticeTable;
  name: string;
  /** One line under the name in the list. */
  sub: string;
  /** What to try, shown beside the preview. */
  tip: string;
  spots: PracticeSpot[];
}

export interface SavedLayout {
  id: string;
  table: PracticeTable;
  name: string;
  spots: PracticeSpot[];
  /** Saved at, ms since epoch. */
  at: number;
}

export const PRACTICE_TABLE_NAMES: Record<PracticeTable, string> = { pool: 'Bàn lỗ', carom: 'Bàn phăng' };

const tables: Record<PracticeTable, TableGeom> = { pool: makePoolTable(), carom: makeCaromTable() };
export const practiceGeom = (kind: PracticeTable): TableGeom => tables[kind];
export const practiceIds = (kind: PracticeTable): number[] => kind === 'pool' ? Array.from({ length: 16 }, (_, i) => i) : [0, 1, 2];

type V = { x: number; y: number };
const unit = (a: V, b: V): V => {
  const d = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  return { x: (b.x - a.x) / d, y: (b.y - a.y) / d };
};
const along = (p: V, u: V, d: number): V => ({ x: p.x + u.x * d, y: p.y + u.y * d });
const turn = (u: V, deg: number): V => {
  const a = (deg * Math.PI) / 180;
  return { x: u.x * Math.cos(a) - u.y * Math.sin(a), y: u.x * Math.sin(a) + u.y * Math.cos(a) };
};
const spot = (id: number, p: V): PracticeSpot => ({ id, x: p.x, y: p.y });

/** Pool pocket aim points, in the UI order: top-left, top-mid, top-right, bottom-left, bottom-mid, bottom-right. */
const pocket = (i: number): V => {
  const p = tables.pool.pockets[i];
  return { x: p.ax, y: p.ay };
};

/** Object ball `d` metres out from a pocket, and a cue ball set up to cut it in by `cut` degrees. */
function potLine(pk: number, from: V, spec: { d: number; cut: number; cueDist: number }): { ball: V; cue: V } {
  const { d, cut, cueDist } = spec;
  const p = pocket(pk);
  const ball = along(p, unit(p, from), d);
  const travel = unit(ball, p);
  return { ball, cue: along(ball, turn(travel, cut), -cueDist) };
}

function poolDrills(): PracticeDrill[] {
  const t = tables.pool;
  const R = t.R;
  const straight = potLine(2, { x: -0.3, y: 0.15 }, { d: 0.42, cut: 0, cueDist: 0.55 });
  const cut = potLine(5, { x: 0.2, y: -0.05 }, { d: 0.34, cut: 52, cueDist: 0.5 });
  const railY = -(t.W / 2 - R - 0.0006);
  const comboPk = pocket(5);
  const comboU = unit(comboPk, { x: -0.1, y: -0.05 });
  const combo2 = along(comboPk, comboU, 0.3);
  const combo1 = along(combo2, comboU, 0.24);
  const comboCue = along(combo1, turn({ x: -comboU.x, y: -comboU.y }, 14), -0.5);
  const kickCue = { x: -0.55, y: 0.12 };
  const kickBall = { x: 0.62, y: 0.28 };
  const kickMid = along(kickCue, unit(kickCue, kickBall), Math.hypot(kickBall.x - kickCue.x, kickBall.y - kickCue.y) * 0.55);
  const kickN = turn(unit(kickCue, kickBall), 90);
  const jump = potLine(2, { x: -0.4, y: 0.1 }, { d: 0.4, cut: 0, cueDist: 0.7 });
  const jumpBlock = along(jump.cue, unit(jump.cue, jump.ball), 0.15);
  // A hair looser than a match rack, so hand-moved balls never start pressed together.
  const rack = rackEight(t, new Rng(7)).filter((b) => b.id !== 0)
    .map((b) => spot(b.id, { x: t.footSpot.x + (b.x - t.footSpot.x) * 1.004, y: b.y * 1.004 }));
  return [
    { id: 'p-empty', table: 'pool', name: 'Bàn trống', sub: 'Bi cái và một bi, tự bày thêm', tip: 'Mở Xếp bi để lấy bi trong khay ra bàn. Kéo bi ra khỏi mép bàn để cất lại.', spots: [spot(0, t.headSpot), spot(1, t.footSpot)] },
    { id: 'p-break', table: 'pool', name: 'Phá bi', sub: 'Đủ 15 bi, đứng sau vạch phá', tip: 'Đánh mạnh, trúng thẳng bi đầu tam giác, hơi kéo bi cái để nó dừng giữa bàn. Dời bi cái trong vùng phá để thử góc khác.', spots: [spot(0, { x: t.headStringX - 0.08, y: 0 }), ...rack] },
    { id: 'p-straight', table: 'pool', name: 'Bi thẳng lỗ', sub: 'Đánh dừng, đánh kéo, đánh theo', tip: 'Cú thẳng là cú luyện áp phê: chấm giữa để bi cái dừng, chấm dưới để kéo về, chấm trên để theo vào. Dùng Đánh lại để thử cả ba.', spots: [spot(0, straight.cue), spot(1, straight.ball)] },
    { id: 'p-cut', table: 'pool', name: 'Cắt mỏng', sub: 'Góc cắt khoảng 50 độ vào lỗ góc', tip: 'Nhắm bi ảo nằm sát mép bi mục tiêu. Cắt càng mỏng càng nên đánh nhẹ; bật Đường đi để xem bi cái chạy đi đâu.', spots: [spot(0, cut.cue), spot(3, cut.ball)] },
    { id: 'p-rail', table: 'pool', name: 'Bi sát băng', sub: 'Bi dính băng dài, vào lỗ góc', tip: 'Bi dính băng: chạm bi và băng gần như cùng lúc, lực vừa, để bi lăn dọc băng vào lỗ.', spots: [spot(0, { x: 0.05, y: -0.12 }), spot(5, { x: 0.52, y: railY })] },
    { id: 'p-combo', table: 'pool', name: 'Bi kết', sub: 'Bi này đẩy bi kia vào lỗ', tip: 'Đánh bi 1 sao cho nó đẩy bi 2 theo đường nối hai bi tới lỗ. Ngắm đường nối, không ngắm lỗ.', spots: [spot(0, comboCue), spot(1, combo1), spot(2, combo2)] },
    { id: 'p-kick', table: 'pool', name: 'Gỡ thế chặn', sub: 'Hai bi chặn đường thẳng', tip: 'Không có đường thẳng tới bi 1: đánh một băng hoặc hai băng để vòng qua. Bật Đường đi để dò điểm chạm băng.', spots: [spot(0, kickCue), spot(1, kickBall), spot(4, along(kickMid, kickN, R * 1.06)), spot(6, along(kickMid, kickN, -R * 1.06))] },
    { id: 'p-jump', table: 'pool', name: 'Nhảy bi', sub: 'Bi chặn sát trước bi cái', tip: 'Mở bảng áp phê và nâng góc cơ để bi cái nhảy qua bi chặn. Góc càng dốc thì bi bay càng cao nhưng càng khó trúng.', spots: [spot(0, jump.cue), spot(2, jumpBlock), spot(1, jump.ball)] },
    { id: 'p-run', table: 'pool', name: 'Chạy ba bi', sub: 'Ăn 1, 2, 3 theo thứ tự', tip: 'Mỗi cú phải ăn bi và để bi cái dừng ở chỗ dễ đánh bi kế tiếp. Lỡ tay thì Đánh lại, không cần xếp lại cả bàn.', spots: [spot(0, { x: -0.55, y: -0.1 }), spot(1, { x: 0.28, y: -0.24 }), spot(2, { x: 0.62, y: 0.22 }), spot(3, { x: -0.18, y: 0.3 })] },
  ];
}

function caromDrills(): PracticeDrill[] {
  const t = tables.carom;
  return [
    { id: 'c-open', table: 'carom', name: 'Khai cuộc', sub: 'Thế mở đầu chuẩn', tip: 'Bi cái chạm bi đỏ trước, chạy ba băng rồi về chạm bi vàng. Cú mở đầu nào cũng bắt đầu từ thế này.', spots: [spot(0, { x: t.headSpot.x, y: 0.1525 }), spot(1, t.headSpot), spot(2, t.footSpot)] },
    { id: 'c-nurse', table: 'carom', name: 'Gom bi', sub: 'Ba bi sát nhau gần băng', tip: 'Đánh thật nhẹ để ghi điểm mà ba bi vẫn ở gần nhau. Giữ được thế gom là ghi điểm liên tục.', spots: [spot(0, { x: 0.12, y: -0.5 }), spot(1, { x: 0.32, y: -0.6 }), spot(2, { x: 0.4, y: -0.47 })] },
    { id: 'c-diag', table: 'carom', name: 'Ba băng chéo', sub: 'Đi chéo bàn qua ba băng', tip: 'Chạm bi vàng mỏng, cho bi cái đi băng dài, băng ngắn, băng dài rồi tới bi đỏ ở góc xa. Bật Đường đi để chỉnh điểm chạm.', spots: [spot(0, { x: -1.0, y: -0.38 }), spot(1, { x: -0.72, y: -0.2 }), spot(2, { x: 1.12, y: 0.48 })] },
    { id: 'c-back', table: 'carom', name: 'Đánh kéo phăng', sub: 'Hai bi thẳng hàng, kéo về', tip: 'Bi đỏ thẳng trước mặt, bi vàng phía sau bi cái: chấm dưới thật sâu để bi cái quay về chạm bi vàng.', spots: [spot(0, { x: -0.2, y: 0.05 }), spot(2, { x: 0.25, y: 0.05 }), spot(1, { x: -0.75, y: 0.22 })] },
  ];
}

export const PRACTICE_DRILLS: PracticeDrill[] = [...poolDrills(), ...caromDrills()];

/** The whole set for a table: balls in `spots` rest on the cloth, the rest wait in the tray. */
export function practiceBalls(kind: PracticeTable, spots: PracticeSpot[]): Ball[] {
  return practiceIds(kind).map((id) => {
    const s = spots.find((p) => p.id === id);
    const b = makeBall(id, s?.x ?? 0, s?.y ?? 0);
    b.onTable = !!s;
    return b;
  });
}

export function spotsOf(balls: Ball[]): PracticeSpot[] {
  return balls.filter((b) => b.onTable).map((b) => ({ id: b.id, x: b.x, y: b.y }));
}

/** The cloth a ball must rest on: the table and every ball already lying on it. */
export interface RestCloth {
  table: TableGeom;
  balls: readonly { id: number; x: number; y: number; onTable?: boolean }[];
}

/** Where a ball may rest: on the cloth, clear of the other balls on it and of pocket mouths. */
export function canRest(cloth: RestCloth, id: number, x: number, y: number): boolean {
  const { table: t, balls } = cloth;
  if (Math.abs(x) > t.L / 2 - t.R || Math.abs(y) > t.W / 2 - t.R) return false;
  for (const b of balls) if (b.id !== id && b.onTable !== false && Math.hypot(b.x - x, b.y - y) < 2 * t.R + 1e-5) return false;
  return t.pockets.every((p) => Math.hypot(x - p.hx, y - p.hy) > p.hr + t.R);
}

// ---------- Thế của tôi ----------

const STORE_KEY = 'cotien.practice.v1';
export const SAVED_MAX = 12;

/** Drop anything that is not a well-formed layout, so a bad write can never break the screen. */
export function sanitizeSaved(raw: unknown): SavedLayout[] {
  const list = (raw as { saved?: unknown })?.saved;
  if (!Array.isArray(list)) return [];
  const out: SavedLayout[] = [];
  for (const e of list) {
    const entry = parseSavedEntry(e, out.length);
    if (entry) out.push(entry);
    if (out.length >= SAVED_MAX) break;
  }
  return out;
}

/** One stored entry, or null when anything about it is malformed. */
function parseSavedEntry(e: unknown, index: number): SavedLayout | null {
  if (!e || typeof e !== 'object') return null;
  const v = e as Record<string, unknown>;
  if (v.table !== 'pool' && v.table !== 'carom') return null;
  const spots = parseSpots(v.spots, v.table);
  if (!spots.some((s) => s.id === 0)) return null;
  return {
    id: typeof v.id === 'string' && v.id ? v.id.slice(0, 40) : `s${index}`,
    table: v.table,
    name: typeof v.name === 'string' && v.name.trim() ? v.name.trim().slice(0, 32) : 'Thế không tên',
    spots,
    at: typeof v.at === 'number' && Number.isFinite(v.at) ? v.at : 0,
  };
}

/** Spots that belong on that table: known ids, once each, inside the rails. */
function parseSpots(raw: unknown, kind: PracticeTable): PracticeSpot[] {
  const t = tables[kind];
  const ids = practiceIds(kind);
  const spots: PracticeSpot[] = [];
  for (const s of Array.isArray(raw) ? raw : []) {
    const p = s as Record<string, unknown>;
    const id = p?.id;
    const x = p?.x;
    const y = p?.y;
    if (typeof id !== 'number' || !ids.includes(id) || spots.some((q) => q.id === id)) continue;
    if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y)) continue;
    if (Math.abs(x) > t.L / 2 || Math.abs(y) > t.W / 2) continue;
    spots.push({ id, x, y });
  }
  return spots;
}

export function loadSaved(): SavedLayout[] {
  try {
    return sanitizeSaved(JSON.parse(localStorage.getItem(STORE_KEY) ?? 'null'));
  } catch {
    return [];
  }
}

function writeSaved(list: SavedLayout[]): boolean {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({ v: 1, saved: list }));
    return true;
  } catch {
    return false;
  }
}

/** Keep a position under the next free "Thế n" name; the newest comes first. Null when storage is full or blocked. */
export function saveLayout(kind: PracticeTable, spots: PracticeSpot[]): SavedLayout | null {
  const list = loadSaved();
  let n = 1;
  while (list.some((s) => s.name === `Thế ${n}`)) n++;
  const entry: SavedLayout = { id: `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, table: kind, name: `Thế ${n}`, spots: spots.map((s) => ({ ...s })), at: Date.now() };
  return writeSaved([entry, ...list].slice(0, SAVED_MAX)) ? entry : null;
}

export function deleteSaved(id: string) {
  writeSaved(loadSaved().filter((s) => s.id !== id));
}
