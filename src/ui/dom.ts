import { sound } from '../audio/sound';
import { haptic } from '../platform/device';

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

export function iconBtn(icon: SVGElement, fn: () => void, title = ''): HTMLButtonElement {
  return tap(h('button.icon-btn', { 'aria-label': title }, icon), fn);
}

let toastLayer: HTMLElement | null = null;

export function toast(text: string, kind: '' | 'bad' | 'good' | 'gold' = '') {
  if (!toastLayer) {
    toastLayer = h('div.toast-layer');
    document.getElementById('ui')!.append(toastLayer);
  }
  const t = h('div.toast', { class: kind }, text);
  toastLayer.append(t);
  while (toastLayer.children.length > 3) toastLayer.firstElementChild!.remove();
  setTimeout(() => t.remove(), 2400);
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
  const s = h('span.stars');
  for (let i = 0; i < max; i++) {
    s.append(svg(`<svg viewBox="0 0 24 24"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6L2.5 9.4l6.6-.8z" fill="${i < n ? '#f5c542' : 'rgba(255,255,255,0.18)'}"/></svg>`));
  }
  return s;
}

export function bar5(v: number): HTMLElement {
  const b = h('span.bar5');
  for (let i = 1; i <= 5; i++) b.append(h('i', { class: i <= v ? 'on' : '' }));
  return b;
}
