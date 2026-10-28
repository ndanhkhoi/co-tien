import { MODE_NAMES } from '../../core/rules';
import type { GameMode } from '../../core/rules/types';
import { CUES, TABLES } from '../../game/content/gear';
import lore from '../../game/content/lore.json';
import { RULES_TEXT, SKILL_RULES } from '../../game/content/rules-text';
import {
  CHAMPIONS, CLASSES, classInfo, cutoutUrl, KIND_LABEL, exprUrl, sect, sectArtUrl, SECTS, SECT_SIGNATURES, winUrl,
  type Champion, type SectId,
} from '../../game/content/sects';
import { cueStats, tableStats } from '../../game/content/stat-text';
import { OMEN_INFO } from '../../game/terrain';
import { motionModal as modal, screenEl, turnPage, type App, type Screen } from '../app';
import { btn, h, tabs, tap, toast } from '../dom';
import { champCard, closeX, cueArtEl, hex6, skillRow, statChip, statRows, tablePreview, topbar } from './menus';

/**
 * Cơ Tiên Lục — the world's library. Lands, champions, classes and rules. Champions the
 * player has never faced keep a portrait and unlock hint; meeting one opens their page, recruiting one
 * opens their full gallery, so there is always something left to discover.
 */
type Tab = 'land' | 'champ' | 'class' | 'rules';

const LORE = lore as { world: string; sects: Record<string, string>; champions: Record<string, { bio: string; quote: string }> };

function known(app: App, id: string) {
  return app.profile.met.includes(id) || app.profile.champions.includes(id);
}

export function codexScreen(app: App): Screen {
  const el = screenEl('codex');
  let tab: Tab = 'land';
  const discovered = CHAMPIONS.filter((c) => known(app, c.id)).length;
  const content = h('div.scroll.codex-scroll');
  const render = () => {
    content.scrollTop = 0;
    content.replaceChildren(tab === 'land' ? landList(app) : tab === 'champ' ? champGrid(app) : tab === 'class' ? classList() : rulesPage());
  };
  el.append(
    topbar(app, 'Cơ Tiên Lục', true, statChip('codex', `${discovered}/${CHAMPIONS.length}`, `Đã khám phá ${discovered}/${CHAMPIONS.length} tướng`)),
    h('div.sub-bar', null, tabs<Tab>([
      { id: 'land', label: 'Vùng đất', icon: 'journey' }, { id: 'champ', label: 'Tướng', icon: 'users' },
      { id: 'class', label: 'Hệ', icon: 'shield' }, { id: 'rules', label: 'Luật chơi', icon: 'scroll' },
    ], tab, (v) => {
      const order: Tab[] = ['land', 'champ', 'class', 'rules'];
      const direction = order.indexOf(v) > order.indexOf(tab) ? 1 : -1;
      tab = v;
      turnPage(content, render, direction);
    })),
    content,
  );
  render();
  return { el };
}

function landList(app: App): HTMLElement {
  return h('div.col', { style: 'gap:12px' },
    h('div.sheet.prose', null, h('h2.h3', null, 'Cơ Tiên Giới'), h('p', null, LORE.world)),
    h('div.land-grid', null, ...SECTS.map((s) => {
      const champs = CHAMPIONS.filter((c) => c.sect === s.id);
      const met = champs.filter((c) => known(app, c.id)).length;
      return tap(h('button.land-card', { style: `--sect:${hex6(s.main)}` },
        h('img', { src: sectArtUrl(s.id, 'emblem'), alt: '', loading: 'lazy' }),
        h('span.grow', null, h('b', null, s.name), h('span.lc-sub', null, `${met}/${champs.length} tướng đã gặp · ${OMEN_INFO[s.id].name}`)),
      ), () => landPage(app, s.id));
    })),
  );
}

function landPage(app: App, id: SectId, page?: DetailPage, direction = 1) {
  const entries = SECTS;
  const index = entries.findIndex((entry) => entry.id === id);
  const navigate = (step: number) => { const next = entries[index + step]; if (next) landPage(app, next.id, page, step); };

  const s = sect(id);
  const table = TABLES.find((t) => t.sect === id)!;
  const cues = CUES.filter((c) => c.sect === id);
  const omen = OMEN_INFO[id];
  const build = (close: () => void) => h('div.modal.codex-page.scroll', { style: `--sect:${hex6(s.main)}` },
    h('img.codex-banner', { src: sectArtUrl(id, 'splash'), alt: '', onerror: (e: Event) => (e.target as HTMLElement).remove() }),
    h('div.cp-head', null, h('img', { src: sectArtUrl(id, 'emblem'), alt: '' }), h('h2', null, s.name)),
    h('p.prose-p', null, LORE.sects[id]),
    h('p.prose-p', null, `Dấu ấn môn phái: ${SECT_SIGNATURES[id]}`),
    h('h3.section-title', null, 'Tướng'),
    h('div.cc-grid', null, ...CHAMPIONS.filter((c) => c.sect === id).map((c) => thumb(app, c, () => {
      close();
      champPage(app, c);
    }))),
    h('h3.section-title', null, `Linh Đài · Thiên Tượng: ${omen.name}`),
    h('div.cp-table', null, tablePreview(table), h('p', null, `${table.desc} ${omen.desc}`)),
    statRows(tableStats(table)),
    h('h3.section-title', null, 'Cơ của môn phái'),
    ...cues.map((c) => h('div.cp-cue', null, h('b', null, c.name), cueArtEl(c), statRows(cueStats(c)))),
    h('div.actions', null, ...detailButtons(index, entries.length, navigate), btn('Đóng', close, 'ghost')),
    closeX(close),
  );
  page = showDetail(build, page, direction, navigate);
}

function thumb(app: App, c: Champion, open: () => void): HTMLElement {
  const k = known(app, c.id);
  return champCard(c, { locked: !k, name: c.name, sub: k ? classInfo(c.cls).name : 'Gặp ở Hành trình để mở' },
    () => (k ? open() : toast('Gặp tướng này ở Hành trình hoặc Luận Cơ để mở trang', 'bad')));
}

function champGrid(app: App): HTMLElement {
  return h('div.sect-groups', null, ...SECTS.map((s) => {
    const list = CHAMPIONS.filter((c) => c.sect === s.id);
    const met = list.filter((c) => known(app, c.id)).length;
    return h('section.sect-group', null,
      h('div.sg-head', null, h('img', { src: sectArtUrl(s.id, 'emblem'), alt: '', loading: 'lazy' }), h('b', null, s.name), h('span.badge', null, `${met}/${list.length}`)),
      h('div.cc-grid', null, ...list.map((c) => thumb(app, c, () => champPage(app, c)))),
    );
  }));
}

function champPage(app: App, c: Champion, page?: DetailPage, direction = 1) {
  const entries = CHAMPIONS.filter((entry) => known(app, entry.id));
  const index = entries.findIndex((entry) => entry.id === c.id);
  const navigate = (step: number) => { const next = entries[index + step]; if (next) champPage(app, next, page, step); };

  const owned = app.profile.champions.includes(c.id);
  const cls = classInfo(c.cls);
  const info = LORE.champions[c.id];
  const gallery = owned
    ? h('div.codex-gallery', null,
      ...(['focus', 'joy', 'sad', 'cast'] as const).map((e) => h('img', { src: exprUrl(c.id, e), alt: '', loading: 'lazy' })),
      h('img.win', { src: winUrl(c.id), alt: '', loading: 'lazy' }))
    : h('p.locked-note', null, 'Chiêu mộ tướng này (thắng ở Hành trình hoặc mua trong Tàng Các) để mở bộ tranh đầy đủ.');
  const build = (close: () => void) => h('div.modal.codex-page.scroll', { style: `--sect:${hex6(sect(c.sect).main)}` },
    h('div.codex-champ', null,
      h('div.cc-cut', null, h('img', { src: cutoutUrl(c.id), alt: '' })),
      h('div.grow', null,
        h('div.cp-meta', null, h('span.badge.kind', { 'data-kind': c.kind }, KIND_LABEL[c.kind]), ` ${sect(c.sect).name} · bậc ${c.tier} · ${cls.name}`),
        h('h2', null, c.name),
        info ? h('blockquote.nm-quote', null, info.quote) : null,
        info ? h('p.prose-p', null, info.bio) : null,
      ),
    ),
    h('h3.section-title', null, 'Nội tại'),
    h('div.cm-passive', null, h('b', null, cls.name), h('p', null, cls.passive)),
    h('h3.section-title', null, 'Chiêu thức'),
    ...c.skills.map((sk) => skillRow(c, sk)),
    h('h3.section-title', null, 'Tranh'),
    gallery,
    h('div.actions', null, ...detailButtons(index, entries.length, navigate), btn('Đóng', close, 'ghost')),
    closeX(close),
  );
  page = showDetail(build, page, direction, navigate);
}

function classList(): HTMLElement {
  return h('div.class-grid', null, ...CLASSES.map((cl) => h('div.sheet.prose', null,
    h('h2.h3', null, cl.name),
    h('p', null, cl.passive),
    h('p.muted.small', null, CHAMPIONS.filter((c) => c.cls === cl.id).map((c) => c.name).join(' · ')),
  )));
}

function rulesPage(): HTMLElement {
  return h('div.col', { style: 'gap:12px' },
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
  let start: { x: number; y: number } | null = null;
  // Replacing handlers keeps rapid navigation from accumulating stale page callbacks.
  el.onpointerdown = (e) => { start = { x: e.clientX, y: e.clientY }; };
  el.onpointercancel = () => { start = null; };
  el.onpointerup = (e) => {
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    start = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) navigate(dx < 0 ? 1 : -1);
  };
  return page!;
}
