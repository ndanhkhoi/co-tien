import type { SkillDef, SkillKind } from './sects';

/** How a family is used in a match; one sentence per way, shown as "Cách dùng" on the skill card. */
type UseWay = 'place' | 'own' | 'cue' | 'move' | 'decoy' | 'hex' | 'hexAlong' | 'called' | 'calledAuto' | 'guard' | 'counter' | 'rewind' | 'puppet';

const KIND_WAY: Record<SkillKind, UseWay> = {
  slick: 'place', sand: 'place', bumper: 'place', railcraft: 'place', wind: 'place', well: 'place',
  spinwash: 'place', vortex: 'place', silk: 'place', quake: 'place',
  vision: 'own', reveal: 'own', spin: 'own', power: 'own', blast: 'own', maw: 'own', gravity: 'own', second: 'own',
  teleport: 'cue', nudge: 'cue',
  displace: 'move', swap: 'move',
  decoy: 'decoy',
  chill: 'hex', freeze: 'hex', seal: 'hex', blind: 'hex', drift: 'hex', drain: 'hex',
  called: 'called',
  shield: 'guard',
  counter: 'counter',
  rewind: 'rewind',
  puppet: 'puppet',
};

const WAY_TEXT: Record<UseWay, string> = {
  place: 'Bấm Dùng rồi đặt lên bàn: kéo hoặc chạm bàn để dời; đường dự đoán chạy theo để bạn thấy chiêu bẻ cú đánh ra sao. THI TRIỂN để xác nhận, Huỷ đặt chiêu thì không mất chiêu.',
  own: 'Dùng trong lượt của bạn, trước khi đánh: tác dụng lên cú đánh bạn sắp đánh.',
  cue: 'Dùng trong lượt của bạn: sau khi bấm, kéo bi cái tới chỗ muốn rồi bấm ĐẶT BI.',
  move: 'Dùng trong lượt của bạn khi mọi bi đứng yên: bi được dời ngay, không cần đặt.',
  decoy: 'Dùng trong lượt của bạn: bi giả hiện ngay cạnh bi mục tiêu của đối thủ, không cần đặt.',
  hex: 'Bấm Dùng là có tác dụng ngay lên cú đánh kế của đối thủ, dùng được cả khi đang tới lượt họ; chip hiện dưới bảng tên đối thủ.',
  hexAlong: 'Hiệu ứng đi kèm áp lên cú đánh kế của đối thủ; chip hiện dưới bảng tên đối thủ.',
  called: 'Bấm Dùng rồi chạm quả bi của đối thủ cần chỉ định (quả gần lỗ nhất được chọn sẵn, có vòng son), bấm THI TRIỂN; Huỷ đặt chiêu thì không mất chiêu. Ngoài lượt của bạn, game tự chọn quả gần lỗ nhất.',
  calledAuto: 'Quả bi bị chỉ định là quả của đối thủ nằm gần lỗ nhất, có vòng son ngay khi đặt.',
  guard: 'Dùng được cả ngoài lượt của bạn, miễn bàn đứng yên.',
  counter: 'Dùng được cả ngoài lượt của bạn: chiêu úp chờ sẵn, đối thủ dùng chiêu ở lượt kế thì bị hoá giải.',
  rewind: 'Chỉ dùng được ngay sau cú đánh bạn vừa đánh, khi lượt đã sang đối thủ mà họ chưa đánh: bàn quay về trước cú đánh ấy để bạn đánh lại.',
  puppet: 'Dùng trong lượt của bạn: tới lượt đối thủ, chính bạn ngắm và thực hiện cú đánh của họ.',
};

/** "Cách dùng" for a skill package: the ways of its families in order, without repeats. */
export function skillUsage(sk: Pick<SkillDef, 'kinds'>): string {
  // A package laid on the cloth has no separate ball tap, so its called ball is picked for the caster.
  const placed = sk.kinds.some((k) => KIND_WAY[k] === 'place');
  const called = sk.kinds.some((k) => KIND_WAY[k] === 'called');
  const way = (k: SkillKind): UseWay => {
    const w = KIND_WAY[k];
    if (w === 'called' && placed) return 'calledAuto';
    // The called step already says how to cast, so a hex in the same package only says what it adds.
    return w === 'hex' && called ? 'hexAlong' : w;
  };
  const ways = [...new Set(sk.kinds.map(way))];
  const extra = placeControls(sk.kinds);
  // A rewind replays your shot, so own-shot buffs in the same package apply to the replay.
  if (ways.includes('rewind') && ways.includes('own')) {
    return [...ways.filter((w) => w !== 'own').map((w) => WAY_TEXT[w]), 'Hiệu ứng đi kèm áp vào cú đánh lại.'].join(' ');
  }
  return [...ways.map((w) => WAY_TEXT[w]), extra].filter(Boolean).join(' ');
}

/** The placement controls a package really has: only swirls change direction of turn, only rails soft or hard. */
function placeControls(kinds: SkillKind[]): string {
  const parts: string[] = [];
  if (kinds.some((k) => k === 'wind' || k === 'quake' || k === 'bumper' || k === 'railcraft')) parts.push('hai nút xoay đổi hướng');
  if (kinds.some((k) => k === 'vortex' || k === 'silk')) parts.push('nút Đổi đảo chiều xoáy');
  if (kinds.includes('railcraft')) parts.push('nút Đổi chọn băng mềm hoặc cứng');
  return parts.length ? `Khi đặt: ${parts.join(', ')}.` : '';
}

/** Families that act on the opponent's shots whatever the skill's target says. */
const ON_OPPONENT: SkillKind[] = ['chill', 'freeze', 'seal', 'blind', 'drift', 'called', 'decoy', 'puppet'];
/** Families that act once, the moment they are cast. */
const INSTANT: SkillKind[] = ['displace', 'swap', 'drain', 'teleport', 'nudge', 'rewind'];

/** "Tác dụng": whose shots the skill touches and for how many, or that it acts at once. */
export function skillReach(sk: Pick<SkillDef, 'kinds' | 'target' | 'turns'>): string {
  const n = Math.max(1, sk.turns ?? 1);
  const shots = n === 1 ? 'cú đánh kế' : `${n} cú đánh kế`;
  if (sk.kinds.every((k) => INSTANT.includes(k))) return 'Có tác dụng ngay khi dùng.';
  if (sk.kinds.includes('counter')) return 'Úp chờ tới lượt kế của đối thủ.';
  if (sk.kinds.some((k) => ON_OPPONENT.includes(k)) || sk.target === 'opponent') return `Lên ${shots} của đối thủ.`;
  if (sk.target === 'both') return `Lên ${shots} của cả hai bên.`;
  if (sk.kinds.includes('shield')) return 'Đỡ lỗi kế tiếp của bạn.';
  return `Lên ${shots} của bạn.`;
}
