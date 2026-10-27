import { haptic } from '../platform/device';

export interface JoystickOptions {
  /** Called every animation frame while held, with the shaped stick vector and dt (s). */
  onTick: (x: number, y: number, dt: number) => void;
  onStart?: () => void;
  onEnd?: () => void;
  /** Whether input is accepted right now (e.g. only on your turn). */
  enabled?: () => boolean;
}

/** Below this deflection the stick reads zero, so a resting thumb never drifts the aim. */
const DEAD = 0.08;
/** Response curve: small pushes are very slow (fine control), a full push is fast. */
const CURVE = 2.4;

export function shapeAxis(v: number): number {
  const a = Math.abs(v);
  if (a < DEAD) return 0;
  return Math.sign(v) * Math.pow((a - DEAD) / (1 - DEAD), CURVE);
}

/**
 * Virtual analog stick. Touching anywhere on the pad grabs the knob; the knob follows the
 * finger up to the rim and springs back on release. Output is continuous while held, so the
 * player steers by how far they push instead of having to land on an exact pixel.
 */
export function joystick(base: HTMLElement, opts: JoystickOptions): HTMLElement {
  const knob = document.createElement('div');
  knob.className = 'js-knob';
  base.classList.add('joystick');
  base.append(knob);
  let id: number | null = null;
  let cx = 0;
  let cy = 0;
  let vx = 0;
  let vy = 0;
  let raf = 0;
  let last = 0;
  let edge = false;

  const radius = () => base.clientWidth * 0.38;
  const frame = (t: number) => {
    const dt = Math.min(0.05, (t - last) / 1000);
    last = t;
    if (id !== null) {
      opts.onTick(shapeAxis(vx), shapeAxis(vy), dt);
      raf = requestAnimationFrame(frame);
    }
  };
  const move = (e: PointerEvent) => {
    let dx = e.clientX - cx;
    let dy = e.clientY - cy;
    const r = radius();
    const d = Math.hypot(dx, dy);
    if (d > r) {
      dx = (dx / d) * r;
      dy = (dy / d) * r;
    }
    vx = dx / r;
    vy = dy / r;
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    const atEdge = d >= r;
    if (atEdge && !edge) haptic(6);
    edge = atEdge;
  };
  base.addEventListener('pointerdown', (e) => {
    if (id !== null || (opts.enabled && !opts.enabled())) return;
    const rect = base.getBoundingClientRect();
    cx = rect.left + rect.width / 2;
    cy = rect.top + rect.height / 2;
    id = e.pointerId;
    base.setPointerCapture(e.pointerId);
    base.classList.add('active');
    move(e);
    opts.onStart?.();
    last = performance.now();
    raf = requestAnimationFrame(frame);
  });
  base.addEventListener('pointermove', (e) => {
    if (e.pointerId === id) move(e);
  });
  const end = (e: PointerEvent) => {
    if (e.pointerId !== id) return;
    id = null;
    vx = vy = 0;
    edge = false;
    cancelAnimationFrame(raf);
    knob.style.transform = '';
    base.classList.remove('active');
    opts.onEnd?.();
  };
  base.addEventListener('pointerup', end);
  base.addEventListener('pointercancel', end);
  return base;
}
