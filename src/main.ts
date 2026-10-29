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
      // Older builds kept art in one cache per build; the lasting "art" cache replaces them all.
      void caches?.keys().then((keys) => keys
        .filter((k) => k.startsWith('art-'))
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
/**
 * Design px per source pixel of the painted stage frame (art/ui/frame/stage.webp). Every screen
 * gets the frame; phones use a slimmer band so it does not eat into the game.
 */
const FRAME_PX_ROOMY = 0.32;
const FRAME_PX_SLIM = 0.2;
/** How far the frame reaches outside the composition per frame px (sides, top/bottom). */
const FRAME_X = 92;
const FRAME_Y = 117;

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
    const view = viewport.getBoundingClientRect();
    const roomy = Math.min(safe.width, safe.height) >= 480;
    const framePx = roomy ? FRAME_PX_ROOMY : FRAME_PX_SLIM;
    // The install gate is the only native-size screen; everything else, splash included, is the
    // framed 16:9 game on its backdrop.
    const native = gate;
    document.body.classList.toggle('stage', !native);
    document.body.classList.toggle('theatre', !native);
    const s = native ? 1 : Math.min(
      MAX_SCALE,
      // As large as the screen allows: only the painted frame band stays outside the game.
      safe.width / (DESIGN_W + 2 * FRAME_X * framePx),
      safe.height / (DESIGN_H + 2 * FRAME_Y * framePx),
    );
    const theatre = !native;
    const rect = native ? view : safe;
    const width = native ? rect.width : DESIGN_W;
    const height = native ? rect.height : DESIGN_H;
    // Champions only flank the stage when the side margins can hold a figure.
    // Measured on the whole screen: the backdrop paints under notches and the home bar too.
    const sideRoom = (view.width - DESIGN_W * s) / 2;
    const topRoom = (safe.height - DESIGN_H * s) / 2;
    document.body.classList.toggle('cast-room', theatre && sideRoom >= 60);
    document.documentElement.style.setProperty('--side-room', `${Math.max(0, sideRoom)}px`);
    // Tall windows (4:3, 5:4, tablets) have their room above and below instead: the champions
    // lean over the top of the frame there.
    document.body.classList.toggle('cast-top', theatre && roomy && sideRoom < 60 && topRoom >= 90);
    ui.style.width = `${width}px`;
    ui.style.height = `${height}px`;
    // Centre on the whole screen (an iPhone's home-bar inset would otherwise push the game up),
    // then nudge back inside the safe area if the frame would reach under a notch or the bar.
    const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));
    const padX = native ? 0 : FRAME_X * framePx * s;
    const padY = native ? 0 : FRAME_Y * framePx * s;
    const left = native ? rect.left : clamp(view.left + (view.width - width * s) / 2, safe.left + padX, safe.right - padX - width * s);
    const top = native ? rect.top : clamp(view.top + (view.height - height * s) / 2, safe.top + padY, safe.bottom - padY - height * s);
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
    root.setProperty('--fk', `${theatre ? framePx * s : 0}px`);
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
