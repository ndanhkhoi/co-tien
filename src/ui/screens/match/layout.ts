import { uiScale } from '../../dom';
import type { MatchCtx } from './context';

/** Painted hand: ball centre and radius as fractions of the 285×320 image. */
export const HAND = { w: 285, h: 320, cx: 0.153, cy: 0.239, r: 0.144 };

export function createLayout(ctx: MatchCtx): { layout(): void; dispose(): void } {
  const onResize = () => layout();
  window.addEventListener('resize', onResize);
  window.addEventListener('cotien:ui-resize', onResize);
  requestAnimationFrame(() => layout());
  const layout = () => {
    ctx.renderState.handSize = { w: 0, h: 0 };
    ctx.renderState.handKey = '';
    fit(ctx);
    ctx.renderState.handKey = '';
  };
  return { layout, dispose: () => {
    window.removeEventListener('resize', onResize);
    window.removeEventListener('cotien:ui-resize', onResize);
  } };
}

function fit(ctx: MatchCtx): void {
  const { dom, view, match, lefty } = ctx;
  // HUD offsets are layout px inside the scaled #ui; the table canvas works in screen px.
  const k = uiScale();
  const ui = document.getElementById('ui')!;
  const rect = ui.getBoundingClientRect();
  const W = ui.clientWidth;
  const H = ui.clientHeight;
  const probe = dom.probe;
  // Before the screen is attached nothing has a size yet: use the usual column widths.
  const live = probe.offsetWidth > 0;
  const insetL = live ? probe.offsetLeft : 0;
  const insetR = live ? W - probe.offsetLeft - probe.offsetWidth : 0;
  const insetB = live ? H - probe.offsetTop - probe.offsetHeight : 0;
  // offset* ignores the screen's slide-in transform, unlike getBoundingClientRect.
  const colL = lefty ? dom.ctrl : dom.dock;
  const colR = lefty ? dom.dock : dom.ctrl;
  const targetWidth = dom.nextBall.hidden || !dom.nextBall.textContent ? 0 : dom.nextBall.offsetWidth;
  const leftEdge = leftEdgeOf({ live, colL, insetL, lefty, targetWidth });
  const rightEdge = rightEdgeOf({ live, colR, W, insetR, lefty, targetWidth });
  const top = live ? dom.topBar.offsetTop + dom.topBar.offsetHeight : 84;
  // Breathing room between the rails and the side columns, so the table never looks glued on.
  const sideGap = live ? 14 : 2;
  const bounds = {
    left: leftEdge + sideGap,
    right: W - rightEdge + sideGap,
    top: top + 2,
    bottom: insetB + 2,
  };
  const fitted = view.fit(window.innerWidth, window.innerHeight, {
    left: rect.left + bounds.left * k,
    right: window.innerWidth - rect.right + bounds.right * k,
    top: rect.top + bounds.top * k,
    bottom: window.innerHeight - rect.bottom + bounds.bottom * k,
  });
  const scale = fitted.scale / k;
  // The painted ball in the hand is drawn a little larger than the real one: it is lifted off the cloth.
  const handW = (match.table.R * scale * 1.3) / HAND.r;
  dom.hand.style.width = `${handW}px`;
  dom.hand.style.height = `${(handW * HAND.h) / HAND.w}px`;
}

function leftEdgeOf(x: {
  live: boolean; colL: HTMLElement; insetL: number; lefty: boolean; targetWidth: number;
}): number {
  if (!x.live) return 104;
  if (x.colL.offsetWidth) return x.colL.offsetLeft + x.colL.offsetWidth;
  return x.insetL + (!x.lefty && x.targetWidth ? x.targetWidth + 8 : 4);
}

function rightEdgeOf(x: {
  live: boolean; colR: HTMLElement; W: number; insetR: number; lefty: boolean; targetWidth: number;
}): number {
  if (!x.live) return x.W - 128;
  if (x.colR.offsetWidth) return x.colR.offsetLeft;
  return x.W - x.insetR - (x.lefty && x.targetWidth ? x.targetWidth + 8 : 4);
}
