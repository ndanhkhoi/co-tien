import { OMEN_CHANCE, rollOmen } from '../terrain';
import type { Side } from '../../core/rules/types';
import type { Match } from './match';

/** Roll the turn's Thiên Tượng for `side`, unless the mode or their home table forbids it. */
export function rollOmenFor(m: Match, side: Side) {
  m.omen = null;
  if (m.setup.classic || m.setup.judge || m.homeSide(side) || m.rng.next() >= OMEN_CHANCE) return;
  const omen = rollOmen(m.setup.tableSkin.sect, m.rng, m.table, m.balls);
  if (!omen) return;
  m.omen = omen;
  if (omen.closePocket) closeOmenPocket(m);
  m.syncObstacles();
  m.emit({ type: 'omen', side, omen });
}

/** Quỷ Môn: seal one of the still-open pockets for this shot. */
function closeOmenPocket(m: Match) {
  const open = m.table.pockets.map((_, i) => i).filter((i) => !m.closedPockets.includes(i));
  if (open.length > 1) {
    m.omenPocket = m.rng.pick(open);
    m.closedPockets = [...m.closedPockets, m.omenPocket];
  }
}

/** Lift this shot's Thiên Tượng once the balls have stopped. */
export function endOmen(m: Match) {
  if (m.omenPocket !== null) m.closedPockets = m.closedPockets.filter((i) => i !== m.omenPocket);
  m.omen = null;
  m.omenPocket = null;
  m.world.terrain = null;
  m.syncObstacles();
}

/** Ư Minh mutator: one random pocket mouth stays sealed for the whole rack. */
export function rollGhost(m: Match) {
  m.closedPockets = [];
  if (m.setup.mutator === 'ghost' && m.table.pockets.length) {
    m.closedPockets = [m.rng.int(0, m.table.pockets.length - 1)];
  }
  m.syncObstacles();
}
