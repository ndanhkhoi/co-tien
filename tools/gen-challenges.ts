// Generates src/game/content/challenges.json: random layouts per family, kept only when
// a physics search proves a solution whose winning angle window is wide enough to be
// playable. Run with `npm run gen:challenges`.
import { writeFileSync } from 'node:fs';
import { maxSpeed, powerToSpeed } from '../src/core/cue-power';
import { DEFAULT_PHYS, makeBall, simulate, strike, type Ball } from '../src/core/physics';
import { Rng } from '../src/core/rng';
import { summarize } from '../src/core/rules/types';
import { makeCaromTable, makePoolTable, type TableGeom } from '../src/core/table';
import { judgeChallenge, REFERENCE_POWER, type ChallengeDef, type ChallengeFamily, type ChallengeGoal } from '../src/game/content/challenges';

const pool = makePoolTable();
const carom = makeCaromTable();
const DEG = Math.PI / 180;

function run(t: TableGeom, layout: [number, number, number][], shot: [number, number, number, number], goal: ChallengeGoal) {
  const balls: Ball[] = layout.map(([id, x, y]) => makeBall(id, x, y));
  const cue = balls.find((b) => b.id === 0)!;
  strike(cue, t.R, { angle: shot[0], speed: powerToSpeed(shot[1], maxSpeed(t.kind, REFERENCE_POWER)), side: shot[2], vert: shot[3] });
  const ev = simulate({ table: t, balls, params: DEFAULT_PHYS });
  const sum = summarize({ events: ev, cueId: 0, isBreak: false, call: null, pushOut: false, targets: [] });
  const def = { goal } as ChallengeDef;
  return judgeChallenge(def, sum, balls).ok;
}

interface ShotWindow { shot: [number, number, number, number]; window: number }
interface SolveInput {
  t: TableGeom;
  layout: [number, number, number][];
  goal: ChallengeGoal;
  center: number;
  span: number;
  powers: number[];
  spins: [number, number][];
  step?: number;
}

/** Search a fine angle sweep for each power/spin; return the widest contiguous winning window. */
function solve(input: SolveInput): ShotWindow | null {
  const search: AngleSweep = { ...input, p: 0, sd: 0, vt: 0, best: null };
  for (const p of input.powers) {
    search.p = p;
    for (const [sd, vt] of input.spins) {
      search.sd = sd;
      search.vt = vt;
      search.best = sweepPower(search);
    }
  }
  return search.best;
}

interface AngleSweep extends SolveInput {
  p: number;
  sd: number;
  vt: number;
  best: ShotWindow | null;
}

function sweepPower(sweep: AngleSweep): ShotWindow | null {
  let runStart = -1;
  let prevOk = false;
  const { center, span, step = 0.05, t, layout, goal, p, sd, vt } = sweep;
  for (let a = -span; a <= span + 1e-9; a += step) {
    const ok = run(t, layout, [center + a * DEG, p, sd, vt], goal);
    if (ok && !prevOk) runStart = a;
    if ((!ok || a + step > span) && prevOk) sweep.best = widerWindow(sweep, { angle: a, runStart, ok });
    prevOk = ok;
  }
  return sweep.best;
}

function widerWindow(sweep: AngleSweep, state: { angle: number; runStart: number; ok: boolean }): ShotWindow | null {
  const end = state.ok ? state.angle : state.angle - (sweep.step ?? 0.05);
  const width = end - state.runStart + (sweep.step ?? 0.05);
  if (sweep.best && width <= sweep.best.window) return sweep.best;
  const { center, p, sd, vt } = sweep;
  return { shot: [center + ((state.runStart + end) / 2) * DEG, p, sd, vt], window: width };
}

interface FreePoint { balls: [number, number, number][]; x: number; y: number; t: TableGeom; gap?: number }

const free = ({ balls, x, y, t, gap = 0.01 }: FreePoint) =>
  Math.abs(x) < t.L / 2 - t.R - 0.01 && Math.abs(y) < t.W / 2 - t.R - 0.01 &&
  balls.every(([, bx, by]) => Math.hypot(bx - x, by - y) > 2 * t.R + gap);

type PoolCandidate = { layout: [number, number, number][]; goal: ChallengeGoal; center: number; span: number };

interface PoolCandidateInput {
  rng: Rng;
  family: ChallengeFamily;
  pk: TableGeom['pockets'][number];
  pocket: number;
  ball: number;
  layout: [number, number, number][];
}

function bankCandidate(input: PoolCandidateInput) {
  const { rng, pk, ball, pocket, layout } = input;
  const t = pool;
  const R = t.R;
  // Object ball near the opposite long rail, banking across the table into a side/corner.
  const ox = rng.range(-t.L / 2 + 0.25, t.L / 2 - 0.25);
  const oy = (pk.ay > 0 ? -1 : 1) * (t.W / 2 - R - rng.range(0.03, 0.18));
  if (!free({ balls: layout, x: ox, y: oy, t })) return null;
  layout.push([ball, ox, oy]);
  const mirrorY = 2 * (pk.ay > 0 ? -t.W / 2 + R : t.W / 2 - R) - pk.ay;
  const ang = Math.atan2(mirrorY - oy, pk.ax - ox);
  const gx = ox - Math.cos(ang) * 2 * R;
  const gy = oy - Math.sin(ang) * 2 * R;
  const cd = rng.range(0.3, 0.8);
  const ca = ang + Math.PI + rng.range(-25, 25) * DEG;
  const cx = gx + Math.cos(ca) * cd;
  const cy = gy + Math.sin(ca) * cd;
  if (!free({ balls: layout, x: cx, y: cy, t, gap: 0.03 })) return null;
  layout.unshift([0, cx, cy]);
  return { layout, goal: { kind: 'pot', ball, pocket } as ChallengeGoal, center: Math.atan2(gy - cy, gx - cx), span: 2.5 };
}

function poolCandidate(rng: Rng, family: ChallengeFamily): PoolCandidate | null {
  const t = pool;
  const R = t.R;
  const pocket = rng.int(0, 5);
  const pk = t.pockets[pocket];
  const ball = rng.int(1, 15);
  const layout: [number, number, number][] = [];
  const input = { rng, family, pk, pocket, ball, layout };
  // Object ball somewhere with a clear line to the pocket.
  const dist = family === 'straight' ? rng.range(0.25, 0.9) : rng.range(0.2, 0.75);
  const pickDir = () => {
    const lim = pk.kind === 'side' ? 35 : 38;
    return Math.atan2(-pk.ay, -pk.ax) + rng.range(-lim, lim) * DEG;
  };
  if (family === 'bank') return bankCandidate(input);
  const dir = pickDir();
  const ox = pk.ax + Math.cos(dir) * dist;
  const oy = pk.ay + Math.sin(dir) * dist;
  if (!free({ balls: layout, x: ox, y: oy, t, gap: 0.05 })) return null;
  layout.push([ball, ox, oy]);
  const toPocket = Math.atan2(pk.ay - oy, pk.ax - ox);
  const gx = ox - Math.cos(toPocket) * 2 * R;
  const gy = oy - Math.sin(toPocket) * 2 * R;
  const cut = family === 'straight' ? rng.range(-8, 8) : (rng.next() < 0.5 ? -1 : 1) * rng.range(18, 62);
  const cd = rng.range(0.25, 0.85);
  const ca = toPocket + Math.PI + cut * DEG;
  const cx = gx + Math.cos(ca) * cd;
  const cy = gy + Math.sin(ca) * cd;
  if (!free({ balls: layout, x: cx, y: cy, t, gap: 0.03 })) return null;
  layout.unshift([0, cx, cy]);
  const decoys = family === 'straight' ? rng.int(0, 2) : rng.int(1, 4);
  addDecoys({ rng, layout, lines: [[cx, cy, gx, gy], [ox, oy, pk.ax, pk.ay]], count: decoys });
  const center = Math.atan2(gy - cy, gx - cx);
  if (family === 'position') {
    // Zone placed where a natural follow/draw/stun shot would send the cue ball.
    return { layout, goal: { kind: 'pot-zone', ball, pocket, zone: [0, 0, 0] }, center, span: 1.2 };
  }
  return { layout, goal: { kind: 'pot', ball, pocket } as ChallengeGoal, center, span: family === 'straight' ? 1.2 : 1.6 };
}

function caromCandidate(rng: Rng, three: boolean) {
  const t = carom;
  const layout: [number, number, number][] = [];
  for (const id of [0, 1, 2]) {
    for (let k = 0; k < 50; k++) {
      const x = rng.range(-t.L / 2 + 0.12, t.L / 2 - 0.12);
      const y = rng.range(-t.W / 2 + 0.12, t.W / 2 - 0.12);
      if (free({ balls: layout, x, y, t, gap: 0.15 })) {
        layout.push([id, x, y]);
        break;
      }
    }
  }
  return layout.length === 3 ? { layout, goal: { kind: 'carom', three } as ChallengeGoal } : null;
}

interface DecoyInput {
  rng: Rng;
  layout: [number, number, number][];
  lines: [number, number, number, number][];
  count: number;
}

/** A few decoys that stay out of the shot lines. */
function addDecoys(input: DecoyInput): void {
  const t = pool;
  const R = t.R;
  for (let i = 0; i < input.count; i++) {
    const id = input.rng.int(1, 15);
    if (input.layout.some((b) => b[0] === id)) continue;
    const x = input.rng.range(-t.L / 2 + 0.1, t.L / 2 - 0.1);
    const y = input.rng.range(-t.W / 2 + 0.1, t.W / 2 - 0.1);
    if (!free({ balls: input.layout, x, y, t, gap: 0.05 })) continue;
    if (input.lines.some((line) => nearPoint({ x, y, r: R, line }))) continue;
    input.layout.push([id, x, y]);
  }
}

interface NearPoint { x: number; y: number; r: number; line: [number, number, number, number] }

function nearPoint({ x, y, r, line: [ax, ay, bx, by] }: NearPoint): boolean {
  const ex = bx - ax, ey = by - ay;
  const l2 = ex * ex + ey * ey;
  const k = Math.max(0, Math.min(1, ((x - ax) * ex + (y - ay) * ey) / l2));
  return Math.hypot(x - ax - ex * k, y - ay - ey * k) < 4 * r;
}

function poolFamily(rng: Rng, family: ChallengeFamily): ChallengeDef[] {
  const found: ChallengeDef[] = [];
  let tries = 0;
  while (found.length < 18 && tries++ < 4000) {
    const cand = poolCandidate(rng, family);
    if (!cand) continue;
    const def = family === 'position' ? positionChallenge(rng, cand) : potChallenge(family, cand);
    if (def) found.push(def);
  }
  console.log(family, found.length, 'candidates');
  return pickSpread(found, 12);
}

function potChallenge(family: ChallengeFamily, cand: PoolCandidate): ChallengeDef | null {
  const powers = family === 'bank' ? [0.4, 0.55] : [0.3, 0.45];
  const sol = solve({ t: pool, layout: cand.layout, goal: cand.goal, center: cand.center, span: cand.span, powers, spins: [[0, 0], [0, -0.4]] });
  const minW = family === 'straight' ? 0.35 : 0.2;
  if (!sol || sol.window < minW) return null;
  return { id: '', family, table: 'pool', balls: round(cand.layout), goal: cand.goal, solution: round4(sol.shot), window: +sol.window.toFixed(2) };
}

function positionChallenge(rng: Rng, cand: PoolCandidate): ChallengeDef | null {
  // Solve the pot first, then put the zone where a natural follow/draw/stun shot would send the cue ball.
  const potGoal: ChallengeGoal = { kind: 'pot', ball: (cand.goal as { ball: number }).ball, pocket: (cand.goal as { pocket: number }).pocket };
  const sol = solve({ t: pool, layout: cand.layout, goal: potGoal, center: cand.center, span: cand.span, powers: [0.32, 0.45], spins: [[0, -0.8], [0, 0.7], [0, -0.3]] });
  if (!sol || sol.window < 0.3) return null;
  const cue = stoppingCueBall(cand, sol.shot);
  if (!cue?.onTable) return null;
  const zr = rng.range(0.1, 0.16);
  const goal: ChallengeGoal = { ...(cand.goal as { kind: 'pot-zone'; ball: number; pocket: number }), zone: [+cue.x.toFixed(4), +cue.y.toFixed(4), +zr.toFixed(3)] };
  const check = solve({ t: pool, layout: cand.layout, goal, center: sol.shot[0], span: 0.6, powers: [sol.shot[1]], spins: [[sol.shot[2], sol.shot[3]]], step: 0.05 });
  if (!check || check.window < 0.2) return null;
  return { id: '', family: 'position', table: 'pool', balls: round(cand.layout), goal, solution: round4(check.shot), window: +check.window.toFixed(2) };
}

function stoppingCueBall(cand: PoolCandidate, shot: [number, number, number, number]): Ball | undefined {
  const balls = cand.layout.map(([id, x, y]) => makeBall(id, x, y));
  strike(balls[0], pool.R, { angle: shot[0], speed: powerToSpeed(shot[1], maxSpeed('pool', REFERENCE_POWER)), side: shot[2], vert: shot[3] });
  simulate({ table: pool, balls, params: DEFAULT_PHYS });
  return balls[0];
}

function caromChallenge(cand: { layout: [number, number, number][]; goal: ChallengeGoal }, three: boolean): ChallengeDef | null {
  for (let degree = 0; degree < 360; degree += 3) {
    const def = caromShot(cand, three, degree);
    if (def) return def;
  }
  return null;
}

function caromShot(cand: { layout: [number, number, number][]; goal: ChallengeGoal }, three: boolean, degree: number): ChallengeDef | null {
  for (const p of three ? [0.6, 0.75] : [0.35, 0.5]) {
    for (const sd of three ? [-0.6, 0.6] : [0]) {
      const def = checkedCaromShot({ cand, three, degree, power: p, spin: sd });
      if (def) return def;
    }
  }
  return null;
}

interface CaromProbe { cand: { layout: [number, number, number][]; goal: ChallengeGoal }; three: boolean; degree: number; power: number; spin: number }

function checkedCaromShot({ cand, three, degree, power, spin }: CaromProbe): ChallengeDef | null {
  if (!run(carom, cand.layout, [degree * DEG, power, spin, 0.3], cand.goal)) return null;
  const sol = solve({ t: carom, layout: cand.layout, goal: cand.goal, center: degree * DEG, span: 2, powers: [power], spins: [[spin, 0.3]], step: 0.1 });
  if (!sol || sol.window < (three ? 0.4 : 0.8)) return null;
  return { id: '', family: 'carom', table: 'carom', balls: round(cand.layout), goal: cand.goal, solution: round4(sol.shot), window: +sol.window.toFixed(2) };
}

function generate(): ChallengeDef[] {
  const out: ChallengeDef[] = [];
  const rng = new Rng(20261027);
  for (const family of ['straight', 'cut', 'bank', 'position'] as ChallengeFamily[]) out.push(...poolFamily(rng, family));
  const caromFound: ChallengeDef[] = [];
  let tries = 0;
  while (caromFound.length < 16 && tries++ < 1500) {
    const three = caromFound.length >= 8;
    const cand = caromCandidate(rng, three);
    const best = cand ? caromChallenge(cand, three) : null;
    if (best) caromFound.push(best);
  }
  const libre = caromFound.filter((c) => !(c.goal as { three: boolean }).three);
  const threeC = caromFound.filter((c) => (c.goal as { three: boolean }).three);
  out.push(...pickSpread(libre, 6), ...pickSpread(threeC, 6));
  console.log('carom', libre.length, threeC.length);
  // Ids per family in ascending difficulty.
  const counters: Record<string, number> = {};
  for (const c of out) {
    counters[c.family] = (counters[c.family] ?? 0) + 1;
    c.id = `${c.family}-${String(counters[c.family]).padStart(2, '0')}`;
  }
  return out;
}

/** Keep n spread across the difficulty range, easiest (widest window) first. */
function pickSpread(list: ChallengeDef[], n: number): ChallengeDef[] {
  const sorted = [...list].sort((a, b) => b.window - a.window);
  if (sorted.length <= n) return sorted;
  const out: ChallengeDef[] = [];
  for (let i = 0; i < n; i++) out.push(sorted[Math.round((i * (sorted.length - 1)) / (n - 1))]);
  return out;
}

const round = (l: [number, number, number][]) => l.map(([id, x, y]) => [id, +x.toFixed(4), +y.toFixed(4)] as [number, number, number]);
const round4 = (s: [number, number, number, number]) => s.map((v) => +v.toFixed(5)) as [number, number, number, number];

const list = generate();
writeFileSync(new URL('../src/game/content/challenges.json', import.meta.url), JSON.stringify(list, null, 1));
console.log('wrote', list.length, 'challenges');
