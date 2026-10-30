import { CHAMPION_PRICE, classInfo, cutoutUrl, sect, sectArtUrl, skillIconUrl, KIND_LABEL, type Champion } from '../../game/content/sects';
import { motionModal as modal, type App } from '../app';
import { btn, h, tap, toast } from '../dom';
import { icon } from '../icons';
import { champPage, known } from './codex';
import { championPicker, championPreview, closeX, fmt, hex6 } from '../screen-bits';

/** Name + champion editor; shown on first launch and from the home player card. */
export function profileModal(app: App, onDone: () => void, first = false) {
  const p = app.profile;
  let name = p.name;
  let pick = p.champion;
  const { preview, label, show } = championPreview();
  show(pick);
  const input = h('input', {
    id: 'player-name', type: 'text', value: name, maxLength: 14, placeholder: 'Tên của bạn', autocomplete: 'off',
    oninput: (e: Event) => (name = (e.target as HTMLInputElement).value),
  }) as HTMLInputElement;
  modal((close) => h('div.modal.profile-modal', null,
    h('h2', null, first ? 'Chào cơ thủ mới' : 'Hồ sơ cơ thủ'),
    h('div.pm-body', null,
      h('div.pm-left', null, preview, label,
        h('label.section-title', { for: 'player-name' }, 'Tên hiển thị'), input,
        btn(first ? 'Vào game' : 'Lưu', () => {
          p.name = name.trim().slice(0, 14) || 'Cơ Thủ';
          p.champion = pick;
          p.named = true;
          app.save();
          close();
          onDone();
        }, 'block'),
      ),
      h('div.pm-right.scroll', null,
        h('p.pm-note', null, 'Chọn tướng đại diện. Thắng cao thủ ở Hành trình hoặc chiêu mộ trong Tàng Các để có thêm tướng.'),
        championPicker(app, { selected: () => pick, onPick: (c) => {
          pick = c.id;
          show(pick);
        }, onlyOwned: true })),
    ),
    first ? null : closeX(close),
  ), { dismissable: !first });
  if (!first) setTimeout(() => input.focus(), 50);
}

/** Champion detail: cut-out art, class passive and the three skills with their real numbers. */
export function championModal(app: App, c: Champion, onChange?: () => void) {
  const p = app.profile;
  const s = sect(c.sect);
  const cls = classInfo(c.cls);
  modal((close) => {
    const owned = p.champions.includes(c.id);
    const action = owned ? ownedAction(app, c, close, onChange) : recruitAction(app, c, close, onChange);
    return h('div.modal.champ-page', { style: `--sect:${hex6(s.main)}` },
      h('div.cp-art', null, h('img', { src: cutoutUrl(c.id), alt: '', draggable: false, decoding: 'async',
        // Wide action poses would shrink to fit the tall column: fill it instead and crop the sides.
        onload: (e: Event) => { const im = e.target as HTMLImageElement; im.classList.toggle('wide', im.naturalWidth > im.naturalHeight * 0.85); } })),
      h('div.cp-main', null,
        h('div.cp-content.scroll', { tabindex: '0', 'aria-label': 'Thông tin và chiêu thức' },
        h('div.cp-head', null,
          h('div.cp-sect', null, h('img', { src: sectArtUrl(c.sect, 'emblem'), alt: '' }), s.name),
          h('h2.cp-name', null, c.name),
          h('div.cp-tags', null, h('span.badge.kind', { 'data-kind': c.kind }, KIND_LABEL[c.kind]), h('span.badge', null, `Bậc ${c.tier}`), h('span.badge', null, cls.name),
            owned ? h('span.badge.ok', null, 'Đã chiêu mộ') : h('span.badge.accent', null, 'Chưa chiêu mộ')),
          h('p.cp-passive', null, h('b', null, `Nội tại · ${cls.name}: `), cls.passive),
        ),
        skillButtons(c)),
        h('div.cp-foot', null, btn('Đóng', close, 'ghost'),
          known(app, c.id) ? btn('Tiểu sử', () => {
            close();
            champPage(app, c);
          }, 'secondary') : null,
          action),
      ),
      closeX(close),
    );
  }, { dismissable: true });
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
export function skillButtons(c: Champion): HTMLElement {
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
      h('p', null, sk.desc)),
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
