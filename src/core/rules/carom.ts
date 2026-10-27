import { makeBall } from '../physics';
import type { Rng } from '../rng';
import type { TableGeom } from '../table';
import type { GameMode, Resolution, RuleSet, Side } from './types';

/** Ball ids on the carom table: 0 white (player 1), 1 yellow (player 2), 2 red. */
export const CAROM_WHITE = 0;
export const CAROM_YELLOW = 1;
export const CAROM_RED = 2;

/**
 * UMB opening position: red on the foot spot, the opponent's ball on the head spot,
 * the breaker's cue ball 18.25 cm to the left or right of the head spot.
 */
function rackCarom(t: TableGeom, rng: Rng, breaker: Side) {
  const offset = 0.1825 * (rng.next() < 0.5 ? -1 : 1);
  const cue = breaker === 0 ? CAROM_WHITE : CAROM_YELLOW;
  const opp = breaker === 0 ? CAROM_YELLOW : CAROM_WHITE;
  const balls = [
    makeBall(cue, t.headSpot.x, t.headSpot.y + offset),
    makeBall(opp, t.headSpot.x, t.headSpot.y),
    makeBall(CAROM_RED, t.footSpot.x, t.footSpot.y),
  ];
  return balls.sort((a, b) => a.id - b.id);
}

function makeCarom(mode: GameMode, threeCushion: boolean): RuleSet {
  return {
    mode,
    table: 'carom',
    rack: rackCarom,
    cueId: (_s, side) => (side === 0 ? CAROM_WHITE : CAROM_YELLOW),
    legalTargets: (state) => (state.isBreak ? [CAROM_RED] : []),
    callType: () => 'none',
    objective(state) {
      const base = threeCushion ? 'Chạm 2 bi, đủ 3 băng trước bi thứ hai' : 'Bi cái chạm cả 2 bi';
      return state.isBreak ? `${base} · cú mở chạm bi đỏ trước` : base;
    },
    resolve(state, _balls, shot) {
      const res: Resolution = { foul: null, keepTurn: false, ballInHand: 'none', respot: [], winner: null, messages: [], points: 0 };
      if (state.isBreak && shot.firstHit !== null && shot.firstHit !== CAROM_RED) {
        res.foul = 'Cú mở phải chạm bi đỏ trước';
        return res;
      }
      const both = shot.cueContacts.length >= 2;
      const ok = both && (!threeCushion || shot.cueRailsBeforeSecond >= 3);
      if (ok) {
        res.points = 1;
        res.keepTurn = true;
        const total = state.scores[state.turn] + 1;
        res.messages.push(threeCushion ? `Ăn điểm! ${shot.cueRailsBeforeSecond} băng` : 'Ăn điểm!');
        if (total >= state.caromTarget) {
          res.winner = state.turn;
          res.highlight = 'win';
        }
      } else if (both && threeCushion) {
        res.messages.push(`Chỉ ${shot.cueRailsBeforeSecond} băng — chưa đủ 3`);
      }
      return res;
    },
  };
}

export const caromLibre = makeCarom('carom-libre', false);
export const caromThree = makeCarom('carom-3c', true);
