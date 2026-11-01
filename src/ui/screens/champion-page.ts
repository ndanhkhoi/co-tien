import lore from '../../game/content/lore.json';
import {
  CHAMPION_PRICE, classInfo, cutoutUrl, exprUrl, finisherUrl, sect, sectArtUrl, skillIconUrl, KIND_LABEL, type Champion,
} from '../../game/content/sects';
import { skillReach, skillUsage } from '../../game/content/skill-usage';
import { hasArt } from '../../platform/preload';
import { fullFigurePaintings, preloadFigures } from '../champion-art';
import { motionModal as modal, turnPage, type App } from '../app';
import { btn, h, hex6, tabs, tap, toast } from '../dom';
import { icon } from '../icons';
import { closeX, fmt } from '../widgets';
import { known } from './library';

/**
 * The one page per champion in Tàng Các: skills to study, then the biography once you have met them
 * and the full painting set once they are recruited. Recruit or pick them from the footer.
 */

const BIOS = (lore as { champions: Record<string, { bio: string; quote: string }> }).champions;

type ChampSection = 'skills' | 'bio' | 'art';

const SECTIONS: { id: ChampSection; label: string }[] = [
  { id: 'skills', label: 'Chiêu thức' }, { id: 'bio', label: 'Tiểu sử' }, { id: 'art', label: 'Tranh' },
];

export function championModal(app: App, c: Champion, onChange?: () => void) {
  const p = app.profile;
  const s = sect(c.sect);
  const cls = classInfo(c.cls);
  modal((close) => {
    const owned = p.champions.includes(c.id);
    const action = owned ? ownedAction(app, c, close, onChange) : recruitAction(app, c, close, onChange);
    const pane = h('div.cp-pane');
    const cutout = { label: 'Toàn thân', src: cutoutUrl(c.id) };
    const art: HeroArt = { hero: heroButton(c, cutout), cutout };
    const page = h('div.cp-main', null,
      h('header.cp-head', null,
        h('div.cp-title', null,
          h('img', { src: sectArtUrl(c.sect, 'emblem'), alt: '' }),
          h('h2.cp-name', null, c.name),
          h('span.cp-sect', null, s.name)),
        h('div.cp-tags', null,
          h('span.badge.kind', { 'data-kind': c.kind }, KIND_LABEL[c.kind]),
          h('span.badge', null, `Bậc ${c.tier}`),
          h('span.badge', null, cls.name),
          owned ? h('span.badge.ok', null, 'Đã chiêu mộ') : h('span.badge.accent', null, 'Chưa chiêu mộ')),
        h('div.cp-tabs', null, sectionTabs(app, c, pane, art), action)),
      h('div.cp-content.scroll.no-scroll-hint', { tabindex: '0', 'aria-label': 'Thông tin tướng' }, pane));
    return h('div.modal.champ-page', { style: `--sect:${hex6(s.main)}` }, art.hero, page, closeX(close));
  }, { dismissable: true });
}

interface HeroArt { hero: HTMLButtonElement; cutout: GalleryItem }

function heroButton(c: Champion, art: GalleryItem): HTMLButtonElement {
  const hero = h('button.cp-art', {
    type: 'button', 'aria-label': `${c.name} · ${art.label} · Xem trọn tranh`,
    'data-art': art.src, 'data-art-label': art.label, 'data-art-name': c.name,
  }, h('img', { src: art.src, alt: '', draggable: false, decoding: 'async' }));
  return tap(hero, () => artViewer(hero.dataset.art ?? art.src, `${c.name} · ${hero.dataset.artLabel ?? art.label}`));
}
function setHeroArt(hero: HTMLButtonElement, art: GalleryItem): void {
  hero.querySelector('img')!.src = art.src;
  hero.dataset.art = art.src;
  hero.dataset.artLabel = art.label;
  hero.setAttribute('aria-label', `${hero.dataset.artName} · ${art.label} · Xem trọn tranh`);
}

function sectionTabs(app: App, c: Champion, pane: HTMLElement, hero: HeroArt): HTMLElement {
  let current: ChampSection = 'skills';
  const bar = tabs(SECTIONS, current, (next) => {
    const order = (id: ChampSection) => SECTIONS.findIndex((x) => x.id === id);
    const direction = order(next) > order(current) ? 1 : -1;
    current = next;
    turnPage(pane, () => pane.replaceChildren(sectionBody(app, c, current, (art, thumb) => {
      setHeroArt(hero.hero, art);
      pane.querySelectorAll('.cg-thumb').forEach((el) => el.setAttribute('aria-pressed', 'false'));
      thumb.setAttribute('aria-pressed', 'true');
    })), direction);
    if (current !== 'art') setHeroArt(hero.hero, hero.cutout);
  });
  bar.classList.add('cp-sections');
  bar.setAttribute('aria-label', 'Mục');
  pane.replaceChildren(sectionBody(app, c, current));
  return bar;
}

function sectionBody(
  app: App,
  c: Champion,
  section: ChampSection,
  onArt?: (item: GalleryItem, thumb: HTMLButtonElement) => void,
): HTMLElement {
  if (section === 'skills') {
    const cls = classInfo(c.cls);
    return h('div.col', { style: 'gap:8px' },
      h('p.cp-passive', null, h('b', null, `Nội tại · ${cls.name}: `), cls.passive),
      skillButtons(c));
  }
  if (section === 'bio') {
    const info = BIOS[c.id];
    if (!known(app, c.id) || !info) return h('p.locked-note', null, 'Gặp tướng này ở Hành trình để mở tiểu sử.');
    return h('div.cp-bio', null,
      h('blockquote.nm-quote', null, info.quote),
      h('p.prose-p', null, info.bio));
  }
  if (!app.profile.champions.includes(c.id)) return h('p.locked-note', null, 'Chiêu mộ tướng này (thắng ở Hành trình hoặc mua bằng xu) để mở bộ tranh đầy đủ.');
  preloadFigures(fullFigurePaintings(c));
  const items = galleryItems(c);
  const thumb = (it: GalleryItem, i: number) => {
    const el = h('button.cg-thumb', {
      type: 'button', class: it.small ? 'small' : '', 'aria-pressed': String(i === 0),
      'aria-label': `${it.label} · Hiện ở cột tranh`,
    }, h('span.cg-art', null, h('img', { src: it.src, alt: '', loading: 'lazy' })), h('span.cg-label', null, it.label));
    return tap(el, () => onArt?.(it, el));
  };
  // Full-body paintings get tall cards; the four face studies share their own row of square cards.
  return h('div.cp-gallery', null,
    h('div.codex-gallery', null, ...items.filter((it) => !it.small).map(thumb)),
    h('div.codex-gallery.faces', null, ...items.filter((it) => it.small).map((it) => thumb(it, -1))));
}

interface GalleryItem { label: string; src: string; small?: boolean }

/** Ordered painting list for the art tab; only gallery poses that actually ship are included. */
function galleryItems(c: Champion): GalleryItem[] {
  const items: GalleryItem[] = [
    ...fullFigurePaintings(c),
    { label: 'Kết liễu', src: finisherUrl(c.id) },
    { label: 'Tập trung', src: exprUrl(c.id, 'focus'), small: true },
    { label: 'Vui', src: exprUrl(c.id, 'joy'), small: true },
    { label: 'Buồn', src: exprUrl(c.id, 'sad'), small: true },
    { label: 'Ra chiêu', src: exprUrl(c.id, 'cast'), small: true },
  ];
  return items.filter((it) => it.src === finisherUrl(c.id) || hasArt(it.src));
}

/** Whole painting at the frame's full height, so tall poses are seen head to toe without scrolling. */
function artViewer(src: string, name: string) {
  modal((close) => tap(h('button.modal.art-view', { type: 'button', 'aria-label': `${name} · Chạm để đóng` },
    h('img', { src, alt: name, draggable: false })), close), { dismissable: true });
}

function ownedAction(app: App, c: Champion, close: () => void, onChange?: () => void) {
  if (app.profile.champion === c.id) {
    // A status, not a button: there is nothing to do when this champion already represents you.
    return h('span.cp-current', { 'aria-label': `${c.name} đang là tướng đại diện` }, icon('check'), 'Đang dùng');
  }
  const pick = btn(h('span.btn-in', null, 'Chọn tướng'), () => {
    app.profile.champion = c.id;
    app.save();
    close();
    onChange?.();
  });
  pick.setAttribute('aria-label', `Chọn ${c.name} làm tướng đại diện`);
  return pick;
}

function recruitAction(app: App, c: Champion, close: () => void, onChange?: () => void) {
  const p = app.profile;
  const price = CHAMPION_PRICE[c.tier];
  const recruit = btn(h('span.btn-in', null, icon('coin', 'keep'), `Chiêu mộ · ${fmt(price)}`), () => {
    if (p.coins < price) return toast('Chưa đủ xu. Bạn cũng có thể thắng tướng này ở Hành trình', 'bad');
    p.coins -= price;
    p.champions.push(c.id);
    app.save();
    toast(`Đã chiêu mộ ${c.name}`, 'gold');
    close();
    onChange?.();
  });
  recruit.setAttribute('aria-label', `Chiêu mộ ${c.name} · ${fmt(price)} xu`);
  return recruit;
}

/** Three painted skill buttons share one detail presentation across champion pages. */
function skillButtons(c: Champion): HTMLElement {
  return h('div.champion-skills', { role: 'group', 'aria-label': 'Chiêu thức · Chạm để xem cách dùng' },
    ...c.skills.map((sk) => {
      const label = sk.slot === 2 ? 'Tuyệt chiêu' : `Chiêu ${sk.slot + 1}`;
      const button = tap(h('button.champion-skill', {
        type: 'button', class: sk.slot === 2 ? 'ult' : '',
        'aria-label': `${label} · ${sk.name} · Xem chi tiết`, 'aria-haspopup': 'dialog',
      },
      h('img', { src: skillIconUrl(c.id, sk.slot), alt: '', loading: 'lazy' }),
      h('span.champion-skill-title', null,
        h('span.champion-skill-label', null, `${label} ·`),
        h('strong.champion-skill-name', null, sk.name),
        h('span.champion-skill-cost', null, sk.slot === 2 ? '100 năng lượng' : `Hồi ${sk.cooldown} lượt`)),
      h('span.champion-skill-desc', null, sk.desc)), () => open());
      const open = () => skillDetail(c, sk, button);
      return button;
    }));
}

function skillDetail(c: Champion, sk: Champion['skills'][number], button: HTMLButtonElement) {
  const label = sk.slot === 2 ? 'Tuyệt chiêu' : `Chiêu ${sk.slot + 1}`;
  modal((dismiss) => {
    const close = () => { dismiss(); button.focus(); };
    const titleId = `skill-detail-${c.id}-${sk.slot}`;
    const back = btn('Về trang tướng', close, 'ghost');
    const x = closeX(close);
    const sheet = h('div.modal.champion-skill-detail', {
      role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId,
      onkeydown: (e: KeyboardEvent) => skillSheetKeydown(e, { sheet, back, x, close }),
    },
    h('div.champion-skill-heading', null,
      h('img', { src: skillIconUrl(c.id, sk.slot), alt: '' }),
      h('div', null, h('span.small', null, `${c.name} · ${label}`), h('h2', { id: titleId }, sk.name))),
    h('div.champion-skill-copy.scroll', { tabindex: '0' },
      h('p.champion-skill-cost', null, sk.slot === 2 ? 'Cần đầy thanh năng lượng (100 năng lượng)' : `Hồi chiêu: ${sk.cooldown} lượt đánh của chính mình`),
      h('p', null, sk.desc),
      h('p', null, h('b', null, 'Tác dụng:'), ' ', skillReach(sk)),
      h('p', null, h('b', null, 'Cách dùng:'), ' ', skillUsage(sk))),
    h('div.actions', null, back), x);
    requestAnimationFrame(() => back.focus());
    return sheet;
  }, { dismissable: true, onClose: () => button.focus() });
}

function skillSheetKeydown(e: KeyboardEvent, controls: { sheet: HTMLElement; back: HTMLButtonElement; x: HTMLButtonElement; close: () => void }) {
  const { sheet, back, x, close } = controls;
  if (e.key === 'Escape') { e.stopPropagation(); close(); }
  if (e.key !== 'Tab') return;
  e.preventDefault();
  const focusControls = [sheet.querySelector<HTMLElement>('.champion-skill-copy')!, back, x];
  const index = focusControls.indexOf(document.activeElement as HTMLElement);
  focusControls[(index + (e.shiftKey ? -1 : 1) + focusControls.length) % focusControls.length].focus();
}
