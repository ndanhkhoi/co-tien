import { other, type Side } from '../../core/rules/types';
import type { Match } from './match';
import { hexFor, sealPockets } from './skills';
import { ENERGY_MAX, gainEnergy } from './energy';

/** Derive the shooter's active hex values and seal any pockets waiting for this turn. */
export function armTurnHexes(m: Match, side: Side): void {
  armTurnTricks(m, side);
  m.tremorNow = hexFor(m.hexes, side, 'chill')?.value ?? 1;
  m.freezeNow = hexFor(m.hexes, side, 'freeze')?.value ?? 1;
  m.blindNow = !!hexFor(m.hexes, side, 'blind');
  m.driftNow = hexFor(m.hexes, side, 'drift')?.value ?? 0;
  const seal = hexFor(m.hexes, side, 'seal');
  if (seal) sealPockets(m, side, seal.value);
}

/** Called-ball and armed counter effects waiting for this turn. */
function armTurnTricks(m: Match, side: Side): void {
  const called = m.called;
  m.calledNow = called ? called.ball : null;
  m.counter = m.activeEffects.find((e) => e.kind === 'counter' && e.target === other(side)) ?? null;
}

/** Counter a skill spent by the incoming opponent and drain energy to its owner. */
export function absorbSkill(m: Match, side: Side): boolean {
  const counter = m.counter;
  if (!counter || counter.target !== other(side)) return false;
  m.activeEffects = m.activeEffects.filter((e) => e !== counter);
  m.counter = null;
  gainEnergy(m, counter.target, Math.min(ENERGY_MAX - m.energy[counter.target], counter.amount ?? 0));
  return true;
}

/** Hexes and placed effects spent by this shot. */
export function spendTurnEffects(m: Match, side: Side): void {
  for (const hex of m.hexes) {
    if (hex.target !== side) continue;
    hex.shotsLeft--;
    if (hex.shotsLeft <= 0) m.hexes = m.hexes.filter((h) => h !== hex);
  }
  const kept = [];
  for (const effect of m.activeEffects) {
    if (effect.target !== 'both' && effect.target !== side) kept.push(effect);
    else if (--effect.shotsLeft > 0) kept.push(effect);
  }
  m.activeEffects = kept;
  if (m.called) {
    m.called.shotsLeft--;
    if (m.called.shotsLeft <= 0) m.called = null;
  }
  m.counter = null;
}
