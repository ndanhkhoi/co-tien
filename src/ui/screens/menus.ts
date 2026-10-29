import type { Personality } from '../../ai/types';
import { sound } from '../../audio/sound';
import { preloadBackground } from '../../platform/preload';
import { MODE_NAMES } from '../../core/rules';
import type { GameMode } from '../../core/rules/types';
import { LEVEL_NAMES, PERSONALITY_NAMES, type Npc } from '../../game/content/career';
import { CHALLENGES, challengeBalls, FAMILY_INFO, goalText, judgeChallenge, type ChallengeDef } from '../../game/content/challenges';
import { CUES, MUTATORS, TABLES, type CueDef, type MutatorId, type TableSkin } from '../../game/content/gear';
import {
  CHAMPION_PRICE, CHAMPIONS, champion, classInfo, cutoutUrl, sect, sectArtUrl, SECTS, skillIconUrl, type Champion, KIND_LABEL } from '../../game/content/sects';
import { cueStats, tableStats, TABLE_NOTE, type StatLine } from '../../game/content/stat-text';
import { defaultProfile, exportCode, importCode, levelProgress } from '../../game/profile';
import { enterFullscreen, isTouchDevice, toggleFullscreen } from '../../platform/device';
import { motionModal as modal, screenEl, turnPage, type App, type Screen } from '../app';
import { avatar } from '../avatar';
import { bar5, btn, chip, h, iconBtn, item, slider, stars, tabs, tap, toast, toggle } from '../dom';
import { icon, type IconName } from '../icons';
import { showIntro } from '../intro';
import { resetHints } from '../hints';
import { challengesScreen } from './challenges';
import { champPage, classList, known, landList, rulesPage } from './codex';
import { practiceScreen } from './practice';
import { journeyScreen } from './journey';
import { storyScreen } from './story';
import { matchScreen } from './match-screen';

// ---------- Shared bits ----------

const BASE = new URL(import.meta.env.BASE_URL, document.baseURI).href;
/** Absolute URL of a file under public/art (safe inside CSS variables too). */
export const artUrl = (path: string) => `${BASE}art/${path}`;
export const hex6 = (n: number) => '#' + n.toString(16).padStart(6, '0');
const fmt = (n: number) => n.toLocaleString('vi-VN');

type Kid = Node | string | null | undefined | false;

/** Screen header on its own solid sheet: back, serif title, optional stats, coins. */
export function topbar(app: App, title: string, back = true, ...extra: Kid[]): HTMLElement {
  return h('header.topbar', null,
    back ? iconBtn(icon('back'), () => app.back(), 'Quay lại') : null,
    h('h1.tb-title', null, title),
    h('div.tb-extra', null, ...extra),
    wallet(app),
  );
}

export function wallet(app: App): HTMLElement {
  return h('span.chip.stat.wallet', { 'aria-label': `${fmt(app.profile.coins)} xu` }, icon('coin'), h('span.num', null, fmt(app.profile.coins)));
}

/** Round close button pinned to the modal's top-right corner. */
export function closeX(close: () => void): HTMLButtonElement {
  const b = iconBtn(icon('close'), close, 'Đóng');
  b.classList.add('close-x', 'small');
  return b;
}

/** Small read-only stat chip with a painted icon. */
export function statChip(ic: IconName, text: string, label = ''): HTMLElement {
  return h('span.chip.stat', { 'aria-label': label || text }, icon(ic), h('span.num', null, text));
}

/** Single-choice chip group. */
export function seg<T extends string | number>(options: [T, string][], value: T, onChange: (v: T) => void): HTMLElement {
  const box = h('div.chips', { role: 'radiogroup' });
  const render = (v: T) => box.replaceChildren(...options.map(([k, label]) => chip(label, k === v, () => {
    if (k === v) return;
    onChange(k);
    render(k);
  })));
  render(value);
  return box;
}

/** One stat sheet row: label, optional 1–5 bar, value and what it does. */
export function statRows(lines: StatLine[]): HTMLElement {
  return h('div.stat-sheet', null, ...lines.map((l) => h('div.st-row', null,
    h('div.st-head', null, h('b', null, l.label), l.bar ? bar5(l.bar) : null, h('span.st-val', null, l.value)),
    h('div.st-exp', null, l.explain),
  )));
}

/** Painted cue for menus, including the plain wooden house cue. */
export function cueArtEl(c: CueDef): HTMLElement {
  const src = c.sect ? sectArtUrl(c.sect, c.id.endsWith('-b') ? 'cue-b' : 'cue-a') : artUrl('ui/cue-default.webp');
  return h('div.cue-strip', null, h('img', { src, alt: '', draggable: false, decoding: 'async', loading: 'lazy' }));
}

/** CSS felt preview of a table skin (cloth inside its rail). */
export function tablePreview(t: TableSkin): HTMLElement {
  return h('div.table-preview', { style: `--rail:${hex6(t.rail)};--rail-d:${hex6(t.railDark)};--cloth:${hex6(t.cloth)};--cloth-d:${hex6(t.clothDark)}` },
    h('img', { src: sectArtUrl(t.sect, 'emblem'), alt: '', loading: 'lazy' }));
}

/**
 * Portrait card for a champion. Locked champions keep their real portrait with a lock disc and an unlock hint.
 */
export function champCard(c: Champion, opts: { locked?: boolean; sel?: boolean; name?: string; sub?: string; badge?: Kid; foot?: Kid; cls?: string }, fn: () => void): HTMLButtonElement {
  return tap(h('button.champ-card', {
    class: `${opts.locked ? 'locked' : ''} ${opts.sel ? 'sel' : ''} ${opts.cls ?? ''}`,
    style: `--sect:${hex6(sect(c.sect).main)}`,
    'aria-label': opts.name ?? c.name,
  },
  h('span.cc-art', null, avatar(c.id), opts.locked ? h('span.cc-lock', null, icon('lock')) : null, opts.badge ?? null),
  h('span.cc-name', null, opts.name ?? c.name),
  opts.sub ? h('span.cc-sub', null, opts.sub) : null,
  opts.foot ?? null,
  ), fn);
}

/** Champions grouped by sect, each group on its own sheet. */
function championPicker(app: App, selected: () => string, onPick: (c: Champion) => void, onlyOwned = false): HTMLElement {
  const wrap = h('div.sect-groups');
  const card = (c: Champion) => {
    const has = app.profile.champions.includes(c.id);
    return champCard(c, {
      locked: !has, sel: selected() === c.id,
      sub: has ? classInfo(c.cls).name : `Thắng ở Hành trình · ${fmt(CHAMPION_PRICE[c.tier])} xu`,
      badge: selected() === c.id ? h('span.cc-using', null, 'Đang dùng') : null,
    }, () => {
      onPick(c);
      render();
    });
  };
  // Picking among owned champions: one flat grid, no empty sect headers.
  const render = () => onlyOwned
    ? wrap.replaceChildren(h('div.cc-grid', null, ...CHAMPIONS.filter((c) => app.profile.champions.includes(c.id)).map(card)))
    : wrap.replaceChildren(...SECTS.flatMap((s) => {
    const all = CHAMPIONS.filter((c) => c.sect === s.id);
    const owned = all.filter((c) => app.profile.champions.includes(c.id)).length;
    return [h('section.sect-group', null,
      h('div.sg-head', null, h('img', { src: sectArtUrl(s.id, 'emblem'), alt: '', loading: 'lazy' }), h('b', null, s.name),
        h('span.badge', null, `${owned}/${all.length}`)),
      h('div.cc-grid', null, ...all.map(card)),
    )];
  }));
  render();
  return wrap;
}

// ---------- Player profile ----------

/** Name + champion editor; shown on first launch and from the home player card. */
function profileModal(app: App, onDone: () => void, first = false) {
  const p = app.profile;
  let name = p.name;
  let pick = p.champion;
  const preview = h('div.pm-av');
  const label = h('div.pm-char');
  const show = () => {
    const c = champion(pick);
    preview.replaceChildren(avatar(c.id));
    label.replaceChildren(h('b', null, c.name), h('span', null, `${classInfo(c.cls).name} · ${sect(c.sect).name}`));
  };
  show();
  const input = h('input', {
    id: 'player-name', type: 'text', value: name, maxLength: 14, placeholder: 'Tên của bạn', autocomplete: 'off',
    oninput: (e: Event) => (name = (e.target as HTMLInputElement).value),
  }) as HTMLInputElement;
  modal((close) => h('div.modal.profile-modal', null,
    h('h2', null, first ? 'Chào cơ thủ mới' : 'Hồ sơ cơ thủ'),
    h('div.pm-body', null,
      h('div.pm-left', null, preview, label,
        h('label.section-title', { for: 'player-name' }, 'Tên hiển thị'), input,
        btn(first ? 'Vào game' : 'Lưu', () => {
          p.name = name.trim().slice(0, 14) || 'Cơ Thủ';
          p.champion = pick;
          p.named = true;
          app.save();
          close();
          onDone();
        }, 'block'),
      ),
      h('div.pm-right.scroll', null,
        h('p.pm-note', null, 'Chọn tướng đại diện. Thắng cao thủ ở Hành trình hoặc chiêu mộ trong Tàng Các để có thêm tướng.'),
        championPicker(app, () => pick, (c) => {
          pick = c.id;
          show();
        }, true)),
    ),
    first ? null : closeX(close),
  ), { dismissable: !first });
  if (!first) setTimeout(() => input.focus(), 50);
}

/** Champion detail: cut-out art, class passive and the three skills with their real numbers. */
export function championModal(app: App, c: Champion, onChange?: () => void) {
  const p = app.profile;
  const s = sect(c.sect);
  const cls = classInfo(c.cls);
  modal((close) => {
    const owned = p.champions.includes(c.id);
    const price = CHAMPION_PRICE[c.tier];
    const action = owned
      ? (p.champion === c.id ? btn(h('span.btn-in', null, icon('check'), 'Đang dùng'), () => {}, 'ghost') : btn('Chọn làm tướng đại diện', () => {
        p.champion = c.id;
        app.save();
        close();
        onChange?.();
      }))
      : btn(h('span.btn-in', null, icon('coin', 'keep'), `Chiêu mộ · ${fmt(price)} xu`), () => {
        if (p.coins < price) return toast('Chưa đủ xu — hoặc thắng tướng này ở Hành trình', 'bad');
        p.coins -= price;
        p.champions.push(c.id);
        app.save();
        toast(`Đã chiêu mộ ${c.name}`, 'gold');
        close();
        onChange?.();
      });
    return h('div.modal.champ-page', { style: `--sect:${hex6(s.main)}` },
      h('div.cp-art', null, h('img', { src: cutoutUrl(c.id), alt: '', draggable: false, decoding: 'async',
        // Wide action poses would shrink to fit the tall column: fill it instead and crop the sides.
        onload: (e: Event) => { const im = e.target as HTMLImageElement; im.classList.toggle('wide', im.naturalWidth > im.naturalHeight * 0.85); } })),
      h('div.cp-main', null,
        h('div.cp-content.scroll', { tabindex: '0', 'aria-label': 'Thông tin và chiêu thức' },
        h('div.cp-head', null,
          h('div.cp-sect', null, h('img', { src: sectArtUrl(c.sect, 'emblem'), alt: '' }), s.name),
          h('h2.cp-name', null, c.name),
          h('div.cp-tags', null, h('span.badge.kind', { 'data-kind': c.kind }, KIND_LABEL[c.kind]), h('span.badge', null, `Bậc ${c.tier}`), h('span.badge', null, cls.name),
            owned ? h('span.badge.ok', null, 'Đã chiêu mộ') : h('span.badge.accent', null, 'Chưa chiêu mộ')),
          h('p.cp-passive', null, h('b', null, `Nội tại · ${cls.name}: `), cls.passive),
        ),
        skillButtons(c)),
        h('div.cp-foot', null, btn('Đóng', close, 'ghost'),
          known(app, c.id) ? btn('Tiểu sử', () => {
            close();
            champPage(app, c);
          }, 'secondary') : null,
          action),
      ),
      closeX(close),
    );
  }, { dismissable: true });
}

/** Three painted skill buttons share one detail presentation across champion pages. */
export function skillButtons(c: Champion): HTMLElement {
  return h('div.champion-skills', { role: 'group', 'aria-label': 'Chiêu thức · Chạm để xem chi tiết' },
    ...c.skills.map((sk) => {
      const label = sk.slot === 2 ? 'Tuyệt chiêu' : `Chiêu ${sk.slot + 1}`;
      const button = tap(h('button.champion-skill', {
        type: 'button', class: sk.slot === 2 ? 'ult' : '',
        'aria-label': `${label} · ${sk.name} · Xem chi tiết`, 'aria-haspopup': 'dialog',
      },
      h('img', { src: skillIconUrl(c.id, sk.slot), alt: '', loading: 'lazy' }),
      h('span.champion-skill-label', null, label),
      h('strong.champion-skill-name', null, sk.name),
      h('span.champion-skill-cost', null, sk.slot === 2 ? '100 năng lượng' : `Hồi ${sk.cooldown} lượt`),
      h('span.champion-skill-hint', null, 'Xem chi tiết')), () => open());
      const open = () => {
        modal((dismiss) => {
          const close = () => { dismiss(); button.focus(); };
          const titleId = `skill-detail-${c.id}-${sk.slot}`;
          const back = btn('Về trang tướng', close, 'ghost');
          const x = closeX(close);
          const sheet = h('div.modal.champion-skill-detail', {
            role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId,
            onkeydown: (e: KeyboardEvent) => {
              if (e.key === 'Escape') { e.stopPropagation(); close(); }
              if (e.key === 'Tab') {
                e.preventDefault();
                const controls = [sheet.querySelector<HTMLElement>('.champion-skill-copy')!, back, x];
                const index = controls.indexOf(document.activeElement as HTMLElement);
                controls[(index + (e.shiftKey ? -1 : 1) + controls.length) % controls.length].focus();
              }
            },
          },
          h('div.champion-skill-heading', null,
            h('img', { src: skillIconUrl(c.id, sk.slot), alt: '' }),
            h('div', null, h('span.small', null, `${c.name} · ${label}`), h('h2', { id: titleId }, sk.name))),
          h('div.champion-skill-copy.scroll', { tabindex: '0' },
            h('p.champion-skill-cost', null, sk.slot === 2 ? 'Cần đầy thanh năng lượng (100 năng lượng)' : `Hồi chiêu: ${sk.cooldown} lượt đánh của chính mình`),
            h('p', null, sk.desc)),
          h('div.actions', null, back), x);
          requestAnimationFrame(() => back.focus());
          return sheet;
        }, { dismissable: true, onClose: () => button.focus() });
      };
      return button;
    }));
}

// ---------- Splash ----------

export function splashScreen(app: App): Screen {
  const el = screenEl('splash');
  el.style.setProperty('--keyart', `url("${artUrl('ui/keyart.webp')}")`);
  el.style.setProperty('--keyart-tall', `url("${artUrl('ui/keyart-portrait.webp')}")`);
  el.append(
    h('img.splash-logo', { src: artUrl('ui/logo.webp'), alt: 'Cơ Tiên — bida tu tiên', draggable: false }),
    h('div.tap-hint', null, icon('play'), 'Chạm để bắt đầu'),
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

// ---------- Home ----------

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
        tablet('story', 'Cơ Tiên Truyện', read ? `Đã đọc ${read} chương` : '15 chương', () => app.go(storyScreen)),
        tablet('place', 'Luyện thế', 'Tự bày thế tập', () => app.go(practiceScreen)),
      ),
    ),
  );
  return { el };
}

// ---------- Quick play / Local ----------

function setupScreen(app: App, local: boolean): Screen {
  const el = screenEl('setup');
  const st = {
    mode: 'eight' as GameMode,
    level: 2 as 1 | 2 | 3 | 4,
    pers: 'balanced' as Personality,
    race: 3,
    points: 10,
    mutator: null as MutatorId | null,
    name2: 'Người chơi 2',
    classic: false,
  };
  const SHORT: Record<GameMode, string> = { eight: '8 bi', nine: '9 bi', ten: '10 bi', 'carom-libre': 'Phăng', 'carom-3c': '3 Băng' };
  const isCarom = () => st.mode.startsWith('carom');
  const left = h('div.setup-opts');
  const foeHint = h('span.vs-sub');
  const foePortrait = h('span.vs-av');
  const foeName = h('b.vs-name');
  const foeCut = h('img.vs-cut.foe', { alt: '', draggable: false, decoding: 'async' });
  let foe: Champion;
  const chooseFoe = () => {
    const pool = CHAMPIONS.filter((c) => c.id !== app.profile.champion && (local ? app.profile.champions.includes(c.id) : Math.abs(c.tier - (st.level + 1)) <= 1));
    foe = pool[Math.floor(Math.random() * pool.length)] ?? CHAMPIONS.find((c) => c.id !== app.profile.champion)!;
    foePortrait.replaceChildren(avatar(foe.id));
    foeName.textContent = foe.name;
    foeCut.src = cutoutUrl(foe.id);
  };
  chooseFoe();
  const row = (label: string, ctl: Node) => h('div.opt-row', null, h('span.opt-label', null, label), ctl);
  const tierRange = () => {
    const lo = Math.max(1, st.level);
    const hi = Math.min(5, st.level + 2);
    return `Tướng bậc ${lo}–${hi} · ${LEVEL_NAMES[st.level]}`;
  };
  const render = () => {
    foeHint.textContent = local ? 'Chạm để đổi tên' : tierRange();
    const mut = MUTATORS.find((m) => m.id === st.mutator);
    left.replaceChildren(...[
      row('Chế độ', seg([['tc', 'Tiên Đạo · có chiêu'], ['cd', 'Cổ Điển']], st.classic ? 'cd' : 'tc', (v) => (st.classic = v === 'cd'))),
      row('Thể loại', seg(Object.keys(MODE_NAMES).map((k) => [k as GameMode, SHORT[k as GameMode]]), st.mode, (v) => {
        st.mode = v;
        st.points = v === 'carom-3c' ? 5 : 10;
        render();
      })),
      local ? null : row('Đối thủ', seg([[1, LEVEL_NAMES[1]], [2, LEVEL_NAMES[2]], [3, LEVEL_NAMES[3]], [4, LEVEL_NAMES[4]]], st.level, (v) => {
        st.level = v;
        chooseFoe();
        foeHint.textContent = tierRange();
      })),
      local ? null : row('Lối đánh', seg(Object.entries(PERSONALITY_NAMES) as [Personality, string][], st.pers, (v) => (st.pers = v))),
      row('Số ván', seg([[1, 'Chạm 1'], [2, 'Chạm 2'], [3, 'Chạm 3'], [5, 'Chạm 5']], st.race, (v) => (st.race = v))),
      isCarom()
        ? row('Điểm/ván', seg(st.mode === 'carom-3c' ? [[3, '3 điểm'], [5, '5 điểm'], [10, '10 điểm']] : [[5, '5 điểm'], [10, '10 điểm'], [15, '15 điểm']], st.points, (v) => (st.points = v)))
        : row('Biến thể', h('div.chips', null, chip(mut ? mut.name : 'Không có', !!mut, pickMutator, 'edit'))),
    ].filter((r): r is HTMLDivElement => r !== null));
  };
  function pickMutator() {
    modal((close) => {
      const choose = (id: MutatorId | null) => () => {
        st.mutator = id;
        close();
        render();
      };
      return h('div.modal.scroll', null,
        h('h2', null, 'Biến thể bàn'),
        h('div.list', null,
          item('Không có', chip(st.mutator === null ? 'Đang chọn' : 'Chọn', st.mutator === null, choose(null)), { hint: 'Bàn chuẩn, không thêm gì' }),
          ...MUTATORS.map((m) => item(m.name, chip(st.mutator === m.id ? 'Đang chọn' : 'Chọn', st.mutator === m.id, choose(m.id)), { hint: m.desc })),
        ),
        h('div.actions', null, btn('Đóng', close, 'ghost')),
      );
    }, { dismissable: true });
  }
  render();

  const me = champion(app.profile.champion);
  const name2 = h('input', {
    type: 'text', value: st.name2, maxLength: 14, 'aria-label': 'Tên người chơi 2',
    oninput: (e: Event) => (st.name2 = (e.target as HTMLInputElement).value || 'Người chơi 2'),
  });
  // A duel stage: both champions full-body facing each other, the seal between, the start stamp below.
  const versus = h('div.versus',
    null,
    h('div.vs-stage', null,
      h('img.vs-cut.me', { src: cutoutUrl(me.id), alt: '', draggable: false, decoding: 'async' }),
      foeCut,
      h('div.vs-seal', { 'aria-hidden': 'true' }, 'đấu'),
    ),
    h('div.vs-plates', null,
      tap(h('button.vs-side.me', { 'aria-label': 'Đổi tướng' },
        h('span.vs-text', null, h('b.vs-name', null, app.profile.name), h('span.vs-sub', null, `${me.name} · ${classInfo(me.cls).name}`)),
        h('span.vs-edit', null, icon('edit')),
      ), () => profileModal(app, () => app.go(local ? localScreen : quickScreen, { replace: true }))),
      h('div.vs-side.foe', null, local ? h('span.vs-edit', null, icon('edit')) : null, h('span.vs-text', null, local ? name2 : foeName, foeHint)),
    ),
    btn(h('span.btn-in', null, icon('play'), 'Vào trận'), () => start(), 'big block'),
  );
  el.append(topbar(app, local ? 'Song Đấu' : 'Luận Cơ'), h('div.setup-body', null, left, versus));

  function start() {
    // AI opponents: a champion whose tier fits the level, with a cue from their own sect.
    // Never the player's own champion: no mirror matches.
    const foeCue = local ? app.cue : CUES.find((c) => c.id === `${foe.sect}-${st.level >= 3 ? 'b' : 'a'}`) ?? CUES[0];
    const p1 = { name: app.profile.name, kind: 'human' as const, cue: app.cue, champion: me.id };
    const opp = local
      ? { name: st.name2.slice(0, 14), kind: 'human' as const, cue: foeCue, champion: foe.id }
      : { name: foe.name, kind: 'ai' as const, ai: { level: st.level, personality: st.pers }, cue: foeCue, champion: foe.id };
    const again = () => app.go(launch, { replace: true });
    const launch = matchScreen({
      setup: {
        mode: st.mode, raceTo: st.race, players: [p1, opp], mutator: isCarom() ? null : st.mutator,
        tableSkin: app.tableSkin, caromTarget: st.points, firstBreaker: Math.random() < 0.5 ? 0 : 1, classic: st.classic,
      },
      titles: [`Cấp ${app.level}`, local ? 'Khách' : `${LEVEL_NAMES[st.level]} · ${PERSONALITY_NAMES[st.pers]}`],
      label: local ? 'Song Đấu' : 'Luận Cơ',
      onExit: () => app.pop(),
      onEnd: ({ won, match }) => {
        app.profile.stats.played++;
        app.profile.stats.pots += match.stats[0].pots;
        app.profile.stats.bestRun = Math.max(app.profile.stats.bestRun, match.stats[0].bestRun);
        if (local) {
          app.save();
          return { lines: [], again };
        }
        if (won) app.profile.stats.won++;
        const coins = won ? 40 * st.level * st.race : 10 * st.race;
        const xp = won ? 50 * st.level * st.race : 15 * st.race;
        const up = app.reward(coins, xp);
        return { lines: [`+${coins} xu`, `+${xp} EXP`, ...(up ? [`Lên cấp ${app.level}!`] : [])], again };
      },
    });
    app.go(launch);
  }
  return { el };
}

export const quickScreen = (app: App) => setupScreen(app, false);
export const localScreen = (app: App) => setupScreen(app, true);

// ---------- Journey duels ----------

const tableOf = (n: Npc): TableSkin => TABLES.find((t) => t.id === n.sect) ?? TABLES[0];

export function npcModal(app: App, n: Npc) {
  const mut = n.mutator ? MUTATORS.find((m) => m.id === n.mutator)! : null;
  const best = app.profile.career[n.id];
  const recruited = app.profile.champions.includes(n.id);
  const facts = [MODE_NAMES[n.mode], `chạm ${n.raceTo}`, n.caromTarget ? `${n.caromTarget} điểm/ván` : '', LEVEL_NAMES[n.level], PERSONALITY_NAMES[n.personality]].filter(Boolean).join(' · ');
  modal((close) => h('div.modal.npc-modal', { style: `--sect:${hex6(sect(n.sect).main)}` },
    h('div.nm-scroll.scroll', null,
      h('div.nm-head', null,
        h('div.nm-av', null, avatar(n.id)),
        h('div.grow', null,
          h('h2', null, n.name),
          h('div.nm-title', null, n.title),
          best !== undefined ? stars(best) : null,
        ),
      ),
      h('blockquote.nm-quote', null, n.intro),
      h('p.nm-facts', null, h('b', null, facts), h('br'), `Bàn: ${tableOf(n).name}`),
      mut ? h('p.nm-facts', null, h('b', null, `Biến thể ${mut.name}: `), mut.desc) : null,
    ),
    h('div.nm-foot', null,
      statChip('coin', `+${fmt(n.coins)}`, `Thưởng ${n.coins} xu`),
      h('span.chip.stat', null, `+${fmt(n.xp)} EXP`),
      recruited ? null : h('span.chip.stat.accent', null, icon('users'), 'Thắng để chiêu mộ'),
      btn(h('span.btn-in', null, icon('play'), 'Thách đấu'), () => {
        close();
        startCareer(app, n);
      }),
    ),
    closeX(close),
  ), { dismissable: true });
}

function startCareer(app: App, n: Npc) {
  const cue = CUES.find((c) => c.id === n.cueId) ?? CUES[0];
  // Facing the master you chose as your own champion: play this match with another champion instead.
  let mine = app.profile.champion;
  if (mine === n.id) {
    mine = app.profile.champions.find((id) => id !== n.id) ?? CHAMPIONS.find((c) => c.id !== n.id)!.id;
    toast(`Trận này ${champion(mine).name} ra trận thay — không ai đấu với chính mình`, 'gold');
  }
  const launch = matchScreen({
    setup: {
      mode: n.mode, raceTo: n.raceTo, mutator: n.mutator, tableSkin: tableOf(n), caromTarget: n.caromTarget,
      firstBreaker: 0,
      players: [
        { name: app.profile.name, kind: 'human', cue: app.cue, champion: mine },
        { name: n.name, kind: 'ai', ai: { level: n.level, personality: n.personality }, cue, champion: n.id },
      ],
    },
    titles: [`Cấp ${app.level}`, n.title],
    quote: n.intro,
    label: 'Hành trình',
    onExit: () => app.pop(),
    onEnd: ({ won, match }) => {
      const p = app.profile;
      p.stats.played++;
      p.stats.pots += match.stats[0].pots;
      p.stats.bestRun = Math.max(p.stats.bestRun, match.stats[0].bestRun);
      const again = () => app.go(launch, { replace: true });
      if (!won) {
        const xp = Math.round(n.xp * 0.15);
        app.reward(0, xp);
        return { lines: [`${n.name}: “${n.winLine}”`, `+${xp} EXP`], again };
      }
      p.stats.won++;
      const oppRacks = match.rackWins[1];
      const st = oppRacks === 0 ? 3 : oppRacks <= Math.floor(n.raceTo / 2) ? 2 : 1;
      const first = p.career[n.id] === undefined;
      p.career[n.id] = Math.max(p.career[n.id] ?? 0, st);
      const coins = first ? n.coins : Math.round(n.coins * 0.3);
      const recruit = !p.champions.includes(n.id);
      if (recruit) p.champions.push(n.id);
      const up = app.reward(coins, n.xp);
      return {
        lines: [`${n.name}: “${n.loseLine}”`, `Đạt ${st}/3 sao`, `+${coins} xu · +${n.xp} EXP`, ...(up ? [`Lên cấp ${app.level}!`] : []), ...(recruit ? [`Chiêu mộ được ${n.name}!`] : [])],
        again,
      };
    },
  });
  app.go(launch);
}

// ---------- Challenges ----------

const POCKET_LABEL = ['lỗ góc trên trái', 'lỗ giữa trên', 'lỗ góc trên phải', 'lỗ góc dưới trái', 'lỗ giữa dưới', 'lỗ góc dưới phải'];

export function startChallenge(app: App, c: ChallengeDef, table: TableSkin = app.tableSkin) {
  const list = CHALLENGES.filter((x) => x.family === c.family);
  const idx = list.indexOf(c);
  const mode: GameMode = c.table === 'carom' ? (c.goal.kind === 'carom' && c.goal.three ? 'carom-3c' : 'carom-libre') : 'eight';
  const launch = matchScreen({
    setup: {
      mode, raceTo: 1, mutator: null, tableSkin: table, classic: true,
      players: [
        { name: app.profile.name, kind: 'human', cue: app.cue, champion: app.profile.champion },
        { name: 'Luyện Cơ', kind: 'human', cue: app.cue, champion: app.profile.champion },
      ],
      layout: challengeBalls(c),
      judge: (shot, balls) => judgeChallenge(c, shot, balls),
    },
    label: `Luyện Cơ · ${FAMILY_INFO[c.family].name} ${idx + 1}`,
    challenge: {
      tries: 3,
      goal: goalText(c, (i) => POCKET_LABEL[i]),
      marks: c.goal.kind === 'carom' ? undefined : { pocket: c.goal.pocket, zone: c.goal.kind === 'pot-zone' ? c.goal.zone : undefined },
      onResult: (ok, attempt) => {
        if (!ok) return { stars: 0 };
        const st = Math.max(1, 4 - attempt);
        const prev = app.profile.challenges[c.id] ?? 0;
        if (st > prev) {
          app.profile.challenges[c.id] = st;
          app.reward((st - prev) * 30, (st - prev) * 25);
        }
        app.save();
        const next = list[idx + 1];
        return { stars: st, next: next ? () => startChallengeReplace(app, next, table) : undefined };
      },
    },
    onExit: () => app.pop(),
  });
  app.go(launch);
}

function startChallengeReplace(app: App, c: ChallengeDef, table: TableSkin) {
  app.pop();
  setTimeout(() => startChallenge(app, c, table), 60);
}

// ---------- Collection ----------

/** Tàng Các keeps what you own (champions, cues, tables) and Cơ Tiên Lục, the world's library. */
type CollTab = 'champ' | 'cue' | 'table' | 'land' | 'class' | 'rules';

export function collectionScreen(app: App): Screen {
  const el = screenEl('collection');
  let tab: CollTab = 'champ';
  const content = h('div.scroll.coll-scroll');
  const note = h('p.coll-note.nav-caption');
  const lv = app.level;
  const p = app.profile;
  const refreshWallet = () => el.querySelector('.wallet')?.replaceWith(wallet(app));
  const render = () => {
    content.replaceChildren();
    content.scrollTop = 0;
    if (tab === 'land' || tab === 'class' || tab === 'rules') {
      note.textContent = tab === 'land' ? 'Cơ Tiên Lục · mười ba môn phái, bàn và cơ của từng vùng.' : tab === 'class' ? 'Cơ Tiên Lục · bảy hệ, mỗi hệ một nội tại.' : 'Cơ Tiên Lục · luật của từng lối chơi.';
      content.append(tab === 'land' ? landList(app) : tab === 'class' ? classList() : rulesPage());
      return;
    }
    if (tab === 'champ') {
      note.textContent = `Đã chiêu mộ ${p.champions.length}/${CHAMPIONS.length} tướng. Chạm một tướng để xem nội tại và 3 chiêu.`;
      content.append(championPicker(app, () => p.champion, (c) => championModal(app, c, () => {
        refreshWallet();
        render();
      })));
      return;
    }
    const grid = h('div.gear-grid');
    if (tab === 'cue') {
      note.textContent = 'Cây cơ nào cũng có đường ngắm và bi ảo. Chỉ số chỉ đổi những gì ghi bên dưới.';
      for (const c of CUES) grid.append(gearCard(c, cueArtEl(c), cueStats(c), p.cues.includes(c.id), p.cue === c.id, () => {
        if (!p.cues.includes(c.id)) p.cues.push(c.id);
        p.cue = c.id;
      }));
    } else {
      note.textContent = TABLE_NOTE;
      for (const t of TABLES) {
        grid.append(gearCard(t, tablePreview(t), tableStats(t), p.tables.includes(t.id), p.table === t.id, () => {
          if (!p.tables.includes(t.id)) p.tables.push(t.id);
          p.table = t.id;
        }));
      }
    }
    content.append(grid);
  };
  function gearCard(it: CueDef | TableSkin, art: Element, stats: StatLine[], owned: boolean, eq: boolean, take: () => void): HTMLElement {
    const locked = !owned && lv < it.level;
    return h('div.gear-card', { class: `${eq ? 'sel' : ''} ${locked ? 'locked' : ''}` },
      h('div.gc-head', null, h('b.grow', null, it.name),
        eq ? h('span.badge.accent', null, 'Đang dùng') : owned ? h('span.badge.ok', null, 'Đã có') : statChip('coin', fmt(it.price))),
      art,
      h('p.gc-desc', null, it.desc),
      statRows(stats),
      gearAction(owned, eq, locked, it.level, it.price, () => {
        if (!owned) {
          p.coins -= it.price;
          toast(`Đã mua ${it.name}`, 'gold');
        }
        take();
        app.save();
        refreshWallet();
        render();
      }),
    );
  }
  function gearAction(owned: boolean, eq: boolean, locked: boolean, level: number, price: number, act: () => void) {
    if (eq) return btn(h('span.btn-in', null, icon('check'), 'Đang trang bị'), () => {}, 'ghost small block');
    if (owned) return btn('Trang bị', act, 'small block');
    if (locked) return btn(h('span.btn-in', null, icon('lock'), `Mở ở cấp ${level}`), () => toast(`Đạt cấp ${level} để mở khoá`, 'bad'), 'ghost small block');
    return btn(h('span.btn-in', null, icon('coin', 'keep'), `Mua · ${fmt(price)} xu`), () => (p.coins >= price ? act() : toast('Chưa đủ xu', 'bad')), 'small block');
  }
  const bar = tabs<CollTab>([
    { id: 'champ', label: 'Tướng', icon: 'users' }, { id: 'cue', label: 'Cơ', icon: 'strike' }, { id: 'table', label: 'Bàn', icon: 'target' },
    { id: 'land', label: 'Vùng đất', icon: 'journey' }, { id: 'class', label: 'Hệ', icon: 'shield' }, { id: 'rules', label: 'Luật', icon: 'scroll' },
  ], tab, (v) => {
    const order: CollTab[] = ['champ', 'cue', 'table', 'land', 'class', 'rules'];
    const direction = order.indexOf(v) > order.indexOf(tab) ? 1 : -1;
    tab = v;
    turnPage(content, render, direction);
  });
  render();
  const header = topbar(app, 'Tàng Các', true, bar);
  header.classList.add('compact-nav');
  el.append(header, note, content);
  return { el };
}

// ---------- Settings ----------

export function settingsScreen(app: App): Screen {
  const el = screenEl('settings');
  const p = app.profile;
  const s = p.settings;
  const save = () => {
    app.save();
    app.applySettings();
  };
  const prog = levelProgress(p.xp);
  const nameInput = h('input.set-name', {
    type: 'text', value: p.name, maxLength: 14, 'aria-label': 'Tên cơ thủ', autocomplete: 'off',
    onchange: (e: Event) => {
      p.name = ((e.target as HTMLInputElement).value.trim() || 'Cơ Thủ').slice(0, 14);
      save();
    },
  });
  const me = champion(p.champion);
  const champBtn = tap(h('button.champ-pill', { 'aria-label': 'Đổi tướng đại diện' }, h('span.cp-av', null, avatar(me.id)), h('span', null, me.name), icon('edit')),
    () => profileModal(app, () => app.go(settingsScreen, { replace: true })));
  const group = (title: string, ...rows: Kid[]) => h('section.set-group', null, h('h2.set-title', null, title), h('div.list', null, ...rows));

  const backup = () => {
    const code = exportCode(p);
    modal((close) => h('div.modal', null,
      h('h2', null, 'Mã sao lưu'),
      h('p', null, 'Giữ mã này ở nơi an toàn. Trên máy khác, vào Cài đặt › Khôi phục và dán mã để lấy lại tiến trình.'),
      h('textarea.code-box', { readOnly: true, rows: 4, 'aria-label': 'Mã sao lưu' }, code),
      h('div.actions', null, btn('Đóng', close, 'ghost'), btn('Sao chép', () => {
        if (!navigator.clipboard) return toast('Máy không cho chép tự động — hãy chọn và chép mã', 'bad');
        void navigator.clipboard.writeText(code).then(() => toast('Đã chép mã sao lưu', 'good'), () => toast('Không chép được — hãy chọn và chép mã', 'bad'));
      })),
    ), { dismissable: true });
  };
  const restore = () => {
    const ta = h('textarea.code-box', { placeholder: 'Dán mã sao lưu (TC1.…) vào đây', rows: 4, 'aria-label': 'Mã sao lưu' }) as HTMLTextAreaElement;
    modal((close) => h('div.modal', null,
      h('h2', null, 'Khôi phục tiến trình'),
      h('p', null, 'Tiến trình hiện tại trên máy này sẽ được thay bằng tiến trình trong mã.'),
      ta,
      h('div.actions', null, btn('Huỷ', close, 'ghost'), btn('Khôi phục', () => {
        const np = importCode(ta.value);
        if (!np) return toast('Mã không hợp lệ — kiểm tra lại đã dán đủ chưa', 'bad');
        Object.assign(p, np);
        save();
        close();
        toast('Đã khôi phục tiến trình', 'good');
        app.go(homeScreen, { reset: true });
      })),
    ), { dismissable: true });
    setTimeout(() => ta.focus(), 50);
  };
  const wipe = () => {
    modal((close) => h('div.modal', null,
      h('h2', null, 'Chơi lại từ đầu?'),
      h('p', null, 'Toàn bộ cấp, xu, tướng, cơ, bàn và tiến trình Hành trình trên máy này sẽ bị xoá. ', h('b', null, 'Không thể hoàn tác.')),
      h('p.muted', null, 'Muốn giữ lại? Hãy Sao lưu trước.'),
      h('div.actions', null, btn('Huỷ', close, 'ghost'), btn('Xoá và chơi lại', () => {
        Object.assign(p, defaultProfile());
        save();
        close();
        app.go(homeScreen, { reset: true });
      })),
    ), { dismissable: true });
  };

  const col = h('div.settings-col', null,
    group('Âm thanh',
      item('Hiệu ứng', slider(s.sfx, (v) => {
        s.sfx = v;
        save();
        sound.tap();
      }, { label: 'Âm lượng hiệu ứng' }), { icon: 'sound' }),
      item('Nhạc nền', slider(s.music, (v) => {
        s.music = v;
        save();
        if (v > 0) sound.startMusic();
        else sound.stopMusic();
      }, { label: 'Âm lượng nhạc nền' }), { icon: 'music' }),
    ),
    group('Điều khiển',
      item('Rung khi chạm', toggle(s.haptics, (v) => {
        s.haptics = v;
        save();
      }, 'Rung khi chạm'), { icon: 'tremor', hint: 'Rung nhẹ khi thiết bị hỗ trợ' }),
      item('Thuận tay trái', toggle(s.leftHanded, (v) => {
        s.leftHanded = v;
        save();
      }, 'Thuận tay trái'), { icon: 'place', hint: 'Đưa nút ĐÁNH và thanh lực sang bên trái' }),
      item('Thông báo giữa bàn', toggle(s.herald, (v) => {
        s.herald = v;
        save();
      }, 'Thông báo giữa bàn'), { icon: 'info', hint: 'Tắt thì chỉ còn báo lỗi và thắng ván. Chạm bất kỳ đâu cũng đóng thông báo.' }),
    ),
    group('Hồ sơ',
      item('Tên cơ thủ', nameInput, { icon: 'user' }),
      item('Tướng đại diện', champBtn, { icon: 'users' }),
      item('Cấp', h('span.set-val', null, `${prog.level} · ${prog.into}/${prog.need} EXP`), { icon: 'trophy' }),
      item('Trận đã chơi', h('span.set-val', null, `${p.stats.played} trận · thắng ${p.stats.won}`), { icon: 'quick-match', hint: `Loạt ăn bi dài nhất: ${p.stats.bestRun}` }),
    ),
    group('Hướng dẫn',
      item('Giới thiệu Cơ Tiên Giới', btn('Xem lại', () => showIntro(app), 'ghost small'), { icon: 'story' }),
      item('Gợi ý cho người mới', btn('Hiện lại', () => {
        resetHints(app);
        toast('Gợi ý sẽ hiện lại trong trận tới', 'good');
      }, 'ghost small'), { icon: 'hint', hint: 'Hiện lại các mẹo trong trận' }),
    ),
    group('Dữ liệu',
      item('Sao lưu', btn('Lấy mã', backup, 'ghost small'), { icon: 'scroll', hint: 'Lấy mã để chuyển tiến trình sang máy khác' }),
      item('Khôi phục', btn('Nhập mã', restore, 'ghost small'), { icon: 'rewind', hint: 'Dán mã sao lưu để lấy lại tiến trình' }),
      item('Chơi lại từ đầu', btn('Xoá', wipe, 'danger small'), { icon: 'warning', hint: 'Xoá toàn bộ tiến trình trên máy này' }),
      item('Phiên bản', btn('Kiểm tra', () => {
        if (!import.meta.env.PROD) return toast('Bản phát triển luôn chạy mã mới nhất', 'good');
        dispatchEvent(new Event('cotien:check-update'));
      }, 'ghost small'), { icon: 'info', hint: __APP_VERSION__ }),
    ),
  );
  el.append(topbar(app, 'Cài đặt'), h('div.scroll.settings-scroll', null, col));
  return { el };
}
