import type { Side } from '../../../core/rules/types';
import { appliesTo } from '../../../game/match/skills';
import { controllerIsHuman } from './controller';
import type { MatchCtx } from './context';
import type { HeraldMsg } from './herald';

/** Read the actual shooter's state before aiming, including when another player controls their shot. */
export function turnWarnings(m: MatchCtx['match'], side: Side): string[] {
  if (m.turn !== side) return [];
  const out: string[] = [];
  const num = (x: number) => x.toFixed(1).replace('.', ',');
  if (m.tremorNow > 1) out.push(`run tay ×${num(m.tremorNow)}`);
  if (m.driftNow) {
    const sense = m.hexes.find((hex) => hex.kind === 'drift' && hex.target === side)?.sense;
    out.push(`hướng đánh lệch ${num(Math.abs(m.driftNow))}° ${sense === 'ccw' ? 'ngược' : 'thuận'} chiều kim đồng hồ`);
  }
  if (m.blindNow) out.push('mất đường ngắm');
  if (m.freezeNow < 1) out.push(`lực tối đa ${Math.round(m.freezeNow * 100)}%`);
  if (m.closedPockets.length) out.push(`${m.closedPockets.length} lỗ bị phong`);
  if (m.calledNow !== null) out.push(`phải chạm bi ${m.calledNow} trước`);
  const fields = new Set(m.activeEffects
    .filter((effect) => appliesTo(effect.target, side))
    .map((effect) => FIELD_WORDS[effect.kind]).filter(Boolean));
  return [...out, ...fields];
}

/** Interrupt old news: the player must learn about changed aiming conditions before shooting. */
export function warnBeforeAim(ctx: MatchCtx, herald: (message: HeraldMsg) => void): boolean {
  if (!ctx.hasSkills || ctx.match.phase !== 'aim' || !controllerIsHuman(ctx.match)) return false;
  const warnings = turnWarnings(ctx.match, ctx.match.turn);
  if (!warnings.length) return false;
  const text = warnings.join(' · ');
  herald({ side: null, icon: 'warning', tone: 'red', important: true, immediate: true,
    title: 'Chú ý trước khi đánh', line: text.charAt(0).toUpperCase() + text.slice(1), ms: 5200 });
  return true;
}

const FIELD_WORDS: Record<string, string> = {
  vortex: 'xoáy trên bàn', well: 'giếng hút trên bàn', silk: 'dải lụa trên bàn', slick: 'nỉ trơn trên bàn',
  sand: 'cát trên bàn', spinwash: 'vùng mực tan áp phê', bumper: 'vật chắn trên bàn', railcraft: 'băng bị yểm',
  wind: 'gió đẩy bi', quake: 'bàn nghiêng', decoy: 'bi giả chắn đường',
};
