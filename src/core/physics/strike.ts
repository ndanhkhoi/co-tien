import type { Ball } from './types';

export interface StrikeParams {
  /** Aim direction (radians). */
  angle: number;
  /** Cue elevation in radians (0–75°). A downward legal strike rebounds from the slate. */
  elevation?: number;
  /** Cue-ball launch speed (m/s). */
  speed: number;
  /** Tip offset normalised to the miscue limit: side (−1 left … 1 right), vert (−1 draw … 1 follow). */
  side: number;
  vert: number;
}

/** Miscue limit as a fraction of R. */
const TIP_LIMIT = 0.5;

function clampedElevation(elevation = 0): number {
  return Math.max(0, Math.min(75 * Math.PI / 180, Number.isFinite(elevation) ? elevation : 0));
}

/** The visible tip-contact circle foreshortens as the cue becomes steep.
 * Offset is measured in the existing face-on spin control; steep strokes therefore
 * need a much smaller offset to retain a predominantly normal, chalked contact.
 */
export function elevatedTipOffset(side: number, vert: number, elevation = 0): number {
  return Math.hypot(side, vert) / Math.cos(clampedElevation(elevation));
}

/** Apply a cue strike to the cue ball. Includes squirt (deflection away from side english). */
export function strike(b: Ball, R: number, s: StrikeParams) {
  const squirt = -s.side * 0.022 * Math.min(1, s.speed / 3);
  const ang = s.angle + squirt;
  const dx = Math.cos(ang);
  const dy = Math.sin(ang);
  const elevation = clampedElevation(s.elevation);
  const horizontal = s.speed * Math.cos(elevation);
  b.vx = dx * horizontal;
  b.vy = dy * horizontal;
  b.z = 0;
  // An elevated cue drives down into the slate; restitution produces the jump.
  // Low cues retain ordinary play rather than bouncing on every stroke.
  const tipOffset = elevatedTipOffset(s.side, s.vert, elevation);
  // Tangential/off-centre impulse goes into spin instead of the slate rebound.
  // Outside the chalk contact envelope no controlled jump impulse is transferred.
  const normalTransfer = Math.max(0, 1 - tipOffset * tipOffset);
  b.vz = elevation > 10 * Math.PI / 180 ? s.speed * Math.sin(elevation) * 0.45 * normalTransfer : 0;
  // Off-centre hit: ω = 5·v·offset / (2R²). Natural roll at vert offset 0.4R.
  const k = (5 * s.speed) / (2 * R * R);
  const vertOff = s.vert * TIP_LIMIT * R;
  const sideOff = s.side * TIP_LIMIT * R;
  b.wx = -k * vertOff * dy;
  b.wy = k * vertOff * dx;
  b.wz = -k * sideOff;
}
