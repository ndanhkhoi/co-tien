import { caromLibre, caromThree } from './carom';
import { eightBall } from './eight-ball';
import { nineBall, tenBall } from './rotation';
import type { GameMode, RuleSet } from './types';

export const RULES: Record<GameMode, RuleSet> = {
  eight: eightBall,
  nine: nineBall,
  ten: tenBall,
  'carom-libre': caromLibre,
  'carom-3c': caromThree,
};

/** How Vietnamese players name a match length: race to 2 is "3 ván thắng 2". */
export function raceName(raceTo: number, short = false): string {
  if (raceTo <= 1) return '1 ván';
  return short ? `${2 * raceTo - 1} thắng ${raceTo}` : `${2 * raceTo - 1} ván thắng ${raceTo}`;
}

export const MODE_NAMES: Record<GameMode, string> = {
  eight: '8 Bi',
  nine: '9 Bi',
  ten: '10 Bi',
  'carom-libre': 'Phăng Tự Do',
  'carom-3c': 'Phăng 3 Băng',
};
