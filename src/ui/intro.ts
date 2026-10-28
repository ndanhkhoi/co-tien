import lore from '../game/content/lore.json';
import { CHAMPIONS, SECTS } from '../game/content/sects';
import type { App } from './app';
import { btn, h, modal } from './dom';

/** First-run introduction to Cơ Tiên Giới: four short pages, skippable, replayable from Settings. */
export function showIntro(app: App, onDone?: () => void) {
  const base = new URL(import.meta.env.BASE_URL, document.baseURI).href;
  const pages = [
    { img: 'art/ui/keyart.webp', title: 'Cơ Tiên Giới', text: (lore as { world: string }).world },
    {
      img: 'art/ui/map.webp', title: `${SECTS.length} môn phái · ${CHAMPIONS.length} tướng`,
      text: 'Mỗi môn phái có Linh Đài riêng: màu nỉ, đặc tính bàn và Thiên Tượng (gió, tuyết, bàn nghiêng…). Đi Hành trình qua từng vùng đất, thắng cao thủ để chiêu mộ họ, giải thử thách để luyện cơ.',
    },
    {
      img: 'art/ui/home-bg.webp', title: 'Tiên Đạo hay Cổ Điển',
      text: 'Tiên Đạo: mỗi tướng có nội tại, 2 chiêu và 1 tuyệt chiêu; cú đánh nào cũng nạp năng lượng, vào bi nạp nhiều hơn. Cổ Điển: bida thuần theo luật WPA, không chiêu. Cả hai chơi được 8 bi, 9 bi, 10 bi và phăng.',
    },
    {
      img: 'art/ui/keyart-portrait.webp', title: 'Điều khiển',
      text: 'Kéo trên bàn để xoay cơ, chạm một bi để ngắm thẳng vào bi đó, dùng nút tinh chỉnh để chỉnh từng chút. Chạm bi cái nhỏ để chọn điểm áp phê. Chọn lực rồi bấm ĐÁNH. Gợi ý sẽ hiện đúng lúc khi bạn chơi.',
    },
  ];
  let i = 0;
  modal((close) => {
    const img = h('img.intro-img', { alt: '', draggable: false });
    const title = h('h2');
    const text = h('p.intro-text');
    const count = h('span.intro-count.num');
    const dots = h('div.intro-dots', { 'aria-hidden': 'true' }, ...pages.map(() => h('i')));
    const next = btn('Tiếp', () => go(i + 1));
    const finish = () => {
      app.profile.introSeen = true;
      app.save();
      close();
      onDone?.();
    };
    const go = (n: number) => {
      if (n >= pages.length) return finish();
      i = n;
      img.src = base + pages[i].img;
      title.textContent = pages[i].title;
      text.textContent = pages[i].text;
      count.textContent = `${i + 1}/${pages.length}`;
      [...dots.children].forEach((d, k) => d.classList.toggle('on', k === i));
      next.textContent = i === pages.length - 1 ? 'Bắt đầu' : 'Tiếp';
    };
    go(0);
    return h('div.modal.intro', null,
      h('div.intro-art', null, img),
      h('div.intro-body', null, h('div.intro-scroll.scroll', null, count, title, text),
        h('div.intro-foot', null, dots, h('div.intro-actions', null, btn('Bỏ qua', finish, 'ghost'), next))));
  });
}
