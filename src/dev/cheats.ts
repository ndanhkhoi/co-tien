/* Console only (dev build or ?dev): cotien.cheat('unlockAll'), ('coins', n), ('xp', n),
 * ('story'), ('journey'), ('challenges'), ('energy'), ('reset'). coins/xp add; reset uses defaultProfile. */
import type { App } from '../ui/app';
import type { Match } from '../game/match';
import { ENERGY_MAX } from '../game/match';
import { CHAMPIONS } from '../game/content/sects';
import { ALL_NPCS } from '../game/content/career';
import { CHALLENGES } from '../game/content/challenges';
import { defaultProfile, exportCode, importCode } from '../game/profile';

export function installCheats(app: App) {
  if (!import.meta.env.DEV && !new URLSearchParams(location.search).has('dev')) return;
  const target = window as unknown as { cotien?: { cheat: (name: string, ...args: unknown[]) => string }; __match?: Match };
  target.cotien = { cheat(name, ...args) {
    const p = app.profile;
    const amount = () => {
      const n = Number(args[0]);
      if (!Number.isFinite(n) || n < 0) throw new Error('Số lượng phải là số hữu hạn không âm');
      return Math.floor(n);
    };
    switch (name) {
      case 'unlockAll': p.champions = CHAMPIONS.map((c) => c.id); break;
      case 'coins': p.coins = Math.min(Number.MAX_SAFE_INTEGER, p.coins + amount()); break;
      case 'xp': p.xp = Math.min(Number.MAX_SAFE_INTEGER, p.xp + amount()); break;
      case 'story':
      case 'journey': for (const n of ALL_NPCS) p.career[n.id] = 3; break;
      case 'challenges': for (const c of CHALLENGES) p.challenges[c.id] = 3; break;
      case 'energy': {
        const match = target.__match;
        if (!match || !document.querySelector('.screen.game')) return 'Không có trận đang chơi';
        match.energy[0] = match.energy[1] = ENERGY_MAX;
        return 'Đã nạp năng lượng hai bên';
      }
      case 'reset': Object.assign(p, defaultProfile()); app.applySettings(); break;
      default: throw new Error('Lệnh: unlockAll, coins(n), xp(n), story, journey, challenges, energy, reset');
    }
    // Round-trip through the normal save importer so the existing sanitizer owns the schema.
    const clean = importCode(exportCode(p));
    if (!clean) throw new Error('Không thể kiểm tra hồ sơ');
    Object.assign(p, clean);
    app.save();
    return 'Đã lưu. Mở lại màn menu để xem thay đổi.';
  } };
}
