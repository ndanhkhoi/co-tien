// Make the web page behave like a native game shell on phones.

let hapticsOn = true;

export function setHaptics(on: boolean) {
  hapticsOn = on;
}

/** Short vibration; silently ignored where unsupported (iOS Safari). */
export function haptic(pattern: number | number[]) {
  if (!hapticsOn) return;
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // not allowed outside a gesture on some browsers
  }
}

/**
 * Stop the browser from treating play as page interaction: no text selection, no
 * long-press callout/context menu, no double-tap or pinch zoom, no pull-to-refresh,
 * no drag ghost images.
 */
export function installNativeFeel() {
  const stop = (e: Event) => e.preventDefault();
  document.addEventListener('contextmenu', stop);
  document.addEventListener('selectstart', (e) => {
    const t = e.target as HTMLElement | null;
    if (!t?.closest?.('input, textarea, [contenteditable]')) e.preventDefault();
  });
  document.addEventListener('dragstart', stop);
  document.addEventListener('gesturestart', stop as EventListener);
  document.addEventListener('gesturechange', stop as EventListener);
  // iOS ignores user-scalable=no; block pinch and double-tap zoom manually.
  document.addEventListener('touchmove', (e) => {
    if (e.touches.length > 1) e.preventDefault();
    const t = e.target as HTMLElement | null;
    if (!t?.closest?.('.scroll')) e.preventDefault();
  }, { passive: false });
  let lastTouch = 0;
  document.addEventListener('touchend', (e) => {
    const now = performance.now();
    const t = e.target as HTMLElement | null;
    if (now - lastTouch < 320 && !t?.closest?.('input, textarea')) e.preventDefault();
    lastTouch = now;
  }, { passive: false });
}

/** Touch devices go fullscreen on first tap; desktops only when the player asks. */
export const isTouchDevice = () => matchMedia('(pointer: coarse)').matches && navigator.maxTouchPoints > 0;

export const isFullscreen = () => !!document.fullscreenElement;

export async function toggleFullscreen() {
  if (document.fullscreenElement) await document.exitFullscreen().catch(() => undefined);
  else await enterFullscreen();
}

export async function enterFullscreen() {
  if (navigator.webdriver) return;
  const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };
  try {
    if (!document.fullscreenElement) {
      if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: 'hide' });
      else await el.webkitRequestFullscreen?.();
    }
    const o = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
    await o.lock?.('landscape');
  } catch {
    // Fullscreen / orientation lock unavailable (iOS Safari): the rotate hint covers it.
  }
}

let wakeLock: { release: () => Promise<void> } | null = null;

export async function keepAwake(on: boolean) {
  const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } };
  try {
    if (on && !wakeLock && nav.wakeLock) wakeLock = await nav.wakeLock.request('screen');
    if (!on && wakeLock) {
      await wakeLock.release();
      wakeLock = null;
    }
  } catch {
    wakeLock = null;
  }
}
