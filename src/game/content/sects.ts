import roster from './roster.json';
import type { CueDef, TableSkin } from './gear';

/** Cơ Tiên Giới content: sects (lands), classes, champions and their three skills. */

export type SectId =
  | 'thienquang' | 'huyetsat' | 'hoalinh' | 'bangphach' | 'thienco' | 'docvu'
  | 'hailong' | 'uminh' | 'tinhtu' | 'kimsa' | 'vanthu' | 'hukhong' | 'thienhuong';
export type ClassId = 'thanxa' | 'cuongchien' | 'phaptu' | 'hophap' | 'chusu' | 'anhsat' | 'luanhoi';

export type ChampionKind = 'hiepkhach' | 'nuhiep' | 'yeu' | 'linh' | 'co' | 'ma';
export const KIND_LABEL: Record<ChampionKind, string> = {
  hiepkhach: 'Hiệp Khách', nuhiep: 'Nữ Hiệp', yeu: 'Yêu Tộc',
  linh: 'Tinh Linh', co: 'Linh Tượng', ma: 'Ma Vật',
};

/** Billiards effect families every skill is built from. */
export type SkillKind =
  | 'vision' | 'rewind' | 'shield' | 'chill' | 'spin' | 'nudge' | 'reveal' | 'power'
  | 'blast' | 'seal' | 'maw' | 'drain' | 'gravity' | 'freeze' | 'teleport' | 'second'
  | 'slick' | 'sand' | 'bumper' | 'railcraft' | 'wind' | 'well' | 'spinwash' | 'vortex'
  | 'blind' | 'drift' | 'called' | 'displace' | 'swap' | 'decoy' | 'counter' | 'puppet' | 'silk' | 'quake';

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

export type UltId = SectId;
export type SkillShape = 'gate' | 'roots' | 'rim';

export interface SkillDef {
  ult?: UltId;
  shape?: SkillShape;
  /** 0, 1 = basic skills (cooldown in own turns), 2 = ultimate (needs a full energy bar). */
  slot: 0 | 1 | 2;
  name: string;
  /** Any ready family allows casting; the entire package fires together. */
  kinds: SkillKind[];
  /** Strength tier fed to skillPower (champion tier, +2 for the ultimate). */
  tier: number;
  target?: 'self' | 'opponent' | 'both';
  /** How many of the recipient's shots the effect lasts. */
  turns?: number;
  cooldown: number;
  desc: string;
}

export interface Champion {
  id: string;
  name: string;
  sect: SectId;
  tier: 1 | 2 | 3 | 4 | 5;
  kind: ChampionKind;
  cls: ClassId;
  skills: [SkillDef, SkillDef, SkillDef];
}

interface RawSkill { name: string; kinds: string[]; ult?: UltId; shape?: SkillShape; target?: SkillDef['target']; turns?: number }
interface RawChampion { id: string; name: string; sect: string; tier: number; kind: ChampionKind; cls: string; skills: RawSkill[] }

const hex = (s: string) => parseInt(s.slice(1), 16);

export const SECTS: Sect[] = roster.sects.map((s) => ({ id: s.id as SectId, name: s.name, main: hex(s.main), glow: hex(s.glow) }));
export const sect = (id: SectId): Sect => SECTS.find((s) => s.id === id)!;

export const CLASSES: ClassInfo[] = roster.classes.map((c) => ({ id: c.id as ClassId, name: c.name, passive: c.passive }));
export const classInfo = (id: ClassId): ClassInfo => CLASSES.find((c) => c.id === id)!;

/** Turns a basic skill of each family waits before it can be cast again. */
const KIND_COOLDOWN: Record<SkillKind, number> = {
  slick: 2, sand: 3, bumper: 3, railcraft: 2, wind: 2, well: 3, spinwash: 2, vortex: 3,
  vision: 3, rewind: 3, shield: 3, chill: 3, spin: 2, nudge: 3, reveal: 2, power: 2,
  blast: 3, seal: 3, maw: 3, drain: 2, gravity: 3, freeze: 3, teleport: 3, second: 3,
  blind: 2, drift: 2, called: 3, displace: 3, swap: 3, decoy: 3, counter: 3, puppet: 3, silk: 3, quake: 3,
};

/**
 * Ladder step of each family: 1 self or information, 2 one-shot disruption, 3 light control of the opponent,
 * 4 forcing rules and moving balls, 5 breaking rules. Skill 2 sits on its champion's tier, the ultimate one step
 * higher (capped at 5); a skill's step is its highest family.
 */
export const KIND_RANK: Record<SkillKind, 1 | 2 | 3 | 4 | 5> = {
  vision: 1, reveal: 1, shield: 1, spin: 1, power: 1, second: 1, nudge: 1, blind: 1,
  chill: 2, freeze: 2, sand: 2, slick: 2, spinwash: 2, bumper: 2, railcraft: 2, wind: 2, well: 2, vortex: 2, blast: 2, drain: 2,
  drift: 3, decoy: 3,
  silk: 4, called: 4, displace: 4, seal: 4, maw: 4, gravity: 4,
  swap: 5, teleport: 5, counter: 5, puppet: 5, rewind: 5, quake: 5,
};

/** Strength numbers per family and tier, shared by the match engine and the UI text. */
export function skillPower(kind: SkillKind, tier: number) {
  switch (kind) {
    case 'slick': return { radius: 0.12 + 0.02 * tier, friction: 0.80 - 0.04 * tier };
    case 'sand': return { radius: 0.10 + 0.02 * tier, friction: 1.3 + 0.12 * tier };
    case 'bumper': return { length: 0.08 + 0.02 * tier };
    case 'railcraft': return { length: 0.25 + 0.05 * tier, restitution: 0.08 + 0.02 * tier };
    case 'wind': return { acceleration: 0.01 + 0.004 * tier };
    case 'well': case 'vortex': return { radius: 0.14 + 0.02 * tier, acceleration: 0.015 + 0.003 * tier };
    case 'spinwash': return { radius: 0.12 + 0.015 * tier, friction: 1.2 + 0.15 * tier };
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
    case 'drift': return { angle: 0.6 + 0.25 * tier };
    case 'displace': return { pockets: tier >= 4 ? 2 : 1 };
    case 'decoy': return { count: tier >= 4 ? 3 : 2 };
    case 'counter': return { amount: 20 + 5 * tier };
    case 'silk': return { radius: 0.09 + 0.01 * tier, acceleration: 0.015 + 0.003 * tier };
    case 'quake': return { time: 1.2, factor: 1.6 };
    case 'blind': case 'called': case 'swap': case 'puppet': return {};
    default: return {};
  }
}

function describeKind(kind: SkillKind, tier: number): string {
  const p = skillPower(kind, tier) as Record<string, number>;
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  switch (kind) {
    case 'slick': return `Trải một vùng nỉ trơn (rộng ${Math.round(p.radius * 200)} cm): bi lăn qua đi xa và nhanh hơn.`;
    case 'sand': return `Rải một vùng cát (rộng ${Math.round(p.radius * 200)} cm): bi lăn qua chậm hẳn lại.`;
    case 'spinwash': return `Vùng mực tan xoáy (rộng ${Math.round(p.radius * 200)} cm): bi đi qua mất dần áp phê.`;
    case 'bumper': return `Dựng một vật chắn dài ${Math.round(p.length * 100)} cm trên nỉ: bi chạm vào bật ra như chạm băng.`;
    case 'railcraft': return `Yểm một đoạn băng dài ${Math.round(p.length * 100)} cm: chọn băng mềm để bi nảy ít, băng cứng để nảy mạnh.`;
    case 'wind': return 'Gọi một luồng gió theo hướng chọn: bi đang lăn bị đẩy lệch dần theo gió.';
    case 'well': return `Đặt một điểm hút trên nỉ (rộng ${Math.round(p.radius * 200)} cm): bi lăn gần bị kéo cong vào tâm.`;
    case 'vortex': return `Tạo một dòng xoáy (rộng ${Math.round(p.radius * 200)} cm): bi lăn qua bị bẻ cong theo chiều xoáy.`;
    case 'vision': return 'So sánh ba đường dự đoán theo lực đánh hoặc áp phê đã chọn trong cú này.';
    case 'rewind': return 'Đánh hỏng? Quay ngược thời gian và đánh lại cú vừa rồi.';
    case 'shield': return 'Lỗi kế tiếp của bạn không bị phạt bi trong tay.';
    case 'chill': return `Cú kế tiếp của đối thủ run tay gấp ${p.tremor.toFixed(1)} lần và mất đường ngắm.`;
    case 'spin': return `Áp phê mạnh thêm ${pct(p.spin - 1)} và không thể trượt cơ.`;
    case 'nudge': return `Dời bi cái tối đa ${Math.round(p.radius * 100)} cm trước khi đánh.`;
    case 'reveal': return 'Hiện đường đi dài của bi mục tiêu và bi cái.';
    case 'power': return `Lực đánh tối đa tăng ${pct(p.speed - 1)}.`;
    case 'blast': return `Bi cái phát xung theo hình quạt hướng đánh khi chạm bi đầu tiên, hất bi trong bán kính ${Math.round(p.radius * 100)} cm.`;
    case 'seal': return `Phong ấn ${p.pockets} lỗ trong lượt kế tiếp của đối thủ.`;
    case 'maw': return `Miệng lỗ rộng thêm ${pct(p.scale - 1)}.`;
    case 'drain': return `Hút ${p.amount} năng lượng của đối thủ.`;
    case 'gravity': return 'Bi lăn gần miệng lỗ bị hút vào lỗ.';
    case 'freeze': return `Lực tối đa của đối thủ chỉ còn ${pct(p.power)} ở cú kế tiếp.`;
    case 'teleport': return 'Cầm bi trong tay: đặt bi cái ở bất kỳ đâu trên bàn.';
    case 'second': return 'Nếu cú này không vào bi và không phạm lỗi, bạn được đánh tiếp.';
    case 'blind': return 'Đối thủ mất đường ngắm và đường bi dự đoán ở các cú tiếp theo.';
    case 'drift': return `Hướng đánh của đối thủ bị dắt lệch ${p.angle.toFixed(1)} độ theo chiều chọn.`;
    case 'called': return 'Chỉ định một bi đối thủ phải chạm trước; chạm bi khác trước là lỗi.';
    case 'displace': return `Dời tối đa ${p.pockets} bi đối thủ đang sát lỗ tới chỗ trống an toàn về giữa bàn.`;
    case 'swap': return 'Đổi chỗ bi của bạn xa nhất với bi đối thủ dễ ăn nhất.';
    case 'decoy': return `Đặt ${p.count} bi giả là vật chắn tròn cạnh bi mục tiêu của đối thủ.`;
    case 'counter': return `Đặt úp: hoá giải chiêu đối thủ ở lượt kế và hút ${p.amount} năng lượng.`;
    case 'puppet': return 'Bạn đánh trọn cú kế của đối thủ bằng bi cái của họ; cú đó không tính lỗi.';
    case 'silk': return 'Trải dải lụa chữ S bằng ba xoáy nhỏ, bẻ cong đường bi bằng lực thật.';
    case 'quake': return `Nghiêng bàn theo hướng chọn (${p.time.toFixed(1)} giây), bi nằm yên cũng bị kéo theo.`;
    default: return '';
  }
}

export const SECT_SIGNATURES: Record<SectId, string> = {
  thienquang: 'Kiếm nhãn: so sánh ba đường dự đoán theo lực đánh hoặc áp phê.',
  huyetsat: 'Huyết bộc: xung lực hình quạt theo hướng đánh.',
  hoalinh: 'Dẫn phong: chọn hướng gió tác động lên bi đang lăn.',
  bangphach: 'Băng lộ: đặt vùng trơn để kéo dài đường lăn.',
  thienco: 'Cơ quan: đặt vật phản xạ theo hướng chọn.',
  docvu: 'Tán toàn: đặt vùng tiêu áp phê.',
  hailong: 'Hải băng: chọn đoạn băng mềm hoặc cứng, kết hợp dòng chảy có hướng.',
  uminh: 'Âm môn: đặt cặp vật chắn chừa cổng ở giữa.',
  tinhtu: 'Tinh điểm: đặt giếng hút làm cong đường lăn.',
  kimsa: 'Sa trận: đặt vùng cát hãm bi.',
  vanthu: 'Mộc căn: đặt cặp rễ chắn hình chữ V.',
  hukhong: 'Hư nhãn: hút sát miệng lỗ; bàn phăng dùng giếng hút trên nỉ.',
  thienhuong: 'Toàn lưu: đặt dòng xoáy và chọn chiều thuận hoặc nghịch.',
};

const ULT_DESCRIPTIONS: Record<UltId, string> = {
  thienquang: 'Ba đường dự đoán để so sánh lực đánh hoặc áp phê trước khi ra cơ.',
  huyetsat: 'Xung lực hình quạt chỉ hất những bi nằm phía trước hướng đánh.',
  hoalinh: 'Hai vùng gió song song thổi ngược chiều nhau.',
  bangphach: 'Hành lang trơn có vùng hãm ở hai đầu.',
  thienco: 'Hai vật phản xạ đặt chéo góc để dẫn đường bi.',
  docvu: 'Vành tán áp phê bao quanh lõi trơn.',
  hailong: 'Dòng chảy hướng chọn kết hợp điểm hút ở cuối dòng và chỉnh băng.',
  uminh: 'Hai vật chắn tạo cổng mở ở giữa.',
  tinhtu: 'Hai giếng hút nằm ở hai đầu trục chọn.',
  kimsa: 'Dải cát chia đôi, chừa khe giữa rộng hơn đường kính bi.',
  vanthu: 'Hai rễ chắn hợp thành chữ V.',
  hukhong: 'Các điểm hút nằm sát miệng lỗ; trên bàn phăng là một giếng hút đặt trên nỉ.',
  thienhuong: 'Hai dòng xoáy ngược chiều nằm trên trục chọn.',
};
const SHAPE_DESCRIPTIONS: Record<SkillShape, string> = {
  gate: 'Hai vật chắn tạo cổng mở ở giữa.',
  roots: 'Hai rễ chắn hợp thành chữ V.',
  rim: 'Điểm hút sát miệng lỗ; trên bàn phăng đặt giếng hút trên nỉ.',
};

function makeSkill(raw: RawSkill, slot: 0 | 1 | 2, tier: number): SkillDef {
  const kinds = raw.kinds as SkillKind[];
  const t = slot === 2 ? tier + 2 : tier;
  const base = KIND_COOLDOWN[kinds[0]];
  const duration = raw.turns === undefined || raw.turns <= 1 ? '' : ` Trong ${raw.turns} cú của ${raw.target === 'self' ? 'bạn' : 'đối thủ'}.`;
  return {
    slot, name: raw.name, kinds, tier: t, ult: raw.ult, shape: raw.shape, target: raw.target, turns: raw.turns,
    cooldown: slot === 2 ? 0 : base,
    desc: [raw.ult ? ULT_DESCRIPTIONS[raw.ult] : raw.shape ? SHAPE_DESCRIPTIONS[raw.shape] : '', ...kinds.map((k) => describeKind(k, t))].filter(Boolean).join(' ') + duration,
  };
}

export const CHAMPIONS: Champion[] = (roster.champions as RawChampion[]).map((c) => {
  const cls = c.cls as ClassId;
  const tier = c.tier as Champion['tier'];
  return {
    id: c.id, name: c.name, sect: c.sect as SectId, tier, kind: c.kind, cls,
    skills: [makeSkill(c.skills[0], 0, tier), makeSkill(c.skills[1], 1, tier), makeSkill(c.skills[2], 2, tier)],
  };
});

export const champion = (id: string): Champion => CHAMPIONS.find((c) => c.id === id) ?? CHAMPIONS[0];



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

/** Player-facing cue descriptions (roster.json keeps the English art prompts). */
const CUE_DESC: Record<SectId, [string, string]> = {
  thienquang: ['Cơ bạch ngọc, cổ cơ bọc chắn kiếm bằng vàng.', 'Cơ vàng ngà, đuôi khảm đĩa mặt trời.'],
  huyetsat: ['Cơ sắt đen quấn xích đỏ.', 'Cơ hắc diện thạch, đầu cơ cháy lửa đỏ thẫm.'],
  hoalinh: ['Cơ gỗ đào chạm hoa.', 'Cơ ngọc nhạt buộc tua lụa.'],
  bangphach: ['Cơ băng pha lê, đầu hình sen.', 'Cơ bạc và băng, vòng hoa tuyết.'],
  thienco: ['Cơ đồng và gỗ tếch, đuôi khảm bánh răng.', 'Cơ gỗ tếch, khớp nối có vòng con quay.'],
  docvu: ['Cơ gỗ độc cong queo, rỉ nọc.', 'Cơ trúc treo hồ lô ngọc.'],
  hailong: ['Cơ gỗ tếch và đồng như ống nhòm.', 'Cơ san hô, đuôi hình mỏ neo.'],
  uminh: ['Cơ xương với những vòng lửa ma.', 'Cơ gỗ đen có móc treo đèn lồng.'],
  tinhtu: ['Cơ bạc ngưng tụ từ ánh sao.', 'Cơ tím, đầu hình trăng khuyết.'],
  kimsa: ['Cơ vàng, đầu cơ mặt trời.', 'Cơ sa thạch, đai lam ngọc.'],
  vanthu: ['Cơ gỗ sống còn đâm lá.', 'Cơ hổ phách và xương, kết lông vũ.'],
  hukhong: ['Cơ gai đen rỉ ánh tím.', 'Cơ vỏ giáp, khảm một con mắt hư không.'],
  thienhuong: ['Cơ sơn mài đỏ, cổ cơ mẫu đơn vàng, tua lụa.', 'Cơ ngà vẽ hạc múa và lá vàng.'],
};

export const SECT_CUES: CueDef[] = SECTS.flatMap((s, i) => (['a', 'b'] as const).map((v, j) => {
  const [power, aim, spin, control, energy] = CUE_STATS[s.id][j];
  return {
    id: `${s.id}-${v}`, sect: s.id, name: CUE_NAMES[s.id][j],
    desc: CUE_DESC[s.id][j],
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
/** Finishing-strike pose for the rack-winning shot. */
export const finisherUrl = (id: string) => `${BASE}art/champions/${id}/finisher.webp`;
export const exprUrl = (id: string, e: 'focus' | 'joy' | 'sad' | 'cast') => `${BASE}art/champions/${id}/expr-${e}.webp`;
export const skillIconUrl = (id: string, slot: number) => `${BASE}art/skills/${id}-${'12u'[slot]}.webp`;
export const sectArtUrl = (s: SectId, name: 'emblem' | 'splash' | 'cutin' | 'rail' | 'cue-a' | 'cue-b') => `${BASE}art/sects/${s}/${name}.webp`;
export const vfxUrl = (s: SectId, el: string) => `${BASE}art/sects/${s}/vfx/${el}.webp`;
