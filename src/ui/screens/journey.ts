import { CHAPTERS, LEVEL_NAMES, type Npc } from '../../game/content/career';
import { CHALLENGES, FAMILY_INFO, type ChallengeDef, type ChallengeFamily } from '../../game/content/challenges';
import { TABLES } from '../../game/content/gear';
import lore from '../../game/content/lore.json';
import { sectArtUrl, type SectId } from '../../game/content/sects';
import { MODE_NAMES } from '../../core/rules';
import { screenEl, type App, type Screen } from '../app';
import { avatar } from '../avatar';
import { btn, h, modal, stars, tap, toast } from '../dom';
import { icon } from '../icons';
import { npcModal, startChallenge, topbar } from './menus';

/**
 * Hành trình: one painted map of Cơ Tiên Giới shared by career and challenges. Each land has
 * two gates — duel its five masters, or solve its trick shots — and the cloud path opens the
 * next land once the first master of the previous one has been beaten.
 */

/** Plaza of each land on art/ui/map.webp, as fractions of the image. */
const PINS: Record<SectId, [number, number]> = {
  bangphach: [0.143, 0.152], tinhtu: [0.386, 0.127], thienquang: [0.607, 0.146], hukhong: [0.893, 0.184],
  uminh: [0.121, 0.387], hoalinh: [0.371, 0.368], thienco: [0.629, 0.381], huyetsat: [0.886, 0.393],
  hailong: [0.1, 0.66], thienhuong: [0.386, 0.654], vanthu: [0.664, 0.692], docvu: [0.907, 0.685],
  kimsa: [0.5, 0.92],
};

const FAMILIES = Object.keys(FAMILY_INFO) as ChallengeFamily[];

/**
 * Challenges dealt along the route: interleave the five families level by level (so every
 * land mixes shot types and difficulty rises along the path), then cut into one chunk per land.
 */
export function challengesByLand(): Map<SectId, ChallengeDef[]> {
  const byFam = FAMILIES.map((f) => CHALLENGES.filter((c) => c.family === f));
  const ordered: ChallengeDef[] = [];
  for (let i = 0; i < Math.max(...byFam.map((l) => l.length)); i++) for (const l of byFam) if (l[i]) ordered.push(l[i]);
  const out = new Map<SectId, ChallengeDef[]>();
  const n = CHAPTERS.length;
  let at = 0;
  CHAPTERS.forEach((ch, i) => {
    const size = Math.floor(ordered.length / n) + (i < ordered.length % n ? 1 : 0);
    out.set(ch.id, ordered.slice(at, at + size));
    at += size;
  });
  return out;
}

function landOpen(app: App, i: number): boolean {
  return i === 0 || app.profile.career[CHAPTERS[i - 1].npcs[0].id] !== undefined;
}

export function journeyScreen(app: App): Screen {
  const el = screenEl();
  const base = new URL(import.meta.env.BASE_URL, document.baseURI).href;
  const map = h('div.journey-map', null, h('img.journey-art', { src: `${base}art/ui/map.webp`, alt: 'Bản đồ Cơ Tiên Giới', draggable: false }));
  CHAPTERS.forEach((ch, i) => {
    const [x, y] = PINS[ch.id];
    const open = landOpen(app, i);
    const beaten = ch.npcs.filter((n) => app.profile.career[n.id] !== undefined).length;
    const pin = h('button.journey-pin', { class: open ? '' : 'locked', style: `left:${x * 100}%;top:${y * 100}%`, 'aria-label': ch.name },
      h('img', { src: sectArtUrl(ch.id, 'emblem'), alt: '' }),
      h('span.jp-name', null, ch.name),
      open ? h('span.jp-prog', null, `${beaten}/${ch.npcs.length}`) : h('span.jp-prog', null, icon('lock')),
    );
    tap(pin, () => (open ? landSheet(app, ch.id) : toast(`Thắng ${CHAPTERS[i - 1].npcs[0].name} ở ${CHAPTERS[i - 1].name} để mở đường`, 'bad')));
    map.append(pin);
  });
  el.append(topbar(app, 'Hành trình'), h('div.journey-wrap.scroll', null, map));
  return { el };
}

function landSheet(app: App, id: SectId) {
  const ch = CHAPTERS.find((c) => c.id === id)!;
  const all = CHAPTERS.flatMap((c) => c.npcs);
  const npcOpen = (n: Npc) => {
    const i = all.indexOf(n);
    return i === 0 || app.profile.career[all[i - 1].id] !== undefined;
  };
  const tasks = challengesByLand().get(id) ?? [];
  const table = TABLES.find((t) => t.sect === id) ?? app.tableSkin;
  modal((close) => h('div.modal.land-sheet.scroll', null,
    h('div.ls-head', null, h('img', { src: sectArtUrl(id, 'emblem'), alt: '' }),
      h('div', null, h('h2', null, ch.name), h('p.small.muted', null, ch.desc))),
    h('p.small', null, (lore as { sects: Record<string, string> }).sects[id]),
    h('div.section-title', null, 'Thách đấu'),
    h('div.col', { style: 'gap:6px' }, ...ch.npcs.map((n) => {
      const open = npcOpen(n);
      const best = app.profile.career[n.id] ?? 0;
      return tap(h('button.npc', { class: open ? '' : 'locked' },
        h('div.av', null, avatar(n.id)),
        h('div.grow', null, h('div.nm', null, n.name), h('div.tt', null, `${n.title} · ${MODE_NAMES[n.mode]} · ${LEVEL_NAMES[n.level]}`)),
        open ? stars(best) : icon('lock'),
      ), () => {
        if (!open) return toast('Thắng cao thủ trước để mở', 'bad');
        close();
        npcModal(app, n);
      });
    })),
    tasks.length ? h('div.section-title', null, 'Thử thách') : null,
    h('div.ls-tasks', null, ...tasks.map((c, i) => {
      const best = app.profile.challenges[c.id] ?? 0;
      const open = i === 0 || (app.profile.challenges[tasks[i - 1].id] ?? 0) > 0;
      return tap(h('button.ls-task', { class: open ? '' : 'locked' },
        h('b', null, `${i + 1}. ${FAMILY_INFO[c.family].name}`),
        open ? stars(best) : icon('lock'),
      ), () => {
        if (!open) return toast('Hoàn thành thử thách trước để mở', 'bad');
        close();
        startChallenge(app, c, table);
      });
    })),
    h('div.small.muted', { style: 'margin-top:6px' }, `Chơi trên ${table.name}. Thử thách dùng vật lý chuẩn để mọi bài đều có lời giải.`),
    h('div.actions', null, btn('Đóng', close, 'ghost')),
  ), { dismissable: true });
}
