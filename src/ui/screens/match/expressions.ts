import { exprUrl, portraitUrl } from '../../../game/content/sects';
import type { Side } from '../../../core/rules/types';
import { h } from '../../dom';
import type { Expr } from './herald';
import type { MatchCtx } from './context';
import type { MatchDom } from './dom';

export function createExpressions(ctx: MatchCtx, dom: MatchDom): {
  setExpr(side: Side, e: Expr, ms?: number): void;
  setFocus(side: Side, on: boolean): void;
  floatGain(side: Side, gain: number): void;
  dispose(): void;
} {
  const championOf = (side: Side) => ctx.match.setup.players[side].champion;
  const applyFace = (side: Side) => {
    const c = dom.cards[side];
    const e = c.temp ?? (c.focus ? 'focus' : null);
    const src = e ? exprUrl(championOf(side), e) : portraitUrl(championOf(side));
    if (c.face.getAttribute('src') !== src) {
      c.face.src = src;
      c.ring.classList.remove('swap');
      void c.ring.offsetWidth;
      c.ring.classList.add('swap');
    }
  };
  const setExpr = (side: Side, e: Expr, ms = 2600) => {
    const c = dom.cards[side];
    c.temp = e;
    clearTimeout(c.timer);
    c.timer = window.setTimeout(() => {
      c.temp = null;
      if (!ctx.flags.disposed) applyFace(side);
    }, ms);
    applyFace(side);
  };
  const setFocus = (side: Side, on: boolean) => {
    dom.cards[side].focus = on;
    applyFace(side);
  };
  const floatGain = (side: Side, gain: number) => {
    if (!ctx.hasSkills || gain < 1) return;
    const f = h('span.mx-gain.num', { 'aria-hidden': 'true' }, `+${Math.round(gain)}`);
    dom.cards[side].ringWrap.append(f);
    setTimeout(() => f.remove(), 1200);
  };
  return {
    setExpr,
    setFocus,
    floatGain,
    dispose: () => {
      for (const c of dom.cards) clearTimeout(c.timer);
    },
  };
}
