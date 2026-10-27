import '@fontsource/be-vietnam-pro/vietnamese-600.css';
import '@fontsource/be-vietnam-pro/vietnamese-700.css';
import '@fontsource/be-vietnam-pro/vietnamese-800.css';
import '@fontsource/be-vietnam-pro/vietnamese-900.css';
import '@fontsource/be-vietnam-pro/vietnamese-800-italic.css';
import '@fontsource/be-vietnam-pro/vietnamese-900-italic.css';
import '@fontsource/be-vietnam-pro/latin-600.css';
import '@fontsource/be-vietnam-pro/latin-700.css';
import '@fontsource/be-vietnam-pro/latin-800.css';
import '@fontsource/be-vietnam-pro/latin-900.css';
import '@fontsource/be-vietnam-pro/latin-800-italic.css';
import '@fontsource/be-vietnam-pro/latin-900-italic.css';
import './styles/main.css';
import { registerSW } from 'virtual:pwa-register';
import { installNativeFeel } from './platform/device';
import { App } from './ui/app';
import { splashScreen } from './ui/screens/menus';

async function boot() {
  installNativeFeel();
  // Fonts must be ready before the number atlas is painted onto the balls.
  await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1500))]);
  await document.fonts.load('800 80px "Be Vietnam Pro"').catch(() => undefined);
  const app = new App();
  await app.init();
  (window as unknown as { __app: App }).__app = app;
  app.go(splashScreen, { reset: true });
  document.getElementById('boot')?.remove();
  if (import.meta.env.PROD) setupUpdates(app);
}

/**
 * Check for a new version every 30 minutes and whenever the app comes back to the
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
      setInterval(check, 30 * 60 * 1000);
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
