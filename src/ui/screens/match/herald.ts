import { exprUrl, portraitUrl } from '../../../game/content/sects';
import type { Side } from '../../../core/rules/types';
import { h } from '../../dom';
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
  /** Shown even when the player turned announcements off (a rack won). Fouls always show. */
  important?: boolean;
}

export function createHerald(ctx: MatchCtx, dom: MatchDom): {
  herald(m: HeraldMsg): void;
  setThinking(side: Side | null): void;
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
    // Any tap closes an announcement; the hairline shows the time left.
    if (thinking) dom.heraldEl.append(icon('thinking', 'mx-h-think'));
    else dom.heraldEl.append(h('i.mx-h-timer', { style: `--ms:${Math.round(ms)}ms`, 'aria-hidden': 'true' }));
    dom.center.classList.add('heralding');
  };
  // Any touch, click or key dismisses the current announcement: the player is acting, and the
  // banner must never stand between them and the cue ball they are placing.
  const dismiss = () => {
    if (!on) return;
    q.length = 0;
    clearTimeout(timer);
    on = false;
    idle();
  };
  const idle = () => {
    if (thinkingSide !== null) {
      show({ side: thinkingSide, expr: 'focus', title: `${ctx.match.setup.players[thinkingSide].name} đang tính…` }, true);
    } else {
      // Fade the stroke away instead of cutting it off.
      dom.heraldEl.className = dom.heraldEl.classList.contains('show') ? 'mx-herald leaving' : 'mx-herald';
      setTimeout(() => {
        if (dom.heraldEl.classList.contains('leaving')) dom.heraldEl.className = 'mx-herald';
      }, 260);
      dom.center.classList.remove('heralding');
    }
  };
  const setThinking = (side: Side | null) => {
    thinkingSide = side;
    if (!on) idle();
  };
  dom.el.addEventListener('pointerdown', dismiss, true);
  ctx.app.pixi.canvas.addEventListener('pointerdown', dismiss, true);
  window.addEventListener('keydown', dismiss, true);
  return {
    herald,
    setThinking,
    dispose: () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', dismiss, true);
      ctx.app.pixi.canvas.removeEventListener('pointerdown', dismiss, true);
      dom.el.removeEventListener('pointerdown', dismiss, true);
    },
  };
}

function champOf(ctx: MatchCtx, side: Side): string {
  return ctx.match.setup.players[side].champion;
}
