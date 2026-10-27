import { maxSpeed } from '../../core/cue-power';
import type { CueDef, TableSkin } from './gear';

/**
 * Plain-language stat sheets. Every number here is computed from the same formulas the
 * match uses, so what the player reads is exactly what happens on the table.
 */
export interface StatLine {
  label: string;
  /** 1–5 bar value, when the stat is a bar. */
  bar?: number;
  value: string;
  explain: string;
}

export function cueStats(c: CueDef): StatLine[] {
  const reach = Math.round(Math.min(1, 0.72 + 0.07 * c.spin) * 100);
  const wobble = Math.round((1.3 - c.control * 0.2) * 100);
  const chevrons = 0.55 + 0.12 * c.aim >= 1 ? 4 : 3;
  return [
    { label: 'Lực', bar: c.power, value: `${maxSpeed('pool', c.power).toFixed(1)} m/s`, explain: 'Tốc độ bi cái tối đa khi nạp đầy lực.' },
    { label: 'Ngắm', bar: c.aim, value: `${chevrons} nấc`, explain: 'Độ dài mũi tên báo hướng đi của bi mục tiêu. Đường ngắm và bi ảo luôn hiện với mọi cây cơ.' },
    { label: 'Áp phê', bar: c.spin, value: `${reach}%`, explain: 'Tầm điểm chạm an toàn trên bi cái. Đặt điểm áp phê xa hơn tầm này thì dễ trượt cơ.' },
    { label: 'Vững tay', bar: c.control, value: `run ${wobble}%`, explain: 'Độ rung đầu cơ khi nạp lực. Càng thấp càng ít "lỡ tay".' },
    { label: 'Năng lượng', bar: c.energy, value: `×${(0.8 + 0.1 * c.energy).toFixed(1)}`, explain: 'Hệ số năng lượng nhận được mỗi khi vào bi.' },
  ];
}

export function tableStats(t: TableSkin): StatLine[] {
  const p = t.phys ?? {};
  const pct = (k: number | undefined) => (k === undefined || k === 1 ? 'chuẩn' : `${k > 1 ? '+' : ''}${Math.round((k - 1) * 100)}%`);
  return [
    { label: 'Ma sát lăn', value: pct(p.muRoll), explain: 'Cao hơn: bi dừng sớm. Thấp hơn: bi lăn xa.' },
    { label: 'Ma sát trượt', value: pct(p.muSlide), explain: 'Thấp hơn: bi trượt lâu trước khi lăn tròn, áp phê giữ lâu hơn.' },
    { label: 'Độ nảy băng', value: pct(p.eCushion), explain: 'Cao hơn: bi bật khỏi băng mạnh hơn.' },
    { label: 'Miệng lỗ', value: pct(p.capture), explain: 'Rộng hơn: bi dễ rơi hơn khi chạm miệng lỗ.' },
  ];
}

export const TABLE_NOTE = 'Đặc tính bàn chỉ có ở chế độ Tiên Đạo. Chế độ Cổ Điển luôn dùng bàn chuẩn WPA.';
