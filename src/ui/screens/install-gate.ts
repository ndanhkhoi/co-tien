import { canPromptInstall, detectPlatform, onInstallChange, promptInstall } from '../../platform/install';
import { screenEl, type Screen } from '../app';
import { btn, h, svg, toast } from '../dom';

const SHARE_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="#3a5a78" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px;vertical-align:-4px"><path d="M12 15V3M8 7l4-4 4 4"/><path d="M6 11H5a1 1 0 00-1 1v8a1 1 0 001 1h14a1 1 0 001-1v-8a1 1 0 00-1-1h-1"/></svg>`;
const ADD_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="width:20px;height:20px;vertical-align:-4px"><rect x="4" y="4" width="16" height="16" rx="4"/><path d="M12 8v8M8 12h8"/></svg>`;
const DOTS_ICON = `<svg viewBox="0 0 24 24" fill="currentColor" style="width:18px;height:18px;vertical-align:-4px"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>`;

let stepIndex = 0;
/** One instruction line; numbers sit in vermilion seals and lines appear one after another. */
function step(n: number, ...content: (Node | string)[]) {
  return h('div.install-step', { style: `--i:${stepIndex++}` }, h('b.num', null, String(n)), h('div', null, ...content));
}

/**
 * Shown instead of the game when a phone opens it in a browser tab. The game needs
 * the installed app's fullscreen window to feel right, so play is gated on install.
 */
export function installGate(): Screen {
  const el = screenEl('install');
  const platform = detectPlatform();
  const body = h('div.install-body');
  const render = () => {
    stepIndex = 0;
    body.replaceChildren();
    if (platform === 'in-app') {
      body.append(
        h('p.lead', null, 'Trình duyệt trong ứng dụng này không cài được game.'),
        step(1, 'Bấm ', svg(DOTS_ICON), ' hoặc nút menu ở góc màn hình'),
        step(2, 'Chọn ', h('b', null, 'Mở bằng trình duyệt'), ' (Safari / Chrome)'),
        btn('Sao chép link', () => {
          void navigator.clipboard?.writeText(location.href).then(() => toast('Đã chép link — dán vào Safari/Chrome', 'good'));
        }, 'ghost'),
      );
    } else if (platform === 'ios') {
      body.append(
        h('p.lead', null, 'Cài lên màn hình chính để chơi toàn màn hình, offline.'),
        step(1, 'Bấm nút Chia sẻ ', svg(SHARE_ICON), ' trên thanh Safari'),
        step(2, 'Chọn ', h('b', null, 'Thêm vào MH chính'), ' ', svg(ADD_ICON)),
        step(3, 'Mở ', h('b', null, 'Cơ Tiên'), ' từ màn hình chính'),
      );
    } else if (canPromptInstall()) {
      body.append(
        h('p.lead', null, 'Cài lên máy để chơi toàn màn hình, mượt và offline.'),
        btn('Cài đặt ngay', async () => {
          const ok = await promptInstall();
          if (ok) toast('Đang cài… mở Cơ Tiên từ màn hình chính', 'good');
          render();
        }, 'green'),
        h('p.small.muted', null, 'Cài xong, mở game từ biểu tượng trên màn hình chính.'),
      );
    } else {
      body.append(
        h('p.lead', null, 'Cài lên máy để chơi toàn màn hình, mượt và offline.'),
        step(1, 'Bấm ', svg(DOTS_ICON), ' menu của trình duyệt'),
        step(2, 'Chọn ', h('b', null, 'Cài đặt ứng dụng'), ' hoặc ', h('b', null, 'Thêm vào màn hình chính')),
        step(3, 'Mở ', h('b', null, 'Cơ Tiên'), ' từ màn hình chính'),
        h('p.small.muted', null, 'Đã cài rồi? Hãy mở game từ biểu tượng trên màn hình chính.'),
      );
    }
  };
  render();
  const off = onInstallChange(render);
  const base = new URL(import.meta.env.BASE_URL, document.baseURI).href;
  el.style.setProperty('--home-bg', `url("${base}art/ui/home-bg.webp")`);
  el.append(
    h('div.install-wrap', null,
      // The app icon stamps down onto the paper like a seal, then the brush logo settles below it.
      h('div.install-hero', null,
        h('div.ig-stamp', null,
          h('img.ig-splash', { src: `${base}art/ui/splash-ring.webp`, alt: '', draggable: false }),
          h('img.ig-icon', { src: `${base}icons/icon-192.png`, alt: '', draggable: false }),
        ),
        h('img.logo-art', { src: `${base}art/ui/logo.webp`, alt: 'Cơ Tiên — bida tu tiên', draggable: false }),
      ),
      h('div.install-card', null, h('h2', null, 'Cài đặt để chơi'), h('i.ig-brush'), body),
    ),
  );
  return { el, dispose: off };
}
