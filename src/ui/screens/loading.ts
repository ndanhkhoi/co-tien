import { firstLaunch, preloadCore } from '../../platform/preload';
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
 * First launch: download the whole art set once, with an ink progress bar. A build with new art
 * comes back here for just the changed paintings. Other launches skip it (see coreReady).
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
    const note = h('p.ld-note', null, 'Chuẩn bị bàn, tướng và chiêu thức');
    const tip = h('p.ld-tip', null, TIPS[Math.floor(Math.random() * TIPS.length)]);
    el.append(h('div.ld-box', null,
      h('img.ld-logo', { src: new URL(`${import.meta.env.BASE_URL}art/ui/logo.webp`, document.baseURI).href, alt: 'Cơ Tiên', draggable: false }),
      h('div.ld-title', null, h('span', null, 'Đang tải tài nguyên'), pct),
      track,
      note,
      tip,
    ));
    let shown = 0;
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const mb = (n: number) => (n / 1048576).toFixed(n < 10485760 ? 1 : 0).replace('.', ',');
    const first = firstLaunch();
    void preloadCore(app.profile.champion, (f, got, total) => {
      if (disposed) return;
      // Big downloads say how much is left; an update with a few new paintings just fills up.
      if (total > 5 * 1048576) {
        note.textContent = first
          ? `Đã tải ${mb(got)}/${mb(total)} MB. Chỉ lần đầu cần chờ, những lần sau vào game ngay.`
          : `Đang tải tranh mới của bản cập nhật: ${mb(got)}/${mb(total)} MB.`;
      }
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
