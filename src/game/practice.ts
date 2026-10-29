import { makeBall, type Ball } from '../core/physics';
import { makeCaromTable, makePoolTable } from '../core/table';

export type PracticeTable = 'pool' | 'carom';

/**
 * Luyện thế starts from a sparse table: the cue ball on the head spot and one object ball on the
 * foot spot. Every other ball of the set is carried off the cloth, ready to be laid out by hand.
 */
export function practiceLayout(kind: PracticeTable): Ball[] {
  const t = kind === 'pool' ? makePoolTable() : makeCaromTable();
  const ids = kind === 'pool' ? Array.from({ length: 16 }, (_, i) => i) : [0, 1, 2];
  return ids.map((id) => {
    const b = makeBall(id, id === 0 ? t.headSpot.x : t.footSpot.x, 0);
    b.onTable = id <= 1;
    return b;
  });
}
