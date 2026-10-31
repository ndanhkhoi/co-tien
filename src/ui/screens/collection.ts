import { CUES, TABLES, type CueDef, type TableSkin } from '../../game/content/gear';
import { CHAMPIONS, CLASSES, classInfo, sect, sectArtUrl, type ClassId, type SectId } from '../../game/content/sects';
import { cueStats, tableStats, TABLE_NOTE, type StatLine } from '../../game/content/stat-text';
import { screenEl, turnPage, type App, type Screen } from '../app';
import { btn, chip, h, tabs, tap, toast } from '../dom';
import { icon } from '../icons';
import { championPicker, cueArtEl, fmt, markJump, statChip, statRows, tablePreview, topbar, wallet } from '../widgets';
import { championModal } from './champion-page';
import { rulesPage, sectPage } from './library';

/**
 * Tàng Các: what you own and what you can read, one place for each. Champions are grouped by sect and the
 * sect heading opens that land's page; Pháp Cơ and Linh Đài cards link back to their sect; Luật holds the
 * world's opening and the rules.
 */
type CollTab = 'champ' | 'cue' | 'table' | 'rules';

const TABS = [
  { id: 'champ', label: 'Tướng', icon: 'users' }, { id: 'cue', label: 'Pháp Cơ', icon: 'strike' },
  { id: 'table', label: 'Linh Đài', icon: 'target' }, { id: 'rules', label: 'Luật', icon: 'scroll' },
] as const satisfies { id: CollTab; label: string; icon: Parameters<typeof icon>[0] }[];

export function collectionScreen(app: App): Screen {
  const el = screenEl('collection');
  const content = h('div.scroll.coll-scroll');
  const note = h('p.coll-note.nav-caption');
  const refreshWallet = () => el.querySelector('.wallet')?.replaceWith(wallet(app));
  const view: CollectionView = {
    app, tab: 'champ', cls: null, focus: null, content, note, lv: app.level, refreshWallet,
    render: () => renderCollectionTab(view),
    openSect: (id) => sectPage(app, id, (shelf, sid) => {
      view.focus = sid;
      view.cls = null;
      if (shelf === view.tab) view.render();
      else bar.select(shelf);
    }),
  };
  const order = TABS.map((t) => t.id as CollTab);
  const bar = tabs<CollTab>([...TABS], view.tab, (v) => {
    const direction = order.indexOf(v) > order.indexOf(view.tab) ? 1 : -1;
    view.tab = v;
    turnPage(content, view.render, direction);
  });
  view.render();
  const header = topbar(app, 'Tàng Các', true, bar);
  header.classList.add('compact-nav');
  el.append(header, note, content);
  return { el };
}

interface CollectionView {
  app: App;
  tab: CollTab;
  /** Class filter on the champion tab; null shows all. */
  cls: ClassId | null;
  /** Sect a sect page sent the player to; scrolled to on the next render. */
  focus: SectId | null;
  content: HTMLElement;
  note: HTMLElement;
  lv: number;
  refreshWallet(): void;
  render(): void;
  openSect(id: SectId): void;
}

function renderCollectionTab(view: CollectionView) {
  const { tab, content, note } = view;
  content.replaceChildren();
  content.scrollTop = 0;
  if (tab === 'rules') {
    note.textContent = 'Cơ Tiên Giới, luật của từng lối chơi và cách dùng chiêu.';
    content.append(rulesPage());
  } else if (tab === 'champ') {
    renderChampionTab(view);
  } else {
    renderGearTab(view);
  }
  view.focus = null;
}

function renderChampionTab(view: CollectionView) {
  const { app, note, content, refreshWallet, render } = view;
  const p = app.profile;
  const cls = view.cls ? classInfo(view.cls) : null;
  note.textContent = cls ? `Hệ ${cls.name} · ${cls.passive}`
    : `Đã chiêu mộ ${p.champions.length}/${CHAMPIONS.length} tướng. Chạm tướng để xem chiêu, tiểu sử và tranh; chạm tên môn phái để đọc về vùng đất.`;
  const pickClass = (id: ClassId | null) => {
    view.cls = id;
    render();
  };
  content.append(
    h('div.chips.class-filter', { role: 'group', 'aria-label': 'Lọc theo hệ' },
      chip('Tất cả', !cls, () => pickClass(null)),
      ...CLASSES.map((c) => chip(c.name, c.id === view.cls, () => pickClass(c.id === view.cls ? null : c.id)))),
    championPicker(app, {
      selected: () => p.champion,
      onPick: (c) => championModal(app, c, () => {
        refreshWallet();
        render();
      }),
      match: (c) => !view.cls || c.cls === view.cls,
      onSect: view.openSect,
      focus: view.focus ?? undefined,
    }));
}

function renderGearTab(view: CollectionView) {
  const { app, tab, content, note, lv, refreshWallet } = view;
  const p = app.profile;
  const grid = h('div.gear-grid');
  if (tab === 'cue') {
    note.textContent = 'Pháp Cơ nào cũng có đường ngắm và bi ảo. Chỉ số chỉ đổi những gì ghi bên dưới.';
    for (const c of CUES) grid.append(gearCard(app, { it: c, art: cueArtEl(c), stats: cueStats(c), owned: p.cues.includes(c.id), eq: p.cue === c.id, lv, take: () => {
      if (!p.cues.includes(c.id)) p.cues.push(c.id);
      p.cue = c.id;
    }, render: view.render, refreshWallet, openSect: view.openSect }));
    content.append(grid);
    return;
  }
  note.textContent = TABLE_NOTE;
  for (const t of TABLES) {
    grid.append(gearCard(app, { it: t, art: tablePreview(t), stats: tableStats(t), owned: p.tables.includes(t.id), eq: p.table === t.id, lv, take: () => {
      if (!p.tables.includes(t.id)) p.tables.push(t.id);
      p.table = t.id;
    }, render: view.render, refreshWallet, openSect: view.openSect }));
  }
  content.append(grid);
  const target = view.focus && grid.querySelector(`[data-sect="${view.focus}"]`);
  if (target) requestAnimationFrame(() => markJump(target));
}

interface GearCard {
  it: CueDef | TableSkin;
  art: Element;
  stats: StatLine[];
  owned: boolean;
  eq: boolean;
  lv: number;
  take(): void;
  render(): void;
  refreshWallet(): void;
  openSect(id: SectId): void;
}

function gearCard(app: App, x: GearCard): HTMLElement {
  const { it, art, stats, owned, eq, lv } = x;
  const locked = !owned && lv < it.level;
  return h('div.gear-card', { class: `${eq ? 'sel' : ''} ${locked ? 'locked' : ''}`, 'data-sect': it.sect ?? null },
    h('div.gc-head', null, h('b.grow', null, it.name),
      eq ? h('span.badge.accent', null, 'Đang dùng') : owned ? h('span.badge.ok', null, 'Đã có') : statChip('coin', fmt(it.price))),
    it.sect ? sectLink(it.sect, x.openSect) : null,
    art,
    h('p.gc-desc', null, it.desc),
    statRows(stats),
    gearAction(app, x),
  );
}

function sectLink(id: SectId, open: (id: SectId) => void): HTMLButtonElement {
  return tap(h('button.gc-sect', { type: 'button', 'aria-label': `${sect(id).name} · Xem môn phái` },
    h('img', { src: sectArtUrl(id, 'emblem'), alt: '', loading: 'lazy' }), sect(id).name), () => open(id));
}

function gearAction(app: App, x: GearCard): HTMLButtonElement {
  const { it, owned, eq, lv, take, render, refreshWallet } = x;
  const locked = !owned && lv < it.level;
  const act = () => {
    if (!owned) {
      app.profile.coins -= it.price;
      toast(`Đã mua ${it.name}`, 'gold');
    }
    take();
    app.save();
    refreshWallet();
    render();
  };
  if (eq) return btn(h('span.btn-in', null, icon('check'), 'Đang trang bị'), () => {}, 'ghost small block');
  if (owned) return btn('Trang bị', act, 'small block');
  if (locked) return btn(h('span.btn-in', null, icon('lock'), `Mở ở cấp ${it.level}`), () => toast(`Đạt cấp ${it.level} để mở khoá`, 'bad'), 'ghost small block');
  return btn(h('span.btn-in', null, icon('coin', 'keep'), `Mua · ${fmt(it.price)} xu`), () => (app.profile.coins >= it.price ? act() : toast('Chưa đủ xu', 'bad')), 'small block');
}
