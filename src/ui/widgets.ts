import { CHAMPION_PRICE, CHAMPIONS, champion, classInfo, sect, sectArtUrl, SECTS, type Champion, type SectId } from '../game/content/sects';
import type { StatLine } from '../game/content/stat-text';
import type { CueDef, TableSkin } from '../game/content/gear';
import type { App } from './app';
import { avatar } from './avatar';
import { bar5, chip, h, hex6, iconBtn, tap } from './dom';
import { icon, type IconName } from './icons';

const BASE = new URL(import.meta.env.BASE_URL, document.baseURI).href;
/** Absolute URL of a file under public/art (safe inside CSS variables too). */
export const artUrl = (path: string) => `${BASE}art/${path}`;
export const fmt = (n: number) => n.toLocaleString('vi-VN');
export type Kid = Node | string | null | undefined | false;

/** Screen header on its own solid sheet: back, serif title, optional stats, coins. */
export function topbar(app: App, title: string, back = true, ...extra: Kid[]): HTMLElement {
  return h('header.topbar', null,
    back ? iconBtn(icon('back'), () => app.back(), 'Quay lại') : null,
    h('h1.tb-title', null, title),
    h('div.tb-extra', null, ...extra),
    wallet(app),
  );
}

export function wallet(app: App): HTMLElement {
  return h('span.chip.stat.wallet', { 'aria-label': `${fmt(app.profile.coins)} xu` }, icon('coin'), h('span.num', null, fmt(app.profile.coins)));
}

/** Round close button pinned to the modal's top-right corner. */
export function closeX(close: () => void): HTMLButtonElement {
  const b = iconBtn(icon('close'), close, 'Đóng');
  b.classList.add('close-x', 'small');
  return b;
}

/** Small read-only stat chip with a painted icon. */
export function statChip(ic: IconName, text: string, label = ''): HTMLElement {
  return h('span.chip.stat', { 'aria-label': label || text }, icon(ic), h('span.num', null, text));
}

/** Single-choice chip group. */
export function seg<T extends string | number>(options: [T, string][], value: T, onChange: (v: T) => void): HTMLElement {
  const box = h('div.chips', { role: 'radiogroup' });
  const render = (v: T) => box.replaceChildren(...options.map(([k, label]) => chip(label, k === v, () => {
    if (k === v) return;
    onChange(k);
    render(k);
  })));
  render(value);
  return box;
}

/** One stat sheet row: label, optional 1–5 bar, value and what it does. */
export function statRows(lines: StatLine[]): HTMLElement {
  return h('div.stat-sheet', null, ...lines.map((l) => h('div.st-row', null,
    h('div.st-head', null, h('b', null, l.label), l.bar ? bar5(l.bar) : null, h('span.st-val', null, l.value)),
    h('div.st-exp', null, l.explain),
  )));
}

/** Painted cue for menus, including the plain wooden house cue. */
export function cueArtEl(c: CueDef): HTMLElement {
  const src = c.sect ? sectArtUrl(c.sect, c.id.endsWith('-b') ? 'cue-b' : 'cue-a') : artUrl('ui/cue-default.webp');
  return h('div.cue-strip', null, h('img', { src, alt: '', draggable: false, decoding: 'async', loading: 'lazy' }));
}

/** CSS felt preview of a table skin (cloth inside its rail). */
export function tablePreview(t: TableSkin): HTMLElement {
  return h('div.table-preview', { style: `--rail:${hex6(t.rail)};--rail-d:${hex6(t.railDark)};--cloth:${hex6(t.cloth)};--cloth-d:${hex6(t.clothDark)}` },
    h('img', { src: sectArtUrl(t.sect, 'emblem'), alt: '', loading: 'lazy' }));
}

/**
 * Portrait card for a champion. Locked champions keep their real portrait with a lock disc and an unlock hint.
 */
export function champCard(c: Champion, opts: { locked?: boolean; sel?: boolean; name?: string; sub?: string; badge?: Kid; foot?: Kid; cls?: string }, fn: () => void): HTMLButtonElement {
  return tap(h('button.champ-card', {
    class: `${opts.locked ? 'locked' : ''} ${opts.sel ? 'sel' : ''} ${opts.cls ?? ''}`,
    style: `--sect:${hex6(sect(c.sect).main)}`,
    'aria-label': opts.name ?? c.name,
  },
  h('span.cc-art', null, avatar(c.id), opts.locked ? h('span.cc-lock', null, icon('lock')) : null, opts.badge ?? null),
  h('span.cc-name', null, opts.name ?? c.name),
  opts.sub ? h('span.cc-sub', null, opts.sub) : null,
  opts.foot ?? null,
  ), fn);
}

/** Champions grouped by sect, each group on its own sheet. */
interface PickerOpts {
  selected: () => string;
  onPick: (c: Champion) => void;
  onlyOwned?: boolean;
  exclude?: () => string | null;
  /** Shows only champions that pass (Tàng Các filters by class); sects left empty are hidden. */
  match?: (c: Champion) => boolean;
  /** Makes each sect heading a link to that sect's page. */
  onSect?: (id: SectId) => void;
  /** Scrolls this sect's group into view once it is painted. */
  focus?: SectId;
}

export function championPicker(app: App, opts: PickerOpts): HTMLElement {
  const { selected, onPick, onlyOwned = false, exclude = () => null, match = () => true } = opts;
  const wrap = h('div.sect-groups');
  const card = (c: Champion) => {
    const has = app.profile.champions.includes(c.id);
    return champCard(c, {
      locked: !has, sel: selected() === c.id,
      sub: has ? classInfo(c.cls).name : `Thắng ở Hành trình · ${fmt(CHAMPION_PRICE[c.tier])} xu`,
      badge: selected() === c.id ? h('span.cc-using', null, 'Đang dùng') : null,
    }, () => {
      onPick(c);
      render();
    });
  };
  const group = (s: (typeof SECTS)[number]) => {
    const all = CHAMPIONS.filter((c) => c.sect === s.id && match(c));
    if (!all.length) return '';
    const el = h('section.sect-group', { 'data-sect': s.id }, sectHead(app, s, all, opts.onSect), h('div.cc-grid', null, ...all.map(card)));
    if (s.id === opts.focus) requestAnimationFrame(() => markJump(el));
    return el;
  };
  let pass = 0;
  const render = () => {
    // Picking among owned champions: one flat grid, no empty sect headers.
    if (onlyOwned) {
      wrap.replaceChildren(h('div.cc-grid', null, ...CHAMPIONS.filter((c) => app.profile.champions.includes(c.id) && c.id !== exclude()).map(card)));
      return;
    }
    // The first sects paint with the screen; the rest follow a frame at a time so opening never stalls.
    const run = ++pass;
    wrap.replaceChildren(...SECTS.slice(0, 2).map(group));
    let i = 2;
    const more = () => {
      if (run !== pass || i >= SECTS.length) return;
      wrap.append(group(SECTS[i++]));
      requestAnimationFrame(more);
    };
    requestAnimationFrame(more);
  };
  render();
  return wrap;
}

function sectHead(app: App, s: (typeof SECTS)[number], shown: Champion[], onSect?: (id: SectId) => void): HTMLElement {
  const owned = shown.filter((c) => app.profile.champions.includes(c.id)).length;
  const parts = [h('img', { src: sectArtUrl(s.id, 'emblem'), alt: '', loading: 'lazy' }), h('b', null, s.name), h('span.badge', null, `${owned}/${shown.length}`)];
  if (!onSect) return h('div.sg-head', null, ...parts);
  return tap(h('button.sg-head.sg-link', { type: 'button', 'aria-label': `${s.name} · Xem môn phái` }, ...parts, h('span.sg-more', null, 'Môn phái ›')), () => onSect(s.id));
}

/** Brings an element the player jumped to into view and marks it briefly. */
export function markJump(el: Element) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ block: 'start', behavior: reduced ? 'auto' : 'smooth' });
  el.classList.remove('jump-mark');
  el.classList.add('jump-mark');
}



/** Champion preview shared by the profile and Song Đấu seat sheets. */
export function championPreview(): { preview: HTMLElement; label: HTMLElement; show(pick: string): void } {
  const preview = h('div.pm-av');
  const label = h('div.pm-char');
  return {
    preview,
    label,
    show(pick: string) {
      const c = champion(pick);
      preview.replaceChildren(avatar(c.id));
      label.replaceChildren(h('b', null, c.name), h('span', null, `${classInfo(c.cls).name} · ${sect(c.sect).name}`));
    },
  };
}
