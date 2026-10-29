import lore from '../game/content/lore.json';
import { CHAMPIONS, SECTS } from '../game/content/sects';
import { turnPage, type App } from './app';
import { btn, h, modal } from './dom';

/** First-run introduction to Cơ Tiên Giới: four short pages, skippable, replayable from Settings. */
export function showIntro(app: App, onDone?: () => void) {
  const base = new URL(import.meta.env.BASE_URL, document.baseURI).href;
  const pages = [
    // `focus` keeps the painted subject in the tall art panel instead of the empty sky between.
    { img: 'art/ui/keyart.webp', focus: '12% 72%', title: 'Cơ Tiên Giới', text: (lore as { world: string }).world },
    {
      img: 'art/ui/map.webp', title: `${SECTS.length} môn phái · ${CHAMPIONS.length} tướng`,
      text: 'Mỗi môn phái có Linh Đài riêng: màu nỉ, đặc tính bàn và Thiên Tượng (gió, tuyết, bàn nghiêng…). Đi Hành trình qua từng vùng đất, thắng cao thủ để chiêu mộ họ, giải bài ở Luyện Cơ. Luận Cơ: đấu máy. Song Đấu: hai người chung máy. Tàng Các: chiêu mộ tướng. Đọc Cơ Tiên Truyện, tra cứu Cơ Tiên Lục.',
    },
    {
      img: 'art/ui/home-bg.webp', focus: '82% 60%', title: 'Tiên Đạo hay Cổ Điển',
      text: 'Tiên Đạo: mỗi tướng có nội tại, 2 chiêu và 1 tuyệt chiêu; cú đánh nào cũng nạp năng lượng, vào bi nạp nhiều hơn. Cổ Điển: bida thuần theo luật WPA, không chiêu. Cả hai chơi được 8 bi, 9 bi, 10 bi và phăng.',
    },
    {
      img: 'art/ui/keyart-portrait.webp', title: 'Điều khiển',
      text: 'Kéo trên bàn để xoay cơ, chạm một bi để ngắm thẳng vào bi đó, dùng nút tinh chỉnh để chỉnh từng chút. Kéo trên bi cái nhỏ để áp phê nhanh, chạm vào để chỉnh chính xác. Chọn lực rồi bấm ĐÁNH. Gợi ý sẽ hiện đúng lúc khi bạn chơi.',
    },
  ];
  let i = 0;
  modal((close) => {
    const img = h('img.intro-img', { alt: '', draggable: false });
    const title = h('h2');
    const text = h('p.intro-text');
    const copy = h('div.intro-copy', null, title, text);
    const count = h('span.intro-count.num');
    const scroll = h('div.intro-scroll.scroll', { tabindex: '0' }, copy);
    const dots = h('div.intro-dots', { 'aria-hidden': 'true' }, ...pages.map(() => h('i')));
    const next = btn('Tiếp', () => go(i + 1));
    const finish = () => {
      app.profile.introSeen = true;
      app.save();
      close();
      onDone?.();
    };
    const prev = btn('Trước', () => go(i - 1), 'ghost');
    const go = (n: number) => {
      if (n < 0) return;
      if (n >= pages.length) return finish();
      const direction = n >= i ? 1 : -1;
      i = n;
      turnPage(img, () => {
        img.src = base + pages[i].img;
        img.style.objectPosition = pages[i].focus ?? '';
      }, direction, true);
      turnPage(copy, () => { title.textContent = pages[i].title; text.textContent = pages[i].text; scroll.scrollTop = 0; }, direction);
      prev.disabled = i === 0;
      count.textContent = `${i + 1}/${pages.length}`;
      [...dots.children].forEach((d, k) => d.classList.toggle('on', k === i));
      next.textContent = i === pages.length - 1 ? 'Bắt đầu' : 'Tiếp';
    };
    go(0);
    const panel = h('div.modal.intro', null,
      h('div.intro-art', null, img),
      h('div.intro-body', null, h('div.intro-progress', null, count, dots), scroll,
        h('div.intro-foot', null, h('div.intro-actions', null, btn('Bỏ qua', finish, 'ghost'), prev, next))));
    let start: { x: number; y: number } | null = null;
    panel.addEventListener('pointerdown', (e) => { start = { x: e.clientX, y: e.clientY }; });
    panel.addEventListener('pointercancel', () => { start = null; });
    panel.addEventListener('pointerup', (e) => {
      if (!start) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      start = null;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) go(i + (dx < 0 ? 1 : -1));
    });
    return panel;
  });
}
