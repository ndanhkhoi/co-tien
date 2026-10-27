import type { Personality } from '../../ai/types';
import type { GameMode } from '../../core/rules/types';
import type { MutatorId } from './gear';
import { CHAMPIONS, classInfo, sect, type ClassId, type SectId } from './sects';

/** Career: travel the sects of Cơ Tiên Giới and beat each of their five masters. */

export interface Npc {
  /** Champion id — beating them in career unlocks that champion. */
  id: string;
  name: string;
  title: string;
  sect: SectId;
  mode: GameMode;
  level: 1 | 2 | 3 | 4;
  personality: Personality;
  raceTo: number;
  caromTarget?: number;
  mutator: MutatorId | null;
  cueId: string;
  intro: string;
  winLine: string;
  loseLine: string;
  coins: number;
  xp: number;
}

export interface Chapter {
  id: SectId;
  name: string;
  desc: string;
  npcs: Npc[];
}

/** Sect order along the journey, with the game each sect is known for. */
const ROUTE: { sect: SectId; modes: GameMode[]; mutator?: MutatorId; desc: string }[] = [
  { sect: 'thienquang', modes: ['eight'], desc: 'Chính đạo kiếm tông mở cửa đón tán tu. Nơi mọi cơ thủ bắt đầu.' },
  { sect: 'hoalinh', modes: ['eight', 'nine'], desc: 'Đảo hoa trôi giữa mây, nơi bi lăn mượt như gió xuân.' },
  { sect: 'hailong', modes: ['nine'], desc: 'Bến cảng hải tặc: đánh cược bằng vàng, thua là xuống thuyền chèo.' },
  { sect: 'thienco', modes: ['carom-libre', 'carom-3c'], desc: 'Các cơ quan thuật đo từng milimét — đất của bida phăng.' },
  { sect: 'bangphach', modes: ['nine'], mutator: 'ice', desc: 'Cung điện băng phương Bắc. Nỉ trơn, tâm phải lạnh.' },
  { sect: 'docvu', modes: ['ten'], mutator: 'fog', desc: 'Thung lũng chướng khí, đường ngắm chìm trong sương độc.' },
  { sect: 'kimsa', modes: ['ten'], desc: 'Hoàng triều sa mạc, nỉ cát nặng, mặt trời thiêu đốt.' },
  { sect: 'vanthu', modes: ['eight', 'nine'], mutator: 'bomb', desc: 'Rừng linh thú — bi nổ tung như sấm giữa đại ngàn.' },
  { sect: 'huyetsat', modes: ['ten'], desc: 'Ma môn chinh phạt. Ở đây chỉ có thắng hoặc bị nghiền nát.' },
  { sect: 'uminh', modes: ['nine'], mutator: 'ghost', desc: 'Đảo vong hồn: lỗ bàn mở rồi đóng theo ý ma quỷ.' },
  { sect: 'tinhtu', modes: ['carom-3c'], desc: 'Đỉnh núi tinh tú, nơi đường bi vẽ thành chòm sao.' },
  { sect: 'thienhuong', modes: ['nine', 'ten'], desc: 'Lầu các lụa hồng giữa hồ trăng: mỹ nhân đánh bi, kẻ thua mất hồn.' },
  { sect: 'hukhong', modes: ['eight', 'nine', 'ten'], mutator: 'tight', desc: 'Vực hư không — trận chung kết của Thiên Hạ Đệ Nhất Cơ Hội.' },
];

const PERSONALITY: Record<ClassId, Personality> = {
  thanxa: 'balanced', cuongchien: 'aggressive', phaptu: 'trickster', hophap: 'defensive',
  chusu: 'trickster', anhsat: 'aggressive', luanhoi: 'balanced',
};

const LINES: Record<ClassId, [string, string, string]> = {
  thanxa: ['Ta thấy đường bi của ngươi trước cả khi ngươi ngắm.', 'Một đường thẳng, một tiếng rơi. Vậy thôi.', 'Mắt ta… đã nhìn sai một li.'],
  cuongchien: ['Bida là phải nổ! Đứng xa ra kẻo văng trúng!', 'Mạnh là đúng!', 'Hừ, lực tay ngươi… không tệ.'],
  phaptu: ['Bi cái của ta biết múa đó, xem cho kỹ.', 'Xoay một vòng là xong ván.', 'Đường áp phê của ngươi… ta học được rồi.'],
  hophap: ['Muốn qua cửa này, trước hết phải thắng ta.', 'Thủ chắc thì thắng chắc.', 'Cửa đã mở. Đi tiếp đi.'],
  chusu: ['Tay ngươi… có đang run không?', 'Trúng chú rồi, đánh sao nổi.', 'Chú thuật không ăn thua với ngươi sao…'],
  anhsat: ['Một sơ hở thôi, ta dọn sạch bàn.', 'Quá chậm.', 'Lần này ngươi nhanh hơn ta.'],
  luanhoi: ['Ta đã thấy ván này kết thúc thế nào rồi.', 'Đúng như vận mệnh.', 'Vận mệnh… đã đổi.'],
};

export const CHAPTERS: Chapter[] = ROUTE.map((r, ci) => {
  const s = sect(r.sect);
  const champs = CHAMPIONS.filter((c) => c.sect === r.sect).sort((a, b) => a.tier - b.tier);
  const base = ci < 2 ? 1 : ci < 6 ? 2 : ci < 10 ? 3 : 4;
  return {
    id: r.sect, name: s.name, desc: r.desc,
    npcs: champs.map((c, i) => {
      const mode = r.modes[i % r.modes.length];
      const carom = mode.startsWith('carom');
      const [intro, winLine, loseLine] = LINES[c.cls];
      return {
        id: c.id, name: c.name, title: `${classInfo(c.cls).name} · bậc ${c.tier}`, sect: r.sect,
        mode, level: Math.min(4, base + (c.tier === 5 ? 1 : 0)) as Npc['level'],
        personality: PERSONALITY[c.cls],
        raceTo: Math.min(5, 2 + Math.floor((ci + c.tier) / 4)),
        caromTarget: carom ? (mode === 'carom-3c' ? 3 + Math.floor(ci / 4) : 8 + ci) : undefined,
        // Gimmicks appear from the middle of each chapter on.
        mutator: i >= 2 ? r.mutator ?? null : null,
        cueId: `${r.sect}-${c.tier >= 4 ? 'b' : 'a'}`,
        intro, winLine, loseLine,
        coins: 100 + 40 * ci + 30 * c.tier,
        xp: 60 + 25 * ci + 20 * c.tier,
      };
    }),
  };
});

export const ALL_NPCS = CHAPTERS.flatMap((c) => c.npcs);
export const npcById = (id: string) => ALL_NPCS.find((n) => n.id === id);

export const LEVEL_NAMES = ['', 'Dễ', 'Vừa', 'Khó', 'Tông Sư'] as const;
export const PERSONALITY_NAMES: Record<Personality, string> = {
  balanced: 'Cân bằng',
  aggressive: 'Hung hãn',
  defensive: 'Phòng thủ',
  trickster: 'Ma mãnh',
};
