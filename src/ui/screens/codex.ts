import { MODE_NAMES } from '../../core/rules';
import type { GameMode } from '../../core/rules/types';
import { CUES, TABLES } from '../../game/content/gear';
import lore from '../../game/content/lore.json';
import { RULES_TEXT, SKILL_RULES } from '../../game/content/rules-text';
import {
  CHAMPIONS, CLASSES, champion, classInfo, cutoutUrl, exprUrl, sect, sectArtUrl, SECTS, skillIconUrl, winUrl,
  type Champion, type SectId,
} from '../../game/content/sects';
import { cueStats, tableStats } from '../../game/content/stat-text';
import { OMEN_INFO } from '../../game/terrain';
import { screenEl, type App, type Screen } from '../app';
import { avatar } from '../avatar';
import { btn, h, modal, tap } from '../dom';
import { cueArt } from '../icons';
import { seg, statRows, topbar } from './menus';

/**
 * Cơ Tiên Lục — the world's library. Lands, champions, classes and rules. Champions the
 * player has never faced stay as ink silhouettes; meeting one opens their page, recruiting one
 * opens their full gallery, so there is always something left to discover.
 */
type Tab = 'land' | 'champ' | 'class' | 'rules';

const LORE = lore as { world: string; sects: Record<string, string>; champions: Record<string, { bio: string; quote: string }> };

function known(app: App, id: string) {
  return app.profile.met.includes(id) || app.profile.champions.includes(id);
}

export function codexScreen(app: App): Screen {
  const el = screenEl();
  let tab: Tab = 'land';
  const discovered = CHAMPIONS.filter((c) => known(app, c.id)).length;
  const content = h('div.scroll.codex', { style: 'flex:1;min-height:0' });
  const render = () => {
    content.replaceChildren();
    if (tab === 'land') content.append(landList(app));
    else if (tab === 'champ') content.append(champGrid(app));
    else if (tab === 'class') content.append(classList());
    else content.append(rulesPage());
  };
  el.append(
    topbar(app, 'Cơ Tiên Lục'),
    h('div.body', { style: 'flex-direction:column;gap:10px' },
      h('div.codex-progress', null,
        h('span', null, `Đã khám phá ${discovered}/${CHAMPIONS.length} tướng`),
        h('div.xpbar', { style: 'width:160px' }, h('i', { style: `width:${(discovered / CHAMPIONS.length) * 100}%` })),
      ),
      seg([['land', 'Vùng đất'], ['champ', 'Tướng'], ['class', 'Hệ'], ['rules', 'Luật chơi']], tab, (v) => {
        tab = v;
        render();
      }),
      content,
    ),
  );
  render();
  return { el };
}

function landList(app: App): HTMLElement {
  return h('div.codex-lands', null,
    h('p.codex-world', null, LORE.world),
    ...SECTS.map((s) => {
      const champs = CHAMPIONS.filter((c) => c.sect === s.id);
      const met = champs.filter((c) => known(app, c.id)).length;
      return tap(h('button.codex-land', null,
        h('img', { src: sectArtUrl(s.id, 'emblem'), alt: '' }),
        h('div.grow', null, h('b', null, s.name), h('div.small.muted', null, `${met}/${champs.length} tướng đã gặp`)),
      ), () => landPage(app, s.id));
    }),
  );
}

function landPage(app: App, id: SectId) {
  const s = sect(id);
  const table = TABLES.find((t) => t.sect === id)!;
  const cues = CUES.filter((c) => c.sect === id);
  const omen = OMEN_INFO[id];
  modal((close) => h('div.modal.codex-page.scroll', null,
    h('img.codex-banner', { src: sectArtUrl(id, 'splash'), alt: '', onerror: (e: Event) => (e.target as HTMLElement).remove() }),
    h('h2', null, s.name),
    h('p', null, LORE.sects[id]),
    h('div.section-title', null, 'Tướng'),
    h('div.codex-row', null, ...CHAMPIONS.filter((c) => c.sect === id).map((c) => champThumb(app, c, () => {
      close();
      champPage(app, c);
    }))),
    h('div.section-title', null, `Linh Đài · Thiên Tượng: ${omen.name}`),
    h('p.small', null, `${table.desc} ${omen.desc}`),
    statRows(tableStats(table)),
    h('div.section-title', null, 'Cơ của môn phái'),
    ...cues.map((c) => h('div.codex-cue', null, h('b', null, c.name), h('div', { style: 'margin:6px 0' }, cueArt(c.colors)), statRows(cueStats(c)))),
    h('div.actions', null, btn('Đóng', close)),
  ), { dismissable: true });
}

function champThumb(app: App, c: Champion, open: () => void): HTMLElement {
  const k = known(app, c.id);
  return tap(h('button.codex-thumb', { class: k ? '' : 'unknown', 'aria-label': k ? c.name : 'Chưa khám phá' },
    h('div.av', null, avatar(c.id)),
    h('span', null, k ? c.name : '???'),
  ), () => (k ? open() : undefined));
}

function champGrid(app: App): HTMLElement {
  return h('div.col', { style: 'gap:14px' }, ...SECTS.map((s) => h('div', null,
    h('div.section-title', null, s.name),
    h('div.codex-row', null, ...CHAMPIONS.filter((c) => c.sect === s.id).map((c) => champThumb(app, c, () => champPage(app, c)))),
  )));
}

function champPage(app: App, c: Champion) {
  const owned = app.profile.champions.includes(c.id);
  const cls = classInfo(c.cls);
  const info = LORE.champions[c.id];
  const gallery = owned
    ? h('div.codex-gallery', null,
      ...(['focus', 'joy', 'sad', 'cast'] as const).map((e) => h('img', { src: exprUrl(c.id, e), alt: '', loading: 'lazy' })),
      h('img.win', { src: winUrl(c.id), alt: '', loading: 'lazy' }))
    : h('p.small.muted', null, 'Chiêu mộ tướng này (thắng ở Hành trình hoặc mua trong Bộ sưu tập) để mở bộ tranh đầy đủ.');
  modal((close) => h('div.modal.codex-page.scroll', null,
    h('div.codex-champ', null,
      h('img.cut', { src: cutoutUrl(c.id), alt: '' }),
      h('div', null,
        h('div.small.muted', null, `${sect(c.sect).name} · bậc ${c.tier} · ${cls.name}`),
        h('h2', null, c.name),
        info ? h('blockquote', null, `“${info.quote}”`) : null,
        info ? h('p', null, info.bio) : null,
      ),
    ),
    h('div.section-title', null, 'Nội tại'),
    h('p.small', null, `${cls.name}: ${cls.passive}`),
    h('div.section-title', null, 'Chiêu thức'),
    ...c.skills.map((sk) => h('div.cm-skill', { class: sk.slot === 2 ? 'ult' : '' },
      h('img', { src: skillIconUrl(c.id, sk.slot), alt: '' }),
      h('div.grow', null, h('b', null, `${sk.name}${sk.slot === 2 ? ' · tuyệt chiêu' : ` · hồi ${sk.cooldown} cú`}`), h('div.small', null, sk.desc)))),
    h('div.section-title', null, 'Tranh'),
    gallery,
    h('div.actions', null, btn('Đóng', close)),
  ), { dismissable: true });
}

function classList(): HTMLElement {
  return h('div.col', { style: 'gap:10px' }, ...CLASSES.map((cl) => h('div.card', null,
    h('b', null, cl.name),
    h('p.small', { style: 'margin:4px 0 8px' }, cl.passive),
    h('div.small.muted', null, CHAMPIONS.filter((c) => c.cls === cl.id).map((c) => champion(c.id).name).join(' · ')),
  )));
}

function rulesPage(): HTMLElement {
  return h('div.col', { style: 'gap:12px' },
    ...(Object.keys(RULES_TEXT) as GameMode[]).map((m) => h('div.card', null,
      h('b', null, MODE_NAMES[m]),
      h('p', { style: 'margin:6px 0' }, RULES_TEXT[m].goal),
      h('ul.rules-list', null, ...RULES_TEXT[m].points.map((t) => h('li', null, t))))),
    h('div.card', null, h('b', null, 'Tiên Đạo'), h('ul.rules-list', null, ...SKILL_RULES.map((t) => h('li', null, t)))),
  );
}
