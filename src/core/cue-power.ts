import type { TableKind } from './table';

/** Slowest stroke the meter can produce (m/s). */
const V_MIN = 0.22;

/** Top cue-ball speed for a cue's power stat (1–5). */
export function maxSpeed(kind: TableKind, powerStat: number): number {
  return kind === 'carom' ? 5.6 + 0.4 * powerStat : 6.3 + 0.45 * powerStat;
}

/** Meter position (0..1) to launch speed. The curve gives fine control on soft shots. */
export function powerToSpeed(power: number, vmax: number): number {
  const p = Math.max(0, Math.min(1, power));
  return V_MIN + (vmax - V_MIN) * Math.pow(p, 1.6);
}

export function speedToPower(speed: number, vmax: number): number {
  const k = (speed - V_MIN) / (vmax - V_MIN);
  return Math.max(0, Math.min(1, Math.pow(Math.max(0, k), 1 / 1.6)));
}
