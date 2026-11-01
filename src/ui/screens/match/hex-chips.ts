import type { Side } from '../../../core/rules/types';
import type { IconName } from '../../icons';

type HexLike = { kind: string; target: Side | 'both'; shotsLeft: number; value?: number };
type EffectLike = { kind: string; target: Side | 'both'; shotsLeft: number; value?: number };
type CalledLike = { by: Side; ball: number; shotsLeft: number } | null;

export interface HexChip {
  side: Side;
  icon: IconName;
  label: string;
  shotsLeft: number;
}

interface ChipSource {
  hexes?: HexLike[];
  activeEffects?: EffectLike[];
  called?: CalledLike;
  /** Side lining up the shot; the shooter's own buffs below last for that one shot. */
  turn?: Side;
  shield?: [boolean, boolean];
  powerBoost?: number;
  spinBoost?: number;
  mawScale?: number;
  pull?: number;
  secondChance?: boolean;
  eagle?: boolean;
  reveal?: boolean;
  blast?: unknown;
}

/** One shared vocabulary for the plate chips; no skill name leaks through the face-down counter. */
export function hexChips(m: ChipSource): [HexChip[], HexChip[]] {
  return [sideChips(m, 0), sideChips(m, 1)];
}

function sideChips(m: ChipSource, side: Side): HexChip[] {
  const chips: HexChip[] = [];
  for (const hex of m.hexes ?? []) {
    if (hex.target !== side) continue;
    const chip = HEX_CHIPS[hex.kind];
    if (chip) chips.push({ side, shotsLeft: hex.shotsLeft, ...chip });
  }
  for (const effect of m.activeEffects ?? []) {
    if (effect.target !== side && effect.target !== 'both') continue;
    const chip = EFFECT_CHIPS[effect.kind];
    if (chip) chips.push({ side, shotsLeft: effect.shotsLeft, ...chip });
  }
  if (m.called?.by === side) {
    chips.push({ side, icon: 'target', label: `Bi ${m.called.ball} chỉ định`, shotsLeft: m.called.shotsLeft });
  }
  if (m.shield?.[side]) chips.push({ side, icon: 'shield', label: 'Hộ lỗi', shotsLeft: 1 });
  if (m.turn === side) chips.push(...ownShotChips(m, side));
  return chips;
}

/** Buffs the shooter armed for this one shot. */
function ownShotChips(m: ChipSource, side: Side): HexChip[] {
  const one = (icon: IconName, label: string): HexChip => ({ side, icon, label, shotsLeft: 1 });
  const out: HexChip[] = [];
  if ((m.powerBoost ?? 1) > 1) out.push(one('power', 'Tăng lực'));
  if ((m.spinBoost ?? 1) > 1) out.push(one('spin', 'Áp phê mạnh'));
  if ((m.mawScale ?? 1) > 1) out.push(one('target', 'Lỗ rộng'));
  if ((m.pull ?? 0) > 0) out.push(one('target', 'Lỗ hút'));
  if (m.secondChance) out.push(one('replay', 'Đánh tiếp'));
  if (m.eagle || m.reveal) out.push(one('vision', 'Nhìn đường'));
  if (m.blast) out.push(one('energy', 'Xung lực'));
  return out;
}

const HEX_CHIPS: Record<string, Omit<HexChip, 'side' | 'shotsLeft'>> = {
  chill: { icon: 'tremor', label: 'Run tay' },
  freeze: { icon: 'power', label: 'Giảm lực' },
  blind: { icon: 'vision', label: 'Che mắt' },
  drift: { icon: 'rotate-right', label: 'Dắt lệch' },
  seal: { icon: 'lock', label: 'Phong lỗ' },
};

const EFFECT_CHIPS: Record<string, Omit<HexChip, 'side' | 'shotsLeft'>> = {
  decoy: { icon: 'info', label: 'Bi giả' },
  counter: { icon: 'shield', label: 'Một chiêu đang úp' },
  vortex: { icon: 'spin', label: 'Xoáy' },
  well: { icon: 'target', label: 'Giếng hút' },
  silk: { icon: 'spin', label: 'Dải lụa' },
  slick: { icon: 'place', label: 'Nỉ trơn' },
  sand: { icon: 'place', label: 'Cát' },
  spinwash: { icon: 'spin', label: 'Mực tan' },
  bumper: { icon: 'shield', label: 'Vật chắn' },
  railcraft: { icon: 'shield', label: 'Yểm băng' },
  wind: { icon: 'rotate-right', label: 'Gió' },
  quake: { icon: 'warning', label: 'Nghiêng bàn' },
};
