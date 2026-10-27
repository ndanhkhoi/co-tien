import { sound } from '../../audio/sound';
import { CHAPTERS as LANDS } from '../../game/content/career';
import story from '../../game/content/story.json';
import { screenEl, type App, type Screen } from '../app';
import { btn, h, tap, toast } from '../dom';
import { icon } from '../icons';
import { topbar } from './menus';

/**
 * Cơ Tiên Truyện: an illustrated reader for the world's story. Chapters open as the player
 * travels the Hành trình (beat any master of a land to read its chapter); the epilogue needs
 * the last land's strongest master. Art lives in art/story/<scene>.webp (skill game-art,
 * scripts/gen-story-art.sh).
 */
interface Page { art?: string; text: string }
interface Chapter { id: string; title: string; land: string | null; unlock: string | null; pages: Page[] }

const CHAPTERS = (story as { chapters: Chapter[] }).chapters;

const artUrl = (key: string) => new URL(`${import.meta.env.BASE_URL}art/story/${key}.webp`, document.baseURI).href;

function chapterOpen(app: App, c: Chapter): boolean {
  if (!c.unlock) return true;
  const [land, tier] = c.unlock.split(':');
  const ch = LANDS.find((l) => l.id === land);
  if (!ch) return true;
  const npcs = tier ? ch.npcs.filter((n) => n.id === ch.npcs[Number(tier) - 1]?.id) : ch.npcs;
  return npcs.some((n) => app.profile.career[n.id] !== undefined);
}

function unlockHint(c: Chapter): string {
  const [land, tier] = (c.unlock ?? '').split(':');
  const ch = LANDS.find((l) => l.id === land);
  if (!ch) return '';
  return tier ? `Thắng ${ch.npcs[Number(tier) - 1].name} ở ${ch.name} để mở` : `Thắng một cao thủ ở ${ch.name} để mở`;
}

export function storyScreen(app: App): Screen {
  const el = screenEl();
  const list = h('div.story-list.scroll');
  const read = app.profile.storyRead;
  list.append(...CHAPTERS.map((c) => {
    const open = chapterOpen(app, c);
    const cover = c.pages.find((p) => p.art)?.art;
    const done = (read[c.id] ?? -1) >= c.pages.length - 1;
    return tap(h('button.story-card', { class: open ? '' : 'locked' },
      h('div.sc-art', null, cover ? h('img', { src: artUrl(cover), alt: '', loading: 'lazy', onerror: (e: Event) => (e.target as HTMLElement).remove() }) : null),
      h('div.sc-body', null,
        h('b', null, c.title),
        h('span.small.muted', null, open ? (done ? 'Đã đọc' : read[c.id] !== undefined ? 'Đang đọc' : 'Chưa đọc') : unlockHint(c)),
      ),
      open ? null : icon('lock'),
    ), () => (open ? openReader(app, c) : toast(unlockHint(c), 'bad')));
  }));
  el.append(topbar(app, (story as { title: string }).title), h('div.body', { style: 'flex-direction:column' }, list));
  return { el };
}

function openReader(app: App, c: Chapter) {
  let i = Math.min(app.profile.storyRead[c.id] ?? 0, c.pages.length - 1);
  if (i >= c.pages.length - 1) i = 0;
  const art = h('img.sr-art', { alt: '' });
  const text = h('div.sr-text');
  const dots = h('div.sr-dots', null, ...c.pages.map(() => h('i')));
  const prev = btn('Trước', () => go(i - 1), 'ghost small');
  const next = btn('Tiếp', () => go(i + 1), 'small');
  const reader = h('div.story-reader', { role: 'dialog', 'aria-label': c.title },
    h('div.sr-top', null, h('span.sr-title', null, c.title), btn('Đóng', () => close(), 'ghost small')),
    h('div.sr-page', null, h('div.sr-art-wrap', null, art), text),
    h('div.sr-foot', null, prev, dots, next),
  );
  const go = (n: number) => {
    if (n < 0) return;
    if (n >= c.pages.length) return close();
    if (n !== i) sound.page();
    i = n;
    const page = c.pages[i];
    // Pages without their own picture keep the previous one, dimmed, so the scene carries over.
    const key = page.art || c.pages.slice(0, i).reverse().find((p) => p.art)?.art || '';
    art.src = key ? artUrl(key) : '';
    art.classList.toggle('carry', !page.art);
    text.replaceChildren(...page.text.split('\n\n').map((para) => h('p', null, para)));
    text.scrollTop = 0;
    [...dots.children].forEach((d, k) => d.classList.toggle('on', k === i));
    prev.toggleAttribute('disabled', i === 0);
    next.textContent = i === c.pages.length - 1 ? 'Hết chương' : 'Tiếp';
    app.profile.storyRead[c.id] = Math.max(app.profile.storyRead[c.id] ?? 0, i);
    app.save();
  };
  // Swipe left/right to turn pages.
  let sx: number | null = null;
  reader.addEventListener('pointerdown', (e) => (sx = e.clientX));
  reader.addEventListener('pointerup', (e) => {
    if (sx === null) return;
    const dx = e.clientX - sx;
    sx = null;
    if (Math.abs(dx) > 60) go(i + (dx < 0 ? 1 : -1));
  });
  const close = () => {
    reader.classList.add('leaving');
    setTimeout(() => reader.remove(), 180);
    app.go(storyScreen, { replace: true });
  };
  document.getElementById('ui')!.append(reader);
  go(i);
}
