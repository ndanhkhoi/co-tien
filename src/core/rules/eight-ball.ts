import type { Ball } from '../physics';
import { rackEight } from '../rack';
import { other, type GameState, type Group, type Resolution, type RuleSet, type ShotSummary, type Side } from './types';

const isSolid = (id: number) => id >= 1 && id <= 7;
const isStripe = (id: number) => id >= 9 && id <= 15;
export const groupOf = (id: number): Group => (isSolid(id) ? 'solid' : isStripe(id) ? 'stripe' : null);
const groupName = (g: Group) => (g === 'solid' ? 'bi trơn' : 'bi sọc');

function remaining(balls: Ball[], g: Group): number[] {
  return balls.filter((b) => b.onTable && groupOf(b.id) === g).map((b) => b.id);
}

function onEight(state: GameState, balls: Ball[], side: Side): boolean {
  const g = state.groups[side];
  return g !== null && remaining(balls, g).length === 0;
}

function blank(): Resolution {
  return { foul: null, keepTurn: false, ballInHand: 'none', respot: [], winner: null, messages: [], points: 0 };
}

function offTableResolution(state: GameState, shot: ShotSummary): Resolution {
  const res = blank();
  const opp = other(state.turn);
  const eight = shot.pocketed.find((p) => p.id === 8);
  res.foul = 'Bi văng khỏi bàn';
  res.ballInHand = shot.isBreak ? 'kitchen' : 'anywhere';
  if (shot.offTable!.includes(8)) {
    if (shot.isBreak) res.respot.push(8);
    else { res.winner = opp; res.messages.push('Bi 8 văng khỏi bàn, thua ván'); }
  } else if (eight) {
    if (shot.isBreak) res.respot.push(8);
    else { res.winner = opp; res.messages.push('Phạm lỗi khi ăn bi 8, thua ván'); }
  }
  return res;
}

function breakResolution(shot: ShotSummary): Resolution {
  const res = blank();
  const ids = shot.pocketed.map((p) => p.id);
  const cueDown = ids.includes(0);
  const eight = shot.pocketed.find((p) => p.id === 8);
  const objects = ids.filter((id) => id !== 0 && id !== 8);
  // WPA 4.3: the 8 on the break is spotted; a scratch gives ball in hand above the
  // head string; a break that neither pockets a ball nor drives four to a rail lets
  // the incoming player accept the table or re-rack and break.
  if (eight) {
    res.respot.push(8);
    res.messages.push('Bi 8 vào khi phá, đặt lại bi 8');
  }
  if (cueDown || shot.firstHit === null) {
    res.foul = cueDown ? 'Bi cái rơi lỗ khi phá' : 'Phá bi không chạm bi nào';
    res.ballInHand = 'kitchen';
    return res;
  }
  if (objects.length === 0 && !eight && shot.objectBallsToRail < 4) {
    res.foul = 'Phá không hợp lệ: cần ≥4 bi chạm băng hoặc có bi vào lỗ';
    res.option = 'illegal-break-8';
    return res;
  }
  res.keepTurn = objects.length > 0 || !!eight;
  if (objects.length) {
    const kinds = [...new Set(objects.map((id) => groupName(groupOf(id))))].join(' và ');
    res.messages.push(`Phá vào ${objects.length} ${kinds}. Luật WPA: sau cú phá bàn vẫn mở. Cú tiếp theo ăn bi nhóm nào thì nhận nhóm đó.`);
  }
  return res;
}

function setFoul(res: Resolution, shot: ShotSummary, g: Group, ids: number[]) {
  const shootingEight = shot.targets.length === 1 && shot.targets[0] === 8;
  if (shot.firstHit === null) res.foul = 'Không chạm bi nào';
  else if (g === null && shot.firstHit === 8) res.foul = 'Bàn mở: không được chạm bi 8 trước';
  else if (shot.targets.length && !shot.targets.includes(shot.firstHit)) res.foul = `Chạm sai bi trước: phải chạm ${shootingEight ? 'bi 8' : g ? groupName(g) : 'bi mục tiêu'}`;
  else if (ids.length === 0 && !shot.railAfterContact) res.foul = 'Không bi nào chạm băng sau va chạm';
  if (ids.includes(0)) res.foul = 'Bi cái rơi lỗ';
}

function eightResolution(state: GameState, shot: ShotSummary, res: Resolution, eight: { pocket: number }): Resolution {
  const side = state.turn;
  const opp = other(side);
  const shootingEight = shot.targets.length === 1 && shot.targets[0] === 8;
  if (!shootingEight) {
    res.winner = opp;
    res.messages.push('Bi 8 vào sớm, thua ván');
  } else if (res.foul) {
    res.winner = opp;
    res.messages.push('Phạm lỗi khi ăn bi 8, thua ván');
  } else if (shot.call && shot.call.pocket !== eight.pocket) {
    res.winner = opp;
    res.messages.push('Bi 8 vào sai lỗ đã gọi, thua ván');
  } else {
    res.winner = side;
    res.highlight = 'win';
    res.messages.push('Ăn bi 8, thắng ván!');
  }
  return res;
}

function openTableResolution(res: Resolution, objects: number[]): Resolution {
  if (objects.length) {
    const first = groupOf(objects[0]);
    res.assignGroup = first;
    res.highlight = 'group';
    res.messages.push(`Nhận nhóm ${groupName(first)}`);
    res.keepTurn = true;
  }
  return res;
}

/**
 * WPA 8-ball. Groups are decided by the first ball legally pocketed after the break
 * (obvious shots need no verbal call); the 8 must be called to a pocket.
 */
export const eightBall: RuleSet = {
  mode: 'eight',
  table: 'pool',
  rack: rackEight,
  cueId: () => 0,

  legalTargets(state, balls, side) {
    if (state.isBreak) return [];
    const g = state.groups[side];
    if (g === null) return balls.filter((b) => b.onTable && b.id !== 0 && b.id !== 8).map((b) => b.id);
    const rem = remaining(balls, g);
    return rem.length ? rem : [8];
  },

  callType(state, balls, side) {
    return !state.isBreak && onEight(state, balls, side) ? 'pocket' : 'none';
  },

  objective(state, balls, side) {
    if (state.isBreak) return 'Phá bi';
    const g = state.groups[state.turn];
    if (g === null) return 'Bàn mở: ăn bi nào nhận nhóm đó';
    if (onEight(state, balls, side)) return 'Gọi lỗ và ăn bi 8';
    return `Ăn hết ${groupName(g)} (còn ${remaining(balls, g).length})`;
  },

  resolve(state, _balls, shot: ShotSummary): Resolution {
    if (shot.offTable?.length) return offTableResolution(state, shot);
    if (shot.isBreak) return breakResolution(shot);
    const res = blank();
    const ids = shot.pocketed.map((p) => p.id);
    const eight = shot.pocketed.find((p) => p.id === 8);
    const objects = ids.filter((id) => id !== 0 && id !== 8);
    const g = state.groups[state.turn];
    setFoul(res, shot, g, ids);
    if (eight) return eightResolution(state, shot, res, eight);

    if (res.foul) {
      res.ballInHand = 'anywhere';
      return res;
    }

    if (g === null) return openTableResolution(res, objects);
    const own = objects.filter((id) => groupOf(id) === g);
    res.keepTurn = own.length > 0;
    if (own.length >= 2) res.messages.push(`Ăn ${own.length} bi!`);
    return res;
  },
};
