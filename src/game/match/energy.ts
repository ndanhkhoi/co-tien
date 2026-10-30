import type { ShotScore } from '../../core/shot-score';
import type { Side } from '../../core/rules/types';
import type { Match } from './match';

export const ENERGY_MAX = 100;
const ENERGY_START = 30;
/** Energy for every shot, and per point of shot value (1 per plain ball, more for hard shots). */
export const ENERGY_PER_SHOT = 6;
export const ENERGY_PER_VALUE = 11;
/** Ảnh Sát's run: at least this many balls in a row… */
export const ASSASSIN_RUN = 4;
/** …worth this much shot value together, so four hangers alone are not enough. */
export const ASSASSIN_VALUE = 5;

/** Both sides start every rack with the same energy. */
export function startEnergy(): [number, number] {
  return [ENERGY_START, ENERGY_START];
}

export function gainEnergy(m: Match, side: Side, amount: number) {
  const before = m.energy[side];
  m.energy[side] = Math.min(ENERGY_MAX, before + amount);
  m.emit({ type: 'energy', side, gain: m.energy[side] - before, total: m.energy[side] });
}

/** Ảnh Sát: the shot just scored extends the unbroken run, or breaks it. */
export function advanceAssassin(m: Match, side: Side, scored: ShotScore) {
  m.assassinStreak[side] = scored.count > 0 ? m.assassinStreak[side] + scored.count : 0;
  m.assassinValue[side] = scored.count > 0 ? m.assassinValue[side] + scored.value : 0;
  m.assassinReady[side] = m.passive(side) === 'anhsat' && scored.count > 0
    && m.assassinStreak[side] >= ASSASSIN_RUN && m.assassinValue[side] >= ASSASSIN_VALUE;
}

/** A spent advantage needs a fresh run of balls before it comes back. */
export function spendAssassin(m: Match, side: Side) {
  if (m.assassinReady[side]) m.assassinStreak[side] = m.assassinValue[side] = 0;
  m.assassinReady[side] = false;
}
