import { sound } from '../../audio/sound';
import { enterFullscreen, isTouchDevice } from '../../platform/device';
import { screenEl, type App, type Screen } from '../app';
import { h } from '../dom';
import { artUrl } from '../screen-bits';
import { homeScreen } from './home';

export function splashScreen(app: App): Screen {
  const el = screenEl('splash');
  el.style.setProperty('--keyart', `url("${artUrl('ui/keyart.webp')}")`);
  el.style.setProperty('--keyart-tall', `url("${artUrl('ui/keyart-portrait.webp')}")`);
  el.append(
    h('img.splash-logo', { src: artUrl('ui/logo.webp'), alt: 'Cơ Tiên, bida tu tiên', draggable: false }),
    h('div.tap-hint', null, h('span', null, 'Chạm để bắt đầu')),
  );
  let started = false;
  el.addEventListener('pointerup', () => {
    if (started) return;
    started = true;
    sound.unlock();
    sound.tap();
    if (isTouchDevice()) void enterFullscreen();
    if (app.profile.settings.music > 0) sound.startMusic();
    app.go(homeScreen, { reset: true });
  });
  return { el };
}
