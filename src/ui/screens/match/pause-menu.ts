import { MODE_NAMES } from '../../../core/rules';
import type { Side } from '../../../core/rules/types';
import { RULES_TEXT, SKILL_RULES } from '../../../game/content/rules-text';
import { isTouchDevice, toggleFullscreen } from '../../../platform/device';
import { sound } from '../../../audio/sound';
import { avatar } from '../../avatar';
import { btn, h, modal, tap } from '../../dom';
import { icon, type IconName } from '../../icons';
import type { MatchCtx } from './context';
import { frag, type MatchDom } from './dom';

export interface PauseDeps {
  cancelCharge(): void;
  closeSheets(): void;
  renderHud(): void;
}

export function openPause(ctx: MatchCtx, dom: MatchDom, deps: PauseDeps): () => void {
  if (ctx.flags.paused) return () => {};
  deps.closeSheets();
  ctx.flags.paused = true;
  ctx.renderState.cutIn?.classList.add('paused');
  deps.cancelCharge();
  const s = ctx.app.profile.settings;
  const resume = () => {
    ctx.flags.paused = false;
    ctx.renderState.pauseWrap = null;
    deps.renderHud();
  };
  const closePause = modal((close) => pauseBox(ctx, dom, { close, resume, deps, s }), { onClose: resume });
  return closePause;
}

function pauseBox(ctx: MatchCtx, dom: MatchDom, x: {
  close(): void; resume(): void; deps: PauseDeps; s: MatchCtx['app']['profile']['settings'];
}): HTMLElement {
  const { match, opts } = ctx;
  const box = h('div.modal.mx-modal.mx-pausebox', null,
    h('div.mx-pause-main', null,
      h('div.mx-pause-head', null,
        h('h2', null, 'Tạm dừng'),
        h('div.mx-pause-sub', null, `${opts.label} · ${MODE_NAMES[match.setup.mode]}${match.setup.mutator ? ' · có biến thể bàn' : ''}`)),
      pauseBoard(ctx, dom),
      quickSwitches(ctx, x.s)),
    pauseActions(ctx, x));
  queueMicrotask(() => (ctx.renderState.pauseWrap = box.parentElement));
  return box;
}

function pauseBoard(ctx: MatchCtx, dom: MatchDom): HTMLElement {
  const side = (sd: Side) => h('div.mx-ps-side', { class: sd ? 'r' : '' },
    h('span.mx-ps-av', null, avatar(ctx.match.setup.players[sd].champion)),
    h('span.mx-ps-who', null, h('b', null, ctx.match.setup.players[sd].name), h('span', null, dom.cards[sd].sub.textContent || '')),
    h('span.mx-ps-score.num', null, dom.cards[sd].score.textContent || '0'));
  return h('div.mx-pause-board', null, side(0), ctx.solo ? null : h('span.mx-ps-vs', null, 'đấu'), ctx.solo ? null : side(1));
}

function quickSwitches(ctx: MatchCtx, s: MatchCtx['app']['profile']['settings']): HTMLElement {
  const quick = (ic: IconName, label: string, on: () => boolean, flip: () => void) => quickSwitch(ctx, { ic, label, on, flip });
  return h('div.mx-pause-quick', null,
    quick('sound', 'Âm thanh', () => s.sfx > 0, () => {
      s.sfx = s.sfx > 0 ? 0 : 0.9;
      ctx.app.applySettings();
    }),
    quick('music', 'Nhạc nền', () => s.music > 0, () => {
      s.music = s.music > 0 ? 0 : 0.3;
      ctx.app.applySettings();
      if (s.music > 0) sound.startMusic();
      else sound.stopMusic();
    }),
    quick('info', 'Thông báo', () => s.herald, () => {
      s.herald = !s.herald;
    }));
}

function quickSwitch(ctx: MatchCtx, x: {
  ic: IconName; label: string; on(): boolean; flip(): void;
}): HTMLButtonElement {
  // Quick switches: painted icon, label, on/off state; one tap flips them.
  const b = tap(h('button.mx-pq', { type: 'button' }, icon(x.ic), h('span', null, x.label), h('b.mx-pq-state')), () => {
    x.flip();
    ctx.app.save();
    paint();
  });
  const paint = () => {
    b.setAttribute('aria-pressed', String(x.on()));
    b.querySelector('.mx-pq-state')!.textContent = x.on() ? 'Bật' : 'Tắt';
  };
  paint();
  return b;
}

function pauseActions(ctx: MatchCtx, x: { close(): void }): HTMLElement {
  return h('div.mx-pause-actions', null,
    btn(frag(icon('play'), 'Tiếp tục'), x.close, 'block big'),
    btn(frag(icon('scroll'), 'Luật chơi'), () => openRules(ctx), 'secondary block'),
    btn(frag(icon('hint'), 'Cách điều khiển'), () => openHelp(ctx), 'secondary block'),
    isTouchDevice() ? null : btn(frag(icon('fullscreen'), 'Toàn màn hình'), () => void toggleFullscreen(), 'secondary block'),
    leaveButton(ctx, x.close));
}

function leaveButton(ctx: MatchCtx, close: () => void): HTMLButtonElement {
  return btn(frag(icon('back'), 'Thoát trận'), () => {
    // Leaving throws the match away, so ask once more.
    modal((closeAsk) => h('div.modal.mx-modal.mx-leave-ask', null,
      h('h2', null, 'Thoát trận?'),
      h('p.mx-mtext', null, 'Trận đang đấu sẽ kết thúc ngay và không được tính.'),
      h('div.actions', null,
        btn('Ở lại', closeAsk, 'secondary'),
        btn(frag(icon('back'), 'Thoát'), () => {
          closeAsk();
          close();
          ctx.opts.onExit();
        })),
    ), { dismissable: true });
  }, 'ghost block mx-leave');
}

function openRules(ctx: MatchCtx): void {
  const r = RULES_TEXT[ctx.match.setup.mode];
  modal((close) => h('div.modal.scroll.mx-modal.mx-rules', null,
    h('h2', null, `Luật ${MODE_NAMES[ctx.match.setup.mode]}`),
    h('p.mx-mtext', null, r.goal),
    h('ul.mx-list', null, ...r.points.map((t) => h('li', null, t))),
    ctx.match.setup.classic ? null : h('div', null, h('div.section-title', null, 'Tiên Đạo'), h('ul.mx-list', null, ...SKILL_RULES.map((t) => h('li', null, t)))),
    h('div.actions', null, btn('Đã hiểu', close)),
  ), { dismissable: true });
}

function openHelp(ctx: MatchCtx): void {
  const tip = (ic: IconName, title: string, text: string) =>
    h('div.mx-help-item', null, h('span.mx-help-ic', null, icon(ic)), h('div', null, h('b', null, title), h('div', null, text)));
  modal((close) => h('div.modal.scroll.mx-modal.mx-help', null,
    h('h2', null, 'Cách điều khiển'),
    h('div.mx-help-grid', null,
      tip('rotate-right', 'Ngắm', 'Kéo trên bàn để xoay cơ; kéo xa bi cái thì xoay chậm, tinh. Chạm một bi để ngắm thẳng. Nút xoay: chạm = 0,1°, giữ = xoay nhanh dần.'),
      tip('switch-target', 'Đổi mục tiêu', 'Nhảy lần lượt qua các bi hợp lệ: bi nhỏ nhất ở 9/10 bi, bi nhóm mình ở 8 bi.'),
      tip('spin', 'Áp phê', 'Kéo trên bi cái nhỏ để chỉnh nhanh điểm đánh. Cần chính xác thì chạm để mở bi lớn, chạm điểm đánh hoặc chọn nhanh Giữa, Trô, Cule, Giật, Trái, Phải.'),
      tip('power', 'Lực', 'Chạm thanh lực để đặt mức, kéo lên xuống để tinh chỉnh, rồi chạm ĐÁNH. Hoặc giữ ĐÁNH cho lực dao động, thả đúng lúc; trượt ra xa để huỷ.'),
      tip('place', ctx.match.state.isBreak ? 'Đặt bi phá' : 'Đặt bi cái', 'Kéo bi cái, chạm chỗ muốn đặt, hoặc dùng 4 nút mũi tên. Chọn Ngắm thử để chỉnh hướng; Dời bi để quay lại. Bấm ĐẶT BI để chốt.'),
      tip('energy', 'Chiêu và năng lượng', 'Chạm ô chiêu để đọc rồi bấm Dùng. Năng lượng tăng mỗi cú đánh, mỗi bi vào (cú càng khó càng nhiều) và khi đối thủ lỗi; cần đầy thanh năng lượng để dùng tuyệt chiêu.'),
      tip('target', 'Gọi lỗ', 'Khi phải gọi: chạm bi (nếu cần) rồi chạm lỗ trên bàn trước khi đánh.'),
      tip('settings', 'Bàn phím', 'Mũi tên xoay (Shift = tinh), lên/xuống chỉnh lực, Tab đổi mục tiêu, Enter đánh, giữ Space nạp lực, lăn chuột xoay tinh.'),
    ),
    h('div.actions', null, btn('Đã hiểu', () => {
      close();
      ctx.app.profile.tutorialSeen = true;
      ctx.app.save();
    })),
  ), { dismissable: true });
}
