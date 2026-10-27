import type { Personality } from '../../ai/types';
import { sound } from '../../audio/sound';
import { maxSpeed } from '../../core/cue-power';
import { MODE_NAMES } from '../../core/rules';
import type { GameMode } from '../../core/rules/types';
import { CHAPTERS, LEVEL_NAMES, PERSONALITY_NAMES, type Npc } from '../../game/content/career';
import { CHALLENGES, challengeBalls, FAMILY_INFO, goalText, judgeChallenge, type ChallengeDef, type ChallengeFamily } from '../../game/content/challenges';
import { CUES, MUTATORS, SKILLS, TABLES, type MutatorId, type SkillId } from '../../game/content/gear';
import { defaultProfile, exportCode, importCode, levelProgress } from '../../game/profile';
import { enterFullscreen, isTouchDevice, toggleFullscreen } from '../../platform/device';
import { screenEl, type App, type Screen } from '../app';
import { AI_LOOKS, avatar, GUEST_LOOK, PLAYER_LOOK } from '../avatar';
import { append, bar5, btn, h, iconBtn, modal, stars, tap, toast } from '../dom';
import { ballArt, cueArt, icon, skillIcon } from '../icons';
import { matchScreen } from './match-screen';

// ---------- Shared bits ----------

function topbar(app: App, title: string, back = true): HTMLElement {
  return h('div.topbar', null,
    back ? iconBtn(icon('back'), () => app.back(), 'Quay lại') : null,
    h('div.title', null, title),
    wallet(app),
  );
}

function wallet(app: App): HTMLElement {
  return h('div.wallet', null, h('span.chip.gold', null, icon('coin'), app.profile.coins.toLocaleString('vi-VN')));
}

function seg<T extends string | number>(options: [T, string][], value: T, onChange: (v: T) => void): HTMLElement {
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

// ---------- Splash ----------

export function splashScreen(app: App): Screen {
  const el = screenEl('splash');
  const ball = ballArt(8, 150);
  ball.classList.add('ball8');
  el.append(
    ball,
    h('div.logo', null, h('span.l1', null, 'Thần Công'), h('span.l2', null, 'Bida')),
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
  const profileChip = h('div.profile-chip', null,
    h('div.lvl', null, String(prog.level)),
    h('div', null, h('div.pname', null, p.name), h('div.xpbar', null, h('i', { style: `width:${(prog.into / prog.need) * 100}%` }))),
  );
  let n = 0;
  const tile = (name: string, desc: string, art: Element | null, c1: string, fn: () => void, big = false) => {
    n++;
    const t = h('button.tile', { class: big ? 'big' : '', style: `--c1:${c1}` }, h('span.idx', null, String(n).padStart(2, '0')), art, h('div.name', null, name), h('div.desc', null, desc));
    return tap(t, fn);
  };
  const beaten = Object.keys(p.career).length;
  const chDone = Object.keys(p.challenges).length;
  const careerArt = h('div.art', { style: 'aspect-ratio:1' }, ballArt(8, 220));
  el.append(
    h('div.topbar', null, profileChip, h('div.grow'), wallet(app),
      isTouchDevice() ? null : iconBtn(icon('expand'), () => void toggleFullscreen(), 'Toàn màn hình'),
      iconBtn(icon('gear'), () => app.go(settingsScreen), 'Cài đặt')),
    h('div.home-grid', { style: 'margin-top:10px' },
      tile('Sự Nghiệp', `${beaten}/15 đối thủ · 5 chương`, careerArt, '#ffc531', () => app.go(careerScreen), true),
      tile('Đấu Nhanh', 'Chọn thể loại & đối thủ', h('div.art', null, ballArt(9, 120)), '#17a673', () => app.go(quickScreen)),
      tile('Thử Thách', `${chDone}/60 đã qua`, h('div.art', null, ballArt(3, 120)), '#ef4444', () => app.go(challengesScreen)),
      tile('2 Người', 'Chơi chung một máy', h('div.art', null, ballArt(10, 120)), '#38bdf8', () => app.go(localScreen)),
      tile('Bộ Sưu Tập', 'Cơ · Bàn · Kỹ năng', h('div.art', null, ballArt(12, 120)), '#a78bfa', () => app.go(collectionScreen)),
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
  };
  const left = h('div.col.grow.scroll', { style: 'padding-right:4px' });
  const isCarom = () => st.mode.startsWith('carom');
  const render = () => {
    left.replaceChildren();
    append(left, [
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
  const right = h('div.panel.col', { style: 'width:min(260px,38vw);padding:14px;justify-content:space-between' },
    h('div.col', null,
      h('div.section-title', null, 'Trang bị'),
      h('div', { style: 'font-weight:800' }, app.cue.name),
      cueArt(app.cue.colors),
      h('div.muted.small', null, `Bàn: ${app.tableSkin.name}`),
      local ? h('div.muted.small', null, 'Chế độ 2 người không dùng kỹ năng.') : h('div.row', { style: 'gap:6px;flex-wrap:wrap' },
        ...app.profile.skills.map((id) => h('span.chip', null, skillIcon(id), SKILLS.find((s) => s.id === id)!.name)),
      ),
    ),
    btn(h('span', null, icon('play'), ' Vào trận'), () => start(), 'green'),
  );
  el.append(topbar(app, local ? '2 Người · cùng máy' : 'Đấu Nhanh'), h('div.body', null, left, right));

  function start() {
    const me = { name: app.profile.name, kind: 'human' as const, cue: app.cue, skills: local ? [] : app.profile.skills, avatar: 'player' };
    const look2 = local ? GUEST_LOOK : AI_LOOKS[st.level - 1];
    const opp = local
      ? { name: st.name2.slice(0, 14), kind: 'human' as const, cue: app.cue, skills: [], avatar: 'guest' }
      : { name: `Máy ${LEVEL_NAMES[st.level]}`, kind: 'ai' as const, ai: { level: st.level, personality: st.pers }, cue: CUES[Math.min(5, st.level)], skills: (st.level >= 3 ? ['shield', 'tremor'] : st.level === 2 ? ['shield'] : []) as SkillId[], avatar: 'ai' };
    const again = () => app.go(launch, { replace: true });
    const launch = matchScreen({
      setup: {
        mode: st.mode, raceTo: st.race, players: [me, opp], mutator: isCarom() ? null : st.mutator,
        tableSkin: app.tableSkin, caromTarget: st.points, firstBreaker: Math.random() < 0.5 ? 0 : 1,
      },
      looks: [PLAYER_LOOK, look2],
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
      h('div', null, h('div.place', null, ch.place), h('h3', null, ch.name), h('div.muted.small', { style: 'margin-top:4px' }, ch.desc)),
    );
    for (const n of ch.npcs) {
      const open = unlocked(n);
      const best = app.profile.career[n.id] ?? 0;
      const card = h('button.npc', { class: open ? '' : 'locked' },
        h('div.av', null, avatar(n.look)),
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

function npcModal(app: App, n: Npc) {
  modal((close) => h('div.modal', null,
    h('div.row', { style: 'gap:14px' },
      h('div', { style: 'width:84px;height:84px;border-radius:20px;overflow:hidden;flex-shrink:0' }, avatar(n.look)),
      h('div.grow', null,
        h('h2', null, n.name),
        h('div.muted', { style: 'font-weight:700' }, n.title),
        h('div.small', { style: 'margin-top:4px;font-weight:700' }, `${MODE_NAMES[n.mode]} · chạm ${n.raceTo}${n.caromTarget ? ` · ${n.caromTarget} điểm/ván` : ''} · ${LEVEL_NAMES[n.level]} · ${PERSONALITY_NAMES[n.personality]}`),
      ),
    ),
    h('div', { style: 'font-style:italic;font-weight:600;line-height:1.5' }, `“${n.intro}”`),
    n.mutator ? h('div.chip', null, `Biến thể: ${MUTATORS.find((m) => m.id === n.mutator)!.name} — ${MUTATORS.find((m) => m.id === n.mutator)!.desc}`) : null,
    h('div.row', null, h('span.chip.gold', null, icon('coin'), `+${n.coins}`), h('span.chip', null, `+${n.xp} EXP`)),
    h('div.actions', null,
      btn('Để sau', close, 'ghost'),
      btn('Thách đấu', () => {
        close();
        startCareer(app, n);
      }),
    ),
  ), { dismissable: true });
}

function startCareer(app: App, n: Npc) {
  const cue = CUES.find((c) => c.id === n.cueId) ?? CUES[0];
  const launch = matchScreen({
    setup: {
      mode: n.mode, raceTo: n.raceTo, mutator: n.mutator, tableSkin: app.tableSkin, caromTarget: n.caromTarget,
      firstBreaker: 0,
      players: [
        { name: app.profile.name, kind: 'human', cue: app.cue, skills: app.profile.skills, avatar: 'player' },
        { name: n.name, kind: 'ai', ai: { level: n.level, personality: n.personality }, cue, skills: n.skills, avatar: n.id },
      ],
    },
    looks: [PLAYER_LOOK, n.look],
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
      const unlockCue = n.id === 'thancong' && !p.cues.includes('thancong');
      if (unlockCue) p.cues.push('thancong');
      const up = app.reward(coins, n.xp);
      return {
        lines: [`${n.name}: “${n.loseLine}”`, `${'★'.repeat(st)}${'☆'.repeat(3 - st)}`, `+${coins} xu · +${n.xp} EXP`, ...(up ? [`Lên cấp ${app.level}!`] : []), ...(unlockCue ? ['Nhận cơ Thần Công!'] : [])],
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

function startChallenge(app: App, c: ChallengeDef) {
  const list = CHALLENGES.filter((x) => x.family === c.family);
  const idx = list.indexOf(c);
  const mode: GameMode = c.table === 'carom' ? (c.goal.kind === 'carom' && c.goal.three ? 'carom-3c' : 'carom-libre') : 'eight';
  const launch = matchScreen({
    setup: {
      mode, raceTo: 1, mutator: null, tableSkin: app.tableSkin,
      players: [
        { name: app.profile.name, kind: 'human', cue: app.cue, skills: [], avatar: 'player' },
        { name: 'Thử thách', kind: 'human', cue: app.cue, skills: [], avatar: 'none' },
      ],
      layout: challengeBalls(c),
      judge: (shot, balls) => judgeChallenge(c, shot, balls),
    },
    looks: [PLAYER_LOOK, GUEST_LOOK],
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
  let tab: 'cue' | 'table' | 'skill' = 'cue';
  const content = h('div.scroll', { style: 'flex:1;min-height:0' });
  const lv = app.level;
  const p = app.profile;
  const refreshWallet = () => {
    el.querySelector('.wallet')?.replaceWith(wallet(app));
  };
  const render = () => {
    content.replaceChildren();
    const grid = h('div', { style: 'display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:10px' });
    if (tab === 'cue') {
      for (const c of CUES) {
        const owned = p.cues.includes(c.id);
        const eq = p.cue === c.id;
        const locked = !owned && lv < c.level;
        const card = h('div.card', { class: `${eq ? 'sel' : ''} ${locked ? 'locked' : ''}` },
          h('div.row', null, h('b.grow', null, c.name), owned ? (eq ? h('span.chip.gold', null, 'Đang dùng') : null) : h('span.chip.gold', null, icon('coin'), c.price.toLocaleString('vi-VN'))),
          h('div', { style: 'margin:8px 0' }, cueArt(c.colors)),
          h('div.stats', null,
            'Lực', bar5(c.power), 'Ngắm', bar5(c.aim), 'Phê', bar5(c.spin), 'Vững tay', bar5(c.control), 'Năng lượng', bar5(c.energy),
          ),
          h('div.muted.small', { style: 'margin-top:6px' }, `${c.desc} · Tốc độ tối đa ${maxSpeed('pool', c.power).toFixed(1)} m/s`),
          h('div', { style: 'margin-top:8px' }, cardAction(owned, eq, locked, c.level, c.price, () => {
            if (!owned) {
              if (c.id === 'thancong') return toast('Đánh bại Thần Công ở Sự Nghiệp để nhận', 'bad');
              p.coins -= c.price;
              p.cues.push(c.id);
              toast(`Đã mua ${c.name}`, 'gold');
            }
            p.cue = c.id;
            app.save();
            refreshWallet();
            render();
          })),
        );
        grid.append(card);
      }
    } else if (tab === 'table') {
      for (const t of TABLES) {
        const owned = p.tables.includes(t.id);
        const eq = p.table === t.id;
        const locked = !owned && lv < t.level;
        const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');
        const preview = h('div', { style: `height:74px;border-radius:12px;margin:8px 0;border:9px solid ${hex(t.rail)};background:radial-gradient(circle at 50% 40%, ${hex(t.cloth)}, ${hex(t.clothDark)});box-shadow:inset 0 0 0 2px rgba(0,0,0,0.3)` });
        grid.append(h('div.card', { class: `${eq ? 'sel' : ''} ${locked ? 'locked' : ''}` },
          h('div.row', null, h('b.grow', null, t.name), owned ? (eq ? h('span.chip.gold', null, 'Đang dùng') : null) : h('span.chip.gold', null, icon('coin'), t.price.toLocaleString('vi-VN'))),
          preview,
          h('div.muted.small', null, t.desc),
          h('div', { style: 'margin-top:8px' }, cardAction(owned, eq, locked, t.level, t.price, () => {
            if (!owned) {
              p.coins -= t.price;
              p.tables.push(t.id);
              toast(`Đã mua ${t.name}`, 'gold');
            }
            p.table = t.id;
            app.save();
            refreshWallet();
            render();
          })),
        ));
      }
    } else {
      content.append(h('div.muted.small', { style: 'margin-bottom:8px' }, 'Mang tối đa 2 kỹ năng vào mỗi trận. Kỹ năng tiêu năng lượng — ăn bi để hồi.'));
      for (const s of SKILLS) {
        const on = p.skills.includes(s.id);
        const locked = lv < s.level;
        const card = h('button.card', { class: `${on ? 'sel' : ''} ${locked ? 'locked' : ''}` },
          h('div.row', null,
            h('div', { style: 'width:44px;height:44px;display:grid;place-items:center;border-radius:var(--r-sm);background:var(--surface-3);color:var(--info);flex-shrink:0' }, skillIcon(s.id)),
            h('div.grow', null, h('b', null, s.name), h('div.muted.small', null, `${s.cost} năng lượng${locked ? ` · mở ở cấp ${s.level}` : ''}`)),
            on ? icon('check') : null,
          ),
          h('div.small', { style: 'margin-top:6px;font-weight:600' }, s.desc),
        );
        tap(card, () => {
          if (locked) return toast(`Đạt cấp ${s.level} để mở`, 'bad');
          if (on) p.skills = p.skills.filter((x) => x !== s.id);
          else p.skills = [...p.skills, s.id].slice(-2);
          app.save();
          render();
        });
        grid.append(card);
      }
    }
    content.append(grid);
  };
  function cardAction(owned: boolean, eq: boolean, locked: boolean, level: number, price: number, act: () => void) {
    if (eq) return btn('Đã trang bị', () => {}, 'ghost small');
    if (owned) return btn('Trang bị', act, 'small');
    if (locked) return btn(h('span', null, icon('lock'), ` Cấp ${level}`), () => toast(`Đạt cấp ${level} để mở khóa`, 'bad'), 'ghost small');
    const b = btn('Mua', () => (p.coins >= price ? act() : toast('Không đủ xu', 'bad')), 'small');
    return b;
  }
  const tabs = seg([['cue', 'Cơ'], ['table', 'Bàn'], ['skill', 'Kỹ năng']], tab, (v) => {
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
  const left = h('div.panel.scroll', { style: 'flex:1;padding:6px 16px;min-height:0' },
    line('Tên cơ thủ', nameInput),
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
