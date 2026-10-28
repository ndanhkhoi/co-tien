import '@fontsource/be-vietnam-pro/vietnamese-400.css';
import '@fontsource/be-vietnam-pro/latin-400.css';
import '@fontsource/be-vietnam-pro/vietnamese-500.css';
import '@fontsource/be-vietnam-pro/latin-500.css';
import '@fontsource/be-vietnam-pro/vietnamese-600.css';
import '@fontsource/be-vietnam-pro/latin-600.css';
import '@fontsource/noto-serif/vietnamese-600.css';
import '@fontsource/noto-serif/latin-600.css';
import '@fontsource/noto-serif/vietnamese-700.css';
import '@fontsource/noto-serif/latin-700.css';
import './styles/base.css';
import './styles/kit.css';
import './styles/screens.css';
import './styles/match.css';
import './styles/skin.css';
import { registerSW } from 'virtual:pwa-register';
import { installNativeFeel } from './platform/device';
import { captureInstallPrompt, mustInstall } from './platform/install';
import { App } from './ui/app';
import { installGate } from './ui/screens/install-gate';
import { splashScreen } from './ui/screens/menus';
import { loadingScreen } from './ui/screens/loading';
import { coreReady } from './platform/preload';
import { installScrollHints } from './ui/scroll-hint';
import { installViewportGuard } from './ui/viewport-guard';

captureInstallPrompt();

async function boot() {
  installNativeFeel();
  // Fonts must be ready before the number atlas is painted onto the balls.
  await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1500))]);
  await document.fonts.load('700 80px "Noto Serif"').catch(() => undefined);
  // Rice-paper texture shared by every surface (absolute URL: it is used inside CSS variables).
  document.documentElement.style.setProperty('--paper', `url("${new URL(`${import.meta.env.BASE_URL}art/ui/paper.webp`, document.baseURI).href}")`);
  const app = new App();
  installScrollHints(document.getElementById('ui')!);
  installViewportGuard();
  installUiScale();
  await app.init();
  (window as unknown as { __app: App }).__app = app;
  if (import.meta.env.DEV || new URLSearchParams(location.search).has('dev')) void import('./dev/cheats').then(({ installCheats }) => installCheats(app));
  if (mustInstall()) {
    document.body.classList.add('gate');
    app.go(installGate, { reset: true });
  } else {
    // `?loading` keeps the loading screen up for design checks.
    app.go(coreReady() && !location.search.includes('loading') ? splashScreen : loadingScreen(splashScreen), { reset: true });
  }
  document.getElementById('boot')?.remove();
  if (import.meta.env.PROD) setupUpdates(app);
}

/**
 * Check for a new version every 15 minutes and whenever the app comes back to the
 * foreground. A new version installs right away from menus; during a match it waits
 * until the player leaves the table so a rack is never cut off.
 */
function setupUpdates(app: App) {
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      app.setPendingUpdate(() => void updateSW(true));
    },
    onRegisteredSW(_url, reg) {
      // Drop art caches from older builds (images are redrawn in place, so old copies would stick).
      void caches?.keys().then((keys) => keys
        .filter((k) => (k === 'art' || k.startsWith('art-')) && k !== __ART_CACHE__)
        .forEach((k) => void caches.delete(k))).catch(() => undefined);
      if (!reg) return;
      const check = () => {
        if (navigator.onLine) void reg.update().catch(() => undefined);
      };
      setInterval(check, 15 * 60 * 1000);
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) check();
      });
    },
  });
}

boot().catch((err) => {
  const el = document.getElementById('boot');
  if (el) el.textContent = `Không khởi động được: ${err instanceof Error ? err.message : String(err)}`;
  console.error(err);
});

/** Keep one 844×390 composition, contained inside the usable screen on every device. */
function installUiScale() {
  const ui = document.getElementById('ui')!;
  const viewport = document.getElementById('stage')!;
  const safeFrame = document.createElement('div');
  safeFrame.style.cssText = 'position:fixed;inset:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px);visibility:hidden;pointer-events:none';
  document.body.append(safeFrame);
  const apply = () => {
    const gate = mustInstall();
    const rect = (gate ? viewport : safeFrame).getBoundingClientRect();
    const s = gate ? 1 : Math.min(2.2, rect.width / 844, rect.height / 390);
    const width = gate ? rect.width : 844;
    const height = gate ? rect.height : 390;
    ui.style.width = `${width}px`;
    ui.style.height = `${height}px`;
    ui.style.left = `${rect.left + (rect.width - width * s) / 2}px`;
    ui.style.top = `${rect.top + (rect.height - height * s) / 2}px`;
    // Keep a transform at scale 1 too: fixed sheets must stay within the game frame.
    ui.style.transform = `scale(${s})`;
    ui.style.setProperty('--ui-scale', String(s));
    window.dispatchEvent(new Event('cotien:ui-resize'));
  };
  const observer = new ResizeObserver(apply);
  observer.observe(viewport);
  observer.observe(safeFrame);
  addEventListener('resize', apply);
  window.visualViewport?.addEventListener('resize', apply);
  apply();
}
