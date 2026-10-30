import { MODE_NAMES } from '../../../core/rules';
import { other, type Side } from '../../../core/rules/types';
import { exprUrl, winUrl } from '../../../game/content/sects';
import { keepAwake } from '../../../platform/device';
import { sound } from '../../../audio/sound';
import { btn, h, modal, stars } from '../../dom';
import { icon } from '../../icons';
import type { MatchCtx } from './context';
import { humanSide } from './skill';
import { openPause } from './pause-menu';
import { frag, type MatchDom } from './dom';

export interface DialogDeps {
  cancelCharge(): void;
  closeSheets(): void;
  renderHud(): void;
  setExpr(side: Side, e: 'joy' | 'sad', ms?: number): void;
  aimFirstTarget(): void;
  humanSide(): Side | null;
  onMatchOver(winner: Side): void;
}

export function createDialogs(ctx: MatchCtx, dom: MatchDom, deps: DialogDeps): { openOption(): void; openPause(): void; onRackOver(winner: Side): void; onMatchOver(winner: Side): void } {
  return {
    openOption: () => openOption(ctx),
    openPause: () => void openPause(ctx, dom, deps),
    onRackOver: (winner) => onRackOver(ctx, deps, winner),
    onMatchOver: (winner) => onMatchOver(ctx, winner),
  };
}

function openOption(ctx: MatchCtx): void {
  const { match } = ctx;
  const kind = match.state.pendingOption;
  const prev = match.setup.players[other(match.turn)].name;
  const text = optionText(prev, kind);
  const passLabel = kind === 'illegal-break-8' ? 'Xếp lại & tự phá' : 'Nhường lại';
  modal((close) => h('div.modal.mx-modal', null,
    h('h2', null, 'Quyền chọn'),
    h('p.mx-mtext', null, text),
    h('div.actions', null,
      btn(passLabel, () => {
        close();
        match.chooseOption('pass');
      }, 'ghost'),
      btn('Tôi đánh', () => {
        close();
        match.chooseOption('play');
      }),
    ),
  ), { backDismissable: false });
}

function optionText(prev: string, kind: string | null | undefined): string {
  return {
    'push-out': `${prev} vừa đẩy bi (push-out). Bạn muốn tự đánh từ vị trí này hay bắt ${prev} đánh?`,
    'wrong-call': `${prev} làm bi vào không đúng lời gọi. Bạn đánh tiếp hay bắt ${prev} đánh lại?`,
    'illegal-break-9': `Cú phá chưa đủ 3 bi (vào lỗ hoặc qua vạch đầu bàn). Nhận bàn (mất quyền push-out) hay trả lại cho ${prev}?`,
    'illegal-break-8': 'Cú phá không hợp lệ. Bạn nhận bàn như hiện tại, hay xếp lại bi và tự phá?',
  }[kind ?? 'push-out'] ?? '';
}

/** Result sheet with the champion's art on the left. */
function artModal(art: string, build: (close: () => void) => (Node | null)[]): void {
  modal((close) => h('div.modal.mx-modal.mx-result', null,
    h('div.mx-res-art', null, h('img', { src: art, alt: '', draggable: false })),
    h('div.mx-res-body', null, ...build(close))), { backDismissable: false });
}

function onRackOver(ctx: MatchCtx, deps: DialogDeps, winner: Side): void {
  if (ctx.flags.disposed) return;
  if (ctx.opts.challenge) return rackChallenge(ctx, deps, winner);
  if (ctx.match.phase === 'match-over') return onMatchOver(ctx, winner);
  if (ctx.match.phase !== 'rack-over') return; // rewound meanwhile
  rackVersus(ctx, deps, winner);
}

function rackChallenge(ctx: MatchCtx, deps: DialogDeps, winner: Side): void {
  const { match, opts, turn } = ctx;
  const challenge = opts.challenge!;
  const ok = winner === 0;
  const r = challenge.onResult(ok, turn.attempt);
  if (ok) sound.win();
  else sound.lose();
  deps.setExpr(0, ok ? 'joy' : 'sad', 6000);
  const triesLeft = challenge.tries - turn.attempt;
  artModal(ok ? winUrl(champOf(ctx, 0)) : exprUrl(champOf(ctx, 0), 'sad'), (close) => [
    h('h2', null, ok ? 'Hoàn thành!' : 'Chưa được'),
    h('p.mx-mtext', null, match.lastRes?.messages[0] ?? ''),
    h('p.mx-mgoal', null, h('b', null, 'Mục tiêu: '), challenge.goal, h('span', null, ` · lượt ${turn.attempt}/${challenge.tries}`)),
    ok ? stars(r.stars) : h('p.muted', null, triesLeft > 0 ? `Còn ${triesLeft} lượt thử` : 'Hết lượt thử. Thử lại từ đầu nhé'),
    h('div.actions', null,
      btn('Về danh sách', () => {
        close();
        opts.onExit();
      }, 'ghost'),
      ok && r.next ? btn('Thử thách tiếp', () => {
        close();
        r.next!();
      }) : null,
      btn(ok ? 'Chơi lại' : 'Thử lại', () => {
        close();
        turn.attempt = ok || triesLeft <= 0 ? 1 : turn.attempt + 1;
        match.retryLayout();
        deps.aimFirstTarget();
        deps.renderHud();
      }, ok ? 'ghost' : ''),
    ),
  ]);
}

function rackVersus(ctx: MatchCtx, deps: DialogDeps, winner: Side): void {
  const { match } = ctx;
  const hs = deps.humanSide();
  const humanLost = hs !== null && winner !== hs && match.setup.players[other(hs)].kind === 'ai';
  if (hs !== null && winner === hs) sound.win();
  else if (humanLost) sound.lose();
  const rewindSlot = hs === null ? -1 : match.skills(hs).findIndex((sk) => sk.kinds[0] === 'rewind');
  const canRewind = humanLost && rewindSlot >= 0 && match.canUseSkill(hs!, rewindSlot);
  setTimeout(() => {
    if (ctx.flags.disposed || match.phase !== 'rack-over') return;
    artModal(exprUrl(champOf(ctx, winner), 'joy'), (close) => rackOverBody(ctx, { close, winner, hs, rewindSlot, canRewind }));
  }, 900);
}

function rackOverBody(ctx: MatchCtx, x: {
  close(): void; winner: Side; hs: Side | null; rewindSlot: number; canRewind: boolean;
}): (Node | null)[] {
  const { match } = ctx;
  return [
    h('div.mx-res-kicker', null, `Ván ${match.rackNo}`),
    h('h2', null, `${match.setup.players[x.winner].name} thắng ván`),
    h('div.mx-res-score.num', null, `${match.rackWins[0]} – ${match.rackWins[1]}`),
    h('p.mx-mtext', null, match.lastRes?.messages.join(' ') ?? ''),
    h('div.actions', null,
      x.canRewind ? btn(frag(icon('rewind'), match.skills(x.hs!)[x.rewindSlot].name), () => {
        x.close();
        match.useSkill(x.hs!, x.rewindSlot);
      }, 'ghost') : null,
      btn('Ván tiếp', () => {
        x.close();
        match.nextRack();
      }),
    ),
  ];
}

function onMatchOver(ctx: MatchCtx, winner: Side): void {
  const { match, opts } = ctx;
  const hs = humanSide(ctx);
  const won = hs !== null && winner === hs;
  const vsAi = match.setup.players.some((p) => p.kind === 'ai');
  if (won || !vsAi) sound.win();
  else sound.lose();
  const end = opts.onEnd?.({ won, match }) ?? { lines: [] };
  keepAwake(false);
  const me = hs ?? 0;
  setTimeout(() => {
    if (ctx.flags.disposed) return;
    artModal(winUrl(champOf(ctx, winner)), () => matchOverBody(ctx, { winner, won, vsAi, me, lines: end.lines, again: end.again }));
  }, 1200);
}

function matchOverBody(ctx: MatchCtx, x: {
  winner: Side; won: boolean; vsAi: boolean; me: Side; lines: string[]; again?: () => void;
}): (Node | null)[] {
  const { match, opts } = ctx;
  return [
    h('div.mx-res-kicker', null, `${opts.label} · ${MODE_NAMES[match.setup.mode]}`),
    h('h2', null, x.vsAi ? (x.won ? 'Chiến thắng!' : 'Thất bại') : `${match.setup.players[x.winner].name} thắng!`),
    h('div.mx-res-score.num', null, `${match.rackWins[0]} – ${match.rackWins[1]}`),
    h('p.muted', null, `${match.stats[x.me].pots} bi · loạt dài nhất ${match.stats[x.me].bestRun} · ${match.stats[x.me].fouls} lỗi`),
    x.lines.length ? h('div.mx-res-lines', null, ...x.lines.map((l) => h('div.kv', null, h('span', null, l)))) : null,
    h('div.actions', null,
      btn('Về menu', () => opts.onExit(), 'ghost'),
      x.again ? btn('Đấu lại', () => x.again!()) : null,
    ),
  ];
}

function champOf(ctx: MatchCtx, side: Side): string {
  return ctx.match.setup.players[side].champion;
}
