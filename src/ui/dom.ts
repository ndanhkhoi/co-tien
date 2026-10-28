import { sound } from '../audio/sound';
import { haptic } from '../platform/device';
import { icon, type IconName } from './icons';

type Child = Node | string | number | null | undefined | false;
type Props = Record<string, unknown> & { class?: string; style?: string };

/** Tiny element builder: h('div.card.sel', { onclick }, child, …). */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K | `${K}.${string}`, props: Props | null = null, ...kids: Child[]): HTMLElementTagNameMap[K] {
  const [name, ...classes] = tag.split('.');
  const el = document.createElement(name) as HTMLElementTagNameMap[K];
  if (classes.length) el.className = classes.join(' ');
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') el.className = [el.className, v].filter(Boolean).join(' ');
      else if (k === 'style') el.setAttribute('style', String(v));
      else if (k === 'html') el.innerHTML = String(v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v as EventListener);
      else if (k in el && typeof v !== 'string') (el as unknown as Record<string, unknown>)[k] = v;
      else el.setAttribute(k, String(v));
    }
  }
  append(el, kids);
  return el;
}

export function append(el: Element, kids: Child[]) {
  for (const k of kids) {
    if (k === null || k === undefined || k === false) continue;
    el.append(k instanceof Node ? k : document.createTextNode(String(k)));
  }
}

export function svg(markup: string, cls = ''): SVGElement {
  const t = document.createElement('template');
  t.innerHTML = markup.trim();
  const s = t.content.firstElementChild as SVGElement;
  if (cls) s.setAttribute('class', cls);
  return s;
}

/**
 * Button that reacts on pointer-down (no 300 ms click delay), with sound + haptic,
 * and fires on pointer-up inside. Scrolling containers still work because a move
 * beyond 10 px cancels the press.
 */
export function tap<T extends HTMLElement>(el: T, fn: (e: PointerEvent) => void, opts: { sound?: boolean } = {}): T {
  let start: { x: number; y: number; id: number } | null = null;
  el.addEventListener('pointerdown', (e) => {
    if (e.button > 0) return;
    start = { x: e.clientX, y: e.clientY, id: e.pointerId };
    el.classList.add('pressed');
  });
  el.addEventListener('pointermove', (e) => {
    if (start && e.pointerId === start.id && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 10) {
      start = null;
      el.classList.remove('pressed');
    }
  });
  const end = (e: PointerEvent, fire: boolean) => {
    el.classList.remove('pressed');
    if (!start || e.pointerId !== start.id) return;
    start = null;
    if (!fire || (el as unknown as HTMLButtonElement).disabled) return;
    if (opts.sound !== false) sound.tap();
    haptic(8);
    fn(e);
  };
  el.addEventListener('pointerup', (e) => end(e, true));
  el.addEventListener('pointercancel', (e) => end(e, false));
  el.addEventListener('pointerleave', (e) => end(e, false));
  return el;
}

export function btn(label: Child, fn: () => void, cls = ''): HTMLButtonElement {
  return tap(h('button.btn', { class: cls }, label), fn);
}

export function iconBtn(icon: Element, fn: () => void, title = ''): HTMLButtonElement {
  return tap(h('button.icon-btn', { 'aria-label': title }, icon), fn);
}

let toastLayer: HTMLElement | null = null;

export function toast(text: string, kind: '' | 'bad' | 'good' | 'gold' = '') {
  if (!toastLayer) {
    toastLayer = h('div.toast-layer');
    document.getElementById('ui')!.append(toastLayer);
  }
  const glyph: IconName = ({ bad: 'warning', good: 'check', gold: 'star', '': 'info' } as const)[kind];
  // Long rule explanations stay up long enough to read (about 15 characters a second).
  const ms = Math.min(8000, Math.max(2600, text.length * 65));
  const bar = h('i.tbar', { style: `animation-duration:${ms}ms` });
  const t = h('div.toast', { class: kind || 'info', role: 'status' }, icon(glyph), h('span.tt', null, text), bar);
  toastLayer.append(t);
  while (toastLayer.children.length > 3) toastLayer.firstElementChild!.remove();
  setTimeout(() => {
    t.classList.add('leaving');
    setTimeout(() => t.remove(), 220);
  }, ms);
}

export function banner(text: string, bad = false) {
  const b = h('div.big-banner', { class: bad ? 'bad' : '' }, text);
  document.getElementById('ui')!.append(b);
  setTimeout(() => b.remove(), 1650);
}

export function modal(build: (close: () => void) => HTMLElement, opts: { dismissable?: boolean } = {}): () => void {
  const wrap = h('div.modal-wrap');
  const close = () => wrap.remove();
  const box = build(close);
  wrap.append(box);
  if (opts.dismissable) {
    wrap.addEventListener('pointerdown', (e) => {
      if (e.target === wrap) close();
    });
  }
  document.getElementById('ui')!.append(wrap);
  return close;
}

export function stars(n: number, max = 3): HTMLElement {
  const s = h('span.stars', { 'aria-label': `${n}/${max} sao` });
  for (let i = 0; i < max; i++) s.append(icon(i < n ? 'star' : 'star-empty'));
  return s;
}

export function bar5(v: number): HTMLElement {
  const b = h('span.bar5');
  for (let i = 1; i <= 5; i++) b.append(h('i', { class: i <= v ? 'on' : '' }));
  return b;
}

/** On/off switch (role=switch) — the whole row label can toggle it too. */
export function toggle(on: boolean, onChange: (on: boolean) => void, label = ''): HTMLButtonElement {
  const el = tap(h('button.switch', { role: 'switch', 'aria-checked': String(on), 'aria-label': label }), () => {
    on = !on;
    el.setAttribute('aria-checked', String(on));
    onChange(on);
  });
  return el;
}

/** Range slider whose filled part tracks the value. */
export function slider(value: number, onInput: (v: number) => void, opts: { min?: number; max?: number; step?: number; label?: string } = {}): HTMLInputElement {
  const { min = 0, max = 1, step = 0.05, label = '' } = opts;
  const fill = (v: number) => el.style.setProperty('--fill', `${((v - min) / (max - min)) * 100}%`);
  const el = h('input', { type: 'range', min: String(min), max: String(max), step: String(step), value: String(value), 'aria-label': label,
    oninput: (e: Event) => { const v = Number((e.target as HTMLInputElement).value); fill(v); onInput(v); } });
  fill(value);
  return el;
}

/** Settings/list row: icon, label with optional hint, control. */
export function item(label: string, control: Child, opts: { hint?: string; icon?: IconName } = {}): HTMLElement {
  return h('div.item', null, opts.icon ? icon(opts.icon) : null, h('div.label', null, label, opts.hint ? h('span.small', null, opts.hint) : null), control);
}

/** Pill tabs; returns the bar and a setter. */
export function tabs<T extends string>(items: { id: T; label: string; icon?: IconName }[], active: T, onChange: (id: T) => void): HTMLElement {
  const bar = h('div.tabs', { role: 'tablist' });
  const render = () => bar.replaceChildren(...items.map((it) => tap(h('button.tab', { role: 'tab', 'aria-selected': String(it.id === active) },
    it.icon ? icon(it.icon) : null, it.label), () => { if (it.id === active) return; active = it.id; render(); onChange(it.id); })));
  render();
  return bar;
}

/** Selectable chip. */
export function chip(label: Child, selected: boolean, fn: () => void, ic?: IconName): HTMLButtonElement {
  return tap(h('button.chip', { 'aria-pressed': String(selected) }, ic ? icon(ic) : null, label), fn);
}

/** Scale of the #ui layer (see installUiScale in main.ts): screen px = layout px × uiScale(). */
export function uiScale(): number {
  return Number(document.documentElement.style.getPropertyValue('--ui-scale')) || 1;
}
