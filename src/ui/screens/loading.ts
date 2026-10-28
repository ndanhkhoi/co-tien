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
    const fill = h('i.ld-fill');
    const pct = h('span.ld-pct.num', null, '0%');
    const tip = h('p.ld-tip', null, TIPS[Math.floor(Math.random() * TIPS.length)]);
    el.append(h('div.ld-box', null,
      h('img.ld-logo', { src: new URL(`${import.meta.env.BASE_URL}art/ui/logo.webp`, document.baseURI).href, alt: 'Cơ Tiên', draggable: false }),
      h('div.ld-title', null, 'Đang chuẩn bị tài nguyên', pct),
      h('div.ld-bar', null, fill),
      tip,
      h('p.ld-note', null, 'Chỉ lần đầu và sau mỗi bản cập nhật — những lần sau vào ngay.'),
    ));
    let shown = 0;
    void preloadCore(app.profile.champion, (f) => {
      const p = Math.round(f * 100);
      if (p === shown) return;
      shown = p;
      fill.style.transform = `scaleX(${f})`;
      pct.textContent = `${p}%`;
    }).then(() => { if (!location.search.includes('loading')) setTimeout(() => app.go(next, { reset: true }), 250); });
    return { el };
  };
}
