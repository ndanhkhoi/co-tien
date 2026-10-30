import type { Sprite } from 'pixi.js';
import type { Ball } from '../core/physics';
import type { Match } from '../game/match';
import type { BallMesh } from './ball-mesh';

export interface BallMove { id: number; from: { x: number; y: number }; to: { x: number; y: number } }

interface Slide {
  mesh: BallMesh;
  shadow: Sprite;
  from: { x: number; y: number };
  to: { x: number; y: number };
  t: number;
}

/** Short ink slide for discrete ball moves; the match state is already final. */
export class BallSlides {
  private slides: Slide[] = [];

  get active(): boolean {
    return this.slides.length > 0;
  }

  clear(): void {
    this.slides = [];
  }

  start(
    match: Match,
    moves: BallMove[],
    meshes: Map<number, BallMesh>,
    shadows: Map<number, Sprite>,
  ): void {
    if (reducedMotion() || this.slides.length) return;
    for (const move of moves) this.push(match, move, meshes.get(move.id), shadows.get(move.id));
  }

  update(match: Match, dt: number): void {
    if (!this.slides.length) return;
    const R = match.table.R;
    this.slides = this.slides.filter((s) => {
      s.t += dt / 0.36;
      const k = Math.min(1, s.t);
      const ease = 1 - (1 - k) * (1 - k);
      const x = s.from.x + (s.to.x - s.from.x) * ease;
      const y = s.from.y + (s.to.y - s.from.y) * ease;
      s.mesh.mesh.position.set(x, y);
      s.mesh.mesh.scale.set(R);
      s.shadow.position.set(x + R * 0.28, y + R * 0.38);
      return k < 1;
    });
  }

  private push(match: Match, move: BallMove, mesh?: BallMesh, shadow?: Sprite): void {
    if (!mesh || !shadow || !this.rests(match.balls, move)) return;
    this.slides.push({ mesh, shadow, from: move.from, to: move.to, t: 0 });
  }

  private rests(balls: Ball[], move: BallMove): boolean {
    const ball = balls.find((b) => b.id === move.id);
    return !!ball && Math.hypot(ball.vx, ball.vy) === 0;
  }
}

function reducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
