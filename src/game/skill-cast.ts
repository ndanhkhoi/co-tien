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
export const PLACED_KINDS: SkillKind[] = ['slick', 'sand', 'bumper', 'railcraft', 'wind', 'well', 'spinwash', 'vortex'];

export function mergeTerrain(...sources: (Terrain | null | undefined)[]): Terrain {
  return {
    forces: sources.flatMap(t => [...(t?.forces ?? []), ...(t?.force ? [{ ...t.force, gust: t.gust }] : [])]),
    patches: sources.flatMap(t => t?.patches ?? []),
    wells: sources.flatMap(t => t?.wells ?? []),
    vortices: sources.flatMap(t => t?.vortices ?? []),
    rails: sources.flatMap(t => t?.rails ?? []),
  };
}

/** Pure builder used by match, placement preview and worker planning. */
export function buildCast(kind: SkillKind, tier: number, slot: number, table: TableGeom, balls: Ball[], cueId: number, cast: SkillCast = {}, ult?: UltId, shape?: SkillShape): CastEffect {
  const cue = balls.find(b => b.id === cueId)!;
  const target = balls.filter(b => b.onTable && b.id !== cueId).sort((a, b) => Math.hypot(a.x - cue.x, a.y - cue.y) - Math.hypot(b.x - cue.x, b.y - cue.y))[0] ?? { x: 0, y: 0 };
  const dir = cast.direction && Number.isFinite(cast.direction.x) && Number.isFinite(cast.direction.y) ? cast.direction : { x: target.x - cue.x, y: target.y - cue.y };
  const norm = Math.hypot(dir.x, dir.y) || 1;
  const direction = { x: dir.x / norm || 0, y: dir.y / norm || 0 };
  if (!direction.x && !direction.y) direction.x = 1;
  const p = skillPower(kind, tier) as Record<string, number>;
  const margin = Math.max(p.radius ?? 0, (p.length ?? 0) / 2, table.R * 2, slot === 2 && ult ? 0.35 : shape ? 0.25 : 0);
  const clamp = (v: number, span: number) => Math.max(-span / 2 + margin, Math.min(span / 2 - margin, Number.isFinite(v) ? v : 0));
  const desired = cast.point ?? { x: (cue.x + target.x) / 2, y: (cue.y + target.y) / 2 };
  let point = { x: clamp(desired.x, table.L), y: clamp(desired.y, table.W) };
  const segmentAt = (pt: typeof point): Segment => ({ ax: pt.x - direction.x * p.length / 2, ay: pt.y - direction.y * p.length / 2, bx: pt.x + direction.x * p.length / 2, by: pt.y + direction.y * p.length / 2 });
  const legal = (pt: typeof point) => balls.every(b => !b.onTable || (kind === 'bumper' ? segmentDistance(b.x, b.y, segmentAt(pt)) : Math.hypot(pt.x - b.x, pt.y - b.y)) > table.R * 2.1)
    && (kind !== 'bumper' || table.pockets.every(pk => segmentDistance(pk.x, pk.y, segmentAt(pt)) > pk.r + table.R * 2));
  // Deterministic nearest legal centre; a short isolated bumper cannot partition the cloth.
  if (!legal(point)) {
    let best = Infinity;
    for (let x = -table.L / 2 + margin; x <= table.L / 2 - margin; x += table.R) {
      for (let y = -table.W / 2 + margin; y <= table.W / 2 - margin; y += table.R) {
        const d = Math.hypot(x - desired.x, y - desired.y);
        if (d < best && legal({ x, y })) { point = { x, y }; best = d; }
      }
    }
  }
  const resolved: SkillCast = { ...cast, point, direction, sense: cast.sense ?? 'cw', hardness: cast.hardness ?? 'soft' };
  const terrain: Terrain = {};
  const segments: Segment[] = [];
  if (kind === 'slick' || kind === 'sand' || kind === 'spinwash') terrain.patches = [{ ...point, r: p.radius, roll: kind === 'spinwash' ? 1 : p.friction, slide: p.friction, spin: kind === 'spinwash' ? p.friction : 1 }];
  if (kind === 'wind') terrain.force = { x: direction.x * p.acceleration, y: direction.y * p.acceleration };
  if (kind === 'well') terrain.wells = [{ ...point, r: p.radius, a: p.acceleration }];
  if (kind === 'vortex') terrain.vortices = [{ ...point, r: p.radius, a: p.acceleration, sense: resolved.sense === 'cw' ? 1 : -1 }];
  if (kind === 'bumper' && legal(point)) segments.push(segmentAt(point));
  if (kind === 'railcraft') {
    const index = cast.rail && Number.isInteger(cast.rail.index) ? cast.rail.index : table.segments.reduce((best, s, i, all) => segmentDistance(point.x, point.y, s) < segmentDistance(point.x, point.y, all[best]) ? i : best, 0);
    const rail = table.segments[Math.max(0, Math.min(table.segments.length - 1, index))];
    const length = Math.hypot(rail.bx - rail.ax, rail.by - rail.ay);
    const half = Math.min(0.5, p.length / length / 2);
    const pos = Math.max(half, Math.min(1 - half, cast.rail?.position ?? ((desired.x - rail.ax) * (rail.bx - rail.ax) + (desired.y - rail.ay) * (rail.by - rail.ay)) / (length * length)));
    const at = (u: number) => ({ x: rail.ax + (rail.bx - rail.ax) * u, y: rail.ay + (rail.by - rail.ay) * u });
    const a = at(pos - half), b = at(pos + half);
    resolved.rail = { index, position: pos };
    terrain.rails = [{ ax: a.x, ay: a.y, bx: b.x, by: b.y, multiplier: 1 + (resolved.hardness === 'hard' ? 1 : -1) * p.restitution }];
  }
  if (slot === 2 && ult || shape) applyGeometry(kind, tier, table, balls, resolved, terrain, segments, slot === 2 ? ult : undefined, shape);
  return { kind, slot, cast: resolved, terrain, segments };
}

/** Compose sect geometry from the same physical primitives used by ordinary casts. */
function applyGeometry(kind: SkillKind, tier: number, table: TableGeom, balls: Ball[], cast: SkillCast, terrain: Terrain, segments: Segment[], ult?: UltId, shape?: SkillShape) {
  const p = cast.point!, d = cast.direction!, n = { x: -d.y, y: d.x };
  const at = (along: number, across = 0) => ({ x: p.x + d.x * along + n.x * across, y: p.y + d.y * along + n.y * across });
  const inside = (q: { x: number; y: number }, r = 0) => Math.abs(q.x) + r < table.L / 2 && Math.abs(q.y) + r < table.W / 2;
  const patch = (along: number, across: number, r: number, roll: number, spin = 1) => {
    const q = at(along, across);
    if (inside(q, r)) (terrain.patches ??= []).push({ ...q, r, roll, slide: roll, spin });
  };
  const well = (q: { x: number; y: number }, r = 0.22) => {
    if (inside(q)) (terrain.wells ??= []).push({ ...q, r, a: 0.025 + tier * 0.002 });
  };
  const obstacle = (a: { x: number; y: number }, b: { x: number; y: number }) => {
    const s = { ax: a.x, ay: a.y, bx: b.x, by: b.y };
    segments.push(s);
  };
  if (kind === 'wind' && ult === 'hoalinh') {
    delete terrain.force;
    terrain.forces = [-1, 1].map(sign => ({ x: d.x * 0.035 * sign, y: d.y * 0.035 * sign, region: { ...at(0, sign * 0.13), r: 0.13 } }));
  }
  if (kind === 'slick' && ult === 'bangphach') {
    terrain.patches = [];
    for (const a of [-0.15, 0, 0.15]) patch(a, 0, 0.085, 0.55);
    patch(0.3, 0, 0.09, 1.8);
    patch(-0.3, 0, 0.09, 1.8);
  }
  if (kind === 'bumper' && ult === 'thienco') {
    segments.length = 0;
    obstacle(at(-0.14, -0.12), at(-0.04, 0.04));
    obstacle(at(0.04, 0.04), at(0.14, -0.12));
  }
  if (kind === 'spinwash' && ult === 'docvu') {
    terrain.patches = [];
    for (let i = 0; i < 8; i++) {
      const angle = i * Math.PI / 4;
      patch(Math.cos(angle) * 0.17, Math.sin(angle) * 0.17, 0.075, 1, 2.3);
    }
    patch(0, 0, 0.075, 0.55, 2.8);
  }
  if (kind === 'railcraft' && ult === 'hailong') {
    delete terrain.force;
    terrain.forces = [{ x: d.x * 0.045, y: d.y * 0.045, region: { ...p, r: 0.28 } }];
    well(at(0.23), 0.2);
  }
  if (kind === 'well' && ult === 'tinhtu') {
    terrain.wells = [];
    well(at(-0.18)); well(at(0.18));
  }
  if (kind === 'sand' && ult === 'kimsa') {
    terrain.patches = [];
    // The central gap remains a full ball diameter wide.
    for (const a of [-0.27, -0.16, 0.16, 0.27]) patch(a, 0, 0.065, 2.1);
  }
  if (kind === 'bumper' && (ult === 'vanthu' || shape === 'roots')) {
    segments.length = 0;
    obstacle(at(-0.15, -0.13), at(0, 0));
    obstacle(at(0, 0), at(0.15, -0.13));
  }
  if (kind === 'bumper' && (ult === 'uminh' || shape === 'gate')) {
    segments.length = 0;
    obstacle(at(-0.1, -0.16), at(0.1, -0.16));
    obstacle(at(-0.1, 0.16), at(0.1, 0.16));
  }
  if (kind === 'vortex' && ult === 'thienhuong') {
    const sense = cast.sense === 'cw' ? 1 : -1;
    terrain.vortices = [-1, 1].map(sign => ({ ...at(sign * 0.15), r: 0.18, a: 0.035, sense: sense * sign }));
  }
  if (kind === 'well' && (ult === 'hukhong' || shape === 'rim')) {
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
  if (segments.length) {
    const originals = segments.map(s => ({ ...s }));
    const translate = (x: number, y: number) => originals.map(s => ({ ax: s.ax + x, ay: s.ay + y, bx: s.bx + x, by: s.by + y }));
    const legal = (ss: Segment[]) => ss.every(s => inside({ x: s.ax, y: s.ay }, table.R) && inside({ x: s.bx, y: s.by }, table.R)
      && balls.every(b => !b.onTable || segmentDistance(b.x, b.y, s) > table.R * 2.1)
      && table.pockets.every(pk => segmentDistance(pk.x, pk.y, s) > pk.r + table.R * 2));
    if (!legal(segments)) {
      let best = Infinity, replacement: Segment[] = [];
      for (let x = -table.L / 2 + 0.3; x < table.L / 2 - 0.3; x += table.R) {
        for (let y = -table.W / 2 + 0.3; y < table.W / 2 - 0.3; y += table.R) {
          const distance = Math.hypot(x - p.x, y - p.y), candidate = translate(x - p.x, y - p.y);
          if (distance < best && legal(candidate)) { best = distance; replacement = candidate; }
        }
      }
      segments.splice(0, segments.length, ...replacement);
      if (replacement.length) {
        cast.point = { x: p.x + replacement[0].ax - originals[0].ax, y: p.y + replacement[0].ay - originals[0].ay };
      }
    }
  }

}

/** Contact-triggered skill impulse, shared by live play, prediction and AI. */
export function applySkillBlast(balls: Ball[], x: number, y: number, radius: number, force: number, direction?: { x: number; y: number }) {
  const length = direction ? Math.hypot(direction.x, direction.y) : 0;
  const axis = direction && length > 0 ? { x: direction.x / length, y: direction.y / length } : null;
  for (const b of balls) {
    if (!b.onTable) continue;
    const dx = b.x - x, dy = b.y - y, distance = Math.hypot(dx, dy);
    if (distance < 1e-6 || distance > radius) continue;
    if (axis && (dx * axis.x + dy * axis.y) / distance < Math.SQRT1_2) continue;
    const impulse = (1 - distance / radius) * force;
    b.vx += (axis?.x ?? dx / distance) * impulse;
    b.vy += (axis?.y ?? dy / distance) * impulse;
  }
}
