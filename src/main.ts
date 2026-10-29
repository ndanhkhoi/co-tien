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
import { toast } from './ui/dom';
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
      // Hold the player on the update sheet from the moment a new build starts downloading,
      // not only once it is installed: otherwise the old build stays playable for a while.
      const watch = (sw: ServiceWorker | null) => {
        if (!sw || !navigator.serviceWorker.controller) return;
        app.updateFound();
        sw.addEventListener('statechange', () => sw.state === 'redundant' && app.updateFailed());
      };
      watch(reg.installing);
      reg.addEventListener('updatefound', () => watch(reg.installing));
      const check = () => {
        if (navigator.onLine) void reg.update().catch(() => undefined);
      };
      setInterval(check, 15 * 60 * 1000);
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) check();
      });
      addEventListener('online', check);
      // Settings → "Kiểm tra": answers with a toast when this build is already the newest.
      addEventListener('cotien:check-update', () => {
        if (!navigator.onLine) return toast('Đang ngoại tuyến — kết nối mạng để kiểm tra', 'bad');
        reg.update().then(() => {
          if (!reg.installing && !reg.waiting) toast('Bạn đang dùng bản mới nhất', 'good');
        }, () => toast('Chưa kiểm tra được, thử lại sau', 'bad'));
      });
    },
  });
}

boot().catch((err) => {
  const el = document.getElementById('boot');
  if (el) el.textContent = `Không khởi động được: ${err instanceof Error ? err.message : String(err)}`;
  console.error(err);
});

/** The game is composed once at 16:9 and scaled uniformly; nothing inside depends on the window. */
const DESIGN_W = 844;
const DESIGN_H = 475;
/** Largest scale: past this the frame stops growing and the backdrop takes the extra room. */
const MAX_SCALE = 2.2;
/** Design px per source pixel of the painted stage frame (art/ui/frame/stage.webp). */
const FRAME_PX = 0.45;
/** How far that frame reaches outside the composition, in design px (sides, top/bottom). */
const FRAME_X = 92 * FRAME_PX;
const FRAME_Y = 117 * FRAME_PX;

/** Keep one 16:9 composition, contained and centred inside the usable screen on every device. */
function installUiScale() {
  const ui = document.getElementById('ui')!;
  const viewport = document.getElementById('stage')!;
  const safeFrame = document.createElement('div');
  safeFrame.style.cssText = 'position:fixed;inset:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px);visibility:hidden;pointer-events:none';
  document.body.append(safeFrame);
  const apply = () => {
    const gate = mustInstall();
    const safe = safeFrame.getBoundingClientRect();
    // Roomy screens (desktop, tablet, odd window shapes) also get the painted frame and the
    // flanking champions. Phones have no pixels to spare for a frame.
    const framed = Math.min(
      MAX_SCALE,
      (safe.width * 0.92) / (DESIGN_W + 2 * FRAME_X),
      (safe.height * 0.92) / (DESIGN_H + 2 * FRAME_Y),
    );
    const theatre = !gate && Math.min(safe.width, safe.height) >= 480 && framed >= 1;
    // Without a frame, entry art (splash, loading) paints the whole viewport at native size.
    const entry = !gate && !theatre && !!ui.querySelector('.screen.splash, .screen.loading');
    const native = gate || entry;
    // Everywhere else the letterbox around the 16:9 game shows the living backdrop.
    document.body.classList.toggle('stage', !native);
    document.body.classList.toggle('theatre', theatre);
    const rect = native ? viewport.getBoundingClientRect() : safe;
    const s = native ? 1 : theatre ? framed : Math.min(MAX_SCALE, rect.width / DESIGN_W, rect.height / DESIGN_H);
    const width = native ? rect.width : DESIGN_W;
    const height = native ? rect.height : DESIGN_H;
    // Champions only flank the stage when the side margins can hold a figure.
    const sideRoom = (safe.width - DESIGN_W * s) / 2;
    const topRoom = (safe.height - DESIGN_H * s) / 2;
    document.body.classList.toggle('cast-room', theatre && sideRoom >= 150);
    // Tall windows (4:3, 5:4, tablets) have their room above and below instead: the champions
    // lean over the top of the frame there.
    document.body.classList.toggle('cast-top', theatre && sideRoom < 150 && topRoom >= 90);
    ui.style.width = `${width}px`;
    ui.style.height = `${height}px`;
    const left = rect.left + (rect.width - width * s) / 2;
    const top = rect.top + (rect.height - height * s) / 2;
    ui.style.left = `${left}px`;
    ui.style.top = `${top}px`;
    // Native screens paint across the viewport; on the stage, surfaces stop at the game edge.
    ui.style.setProperty('--bleed-left', `${native ? left / s : 0}px`);
    ui.style.setProperty('--bleed-top', `${native ? top / s : 0}px`);
    ui.style.setProperty('--bleed-right', `${native ? (viewport.clientWidth - left - width * s) / s : 0}px`);
    ui.style.setProperty('--bleed-bottom', `${native ? (viewport.clientHeight - top - height * s) / s : 0}px`);
    // The painted frame and the paper mat under the table both follow the game rectangle.
    const root = document.documentElement.style;
    root.setProperty('--game-l', `${left}px`);
    root.setProperty('--game-t', `${top}px`);
    root.setProperty('--game-w', `${width * s}px`);
    root.setProperty('--game-h', `${height * s}px`);
    root.setProperty('--fk', `${theatre ? FRAME_PX * s : 0}px`);
    // Keep a transform at scale 1 too: fixed sheets must stay within the game frame.
    ui.style.transform = `scale(${s})`;
    ui.style.setProperty('--ui-scale', String(s));
    window.dispatchEvent(new Event('cotien:ui-resize'));
  };
  const observer = new ResizeObserver(apply);
  observer.observe(viewport);
  const screenObserver = new MutationObserver(apply);
  screenObserver.observe(ui, { childList: true });
  observer.observe(safeFrame);
  addEventListener('resize', apply);
  window.visualViewport?.addEventListener('resize', apply);
  apply();
}
