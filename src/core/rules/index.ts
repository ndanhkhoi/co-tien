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

export const MODE_NAMES: Record<GameMode, string> = {
  eight: '8 Bi',
  nine: '9 Bi',
  ten: '10 Bi',
  'carom-libre': 'Phăng Tự Do',
  'carom-3c': 'Phăng 3 Băng',
};
