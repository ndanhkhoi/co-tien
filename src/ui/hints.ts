import type { App } from './app';
import { btn, h } from './dom';
import { icon } from './icons';

export interface HintOptions {
  /** Control the tip explains; the card sits beside it (never over the table centre) and it is outlined. */
  anchor?: () => Element | null;
  /** Preferred side of the anchor for the card; 'over' lays it on the anchor's top-left corner. */
  place?: 'left' | 'right' | 'above' | 'below' | 'over';
  /** Outline the anchor (default). Off when the anchor only gives the card a place to sit. */
  highlight?: boolean;
  /** Keep a dock explanation within the near half of the table. */
  rail?: boolean;
  /** Align with the portrait's top rather than vertically centring the card. */
  alignTop?: boolean;
}

/**
 * One-time coach marks: each hint shows the first time its situation happens, then never
 * again (remembered in the profile). Only one is on screen at a time; others wait their turn.
 */
interface Item extends HintOptions {
  key: string;
  title: string;
  text: string;
}
const queue: Item[] = [];
let showing: { card: HTMLElement; item: Item; target: Element | null; cleanup: () => void } | null = null;

export function hintOnce(app: App, key: string, title: string, text: string, opts: HintOptions = {}) {
  const seen = app.profile.hints;
  if (seen.includes(key) || queue.some((q) => q.key === key) || showing?.item.key === key) return;
  queue.push({ key, title, text, ...opts });
  if (!showing) next(app);
}

/** Drop pending and visible tips (the match screen is closing). */
export function clearHints() {
  queue.length = 0;
  if (showing) {
    showing.cleanup();
    showing.card.remove();
    showing.target?.classList.remove('coach-target');
    showing = null;
  }
}

function next(app: App) {
  const item = queue.shift();
  if (!item) {
    showing = null;
    return;
  }
  const done = () => {
    if (!app.profile.hints.includes(item.key)) app.profile.hints.push(item.key);
    app.save();
    card.classList.add('leaving');
    target?.classList.remove('coach-target');
    window.removeEventListener('resize', place);
    setTimeout(() => {
      card.remove();
      if (showing?.card === card) next(app);
    }, 180);
  };
  const card = h('div.coach', { role: 'status' },
    h('div.coach-head', null, icon('hint'), h('div.coach-title', null, item.title)),
    h('div.coach-text', null, item.text),
    h('div.coach-actions', null, btn('Đã hiểu', done, 'small')),
  );
  const it = item;
  const target = item.anchor?.() ?? null;
  showing = { card, item, target, cleanup: () => window.removeEventListener('resize', place) };
  document.getElementById('ui')!.append(card);
  if (item.highlight !== false) target?.classList.add('coach-target');
  function place() {
    if (!target || !target.isConnected) {
      card.classList.add('floating');
      return;
    }
    const r = target.getBoundingClientRect();
    if (!r.width) {
      card.classList.add('floating');
      return;
    }
    const W = window.innerWidth;
    const H = window.innerHeight;
    if (it.rail) {
      const available = it.place === 'left' ? r.left - W / 2 - 10 : W / 2 - r.right - 10;
      card.style.width = `${Math.max(1, Math.min(240, available))}px`;
    }
    if (it.rail && it.alignTop) {
      card.style.maxHeight = `${Math.max(44, H - r.top - 8)}px`;
    }
    const cw = card.offsetWidth;
    const ch = card.offsetHeight;
    const gap = 10;
    const fits = {
      right: r.right + gap + cw < W - 8,
      left: r.left - gap - cw > 8,
      below: r.bottom + gap + ch < H - 8,
      above: r.top - gap - ch > 8,
    };
    const order = [it.place ?? 'right', 'right', 'left', 'below', 'above'] as const;
    const side = it.rail ? (it.place === 'left' ? 'left' : 'right') : it.place === 'over' ? 'over' : order.find((s) => s !== 'over' && fits[s]) ?? 'below';
    let x = 0;
    let y = 0;
    if (side === 'over') {
      x = r.left;
      y = r.top;
    } else if (side === 'right' || side === 'left') {
      x = side === 'right' ? r.right + gap : r.left - gap - cw;
      y = it.alignTop ? r.top : r.top + r.height / 2 - ch / 2;
    } else {
      x = r.left + r.width / 2 - cw / 2;
      y = side === 'below' ? r.bottom + gap : r.top - gap - ch;
    }
    x = Math.max(8, Math.min(W - cw - 8, x));
    y = Math.max(8, Math.min(H - ch - 8, y));
    card.style.left = `${x}px`;
    card.style.top = `${y}px`;
    card.dataset.side = side;
  }
  place();
  window.addEventListener('resize', place);
}

/** Forget every hint (Settings → "Xem lại hướng dẫn"). */
export function resetHints(app: App) {
  app.profile.hints = [];
  app.save();
}
