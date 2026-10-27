import type { App } from './app';
import { btn, h } from './dom';

/**
 * One-time coach marks: each hint shows the first time its situation happens, then never
 * again (remembered in the profile). Only one is on screen at a time; others wait their turn.
 */
const queue: { key: string; title: string; text: string }[] = [];
let showing = false;

export function hintOnce(app: App, key: string, title: string, text: string) {
  const seen = app.profile.hints;
  if (seen.includes(key) || queue.some((q) => q.key === key)) return;
  queue.push({ key, title, text });
  if (!showing) next(app);
}

function next(app: App) {
  const item = queue.shift();
  if (!item) {
    showing = false;
    return;
  }
  showing = true;
  const card = h('div.coach', { role: 'status' },
    h('div.coach-title', null, item.title),
    h('div.coach-text', null, item.text),
    h('div.coach-actions', null, btn('Đã hiểu', () => {
      if (!app.profile.hints.includes(item.key)) app.profile.hints.push(item.key);
      app.save();
      card.classList.add('leaving');
      setTimeout(() => {
        card.remove();
        next(app);
      }, 180);
    }, 'small')),
  );
  document.getElementById('ui')!.append(card);
}

/** Forget every hint (Settings → "Xem lại hướng dẫn"). */
export function resetHints(app: App) {
  app.profile.hints = [];
  app.save();
}
