import type { Side } from '../../core/rules/types';
import type { PlayerSetup } from './types';

/** The player whose controls (human or AI) own the current shot. */
export interface ControllerMatch {
  turn: Side;
  puppeteer: Side | null;
  setup: { players: [PlayerSetup, PlayerSetup] };
}

/** Khuynh Quốc Khuynh Thành: the caster controls the opponent's forced shot. */
export function shotController(m: ControllerMatch): Side {
  return m.puppeteer ?? m.turn;
}

export function controllerPlayer(m: ControllerMatch): PlayerSetup {
  return m.setup.players[shotController(m)];
}

export function controllerIsHuman(m: ControllerMatch): boolean {
  return controllerPlayer(m).kind === 'human';
}

export function puppetHeraldLine(m: ControllerMatch): string | null {
  if (m.puppeteer === null || m.puppeteer === m.turn) return null;
  return `Khuynh thành: ${m.setup.players[m.puppeteer].name} đánh hộ ${m.setup.players[m.turn].name} cú này`;
}
