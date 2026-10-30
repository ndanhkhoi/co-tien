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
    if (effect.target !== side) continue;
    const chip = EFFECT_CHIPS[effect.kind];
    if (chip) chips.push({ side, shotsLeft: effect.shotsLeft, ...chip });
  }
  if (m.called?.by === side) {
    chips.push({ side, icon: 'target', label: `Bi ${m.called.ball} chỉ định`, shotsLeft: m.called.shotsLeft });
  }
  return chips;
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
};
