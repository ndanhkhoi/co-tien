import { segmentDistance, type Ball, type Terrain } from '../core/physics';
import type { Segment, TableGeom } from '../core/table';
import { skillPower, type SkillKind } from './content/sects';

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
export function buildCast(kind: SkillKind, tier: number, slot: number, table: TableGeom, balls: Ball[], cueId: number, cast: SkillCast = {}): CastEffect {
  const cue = balls.find(b => b.id === cueId)!;
  const target = balls.filter(b => b.onTable && b.id !== cueId).sort((a, b) => Math.hypot(a.x - cue.x, a.y - cue.y) - Math.hypot(b.x - cue.x, b.y - cue.y))[0] ?? { x: 0, y: 0 };
  const dir = cast.direction && Number.isFinite(cast.direction.x) && Number.isFinite(cast.direction.y) ? cast.direction : { x: target.x - cue.x, y: target.y - cue.y };
  const norm = Math.hypot(dir.x, dir.y) || 1;
  const direction = { x: dir.x / norm || 0, y: dir.y / norm || 0 };
  if (!direction.x && !direction.y) direction.x = 1;
  const p = skillPower(kind, tier) as Record<string, number>;
  const margin = Math.max(p.radius ?? 0, (p.length ?? 0) / 2, table.R * 2);
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
  return { kind, slot, cast: resolved, terrain, segments };
}
