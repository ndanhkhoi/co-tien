import { sound } from '../../audio/sound';
import { champion } from '../../game/content/sects';
import { defaultProfile, exportCode, importCode, levelProgress } from '../../game/profile';
import { motionModal as modal, screenEl, type App, type Screen } from '../app';
import { avatar } from '../avatar';
import { btn, h, item, slider, toggle, toast, tap } from '../dom';
import { icon } from '../icons';
import { resetHints } from '../hints';
import { showIntro } from '../intro';
import { topbar, type Kid } from '../screen-bits';
import { homeScreen } from './home';
import { profileModal } from './profile';

export function settingsScreen(app: App): Screen {
  const el = screenEl('settings');
  const p = app.profile;
  const s = p.settings;
  const save = () => {
    app.save();
    app.applySettings();
  };
  const prog = levelProgress(p.xp);
  const nameInput = h('input.set-name', {
    type: 'text', value: p.name, maxLength: 14, 'aria-label': 'Tên cơ thủ', autocomplete: 'off',
    onchange: (e: Event) => {
      p.name = ((e.target as HTMLInputElement).value.trim() || 'Cơ Thủ').slice(0, 14);
      save();
    },
  });
  const me = champion(p.champion);
  const champBtn = tap(h('button.champ-pill', { 'aria-label': 'Đổi tướng đại diện' }, h('span.cp-av', null, avatar(me.id)), h('span', null, me.name), icon('edit')),
    () => profileModal(app, () => app.go(settingsScreen, { replace: true })));
  const group = (title: string, ...rows: Kid[]) => h('section.set-group', null, h('h2.set-title', null, title), h('div.list', null, ...rows));
  const col = settingsList({ app, p, s, save, prog, nameInput, champBtn, group, backup: () => backup(p), restore: () => restore(app, p, save), wipe: () => wipe(app, p, save) });
  el.append(topbar(app, 'Cài đặt'), h('div.scroll.settings-scroll', null, col));
  return { el };
}

interface SettingsView {
  app: App;
  p: App['profile'];
  s: App['profile']['settings'];
  save(): void;
  prog: ReturnType<typeof levelProgress>;
  nameInput: HTMLInputElement;
  champBtn: HTMLButtonElement;
  group(title: string, ...rows: Kid[]): HTMLElement;
  backup(): void;
  restore(): void;
  wipe(): void;
}

function settingsList(x: SettingsView): HTMLElement {
  const { app, p, s, save, prog, nameInput, champBtn, group } = x;
  return h('div.settings-col', null,
    soundGroup({ s, save, group }),
    controlsGroup({ s, save, group }),
    profileGroup({ p, prog, nameInput, champBtn, group }),
    guideGroup({ app, group }),
    dataGroup({ group, backup: x.backup, restore: x.restore, wipe: x.wipe }),
  );
}

type SettingsGroup = (title: string, ...rows: Kid[]) => HTMLElement;

function soundGroup({ s, save, group }: { s: SettingsView['s']; save(): void; group: SettingsGroup }) {
  return group('Âm thanh',
    item('Hiệu ứng', slider(s.sfx, (v) => {
      s.sfx = v;
      save();
      sound.tap();
    }, { label: 'Âm lượng hiệu ứng' }), { icon: 'sound' }),
    item('Nhạc nền', slider(s.music, (v) => {
      s.music = v;
      save();
      if (v > 0) sound.startMusic();
      else sound.stopMusic();
    }, { label: 'Âm lượng nhạc nền' }), { icon: 'music' }),
  );
}

function controlsGroup({ s, save, group }: { s: SettingsView['s']; save(): void; group: SettingsGroup }) {
  return group('Điều khiển',
    item('Rung khi chạm', toggle(s.haptics, (v) => {
      s.haptics = v;
      save();
    }, 'Rung khi chạm'), { icon: 'tremor', hint: 'Rung nhẹ khi thiết bị hỗ trợ' }),
    item('Thuận tay trái', toggle(s.leftHanded, (v) => {
      s.leftHanded = v;
      save();
    }, 'Thuận tay trái'), { icon: 'place', hint: 'Đưa nút ĐÁNH và thanh lực sang bên trái' }),
    item('Thông báo giữa bàn', toggle(s.herald, (v) => {
      s.herald = v;
      save();
    }, 'Thông báo giữa bàn'), { icon: 'info', hint: 'Tắt thì chỉ còn báo lỗi và thắng ván. Chạm bất kỳ đâu cũng đóng thông báo.' }),
  );
}

function profileGroup(x: { p: SettingsView['p']; prog: SettingsView['prog']; nameInput: HTMLInputElement; champBtn: HTMLButtonElement; group: SettingsGroup }) {
  const { p, prog, nameInput, champBtn, group } = x;
  return group('Hồ sơ',
    item('Tên cơ thủ', nameInput, { icon: 'user' }),
    item('Tướng đại diện', champBtn, { icon: 'users' }),
    item('Cấp', h('span.set-val', null, `${prog.level} · ${prog.into}/${prog.need} EXP`), { icon: 'trophy' }),
    item('Trận đã chơi', h('span.set-val', null, `${p.stats.played} trận · thắng ${p.stats.won}`), { icon: 'quick-match', hint: `Loạt ăn bi dài nhất: ${p.stats.bestRun}` }),
  );
}

function guideGroup({ app, group }: { app: App; group: SettingsGroup }) {
  return group('Hướng dẫn',
    item('Giới thiệu Cơ Tiên Giới', btn('Xem lại', () => showIntro(app), 'ghost small'), { icon: 'story' }),
    item('Gợi ý cho người mới', btn('Hiện lại', () => {
      resetHints(app);
      toast('Gợi ý sẽ hiện lại trong trận tới', 'good');
    }, 'ghost small'), { icon: 'hint', hint: 'Hiện lại các mẹo trong trận' }),
  );
}

function dataGroup({ group, backup, restore, wipe }: { group: SettingsGroup; backup(): void; restore(): void; wipe(): void }) {
  return group('Dữ liệu',
    item('Sao lưu', btn('Lấy mã', backup, 'ghost small'), { icon: 'scroll', hint: 'Lấy mã để chuyển tiến trình sang máy khác' }),
    item('Khôi phục', btn('Nhập mã', restore, 'ghost small'), { icon: 'rewind', hint: 'Dán mã sao lưu để lấy lại tiến trình' }),
    item('Chơi lại từ đầu', btn('Xoá', wipe, 'danger small'), { icon: 'warning', hint: 'Xoá toàn bộ tiến trình trên máy này' }),
    item('Phiên bản', btn('Kiểm tra', () => {
      if (!import.meta.env.PROD) return toast('Bản phát triển luôn chạy mã mới nhất', 'good');
      dispatchEvent(new Event('cotien:check-update'));
    }, 'ghost small'), { icon: 'info', hint: __APP_VERSION__ }),
  );
}

function backup(p: App['profile']) {
  const code = exportCode(p);
  modal((close) => h('div.modal', null,
    h('h2', null, 'Mã sao lưu'),
    h('p', null, 'Giữ mã này ở nơi an toàn. Trên máy khác, vào Cài đặt › Khôi phục và dán mã để lấy lại tiến trình.'),
    h('textarea.code-box', { readOnly: true, rows: 4, 'aria-label': 'Mã sao lưu' }, code),
    h('div.actions', null, btn('Đóng', close, 'ghost'), btn('Sao chép', () => {
      if (!navigator.clipboard) return toast('Máy không cho chép tự động. Hãy chọn và chép mã', 'bad');
      void navigator.clipboard.writeText(code).then(() => toast('Đã chép mã sao lưu', 'good'), () => toast('Không chép được. Hãy chọn và chép mã', 'bad'));
    })),
  ), { dismissable: true });
}

function restore(app: App, p: App['profile'], save: () => void) {
  const ta = h('textarea.code-box', { placeholder: 'Dán mã sao lưu (TC1.…) vào đây', rows: 4, 'aria-label': 'Mã sao lưu' }) as HTMLTextAreaElement;
  modal((close) => h('div.modal', null,
    h('h2', null, 'Khôi phục tiến trình'),
    h('p', null, 'Tiến trình hiện tại trên máy này sẽ được thay bằng tiến trình trong mã.'),
    ta,
    h('div.actions', null, btn('Huỷ', close, 'ghost'), btn('Khôi phục', () => {
      const np = importCode(ta.value);
      if (!np) return toast('Mã không hợp lệ. Kiểm tra lại đã dán đủ chưa', 'bad');
      Object.assign(p, np);
      save();
      close();
      toast('Đã khôi phục tiến trình', 'good');
      app.go(homeScreen, { reset: true });
    })),
  ), { dismissable: true });
  setTimeout(() => ta.focus(), 50);
}

function wipe(app: App, p: App['profile'], save: () => void) {
  modal((close) => h('div.modal', null,
    h('h2', null, 'Chơi lại từ đầu?'),
    h('p', null, 'Toàn bộ cấp, xu, tướng, Pháp Cơ, Linh Đài và tiến trình Hành trình trên máy này sẽ bị xoá. ', h('b', null, 'Không thể hoàn tác.')),
    h('p.muted', null, 'Muốn giữ lại? Hãy Sao lưu trước.'),
    h('div.actions', null, btn('Huỷ', close, 'ghost'), btn('Xoá và chơi lại', () => {
      Object.assign(p, defaultProfile());
      save();
      close();
      app.go(homeScreen, { reset: true });
    })),
  ), { dismissable: true });
}
