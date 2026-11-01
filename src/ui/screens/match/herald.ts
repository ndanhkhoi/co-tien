import { exprUrl, portraitUrl } from '../../../game/content/sects';
import type { Side } from '../../../core/rules/types';
import { h, type ToastNotice } from '../../dom';
import { icon, type IconName } from '../../icons';
import type { MatchCtx } from './context';
import type { MatchDom } from './dom';

export type Expr = 'focus' | 'joy' | 'sad' | 'cast';

export interface HeraldMsg {
  /** Whose face to show; null shows `icon` instead. */
  side: Side | null;
  expr?: Expr | null;
  icon?: IconName;
  title: string;
  line?: string;
  tone?: 'ink' | 'red';
  ms?: number;
  /** Shown even when announcements are off (a rack won or system notice). Fouls always show. */
  important?: boolean;
}

export function createHerald(ctx: MatchCtx, dom: MatchDom): {
  herald(m: HeraldMsg): void;
  setThinking(side: Side | null): void;
  dismiss(): boolean;
  dispose(): void;
} {
  const q: HeraldMsg[] = [];
  let timer = 0;
  let on = false;
  let thinkingSide: Side | null = null;

  const herald = (m: HeraldMsg) => {
    if (ctx.flags.disposed) return;
    if (!ctx.app.profile.settings.herald && !m.important && m.tone !== 'red') return;
    q.push(m);
    // Old news is dropped rather than shown late.
    if (q.length > 3) q.splice(0, q.length - 3);
    if (!on) next();
  };
  const next = () => {
    clearTimeout(timer);
    const m = q.shift();
    if (!m) {
      on = false;
      idle();
      return;
    }
    on = true;
    const len = m.title.length + (m.line?.length ?? 0);
    // Shorter while more news waits.
    const ms = m.ms ?? Math.min(4200, 1600 + len * 30) * (q.length ? 0.7 : 1);
    show(m, false, ms);
    timer = window.setTimeout(next, ms);
  };
  const show = (m: HeraldMsg, thinking: boolean, ms = 0) => {
    const face = m.side !== null
      ? h('img.mx-h-face', { src: m.expr ? exprUrl(champOf(ctx, m.side), m.expr) : portraitUrl(champOf(ctx, m.side)), alt: '', draggable: false })
      : h('span.mx-h-icon', null, icon(m.icon ?? 'info'));
    dom.heraldEl.className = `mx-herald show ${m.tone ?? 'ink'}${thinking ? ' thinking' : ''}`;
    dom.heraldEl.replaceChildren(face,
      h('div.mx-h-text', null, h('div.mx-h-title', null, m.title), m.line ? h('div.mx-h-line', null, m.line) : null),
    );
    // The hairline shows the time left; table input dismisses the paper before acting on the shot.
    if (thinking) dom.heraldEl.append(icon('thinking', 'mx-h-think'));
    else dom.heraldEl.append(h('i.mx-h-timer', { style: `--ms:${Math.round(ms)}ms`, 'aria-hidden': 'true' }));
  };
  const dismiss = () => {
    if (!on) return false;
    q.length = 0;
    clearTimeout(timer);
    on = false;
    idle();
    return true;
  };
  const idle = () => {
    if (thinkingSide !== null) {
      show({ side: thinkingSide, expr: 'focus', title: `${ctx.match.setup.players[thinkingSide].name} đang tính…` }, true);
    } else {
      dom.heraldEl.className = 'mx-herald';
    }
  };
  const setThinking = (side: Side | null) => {
    thinkingSide = side;
    if (!on) idle();
  };
  const offToasts = attachToasts(dom.el, herald);
  return {
    herald,
    setThinking,
    dismiss,
    dispose: () => {
      clearTimeout(timer);
      offToasts();
    },
  };
}

function attachToasts(root: HTMLElement, herald: (m: HeraldMsg) => void): () => void {
  const receive = (e: Event) => {
    const { text, glyph, bad, ms } = (e as CustomEvent<ToastNotice>).detail;
    herald({ side: null, icon: glyph, title: text, tone: bad ? 'red' : 'ink', ms, important: true });
    e.preventDefault();
  };
  root.addEventListener('cotien:notice', receive);
  return () => root.removeEventListener('cotien:notice', receive);
}

function champOf(ctx: MatchCtx, side: Side): string {
  return ctx.match.setup.players[side].champion;
}
