/** Cues, table skins, skills and table mutators. */

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
  /** Visual: shaft, collar/wrap, butt and accent colours. */
  colors: { shaft: number; wrap: number; butt: number; accent: number; ferrule: number };
}

export const CUES: CueDef[] = [
  {
    id: 'house', name: 'Cơ Quán', desc: 'Cây cơ treo tường quán quen. Thẳng, chắc, chẳng có gì nổi bật.',
    price: 0, level: 1, power: 2, aim: 2, spin: 2, control: 2, energy: 2,
    colors: { shaft: 0xe8cf9c, wrap: 0x2b2b2b, butt: 0x5a3416, accent: 0xc9a25a, ferrule: 0xf3f0e6 },
  },
  {
    id: 'bamboo', name: 'Thanh Trúc', desc: 'Nhẹ tay, ngọn thon — ngắm xa và ổn định hơn.',
    price: 600, level: 2, power: 2, aim: 4, spin: 2, control: 3, energy: 2,
    colors: { shaft: 0xeedcae, wrap: 0x2f5d3a, butt: 0x7a8c3a, accent: 0xd8e6a0, ferrule: 0xf3f0e6 },
  },
  {
    id: 'blackdragon', name: 'Hắc Long', desc: 'Gỗ mun nặng tay, phá bi như sấm.',
    price: 1400, level: 4, power: 5, aim: 2, spin: 3, control: 2, energy: 3,
    colors: { shaft: 0xe2c690, wrap: 0x111111, butt: 0x1a1414, accent: 0xb51e2a, ferrule: 0xf3f0e6 },
  },
  {
    id: 'phoenix', name: 'Phượng Hoàng', desc: 'Ngọn cứng, đầu cơ bám phấn — phê ăn sâu.',
    price: 2200, level: 6, power: 3, aim: 3, spin: 5, control: 3, energy: 3,
    colors: { shaft: 0xf0d8a4, wrap: 0x7a1414, butt: 0xa3361c, accent: 0xf2b23a, ferrule: 0xf3f0e6 },
  },
  {
    id: 'icemind', name: 'Băng Tâm', desc: 'Carbon lạnh tay, gần như không run khi nạp lực.',
    price: 3200, level: 8, power: 3, aim: 4, spin: 3, control: 5, energy: 3,
    colors: { shaft: 0x2e3438, wrap: 0x9fd3e6, butt: 0x1d2a33, accent: 0xc8f0ff, ferrule: 0xe6f6ff },
  },
  {
    id: 'thancong', name: 'Thần Công', desc: 'Cây cơ huyền thoại. Mọi chỉ số tối đa, hồi năng lượng cực nhanh.',
    price: 6000, level: 12, power: 5, aim: 5, spin: 5, control: 5, energy: 5,
    colors: { shaft: 0xf2deb0, wrap: 0x1b1b1b, butt: 0x2a1708, accent: 0xf5c542, ferrule: 0xfff8e2 },
  },
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
}

export const TABLES: TableSkin[] = [
  { id: 'classic', name: 'Nỉ Xanh Cổ Điển', desc: 'Màu nỉ quen thuộc của mọi quán bida.', price: 0, level: 1, cloth: 0x1f7a4a, clothDark: 0x0f4a2c, rail: 0x6b3a1c, railDark: 0x3b1d0c, energyBonus: 0 },
  { id: 'tournament', name: 'Xanh Giải Đấu', desc: 'Nỉ xanh dương chuẩn truyền hình. +5 năng lượng đầu ván.', price: 800, level: 3, cloth: 0x1f5fa8, clothDark: 0x0f325f, rail: 0x2a2a2e, railDark: 0x111114, energyBonus: 5 },
  { id: 'wine', name: 'Đỏ Rượu Vang', desc: 'Sang trọng kiểu câu lạc bộ cũ. +8 năng lượng đầu ván.', price: 1500, level: 5, cloth: 0x8a1f2c, clothDark: 0x4d0c15, rail: 0x4a2a14, railDark: 0x241207, energyBonus: 8 },
  { id: 'dusk', name: 'Tím Hoàng Hôn', desc: 'Nỉ tím than, gỗ óc chó. +12 năng lượng đầu ván.', price: 2600, level: 7, cloth: 0x4b2d7a, clothDark: 0x24133f, rail: 0x3a2516, railDark: 0x1a0f08, energyBonus: 12 },
  { id: 'onyx', name: 'Huyền Thạch', desc: 'Nỉ xám than, viền vàng. +18 năng lượng đầu ván.', price: 4200, level: 10, cloth: 0x3a4148, clothDark: 0x1a1e22, rail: 0x161616, railDark: 0x050505, energyBonus: 18 },
];

export type SkillId = 'eagle' | 'rewind' | 'shield' | 'tremor' | 'spin2' | 'nudge';

export interface SkillDef {
  id: SkillId;
  name: string;
  desc: string;
  cost: number;
  level: number;
}

export const SKILLS: SkillDef[] = [
  { id: 'eagle', name: 'Thần Nhãn', desc: 'Hiện toàn bộ đường đi của bi cái và bi mục tiêu cho cú này.', cost: 30, level: 1 },
  { id: 'spin2', name: 'Phê Thần', desc: 'Nhân đôi hiệu ứng phê, không lo trượt cơ trong cú này.', cost: 25, level: 1 },
  { id: 'nudge', name: 'Thổi Bi', desc: 'Dời bi cái tối đa 12 cm trước khi đánh.', cost: 30, level: 3 },
  { id: 'shield', name: 'Bảo Hộ', desc: 'Lỗi kế tiếp của bạn không bị phạt bi trong tay.', cost: 40, level: 4 },
  { id: 'tremor', name: 'Run Tay', desc: 'Cú kế tiếp của đối thủ run tay gấp 3 và mất đường ngắm.', cost: 35, level: 6 },
  { id: 'rewind', name: 'Hồi Cục', desc: 'Đánh hỏng? Quay ngược thời gian, đánh lại cú vừa rồi.', cost: 50, level: 8 },
];

export const skillDef = (id: SkillId) => SKILLS.find((s) => s.id === id)!;

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
