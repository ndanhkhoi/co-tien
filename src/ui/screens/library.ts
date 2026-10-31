import { MODE_NAMES } from '../../core/rules';
import type { GameMode } from '../../core/rules/types';
import { CUES, TABLES } from '../../game/content/gear';
import lore from '../../game/content/lore.json';
import { RULES_TEXT, SKILL_RULES } from '../../game/content/rules-text';
import { CHAMPIONS, sect, sectArtUrl, SECTS, SECT_SIGNATURES, type SectId } from '../../game/content/sects';
import { OMEN_INFO } from '../../game/terrain';
import { motionModal as modal, turnPage, type App } from '../app';
import { btn, h, hex6, tap } from '../dom';
import { swipeDirection, type SwipeStart } from '../swipe';
import { closeX } from '../widgets';

/**
 * Tàng Các reading pages: each sect's land and the rules shelf. A sect page tells the land's story and
 * points at its champions, Linh Đài and Pháp Cơ in the collection tabs instead of copying their cards.
 */

const LORE = lore as { world: string; sects: Record<string, string> };

/** Collection tabs a sect page can send the player to. */
type SectShelf = 'champ' | 'cue' | 'table';

export function known(app: App, id: string) {
  return app.profile.met.includes(id) || app.profile.champions.includes(id);
}

interface SectView { app: App; jump: (shelf: SectShelf, id: SectId) => void }

export function sectPage(app: App, id: SectId, jump: SectView['jump']) {
  openSect({ app, jump }, id);
}

function openSect(view: SectView, id: SectId, page?: DetailPage, direction = 1) {
  const { app, jump } = view;
  const index = SECTS.findIndex((entry) => entry.id === id);
  const navigate = (step: number) => { const next = SECTS[index + step]; if (next) openSect(view, next.id, page, step); };
  const s = sect(id);
  const omen = OMEN_INFO[id];
  const build = (close: () => void) => h('div.modal.codex-page.scroll', { style: `--sect:${hex6(s.main)}` },
    closeX(close),
    h('img.codex-banner', { src: sectArtUrl(id, 'splash'), alt: '', onerror: (e: Event) => (e.target as HTMLElement).remove() }),
    h('div.cp-head', null, h('img', { src: sectArtUrl(id, 'emblem'), alt: '' }), h('h2', null, s.name)),
    h('p.prose-p', null, LORE.sects[id]),
    h('p.prose-p', null, `Dấu ấn môn phái: ${SECT_SIGNATURES[id]}`),
    h('h3.section-title', null, `Thiên Tượng · ${omen.name}`),
    h('p.prose-p', null, omen.desc),
    h('h3.section-title', null, 'Trong Tàng Các'),
    h('div.sect-shelves', null, ...shelfLinks(app, id).map(([shelf, title, sub]) => tap(h('button.shelf-link', { type: 'button' },
      h('b', null, title), h('span', null, sub)), () => {
      close();
      jump(shelf, id);
    }))),
    h('div.actions', null, ...detailButtons(index, SECTS.length, navigate), btn('Đóng', close, 'ghost')),
  );
  page = showDetail(build, page, direction, navigate);
}

function shelfLinks(app: App, id: SectId): [SectShelf, string, string][] {
  const champs = CHAMPIONS.filter((c) => c.sect === id);
  const owned = champs.filter((c) => app.profile.champions.includes(c.id)).length;
  const met = champs.filter((c) => known(app, c.id)).length;
  const table = TABLES.find((t) => t.sect === id);
  const cues = CUES.filter((c) => c.sect === id);
  return [
    ['champ', 'Tướng', `Đã gặp ${met}/${champs.length} · đã chiêu mộ ${owned}`],
    ['table', 'Linh Đài', table?.name ?? ''],
    ['cue', 'Pháp Cơ', cues.map((c) => c.name).join(' · ')],
  ];
}

/** The world's opening, the rules of every mode, then how skills work. */
export function rulesPage(): HTMLElement {
  return h('div.col', { style: 'gap:12px' },
    h('div.sheet.prose', null, h('h2.h3', null, 'Cơ Tiên Giới'), h('p', null, LORE.world)),
    ...(Object.keys(RULES_TEXT) as GameMode[]).map((m) => h('div.sheet.prose', null,
      h('h2.h3', null, MODE_NAMES[m]),
      h('p', null, RULES_TEXT[m].goal),
      h('ul.rules-list', null, ...RULES_TEXT[m].points.map((t) => h('li', null, t))))),
    h('div.sheet.prose', null, h('h2.h3', null, 'Tiên Đạo'), h('ul.rules-list', null, ...SKILL_RULES.map((t) => h('li', null, t)))),
  );
}

interface DetailPage { el: HTMLElement; close: () => void }

function detailButtons(index: number, count: number, navigate: (step: number) => void) {
  const prev = btn('Trước', () => navigate(-1), 'ghost');
  const next = btn('Tiếp', () => navigate(1), 'ghost');
  prev.disabled = index <= 0;
  next.disabled = index >= count - 1;
  return [prev, next];
}

function showDetail(build: (close: () => void) => HTMLElement, page: DetailPage | undefined,
  direction: number, navigate: (step: number) => void): DetailPage {
  if (page) {
    const current = page;
    turnPage(current.el, () => {
      const next = build(current.close);
      current.el.replaceChildren(...next.childNodes);
      current.el.style.cssText = next.style.cssText;
      current.el.scrollTop = 0;
    }, direction);
  } else {
    modal((close) => {
      page = { el: build(close), close };
      return page.el;
    }, { dismissable: true });
  }
  const el = page!.el;
  let start: SwipeStart = null;
  // Replacing handlers keeps rapid navigation from accumulating stale page callbacks.
  el.onpointerdown = (e) => { start = { x: e.clientX, y: e.clientY }; };
  el.onpointercancel = () => { start = null; };
  el.onpointerup = (e) => {
    const direction = swipeDirection(start, e);
    start = null;
    if (direction) navigate(direction);
  };
  return page!;
}
