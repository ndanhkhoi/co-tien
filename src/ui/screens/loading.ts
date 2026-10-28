import { preloadCore } from '../../platform/preload';
import { screenEl, type App, type Screen } from '../app';
import { h } from '../dom';

const TIPS = [
  'Kéo trên bàn để xoay cơ, chạm một bi để ngắm thẳng vào nó.',
  'Mỗi cú đánh nạp năng lượng; đầy thanh thì tung tuyệt chiêu.',
  'Thiên Tượng là lực thật trên bàn — tính nó vào đường bi.',
  'Đánh trên bàn môn phái mình, tướng được Địa Lợi.',
  'Thắng một cao thủ ở Hành trình để mở chương truyện của vùng đó.',
];

/**
 * First launch and after each update: fetch the core art with an ink progress bar, then hand over
 * to the next screen. Later launches skip it (see coreReady).
 */
export function loadingScreen(next: (app: App) => Screen) {
  return (app: App): Screen => {
    const el = screenEl('loading');
    // Reveal the painted brush band as resources arrive.
    const fill = h('div.ld-fill', { 'aria-hidden': 'true' });
    const track = h('div.ld-track', {
      role: 'progressbar', 'aria-label': 'Tải tài nguyên',
      'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': '0',
    }, fill);
    const pct = h('span.ld-pct.num', null, '0%');
    const tip = h('p.ld-tip', null, TIPS[Math.floor(Math.random() * TIPS.length)]);
    el.append(h('div.ld-box', null,
      h('img.ld-logo', { src: new URL(`${import.meta.env.BASE_URL}art/ui/logo.webp`, document.baseURI).href, alt: 'Cơ Tiên', draggable: false }),
      h('div.ld-title', null, h('span', null, 'Đang tải tài nguyên'), pct),
      track,
      h('p.ld-note', null, 'Chuẩn bị bàn, tướng và chiêu thức'),
      tip,
    ));
    let shown = 0;
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    void preloadCore(app.profile.champion, (f) => {
      if (disposed) return;
      const p = Math.round(f * 100);
      if (p === shown) return;
      shown = p;
      fill.style.clipPath = `inset(0 ${100 - p}% 0 0)`;
      track.setAttribute('aria-valuenow', String(p));
      pct.textContent = `${p}%`;
    }).then(() => {
      if (disposed) return;
      if (!location.search.includes('loading')) timer = setTimeout(() => app.go(next, { reset: true }), 400);
    });
    return { el, dispose: () => { disposed = true; clearTimeout(timer); } };
  };
}
