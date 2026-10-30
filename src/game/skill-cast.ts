import { segmentDistance, type Ball, type Terrain } from '../core/physics';
import type { Segment, TableGeom } from '../core/table';
import { skillPower, type SkillKind, type UltId, type SkillShape } from './content/sects';

export interface SkillCast {
  point?: { x: number; y: number };
  direction?: { x: number; y: number };
  /** Index in table.segments; position is a fraction along that cushion. */
  rail?: { index: number; position: number };
  sense?: 'cw' | 'ccw';
  hardness?: 'soft' | 'hard';
}
export interface CastEffect {
  kind: SkillKind;
  slot: number;
  cast: SkillCast;
  terrain: Terrain;
  segments: Segment[];
}
export const PLACED_KINDS: SkillKind[] = ['slick', 'sand', 'bumper', 'railcraft', 'wind', 'well', 'spinwash', 'vortex', 'silk', 'quake'];

/** Rotate a placement axis while its centre stays put; finite aim is normalised. */
export function rotateDirection(direction: { x: number; y: number } | undefined, deg: number): { x: number; y: number } {
  const radians = Math.atan2(direction?.y ?? 0, direction?.x ?? 1) + deg * Math.PI / 180;
  return { x: Math.cos(radians), y: Math.sin(radians) };
}

export function mergeTerrain(...sources: (Terrain | null | undefined)[]): Terrain {
  return {
    forces: sources.flatMap(t => [...(t?.forces ?? []), ...(t?.force ? [{ ...t.force, gust: t.gust }] : [])]),
    patches: sources.flatMap(t => t?.patches ?? []),
    wells: sources.flatMap(t => t?.wells ?? []),
    vortices: sources.flatMap(t => t?.vortices ?? []),
    rails: sources.flatMap(t => t?.rails ?? []),
  };
}

/** Everything a cast needs to know about the cloth it is placed on. */
export interface CastContext {
  table: TableGeom;
  balls: Ball[];
  cueId: number;
  cast?: SkillCast;
  /** Sect ultimate id (slot 2): adds the sect's own geometry. */
  ult?: UltId;
  /** Fixed shape from the skill's data (roots, gate, rim). */
  shape?: SkillShape;
}

/** Pure builder used by match, placement preview and worker planning. */
export function buildCast(kind: SkillKind, tier: number, slot: number, ctx: CastContext): CastEffect {
  const cast = ctx.cast ?? {};
  const place = resolvePlacement(kind, tier, slot, ctx);
  const p = skillPower(kind, tier) as Record<string, number>;
  const resolved: SkillCast = { ...cast, point: place.point, direction: place.direction, sense: cast.sense ?? 'cw', hardness: cast.hardness ?? 'soft' };
  const effect = baseEffect(kind, p, place, resolved);
  if (kind === 'railcraft') {
    const rail = railPlacement(p, place, cast);
    resolved.rail = { index: rail.index, position: rail.pos };
    effect.terrain.rails = [{ ax: rail.a.x, ay: rail.a.y, bx: rail.b.x, by: rail.b.y, multiplier: 1 + (resolved.hardness === 'hard' ? 1 : -1) * p.restitution }];
  }
  if (kind === 'quake') Object.assign(effect.terrain, { unclamped: true, quakeWindow: { duration: p.time } });
  if (slot === 2 && ctx.ult || ctx.shape) {
    applyGeometry({
      kind, tier, table: ctx.table, balls: ctx.balls, cast: resolved, terrain: effect.terrain, segments: effect.segments,
      ult: slot === 2 ? ctx.ult : undefined, shape: ctx.shape,
    });
  }
  return { kind, slot, cast: resolved, terrain: effect.terrain, segments: effect.segments };
}

/** Nearest object ball to the cue, as a fallback aim point. */
function nearestTarget(balls: Ball[], cueId: number, cue: Ball): { x: number; y: number } {
  return balls.filter(b => b.onTable && b.id !== cueId).sort((a, b) => Math.hypot(a.x - cue.x, a.y - cue.y) - Math.hypot(b.x - cue.x, b.y - cue.y))[0] ?? { x: 0, y: 0 };
}

/** The cast's direction: the player's aim if finite, else toward the nearest object ball. */
function castDirection(cue: Ball, target: { x: number; y: number }, cast: SkillCast): { x: number; y: number } {
  const dir = cast.direction && Number.isFinite(cast.direction.x) && Number.isFinite(cast.direction.y) ? cast.direction : { x: target.x - cue.x, y: target.y - cue.y };
  const norm = Math.hypot(dir.x, dir.y) || 1;
  const direction = { x: dir.x / norm || 0, y: dir.y / norm || 0 };
  if (!direction.x && !direction.y) direction.x = 1;
  return direction;
}

/** Where the cast may sit, and the tests a candidate spot must pass. */
interface ResolvedPlacement {
  table: TableGeom;
  point: { x: number; y: number };
  desired: { x: number; y: number };
  direction: { x: number; y: number };
  /** Segment a bumper would occupy at `pt`. */
  segmentAt: (pt: { x: number; y: number }) => Segment;
  /** Whether the cast may sit at `pt` without touching a ball or a pocket mouth. */
  legal: (pt: { x: number; y: number }) => boolean;
}

function resolvePlacement(kind: SkillKind, tier: number, slot: number, ctx: CastContext): ResolvedPlacement {
  const { table, balls, cueId, ult, shape } = ctx;
  const cast = ctx.cast ?? {};
  const cue = balls.find(b => b.id === cueId)!;
  const target = nearestTarget(balls, cueId, cue);
  const direction = castDirection(cue, target, cast);
  const p = skillPower(kind, tier) as Record<string, number>;
  const margin = Math.max(p.radius ?? 0, (p.length ?? 0) / 2, table.R * 2, slot === 2 && ult ? 0.35 : shape ? 0.25 : 0);
  const clamp = (v: number, span: number) => Math.max(-span / 2 + margin, Math.min(span / 2 - margin, Number.isFinite(v) ? v : 0));
  const desired = cast.point ?? { x: (cue.x + target.x) / 2, y: (cue.y + target.y) / 2 };
  const segmentAt = (pt: { x: number; y: number }): Segment => ({ ax: pt.x - direction.x * p.length / 2, ay: pt.y - direction.y * p.length / 2, bx: pt.x + direction.x * p.length / 2, by: pt.y + direction.y * p.length / 2 });
  const legal = (pt: { x: number; y: number }) => balls.every(b => !b.onTable || (kind === 'bumper' ? segmentDistance(b.x, b.y, segmentAt(pt)) : Math.hypot(pt.x - b.x, pt.y - b.y)) > table.R * 2.1)
    && (kind !== 'bumper' || table.pockets.every(pk => segmentDistance(pk.x, pk.y, segmentAt(pt)) > pk.r + table.R * 2));
  const place: ResolvedPlacement = { table, point: { x: clamp(desired.x, table.L), y: clamp(desired.y, table.W) }, desired, direction, segmentAt, legal };
  // Deterministic nearest legal centre; a short isolated bumper cannot partition the cloth.
  if (!legal(place.point)) {
    const found = nearestLegalPoint(table, margin, desired, (x, y) => legal({ x, y }));
    if (found) place.point = found;
  }
  return place;
}

/** Nearest grid point whose test passes; the cloth is swept at ball-radius steps. */
function nearestLegalPoint(table: TableGeom, margin: number, desired: { x: number; y: number }, legal: (x: number, y: number) => boolean): { x: number; y: number } | null {
  let best = Infinity;
  let found: { x: number; y: number } | null = null;
  for (let x = -table.L / 2 + margin; x <= table.L / 2 - margin; x += table.R) {
    for (let y = -table.W / 2 + margin; y <= table.W / 2 - margin; y += table.R) {
      const d = Math.hypot(x - desired.x, y - desired.y);
      if (d < best && legal(x, y)) { best = d; found = { x, y }; }
    }
  }
  return found;
}

/** Đường Cong Mê Hồn: three alternating small vortices on a smooth S. */
function silkVortex(place: ResolvedPlacement, along: number, p: Record<string, number>, index: number): NonNullable<Terrain['vortices']>[number] {
  const d = place.direction;
  const n = { x: -d.y, y: d.x };
  const across = Math.sin(along * Math.PI / 0.32) * 0.055;
  return {
    x: place.point.x + d.x * along + n.x * across,
    y: place.point.y + d.y * along + n.y * across,
    r: p.radius, a: p.acceleration, sense: (index % 2 === 0 ? 1 : -1),
  };
}

/** The cast's own terrain and segments, before any sect geometry is added. */
function baseEffect(kind: SkillKind, p: Record<string, number>, place: ResolvedPlacement, resolved: SkillCast): { terrain: Terrain; segments: Segment[] } {
  const terrain: Terrain = {};
  const segments: Segment[] = [];
  if (kind === 'slick' || kind === 'sand' || kind === 'spinwash') terrain.patches = [{ ...place.point, r: p.radius, roll: kind === 'spinwash' ? 1 : p.friction, slide: p.friction, spin: kind === 'spinwash' ? p.friction : 1 }];
  if (kind === 'wind') terrain.force = { x: place.direction.x * p.acceleration, y: place.direction.y * p.acceleration };
  if (kind === 'well') terrain.wells = [{ ...place.point, r: p.radius, a: p.acceleration }];
  if (kind === 'vortex') terrain.vortices = [{ ...place.point, r: p.radius, a: p.acceleration, sense: resolved.sense === 'cw' ? 1 : -1 }];
  if (kind === 'silk') terrain.vortices = [-0.16, 0, 0.16].map((along, i) => silkVortex(place, along, p, i));
  if (kind === 'quake') terrain.forces = [{ x: place.direction.x * 0.173 * p.factor, y: place.direction.y * 0.173 * p.factor, window: { start: 0, duration: p.time } }];
  if (kind === 'bumper' && place.legal(place.point)) segments.push(place.segmentAt(place.point));
  return { terrain, segments };
}

/** Railcraft: which stretch of which cushion the cast covers. */
function railPlacement(p: Record<string, number>, place: ResolvedPlacement, cast: SkillCast) {
  const { table, desired, point } = place;
  const index = cast.rail && Number.isInteger(cast.rail.index) ? cast.rail.index : table.segments.reduce((best, s, i, all) => segmentDistance(point.x, point.y, s) < segmentDistance(point.x, point.y, all[best]) ? i : best, 0);
  const rail = table.segments[Math.max(0, Math.min(table.segments.length - 1, index))];
  const length = Math.hypot(rail.bx - rail.ax, rail.by - rail.ay);
  const half = Math.min(0.5, p.length / length / 2);
  const pos = Math.max(half, Math.min(1 - half, cast.rail?.position ?? ((desired.x - rail.ax) * (rail.bx - rail.ax) + (desired.y - rail.ay) * (rail.by - rail.ay)) / (length * length)));
  const at = (u: number) => ({ x: rail.ax + (rail.bx - rail.ax) * u, y: rail.ay + (rail.by - rail.ay) * u });
  return { index, pos, a: at(pos - half), b: at(pos + half) };
}

/** Sect geometry drawn on top of a cast, from the same physical primitives. */
interface CastGeometry {
  kind: SkillKind;
  tier: number;
  table: TableGeom;
  balls: Ball[];
  cast: SkillCast;
  terrain: Terrain;
  segments: Segment[];
  ult?: UltId;
  shape?: SkillShape;
}

/** Drawing primitives every sect's geometry is built from, around the cast point. */
interface GeometryKit {
  tier: number;
  table: TableGeom;
  terrain: Terrain;
  segments: Segment[];
  point: { x: number; y: number };
  direction: { x: number; y: number };
  /** Point `along` the cast direction and `across` it, from the cast point. */
  at: (along: number, across?: number) => { x: number; y: number };
  patch: (q: { x: number; y: number }, r: number, roll: number, spin?: number) => void;
  well: (q: { x: number; y: number }, r?: number) => void;
  obstacle: (a: { x: number; y: number }, b: { x: number; y: number }) => void;
  sense: 1 | -1;
}

/** One sect's geometry for one skill kind, keyed by ultimate or fixed shape. */
const SECT_GEOMETRY: Partial<Record<SkillKind, Partial<Record<UltId | SkillShape, (g: GeometryKit) => void>>>> = {
  wind: { hoalinh: hoalinhWind },
  slick: { bangphach: bangphachSlick },
  bumper: { thienco: thiencoBumper, vanthu: rootsBumper, roots: rootsBumper, uminh: gateBumper, gate: gateBumper },
  spinwash: { docvu: docvuSpinwash },
  railcraft: { hailong: hailongRailcraft },
  well: { tinhtu: tinhtuWell, hukhong: rimWells, rim: rimWells },
  sand: { kimsa: kimsaSand },
  vortex: { thienhuong: thienhuongVortex },
};

function applyGeometry(g: CastGeometry): void {
  const { kind, table, cast, terrain, segments, ult, shape } = g;
  const p = cast.point!, d = cast.direction!, n = { x: -d.y, y: d.x };
  const at = (along: number, across = 0) => ({ x: p.x + d.x * along + n.x * across, y: p.y + d.y * along + n.y * across });
  const kit: GeometryKit = {
    tier: g.tier, table, terrain, segments, point: p, direction: d, at, sense: cast.sense === 'cw' ? 1 : -1,
    patch: (q, r, roll, spin = 1) => {
      if (insideCloth(table, q, r)) (terrain.patches ??= []).push({ ...q, r, roll, slide: roll, spin });
    },
    well: (q, r = 0.22) => {
      if (insideCloth(table, q)) (terrain.wells ??= []).push({ ...q, r, a: 0.025 + g.tier * 0.002 });
    },
    obstacle: (a, b) => {
      segments.push({ ax: a.x, ay: a.y, bx: b.x, by: b.y });
    },
  };
  const draw = sectGeometry(kind, ult, shape);
  if (draw) draw(kit);
  fitSegments(g);
}

/** Which sect geometry applies: the ultimate's own if any, else the skill's fixed shape. */
function sectGeometry(kind: SkillKind, ult: UltId | undefined, shape: SkillShape | undefined) {
  const byKind = SECT_GEOMETRY[kind];
  if (!byKind) return undefined;
  return (ult && byKind[ult]) || (shape && byKind[shape]);
}

/** True when the point stays `r` inside the cloth rails. */
function insideCloth(table: TableGeom, q: { x: number; y: number }, r = 0): boolean {
  return Math.abs(q.x) + r < table.L / 2 && Math.abs(q.y) + r < table.W / 2;
}

/** Hoà Linh: two opposing gusts along the cast direction. */
function hoalinhWind({ direction: d, terrain, at }: GeometryKit) {
  delete terrain.force;
  terrain.forces = [-1, 1].map(sign => ({ x: d.x * 0.035 * sign, y: d.y * 0.035 * sign, region: { ...at(0, sign * 0.13), r: 0.13 } }));
}

/** Băng Phạch: a slick lane between two sand bars. */
function bangphachSlick({ terrain, at, patch }: GeometryKit) {
  terrain.patches = [];
  for (const a of [-0.15, 0, 0.15]) patch(at(a), 0.085, 0.55);
  patch(at(0.3), 0.09, 1.8);
  patch(at(-0.3), 0.09, 1.8);
}

/** Thiên Cơ: a chevron of bumpers. */
function thiencoBumper({ segments, at, obstacle }: GeometryKit) {
  segments.length = 0;
  obstacle(at(-0.14, -0.12), at(-0.04, 0.04));
  obstacle(at(0.04, 0.04), at(0.14, -0.12));
}

/** Độc Vụ: a ring of spin-washing puddles around a sticky centre. */
function docvuSpinwash({ terrain, at, patch }: GeometryKit) {
  terrain.patches = [];
  for (let i = 0; i < 8; i++) {
    const angle = i * Math.PI / 4;
    patch(at(Math.cos(angle) * 0.17, Math.sin(angle) * 0.17), 0.075, 1, 2.3);
  }
  patch(at(0), 0.075, 0.55, 2.8);
}

/** Hải Long: a following current plus one well. */
function hailongRailcraft({ direction: d, point: p, terrain, at, well }: GeometryKit) {
  delete terrain.force;
  terrain.forces = [{ x: d.x * 0.045, y: d.y * 0.045, region: { ...p, r: 0.28 } }];
  well(at(0.23), 0.2);
}

/** Tinh Tự: twin wells. */
function tinhtuWell({ at, well }: GeometryKit) {
  well(at(-0.18));
  well(at(0.18));
}

/** Kim Sa: a sand fence with a ball-wide gap in the middle. */
function kimsaSand({ terrain, at, patch }: GeometryKit) {
  terrain.patches = [];
  // The central gap remains a full ball diameter wide.
  for (const a of [-0.27, -0.16, 0.16, 0.27]) patch(at(a), 0.065, 2.1);
}

/** Vạn Thụ: roots in a broken line. */
function rootsBumper({ segments, at, obstacle }: GeometryKit) {
  segments.length = 0;
  obstacle(at(-0.15, -0.13), at(0, 0));
  obstacle(at(0, 0), at(0.15, -0.13));
}

/** Ư Minh: a gate of two bars. */
function gateBumper({ segments, at, obstacle }: GeometryKit) {
  segments.length = 0;
  obstacle(at(-0.1, -0.16), at(0.1, -0.16));
  obstacle(at(-0.1, 0.16), at(0.1, 0.16));
}

/** Thiên Hương: two counter-spinning vortices. */
function thienhuongVortex({ terrain, at, sense }: GeometryKit) {
  terrain.vortices = [-1, 1].map(sign => ({ ...at(sign * 0.15), r: 0.18, a: 0.035, sense: sense * sign }));
}

/** Hư Không: a well just inside every pocket mouth. */
function rimWells({ table, point: p, terrain, well }: GeometryKit) {
  terrain.wells = [];
  if (table.pockets.length) {
    for (const pk of table.pockets) {
      const length = Math.hypot(pk.x, pk.y);
      well({ x: pk.x * (1 - table.R * 2 / length), y: pk.y * (1 - table.R * 2 / length) }, 0.19);
    }
  } else {
    well(p, 0.28);
  }
}

/** Move the whole segment set to the nearest spot where it fits, or drop it. */
function fitSegments(g: CastGeometry): void {
  const { table, balls, cast, segments } = g;
  if (!segments.length) return;
  const p = cast.point!;
  const originals = segments.map(s => ({ ...s }));
  const translate = (x: number, y: number): Segment[] => originals.map(s => ({ ax: s.ax + x, ay: s.ay + y, bx: s.bx + x, by: s.by + y }));
  const legal = (ss: Segment[]) => ss.every(s => insideCloth(table, { x: s.ax, y: s.ay }, table.R) && insideCloth(table, { x: s.bx, y: s.by }, table.R)
    && balls.every(b => !b.onTable || segmentDistance(b.x, b.y, s) > table.R * 2.1)
    && table.pockets.every(pk => segmentDistance(pk.x, pk.y, s) > pk.r + table.R * 2));
  if (legal(segments)) return;
  const spot = nearestLegalPoint(table, 0.3, p, (x, y) => legal(translate(x - p.x, y - p.y)));
  if (!spot) {
    segments.splice(0, segments.length);
    return;
  }
  const replacement = translate(spot.x - p.x, spot.y - p.y);
  segments.splice(0, segments.length, ...replacement);
  cast.point = { x: p.x + replacement[0].ax - originals[0].ax, y: p.y + replacement[0].ay - originals[0].ay };
}

/** Contact-triggered skill impulse, shared by live play, prediction and AI. */
export function applySkillBlast(balls: Ball[], at: { x: number; y: number }, blast: { radius: number; force: number; direction?: { x: number; y: number } }) {
  const length = blast.direction ? Math.hypot(blast.direction.x, blast.direction.y) : 0;
  const axis = blast.direction && length > 0 ? { x: blast.direction.x / length, y: blast.direction.y / length } : null;
  for (const b of balls) {
    if (!b.onTable) continue;
    const dx = b.x - at.x, dy = b.y - at.y, distance = Math.hypot(dx, dy);
    if (distance < 1e-6 || distance > blast.radius) continue;
    if (axis && (dx * axis.x + dy * axis.y) / distance < Math.SQRT1_2) continue;
    const impulse = (1 - distance / blast.radius) * blast.force;
    b.vx += (axis?.x ?? dx / distance) * impulse;
    b.vy += (axis?.y ?? dy / distance) * impulse;
  }
}
