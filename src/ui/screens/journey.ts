import { CHAPTERS, LEVEL_NAMES, type Npc } from '../../game/content/career';
import { CHALLENGES, FAMILY_INFO, type ChallengeDef, type ChallengeFamily } from '../../game/content/challenges';
import { TABLES } from '../../game/content/gear';
import lore from '../../game/content/lore.json';
import { champion, sect, sectArtUrl, type SectId } from '../../game/content/sects';
import { MODE_NAMES } from '../../core/rules';
import { motionModal as modal, screenEl, type App, type Screen } from '../app';
import { btn, h, stars, tap, toast } from '../dom';
import { icon } from '../icons';
import { npcModal } from './career';
import { startChallenge } from './challenge-start';
import { artUrl, champCard, closeX, statChip, topbar } from '../widgets';
import { hex6 } from '../dom';
import { journeyFocus } from '../player-focus';

/**
 * Hành trình: one painted map of Cơ Tiên Giới shared by duels and challenges. Each land has
 * two gates — duel its five masters, or solve its trick shots — and the cloud path opens the
 * next land once the first master of the previous one has been beaten.
 */

/** Plaza of each land on art/ui/map.webp, as fractions of the image. */
const PINS: Record<SectId, [number, number]> = {
  thienquang: [0.85, 0.202], hoalinh: [0.536, 0.234], hailong: [0.8, 0.42],
  thienco: [0.591, 0.444], bangphach: [0.168, 0.194], docvu: [0.173, 0.388],
  kimsa: [0.177, 0.59], vanthu: [0.509, 0.655], huyetsat: [0.818, 0.662],
  uminh: [0.859, 0.808], tinhtu: [0.627, 0.824], thienhuong: [0.391, 0.848],
  hukhong: [0.132, 0.84],
};

const FAMILIES = Object.keys(FAMILY_INFO) as ChallengeFamily[];
const ALL_NPCS = CHAPTERS.flatMap((c) => c.npcs);

/**
 * Challenges dealt along the route: interleave the five families level by level (so every
 * land mixes shot types and difficulty rises along the path), then cut into one chunk per land.
 */
function challengesByLand(): Map<SectId, ChallengeDef[]> {
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

export function journeyScreen(app: App, focusLand?: SectId): Screen {
  const el = screenEl('journey');
  const p = app.profile;
  const byLand = challengesByLand();
  const map = h('div.journey-map', null, h('img.journey-art', { src: artUrl('ui/map.webp'), alt: 'Bản đồ Cơ Tiên Giới', draggable: false }));
  // Returning from a duel focuses its land; otherwise go to the first land still to play.
  const target = journeyFocus(focusLand, CHAPTERS.map((ch, i) => ({ id: ch.id, open: landOpen(app, i), beaten: ch.npcs.every((n) => p.career[n.id] !== undefined) })));
  const current = CHAPTERS.findIndex((ch) => ch.id === target);
  CHAPTERS.forEach((ch, i) => {
    const [x, y] = PINS[ch.id];
    const open = landOpen(app, i);
    const beaten = ch.npcs.filter((n) => p.career[n.id] !== undefined).length;
    const tasks = byLand.get(ch.id) ?? [];
    const solved = tasks.filter((t) => (p.challenges[t.id] ?? 0) > 0).length;
    const done = beaten === ch.npcs.length;
    const state = !open ? 'locked' : i === current ? 'current' : done ? 'done' : '';
    const pin = h('button.land-pin', {
      class: state,
      style: `left:clamp(56px, ${x * 100}%, calc(100% - 56px));--pin-y:${y * 100}%;--sect:${hex6(sect(ch.id).main)}`,
      'aria-label': open ? `${ch.name}: ${beaten}/${ch.npcs.length} cao thủ, ${solved}/${tasks.length} thử thách` : `${ch.name}: chưa mở`,
    },
    i === current ? h('span.lp-flag', null, 'Đi tiếp') : null,
    h('span.lp-emblem', null,
      h('img', { src: sectArtUrl(ch.id, 'emblem'), alt: '' }),
      h('span.lp-badge', null, open ? (i + 1).toString() : icon('lock')),
      done ? icon('check', 'lp-check') : null),
    h('span.lp-text', null, h('span.lp-name', null, `${i + 1}. ${ch.name}`)),
    );
    tap(pin, () => (open ? landSheet(app, ch.id) : toast(`Thắng ${CHAPTERS[i - 1].npcs[0].name} ở ${CHAPTERS[i - 1].name} để mở đường tới đây`, 'bad')));
    map.append(pin);
  });
  const beatenAll = Object.keys(p.career).length;
  const solvedAll = Object.values(p.challenges).filter((v) => v > 0).length;
  el.append(
    topbar(app, 'Hành trình', true,
      statChip('users', `${beatenAll}/${ALL_NPCS.length}`, `Đã thắng ${beatenAll}/${ALL_NPCS.length} cao thủ`),
      statChip('target', `${solvedAll}/${CHALLENGES.length}`, `Đã giải ${solvedAll}/${CHALLENGES.length} thử thách`)),
    h('div.journey-scroll', null, map),
  );
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
      h('div.ls-masters', null, ...ch.npcs.map((n, ni) => {
        const open = npcOpen(app, n);
        const best = p.career[n.id];
        // Masters are sorted by tier, so the last one is the land's tier-5 boss.
        const boss = ni === ch.npcs.length - 1;
        const foot = best !== undefined ? stars(best) : n === nextNpc ? h('span.cc-cta', null, 'Thách đấu') : null;
        return champCard(champion(n.id), {
          locked: !open, name: n.name, cls: `${boss ? 'ls-boss' : 'ls-master'}${n === nextNpc ? ' next' : ''}`,
          sub: open ? `${MODE_NAMES[n.mode]} · ${LEVEL_NAMES[n.level]}` : 'Thắng cao thủ trước để mở',
          foot: boss ? h('span.ls-boss-foot', null, h('span.ls-boss-tag', null, 'Trùm vùng'), foot) : foot,
        }, () => {
          if (!open) return toast('Thắng cao thủ trước để mở', 'bad');
          close();
          npcModal(app, n);
        });
      })),
      tasks.length ? h('h3.section-title', null, 'Luyện Cơ') : null,
      h('div.ls-tasks', null, ...tasks.map((c, i) => {
        const best = p.challenges[c.id] ?? 0;
        const open = taskOpen(app, c);
        return tap(h('button.task-card', { class: `${open ? '' : 'locked'} ${best ? 'done' : ''}` },
          h('span.tk-num', null, String(i + 1)),
          h('span.tk-text', null, h('b', null, FAMILY_INFO[c.family].name), h('span', null, FAMILY_INFO[c.family].desc)),
          open ? stars(best) : icon('lock'),
        ), () => {
          if (!open) return toast(`Giải bài trước trong nhóm ${FAMILY_INFO[c.family].name} ở Luyện Cơ để mở`, 'bad');
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
