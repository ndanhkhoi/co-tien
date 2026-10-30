import { cloneBalls, type Ball } from '../../core/physics';
import { canRest, type RestCloth } from '../practice';
import { judgeShot, returnCueBall } from './shot';
import type { Resolution, ShotSummary, Side } from '../../core/rules/types';
import type { Match } from './match';

/** Luyện thế: no rules and no turns; a scratched cue ball comes back in hand anywhere. */
export function finishPracticeShot(m: Match, side: Side, shot: ShotSummary) {
  const cue = m.cueBall(side);
  const scratched = !cue.onTable;
  const pots = shot.pocketed.filter((p) => p.id !== cue.id).map((p) => p.id);
  m.potted[side].push(...pots);
  judgeShot(m, scratched ? [] : pots, m.isCarom && shot.cueContacts.length >= 2 ? 1 : 0, false);
  if (scratched) returnCueBall(m, cue);
  const res: Resolution = {
    foul: null, keepTurn: true, ballInHand: scratched ? 'anywhere' : 'none', respot: [], winner: null, points: 0, messages: [],
  };
  m.lastRes = res;
  m.lastShooter = side;
  m.emit({ type: 'resolved', res, side });
  m.placing = res.ballInHand;
  m.beginTurn();
}

/** Luyện thế: move ball `id`, from the cloth or the tray, to the free spot nearest (x, y). */
export function placePracticeBall(m: Match, id: number, x: number, y: number): boolean {
  const b = m.balls.find((v) => v.id === id);
  if (!b || !m.setup.practice || m.phase !== 'aim') return false;
  const spot = restSpot(m, id, x, y);
  if (!spot) return false;
  Object.assign(b, { x: spot.x, y: spot.y, z: 0, vx: 0, vy: 0, vz: 0, wx: 0, wy: 0, wz: 0, onTable: true });
  m.snapshot = null;
  return true;
}

/** Nearest spot to (x, y) where `id` may rest, by spiral search; null on a full table. */
function restSpot(m: Match, id: number, x: number, y: number): { x: number; y: number } | null {
  const t = m.table;
  const cloth: RestCloth = { table: t, balls: m.balls };
  const cx = Math.max(-t.L / 2, Math.min(t.L / 2, x));
  const cy = Math.max(-t.W / 2, Math.min(t.W / 2, y));
  if (canRest(cloth, id, cx, cy)) return { x: cx, y: cy };
  for (let r = 0.004; r < t.L; r += 0.004) {
    for (let a = 0; a < 32; a++) {
      const px = cx + Math.cos((a / 32) * Math.PI * 2) * r;
      const py = cy + Math.sin((a / 32) * Math.PI * 2) * r;
      if (canRest(cloth, id, px, py)) return { x: px, y: py };
    }
  }
  return null;
}

/** Luyện thế: carry an object ball back to the tray. The cue ball always stays. */
export function liftPracticeBall(m: Match, id: number): boolean {
  const b = m.balls.find((v) => v.id === id);
  if (!b || !b.onTable || id === m.cueId() || !m.setup.practice || m.phase !== 'aim') return false;
  b.onTable = false;
  m.snapshot = null;
  return true;
}

/** Luyện thế: lay out a whole position; "Về thế" comes back to it. */
export function setPracticePosition(m: Match, balls: Ball[]) {
  if (!m.setup.practice || m.phase === 'rolling') return;
  m.setup.layout = cloneBalls(balls);
  m.potted = [[], []];
  m.snapshot = null;
  m.retryLayout();
}

/** Luyện thế: the position on the cloth now becomes the one "Về thế" returns to. */
export function markPracticePosition(m: Match) {
  if (!m.setup.practice) return;
  m.setup.layout = cloneBalls(m.balls);
  m.placing = 'none';
}

/** Luyện thế: put every ball back where it rested before the last shot. */
export function undoPracticeShot(m: Match): boolean {
  const s = m.snapshot;
  if (!m.canUndo || !s) return false;
  m.balls = cloneBalls(s.balls);
  m.world.balls = m.balls;
  m.potted = s.potted;
  m.placing = s.ballInHand;
  m.snapshot = null;
  m.lastRes = null;
  m.emit({ type: 'new-rack' });
  m.emit({ type: 'turn', side: m.state.turn });
  return true;
}
