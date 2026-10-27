import { SECT_CUES, SECT_TABLES, type SectId } from './sects';

/** Cues, table skins and table mutators. */

export interface CueDef {
  id: string;
  name: string;
  desc: string;
  price: number;
  level: number;
  /** 1–5 stat bars. */
  power: number;
  aim: number;
  spin: number;
  control: number;
  energy: number;
  /** Sect the cue belongs to (none for the free house cue). */
  sect?: SectId;
  /** Visual: shaft, collar/wrap, butt and accent colours. */
  colors: { shaft: number; wrap: number; butt: number; accent: number; ferrule: number };
}

export const CUES: CueDef[] = [
  {
    id: 'house', name: 'Cơ Quán', desc: 'Cây cơ treo tường quán quen. Thẳng, chắc, chẳng có gì nổi bật.',
    price: 0, level: 1, power: 2, aim: 2, spin: 2, control: 2, energy: 2,
    colors: { shaft: 0xe8cf9c, wrap: 0x2b2b2b, butt: 0x5a3416, accent: 0xc9a25a, ferrule: 0xf3f0e6 },
  },
  ...SECT_CUES,
];

export interface TableSkin {
  id: string;
  name: string;
  desc: string;
  price: number;
  level: number;
  cloth: number;
  clothDark: number;
  rail: number;
  railDark: number;
  /** Extra starting energy each rack. */
  energyBonus: number;
  sect: SectId;
  /** Table character in Tiên Đạo mode: multipliers on friction / cushion bounce / pocket capture. */
  phys?: { muRoll?: number; muSlide?: number; eCushion?: number; capture?: number };
}

export const TABLES: TableSkin[] = SECT_TABLES;

export type MutatorId = 'bomb' | 'ghost' | 'fog' | 'ice' | 'tight';

export interface MutatorDef {
  id: MutatorId;
  name: string;
  desc: string;
}

export const MUTATORS: MutatorDef[] = [
  { id: 'bomb', name: 'Bi Nổ', desc: 'Một bi gắn ngòi nổ: va mạnh là nổ tung, hất văng bi xung quanh.' },
  { id: 'ghost', name: 'Hố Ma', desc: 'Mỗi lượt một lỗ bị bịt kín, đổi chỗ liên tục.' },
  { id: 'fog', name: 'Sương Mù', desc: 'Đường ngắm ngắn lại, nửa bàn xa chìm trong sương.' },
  { id: 'ice', name: 'Nỉ Băng', desc: 'Mặt nỉ trơn như băng — bi lăn rất xa.' },
  { id: 'tight', name: 'Lỗ Hẹp', desc: 'Miệng lỗ hẹp như bàn thi đấu khó nhất.' },
];

export const mutatorDef = (id: MutatorId) => MUTATORS.find((m) => m.id === id)!;
