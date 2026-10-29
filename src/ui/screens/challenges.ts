import { CHALLENGES, FAMILY_INFO, type ChallengeFamily } from '../../game/content/challenges';
import { screenEl, type App, type Screen } from '../app';
import { h, stars, tap, toast } from '../dom';
import { icon } from '../icons';
import { startChallenge, statChip, topbar } from './menus';

export function challengesScreen(app: App): Screen {
  const el = screenEl('challenges');
  const solved = CHALLENGES.filter((c) => app.profile.challenges[c.id] > 0).length;
  const list = h('div.scroll.challenge-list', { tabindex: '0' });
  for (const family of Object.keys(FAMILY_INFO) as ChallengeFamily[]) {
    const info = FAMILY_INFO[family];
    const tasks = CHALLENGES.filter((c) => c.family === family);
    list.append(h('section.challenge-family.sheet', null,
      h('div.family-heading', null, h('div.grow', null, h('h2', null, info.name), h('p', null, info.desc)),
        statChip('check', `${tasks.filter((c) => app.profile.challenges[c.id] > 0).length}/${tasks.length}`)),
      h('div.challenge-grid', null, ...tasks.map((c, i) => {
        const best = app.profile.challenges[c.id] ?? 0;
        const open = i === 0 || (app.profile.challenges[tasks[i - 1].id] ?? 0) > 0;
        const difficulty = i < 4 ? 'Cơ bản' : i < 8 ? 'Nâng cao' : 'Tinh thông';
        return tap(h('button.challenge-card', { class: open ? '' : 'locked', 'aria-label': `${info.name}, bài ${i + 1}, ${open ? difficulty : 'giải bài trước để mở'}` },
          h('span.challenge-number', null, open ? String(i + 1).padStart(2, '0') : icon('lock')),
          h('span.grow', null, h('b', null, `Bài ${i + 1} · ${difficulty}`), h('span.challenge-hint', null, open ? best ? 'Chơi lại để nâng số sao' : 'Tối đa 3 lượt thử' : `Giải bài ${i} để mở`)),
          stars(best)), () => open ? startChallenge(app, c) : toast(`Giải bài ${i} của nhóm ${info.name} để mở`, 'bad'));
      }))),
    );
  }
  el.append(topbar(app, 'Luyện Cơ', true, statChip('target', `${solved}/${CHALLENGES.length}`)), list);
  return { el };
}
