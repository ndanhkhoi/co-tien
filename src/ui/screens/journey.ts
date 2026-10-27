import { CHAPTERS, LEVEL_NAMES, type Npc } from '../../game/content/career';
import { CHALLENGES, FAMILY_INFO, type ChallengeDef, type ChallengeFamily } from '../../game/content/challenges';
import { TABLES } from '../../game/content/gear';
import lore from '../../game/content/lore.json';
import { champion, sect, sectArtUrl, type SectId } from '../../game/content/sects';
import { MODE_NAMES } from '../../core/rules';
import { screenEl, type App, type Screen } from '../app';
import { btn, h, modal, stars, tap, toast } from '../dom';
import { icon } from '../icons';
import { artUrl, champCard, closeX, hex6, npcModal, startChallenge, statChip, topbar } from './menus';

/**
 * Hành trình: one painted map of Cơ Tiên Giới shared by duels and challenges. Each land has
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
const ALL_NPCS = CHAPTERS.flatMap((c) => c.npcs);

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

const npcOpen = (app: App, n: Npc) => {
  const chapter = CHAPTERS.find((c) => c.id === n.sect)!;
  const i = chapter.npcs.indexOf(n);
  return i === 0 || app.profile.career[chapter.npcs[i - 1].id] !== undefined;
};

const taskOpen = (app: App, task: ChallengeDef) => {
  const family = CHALLENGES.filter((c) => c.family === task.family);
  const i = family.indexOf(task);
  return i === 0 || (app.profile.challenges[family[i - 1].id] ?? 0) > 0;
};

export function journeyScreen(app: App): Screen {
  const el = screenEl('journey');
  const p = app.profile;
  const byLand = challengesByLand();
  const map = h('div.journey-map', null, h('img.journey-art', { src: artUrl('ui/map.webp'), alt: 'Bản đồ Cơ Tiên Giới', draggable: false }));
  // The land to go next: the first open land with a master still unbeaten.
  const current = CHAPTERS.findIndex((ch, i) => landOpen(app, i) && ch.npcs.some((n) => p.career[n.id] === undefined));
  let focus: HTMLElement | null = null;
  CHAPTERS.forEach((ch, i) => {
    const [x, y] = PINS[ch.id];
    const open = landOpen(app, i);
    const beaten = ch.npcs.filter((n) => p.career[n.id] !== undefined).length;
    const tasks = byLand.get(ch.id) ?? [];
    const solved = tasks.filter((t) => (p.challenges[t.id] ?? 0) > 0).length;
    const done = beaten === ch.npcs.length;
    const state = !open ? 'locked' : i === current ? 'current' : done ? 'done' : '';
    const pin = h('button.land-pin', {
      class: state, style: `left:clamp(77px, ${x * 100}%, calc(100% - 77px));top:${y * 100}%;--pin-y:${y > 0.85 ? -100 : 0}%;--sect:${hex6(sect(ch.id).main)}`,
      'aria-label': open ? `${ch.name}: ${beaten}/${ch.npcs.length} cao thủ, ${solved}/${tasks.length} thử thách` : `${ch.name}: chưa mở`,
    },
    i === current ? h('span.lp-flag', null, 'Đi tiếp') : null,
    h('span.lp-emblem', null, h('img', { src: sectArtUrl(ch.id, 'emblem'), alt: '' })),
    h('span.lp-text', null,
      h('span.lp-name', null, ch.name),
      open
        ? h('span.lp-prog', null, icon('users'), h('b.num', null, `${beaten}/${ch.npcs.length}`), icon('target'), h('b.num', null, `${solved}/${tasks.length}`))
        : h('span.lp-prog.lp-closed', null, icon('lock'), 'Chưa mở'),
    ),
    );
    tap(pin, () => (open ? landSheet(app, ch.id) : toast(`Thắng ${CHAPTERS[i - 1].npcs[0].name} ở ${CHAPTERS[i - 1].name} để mở đường tới đây`, 'bad')));
    if (i === current) focus = pin;
    map.append(pin);
  });
  const beatenAll = Object.keys(p.career).length;
  const solvedAll = Object.values(p.challenges).filter((v) => v > 0).length;
  const scroller = h('div.scroll.journey-scroll', null, map);
  el.append(
    topbar(app, 'Hành trình', true,
      statChip('users', `${beatenAll}/${ALL_NPCS.length}`, `Đã thắng ${beatenAll}/${ALL_NPCS.length} cao thủ`),
      statChip('target', `${solvedAll}/${CHALLENGES.length}`, `Đã giải ${solvedAll}/${CHALLENGES.length} thử thách`)),
    scroller,
  );
  // Bring the land to play next into view once the map has its size.
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const f = focus as HTMLElement | null;
    if (!f) return;
    scroller.scrollTop = Math.max(0, f.offsetTop - scroller.clientHeight / 2);
  }));
  return { el };
}

function landSheet(app: App, id: SectId) {
  const ch = CHAPTERS.find((c) => c.id === id)!;
  const p = app.profile;
  const tasks = challengesByLand().get(id) ?? [];
  const table = TABLES.find((t) => t.sect === id) ?? app.tableSkin;
  const beaten = ch.npcs.filter((n) => p.career[n.id] !== undefined).length;
  const solved = tasks.filter((t) => (p.challenges[t.id] ?? 0) > 0).length;
  const nextNpc = ch.npcs.find((n) => npcOpen(app, n) && p.career[n.id] === undefined);
  modal((close) => h('div.modal.land-sheet', { style: `--sect:${hex6(sect(id).main)}` },
    h('div.ls-art', null, h('img', { src: sectArtUrl(id, 'splash'), alt: '', onerror: (e: Event) => ((e.target as HTMLElement).style.display = 'none') })),
    h('div.ls-body.scroll', null,
      h('div.ls-head', null, h('img', { src: sectArtUrl(id, 'emblem'), alt: '' }),
        h('div.grow', null, h('h2', null, ch.name), h('p.ls-desc', null, ch.desc))),
      h('div.row.wrap', { style: 'gap:8px' },
        statChip('users', `${beaten}/${ch.npcs.length} cao thủ`),
        statChip('target', `${solved}/${tasks.length} thử thách`)),
      h('h3.section-title', null, 'Cao thủ'),
      h('div.ls-masters', null, ...ch.npcs.map((n) => {
        const open = npcOpen(app, n);
        const best = p.career[n.id];
        return champCard(champion(n.id), {
          locked: !open, name: n.name, cls: n === nextNpc ? 'next' : '',
          sub: open ? `${MODE_NAMES[n.mode]} · ${LEVEL_NAMES[n.level]}` : 'Thắng cao thủ trước để mở',
          foot: best !== undefined ? stars(best) : n === nextNpc ? h('span.cc-cta', null, 'Thách đấu') : null,
        }, () => {
          if (!open) return toast('Thắng cao thủ trước để mở', 'bad');
          close();
          npcModal(app, n);
        });
      })),
      tasks.length ? h('h3.section-title', null, 'Thử thách') : null,
      h('div.ls-tasks', null, ...tasks.map((c, i) => {
        const best = p.challenges[c.id] ?? 0;
        const open = taskOpen(app, c);
        return tap(h('button.task-card', { class: `${open ? '' : 'locked'} ${best ? 'done' : ''}` },
          h('span.tk-num', null, String(i + 1)),
          h('span.tk-text', null, h('b', null, FAMILY_INFO[c.family].name), h('span', null, FAMILY_INFO[c.family].desc)),
          open ? stars(best) : icon('lock'),
        ), () => {
          if (!open) return toast(`Giải bài trước trong nhóm ${FAMILY_INFO[c.family].name} ở Thử thách để mở`, 'bad');
          close();
          startChallenge(app, c, table);
        });
      })),
      h('details.ls-lore', null, h('summary', null, 'Truyền thuyết vùng đất'), h('p', null, (lore as { sects: Record<string, string> }).sects[id])),
      h('p.ls-note', null, `Đấu trên ${table.name}. Thử thách dùng vật lý chuẩn để bài nào cũng có lời giải.`),
      h('div.actions', null, btn('Đóng', close, 'ghost')),
    ),
    closeX(close),
  ), { dismissable: true });
}
