import type { Personality } from '../../ai/types';
import type { GameMode } from '../../core/rules/types';
import type { MutatorId, SkillId } from './gear';

export interface Npc {
  id: string;
  name: string;
  title: string;
  /** Portrait id in public/avatars. */
  avatar: string;
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
        id: 'suneo', name: 'Suneo', title: 'Cậu ấm khoe của', avatar: 'suneo',
        mode: 'eight', level: 1, personality: 'defensive', raceTo: 2, mutator: null, skills: ['shield'], cueId: 'bamboo',
        intro: 'Cây cơ này ba tớ mua bên Mỹ về đó! Cậu đánh cơ quán thì thua là phải rồi.',
        winLine: 'Thấy chưa? Tiền nào của nấy!', loseLine: 'Hứ… tại cơ hôm nay chưa quen tay thôi.',
        coins: 120, xp: 80,
      },
      {
        id: 'dorami', name: 'Dorami', title: 'Em gái thông minh', avatar: 'dorami',
        mode: 'eight', level: 1, personality: 'balanced', raceTo: 2, mutator: null, skills: ['eagle'], cueId: 'house',
        intro: 'Anh Nobita nhờ em kèm anh vài ván. Đánh từ tốn thôi, đừng vội nha!',
        winLine: 'Anh cần luyện thêm nhiều đó nha.', loseLine: 'Giỏi quá! Em sẽ khoe với anh Doraemon.',
        coins: 150, xp: 100,
      },
      {
        id: 'gian', name: 'Gian', title: 'Trùm khu phố', avatar: 'gian',
        mode: 'eight', level: 2, personality: 'aggressive', raceTo: 3, mutator: null, skills: ['tremor', 'spin2'], cueId: 'blackdragon',
        intro: 'Bàn bida ở đây là của tao! Thua thì ở lại nghe tao hát cả buổi!',
        winLine: 'Đồ của mày là của tao! Giờ nghe tao hát nè!', loseLine: 'Mày… mày khá lắm. Qua CLB đi, ở đó có đứa giỏi hơn.',
        coins: 300, xp: 180,
      },
    ],
  },
  {
    id: 'clb', name: 'CLB Phú Nhuận', place: 'Sài Gòn · Phú Nhuận',
    desc: 'Bàn chuẩn, đèn trắng, cơ thủ nghiêm túc. Ở đây người ta đánh 9 bi.',
    npcs: [
      {
        id: 'shizuka', name: 'Shizuka', title: 'Hoa khôi CLB', avatar: 'shizuka',
        mode: 'nine', level: 2, personality: 'balanced', raceTo: 3, mutator: 'ice', skills: ['eagle', 'shield'], cueId: 'bamboo',
        intro: 'Bàn mới thay nỉ, trơn lắm đó. Cậu nhẹ tay thôi kẻo bi chạy mất nha.',
        winLine: 'Nỉ trơn vậy mà, cậu nên đánh nhẹ hơn.', loseLine: 'Ồ, cậu làm chủ được nỉ băng rồi kìa!',
        coins: 320, xp: 220,
      },
      {
        id: 'tien', name: 'Tenshinhan', title: 'Võ sư ba mắt', avatar: 'tien',
        mode: 'nine', level: 2, personality: 'defensive', raceTo: 3, mutator: null, skills: ['shield', 'eagle'], cueId: 'icemind',
        intro: 'Ba con mắt thấy hết đường bi. Ngươi không giấu được ý đồ đâu.',
        winLine: 'Kỷ luật thắng tài năng.', loseLine: 'Ta đã đánh giá thấp ngươi.',
        coins: 350, xp: 240,
      },
      {
        id: 'doraemon', name: 'Doraemon', title: 'Mèo máy bảo bối', avatar: 'doraemon',
        mode: 'nine', level: 3, personality: 'trickster', raceTo: 4, mutator: null, skills: ['rewind', 'eagle'], cueId: 'phoenix',
        intro: 'Tớ có Cỗ Máy Thời Gian trong túi đó! Đánh hỏng thì tớ quay lại đánh lại thôi.',
        winLine: 'Bảo bối thần kỳ vẫn là số một!', loseLine: 'Cậu giỏi thật đấy. Lên thành phố thử sức đi!',
        coins: 500, xp: 360,
      },
    ],
  },
  {
    id: 'thanhpho', name: 'Giải Thành Phố', place: 'Nhà thi đấu Phan Đình Phùng',
    desc: 'Gọi bi, gọi lỗ. Bàn giải có đủ trò quái — chỉ người lì mới trụ được.',
    npcs: [
      {
        id: 'yamcha', name: 'Yamcha', title: 'Sói hoang sa mạc', avatar: 'yamcha',
        mode: 'ten', level: 3, personality: 'aggressive', raceTo: 3, mutator: 'bomb', skills: ['spin2', 'tremor'], cueId: 'blackdragon',
        intro: 'Lang Nha Phong Phong Quyền! Bi nổ tung là chuyện nhỏ.',
        winLine: 'Lần này tôi không bị hạ đâu!', loseLine: 'Lại thua… chắc tại số tôi.',
        coins: 520, xp: 400,
      },
      {
        id: 'krillin', name: 'Krillin', title: 'Tiểu hòa thượng', avatar: 'krillin',
        mode: 'ten', level: 3, personality: 'balanced', raceTo: 4, mutator: 'fog', skills: ['shield', 'spin2'], cueId: 'icemind',
        intro: 'Sương mù dày quá, nhưng tớ quen đánh trong khói bụi rồi.',
        winLine: 'Hehe, ít ra lần này tớ không bị đánh bại!', loseLine: 'Cậu mạnh ngang Goku luôn đó.',
        coins: 600, xp: 450,
      },
      {
        id: 'satan', name: 'Mr. Satan', title: 'Nhà vô địch thế giới', avatar: 'satan',
        mode: 'ten', level: 3, personality: 'trickster', raceTo: 4, mutator: 'ghost', skills: ['tremor', 'eagle'], cueId: 'phoenix',
        intro: 'HA HA HA! Lỗ bàn biến mất ư? Chỉ là ảo thuật thôi, đừng sợ!',
        winLine: 'Nhà vô địch lại thắng! HA HA HA!', loseLine: 'Ơ… ta… ta cố tình nhường đấy!',
        coins: 700, xp: 520,
      },
    ],
  },
  {
    id: 'phang', name: 'Đất Phăng Hà Thành', place: 'Hà Nội · Phố cổ',
    desc: 'Không lỗ, ba bi, những đường băng như vẽ. Người Hà Nội chơi phăng.',
    npcs: [
      {
        id: 'roshi', name: 'Kame-Sennin', title: 'Lão sư Rùa Biển', avatar: 'roshi',
        mode: 'carom-libre', level: 2, personality: 'balanced', raceTo: 2, caromTarget: 8, mutator: null, skills: ['eagle'], cueId: 'bamboo',
        intro: 'Phăng tự do: bi cái chạm đủ hai bi là ăn. Ông già này dạy cho mà xem.',
        winLine: 'Tập thêm trăm năm nữa đi cháu.', loseLine: 'Khá lắm! Thử ba băng xem nào.',
        coins: 600, xp: 480,
      },
      {
        id: 'piccolo', name: 'Piccolo', title: 'Ma vương xanh', avatar: 'piccolo',
        mode: 'carom-3c', level: 3, personality: 'defensive', raceTo: 2, caromTarget: 4, mutator: null, skills: ['eagle', 'shield'], cueId: 'icemind',
        intro: 'Ba băng cần sự tập trung tuyệt đối. Đừng làm ta thất vọng.',
        winLine: 'Ngươi còn quá non.', loseLine: 'Hừm. Ngươi đã tiến bộ.',
        coins: 800, xp: 600,
      },
      {
        id: 'vegeta', name: 'Vegeta', title: 'Hoàng tử Saiyan', avatar: 'vegeta',
        mode: 'carom-3c', level: 4, personality: 'trickster', raceTo: 2, caromTarget: 5, mutator: null, skills: ['spin2', 'tremor'], cueId: 'blackdragon',
        intro: 'Ta là hoàng tử của tộc Saiyan! Không ai qua mặt được ta trên bàn phăng.',
        winLine: 'Biết thân phận của ngươi chưa?', loseLine: 'Không thể nào… ngươi đã vượt qua ta?!',
        coins: 1000, xp: 800,
      },
    ],
  },
  {
    id: 'quocgia', name: 'Vô Địch Quốc Gia', place: 'Cung thể thao Quần Ngựa',
    desc: 'Lỗ hẹp, đèn truyền hình, cả nước dõi theo. Ngai vàng chỉ có một.',
    npcs: [
      {
        id: 'gohan', name: 'Gohan', title: 'Đương kim vô địch 9 bi', avatar: 'gohan',
        mode: 'nine', level: 4, personality: 'balanced', raceTo: 5, mutator: 'tight', skills: ['shield', 'rewind'], cueId: 'icemind',
        intro: 'Lỗ thi đấu hẹp lắm. Ở đây không có cú may mắn đâu.',
        winLine: 'Bố tớ sẽ tự hào lắm.', loseLine: 'Cậu xứng đáng vào chung kết.',
        coins: 1400, xp: 1100,
      },
      {
        id: 'bulma', name: 'Bulma', title: 'Nữ hoàng 10 bi', avatar: 'bulma',
        mode: 'ten', level: 4, personality: 'defensive', raceTo: 5, mutator: 'tight', skills: ['tremor', 'shield'], cueId: 'phoenix',
        intro: 'Thiên tài Tập đoàn Capsule đã tính hết mọi góc bi. Mời cậu.',
        winLine: 'Khoa học chưa bao giờ sai.', loseLine: 'Chung kết đi. Goku đang đợi đó.',
        coins: 1600, xp: 1300,
      },
      {
        id: 'goku', name: 'Goku', title: 'Thần Công huyền thoại', avatar: 'goku',
        mode: 'eight', level: 4, personality: 'trickster', raceTo: 5, mutator: null, skills: ['rewind', 'tremor', 'eagle'], cueId: 'thancong',
        intro: 'Ê, nghe nói cậu mạnh lắm! Tớ háo hức quá — mình đánh hết sức nha!',
        winLine: 'Vui ghê! Mai mình đánh tiếp nha!', loseLine: 'Cậu mạnh thật! Cây cơ Thần Công này giờ là của cậu.',
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
