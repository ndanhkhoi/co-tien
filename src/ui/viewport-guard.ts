import { mustInstall } from '../platform/install';
import { toggleFullscreen } from '../platform/device';
import { btn, h } from './dom';
import { icon } from './icons';

/**
 * The game is landscape-only. Phones and tablets get a "rotate" sheet in portrait (in the
 * browser too); desktops get a "resize" sheet when the window is too small or the wrong shape.
 * While either sheet is up, `cotien:blocked` fires so an ongoing match can pause itself.
 * The rotate sheet's markup lives in index.html so it shows even before the app boots.
 */
export const MIN_W = 640;
export const MIN_H = 360;
/** Accepted width / height range: 5:4 up to 13:5. */
export const MIN_RATIO = 5 / 4;
export const MAX_RATIO = 13 / 5;

const COARSE = '(pointer: coarse)';

export function viewportBlocked(): 'rotate' | 'resize' | null {
  // The install screen comes first and is laid out for any orientation; rotation only matters once installed.
  if (mustInstall()) return null;
  const w = window.innerWidth;
  const hgt = window.innerHeight;
  if (matchMedia(COARSE).matches) return hgt > w ? 'rotate' : null;
  const r = w / hgt;
  return w < MIN_W || hgt < MIN_H || r < MIN_RATIO || r > MAX_RATIO ? 'resize' : null;
}

export function installViewportGuard() {
  const size = h('b.num');
  const sheet = h('div.size-hint', { role: 'alert' },
    h('div.vp-card', null,
      h('span.vp-icon', null, icon('fullscreen')),
      h('h2.vp-title', null, 'Cửa sổ chưa vừa'),
      h('p', null, 'Cơ Tiên chơi theo khung ngang. Kéo cửa sổ rộng ra (tối thiểu ', h('b', null, `${MIN_W}×${MIN_H}`), ', tỉ lệ từ 5:4 đến 13:5) hoặc bật toàn màn hình.'),
      h('p.vp-now', null, 'Hiện tại: ', size),
      btn(h('span.btn-in', null, icon('fullscreen'), 'Toàn màn hình'), () => void toggleFullscreen(), 'big'),
    ),
  );
  document.body.append(sheet);
  let last: string | null = null;
  const check = () => {
    const state = viewportBlocked();
    size.textContent = `${window.innerWidth}×${window.innerHeight}`;
    document.body.classList.toggle('vp-resize', state === 'resize');
    document.body.classList.toggle('vp-rotate', state === 'rotate');
    if (state && state !== last) window.dispatchEvent(new CustomEvent('cotien:blocked', { detail: state }));
    last = state;
  };
  window.addEventListener('resize', check);
  window.addEventListener('orientationchange', check);
  check();
}
