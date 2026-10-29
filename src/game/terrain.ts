import type { Ball, Terrain } from '../core/physics';
import type { Rng } from '../core/rng';
import type { Segment, TableGeom } from '../core/table';
import type { SectId } from './content/sects';

/**
 * Thiên Tượng: a sect table's random phenomenon for one shot. Everything is expressed as
 * physics the simulator already understands (forces, friction patches, wells, obstacles,
 * pocket size), announced before the shot so the shooter can play around it.
 */
export interface Omen {
  id: string;
  name: string;
  desc: string;
  terrain?: Terrain;
  /** Fixed obstacles for this shot (roots). */
  segments?: Segment[];
  /** Speed (m/s) of the tremor nudge given to resting balls when the shot starts. */
  jitter?: number;
  /** Pocket capture multiplier for this shot. */
  capture?: number;
  /** Close one pocket for this shot. */
  closePocket?: boolean;
}

/** Chance a phenomenon starts a turn on a sect table (Tiên Đạo mode only). */
export const OMEN_CHANCE = 0.25;

/** Rolling resistance on standard cloth is μr·g ≈ 0.108 m/s²; land forces stay well under it. */
export const MAX_FORCE = 0.06;

/** How hard a land force pushes, in words the HUD shows (wind, tilt). */
export function forceStrength(f: { x: number; y: number }): 'nhẹ' | 'vừa' | 'mạnh' {
  const k = Math.hypot(f.x, f.y) / MAX_FORCE;
  return k < 0.6 ? 'nhẹ' : k < 0.78 ? 'vừa' : 'mạnh';
}

function dir(rng: Rng, mag: number) {
  const a = rng.range(0, Math.PI * 2);
  return { x: Math.cos(a) * mag, y: Math.sin(a) * mag };
}

/** Circles placed on open cloth, away from the cushions. */
function spots(rng: Rng, t: TableGeom, n: number, r: [number, number]) {
  const out: { x: number; y: number; r: number }[] = [];
  for (let i = 0; i < n; i++) {
    const rr = rng.range(r[0], r[1]);
    out.push({ x: rng.range(-t.L / 2 + rr, t.L / 2 - rr), y: rng.range(-t.W / 2 + rr, t.W / 2 - rr), r: rr });
  }
  return out;
}

/** A short root lying on the cloth where no ball rests. */
function rootSegment(rng: Rng, t: TableGeom, balls: Ball[]): Segment | null {
  for (let tries = 0; tries < 40; tries++) {
    const cx = rng.range(-t.L / 2 + 0.25, t.L / 2 - 0.25);
    const cy = rng.range(-t.W / 2 + 0.2, t.W / 2 - 0.2);
    const a = rng.range(0, Math.PI);
    const half = rng.range(0.06, 0.1);
    const seg = { ax: cx - Math.cos(a) * half, ay: cy - Math.sin(a) * half, bx: cx + Math.cos(a) * half, by: cy + Math.sin(a) * half };
    const clear = balls.every((b) => !b.onTable || distToSeg(b.x, b.y, seg) > t.R * 3);
    if (clear) return seg;
  }
  return null;
}

function distToSeg(x: number, y: number, s: Segment): number {
  const ex = s.bx - s.ax;
  const ey = s.by - s.ay;
  const k = Math.max(0, Math.min(1, ((x - s.ax) * ex + (y - s.ay) * ey) / (ex * ex + ey * ey)));
  return Math.hypot(x - (s.ax + ex * k), y - (s.ay + ey * k));
}

export function rollOmen(sect: SectId, rng: Rng, t: TableGeom, balls: Ball[]): Omen | null {
  const pockets = t.pockets.length > 0;
  switch (sect) {
    case 'bangphach':
      return {
        id: 'snow', name: 'Bão Tuyết', desc: 'Đụn tuyết phủ lên nỉ: bi lăn vào đụn tuyết chậm hẳn lại.',
        terrain: { patches: spots(rng, t, 3, [0.12, 0.2]).map((s) => ({ ...s, roll: 3.2, slide: 1.4 })) },
      };
    case 'hailong':
      return {
        id: 'swell', name: 'Sóng Lừng', desc: 'Thuyền chòng chành: bàn nghiêng qua lại, bi lăn chậm bị kéo lệch.',
        terrain: { force: dir(rng, MAX_FORCE), gust: { amp: 1, omega: rng.range(1.6, 2.4) } },
      };
    case 'thienco':
      return {
        id: 'tilt', name: 'Cơ Quan Nghiêng', desc: 'Cơ quan nâng một đầu bàn: bi lăn chậm trôi về một phía.',
        terrain: { force: dir(rng, MAX_FORCE * 0.8) },
      };
    case 'hoalinh':
    case 'thienquang':
      return {
        id: 'wind', name: sect === 'hoalinh' ? 'Xuân Phong' : 'Gió Núi', desc: 'Gió giật từng cơn đẩy bi đang lăn theo hướng gió.',
        // One direction for the whole turn: gusts only ease off (to 10%), never blow back.
        terrain: { force: dir(rng, MAX_FORCE * rng.range(0.45, 0.95)), gust: { amp: 0.45, omega: rng.range(2.5, 4) } },
      };
    case 'kimsa':
      return {
        id: 'sandstorm', name: 'Bão Cát', desc: 'Gió cát thổi ngang và cát phủ dày làm bi chậm.',
        terrain: {
          force: dir(rng, MAX_FORCE * 0.6), gust: { amp: 0.5, omega: 2 },
          patches: [{ x: 0, y: 0, r: 5, roll: 1.35, slide: 1.15 }],
        },
      };
    case 'docvu':
      return {
        id: 'puddle', name: 'Vũng Độc', desc: 'Vũng độc nhớt: bi đi qua mất áp phê và trượt ngắn lại.',
        terrain: { patches: spots(rng, t, 3, [0.1, 0.16]).map((s) => ({ ...s, roll: 2, slide: 2.6 })) },
      };
    case 'tinhtu': {
      const [s] = spots(rng, t, 1, [0.3, 0.3]);
      return {
        id: 'star', name: 'Tinh Lực', desc: 'Sao băng rơi xuống bàn: bi lăn gần tâm sao bị hút cong đường.',
        terrain: { wells: [{ x: s.x, y: s.y, r: 0.3, a: 0.35 }] },
      };
    }
    case 'vanthu': {
      const seg = rootSegment(rng, t, balls);
      return seg ? { id: 'roots', name: 'Rễ Cổ Thụ', desc: 'Rễ cây trồi lên nỉ: bi chạm rễ bật lại như chạm băng.', segments: [seg] } : null;
    }
    case 'huyetsat':
      return { id: 'quake', name: 'Địa Chấn', desc: 'Mặt đất rung chuyển: các bi đang nằm yên bị xê dịch nhẹ khi bạn đánh.', jitter: 0.06 };
    case 'uminh':
      return pockets ? { id: 'gate', name: 'Quỷ Môn', desc: 'Một lỗ bị quỷ khí phong kín trong cú này.', closePocket: true } : null;
    case 'thienhuong':
      return {
        id: 'silk', name: 'Lụa Trải', desc: 'Những tấm lụa trải trên nỉ: bi lướt qua lụa trượt êm và lăn xa hơn.',
        terrain: { patches: spots(rng, t, 3, [0.12, 0.18]).map((s) => ({ ...s, roll: 0.55, slide: 0.6 })) },
      };
    case 'hukhong': {
      const grow = rng.next() < 0.5;
      return pockets ? {
        id: 'breath', name: grow ? 'Hư Không Hít Vào' : 'Hư Không Thở Ra',
        desc: grow ? 'Miệng lỗ phình to trong cú này.' : 'Miệng lỗ co hẹp trong cú này.',
        capture: grow ? 1.18 : 0.84,
      } : null;
    }
  }
}

/** What each sect's land does, for the Cơ Tiên Lục pages (mirrors rollOmen). */
export const OMEN_INFO: Record<SectId, { name: string; desc: string }> = {
  thienquang: { name: 'Gió Núi', desc: 'Gió giật từng cơn đẩy bi đang lăn theo hướng gió.' },
  huyetsat: { name: 'Địa Chấn', desc: 'Mặt đất rung: các bi đang nằm yên bị xê dịch nhẹ khi bạn đánh.' },
  hoalinh: { name: 'Xuân Phong', desc: 'Gió xuân giật từng cơn đẩy bi đang lăn.' },
  bangphach: { name: 'Bão Tuyết', desc: 'Đụn tuyết phủ lên nỉ: bi lăn vào đụn tuyết chậm hẳn lại.' },
  thienco: { name: 'Cơ Quan Nghiêng', desc: 'Cơ quan nâng một đầu bàn: bi lăn chậm trôi về một phía.' },
  docvu: { name: 'Vũng Độc', desc: 'Vũng độc nhớt: bi đi qua mất áp phê và trượt ngắn lại.' },
  hailong: { name: 'Sóng Lừng', desc: 'Bàn chòng chành qua lại như trên thuyền.' },
  uminh: { name: 'Quỷ Môn', desc: 'Một lỗ bị quỷ khí phong kín trong cú này.' },
  tinhtu: { name: 'Tinh Lực', desc: 'Sao băng rơi xuống bàn: bi lăn gần tâm sao bị hút cong đường.' },
  kimsa: { name: 'Bão Cát', desc: 'Gió cát thổi ngang và cát phủ dày làm bi chậm.' },
  vanthu: { name: 'Rễ Cổ Thụ', desc: 'Rễ cây trồi lên nỉ: bi chạm rễ bật lại như chạm băng.' },
  hukhong: { name: 'Hư Không Thở', desc: 'Miệng lỗ phình to hoặc co hẹp trong cú này.' },
  thienhuong: { name: 'Lụa Trải', desc: 'Lụa trải trên nỉ: bi lướt qua lụa trượt êm và lăn xa hơn.' },
};
