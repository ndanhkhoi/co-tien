import { afterEach, describe, expect, it, vi } from 'vitest';
import { attachNoticeInput } from '../src/ui/screens/match/notice-input';

afterEach(() => vi.unstubAllGlobals());

function setup(dismiss: (target: EventTarget | null) => boolean) {
  const canvas = new EventTarget();
  const root = new EventTarget();
  const keys = new EventTarget();
  vi.stubGlobal('window', keys);
  const dispose = attachNoticeInput(canvas, root, dismiss);
  return { canvas, root, keys, dispose };
}

function pointer(button = 0): Event {
  return Object.assign(new Event('pointerdown', { cancelable: true }), { button });
}

describe('match notice input', () => {
  it('consumes the dismissing table touch, then lets the next touch reach shot controls', () => {
    let notice = true;
    const { canvas, dispose } = setup(() => {
      const closed = notice;
      notice = false;
      return closed;
    });
    const aimOrPlace = vi.fn();
    canvas.addEventListener('pointerdown', aimOrPlace);

    const first = pointer();
    expect(canvas.dispatchEvent(first)).toBe(false);
    expect(first.defaultPrevented).toBe(true);
    expect(aimOrPlace).not.toHaveBeenCalled();

    expect(canvas.dispatchEvent(pointer())).toBe(true);
    expect(aimOrPlace).toHaveBeenCalledOnce();
    dispose();
  });

  it('lets a HUD button act while dismissing notices', () => {
    const dismiss = vi.fn(() => true);
    const { root, dispose } = setup(dismiss);
    const control = vi.fn();
    root.addEventListener('pointerdown', control);

    expect(root.dispatchEvent(pointer())).toBe(true);
    expect(dismiss).toHaveBeenCalledWith(root);
    expect(control).toHaveBeenCalledOnce();
    dispose();
  });

  it('keeps keyboard shortcuts available and ignores secondary mouse buttons', () => {
    const dismiss = vi.fn(() => true);
    const { canvas, keys, dispose } = setup(dismiss);
    canvas.dispatchEvent(pointer(2));
    expect(dismiss).not.toHaveBeenCalled();

    const shortcut = vi.fn();
    keys.addEventListener('keydown', shortcut);
    keys.dispatchEvent(new Event('keydown'));
    expect(dismiss).toHaveBeenCalledOnce();
    expect(shortcut).toHaveBeenCalledOnce();
    dispose();
  });

  it('removes dismissal listeners when leaving the match', () => {
    const dismiss = vi.fn(() => true);
    const { canvas, root, keys, dispose } = setup(dismiss);
    dispose();
    canvas.dispatchEvent(pointer());
    root.dispatchEvent(pointer());
    keys.dispatchEvent(new Event('keydown'));
    expect(dismiss).not.toHaveBeenCalled();
  });
});
