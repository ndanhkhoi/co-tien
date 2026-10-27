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
      text: 'Tiên Đạo: mỗi tướng có nội tại, 2 chiêu nhỏ và 1 tuyệt chiêu nạp bằng năng lượng khi vào bi. Cổ Điển: bida thuần theo luật WPA, không chiêu. Cả hai chơi được 8 bi, 9 bi, 10 bi và phăng.',
    },
    {
      img: 'art/ui/keyart-portrait.webp', title: 'Điều khiển',
      text: 'Kéo trên bàn hoặc đẩy cần XOAY CƠ để ngắm — đẩy nhẹ để tinh chỉnh. Giữ quả bi ÁP PHÊ rồi đẩy để chọn điểm đánh. GIỮ nút ĐÁNH để nạp lực, thả để đánh. Gợi ý sẽ hiện đúng lúc khi bạn chơi.',
    },
  ];
  let i = 0;
  modal((close) => {
    const img = h('img.intro-img', { alt: '', draggable: false });
    const title = h('h2');
    const text = h('p.intro-text');
    const dots = h('div.intro-dots', null, ...pages.map(() => h('i')));
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
      [...dots.children].forEach((d, k) => d.classList.toggle('on', k === i));
      next.textContent = i === pages.length - 1 ? 'Bắt đầu' : 'Tiếp';
    };
    go(0);
    return h('div.modal.intro', null, img, h('div.intro-body', null, title, text,
      h('div.intro-foot', null, dots, h('div.grow'), btn('Bỏ qua', finish, 'ghost small'), next)));
  });
}
