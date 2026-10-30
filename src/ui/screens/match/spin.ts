import { btn, h, tap } from '../../dom';
import { haptic } from '../../../platform/device';
import { icon } from '../../icons';
import type { AimState } from './context';
import { closeCatcher, sheetCloseButton, type Sheets } from './sheet';

const SPIN_PRESETS: { label: string; side: number; vert: number }[] = [
  { label: 'Giữa', side: 0, vert: 0 },
  { label: 'Trô', side: 0, vert: -0.2 },
  { label: 'Cule', side: 0, vert: 0.55 },
  { label: 'Giật', side: 0, vert: -0.6 },
  { label: 'Trái', side: -0.55, vert: 0 },
  { label: 'Phải', side: 0.55, vert: 0 },
];

export function spinCaption(aim: AimState): string {
  const parts: string[] = [];
  if (aim.vert > 0.15) parts.push('Cule (theo bi)');
  else if (aim.vert < -0.35) parts.push('Giật (kéo bi)');
  else if (aim.vert < -0.1) parts.push('Trô (dừng bi)');
  if (aim.side > 0.15) parts.push('phê phải');
  else if (aim.side < -0.15) parts.push('phê trái');
  return parts.length ? parts.join(' · ') : 'Giữa bi';
}

export function updateSpinDot(dot: HTMLElement, aim: AimState): void {
  dot.style.left = `${50 + aim.side * 40}%`;
  dot.style.top = `${50 - aim.vert * 40}%`;
}

export function createSpin(aim: AimState, dom: {
  el: HTMLElement;
  ctrl: HTMLElement;
  spinDot: HTMLElement;
}, sheets: Sheets, deps: { canAct(): boolean; closeSheets(): void }): { open(): void } {
  return {
    open: () => {
      if (!deps.canAct()) return;
      deps.closeSheets();
      openSpin(aim, dom, sheets, deps);
    },
  };
}

function openSpin(aim: AimState, dom: { el: HTMLElement; ctrl: HTMLElement; spinDot: HTMLElement }, sheets: Sheets,
  deps: { closeSheets(): void }): void {
  const tip = h('i.mx-bb-tip');
  const cap = h('div.mx-sp-cap');
  const ball = h('div.mx-bigball', { role: 'application', 'aria-label': 'Chạm vào bi cái để chọn điểm đánh' },
    h('i.mx-bb-limit'), h('i.mx-bb-h'), h('i.mx-bb-v'), tip);
  const drag = { pid: null as number | null, over: false };
  const paint = buildPaint(aim, { dom, tip, cap, presets: () => presetBtns });
  const presetBtns = SPIN_PRESETS.map((p) => bindPreset(p, aim, paint));
  bindDrag(ball, aim, drag, paint);
  const elevation = createElevation(aim);
  const box = buildSheet({ deps, ball, cap, presetBtns, elevation });
  const catcher = closeCatcher(deps.closeSheets);
  dom.el.append(catcher, box);
  dom.ctrl.classList.add('sheet-open');
  sheets.spin = { el: box, catcher };
  paint();
}

interface SpinPaintParts {
  dom: { spinDot: HTMLElement };
  tip: HTMLElement;
  cap: HTMLElement;
  presets: () => HTMLButtonElement[];
}

function buildPaint(aim: AimState, parts: SpinPaintParts): () => void {
  return () => {
    parts.tip.style.left = `${50 + aim.side * 46}%`;
    parts.tip.style.top = `${50 - aim.vert * 46}%`;
    parts.cap.textContent = spinCaption(aim);
    updateSpinDot(parts.dom.spinDot, aim);
    const btns = parts.presets();
    btns.forEach((b, i) => b.setAttribute('aria-pressed',
      String(Math.abs(SPIN_PRESETS[i].side - aim.side) < 0.02 && Math.abs(SPIN_PRESETS[i].vert - aim.vert) < 0.02)));
  };
}

function bindPreset(p: { label: string; side: number; vert: number }, aim: AimState, paint: () => void): HTMLButtonElement {
  const b = tap(h('button.chip.mx-sp-chip', null, p.label), () => {
    aim.side = p.side;
    aim.vert = p.vert;
    paint();
  });
  return b;
}

function bindDrag(ball: HTMLElement, aim: AimState, drag: { pid: number | null; over: boolean }, paint: () => void): void {
  ball.addEventListener('pointerdown', (e) => {
    drag.pid = e.pointerId;
    ball.setPointerCapture(drag.pid);
    setFrom(ball, aim, drag, e);
    paint();
  });
  ball.addEventListener('pointermove', (e) => {
    if (e.pointerId !== drag.pid) return;
    setFrom(ball, aim, drag, e);
    paint();
  });
  ball.addEventListener('pointerup', () => (drag.pid = null));
  ball.addEventListener('pointercancel', () => (drag.pid = null));
}

function setFrom(ball: HTMLElement, aim: AimState, drag: { over: boolean }, e: PointerEvent): void {
  const r = ball.getBoundingClientRect();
  let sx = ((e.clientX - r.left) / r.width - 0.5) / 0.46;
  let sy = -((e.clientY - r.top) / r.height - 0.5) / 0.46;
  const m = Math.hypot(sx, sy);
  if (m > 1) {
    sx /= m;
    sy /= m;
  }
  aim.side = sx;
  aim.vert = sy;
  const o = m > 0.82;
  if (o !== drag.over) {
    drag.over = o;
    if (o) haptic(15);
  }
}

function createElevation(aim: AimState): { text: HTMLElement; input: HTMLInputElement } {
  const text = h('span', null, `Nâng cơ: ${Math.round(aim.elevation * 180 / Math.PI)}°`);
  const input = h('input', { type: 'range', min: 0, max: 75, step: 1, value: String(Math.round(aim.elevation * 180 / Math.PI)), 'aria-label': 'Góc nâng cơ (độ)' }) as HTMLInputElement;
  input.addEventListener('input', () => {
    aim.elevation = Number(input.value) * Math.PI / 180;
    text.textContent = `Nâng cơ: ${input.value}°`;
  });
  return { text, input };
}

interface SpinSheetParts {
  deps: { closeSheets(): void };
  ball: HTMLElement;
  cap: HTMLElement;
  presetBtns: HTMLButtonElement[];
  elevation: { text: HTMLElement; input: HTMLInputElement };
}

function buildSheet(parts: SpinSheetParts): HTMLElement {
  return h('div.mx-sheet.mx-spinsheet', { role: 'dialog', 'aria-label': 'Áp phê' },
    sheetCloseButton(parts.deps.closeSheets),
    h('div.mx-sp-ballwrap', null, parts.ball),
    h('div.mx-sp-side', null,
      h('div.mx-sp-title', null, icon('spin'), 'Áp phê'),
      h('div.mx-sp-body.scroll', { tabindex: 0, 'aria-label': 'Điểm đánh và góc nâng cơ' },
        parts.cap,
        h('div.mx-sp-presets', null, ...parts.presetBtns),
        h('label.mx-elevation', null, parts.elevation.text, parts.elevation.input),
        h('p.mx-jump-help', null, 'Nâng cơ 45–65°, đánh sát tâm, dùng lực theo khoảng cách. Góc cao giảm tầm ngang và khó dùng áp phê; lệch tâm giảm độ bật, lệch nhiều dễ trượt cơ. Quá nhẹ đụng bi chắn; quá mạnh có thể văng bàn.')),
      btn('Xong', () => parts.deps.closeSheets(), 'small block')));
}
