import { makeBall, type Ball } from '../../core/physics';
import type { ShotSummary } from '../../core/rules/types';
import data from './challenges.json';

export type ChallengeFamily = 'straight' | 'cut' | 'bank' | 'position' | 'carom';

export type ChallengeGoal =
  | { kind: 'pot'; ball: number; pocket: number }
  | { kind: 'pot-zone'; ball: number; pocket: number; zone: [number, number, number] }
  | { kind: 'carom'; three: boolean };

export interface ChallengeDef {
  id: string;
  family: ChallengeFamily;
  table: 'pool' | 'carom';
  balls: [number, number, number][];
  goal: ChallengeGoal;
  /** A verified solution: angle, power (0..1 on the reference cue), side, vert. */
  solution: [number, number, number, number];
  /** Angular width (degrees) of the winning window — larger is easier. */
  window: number;
}

export const FAMILY_INFO: Record<ChallengeFamily, { name: string; desc: string }> = {
  straight: { name: 'Ăn Thẳng', desc: 'Ngắm chuẩn, đánh dứt khoát.' },
  cut: { name: 'Cắt Bi', desc: 'Cắt mỏng, cắt dày — cảm giác góc.' },
  bank: { name: 'Đánh Băng', desc: 'Dội băng một lần vào lỗ.' },
  position: { name: 'Đi Bi', desc: 'Ăn bi và đặt bi cái vào vùng chỉ định.' },
  carom: { name: 'Phăng', desc: 'Bi-a ba bi: tự do và ba băng.' },
};

export const CHALLENGES = data as ChallengeDef[];

/** Reference cue power stat used by the generator. */
export const REFERENCE_POWER = 2;

export function challengeBalls(c: ChallengeDef): Ball[] {
  return c.balls.map(([id, x, y]) => makeBall(id, x, y));
}

export function goalText(c: ChallengeDef, pocketName: (i: number) => string): string {
  const g = c.goal;
  if (g.kind === 'pot') return `Ăn bi ${g.ball} vào ${pocketName(g.pocket)}`;
  if (g.kind === 'pot-zone') return `Ăn bi ${g.ball} vào ${pocketName(g.pocket)} và đưa bi cái vào vùng sáng`;
  return g.three ? 'Ba băng: chạm 2 bi, đủ 3 băng trước bi thứ hai' : 'Phăng: bi cái chạm cả hai bi';
}

/** Did the shot meet the goal? */
export function judgeChallenge(c: ChallengeDef, shot: ShotSummary, balls: Ball[]): { ok: boolean; why: string } {
  const g = c.goal;
  const cueDown = shot.pocketed.some((p) => p.id === 0);
  if (g.kind === 'carom') {
    const both = shot.cueContacts.length >= 2;
    if (!both) return { ok: false, why: 'Bi cái chưa chạm đủ hai bi' };
    if (g.three && shot.cueRailsBeforeSecond < 3) return { ok: false, why: `Mới ${shot.cueRailsBeforeSecond} băng trước bi thứ hai` };
    return { ok: true, why: 'Ăn điểm!' };
  }
  if (cueDown) return { ok: false, why: 'Bi cái rơi lỗ' };
  const made = shot.pocketed.find((p) => p.id === g.ball);
  if (!made) return { ok: false, why: `Bi ${g.ball} chưa vào` };
  if (made.pocket !== g.pocket) return { ok: false, why: 'Vào sai lỗ' };
  const others = shot.pocketed.filter((p) => p.id !== g.ball && p.id !== 0);
  if (others.length) return { ok: false, why: 'Không được làm rơi bi khác' };
  if (g.kind === 'pot-zone') {
    const cue = balls.find((b) => b.id === 0)!;
    const [zx, zy, zr] = g.zone;
    if (Math.hypot(cue.x - zx, cue.y - zy) > zr) return { ok: false, why: 'Bi cái chưa vào vùng' };
  }
  return { ok: true, why: 'Hoàn hảo!' };
}
