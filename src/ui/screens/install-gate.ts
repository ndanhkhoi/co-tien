import { canPromptInstall, detectPlatform, onInstallChange, promptInstall } from '../../platform/install';
import { screenEl, type Screen } from '../app';
import { btn, h, toast } from '../dom';
import { icon } from '../icons';

let stepIndex = 0;
/** One instruction line: the number sits in a vermilion seal and lines appear one after another. */
function step(n: number, ...content: (Node | string)[]) {
  return h('li.install-step', { style: `--i:${stepIndex++}` }, h('b.ig-num', null, String(n)), h('span', null, ...content));
}

/**
 * Shown instead of the game when a phone opens it in a browser tab. The game needs
 * the installed app's fullscreen window to feel right, so play is gated on install.
 * Laid out for both orientations: stacked when upright, side by side when held flat.
 */
export function installGate(): Screen {
  const el = screenEl('install scroll');
  const platform = detectPlatform();
  const body = h('div.install-body');
  const render = () => {
    stepIndex = 0;
    body.replaceChildren();
    if (platform === 'in-app') {
      body.append(
        h('p.ig-lead', null, 'Trình duyệt bên trong ứng dụng này không cài được game.'),
        h('ol.install-steps', null,
          step(1, 'Bấm nút ', h('b', null, 'menu'), ' (ba chấm) ở góc màn hình'),
          step(2, 'Chọn ', h('b', null, 'Mở bằng trình duyệt'), ' — Safari hoặc Chrome')),
        btn(h('span.btn-in', null, icon('scroll'), 'Sao chép đường dẫn'), () => {
          void navigator.clipboard?.writeText(location.href).then(() => toast('Đã chép — dán vào Safari hoặc Chrome', 'good'));
        }, 'ghost block'),
      );
    } else if (platform === 'ios') {
      body.append(
        h('p.ig-lead', null, 'Cài lên màn hình chính để chơi toàn màn hình, không cần mạng.'),
        h('ol.install-steps', null,
          step(1, 'Bấm nút ', h('b', null, 'Chia sẻ'), ' (ô vuông có mũi tên lên) trên thanh Safari'),
          step(2, 'Chọn ', h('b', null, 'Thêm vào MH chính')),
          step(3, 'Mở ', h('b', null, 'Cơ Tiên'), ' từ màn hình chính')),
      );
    } else if (canPromptInstall()) {
      body.append(
        h('p.ig-lead', null, 'Cài lên máy để chơi toàn màn hình, mượt và không cần mạng.'),
        btn(h('span.btn-in', null, icon('install'), 'Cài đặt ngay'), async () => {
          const ok = await promptInstall();
          if (ok) toast('Đang cài… mở Cơ Tiên từ màn hình chính', 'good');
          render();
        }, 'big block'),
        h('p.ig-note', null, 'Cài xong, mở game từ biểu tượng trên màn hình chính.'),
      );
    } else {
      body.append(
        h('p.ig-lead', null, 'Cài lên máy để chơi toàn màn hình, mượt và không cần mạng.'),
        h('ol.install-steps', null,
          step(1, 'Bấm nút ', h('b', null, 'menu'), ' (ba chấm) của trình duyệt'),
          step(2, 'Chọn ', h('b', null, 'Cài đặt ứng dụng'), ' hoặc ', h('b', null, 'Thêm vào màn hình chính')),
          step(3, 'Mở ', h('b', null, 'Cơ Tiên'), ' từ màn hình chính')),
        h('p.ig-note', null, 'Đã cài rồi? Hãy mở game từ biểu tượng trên màn hình chính.'),
      );
    }
  };
  render();
  const off = onInstallChange(render);
  const base = new URL(import.meta.env.BASE_URL, document.baseURI).href;
  el.style.setProperty('--keyart', `url("${base}art/ui/keyart.webp")`);
  el.style.setProperty('--keyart-tall', `url("${base}art/ui/keyart-portrait.webp")`);
  el.append(
    h('div.install-wrap', null,
      // The app icon stamps down like a seal, then the brush logo settles below it.
      h('div.install-hero', null,
        h('div.ig-stamp', null,
          h('img.ig-splash', { src: `${base}art/ui/splash-ring.webp`, alt: '', draggable: false }),
          h('img.ig-icon', { src: `${base}icons/icon-192.png`, alt: '', draggable: false }),
        ),
        h('img.ig-logo', { src: `${base}art/ui/logo.webp`, alt: 'Cơ Tiên — bida tu tiên', draggable: false }),
      ),
      h('div.install-card', null, h('h2.ig-title', null, icon('install'), 'Cài đặt để chơi'), body),
    ),
  );
  return { el, dispose: off };
}
