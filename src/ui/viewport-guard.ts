import { mustInstall } from '../platform/install';
import { toggleFullscreen } from '../platform/device';
import { btn, h } from './dom';

/**
 * The game is landscape-only. Phones and tablets get a "rotate" sheet in portrait (in the
 * browser too); desktops get a "resize" sheet when the window is too small or the wrong shape.
 * While either sheet is up, `cotien:blocked` fires so an ongoing match can pause itself.
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
  const size = h('b');
  const sheet = h('div.size-hint', { role: 'alert' },
    h('div.sh-title', null, 'Khung hình chưa phù hợp'),
    h('p', null, 'Cơ Tiên chơi theo khung ngang. Kéo cửa sổ rộng ra (tối thiểu ', `${MIN_W}×${MIN_H}`, ', tỉ lệ từ 5:4 đến 13:5) hoặc bật toàn màn hình.'),
    h('p.small', null, 'Hiện tại: ', size),
    btn('Toàn màn hình', () => void toggleFullscreen()),
  );
  document.body.append(sheet);
  const base = new URL(import.meta.env.BASE_URL, document.baseURI).href;
  document.querySelector<HTMLElement>('.rotate-hint')?.style.setProperty('--home-bg-abs', `url("${base}art/ui/home-bg.webp")`);
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
