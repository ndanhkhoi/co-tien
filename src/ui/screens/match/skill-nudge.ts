import type { Side } from '../../../core/rules/types';
import { champion } from '../../../game/content/sects';
import { h } from '../../dom';
import type { MatchCtx } from './context';
import type { MatchDom } from './dom';
import type { Sheets } from './sheet';

const NUDGE_MS = 4500;

export function createSkillNudge(ctx: MatchCtx, dom: MatchDom, sheets: Sheets, deps: {
  canAct(): boolean; openSkill(slot: number): void;
}): { hide(): boolean; nudge(side: Side): void } {
  let timer = 0;
  const hide = () => {
    const visible = dom.skillNudge.classList.contains('show');
    clearTimeout(timer);
    dom.skillNudge.classList.remove('show');
    dom.slots.forEach((s) => s.b.classList.remove('nudge'));
    return visible;
  };
  const nudge = (side: Side) => {
    if (ctx.flags.disposed || ctx.match.turn !== side || !deps.canAct() || sheets.skill) return;
    const ready = champion(ctx.match.setup.players[side].champion).skills.filter((sk) => ctx.match.canUseSkill(side, sk.slot));
    const sk = ready.find((x) => x.slot === 2) ?? ready[0];
    if (!sk) return;
    dom.skillNudge.replaceChildren(
      h('b', null, sk.name),
      h('span', null, sk.slot === 2 ? 'Tuyệt chiêu sẵn sàng · chạm để xem' : 'Chiêu sẵn sàng · chạm để xem'),
      h('i.mx-h-timer', { style: `--ms:${NUDGE_MS}ms`, 'aria-hidden': 'true' }),
    );
    dom.skillNudge.classList.add('show');
    dom.slots[sk.slot].b.classList.add('nudge');
    dom.skillNudge.onclick = () => { hide(); deps.openSkill(sk.slot); };
    clearTimeout(timer);
    timer = window.setTimeout(hide, NUDGE_MS);
  };
  return { hide, nudge };
}
