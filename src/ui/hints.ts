import type { App } from './app';
import { btn, h, iconBtn, uiScale } from './dom';
import { icon } from './icons';

interface HintOptions {
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
  text: string | Node;
}
const queue: Item[] = [];
/** In a match a new player meets at most one tip per turn, so the first shot is not buried. */
let turnBudget = Infinity;
let showing: { card: HTMLElement; item: Item; target: Element | null; cleanup: () => void } | null = null;

interface HintContent extends HintOptions {
  key: string;
  title: string;
  text: string | Node;
}

export function hintOnce(app: App, hint: HintContent) {
  const { key } = hint;
  const seen = app.profile.hints;
  if (seen.includes(key) || queue.some((q) => q.key === key) || showing?.item.key === key) return;
  queue.push(hint);
  if (!showing) next(app);
}

/**
 * A new turn in a match: tips still waiting from the last turn are dropped (they come back the
 * next time their situation happens, being unseen) and one tip may show this turn.
 */
export function hintTurn(app: App) {
  queue.length = 0;
  turnBudget = 1;
  if (!showing) next(app);
}

/** Drop pending and visible tips (the match screen is closing). */
export function clearHints() {
  queue.length = 0;
  turnBudget = Infinity;
  if (showing) {
    showing.cleanup();
    showing.card.remove();
    showing.target?.classList.remove('coach-target');
    showing = null;
  }
}

function next(app: App) {
  const slot = document.querySelector<HTMLElement>('.screen.game.mx .mx-center');
  if (slot && turnBudget <= 0) {
    showing = null;
    return;
  }
  const item = queue.shift();
  if (!item) {
    showing = null;
    return;
  }
  if (slot) turnBudget--;
  let dismissed = false;
  const done = () => {
    if (dismissed) return;
    dismissed = true;
    if (!app.profile.hints.includes(item.key)) app.profile.hints.push(item.key);
    app.save();
    card.classList.add('leaving');
    target?.classList.remove('coach-target');
    window.removeEventListener('resize', place);
    window.removeEventListener('cotien:ui-resize', place);
    setTimeout(() => {
      card.remove();
      slot?.classList.remove('coaching');
      if (showing?.card === card) next(app);
    }, 180);
  };
  const card = h('div.coach', { role: 'status' },
    h('div.coach-head', null, icon('hint'), h('div.coach-title', null, item.title)),
    h('div.coach-text', null, item.text),
    h('div.coach-actions', null,
      btn('Đã hiểu', done, 'small'),
      iconBtn(icon('close'), done, 'Đóng mẹo')),
  );
  const it = item;
  const target = item.anchor?.() ?? null;
  showing = { card, item, target, cleanup: () => {
    window.removeEventListener('resize', place);
    window.removeEventListener('cotien:ui-resize', place);
    slot?.classList.remove('coaching');
  } };
  if (slot) {
    slot.classList.add('coaching');
    card.classList.add('match-coach');
    slot.append(card);
  } else document.getElementById('ui')!.append(card);
  // In a match the tip sits in the top centre slot; outlining a whole column there only hides the HUD.
  if (item.highlight !== false && !slot) target?.classList.add('coach-target');
  function place() {
    if (slot) return;
    positionCard(card, target, it);
  }
  window.addEventListener('resize', place);
  window.addEventListener('cotien:ui-resize', place);
}


function targetRect(target: Element, k: number) {
  const sr = target.getBoundingClientRect();
  const origin = document.getElementById('ui')!.getBoundingClientRect();
  return { left: (sr.left - origin.left) / k, right: (sr.right - origin.left) / k, top: (sr.top - origin.top) / k, bottom: (sr.bottom - origin.top) / k, width: sr.width / k, height: sr.height / k };
}

function positionCard(card: HTMLElement, target: Element | null, item: Item) {
  if (!target || !target.isConnected) return void card.classList.add('floating');
  const k = uiScale();
  const sr = target.getBoundingClientRect();
  if (!sr.width) return void card.classList.add('floating');
  // Tips live inside the scaled #ui: convert the screen rect to layout px.
  const r = targetRect(target, k);
  const ui = document.getElementById('ui')!;
  const W = ui.clientWidth;
  const H = ui.clientHeight;
  const gap = 10;
  const room = { card, item, r, W, H, gap };
  sizeCard(room);
  const pos = cardPosition(room);
  card.style.left = `${pos.x}px`;
  card.style.top = `${pos.y}px`;
  card.dataset.side = pos.side;
}

interface CardRoom {
  card: HTMLElement;
  item: Item;
  r: { left: number; right: number; top: number; bottom: number; width: number; height: number };
  W: number;
  H: number;
  gap: number;
}

function sizeCard({ card, item, r, W, H }: CardRoom) {
  if (!item.rail) return;
  const available = item.place === 'left' ? r.left - W / 2 - 10 : W / 2 - r.right - 10;
  card.style.width = `${Math.max(1, Math.min(240, available))}px`;
  if (item.alignTop) card.style.maxHeight = `${Math.max(44, H - r.top - 8)}px`;
}

function cardPosition({ card, item, r, W, H, gap }: CardRoom) {
  const cw = card.offsetWidth;
  const ch = card.offsetHeight;
  const fits = {
    right: r.right + gap + cw < W - 8,
    left: r.left - gap - cw > 8,
    below: r.bottom + gap + ch < H - 8,
    above: r.top - gap - ch > 8,
  };
  const order = [item.place ?? 'right', 'right', 'left', 'below', 'above'] as const;
  const side = item.rail ? (item.place === 'left' ? 'left' : 'right') : item.place === 'over' ? 'over' : order.find((s) => s !== 'over' && fits[s]) ?? 'below';
  let x = 0;
  let y = 0;
  if (side === 'over') {
    x = r.left;
    y = r.top;
  } else if (side === 'right' || side === 'left') {
    x = side === 'right' ? r.right + gap : r.left - gap - cw;
    y = item.alignTop ? r.top : r.top + r.height / 2 - ch / 2;
  } else {
    x = r.left + r.width / 2 - cw / 2;
    y = side === 'below' ? r.bottom + gap : r.top - gap - ch;
  }
  return { side, x: Math.max(8, Math.min(W - cw - 8, x)), y: Math.max(8, Math.min(H - ch - 8, y)) };
}

/** Forget every hint (Settings → "Xem lại hướng dẫn"). */
export function resetHints(app: App) {
  app.profile.hints = [];
  app.save();
}
