import { champion, cutoutUrl, sectArtUrl } from '../../../game/content/sects';
import { keepAwake } from '../../../platform/device';
import { avatar } from '../../avatar';
import { h, tap } from '../../dom';
import type { Side } from '../../../core/rules/types';
import type { MatchCtx } from './context';

export function createStart(ctx: MatchCtx, deps: { onTurn(): void; renderHud(): void }): { begin(): void } {
  const begin = () => {
    if (ctx.flags.disposed) return;
    ctx.flags.begun = true;
    deps.onTurn();
    deps.renderHud();
  };
  keepAwake(true);
  if (ctx.solo) begin();
  else showVs(ctx, begin);
  return { begin };
}

function showVs(ctx: MatchCtx, done: () => void): void {
  const t = ctx.opts.titles ?? ['', ''];
  const side = (s: Side) => h('div.mx-vs-side', { class: s ? 'r' : '' },
    h('div.mx-vs-av', null, avatar(champOf(ctx, s))),
    h('div.mx-vs-name', null, ctx.match.setup.players[s].name),
    h('div.mx-vs-title', null, t[s] || champion(champOf(ctx, s)).name));
  const vs = h('div.mx-vs', null, side(0), h('div.mx-vs-mid', null, 'VS'), side(1),
    ctx.opts.quote ? h('div.mx-vs-quote', null, `“${ctx.opts.quote}”`) : null);
  ctx.dom.el.append(vs);
  const finish = () => {
    vs.remove();
    done();
  };
  tap(vs, finish);
  setTimeout(() => vs.isConnected && finish(), ctx.opts.quote ? 3200 : 2000);
}

function champOf(ctx: MatchCtx, side: Side): string {
  return ctx.match.setup.players[side].champion;
}

export function screenBackdrop(ctx: MatchCtx): { backdrop: string; cast: [string | null, string | null] } {
  const first = champOf(ctx, 0);
  return {
    backdrop: sectArtUrl(champion(ctx.match.setup.players[1].champion).sect, 'splash'),
    cast: [cutoutUrl(first), ctx.solo ? null : cutoutUrl(champOf(ctx, 1))],
  };
}
