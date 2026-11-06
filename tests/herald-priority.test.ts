import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MatchCtx } from '../src/ui/screens/match/context';
import type { MatchDom } from '../src/ui/screens/match/dom';

// The announcement queue is tested without a browser; its element writer records the rendered content.
vi.mock('../src/ui/dom', () => ({
  h: (tag: string, props: unknown, ...children: unknown[]) => ({ tag, props, children }),
}));
vi.mock('../src/ui/icons', () => ({ icon: (name: string) => ({ icon: name }) }));
import { createHerald } from '../src/ui/screens/match/herald';

function fixture(enabled = true) {
  const element = { className: '', replaceChildren: vi.fn(), append: vi.fn() };
  const root = { addEventListener: vi.fn(), removeEventListener: vi.fn() };
  const ctx = { flags: { disposed: false }, app: { profile: { settings: { herald: enabled } } } } as MatchCtx;
  const dom = { el: root, heraldEl: element } as unknown as MatchDom;
  vi.stubGlobal('window', { setTimeout, clearTimeout });
  return { element, api: createHerald(ctx, dom) };
}

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('immediate aiming warnings', () => {
  it('replace the current announcement and queued old news without waiting', () => {
    vi.useFakeTimers();
    const { element, api } = fixture();
    api.herald({ side: null, title: 'Thông báo cũ', ms: 4000 });
    api.herald({ side: null, title: 'Tin đang chờ', ms: 4000 });
    expect(element.replaceChildren).toHaveBeenCalledTimes(1);
    api.herald({ side: null, title: 'Chú ý trước khi đánh', line: 'Mất đường ngắm', immediate: true,
      important: true, tone: 'red', ms: 5200 });
    expect(element.replaceChildren).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(element.replaceChildren.mock.lastCall)).toContain('Mất đường ngắm');
    vi.advanceTimersByTime(4000);
    expect(element.className).toBe('mx-herald show red');
    vi.advanceTimersByTime(1200);
    expect(element.className).toBe('mx-herald');
    expect(element.replaceChildren).toHaveBeenCalledTimes(2);
    api.dispose();
  });

  it('still shows critical aiming warnings when ordinary announcements are switched off', () => {
    vi.useFakeTimers();
    const { element, api } = fixture(false);
    api.herald({ side: null, title: 'Lượt mới' });
    expect(element.replaceChildren).not.toHaveBeenCalled();
    api.herald({ side: null, title: 'Chú ý trước khi đánh', line: 'Hướng đánh lệch',
      immediate: true, important: true, tone: 'red' });
    expect(element.className).toBe('mx-herald show red');
    expect(JSON.stringify(element.replaceChildren.mock.lastCall)).toContain('Hướng đánh lệch');
    api.dispose();
  });
});
