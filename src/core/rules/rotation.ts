import type { Ball } from '../physics';
import { rackNine, rackTen } from '../rack';
import { other, type GameState, type Resolution, type RuleSet, type ShotSummary } from './types';

function lowest(balls: Ball[]): number {
  let lo = Infinity;
  for (const b of balls) if (b.onTable && b.id !== 0 && b.id < lo) lo = b.id;
  return lo === Infinity ? -1 : lo;
}

function blank(): Resolution {
  return { foul: null, keepTurn: false, ballInHand: 'none', respot: [], winner: null, messages: [], points: 0 };
}

/** Fouls shared by 9- and 10-ball (lowest ball first, rail after contact, scratch). */
function basicFoul(shot: ShotSummary, isPush: boolean): string | null {
  if (shot.offTable?.length) return 'Bi văng khỏi bàn';
  const cueDown = shot.pocketed.some((p) => p.id === 0);
  if (cueDown) return 'Bi cái rơi lỗ';
  if (isPush) return null;
  const lo = shot.targets[0];
  if (shot.firstHit === null) return 'Không chạm bi nào';
  if (shot.firstHit !== lo) return `Phải chạm bi ${lo} trước`;
  const objectsDown = shot.pocketed.some((p) => p.id !== 0);
  if (!objectsDown && !shot.railAfterContact) return 'Không bi nào chạm băng sau va chạm';
  return null;
}

function breakFoul(shot: ShotSummary): string | null {
  if (shot.offTable?.length) return 'Bi văng khỏi bàn khi phá';
  if (shot.pocketed.some((p) => p.id === 0)) return 'Bi cái rơi lỗ khi phá';
  if (shot.firstHit !== 1) return 'Phá bi phải chạm bi 1 trước';
  const objectsDown = shot.pocketed.filter((p) => p.id !== 0).length;
  if (objectsDown === 0 && shot.objectBallsToRail < 4) return 'Phá không hợp lệ: cần ≥4 bi chạm băng hoặc có bi vào lỗ';
  return null;
}

/** Applies the three-consecutive-foul rule and the standard foul penalty. */
function penalise(state: GameState, res: Resolution) {
  const side = state.turn;
  res.ballInHand = 'anywhere';
  if (state.fouls[side] + 1 >= 3) {
    res.winner = other(side);
    res.messages.push('Phạm lỗi 3 lần liên tiếp, thua ván');
  } else if (state.fouls[side] + 1 === 2) {
    res.messages.push('Cảnh báo: đã phạm lỗi 2 lần liên tiếp');
  }
}

function pushOutResolution(state: GameState, shot: ShotSummary, moneyId: number): Resolution {
  const res = blank();
  res.foul = basicFoul(shot, true);
  if (moneyId) res.respot.push(moneyId);
  if (res.foul) {
    penalise(state, res);
    return res;
  }
  res.option = 'push-out';
  res.messages.push('Đẩy bi (push-out): đối thủ chọn đánh hay nhường');
  return res;
}

function fouledRotation(state: GameState, shot: ShotSummary, res: Resolution, moneyId: number): boolean {
  res.foul = basicFoul(shot, false);
  if (!res.foul) return false;
  if (moneyId) res.respot.push(moneyId);
  penalise(state, res);
  return true;
}

function nineBreakResolution(state: GameState, shot: ShotSummary): Resolution {
  const res = blank();
  const side = state.turn;
  const nine = shot.pocketed.some((p) => p.id === 9) || !!shot.offTable?.includes(9);
  const objectsDown = shot.pocketed.filter((p) => p.id !== 0);
  res.foul = breakFoul(shot);
  if (res.foul) {
    if (nine) res.respot.push(9);
    penalise(state, res);
    return res;
  }
  // WPA Regulation 16: at least three object balls pocketed and/or above the head string.
  if (objectsDown.length + shot.crossedHeadString < 3) {
    if (nine) res.respot.push(9);
    res.option = 'illegal-break-9';
    res.messages.push('Phá chưa đủ 3 bi (vào lỗ / qua vạch đầu bàn): đối thủ chọn');
    return res;
  }
  if (nine) {
    res.winner = side;
    res.highlight = 'golden';
    res.messages.push('Bi 9 vào khi phá, thắng ván!');
    return res;
  }
  res.keepTurn = objectsDown.length > 0;
  return res;
}

function tenBreakResolution(state: GameState, shot: ShotSummary): Resolution {
  const res = blank();
  const ten = shot.pocketed.some((p) => p.id === 10) || !!shot.offTable?.includes(10);
  const objectsDown = shot.pocketed.filter((p) => p.id !== 0);
  res.foul = breakFoul(shot);
  if (ten) {
    res.respot.push(10);
    res.messages.push('Bi 10 vào khi phá, đặt lại bi 10');
  }
  if (res.foul) {
    penalise(state, res);
    return res;
  }
  res.keepTurn = objectsDown.length > 0;
  return res;
}

/** WPA 9-ball. */
export const nineBall: RuleSet = {
  mode: 'nine',
  table: 'pool',
  rack: rackNine,
  cueId: () => 0,
  legalTargets: (_s, balls) => [lowest(balls)],
  callType: () => 'none',
  objective(state, balls) {
    if (state.isBreak) return 'Phá bi: chạm bi 1 trước';
    return `Chạm bi ${lowest(balls)} trước · ăn bi 9 để thắng`;
  },
  resolve(state, _balls, shot) {
    if (shot.isBreak) return nineBreakResolution(state, shot);
    if (shot.pushOut) return pushOutResolution(state, shot, 9);
    const res = blank();
    const side = state.turn;
    const nine = shot.pocketed.some((p) => p.id === 9) || !!shot.offTable?.includes(9);
    const objectsDown = shot.pocketed.filter((p) => p.id !== 0);
    if (fouledRotation(state, shot, res, 9)) return res;
    if (nine) {
      res.winner = side;
      res.highlight = shot.firstHit === 9 ? 'win' : 'golden';
      res.messages.push(objectsDown.length > 1 || shot.firstHit !== 9 ? 'Ăn bi 9 bằng kết hợp, thắng ván!' : 'Ăn bi 9, thắng ván!');
      return res;
    }
    res.keepTurn = objectsDown.length > 0;
    if (objectsDown.length >= 2) res.messages.push(`Ăn ${objectsDown.length} bi!`);
    return res;
  },
};

/** WPA 10-ball (call shot). */
export const tenBall: RuleSet = {
  mode: 'ten',
  table: 'pool',
  rack: rackTen,
  cueId: () => 0,
  legalTargets: (_s, balls) => [lowest(balls)],
  callType: (state) => (state.isBreak ? 'none' : 'ball-pocket'),
  objective(state, balls) {
    if (state.isBreak) return 'Phá bi: chạm bi 1 trước';
    return `Chạm bi ${lowest(balls)} trước · gọi bi & lỗ · ăn bi 10 để thắng`;
  },
  resolve(state, _balls, shot) {
    const res = blank();
    const side = state.turn;
    const ten = shot.pocketed.some((p) => p.id === 10) || !!shot.offTable?.includes(10);
    const objectsDown = shot.pocketed.filter((p) => p.id !== 0);

    if (shot.isBreak) return tenBreakResolution(state, shot);
    if (shot.pushOut) return pushOutResolution(state, shot, 10);
    if (fouledRotation(state, shot, res, 10)) return res;
    const call = shot.call;
    const made = !!call && shot.pocketed.some((p) => p.id === call.ball && p.pocket === call.pocket);
    // The 10 only wins as the last object ball; pocketed any earlier it is spotted.
    if (made && call!.ball === 10 && shot.targets[0] === 10) {
      res.winner = side;
      res.highlight = 'win';
      res.messages.push('Ăn bi 10 đúng lỗ đã gọi, thắng ván!');
      return res;
    }
    if (ten) {
      res.respot.push(10);
      res.messages.push('Bi 10 vào không theo lời gọi, đặt lại');
    }
    if (made) {
      res.keepTurn = true;
      if (objectsDown.length >= 2) res.messages.push(`Ăn ${objectsDown.length} bi!`);
      return res;
    }
    // Called ball missed (or went elsewhere): not a foul, the incoming player chooses.
    if (objectsDown.length) {
      res.option = 'wrong-call';
      res.messages.push('Bi vào không đúng lời gọi: đối thủ chọn đánh hay nhường');
    }
    return res;
  },
};
