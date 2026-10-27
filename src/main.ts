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
import { registerSW } from 'virtual:pwa-register';
import { installNativeFeel } from './platform/device';
import { captureInstallPrompt, mustInstall } from './platform/install';
import { App } from './ui/app';
import { installGate } from './ui/screens/install-gate';
import { splashScreen } from './ui/screens/menus';
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
  await app.init();
  (window as unknown as { __app: App }).__app = app;
  if (import.meta.env.DEV || new URLSearchParams(location.search).has('dev')) void import('./dev/cheats').then(({ installCheats }) => installCheats(app));
  if (mustInstall()) {
    document.body.classList.add('gate');
    app.go(installGate, { reset: true });
  } else {
    app.go(splashScreen, { reset: true });
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
