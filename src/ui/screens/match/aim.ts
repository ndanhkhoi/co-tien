import type { Match } from '../../../game/match';
import type { MatchCtx } from './context';

const DEG = Math.PI / 180;
type Ball = ReturnType<Match['cueBall']>;

export function createAim(ctx: MatchCtx, deps: {
  canAdjustAim(): boolean;
  placingNow(): boolean;
}): {
  aimAt(b: { x: number; y: number }): void;
  targetList(): Ball[];
  aimFirstTarget(): void;
  switchTarget(): void;
  rotate(deg: number): void;
  rotateCast(deg: number): void;
  nudgeCue(dx: number, dy: number, metres: number): void;
  wobbleAmp(): number;
  wobbleNow(): number;
  guideScale(): number;
} {
  const { aim, flags, power, match, view, skill } = ctx;
  const aimAt = (b: { x: number; y: number }) => {
    const cue = match.cueBall();
    if (Math.hypot(b.x - cue.x, b.y - cue.y) < 1e-6) return;
    aim.angle = Math.atan2(b.y - cue.y, b.x - cue.x);
  };
  const targetList = () => {
    const cue = match.cueBall();
    const legal = match.legalTargets();
    const live = match.balls.filter((b) => b.onTable && b.id !== cue.id);
    const pool = legal.length ? live.filter((b) => legal.includes(b.id)) : live;
    const list = pool.length ? pool : live;
    const d = (b: Ball) => Math.hypot(b.x - cue.x, b.y - cue.y);
    return list.sort((a, b) => (legal.length ? legal.indexOf(a.id) - legal.indexOf(b.id) : 0) || d(a) - d(b));
  };
  const aimFirstTarget = () => {
    const list = targetList();
    flags.targetIdx = 0;
    if (list[0]) aimAt(list[0]);
  };
  const switchTarget = () => {
    if (!deps.canAdjustAim()) return;
    const list = targetList();
    if (!list.length) return;
    flags.targetIdx = (flags.targetIdx + 1) % list.length;
    const b = list[flags.targetIdx];
    aimAt(b);
    view.ring(b.x, b.y, 0xffffff, 0.02);
  };
  const rotate = (deg: number) => {
    if (!deps.canAdjustAim()) return;
    aim.angle += deg * DEG;
  };
  const rotateCast = (deg: number) => {
    if (!deps.placingNow() || !skill.placement) return;
    ctx.skill.rotateCast(deg);
  };
  const nudgeCue = (dx: number, dy: number, metres: number) => {
    if (!deps.placingNow()) return;
    if (skill.placement) {
      const p = skill.placement.cast.point!;
      ctx.skill.moveCast(p.x + dx * metres, p.y + dy * metres);
      return;
    }
    const c = match.cueBall();
    match.placeCue(c.x + dx * metres, c.y + dy * metres);
  };
  const wobbleAmp = () => {
    const control = match.current.cue.control;
    const base = 0.0034 * (1.3 - control * 0.2);
    const fatigue = 1 + Math.max(0, power.holdT - 1.8) * 0.75;
    return match.aimBand(aim.angle, base * (0.2 + 1.7 * (power.charging ? power.power : power.preset) ** 2) * fatigue * match.tremorNow);
  };
  const wobbleNow = () => {
    if (!power.charging) return 0;
    const t = performance.now() / 1000;
    return wobbleAmp() * (0.62 * Math.sin(t * 7.3) + 0.38 * Math.sin(t * 13.1 + 1.7));
  };
  return { aimAt, targetList, aimFirstTarget, switchTarget, rotate, rotateCast, nudgeCue, wobbleAmp, wobbleNow,
    guideScale: () => 0.55 + 0.12 * match.current.cue.aim };
}
