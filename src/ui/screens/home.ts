import { CHAMPIONS, cutoutUrl } from '../../game/content/sects';
import { CHALLENGES } from '../../game/content/challenges';
import { levelProgress } from '../../game/profile';
import { isTouchDevice, toggleFullscreen } from '../../platform/device';
import { preloadBackground } from '../../platform/preload';
import { screenEl, type App, type Screen } from '../app';
import { avatar } from '../avatar';
import { h, iconBtn, tap } from '../dom';
import { icon, type IconName } from '../icons';
import { showIntro } from '../intro';
import { artUrl, fmt } from '../screen-bits';
import { challengesScreen } from './challenges';
import { collectionScreen } from './collection';
import { journeyScreen } from './journey';
import { practiceScreen } from './practice';
import { profileModal } from './profile';
import { settingsScreen } from './settings';
import { localScreen, quickScreen } from './setup';

export function homeScreen(app: App): Screen {
  const el = screenEl('home');
  preloadBackground(app.profile.champion);
  const p = app.profile;
  const prog = levelProgress(p.xp);
  const again = () => app.go(homeScreen, { replace: true });
  // First run: world introduction, then name and champion.
  if (!p.introSeen) setTimeout(() => showIntro(app, () => !p.named && profileModal(app, again, true)), 350);
  else if (!p.named) setTimeout(() => profileModal(app, again, true), 350);

  const player = tap(h('button.player-card', { 'aria-label': 'Hồ sơ cơ thủ' },
    h('span.pc-av', null, avatar(p.champion)),
    h('span.pc-info', null,
      h('span.pc-name', null, p.name),
      h('span.pc-lvl', null, h('b', null, `Cấp ${prog.level}`), h('span.progress', null, h('i', { style: `width:${(prog.into / prog.need) * 100}%` }))),
      h('span.pc-coins', null, icon('coin'), h('span.num', null, fmt(p.coins))),
    ),
  ), () => profileModal(app, again));

  const beaten = Object.keys(p.career).length;
  const chDone = Object.keys(p.challenges).length;
  const read = Object.keys(p.storyRead).length;
  // Game-style home: the journey is a big framed card with the map; the rest are square tablets.
  const tablet = (ic: IconName, name: string, sub: string, fn: () => void) =>
    tap(h('button.home-tablet', null, h('span.ht-icon', null, icon(ic)), h('span.ht-name', null, name), h('span.ht-sub', null, sub)), fn);
  el.style.setProperty('--home-bg', `url("${artUrl('ui/home-bg.webp')}")`);
  el.style.setProperty('--map', `url("${artUrl('ui/map.webp')}")`);
  el.append(
    h('img.home-hero', { src: cutoutUrl(p.champion), alt: '', draggable: false, decoding: 'async' }),
    h('div.home-top', null, player,
      isTouchDevice() ? null : iconBtn(icon('fullscreen'), () => void toggleFullscreen(), 'Toàn màn hình'),
      iconBtn(icon('settings'), () => app.go(settingsScreen), 'Cài đặt')),
    h('div.home-left', null,
      h('img.home-logo', { src: artUrl('ui/logo.webp'), alt: 'Cơ Tiên', draggable: false }),
      tap(h('button.home-journey', { 'aria-label': 'Hành trình' },
        h('span.hj-map'),
        h('span.hj-text', null, h('span.hj-name', null, 'Hành trình'), h('span.hj-sub', null, `${beaten}/${CHAMPIONS.length} cao thủ · ${chDone}/${CHALLENGES.length} thử thách`)),
        h('span.hj-go', null, icon('play'))), () => app.go(journeyScreen)),
      h('nav.home-grid', { 'aria-label': 'Trình đơn chính' },
        tablet('quick-match', 'Luận Cơ', 'So tài cùng máy', () => app.go(quickScreen)),
        tablet('users', 'Song Đấu', 'Hai người · chung máy', () => app.go(localScreen)),
        tablet('target', 'Luyện Cơ', `Luyện cú · ${chDone}/${CHALLENGES.length}`, () => app.go(challengesScreen)),
        tablet('collection', 'Tàng Các', `Chiêu mộ · ${p.champions.length}/${CHAMPIONS.length}`, () => app.go(collectionScreen)),
        // The story and its text load only when opened.
        tablet('story', 'Cơ Tiên Truyện', read ? `Đã đọc ${read} chương` : '15 chương', () => void import('./story').then((m) => app.go(m.storyScreen))),
        tablet('place', 'Luyện thế', 'Tự bày thế tập', () => app.go(practiceScreen)),
      ),
    ),
  );
  return { el };
}
