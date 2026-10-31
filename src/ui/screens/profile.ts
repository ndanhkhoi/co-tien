import { motionModal as modal, type App } from '../app';
import { btn, h } from '../dom';
import { championPicker, championPreview, closeX } from '../widgets';

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
