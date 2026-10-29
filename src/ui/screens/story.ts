import { sound } from '../../audio/sound';
import { CHAPTERS as LANDS } from '../../game/content/career';
import story from '../../game/content/story.json';
import { screenEl, turnPage, type App, type Screen } from '../app';
import { btn, h, iconBtn, tap, toast } from '../dom';
import { icon } from '../icons';
import { statChip, topbar } from './menus';

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
  const el = screenEl('story');
  const list = h('div.story-list.scroll');
  const read = app.profile.storyRead;
  let reader: { close: () => void; dispose: () => void } | undefined;
  let opened = 0;
  list.append(...CHAPTERS.map((c) => {
    const [kicker, ...rest] = c.title.split(' · ');
    const open = chapterOpen(app, c);
    if (open) opened++;
    const cover = c.pages.find((p) => p.art)?.art;
    const done = (read[c.id] ?? -1) >= c.pages.length - 1;
    const status = !open ? null : done ? h('span.badge.ok', null, 'Đã đọc') : read[c.id] !== undefined
      ? h('span.badge.accent', null, `Đang đọc · trang ${read[c.id] + 1}/${c.pages.length}`) : h('span.badge', null, `Chưa đọc · ${c.pages.length} trang`);
    return tap(h('button.story-card', { class: open ? '' : 'locked' },
      h('span.sc-art', null,
        cover ? h('img', { src: artUrl(cover), alt: '', loading: 'lazy', onerror: (e: Event) => (e.target as HTMLElement).remove() }) : null,
        open ? null : h('span.sc-lock', null, icon('lock'))),
      h('span.sc-body', null,
        h('span.sc-kicker', null, rest.length ? kicker : ''),
        h('b.sc-title', null, rest.length ? rest.join(' · ') : c.title),
        open ? status : h('span.sc-hint', null, unlockHint(c)),
      ),
    ), () => {
      if (open) reader = openReader(app, c);
      else toast(unlockHint(c), 'bad');
    });
  }));
  el.append(topbar(app, (story as { title: string }).title, true, statChip('story', `${opened}/${CHAPTERS.length}`, `Đã mở ${opened}/${CHAPTERS.length} chương`)), list);
  return { el, onBack: () => {
    if (!reader || !document.querySelector('.story-reader')) return false;
    reader.close();
    return true;
  }, dispose: () => reader?.dispose() };
}

function openReader(app: App, c: Chapter) {
  let i = Math.min(app.profile.storyRead[c.id] ?? 0, c.pages.length - 1);
  if (i >= c.pages.length - 1) i = 0;
  const art = h('img.sr-art', { alt: '' });
  const text = h('div.sr-text.scroll', { tabindex: '0' });
  const count = h('span.sr-count.num');
  const dots = h('div.sr-dots', { 'aria-hidden': 'true' }, ...c.pages.map(() => h('i')));
  const prev = btn('Trang trước', () => go(i - 1), 'ghost');
  const next = btn('Trang sau', () => go(i + 1));
  const reader = h('div.story-reader', { role: 'dialog', 'aria-label': c.title },
    h('header.topbar', null,
      iconBtn(icon('back'), () => close(), 'Đóng truyện'),
      h('h1.tb-title', null, c.title),
      h('div.tb-extra', null, count),
    ),
    h('div.sr-page', null, h('div.sr-art-wrap', null, art), h('div.sr-sheet', null, text)),
    h('div.sr-foot', null, prev, dots, next),
  );
  const go = (n: number) => {
    if (n < 0) return;
    if (n >= c.pages.length) return close();
    if (n !== i) sound.page();
    const direction = n >= i ? 1 : -1;
    i = n;
    const page = c.pages[i];
    // Pages without their own picture keep the previous one so the scene carries over.
    const key = page.art || c.pages.slice(0, i).reverse().find((p) => p.art)?.art || '';
    const source = key ? artUrl(key) : '';
    if (art.getAttribute('src') !== source) turnPage(art, () => { art.src = source; }, direction, true);
    if (source) app.setBackdrop(source);
    art.classList.toggle('carry', !page.art);
    turnPage(text, () => {
      text.replaceChildren(...page.text.split('\n\n').map((para) => h('p', null, para)));
      text.scrollTop = 0;
    }, direction);
    count.textContent = `${i + 1}/${c.pages.length}`;
    [...dots.children].forEach((d, k) => d.classList.toggle('on', k === i));
    prev.toggleAttribute('disabled', i === 0);
    next.textContent = i === c.pages.length - 1 ? 'Hết chương' : 'Trang sau';
    app.profile.storyRead[c.id] = Math.max(app.profile.storyRead[c.id] ?? 0, i);
    app.save();
  };
  // Swipe left/right on the picture or text to turn pages; arrow keys too.
  let sx: number | null = null;
  let sy = 0;
  reader.addEventListener('pointerdown', (e) => {
    sx = e.clientX;
    sy = e.clientY;
  });
  reader.addEventListener('pointercancel', () => { sx = null; });
  reader.addEventListener('pointerup', (e) => {
    if (sx === null) return;
    const dx = e.clientX - sx;
    const dy = e.clientY - sy;
    sx = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) go(i + (dx < 0 ? 1 : -1));
  });
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight') go(i + 1);
    else if (e.key === 'ArrowLeft') go(i - 1);
    else if (e.key === 'Escape') close();
  };
  window.addEventListener('keydown', onKey);
  const dispose = () => {
    window.removeEventListener('keydown', onKey);
    reader.remove();
  };
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    window.removeEventListener('keydown', onKey);
    reader.classList.add('leaving');
    setTimeout(() => reader.remove(), 180);
    app.go(storyScreen, { replace: true });
  };
  document.getElementById('ui')!.append(reader);
  go(i);
  return { close, dispose };
}
