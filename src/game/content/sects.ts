import roster from './roster.json';
import type { CueDef, TableSkin } from './gear';

/** Cơ Tiên Giới content: sects (lands), classes, champions and their three skills. */

export type SectId =
  | 'thienquang' | 'huyetsat' | 'hoalinh' | 'bangphach' | 'thienco' | 'docvu'
  | 'hailong' | 'uminh' | 'tinhtu' | 'kimsa' | 'vanthu' | 'hukhong' | 'thienhuong';
export type ClassId = 'thanxa' | 'cuongchien' | 'phaptu' | 'hophap' | 'chusu' | 'anhsat' | 'luanhoi';

/** Billiards effect families every skill is built from. */
export type SkillKind =
  | 'vision' | 'rewind' | 'shield' | 'chill' | 'spin' | 'nudge' | 'reveal' | 'power'
  | 'blast' | 'seal' | 'maw' | 'drain' | 'gravity' | 'freeze' | 'teleport' | 'second';

export interface Sect {
  id: SectId;
  name: string;
  /** UI accent and effect glow colours. */
  main: number;
  glow: number;
}

export interface ClassInfo {
  id: ClassId;
  name: string;
  passive: string;
}

export interface SkillDef {
  /** 0, 1 = basic skills (cooldown in own turns), 2 = ultimate (needs a full energy bar). */
  slot: 0 | 1 | 2;
  name: string;
  /** First kind decides when the skill can be cast; the rest ride along. */
  kinds: SkillKind[];
  /** Strength tier fed to skillPower (champion tier, +2 for the ultimate). */
  tier: number;
  cooldown: number;
  desc: string;
}

export interface Champion {
  id: string;
  name: string;
  sect: SectId;
  tier: 1 | 2 | 3 | 4 | 5;
  cls: ClassId;
  skills: [SkillDef, SkillDef, SkillDef];
}

interface RawSkill { name: string; kinds: string[] }
interface RawChampion { id: string; name: string; sect: string; tier: number; cls: string; skills: RawSkill[] }

const hex = (s: string) => parseInt(s.slice(1), 16);

export const SECTS: Sect[] = roster.sects.map((s) => ({ id: s.id as SectId, name: s.name, main: hex(s.main), glow: hex(s.glow) }));
export const sect = (id: SectId): Sect => SECTS.find((s) => s.id === id)!;

export const CLASSES: ClassInfo[] = roster.classes.map((c) => ({ id: c.id as ClassId, name: c.name, passive: c.passive }));
export const classInfo = (id: ClassId): ClassInfo => CLASSES.find((c) => c.id === id)!;

/** Turns a basic skill of each family waits before it can be cast again. */
const KIND_COOLDOWN: Record<SkillKind, number> = {
  vision: 3, rewind: 5, shield: 4, chill: 3, spin: 2, nudge: 3, reveal: 2, power: 2,
  blast: 3, seal: 4, maw: 4, drain: 2, gravity: 4, freeze: 3, teleport: 4, second: 4,
};

/** Strength numbers per family and tier, shared by the match engine and the UI text. */
export function skillPower(kind: SkillKind, tier: number) {
  switch (kind) {
    case 'chill': return { tremor: 1.8 + 0.35 * tier };
    case 'spin': return { spin: 1.3 + 0.12 * tier };
    case 'nudge': return { radius: 0.06 + 0.025 * tier };
    case 'power': return { speed: 1.06 + 0.05 * tier };
    case 'blast': return { radius: 0.22 + 0.045 * tier, force: 2.2 + 0.45 * tier };
    case 'seal': return { pockets: tier >= 5 ? 2 : 1 };
    case 'maw': return { scale: 1.18 + 0.07 * tier };
    case 'drain': return { amount: 10 + 6 * tier };
    case 'gravity': return { pull: 0.6 + 0.25 * tier };
    case 'freeze': return { power: Math.max(0.5, 0.85 - 0.06 * tier) };
    default: return {};
  }
}

function describeKind(kind: SkillKind, tier: number): string {
  const p = skillPower(kind, tier) as Record<string, number>;
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  switch (kind) {
    case 'vision': return 'Thấy trước toàn bộ đường đi của các bi trong cú này.';
    case 'rewind': return 'Đánh hỏng? Quay ngược thời gian và đánh lại cú vừa rồi.';
    case 'shield': return 'Lỗi kế tiếp của bạn không bị phạt bi trong tay.';
    case 'chill': return `Cú kế tiếp của đối thủ run tay gấp ${p.tremor.toFixed(1)} lần và mất đường ngắm.`;
    case 'spin': return `Áp phê mạnh thêm ${pct(p.spin - 1)} và không thể trượt cơ.`;
    case 'nudge': return `Dời bi cái tối đa ${Math.round(p.radius * 100)} cm trước khi đánh.`;
    case 'reveal': return 'Hiện đường đi dài của bi mục tiêu và bi cái.';
    case 'power': return `Lực đánh tối đa tăng ${pct(p.speed - 1)}.`;
    case 'blast': return `Bi cái nổ khi chạm bi đầu tiên, hất bi trong bán kính ${Math.round(p.radius * 100)} cm.`;
    case 'seal': return `Phong ấn ${p.pockets} lỗ trong lượt kế tiếp của đối thủ.`;
    case 'maw': return `Miệng lỗ rộng thêm ${pct(p.scale - 1)}.`;
    case 'drain': return `Hút ${p.amount} năng lượng của đối thủ.`;
    case 'gravity': return 'Bi lăn gần miệng lỗ bị hút vào lỗ.';
    case 'freeze': return `Lực tối đa của đối thủ chỉ còn ${pct(p.power)} ở cú kế tiếp.`;
    case 'teleport': return 'Cầm bi trong tay: đặt bi cái ở bất kỳ đâu trên bàn.';
    case 'second': return 'Nếu cú này không vào bi và không phạm lỗi, bạn được đánh tiếp.';
  }
}

function makeSkill(raw: RawSkill, slot: 0 | 1 | 2, tier: number, cls: ClassId): SkillDef {
  const kinds = raw.kinds as SkillKind[];
  const t = slot === 2 ? tier + 2 : tier;
  const base = KIND_COOLDOWN[kinds[0]];
  return {
    slot, name: raw.name, kinds, tier: t,
    cooldown: slot === 2 ? 0 : Math.max(1, base - (cls === 'luanhoi' ? 1 : 0)),
    desc: kinds.map((k) => describeKind(k, t)).join(' '),
  };
}

export const CHAMPIONS: Champion[] = (roster.champions as RawChampion[]).map((c) => {
  const cls = c.cls as ClassId;
  const tier = c.tier as Champion['tier'];
  return {
    id: c.id, name: c.name, sect: c.sect as SectId, tier, cls,
    skills: [makeSkill(c.skills[0], 0, tier, cls), makeSkill(c.skills[1], 1, tier, cls), makeSkill(c.skills[2], 2, tier, cls)],
  };
});

export const champion = (id: string): Champion => CHAMPIONS.find((c) => c.id === id) ?? CHAMPIONS[0];

export const KIND_NAMES: Record<SkillKind, string> = {
  vision: 'Tiên tri', rewind: 'Tua thời gian', shield: 'Hộ thể', chill: 'Làm run', spin: 'Áp phê thần',
  nudge: 'Dời bi', reveal: 'Soi đường', power: 'Cuồng lực', blast: 'Bộc phá', seal: 'Phong ấn lỗ',
  maw: 'Nuốt chửng', drain: 'Hút năng lượng', gravity: 'Hấp dẫn', freeze: 'Đóng băng',
  teleport: 'Dịch chuyển', second: 'Tái chiến',
};

/** Unlock price by tier (tier-1 champions are free). */
export const CHAMPION_PRICE = [0, 0, 400, 800, 1400, 2400];

// ---------- Tables (one per sect) ----------

/**
 * Felt colours are muted mineral tones that sit in the ink-wash look, picked so every standard
 * ball colour keeps a CIE76 ΔE ≥ 25 against the cloth (tests/sect-contrast.test.ts).
 */
/** Rails are ink-washed wood everywhere; each sect's painted rail strip (art) carries its motif. */
const TABLE_LOOK: Record<SectId, { cloth: number; rail: number; railDark: number; desc: string; phys?: TableSkin['phys'] }> = {
  thienquang: { cloth: 0x3c506b, rail: 0x3b342d, railDark: 0x1f1a16, desc: 'Đá cẩm thạch trắng, nỉ lam thẫm. Bàn chuẩn mực, không đặc tính.' },
  huyetsat: { cloth: 0x5b3d3f, rail: 0x3b342d, railDark: 0x1f1a16, desc: 'Sắt đen gai. Băng cứng, bi bật mạnh hơn.', phys: { eCushion: 1.04 } },
  hoalinh: { cloth: 0x3b5d57, rail: 0x3b342d, railDark: 0x1f1a16, desc: 'Gỗ anh đào. Nỉ êm, bi lăn mượt hơn chút.', phys: { muRoll: 0.92 } },
  bangphach: { cloth: 0x436373, rail: 0x3b342d, railDark: 0x1f1a16, desc: 'Khung băng tạc. Nỉ trơn, bi lăn xa.', phys: { muRoll: 0.85, muSlide: 0.9 } },
  thienco: { cloth: 0x365858, rail: 0x3b342d, railDark: 0x1f1a16, desc: 'Đồng thau bánh răng. Bàn chuẩn xác, không đặc tính.' },
  docvu: { cloth: 0x45523b, rail: 0x3b342d, railDark: 0x1f1a16, desc: 'Gỗ mục rêu phong. Nỉ ẩm, bi chậm hơn.', phys: { muRoll: 1.12 } },
  hailong: { cloth: 0x375a61, rail: 0x3b342d, railDark: 0x1f1a16, desc: 'Gỗ thuyền đinh đồng. Băng mềm như mạn tàu.', phys: { eCushion: 0.97 } },
  uminh: { cloth: 0x3f4a44, rail: 0x3b342d, railDark: 0x1f1a16, desc: 'Gỗ đen xương. Nỉ xám tro, không đặc tính.' },
  tinhtu: { cloth: 0x453f63, rail: 0x3b342d, railDark: 0x1f1a16, desc: 'Đá núi khắc chòm sao. Bi trượt lâu hơn trước khi lăn.', phys: { muSlide: 0.9 } },
  kimsa: { cloth: 0x846e47, rail: 0x3b342d, railDark: 0x1f1a16, desc: 'Sa thạch khảm vàng. Nỉ cát nặng, ma sát cao.', phys: { muRoll: 1.15 } },
  vanthu: { cloth: 0x394f3e, rail: 0x3b342d, railDark: 0x1f1a16, desc: 'Vỏ cổ thụ. Băng mềm, bi nảy ít hơn.', phys: { eCushion: 0.95 } },
  hukhong: { cloth: 0x543d5b, rail: 0x3b342d, railDark: 0x1f1a16, desc: 'Hắc thạch nứt vỡ. Miệng lỗ rộng hơn một chút.', phys: { capture: 1.05 } },
  thienhuong: { cloth: 0x5e3a4d, rail: 0x3b342d, railDark: 0x1f1a16, desc: 'Gỗ sơn son khảm mẫu đơn. Nỉ lụa, bi trượt êm hơn.', phys: { muSlide: 0.92 } },
};

const darken = (c: number, k: number) =>
  (Math.round(((c >> 16) & 255) * k) << 16) | (Math.round(((c >> 8) & 255) * k) << 8) | Math.round((c & 255) * k);

export const SECT_TABLES: TableSkin[] = SECTS.map((s, i) => {
  const look = TABLE_LOOK[s.id];
  return {
    id: s.id, sect: s.id, name: `Linh Đài ${s.name}`, desc: look.desc,
    price: i === 0 ? 0 : 500 + 150 * i, level: 1 + i,
    cloth: look.cloth, clothDark: darken(look.cloth, 0.55), rail: look.rail, railDark: look.railDark,
    energyBonus: 0, phys: look.phys,
  };
});

// ---------- Cues (two per sect) ----------

/** Stat focus per sect: [power, aim, spin, control, energy] for the A and B cue. */
const CUE_STATS: Record<SectId, [number[], number[]]> = {
  thienquang: [[2, 4, 2, 3, 2], [3, 5, 3, 4, 3]],
  huyetsat: [[4, 2, 2, 2, 3], [5, 3, 3, 2, 4]],
  hoalinh: [[2, 3, 3, 4, 2], [3, 3, 4, 5, 3]],
  bangphach: [[2, 3, 3, 4, 2], [3, 4, 4, 5, 3]],
  thienco: [[2, 4, 3, 3, 2], [3, 5, 4, 3, 3]],
  docvu: [[2, 2, 3, 2, 4], [3, 3, 4, 3, 5]],
  hailong: [[4, 2, 3, 2, 2], [5, 3, 3, 3, 3]],
  uminh: [[2, 3, 2, 3, 4], [3, 3, 3, 4, 5]],
  tinhtu: [[2, 3, 4, 3, 2], [3, 4, 5, 3, 3]],
  kimsa: [[3, 4, 2, 3, 2], [4, 5, 3, 3, 3]],
  vanthu: [[3, 2, 3, 4, 2], [4, 3, 3, 5, 3]],
  hukhong: [[3, 2, 3, 2, 4], [5, 3, 4, 2, 4]],
  thienhuong: [[2, 3, 4, 3, 3], [3, 4, 5, 3, 4]],
};

const CUE_NAMES: Record<SectId, [string, string]> = {
  thienquang: ['Bạch Ngọc Kiếm Cơ', 'Huyền Quang Thánh Cơ'],
  huyetsat: ['Thiết Liên Cơ', 'Huyết Diệm Ma Cơ'],
  hoalinh: ['Đào Mộc Cơ', 'Ngọc Linh Phong Cơ'],
  bangphach: ['Băng Liên Cơ', 'Tuyết Nguyệt Cơ'],
  thienco: ['Đồng Kính Cơ', 'Thiên Cơ Hoàn Cơ'],
  docvu: ['Độc Mộc Cơ', 'Ngọc Hồ Lô Cơ'],
  hailong: ['Viễn Vọng Cơ', 'San Hô Neo Cơ'],
  uminh: ['Cốt Hỏa Cơ', 'Âm Đăng Cơ'],
  tinhtu: ['Tinh Quang Cơ', 'Nguyệt Câu Cơ'],
  kimsa: ['Kim Nhật Cơ', 'Sa Thạch Cơ'],
  vanthu: ['Mộc Linh Cơ', 'Hổ Phách Vũ Cơ'],
  hukhong: ['Hư Thích Cơ', 'Hư Nhãn Cơ'],
  thienhuong: ['Hồng Phiến Cơ', 'Hạc Vũ Cơ'],
};

export const SECT_CUES: CueDef[] = SECTS.flatMap((s, i) => (['a', 'b'] as const).map((v, j) => {
  const [power, aim, spin, control, energy] = CUE_STATS[s.id][j];
  return {
    id: `${s.id}-${v}`, sect: s.id, name: CUE_NAMES[s.id][j],
    desc: roster.sects[i].cues[j],
    price: j === 0 ? 400 + 120 * i : 1200 + 250 * i, level: j === 0 ? 2 + i : 4 + i,
    power, aim, spin, control, energy,
    colors: { shaft: 0xeedcae, wrap: darken(s.main, 0.45), butt: darken(s.main, 0.7), accent: s.glow, ferrule: 0xf3f0e6 },
  };
}));

// ---------- Art ----------

// Absolute URLs: these also end up inside CSS variables, where a relative path would
// resolve against the stylesheet instead of the page.
const BASE = typeof document === 'undefined' ? import.meta.env.BASE_URL : new URL(import.meta.env.BASE_URL, document.baseURI).href;
export const portraitUrl = (id: string) => `${BASE}art/champions/${id}/portrait.webp`;
export const cutoutUrl = (id: string) => `${BASE}art/champions/${id}/cutout.webp`;
export const winUrl = (id: string) => `${BASE}art/champions/${id}/win.webp`;
export const exprUrl = (id: string, e: 'focus' | 'joy' | 'sad' | 'cast') => `${BASE}art/champions/${id}/expr-${e}.webp`;
export const skillIconUrl = (id: string, slot: number) => `${BASE}art/skills/${id}-${'12u'[slot]}.webp`;
export const sectArtUrl = (s: SectId, name: 'emblem' | 'splash' | 'cutin' | 'rail' | 'cue-a' | 'cue-b') => `${BASE}art/sects/${s}/${name}.webp`;
export const vfxUrl = (s: SectId, el: string) => `${BASE}art/sects/${s}/vfx/${el}.webp`;
