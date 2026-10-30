import type { TableGeom } from '../table';

export interface Ball {
  id: number;
  x: number; y: number;
  vx: number; vy: number;
  /** Height above resting centre and vertical velocity (metres, m/s). */
  z?: number; vz?: number;
  /** Angular velocity (rad/s). */
  wx: number; wy: number; wz: number;
  onTable: boolean;
}

export interface PhysParams {
  g: number;
  muSlide: number;
  muRoll: number;
  /** Deceleration of vertical-axis spin (rad/s²). */
  spinDecel: number;
  eBall: number;
  eCushion: number;
  muCushion: number;
  muBall: number;
}

export const DEFAULT_PHYS: PhysParams = {
  g: 9.81,
  muSlide: 0.2,
  muRoll: 0.011,
  spinDecel: 38,
  eBall: 0.94,
  eCushion: 0.82,
  muCushion: 0.17,
  muBall: 0.055,
};

export type PhysEvent =
  | { t: 'ball'; a: number; b: number; speed: number; x: number; y: number }
  | { t: 'cushion'; id: number; speed: number; x: number; y: number }
  | { t: 'off-table'; id: number; speed: number }
  | { t: 'pocket'; id: number; pocket: number; speed: number };

/**
 * Land effects ("Thiên Tượng") as plain mechanics. Forces act only on rolling balls and stay
 * below rolling resistance, so a resting ball stays put, as on a real slightly tilted table.
 */
export interface Terrain {
  /** Uniform acceleration on moving balls (table tilt g·sinθ, or wind), m/s². */
  force?: { x: number; y: number };
  /** Gusts: the force is scaled by (1 − amp + amp·sin(ω·t)). */
  gust?: { amp: number; omega: number };
  /** Friction patches (snow, sand, poison puddles): multipliers inside the circle. */
  patches?: { x: number; y: number; r: number; roll: number; slide: number; spin?: number }[];
  forces?: { x: number; y: number; region?: { x: number; y: number; r: number }; gust?: { amp: number; omega: number }; window?: { start: number; duration: number } }[];
  /** Forces exempt from the below-rolling-resistance rule (tier-5 quake, strictly time-boxed). */
  unclamped?: boolean;
  quakeWindow?: { duration: number };
  vortices?: { x: number; y: number; r: number; a: number; sense: number }[];
  rails?: { ax: number; ay: number; bx: number; by: number; multiplier: number }[];
  /** Point attractors (m/s² at the centre, fading to 0 at radius r). */
  wells?: { x: number; y: number; r: number; a: number }[];
}

export interface SimWorld {
  table: TableGeom;
  balls: Ball[];
  params: PhysParams;
  /** Pockets that currently act as closed (mutator). Index into table.pockets. */
  closedPockets?: number[];
  /** Extra segments (e.g. closed pocket mouths). */
  extraSegments?: { ax: number; ay: number; bx: number; by: number }[];
  /** Pocket capture radius multiplier (skills that widen the pockets). */
  captureScale?: number;
  /** Acceleration (m/s²) pulling slow object balls near an open pocket into it. */
  pocketPull?: number;
  /** Ball id the pull ignores (the shooter's cue ball). */
  pullExempt?: number;
  terrain?: Terrain | null;
  /** Simulation clock for time-varying terrain (s). */
  time?: number;
}

export function makeBall(id: number, x: number, y: number): Ball {
  return { id, x, y, z: 0, vz: 0, vx: 0, vy: 0, wx: 0, wy: 0, wz: 0, onTable: true };
}

export function cloneBalls(balls: Ball[]): Ball[] {
  return balls.map((b) => ({ ...b }));
}
