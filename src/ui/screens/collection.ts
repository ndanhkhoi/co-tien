import { CUES, TABLES, type CueDef, type TableSkin } from '../../game/content/gear';
import { CHAMPIONS } from '../../game/content/sects';
import { cueStats, tableStats, TABLE_NOTE, type StatLine } from '../../game/content/stat-text';
import { screenEl, turnPage, type App, type Screen } from '../app';
import { btn, h, tabs, toast } from '../dom';
import { icon } from '../icons';
import { championPicker, cueArtEl, fmt, statChip, statRows, tablePreview, topbar, wallet } from '../screen-bits';
import { classList, landList, rulesPage } from './codex';
import { championModal } from './profile';

/** Tàng Các keeps what you own (champions, cues, tables) and Cơ Tiên Lục, the world's library. */
type CollTab = 'champ' | 'cue' | 'table' | 'land' | 'class' | 'rules';

const TABS = [
  { id: 'champ', label: 'Tướng', icon: 'users' }, { id: 'cue', label: 'Pháp Cơ', icon: 'strike' }, { id: 'table', label: 'Linh Đài', icon: 'target' },
  { id: 'land', label: 'Vùng đất', icon: 'journey' }, { id: 'class', label: 'Hệ', icon: 'shield' }, { id: 'rules', label: 'Luật', icon: 'scroll' },
] as const satisfies { id: CollTab; label: string; icon: Parameters<typeof icon>[0] }[];

export function collectionScreen(app: App): Screen {
  const el = screenEl('collection');
  let tab: CollTab = 'champ';
  const content = h('div.scroll.coll-scroll');
  const note = h('p.coll-note.nav-caption');
  const lv = app.level;
  const refreshWallet = () => el.querySelector('.wallet')?.replaceWith(wallet(app));
  const render = () => renderCollectionTab({ app, tab, content, note, lv, refreshWallet, render });
  const bar = tabs<CollTab>([...TABS], tab, (v) => {
    const order: CollTab[] = ['champ', 'cue', 'table', 'land', 'class', 'rules'];
    const direction = order.indexOf(v) > order.indexOf(tab) ? 1 : -1;
    tab = v;
    turnPage(content, render, direction);
  });
  render();
  const header = topbar(app, 'Tàng Các', true, bar);
  header.classList.add('compact-nav');
  el.append(header, note, content);
  return { el };
}

interface CollectionView {
  app: App;
  tab: CollTab;
  content: HTMLElement;
  note: HTMLElement;
  lv: number;
  refreshWallet(): void;
  render(): void;
}

function renderCollectionTab(view: CollectionView) {
  const { app, tab, content, note } = view;
  content.replaceChildren();
  content.scrollTop = 0;
  if (renderLibraryTab(app, tab, note, content)) return;
  if (tab === 'champ') {
    renderChampionTab(view);
    return;
  }
  renderGearTab(view);
}

function renderLibraryTab(app: App, tab: CollTab, note: HTMLElement, content: HTMLElement): boolean {
  if (tab !== 'land' && tab !== 'class' && tab !== 'rules') return false;
  note.textContent = tab === 'land' ? 'Cơ Tiên Lục · mười ba môn phái, Linh Đài và Pháp Cơ của từng vùng.' : tab === 'class' ? 'Cơ Tiên Lục · bảy hệ, mỗi hệ một nội tại.' : 'Cơ Tiên Lục · luật của từng lối chơi.';
  content.append(tab === 'land' ? landList(app) : tab === 'class' ? classList() : rulesPage());
  return true;
}

function renderChampionTab(view: CollectionView) {
  const { app, note, content, refreshWallet, render } = view;
  const p = app.profile;
  note.textContent = `Đã chiêu mộ ${p.champions.length}/${CHAMPIONS.length} tướng. Chạm một tướng để xem nội tại và 3 chiêu.`;
  content.append(championPicker(app, { selected: () => p.champion, onPick: (c) => championModal(app, c, () => {
    refreshWallet();
    render();
  }) }));
}

function renderGearTab(view: CollectionView) {
  const { app, tab, content, note, lv, refreshWallet } = view;
  content.replaceChildren();
  content.scrollTop = 0;
  const p = app.profile;
  const grid = h('div.gear-grid');
  if (tab === 'cue') {
    note.textContent = 'Pháp Cơ nào cũng có đường ngắm và bi ảo. Chỉ số chỉ đổi những gì ghi bên dưới.';
    for (const c of CUES) grid.append(gearCard(app, { it: c, art: cueArtEl(c), stats: cueStats(c), owned: p.cues.includes(c.id), eq: p.cue === c.id, lv, take: () => {
      if (!p.cues.includes(c.id)) p.cues.push(c.id);
      p.cue = c.id;
    }, render: view.render, refreshWallet }));
    content.append(grid);
    return;
  }
  note.textContent = TABLE_NOTE;
  for (const t of TABLES) {
    grid.append(gearCard(app, { it: t, art: tablePreview(t), stats: tableStats(t), owned: p.tables.includes(t.id), eq: p.table === t.id, lv, take: () => {
      if (!p.tables.includes(t.id)) p.tables.push(t.id);
      p.table = t.id;
    }, render: view.render, refreshWallet }));
  }
  content.append(grid);
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
  render(): void;
}

function gearCard(app: App, x: GearCard): HTMLElement {
  const { it, art, stats, owned, eq, lv } = x;
  const locked = !owned && lv < it.level;
  return h('div.gear-card', { class: `${eq ? 'sel' : ''} ${locked ? 'locked' : ''}` },
    h('div.gc-head', null, h('b.grow', null, it.name),
      eq ? h('span.badge.accent', null, 'Đang dùng') : owned ? h('span.badge.ok', null, 'Đã có') : statChip('coin', fmt(it.price))),
    art,
    h('p.gc-desc', null, it.desc),
    statRows(stats),
    gearAction(app, x),
  );
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
