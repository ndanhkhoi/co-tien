import lore from '../../game/content/lore.json';
import {
  CHAMPION_PRICE, classInfo, cutoutUrl, exprUrl, sect, sectArtUrl, skillIconUrl, winUrl, KIND_LABEL, type Champion,
} from '../../game/content/sects';
import { skillUsage } from '../../game/content/skill-usage';
import { motionModal as modal, turnPage, type App } from '../app';
import { btn, chip, h, hex6, tap, toast } from '../dom';
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
    const content = h('div.cp-content.scroll', { tabindex: '0', 'aria-label': 'Thông tin tướng' },
      h('div.cp-head', null,
        h('div.cp-sect', null, h('img', { src: sectArtUrl(c.sect, 'emblem'), alt: '' }), s.name),
        h('h2.cp-name', null, c.name),
        h('div.cp-tags', null, h('span.badge.kind', { 'data-kind': c.kind }, KIND_LABEL[c.kind]), h('span.badge', null, `Bậc ${c.tier}`), h('span.badge', null, cls.name),
          owned ? h('span.badge.ok', null, 'Đã chiêu mộ') : h('span.badge.accent', null, 'Chưa chiêu mộ')),
      ),
      pane);
    return h('div.modal.champ-page', { style: `--sect:${hex6(s.main)}` },
      tap(h('button.cp-art', { type: 'button', 'aria-label': `Xem trọn tranh ${c.name}` }, h('img', { src: cutoutUrl(c.id), alt: '', draggable: false, decoding: 'async',
        // Wide action poses would shrink to fit the tall column: fill it instead and crop the sides.
        onload: (e: Event) => { const im = e.target as HTMLImageElement; im.classList.toggle('wide', im.naturalWidth > im.naturalHeight * 0.85); } })),
      () => artViewer(cutoutUrl(c.id), c.name)),
      h('div.cp-main', null, content, h('div.cp-foot', null, sectionChips(app, c, pane), action)),
      closeX(close),
    );
  }, { dismissable: true });
}

function sectionChips(app: App, c: Champion, pane: HTMLElement): HTMLElement {
  let current: ChampSection = 'skills';
  const row = h('div.chips.cp-sections', { role: 'group', 'aria-label': 'Mục' });
  const render = () => row.replaceChildren(...SECTIONS.map((it, i) => chip(it.label, it.id === current, () => {
    if (it.id === current) return;
    const direction = i > SECTIONS.findIndex((x) => x.id === current) ? 1 : -1;
    current = it.id;
    render();
    turnPage(pane, () => pane.replaceChildren(sectionBody(app, c, current)), direction);
  })));
  render();
  pane.replaceChildren(sectionBody(app, c, current));
  return row;
}

function sectionBody(app: App, c: Champion, section: ChampSection): HTMLElement {
  if (section === 'skills') {
    const cls = classInfo(c.cls);
    return h('div.col', { style: 'gap:8px' }, h('p.cp-passive', null, h('b', null, `Nội tại · ${cls.name}: `), cls.passive), skillButtons(c));
  }
  if (section === 'bio') {
    const info = BIOS[c.id];
    if (!known(app, c.id) || !info) return h('p.locked-note', null, 'Gặp tướng này ở Hành trình để mở tiểu sử.');
    return h('div.cp-bio', null, h('blockquote.nm-quote', null, info.quote), h('p.prose-p', null, info.bio));
  }
  if (!app.profile.champions.includes(c.id)) return h('p.locked-note', null, 'Chiêu mộ tướng này (thắng ở Hành trình hoặc mua bằng xu) để mở bộ tranh đầy đủ.');
  const urls = [...(['focus', 'joy', 'sad', 'cast'] as const).map((e) => exprUrl(c.id, e)), winUrl(c.id)];
  return h('div.codex-gallery', null, ...urls.map((src, i) => tap(h('button.cg-thumb', { type: 'button', class: i === urls.length - 1 ? 'win' : '', 'aria-label': `Xem trọn tranh ${c.name}` },
    h('img', { src, alt: '', loading: 'lazy' })), () => artViewer(src, c.name))));
}

/** Whole painting at the frame's full height, so tall poses are seen head to toe without scrolling. */
function artViewer(src: string, name: string) {
  modal((close) => tap(h('button.modal.art-view', { type: 'button', 'aria-label': `${name} · Chạm để đóng` },
    h('img', { src, alt: name, draggable: false })), close), { dismissable: true });
}

function ownedAction(app: App, c: Champion, close: () => void, onChange?: () => void) {
  if (app.profile.champion === c.id) return btn(h('span.btn-in', null, icon('check'), 'Đang dùng'), () => {}, 'ghost');
  return btn('Chọn làm tướng đại diện', () => {
    app.profile.champion = c.id;
    app.save();
    close();
    onChange?.();
  });
}

function recruitAction(app: App, c: Champion, close: () => void, onChange?: () => void) {
  const p = app.profile;
  const price = CHAMPION_PRICE[c.tier];
  return btn(h('span.btn-in', null, icon('coin', 'keep'), `Chiêu mộ · ${fmt(price)} xu`), () => {
    if (p.coins < price) return toast('Chưa đủ xu. Bạn cũng có thể thắng tướng này ở Hành trình', 'bad');
    p.coins -= price;
    p.champions.push(c.id);
    app.save();
    toast(`Đã chiêu mộ ${c.name}`, 'gold');
    close();
    onChange?.();
  });
}

/** Three painted skill buttons share one detail presentation across champion pages. */
function skillButtons(c: Champion): HTMLElement {
  return h('div.champion-skills', { role: 'group', 'aria-label': 'Chiêu thức · Chạm để xem chi tiết' },
    ...c.skills.map((sk) => {
      const label = sk.slot === 2 ? 'Tuyệt chiêu' : `Chiêu ${sk.slot + 1}`;
      const button = tap(h('button.champion-skill', {
        type: 'button', class: sk.slot === 2 ? 'ult' : '',
        'aria-label': `${label} · ${sk.name} · Xem chi tiết`, 'aria-haspopup': 'dialog',
      },
      h('img', { src: skillIconUrl(c.id, sk.slot), alt: '', loading: 'lazy' }),
      h('span.champion-skill-label', null, label),
      h('strong.champion-skill-name', null, sk.name),
      h('span.champion-skill-cost', null, sk.slot === 2 ? '100 năng lượng' : `Hồi ${sk.cooldown} lượt`),
      h('span.champion-skill-hint', null, 'Xem chi tiết')), () => open());
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
