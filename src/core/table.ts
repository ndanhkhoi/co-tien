// Table geometry in metres. Origin at the table centre, x to the right (foot end),
// y downward on screen. Cushion noses are modelled as line segments; a ball touching a
// segment collides as a capsule, which also rounds the pocket jaw points.

export type TableKind = 'pool' | 'carom';

export interface Segment {
  ax: number; ay: number; bx: number; by: number;
}

export interface Pocket {
  /** Capture centre: a ball whose centre comes within `r` of it drops. */
  x: number; y: number; r: number;
  /** Visual hole centre and radius. */
  hx: number; hy: number; hr: number;
  kind: 'corner' | 'side';
  /** Point a shot should aim at to drop a ball cleanly (just inside the mouth). */
  ax: number; ay: number;
  /** Line between the two jaw points (used to seal a pocket). */
  mouth: Segment;
}

export interface TableGeom {
  kind: TableKind;
  /** Playing surface between cushion noses. */
  L: number; W: number;
  /** Ball radius. */
  R: number;
  segments: Segment[];
  pockets: Pocket[];
  headStringX: number;
  headSpot: { x: number; y: number };
  footSpot: { x: number; y: number };
  centerSpot: { x: number; y: number };
  /** Diamond sight positions along the rail caps (x, y) for drawing. */
  diamonds: { x: number; y: number }[];
  /** Visual rail width (cushion + wooden rail) in metres. */
  railWidth: number;
}

export interface PoolSpec {
  L: number; W: number; R: number;
  cornerMouth: number; sideMouth: number;
}

/**
 * Pool table spec: 7-ft playing surface (78 × 39 in). Ball diameter 57.15 mm.
 * Pocket mouths inside the WPA ranges (corner 114.3–117.5 mm, side 127–130.2 mm).
 */
export const POOL_SPEC: PoolSpec = {
  L: 1.981,
  W: 0.991,
  R: 0.028575,
  cornerMouth: 0.1175,
  sideMouth: 0.13,
};

/** UMB match table: 2.84 × 1.42 m playing surface, 61.5 mm balls. */
export const CAROM_SPEC = { L: 2.84, W: 1.42, R: 0.03075 };

function seg(ax: number, ay: number, bx: number, by: number): Segment {
  return { ax, ay, bx, by };
}

function diamondsFor(L: number, W: number, off: number): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (let i = 1; i < 8; i++) {
    if (i === 4) continue; // side pocket position on pool, centre diamond on carom handled by caller
    const x = -L / 2 + (L * i) / 8;
    out.push({ x, y: -W / 2 - off }, { x, y: W / 2 + off });
  }
  for (let i = 1; i < 4; i++) {
    const y = -W / 2 + (W * i) / 4;
    out.push({ x: -L / 2 - off, y }, { x: L / 2 + off, y });
  }
  return out;
}

export function makePoolTable(spec: PoolSpec = POOL_SPEC): TableGeom {
  const { L, W, R } = spec;
  const hl = L / 2;
  const hw = W / 2;
  const c = spec.cornerMouth / Math.SQRT2; // distance from corner to where the cushion nose ends
  const s = spec.sideMouth / 2;
  const jawC = 0.062;
  const jawS = 0.05;
  // Corner jaws bend ~38° away from the rail line (142° mouth angle); side jaws ~76° (104°).
  const ca = (38 * Math.PI) / 180;
  const sa = (76 * Math.PI) / 180;
  const segments: Segment[] = [];

  // Helper adds a cushion with jaws at both ends. Rail runs from p to q along unit u,
  // with outward normal o (pointing away from the playing surface).
  const cushion = (
    px: number, py: number, qx: number, qy: number,
    ox: number, oy: number, angP: number, lenP: number, angQ: number, lenQ: number,
  ) => {
    const len = Math.hypot(qx - px, qy - py);
    const ux = (qx - px) / len;
    const uy = (qy - py) / len;
    segments.push(seg(px, py, qx, qy));
    // Jaw at p heads back along -u bent outward.
    segments.push(seg(px, py, px + (-ux * Math.cos(angP) + ox * Math.sin(angP)) * lenP, py + (-uy * Math.cos(angP) + oy * Math.sin(angP)) * lenP));
    segments.push(seg(qx, qy, qx + (ux * Math.cos(angQ) + ox * Math.sin(angQ)) * lenQ, qy + (uy * Math.cos(angQ) + oy * Math.sin(angQ)) * lenQ));
  };

  // Top long rail, two halves.
  cushion(-hl + c, -hw, -s, -hw, 0, -1, ca, jawC, sa, jawS);
  cushion(s, -hw, hl - c, -hw, 0, -1, sa, jawS, ca, jawC);
  // Bottom long rail.
  cushion(-hl + c, hw, -s, hw, 0, 1, ca, jawC, sa, jawS);
  cushion(s, hw, hl - c, hw, 0, 1, sa, jawS, ca, jawC);
  // Short rails.
  cushion(-hl, -hw + c, -hl, hw - c, -1, 0, ca, jawC, ca, jawC);
  cushion(hl, -hw + c, hl, hw - c, 1, 0, ca, jawC, ca, jawC);

  const pockets: Pocket[] = [];
  const cornerOff = 0.012;
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      pockets.push({
        kind: 'corner',
        x: sx * (hl + cornerOff), y: sy * (hw + cornerOff), r: 0.052,
        hx: sx * (hl + 0.03), hy: sy * (hw + 0.03), hr: 0.062,
        ax: sx * (hl - 0.012), ay: sy * (hw - 0.012),
        mouth: seg(sx * (hl - c), sy * hw, sx * hl, sy * (hw - c)),
      });
    }
  }
  for (const sy of [-1, 1]) {
    pockets.push({
      kind: 'side',
      x: 0, y: sy * (hw + 0.026), r: 0.05,
      hx: 0, hy: sy * (hw + 0.05), hr: 0.06,
      ax: 0, ay: sy * (hw + 0.004),
      mouth: seg(-s, sy * hw, s, sy * hw),
    });
  }
  // Order pockets for UI: top-left, top-mid, top-right, bottom-left, bottom-mid, bottom-right.
  const order = (p: Pocket) => (p.y < 0 ? 0 : 3) + (p.x < -0.01 ? 0 : p.x > 0.01 ? 2 : 1);
  pockets.sort((a, b) => order(a) - order(b));

  // WPA: rail width (nose to outer edge) 4–7.5 in; diamond centres 3 11/16 in from the cushion nose.
  const railWidth = 0.127;
  return {
    kind: 'pool', L, W, R, segments, pockets,
    headStringX: -L / 4,
    headSpot: { x: -L / 4, y: 0 },
    footSpot: { x: L / 4, y: 0 },
    centerSpot: { x: 0, y: 0 },
    diamonds: diamondsFor(L, W, 0.0936),
    railWidth,
  };
}

export function makeCaromTable(): TableGeom {
  const { L, W, R } = CAROM_SPEC;
  const hl = L / 2;
  const hw = W / 2;
  const segments = [
    seg(-hl, -hw, hl, -hw),
    seg(hl, -hw, hl, hw),
    seg(hl, hw, -hl, hw),
    seg(-hl, hw, -hl, -hw),
  ];
  const railWidth = 0.11;
  const off = railWidth * 0.55;
  const diamonds = diamondsFor(L, W, off);
  diamonds.push({ x: 0, y: -hw - off }, { x: 0, y: hw + off });
  return {
    kind: 'carom', L, W, R, segments, pockets: [],
    headStringX: -L / 4,
    headSpot: { x: -L / 4, y: 0 },
    footSpot: { x: L / 4, y: 0 },
    centerSpot: { x: 0, y: 0 },
    diamonds,
    railWidth,
  };
}

/** True when a ball centred at (x, y) lies fully on the playing surface. */
export function insideCloth(t: TableGeom, x: number, y: number, margin = 0): boolean {
  return Math.abs(x) <= t.L / 2 - t.R - margin && Math.abs(y) <= t.W / 2 - t.R - margin;
}
