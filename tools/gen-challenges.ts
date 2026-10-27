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
  const sum = summarize(ev, 0, false, null, false, [], 0);
  const def = { goal } as ChallengeDef;
  return judgeChallenge(def, sum, balls).ok;
}

/** Search a fine angle sweep for each power/spin; return the widest contiguous winning window. */
function solve(t: TableGeom, layout: [number, number, number][], goal: ChallengeGoal, center: number, span: number, powers: number[], spins: [number, number][], step = 0.05) {
  let best: { shot: [number, number, number, number]; window: number } | null = null;
  for (const p of powers) {
    for (const [sd, vt] of spins) {
      let runStart = -1;
      let prevOk = false;
      for (let a = -span; a <= span + 1e-9; a += step) {
        const ok = run(t, layout, [center + a * DEG, p, sd, vt], goal);
        if (ok && !prevOk) runStart = a;
        if ((!ok || a + step > span) && prevOk) {
          const end = ok ? a : a - step;
          const width = end - runStart + step;
          if (!best || width > best.window) best = { shot: [center + ((runStart + end) / 2) * DEG, p, sd, vt], window: width };
        }
        prevOk = ok;
      }
    }
  }
  return best;
}

const free = (balls: [number, number, number][], x: number, y: number, t: TableGeom, gap = 0.01) =>
  Math.abs(x) < t.L / 2 - t.R - 0.01 && Math.abs(y) < t.W / 2 - t.R - 0.01 &&
  balls.every(([, bx, by]) => Math.hypot(bx - x, by - y) > 2 * t.R + gap);

function poolCandidate(rng: Rng, family: ChallengeFamily): { layout: [number, number, number][]; goal: ChallengeGoal; center: number; span: number } | null {
  const t = pool;
  const R = t.R;
  const pocket = rng.int(0, 5);
  const pk = t.pockets[pocket];
  const ball = rng.int(1, 15);
  const layout: [number, number, number][] = [];
  // Object ball somewhere with a clear line to the pocket.
  const dist = family === 'straight' ? rng.range(0.25, 0.9) : rng.range(0.2, 0.75);
  const pickDir = () => {
    const toCentre = Math.atan2(-pk.ay, -pk.ax);
    const lim = pk.kind === 'side' ? 35 : 38;
    return toCentre + rng.range(-lim, lim) * DEG;
  };
  if (family === 'bank') {
    // Object ball near the opposite long rail, banking across the table into a side/corner.
    const ox = rng.range(-t.L / 2 + 0.25, t.L / 2 - 0.25);
    const oy = (pk.ay > 0 ? -1 : 1) * (t.W / 2 - R - rng.range(0.03, 0.18));
    if (!free(layout, ox, oy, t)) return null;
    layout.push([ball, ox, oy]);
    const mirrorY = 2 * (pk.ay > 0 ? -t.W / 2 + R : t.W / 2 - R) - pk.ay;
    const ang = Math.atan2(mirrorY - oy, pk.ax - ox);
    const gx = ox - Math.cos(ang) * 2 * R;
    const gy = oy - Math.sin(ang) * 2 * R;
    const cd = rng.range(0.3, 0.8);
    const ca = ang + Math.PI + rng.range(-25, 25) * DEG;
    const cx = gx + Math.cos(ca) * cd;
    const cy = gy + Math.sin(ca) * cd;
    if (!free(layout, cx, cy, t, 0.03)) return null;
    layout.unshift([0, cx, cy]);
    return { layout, goal: { kind: 'pot', ball, pocket }, center: Math.atan2(gy - cy, gx - cx), span: 2.5 };
  }
  const dir = pickDir();
  const ox = pk.ax + Math.cos(dir) * dist;
  const oy = pk.ay + Math.sin(dir) * dist;
  if (!free(layout, ox, oy, t, 0.05)) return null;
  layout.push([ball, ox, oy]);
  const toPocket = Math.atan2(pk.ay - oy, pk.ax - ox);
  const gx = ox - Math.cos(toPocket) * 2 * R;
  const gy = oy - Math.sin(toPocket) * 2 * R;
  const cut = family === 'straight' ? rng.range(-8, 8) : (rng.next() < 0.5 ? -1 : 1) * rng.range(18, 62);
  const cd = rng.range(0.25, 0.85);
  const ca = toPocket + Math.PI + cut * DEG;
  const cx = gx + Math.cos(ca) * cd;
  const cy = gy + Math.sin(ca) * cd;
  if (!free(layout, cx, cy, t, 0.03)) return null;
  layout.unshift([0, cx, cy]);
  // A few decoys that stay out of the shot lines.
  const decoys = family === 'straight' ? rng.int(0, 2) : rng.int(1, 4);
  for (let i = 0; i < decoys; i++) {
    const id = rng.int(1, 15);
    if (layout.some((b) => b[0] === id)) continue;
    const x = rng.range(-t.L / 2 + 0.1, t.L / 2 - 0.1);
    const y = rng.range(-t.W / 2 + 0.1, t.W / 2 - 0.1);
    const nearLine = (ax: number, ay: number, bx: number, by: number) => {
      const ex = bx - ax, ey = by - ay;
      const l2 = ex * ex + ey * ey;
      const k = Math.max(0, Math.min(1, ((x - ax) * ex + (y - ay) * ey) / l2));
      return Math.hypot(x - ax - ex * k, y - ay - ey * k) < 4 * R;
    };
    if (!free(layout, x, y, t, 0.05) || nearLine(cx, cy, gx, gy) || nearLine(ox, oy, pk.ax, pk.ay)) continue;
    layout.push([id, x, y]);
  }
  const center = Math.atan2(gy - cy, gx - cx);
  if (family === 'position') {
    // Zone placed where a natural follow/draw/stun shot would send the cue ball.
    return { layout, goal: { kind: 'pot-zone', ball, pocket, zone: [0, 0, 0] }, center, span: 1.2 };
  }
  return { layout, goal: { kind: 'pot', ball, pocket }, center, span: family === 'straight' ? 1.2 : 1.6 };
}

function caromCandidate(rng: Rng, three: boolean) {
  const t = carom;
  const layout: [number, number, number][] = [];
  for (const id of [0, 1, 2]) {
    for (let k = 0; k < 50; k++) {
      const x = rng.range(-t.L / 2 + 0.12, t.L / 2 - 0.12);
      const y = rng.range(-t.W / 2 + 0.12, t.W / 2 - 0.12);
      if (free(layout, x, y, t, 0.15)) {
        layout.push([id, x, y]);
        break;
      }
    }
  }
  return layout.length === 3 ? { layout, goal: { kind: 'carom', three } as ChallengeGoal } : null;
}

function generate(): ChallengeDef[] {
  const out: ChallengeDef[] = [];
  const rng = new Rng(20261027);
  const families: ChallengeFamily[] = ['straight', 'cut', 'bank', 'position'];
  for (const family of families) {
    const found: ChallengeDef[] = [];
    let tries = 0;
    while (found.length < 18 && tries++ < 4000) {
      const cand = poolCandidate(rng, family);
      if (!cand) continue;
      if (family === 'position') {
        // Solve the pot first, then put the zone where the cue ball stops for one solution.
        const sol = solve(pool, cand.layout, { kind: 'pot', ball: (cand.goal as { ball: number }).ball, pocket: (cand.goal as { pocket: number }).pocket }, cand.center, cand.span, [0.32, 0.45], [[0, -0.8], [0, 0.7], [0, -0.3]]);
        if (!sol || sol.window < 0.3) continue;
        const balls = cand.layout.map(([id, x, y]) => makeBall(id, x, y));
        strike(balls[0], pool.R, { angle: sol.shot[0], speed: powerToSpeed(sol.shot[1], maxSpeed('pool', REFERENCE_POWER)), side: sol.shot[2], vert: sol.shot[3] });
        simulate({ table: pool, balls, params: DEFAULT_PHYS });
        const cue = balls[0];
        if (!cue.onTable) continue;
        const zr = rng.range(0.1, 0.16);
        const goal: ChallengeGoal = { ...(cand.goal as { kind: 'pot-zone'; ball: number; pocket: number }), zone: [+cue.x.toFixed(4), +cue.y.toFixed(4), +zr.toFixed(3)] };
        const check = solve(pool, cand.layout, goal, sol.shot[0], 0.6, [sol.shot[1]], [[sol.shot[2], sol.shot[3]]], 0.05);
        if (!check || check.window < 0.2) continue;
        found.push({ id: '', family, table: 'pool', balls: round(cand.layout), goal, solution: round4(check.shot), window: +check.window.toFixed(2) });
        continue;
      }
      const powers = family === 'bank' ? [0.4, 0.55] : [0.3, 0.45];
      const sol = solve(pool, cand.layout, cand.goal, cand.center, cand.span, powers, [[0, 0], [0, -0.4]]);
      const minW = family === 'straight' ? 0.35 : 0.2;
      if (!sol || sol.window < minW) continue;
      found.push({ id: '', family, table: 'pool', balls: round(cand.layout), goal: cand.goal, solution: round4(sol.shot), window: +sol.window.toFixed(2) });
    }
    out.push(...pickSpread(found, 12));
    console.log(family, found.length, 'candidates');
  }
  const caromFound: ChallengeDef[] = [];
  let tries = 0;
  while (caromFound.length < 16 && tries++ < 1500) {
    const three = caromFound.length >= 8;
    const cand = caromCandidate(rng, three);
    if (!cand) continue;
    let best: ChallengeDef | null = null;
    for (let a = 0; a < 360 && !best; a += 3) {
      for (const p of three ? [0.6, 0.75] : [0.35, 0.5]) {
        for (const sd of three ? [-0.6, 0.6] : [0]) {
          if (run(carom, cand.layout, [a * DEG, p, sd, 0.3], cand.goal)) {
            const sol = solve(carom, cand.layout, cand.goal, a * DEG, 2, [p], [[sd, 0.3]], 0.1);
            if (sol && sol.window >= (three ? 0.4 : 0.8)) {
              best = { id: '', family: 'carom', table: 'carom', balls: round(cand.layout), goal: cand.goal, solution: round4(sol.shot), window: +sol.window.toFixed(2) };
              break;
            }
          }
        }
        if (best) break;
      }
    }
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
