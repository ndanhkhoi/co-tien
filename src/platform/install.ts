// Install-to-play: on phones the game only runs as an installed app (fullscreen).

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();

/** Must run at startup: Chrome fires beforeinstallprompt once, early. */
export function captureInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as InstallPromptEvent;
    listeners.forEach((f) => f());
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    listeners.forEach((f) => f());
  });
}

export function onInstallChange(f: () => void): () => void {
  listeners.add(f);
  return () => listeners.delete(f);
}

export const canPromptInstall = () => deferred !== null;

export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false;
  await deferred.prompt();
  const { outcome } = await deferred.userChoice;
  deferred = null;
  return outcome === 'accepted';
}

export type Platform = 'ios' | 'android' | 'in-app' | 'other';

export function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  if (/FBAN|FBAV|FB_IAB|Instagram|Zalo|Line\/|Messenger|TikTok|MicroMessenger/i.test(ua)) return 'in-app';
  if (/iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'other';
}

export function isStandalone(): boolean {
  return matchMedia('(display-mode: standalone), (display-mode: fullscreen), (display-mode: minimal-ui)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/** Phones and tablets in a browser tab must install first; desktops play in the tab. */
export function mustInstall(): boolean {
  if (isStandalone() || navigator.webdriver) return false;
  if (import.meta.env.DEV && location.search.includes('browser')) return false;
  const touch = matchMedia('(pointer: coarse)').matches && navigator.maxTouchPoints > 0;
  return touch && detectPlatform() !== 'other';
}
