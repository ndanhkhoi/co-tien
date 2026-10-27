import type { Personality } from '../../ai/types';
import { sound } from '../../audio/sound';
import { MODE_NAMES } from '../../core/rules';
import type { GameMode } from '../../core/rules/types';
import { CHAPTERS, LEVEL_NAMES, PERSONALITY_NAMES, type Npc } from '../../game/content/career';
import { CHALLENGES, challengeBalls, FAMILY_INFO, goalText, judgeChallenge, type ChallengeDef, type ChallengeFamily } from '../../game/content/challenges';
import { CUES, MUTATORS, TABLES, type CueDef, type MutatorId, type TableSkin } from '../../game/content/gear';
import {
  CHAMPION_PRICE, CHAMPIONS, champion, classInfo, cutoutUrl, sect, sectArtUrl, SECTS, skillIconUrl, type Champion,
} from '../../game/content/sects';
import { cueStats, tableStats, TABLE_NOTE, type StatLine } from '../../game/content/stat-text';
import { defaultProfile, exportCode, importCode, levelProgress } from '../../game/profile';
import { enterFullscreen, isTouchDevice, toggleFullscreen } from '../../platform/device';
import { screenEl, type App, type Screen } from '../app';
import { avatar } from '../avatar';
import { append, bar5, btn, h, iconBtn, modal, stars, tap, toast } from '../dom';
import { cueArt, icon } from '../icons';
import { showIntro } from '../intro';
import { resetHints } from '../hints';
import { codexScreen } from './codex';
import { journeyScreen } from './journey';
import { storyScreen } from './story';
import { matchScreen } from './match-screen';

// ---------- Shared bits ----------

export function topbar(app: App, title: string, back = true): HTMLElement {
  return h('div.topbar', null,
    back ? iconBtn(icon('back'), () => app.back(), 'Quay lại') : null,
    h('div.title', null, title),
    wallet(app),
  );
}

export function wallet(app: App): HTMLElement {
  return h('div.wallet', null, h('span.chip.gold', null, icon('coin'), app.profile.coins.toLocaleString('vi-VN')));
}

export function seg<T extends string | number>(options: [T, string][], value: T, onChange: (v: T) => void): HTMLElement {
  const box = h('div.seg');
  const render = (v: T) => {
    box.replaceChildren(...options.map(([k, label]) => tap(h('button', { class: k === v ? 'on' : '' }, label), () => {
      onChange(k);
      render(k);
    })));
  };
  render(value);
  return box;
}

// ---------- Player profile ----------

const hex6 = (n: number) => '#' + n.toString(16).padStart(6, '0');

/** Champion grid grouped by sect; locked champions are shown dimmed. */
function championPicker(app: App, selected: () => string, onPick: (c: Champion) => void, onlyOwned = false): HTMLElement {
  const wrap = h('div.col', { style: 'gap:10px' });
  const render = () => wrap.replaceChildren(...SECTS.map((s) => {
    const list = CHAMPIONS.filter((c) => c.sect === s.id && (!onlyOwned || app.profile.champions.includes(c.id)));
    if (!list.length) return null as unknown as HTMLElement;
    return h('div', null,
      // Ink title with the sect colour as a small seal, readable on paper.
      h('div.section-title.sect-title', { style: `--sect:${hex6(s.main)}` }, s.name),
      h('div.av-picker', null, ...list.map((c) => {
        const owned = app.profile.champions.includes(c.id);
        return tap(h('button.av-pick', { class: `${selected() === c.id ? 'on' : ''} ${owned ? '' : 'locked'}`, 'aria-label': c.name, title: c.name },
          avatar(c.id), owned ? null : h('span.lock', null, icon('lock'))), () => {
          onPick(c);
          render();
        });
      })),
    );
  }).filter(Boolean));
  render();
  return wrap;
}

/** Name + champion editor; shown on first launch and from the home profile card. */
function profileModal(app: App, onDone: () => void, first = false) {
  const p = app.profile;
  let name = p.name;
  let pick = p.champion;
  const preview = h('div.pm-preview', null, avatar(pick));
  const label = h('div.pm-char');
  const setLabel = () => {
    const c = champion(pick);
    label.textContent = `${c.name} · ${classInfo(c.cls).name}`;
  };
  setLabel();
  const input = h('input', {
    id: 'player-name', value: name, maxLength: 14, placeholder: 'Tên của bạn',
    oninput: (e: Event) => (name = (e.target as HTMLInputElement).value),
  }) as HTMLInputElement;
  modal((close) => h('div.modal', { style: 'width:min(760px,100%)' },
    h('h2', null, first ? 'Chào cơ thủ mới!' : 'Hồ sơ cơ thủ'),
    h('div.pm-body', null,
      h('div.pm-left', null, preview, label,
        h('label.section-title', { for: 'player-name', style: 'margin-top:6px' }, 'Tên hiển thị'), input),
      h('div.pm-right.scroll', null, h('div.muted.small', null, 'Chọn tướng đã chiêu mộ. Thắng tướng khác ở Sự Nghiệp hoặc mua trong Bộ Sưu Tập để mở thêm.'),
        championPicker(app, () => pick, (c) => {
          pick = c.id;
          preview.replaceChildren(avatar(c.id));
          setLabel();
        }, true)),
    ),
    h('div.actions', null, btn(first ? 'Vào game' : 'Lưu', () => {
      p.name = name.trim().slice(0, 14) || 'Cơ Thủ';
      p.champion = pick;
      p.named = true;
      app.save();
      close();
      onDone();
    })),
  ));
  if (!first) setTimeout(() => input.focus(), 50);
}

/** One stat sheet row: label, optional 1–5 bar, value and what it does. */
export function statRows(lines: StatLine[]): HTMLElement {
  return h('div.stat-sheet', null, ...lines.map((l) => h('div.st-row', null,
    h('div.st-head', null, h('b', null, l.label), l.bar ? bar5(l.bar) : null, h('span.st-val', null, l.value)),
    h('div.st-exp', null, l.explain),
  )));
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
      ? (p.champion === c.id ? btn('Đang dùng', () => {}, 'ghost') : btn('Chọn tướng', () => {
        p.champion = c.id;
        app.save();
        close();
        onChange?.();
      }))
      : btn(h('span', null, icon('coin'), ` Chiêu mộ ${price.toLocaleString('vi-VN')}`), () => {
        if (p.coins < price) return toast('Không đủ xu — hoặc thắng tướng này ở Sự Nghiệp', 'bad');
        p.coins -= price;
        p.champions.push(c.id);
        app.save();
        toast(`Đã chiêu mộ ${c.name}`, 'gold');
        close();
        onChange?.();
      });
    return h('div.modal.champ-modal', { style: `--sect:${hex6(s.main)};--glow:${hex6(s.glow)}` },
      h('div.cm-art', null, h('img', { src: cutoutUrl(c.id), alt: '', draggable: false, decoding: 'async' })),
      h('div.cm-body.scroll', null,
        h('div.cm-sect', null, h('img', { src: sectArtUrl(c.sect, 'emblem'), alt: '' }), s.name),
        h('h2', null, c.name),
        h('div.row', { style: 'gap:6px;flex-wrap:wrap' }, h('span.chip', null, `Bậc ${c.tier}`), h('span.chip.gold', null, cls.name)),
        h('div.cm-passive', null, h('b', null, `Nội tại ${cls.name}: `), cls.passive),
        ...c.skills.map((sk) => h('div.cm-skill', { class: sk.slot === 2 ? 'ult' : '' },
          h('img', { src: skillIconUrl(c.id, sk.slot), alt: '' }),
          h('div.grow', null,
            h('div.row', { style: 'gap:6px' }, h('b', null, sk.name), h('span.chip.small', null, sk.slot === 2 ? 'Tuyệt chiêu · đầy năng lượng' : `Hồi ${sk.cooldown} cú`)),
            h('div.small', null, sk.desc),
          ),
        )),
        h('div.muted.small', null, 'Chiêu và nội tại có ở chế độ Tiên Đạo với mọi thể loại. Trên bàn phăng (không lỗ), chiêu liên quan đến lỗ tự đổi: phong ấn lỗ → làm run, nuốt chửng → áp phê thần, hấp dẫn → tiên tri, bộc phá → cuồng lực, dịch chuyển → dời bi.'),
        h('div.actions', null, btn('Đóng', close, 'ghost'), action),
      ),
    );
  }, { dismissable: true });
}

// ---------- Splash ----------

export function splashScreen(app: App): Screen {
  const el = screenEl('splash');
  const base = new URL(import.meta.env.BASE_URL, document.baseURI).href;
  el.style.setProperty('--keyart', `url("${base}art/ui/keyart.webp")`);
  el.style.setProperty('--keyart-tall', `url("${base}art/ui/keyart-portrait.webp")`);
  el.append(
    h('img.logo-art', { src: `${base}art/ui/logo.webp`, alt: 'Cơ Tiên', draggable: false }),
    h('div.tap-hint', null, 'Chạm để bắt đầu'),
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
  const el = screenEl();
  const p = app.profile;
  const prog = levelProgress(p.xp);
  const profileChip = tap(h('button.profile-chip', { 'aria-label': 'Sửa hồ sơ' },
    h('div.home-av', null, avatar(p.champion)),
    h('div.lvl', null, String(prog.level)),
    h('div', null, h('div.pname', null, p.name), h('div.xpbar', null, h('i', { style: `width:${(prog.into / prog.need) * 100}%` }))),
    icon('pencil', 'pc-edit'),
  ), () => profileModal(app, () => app.go(homeScreen, { replace: true })));
  // First run: world introduction, then name and champion.
  if (!p.introSeen) setTimeout(() => showIntro(app, () => !p.named && profileModal(app, () => app.go(homeScreen, { replace: true }), true)), 350);
  else if (!p.named) setTimeout(() => profileModal(app, () => app.go(homeScreen, { replace: true }), true), 350);
  const beaten = Object.keys(p.career).length;
  const chDone = Object.keys(p.challenges).length;
  // A vertical ink menu on the left, the painting and the player's champion on the right.
  const item = (name: string, desc: string, fn: () => void) =>
    tap(h('button.menu-item', null, h('span.mi-name', null, name), h('span.mi-desc', null, desc)), fn);
  const base = new URL(import.meta.env.BASE_URL, document.baseURI).href;
  el.classList.add('home');
  el.style.setProperty('--home-bg', `url("${base}art/ui/home-bg.webp")`);
  el.append(
    h('div.topbar.home-top', null, h('div.grow'), profileChip, wallet(app),
      isTouchDevice() ? null : iconBtn(icon('expand'), () => void toggleFullscreen(), 'Toàn màn hình'),
      iconBtn(icon('gear'), () => app.go(settingsScreen), 'Cài đặt')),
    h('div.home-body', null,
      h('nav.home-menu', null,
        h('img.home-logo', { src: `${base}art/ui/logo.webp`, alt: 'Cơ Tiên', draggable: false }),
        item('Hành trình', `${beaten}/${CHAMPIONS.length} cao thủ · ${chDone}/${CHALLENGES.length} thử thách`, () => app.go(journeyScreen)),
        item('Đấu nhanh', 'Chọn thể loại và đối thủ', () => app.go(quickScreen)),
        item('Hai người', 'Chơi chung một máy', () => app.go(localScreen)),
        item('Bộ sưu tập', `${p.champions.length}/${CHAMPIONS.length} tướng · cơ · bàn`, () => app.go(collectionScreen)),
        item('Truyện', 'Cơ Tiên Truyện · 15 chương có tranh', () => app.go(storyScreen)),
        item('Cơ Tiên Lục', 'Vùng đất · tướng · luật chơi', () => app.go(codexScreen)),
      ),
      h('div.home-hero', null, h('img', { src: cutoutUrl(p.champion), alt: '', draggable: false, decoding: 'async' })),
    ),
  );
  return { el };
}

// ---------- Quick play / Local ----------

function setupScreen(app: App, local: boolean): Screen {
  const el = screenEl();
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
  const left = h('div.col.grow.scroll', { style: 'padding-right:4px' });
  const isCarom = () => st.mode.startsWith('carom');
  const render = () => {
    left.replaceChildren();
    append(left, [
      h('div.section-title', null, 'Chế độ'),
      seg([['tc', 'Tiên Đạo · có chiêu'], ['cd', 'Cổ Điển · bida thuần']], st.classic ? 'cd' : 'tc', (v) => (st.classic = v === 'cd')),
      h('div.section-title', null, 'Thể loại'),
      seg(Object.entries(MODE_NAMES) as [GameMode, string][], st.mode, (v) => {
        st.mode = v;
        st.points = v === 'carom-3c' ? 5 : 10;
        render();
      }),
      ...(local ? [
        h('div.section-title', null, 'Tên người chơi 2'),
        h('input', {
          value: st.name2, maxLength: 14,
          oninput: (e: Event) => (st.name2 = (e.target as HTMLInputElement).value || 'Người chơi 2'),
        }),
      ] : [
        h('div.section-title', null, 'Đối thủ'),
        seg([[1, LEVEL_NAMES[1]], [2, LEVEL_NAMES[2]], [3, LEVEL_NAMES[3]], [4, LEVEL_NAMES[4]]], st.level, (v) => (st.level = v)),
        h('div.section-title', null, 'Lối đánh'),
        seg(Object.entries(PERSONALITY_NAMES) as [Personality, string][], st.pers, (v) => (st.pers = v)),
      ]),
      h('div.section-title', null, isCarom() ? 'Điểm mỗi ván · số ván thắng' : 'Số ván thắng'),
      isCarom() ? h('div.row', null,
        seg(st.mode === 'carom-3c' ? [[3, '3 điểm'], [5, '5 điểm'], [10, '10 điểm']] : [[5, '5 điểm'], [10, '10 điểm'], [15, '15 điểm']], st.points, (v) => (st.points = v)),
      ) : null,
      seg([[1, 'Chạm 1'], [2, 'Chạm 2'], [3, 'Chạm 3'], [5, 'Chạm 5']], st.race, (v) => (st.race = v)),
      ...(isCarom() ? [] : [
        h('div.section-title', null, 'Biến thể bàn'),
        seg([['none', 'Không'], ...MUTATORS.map((m) => [m.id, m.name] as [string, string])], st.mutator ?? 'none', (v) => (st.mutator = v === 'none' ? null : (v as MutatorId))),
      ]),
    ]);
  };
  render();
  const me = champion(app.profile.champion);
  const right = h('div.panel.col', { style: 'width:min(260px,38vw);padding:14px;justify-content:space-between' },
    h('div.col', null,
      h('div.section-title', null, 'Tướng & trang bị'),
      h('div.row', { style: 'gap:10px' }, h('div', { style: 'width:52px;height:52px;border-radius:14px;overflow:hidden;flex-shrink:0' }, avatar(me.id)),
        h('div', null, h('b', null, me.name), h('div.muted.small', null, classInfo(me.cls).name))),
      h('div.row', { style: 'gap:6px' }, ...me.skills.map((sk) => h('img.skill-mini', { src: skillIconUrl(me.id, sk.slot), alt: sk.name, title: sk.name }))),
      h('div', { style: 'font-weight:800' }, app.cue.name),
      cueArt(app.cue.colors),
      h('div.muted.small', null, app.tableSkin.name),
    ),
    btn(h('span', null, icon('play'), ' Vào trận'), () => start(), 'green'),
  );
  el.append(topbar(app, local ? '2 Người · cùng máy' : 'Đấu Nhanh'), h('div.body', null, left, right));

  function start() {
    // AI opponents: a champion whose tier fits the level, with a cue from their own sect.
    // Never the player's own champion: no mirror matches.
    const pool = CHAMPIONS.filter((c) => c.id !== me.id && (local ? app.profile.champions.includes(c.id) : Math.abs(c.tier - (st.level + 1)) <= 1));
    const foe = pool[Math.floor(Math.random() * pool.length)] ?? CHAMPIONS[1];
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
      label: local ? '2 người' : 'Đấu nhanh',
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

// ---------- Career ----------

export function careerScreen(app: App): Screen {
  const el = screenEl();
  const row = h('div.chapters');
  const all = CHAPTERS.flatMap((c) => c.npcs);
  const unlocked = (n: Npc) => {
    const i = all.indexOf(n);
    return i === 0 || app.profile.career[all[i - 1].id] !== undefined;
  };
  for (const ch of CHAPTERS) {
    const box = h('div.chapter', null,
      h('div.ch-head', { style: `--sect:${hex6(sect(ch.id).main)}` }, h('img.ch-emblem', { src: sectArtUrl(ch.id, 'emblem'), alt: '' }),
        h('div', null, h('div.place', null, `Chương ${CHAPTERS.indexOf(ch) + 1}`), h('h3', null, ch.name), h('div.muted.small', { style: 'margin-top:4px' }, ch.desc))),
    );
    for (const n of ch.npcs) {
      const open = unlocked(n);
      const best = app.profile.career[n.id] ?? 0;
      const card = h('button.npc', { class: open ? '' : 'locked' },
        h('div.av', null, avatar(n.id)),
        h('div.grow', null,
          h('div.nm', null, n.name),
          h('div.tt', null, `${n.title} · ${MODE_NAMES[n.mode]}`),
          h('div.tt', null, `${LEVEL_NAMES[n.level]}${n.mutator ? ' · ' + MUTATORS.find((m) => m.id === n.mutator)!.name : ''}`),
        ),
        open ? stars(best) : icon('lock'),
      );
      tap(card, () => (open ? npcModal(app, n) : toast('Thắng đối thủ trước để mở khóa', 'bad')));
      box.append(card);
    }
    row.append(box);
  }
  const scroller = h('div.scroll', { style: 'overflow-x:auto;overflow-y:hidden;touch-action:pan-x;flex:1;min-height:0' }, row);
  el.append(topbar(app, 'Sự Nghiệp'), h('div.body', { style: 'flex-direction:column' }, scroller));
  return { el };
}

export function npcModal(app: App, n: Npc) {
  modal((close) => h('div.modal', null,
    h('div.row', { style: 'gap:14px' },
      h('div', { style: 'width:84px;height:84px;border-radius:20px;overflow:hidden;flex-shrink:0' }, avatar(n.id)),
      h('div.grow', null,
        h('h2', null, n.name),
        h('div.muted', { style: 'font-weight:700' }, n.title),
        h('div.small', { style: 'margin-top:4px;font-weight:700' }, `${MODE_NAMES[n.mode]} · chạm ${n.raceTo}${n.caromTarget ? ` · ${n.caromTarget} điểm/ván` : ''} · ${LEVEL_NAMES[n.level]} · ${PERSONALITY_NAMES[n.personality]}`),
      ),
    ),
    h('div', { style: 'font-style:italic;font-weight:600;line-height:1.5' }, `“${n.intro}”`),
    n.mutator ? h('div.chip', null, `Biến thể: ${MUTATORS.find((m) => m.id === n.mutator)!.name} — ${MUTATORS.find((m) => m.id === n.mutator)!.desc}`) : null,
    h('div.row', null, h('span.chip.gold', null, icon('coin'), `+${n.coins}`), h('span.chip', null, `+${n.xp} EXP`),
      app.profile.champions.includes(n.id) ? null : h('span.chip', null, `Thắng để chiêu mộ ${n.name}`)),
    h('div.small.muted', null, `Bàn: ${tableOf(n).name}`),
    h('div.actions', null,
      btn('Để sau', close, 'ghost'),
      btn('Thách đấu', () => {
        close();
        startCareer(app, n);
      }),
    ),
  ), { dismissable: true });
}

const tableOf = (n: Npc): TableSkin => TABLES.find((t) => t.id === n.sect) ?? TABLES[0];

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
    label: 'Sự nghiệp',
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
        lines: [`${n.name}: “${n.loseLine}”`, `${'★'.repeat(st)}${'☆'.repeat(3 - st)}`, `+${coins} xu · +${n.xp} EXP`, ...(up ? [`Lên cấp ${app.level}!`] : []), ...(recruit ? [`Chiêu mộ được ${n.name}!`] : [])],
        again,
      };
    },
  });
  app.go(launch);
}

// ---------- Challenges ----------

export function challengesScreen(app: App): Screen {
  const el = screenEl();
  let fam: ChallengeFamily = 'straight';
  const grid = h('div.ch-grid');
  const info = h('div.muted.small');
  const render = () => {
    const list = CHALLENGES.filter((c) => c.family === fam);
    info.textContent = FAMILY_INFO[fam].desc;
    grid.replaceChildren(...list.map((c, i) => {
      const best = app.profile.challenges[c.id] ?? 0;
      const open = i === 0 || (app.profile.challenges[list[i - 1].id] ?? 0) > 0;
      const cell = h('button.ch-cell', { class: `${best ? 'done' : ''} ${open ? '' : 'locked'}` }, String(i + 1), open ? stars(best) : icon('lock'));
      return tap(cell, () => (open ? startChallenge(app, c) : toast('Hoàn thành thử thách trước để mở', 'bad')));
    }));
  };
  const tabs = seg(Object.entries(FAMILY_INFO).map(([k, v]) => [k as ChallengeFamily, v.name]), fam, (v) => {
    fam = v;
    render();
  });
  render();
  el.append(topbar(app, 'Thử Thách'), h('div.body', { style: 'flex-direction:column;gap:10px' }, tabs, info, h('div.scroll', { style: 'flex:1;min-height:0' }, grid)));
  return { el };
}

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
        { name: 'Thử thách', kind: 'human', cue: app.cue, champion: app.profile.champion },
      ],
      layout: challengeBalls(c),
      judge: (shot, balls) => judgeChallenge(c, shot, balls),
    },
    label: `${FAMILY_INFO[c.family].name} ${idx + 1}`,
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
        return { stars: st, next: next ? () => startChallengeReplace(app, next) : undefined };
      },
    },
    onExit: () => app.pop(),
  });
  app.go(launch);
}

function startChallengeReplace(app: App, c: ChallengeDef) {
  app.pop();
  setTimeout(() => startChallenge(app, c), 60);
}

// ---------- Collection ----------

export function collectionScreen(app: App): Screen {
  const el = screenEl();
  let tab: 'champ' | 'cue' | 'table' = 'champ';
  const content = h('div.scroll', { style: 'flex:1;min-height:0' });
  const lv = app.level;
  const p = app.profile;
  const refreshWallet = () => {
    el.querySelector('.wallet')?.replaceWith(wallet(app));
  };
  const render = () => {
    content.replaceChildren();
    if (tab === 'champ') {
      content.append(h('div.muted.small', { style: 'margin-bottom:8px' }, `Đã chiêu mộ ${p.champions.length}/${CHAMPIONS.length}. Chạm vào tướng để xem nội tại và 3 chiêu.`),
        championPicker(app, () => p.champion, (c) => championModal(app, c, () => {
          refreshWallet();
          render();
        })));
      return;
    }
    const grid = h('div', { style: 'display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px' });
    if (tab === 'cue') {
      content.append(h('div.muted.small', { style: 'margin-bottom:8px' }, 'Mọi cây cơ đều hiện đường ngắm và bi ảo. Chỉ số chỉ thay đổi những gì ghi bên dưới.'));
      for (const c of CUES) grid.append(gearCard(c, c.colors ? cueArt(c.colors) : null, cueStats(c), p.cues.includes(c.id), p.cue === c.id, () => {
        if (!p.cues.includes(c.id)) p.cues.push(c.id);
        p.cue = c.id;
      }));
    } else {
      content.append(h('div.muted.small', { style: 'margin-bottom:8px' }, TABLE_NOTE));
      for (const t of TABLES) {
        const preview = h('div', { style: `height:74px;border-radius:12px;margin:8px 0;border:9px solid ${hex6(t.rail)};background:radial-gradient(circle at 50% 40%, ${hex6(t.cloth)}, ${hex6(t.clothDark)});box-shadow:inset 0 0 0 2px rgba(0,0,0,0.3)` });
        grid.append(gearCard(t, preview, tableStats(t), p.tables.includes(t.id), p.table === t.id, () => {
          if (!p.tables.includes(t.id)) p.tables.push(t.id);
          p.table = t.id;
        }));
      }
    }
    content.append(grid);
  };
  function gearCard(item: CueDef | TableSkin, art: Element | null, stats: StatLine[], owned: boolean, eq: boolean, take: () => void): HTMLElement {
    const locked = !owned && lv < item.level;
    return h('div.card', { class: `${eq ? 'sel' : ''} ${locked ? 'locked' : ''}` },
      h('div.row', null, h('b.grow', null, item.name), owned ? (eq ? h('span.chip.gold', null, 'Đang dùng') : null) : h('span.chip.gold', null, icon('coin'), item.price.toLocaleString('vi-VN'))),
      art ? h('div', { style: 'margin:8px 0' }, art) : null,
      h('div.muted.small', { style: 'margin-bottom:6px' }, item.desc),
      statRows(stats),
      h('div', { style: 'margin-top:8px' }, cardAction(owned, eq, locked, item.level, item.price, () => {
        if (!owned) {
          p.coins -= item.price;
          toast(`Đã mua ${item.name}`, 'gold');
        }
        take();
        app.save();
        refreshWallet();
        render();
      })),
    );
  }
  function cardAction(owned: boolean, eq: boolean, locked: boolean, level: number, price: number, act: () => void) {
    if (eq) return btn('Đã trang bị', () => {}, 'ghost small');
    if (owned) return btn('Trang bị', act, 'small');
    if (locked) return btn(h('span', null, icon('lock'), ` Cấp ${level}`), () => toast(`Đạt cấp ${level} để mở khóa`, 'bad'), 'ghost small');
    return btn('Mua', () => (p.coins >= price ? act() : toast('Không đủ xu', 'bad')), 'small');
  }
  const tabs = seg([['champ', 'Tướng'], ['cue', 'Cơ'], ['table', 'Bàn']], tab, (v) => {
    tab = v;
    render();
  });
  render();
  el.append(topbar(app, 'Bộ Sưu Tập'), h('div.body', { style: 'flex-direction:column;gap:10px' }, tabs, content));
  return { el };
}

// ---------- Settings ----------

export function settingsScreen(app: App): Screen {
  const el = screenEl();
  const p = app.profile;
  const s = p.settings;
  const save = () => {
    app.save();
    app.applySettings();
  };
  const toggle = (on: boolean, fn: (v: boolean) => void) => {
    const t = h('button.toggle', { class: on ? 'on' : '' });
    return tap(t, () => {
      on = !on;
      t.classList.toggle('on', on);
      fn(on);
      save();
    });
  };
  const slider = (v: number, fn: (v: number) => void) =>
    h('input', { type: 'range', min: '0', max: '1', step: '0.05', value: String(v), oninput: (e: Event) => {
      fn(parseFloat((e.target as HTMLInputElement).value));
      save();
    } });
  const line = (label: string, ctl: Element, sub = '') =>
    h('div.kv', { style: 'align-items:center;gap:12px' }, h('div.grow', null, h('div', null, label), sub ? h('div.muted.small', { style: 'font-weight:600' }, sub) : null), ctl);
  const nameInput = h('input', {
    value: p.name, maxLength: 14,
    style: 'width:170px',
    onchange: (e: Event) => {
      p.name = ((e.target as HTMLInputElement).value || 'Cơ Thủ').slice(0, 14);
      save();
    },
  });
  const prog = levelProgress(p.xp);
  const champBtn = btn(h('span', null, champion(p.champion).name), () => profileModal(app, () => app.go(settingsScreen, { replace: true })), 'ghost small');
  const left = h('div.panel.scroll', { style: 'flex:1;padding:6px 16px;min-height:0' },
    line('Tên cơ thủ', nameInput),
    line('Tướng đại diện', champBtn),
    line('Hiệu ứng âm thanh', slider(s.sfx, (v) => {
      s.sfx = v;
      sound.tap();
    })),
    line('Nhạc nền', slider(s.music, (v) => {
      s.music = v;
      if (v > 0) sound.startMusic();
      else sound.stopMusic();
    })),
    line('Rung khi chạm', toggle(s.haptics, (v) => (s.haptics = v)), 'Android hỗ trợ rung; iPhone không cho web rung.'),
    line('Thuận tay trái', toggle(s.leftHanded, (v) => (s.leftHanded = v)), 'Đảo nút ĐÁNH sang bên trái'),
    line('Giới thiệu Cơ Tiên Giới', btn('Xem lại', () => showIntro(app), 'ghost small')),
    line('Gợi ý cho người mới', btn('Hiện lại', () => {
      resetHints(app);
      toast('Gợi ý sẽ hiện lại trong trận tới', 'good');
    }, 'ghost small')),
  );
  const right = h('div.panel.col', { style: 'width:min(300px,42vw);padding:14px' },
    h('div.section-title', null, 'Hồ sơ'),
    h('div.kv', null, h('span', null, 'Cấp'), h('b', null, `${prog.level} (${prog.into}/${prog.need} EXP)`)),
    h('div.kv', null, h('span', null, 'Trận / thắng'), h('b', null, `${p.stats.played} / ${p.stats.won}`)),
    h('div.kv', null, h('span', null, 'Loạt ăn dài nhất'), h('b', null, String(p.stats.bestRun))),
    h('div.kv', null, h('span', null, 'Phiên bản'), h('b.small', null, __APP_VERSION__)),
    btn('Xuất mã lưu', () => {
      const code = exportCode(p);
      void navigator.clipboard?.writeText(code).then(() => toast('Đã chép mã lưu', 'good'), () => {});
      modal((close) => h('div.modal', null, h('h2', null, 'Mã lưu'), h('textarea', { readOnly: true, value: code }), h('div.actions', null, btn('Đóng', close))), { dismissable: true });
    }, 'ghost small'),
    btn('Nhập mã lưu', () => {
      const ta = h('textarea', { placeholder: 'Dán mã TC1.… vào đây' });
      modal((close) => h('div.modal', null, h('h2', null, 'Nhập mã lưu'), ta, h('div.actions', null,
        btn('Hủy', close, 'ghost'),
        btn('Nhập', () => {
          const np = importCode((ta as HTMLTextAreaElement).value);
          if (!np) return toast('Mã không hợp lệ', 'bad');
          Object.assign(p, np);
          save();
          close();
          toast('Đã khôi phục tiến trình', 'good');
          app.go(homeScreen, { reset: true });
        }),
      )));
    }, 'ghost small'),
    btn('Xóa tiến trình', () => {
      modal((close) => h('div.modal', null, h('h2', null, 'Xóa toàn bộ?'), h('div', null, 'Mọi cấp độ, xu, cơ và sự nghiệp sẽ bị xóa.'), h('div.actions', null,
        btn('Hủy', close, 'ghost'),
        btn('Xóa', () => {
          Object.assign(p, defaultProfile());
          save();
          close();
          app.go(homeScreen, { reset: true });
        }, 'red'),
      )));
    }, 'red small'),
  );
  el.append(topbar(app, 'Cài Đặt'), h('div.body', null, left, right));
  return { el };
}
