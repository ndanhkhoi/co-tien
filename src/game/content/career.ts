import type { Personality } from '../../ai/types';
import type { GameMode } from '../../core/rules/types';
import type { MutatorId, SkillId } from './gear';

export interface AvatarLook {
  skin: string;
  hair: string;
  shirt: string;
  /** 0 short, 1 long, 2 bald, 3 cap, 4 bun, 5 spiky */
  style: number;
  glasses?: boolean;
  beard?: boolean;
}

export interface Npc {
  id: string;
  name: string;
  title: string;
  look: AvatarLook;
  mode: GameMode;
  level: 1 | 2 | 3 | 4;
  personality: Personality;
  raceTo: number;
  caromTarget?: number;
  mutator: MutatorId | null;
  skills: SkillId[];
  cueId: string;
  intro: string;
  winLine: string;
  loseLine: string;
  coins: number;
  xp: number;
}

export interface Chapter {
  id: string;
  name: string;
  place: string;
  desc: string;
  npcs: Npc[];
}

export const CHAPTERS: Chapter[] = [
  {
    id: 'hem', name: 'Quán Đầu Hẻm', place: 'Sài Gòn · Quận 4',
    desc: 'Bàn lỗ cũ, nỉ sờn, tiếng quạt trần. Nơi mọi cơ thủ bắt đầu.',
    npcs: [
      {
        id: 'ti', name: 'Tí Lùn', title: 'Phụ quán', look: { skin: '#e9b98f', hair: '#1b1b1b', shirt: '#e8503a', style: 5 },
        mode: 'eight', level: 1, personality: 'balanced', raceTo: 2, mutator: null, skills: ['eagle'], cueId: 'house',
        intro: 'Anh mới tới hả? Chơi một trận 8 bi cho vui, thua thì bao em ly trà đá nha!',
        winLine: 'Hehe, trà đá của em đâu anh?', loseLine: 'Trời, anh đánh ác quá. Để em đi lau bàn…',
        coins: 120, xp: 80,
      },
      {
        id: 'ba', name: 'Chú Ba Xe Ôm', title: 'Khách quen', look: { skin: '#c98f62', hair: '#555', shirt: '#3a6ea5', style: 3, beard: true },
        mode: 'eight', level: 1, personality: 'defensive', raceTo: 2, mutator: null, skills: ['shield'], cueId: 'house',
        intro: 'Chạy xe cả ngày, tối ghé đánh vài ván. Chú đánh chậm mà chắc, con đừng nóng.',
        winLine: 'Thấy chưa, chậm mà chắc!', loseLine: 'Được, được. Tay con có nghề đó.',
        coins: 150, xp: 100,
      },
      {
        id: 'tu', name: 'Bà Tư Bán Nước', title: 'Chủ quán — trùm hẻm', look: { skin: '#e2a97c', hair: '#8a8a8a', shirt: '#7a3b8f', style: 4 },
        mode: 'eight', level: 2, personality: 'trickster', raceTo: 3, mutator: null, skills: ['tremor', 'spin2'], cueId: 'bamboo',
        intro: 'Ba chục năm đứng quầy, coi người ta đánh còn nhiều hơn con ăn cơm. Thử coi.',
        winLine: 'Về tập thêm đi con, bàn này còn mở cửa tới khuya.', loseLine: 'Khá lắm. Qua Phú Nhuận đi, tụi nó chờ con đó.',
        coins: 300, xp: 180,
      },
    ],
  },
  {
    id: 'clb', name: 'CLB Phú Nhuận', place: 'Sài Gòn · Phú Nhuận',
    desc: 'Bàn chuẩn, đèn trắng, cơ thủ nghiêm túc. Ở đây người ta đánh 9 bi.',
    npcs: [
      {
        id: 'hung', name: 'Hùng Sẹo', title: 'Tay phá bi', look: { skin: '#b97c55', hair: '#111', shirt: '#222', style: 0, beard: true },
        mode: 'nine', level: 2, personality: 'aggressive', raceTo: 3, mutator: null, skills: ['spin2', 'tremor'], cueId: 'blackdragon',
        intro: 'Tao phá một phát là bàn sạch. Mày đứng đó mà coi.',
        winLine: 'Nói rồi mà, một phát là xong.', loseLine: 'Hừ… lần sau tao phá mạnh hơn.',
        coins: 320, xp: 220,
      },
      {
        id: 'thu', name: 'Kim Thư', title: 'Hoa khôi CLB', look: { skin: '#f1c7a5', hair: '#3b2416', shirt: '#2fa37a', style: 1 },
        mode: 'nine', level: 2, personality: 'balanced', raceTo: 3, mutator: 'ice', skills: ['eagle', 'shield'], cueId: 'bamboo',
        intro: 'Bàn em mới thay nỉ, trơn lắm đó. Anh nhẹ tay thôi kẻo bi chạy mất.',
        winLine: 'Nỉ trơn vậy mà, anh nên tập đánh nhẹ hơn.', loseLine: 'Ồ, anh làm chủ được nỉ băng rồi kìa!',
        coins: 350, xp: 240,
      },
      {
        id: 'dang', name: 'Lão Đặng', title: 'Thầy dạy bida', look: { skin: '#d8a27a', hair: '#e8e8e8', shirt: '#6b5b3a', style: 2, glasses: true },
        mode: 'nine', level: 3, personality: 'defensive', raceTo: 4, mutator: null, skills: ['shield', 'rewind'], cueId: 'phoenix',
        intro: 'Bida không phải ăn bi. Bida là để lại cho đối thủ một bàn không có lối ra.',
        winLine: 'Con thấy chưa? Phòng thủ cũng là tấn công.', loseLine: 'Trò giỏi hơn thầy. Lên thành phố đi.',
        coins: 500, xp: 360,
      },
    ],
  },
  {
    id: 'thanhpho', name: 'Giải Thành Phố', place: 'Nhà thi đấu Phan Đình Phùng',
    desc: 'Gọi bi, gọi lỗ. Bàn giải có đủ trò quái — chỉ người lì mới trụ được.',
    npcs: [
      {
        id: 'minh', name: 'Minh Mập', title: 'Ảo thuật gia', look: { skin: '#e3b089', hair: '#2a1a10', shirt: '#f2b23a', style: 0 },
        mode: 'ten', level: 3, personality: 'trickster', raceTo: 3, mutator: 'ghost', skills: ['tremor', 'eagle'], cueId: 'phoenix',
        intro: 'Bàn này có ma đó nha. Mỗi lượt một lỗ biến mất — gọi lỗ cho khéo!',
        winLine: 'Lỗ ma ăn mất bi của anh rồi, haha!', loseLine: 'Anh không sợ ma luôn hả?',
        coins: 520, xp: 400,
      },
      {
        id: 'vy', name: 'Thảo Vy', title: 'Á quân năm ngoái', look: { skin: '#f0c4a0', hair: '#111', shirt: '#c2185b', style: 1 },
        mode: 'ten', level: 3, personality: 'balanced', raceTo: 4, mutator: 'fog', skills: ['shield', 'spin2'], cueId: 'icemind',
        intro: 'Sương máy khói sân khấu dày lắm. Nhìn không rõ thì đánh bằng cảm giác thôi.',
        winLine: 'Cảm giác của anh chưa đủ tới.', loseLine: 'Anh đánh mù mà vẫn chuẩn vậy sao…',
        coins: 600, xp: 450,
      },
      {
        id: 'quan', name: 'Quân Bắc Ninh', title: 'Pháo thủ', look: { skin: '#cf9a6e', hair: '#1a1a1a', shirt: '#4a148c', style: 5 },
        mode: 'ten', level: 3, personality: 'aggressive', raceTo: 4, mutator: 'bomb', skills: ['spin2', 'tremor'], cueId: 'blackdragon',
        intro: 'Bi có gắn ngòi nổ. Tôi thích nghe tiếng nổ, còn anh?',
        winLine: 'Bùm! Hết trận.', loseLine: 'Anh gỡ bom giỏi thật. Ra Hà Nội thử sức đi.',
        coins: 700, xp: 520,
      },
    ],
  },
  {
    id: 'phang', name: 'Đất Phăng Hà Thành', place: 'Hà Nội · Phố cổ',
    desc: 'Không lỗ, ba bi, những đường băng như vẽ. Người Hà Nội chơi phăng.',
    npcs: [
      {
        id: 'tien', name: 'Cụ Tiến', title: 'Lão làng phố cổ', look: { skin: '#d9a679', hair: '#f0f0f0', shirt: '#5d4037', style: 2, beard: true },
        mode: 'carom-libre', level: 2, personality: 'balanced', raceTo: 2, caromTarget: 8, mutator: null, skills: ['eagle'], cueId: 'bamboo',
        intro: 'Phăng tự do: bi cái chạm đủ hai bi là ăn. Dễ mà khó, cháu ạ.',
        winLine: 'Cháu còn non tay lắm.', loseLine: 'Giỏi! Thử ba băng xem nào.',
        coins: 600, xp: 480,
      },
      {
        id: 'duc', name: 'Đức Mắt Kính', title: 'Kỹ sư hình học', look: { skin: '#e8b994', hair: '#222', shirt: '#455a64', style: 0, glasses: true },
        mode: 'carom-3c', level: 3, personality: 'defensive', raceTo: 2, caromTarget: 4, mutator: null, skills: ['eagle', 'shield'], cueId: 'icemind',
        intro: 'Ba băng là toán học. Hệ thống kim cương, góc tới bằng góc phản xạ… cộng thêm phê.',
        winLine: 'Sai số của anh lớn quá.', loseLine: 'Phương trình của anh đúng rồi.',
        coins: 800, xp: 600,
      },
      {
        id: 'hoang', name: 'Hoàng Phăng', title: 'Vua ba băng', look: { skin: '#c88d63', hair: '#0d0d0d', shirt: '#b71c1c', style: 0 },
        mode: 'carom-3c', level: 4, personality: 'trickster', raceTo: 2, caromTarget: 5, mutator: null, skills: ['spin2', 'tremor'], cueId: 'phoenix',
        intro: 'Hà Nội này chưa ai thắng tôi ba băng trong năm nay.',
        winLine: 'Năm nay vẫn chưa có ai.', loseLine: 'Anh là người đầu tiên. Giải quốc gia đang chờ.',
        coins: 1000, xp: 800,
      },
    ],
  },
  {
    id: 'quocgia', name: 'Vô Địch Quốc Gia', place: 'Cung thể thao Quần Ngựa',
    desc: 'Lỗ hẹp, đèn truyền hình, cả nước dõi theo. Ngai vàng chỉ có một.',
    npcs: [
      {
        id: 'baolong', name: 'Bảo Long', title: 'Đương kim vô địch 9 bi', look: { skin: '#dba47c', hair: '#1c1c1c', shirt: '#0d47a1', style: 0 },
        mode: 'nine', level: 4, personality: 'balanced', raceTo: 5, mutator: 'tight', skills: ['shield', 'rewind'], cueId: 'icemind',
        intro: 'Lỗ thi đấu hẹp lắm. Ở đây không có cú may mắn.',
        winLine: 'Chuẩn quốc gia là vậy.', loseLine: 'Anh xứng đáng vào chung kết.',
        coins: 1400, xp: 1100,
      },
      {
        id: 'maianh', name: 'Mai Anh', title: 'Nữ hoàng 10 bi', look: { skin: '#f3cba9', hair: '#5d2e0f', shirt: '#880e4f', style: 4 },
        mode: 'ten', level: 4, personality: 'defensive', raceTo: 5, mutator: 'tight', skills: ['tremor', 'shield'], cueId: 'phoenix',
        intro: 'Gọi bi, gọi lỗ, không chừa đường lui. Mời anh.',
        winLine: 'Anh gọi sai nhiều quá.', loseLine: 'Chung kết đi. Lão nhân đang đợi.',
        coins: 1600, xp: 1300,
      },
      {
        id: 'thancong', name: 'Thần Công', title: 'Huyền thoại ẩn danh', look: { skin: '#d4a073', hair: '#fafafa', shirt: '#1b1b1b', style: 1, beard: true },
        mode: 'eight', level: 4, personality: 'trickster', raceTo: 5, mutator: null, skills: ['rewind', 'tremor', 'eagle'], cueId: 'thancong',
        intro: 'Bốn mươi năm ta chưa cầm cơ trước đám đông. Hôm nay vì ngươi mà phá lệ.',
        winLine: 'Còn sớm lắm, hậu bối.', loseLine: 'Cây cơ này… giờ thuộc về ngươi.',
        coins: 3000, xp: 2500,
      },
    ],
  },
];

export const ALL_NPCS = CHAPTERS.flatMap((c) => c.npcs);
export const npcById = (id: string) => ALL_NPCS.find((n) => n.id === id);

export const LEVEL_NAMES = ['', 'Dễ', 'Vừa', 'Khó', 'Thần Công'] as const;
export const PERSONALITY_NAMES: Record<Personality, string> = {
  balanced: 'Cân bằng',
  aggressive: 'Hung hãn',
  defensive: 'Phòng thủ',
  trickster: 'Ma mãnh',
};
