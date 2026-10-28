import type { GameMode } from '../../core/rules/types';

/** Plain-language rules per game type, matching what src/core/rules enforces. */
export interface RulesText {
  goal: string;
  points: string[];
}

export const RULES_TEXT: Record<GameMode, RulesText> = {
  eight: {
    goal: 'Ăn hết nhóm bi của mình (trơn 1–7 hoặc sọc 9–15), rồi gọi lỗ và ăn bi 8.',
    points: [
      'Sau cú phá, bàn luôn mở. Cú tiếp theo ăn bi nhóm nào thì nhận nhóm đó.',
      'Mỗi cú phải chạm bi thuộc nhóm mình trước; bàn mở thì không được chạm bi 8 trước.',
      'Sau khi chạm bi, phải có bi vào lỗ hoặc có bi chạm băng, nếu không là lỗi.',
      'Bi 8 vào sớm, vào sai lỗ đã gọi, hoặc vào kèm lỗi: thua ván.',
      'Phạm lỗi: đối thủ được đặt bi cái ở bất kỳ đâu.',
    ],
  },
  nine: {
    goal: 'Ăn bi 9. Lúc nào cũng phải chạm bi số nhỏ nhất trên bàn trước.',
    points: [
      'Chạm đúng bi nhỏ nhất trước, bi nào vào lỗ cũng tính (kể cả ăn 9 bằng combo).',
      'Ngay sau cú phá, người đánh được quyền "đẩy bi" (push-out) một lần.',
      'Phạm lỗi 3 lần liên tiếp: thua ván.',
      'Phạm lỗi: đối thủ được bi trong tay.',
    ],
  },
  ten: {
    goal: 'Gọi lỗ và ăn bi 10. Luôn chạm bi nhỏ nhất trước.',
    points: [
      'Mọi cú đều phải gọi bi và lỗ. Bi vào sai lỗ đã gọi thì mất lượt.',
      'Bi 10 vào khi phá hoặc vào không đúng lỗ gọi thì được đặt lại.',
      'Có quyền đẩy bi sau cú phá; 3 lỗi liên tiếp thua ván.',
    ],
  },
  'carom-libre': {
    goal: 'Bàn không lỗ. Bi cái của bạn chạm cả hai bi còn lại trong một cú là ghi 1 điểm.',
    points: [
      'Ghi điểm thì được đánh tiếp; trượt thì đến lượt đối thủ.',
      'Đủ số điểm của ván trước là thắng ván.',
    ],
  },
  'carom-3c': {
    goal: '3 băng: bi cái phải chạm băng ít nhất 3 lần trước khi chạm bi thứ hai.',
    points: [
      'Chạm bi thứ nhất lúc nào cũng được, nhưng trước khi chạm bi thứ hai phải đủ 3 lần chạm băng.',
      'Đây là thể loại khó nhất: dùng áp phê ngang để bẻ góc bật băng.',
    ],
  },
};

export const SKILL_RULES = [
  'Tiên Đạo: mỗi tướng có nội tại theo hệ, 2 chiêu cơ bản (hồi chiêu theo lượt đánh của chính mình) và 1 tuyệt chiêu (cần đầy thanh năng lượng).',
  'Mỗi cú đánh tăng năng lượng; ghi điểm và lỗi của đối thủ cộng thêm năng lượng.',
  'Mỗi môn phái có dấu ấn vật lý hoặc thông tin riêng; tuyệt chiêu bậc 5 có hình học riêng, dùng được cả trên bàn phăng.',
  'Các lựa chọn nội tại nằm trên HUD: khoá ngắm, chọn trục áp phê, băng mềm hoặc soi đường/tăng lực. Luân phiên hai chiêu cơ bản giúp Luân Hồi hồi nhanh hơn.',
  'Bàn của mỗi môn phái có đặc tính riêng; thỉnh thoảng nổi Thiên Tượng (gió, tuyết, nghiêng bàn…) được báo trước và vẽ lên bàn.',
  'Địa Lợi: đánh trên bàn môn phái mình thì +20% năng lượng và không gặp Thiên Tượng.',
  'Cổ Điển: bida thuần, không chiêu, không địa thế, bàn chuẩn WPA.',
];
