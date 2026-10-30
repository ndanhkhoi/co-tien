import { h, tap } from '../../dom';
import { icon } from '../../icons';

interface Sheet {
  el: HTMLElement;
  catcher: HTMLElement;
  refresh?: () => void;
}

export interface Sheets {
  skill: Sheet | null;
  spin: Sheet | null;
}

/** Removes both sheets and their catchers without touching dialog state. */
export function removeSheets(root: { dock: HTMLElement; ctrl: HTMLElement }, sheets: Sheets): void {
  for (const s of [sheets.skill, sheets.spin]) {
    s?.el.remove();
    s?.catcher.remove();
  }
  sheets.skill = null;
  sheets.spin = null;
  root.dock.classList.remove('sheet-open');
  root.ctrl.classList.remove('sheet-open');
}

export function closeCatcher(onClose: () => void): HTMLElement {
  const catcher = h('div.mx-catch');
  catcher.addEventListener('pointerdown', onClose);
  return catcher;
}

export function sheetCloseButton(onClose: () => void): HTMLElement {
  return tap(h('button.icon-btn.small.mx-sc-x', { 'aria-label': 'Đóng' }, icon('close')), onClose);
}
