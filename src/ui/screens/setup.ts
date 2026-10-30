import type { Personality } from '../../ai/types';
import { MODE_NAMES, raceName } from '../../core/rules';
import type { GameMode } from '../../core/rules/types';
import { LEVEL_NAMES, PERSONALITY_NAMES } from '../../game/content/career';
import { CUES, MUTATORS, TABLES, type MutatorId } from '../../game/content/gear';
import type { PlayerSetup } from '../../game/match';
import { CHAMPIONS, champion, classInfo, cutoutUrl, type Champion } from '../../game/content/sects';
import { avatar } from '../avatar';
import { motionModal as modal, screenEl, type App, type Screen } from '../app';
import { btn, chip, h, item, tap } from '../dom';
import { icon } from '../icons';
import { championPicker, championPreview, closeX, seg, topbar } from '../widgets';
import { matchScreen } from './match';
import { profileModal } from './profile';

type MatchEndResult = Parameters<NonNullable<Parameters<typeof matchScreen>[0]['onEnd']>>[0];

interface Seat { name: string; champion: string; cue: string }

/** One Song Đấu player: name, champion (any owned one but the other player's) and cue. */
function seatModal(app: App, seat: Seat, other: string, onDone: () => void) {
  let name = seat.name;
  let pick = seat.champion;
  let cue = seat.cue;
  const cues = h('div.chips.seat-cues');
  const { preview, label, show } = championPreview();
  const showSeat = () => {
    show(pick);
    cues.replaceChildren(...CUES.filter((q) => app.profile.cues.includes(q.id)).map((q) => chip(q.name, q.id === cue, () => {
      cue = q.id;
      showSeat();
    })));
  };
  showSeat();
  const input = h('input', {
    type: 'text', value: name, maxLength: 14, placeholder: 'Tên người chơi', autocomplete: 'off', 'aria-label': 'Tên người chơi',
    oninput: (e: Event) => (name = (e.target as HTMLInputElement).value),
  }) as HTMLInputElement;
  modal((close) => h('div.modal.profile-modal', null,
    h('h2', null, 'Người chơi'),
    h('div.pm-body', null,
      h('div.pm-left', null, preview, label,
        h('span.section-title', null, 'Tên'), input,
        h('span.section-title', null, 'Pháp Cơ'), cues,
        btn('Xong', () => {
          seat.name = name.trim().slice(0, 14) || seat.name;
          seat.champion = pick;
          seat.cue = cue;
          close();
          onDone();
        }, 'block'),
      ),
      h('div.pm-right.scroll', null,
        h('p.pm-note', null, 'Chọn một tướng đã mở khoá. Hai người chơi không dùng chung một tướng.'),
        championPicker(app, { selected: () => pick, onPick: (c) => {
          pick = c.id;
          showSeat();
        }, onlyOwned: true, exclude: () => other })),
    ),
    closeX(close),
  ), { dismissable: true });
}

interface SetupState {
  mode: GameMode;
  level: 1 | 2 | 3 | 4;
  pers: Personality;
  race: number;
  points: number;
  mutator: MutatorId | null;
  classic: boolean;
}

interface FoeView {
  hint: HTMLElement;
  portrait: HTMLElement;
  name: HTMLElement;
  cut: HTMLImageElement;
}

function setupScreen(app: App, local: boolean): Screen {
  const el = screenEl('setup');
  const st: SetupState = {
    mode: 'eight', level: 2, pers: 'balanced', race: 3, points: 10, mutator: null, classic: false,
  };
  // Song Đấu seats: each player picks name, champion and cue; nothing comes from the profile's own pick.
  const seats: Seat[] = [
    { name: 'Cơ thủ 1', champion: app.profile.champion, cue: app.profile.cue },
    { name: 'Cơ thủ 2', champion: '', cue: app.profile.cue },
  ];
  let tableId = app.profile.table;
  const left = h('div.setup-opts');
  const foeView: FoeView = {
    hint: h('span.vs-sub'), portrait: h('span.vs-av'), name: h('b.vs-name'),
    cut: h('img.vs-cut.foe', { alt: '', draggable: false, decoding: 'async' }),
  };
  let foe: Champion;
  /** A fresh opponent for the level; a re-roll never lands on the one already shown. */
  const chooseFoe = () => {
    const pool = CHAMPIONS.filter((c) => c.id !== app.profile.champion && (local ? app.profile.champions.includes(c.id) : Math.abs(c.tier - (st.level + 1)) <= 1));
    foe = pickRandom(pool.filter((c) => c !== foe)) ?? pickRandom(pool) ?? CHAMPIONS.find((c) => c.id !== app.profile.champion)!;
    seats[1].champion = foe.id;
    foeView.portrait.replaceChildren(avatar(foe.id));
    foeView.name.textContent = foe.name;
    foeView.cut.src = cutoutUrl(foe.id);
  };
  chooseFoe();
  const renderOptions = () => renderSetupOptions({ app, local, st, seats, tableId, setTable: (id) => { tableId = id; }, foeView, chooseFoe, into: left, render: renderOptions });
  renderOptions();
  const me = champion(app.profile.champion);
  const meCut = h('img.vs-cut.me', { src: cutoutUrl(local ? seats[0].champion : me.id), alt: '', draggable: false, decoding: 'async' });

  const seatView = { seats, plates: [] as HTMLButtonElement[], meCut, foeCut: foeView.cut };
  seatView.plates = local ? [seatPlate(app, seatView, 0), seatPlate(app, seatView, 1)] : [];
  const paintSeats = () => paintSeatPlates(seatView);
  if (local) paintSeats();
  const rollSeats = () => {
    rerollSeats(app, seats);
    paintSeats();
  };
  const roll = rollButton(local, rollSeats, chooseFoe);
  // A duel stage: both champions full-body facing each other, the seal between, the start stamp below.
  const versus = h('div.versus',
    null,
    h('div.vs-stage', null, meCut, foeView.cut, h('div.vs-seal', { 'aria-hidden': 'true' }, 'đấu'), roll),
    h('div.vs-plates', null, ...(local ? seatView.plates : [
      tap(h('button.vs-side.me', { 'aria-label': 'Đổi tướng' },
        h('span.vs-text', null, h('b.vs-name', null, app.profile.name), h('span.vs-sub', null, `${me.name} · ${classInfo(me.cls).name}`)),
        h('span.vs-edit', null, icon('edit')),
      ), () => profileModal(app, () => app.go(quickScreen, { replace: true }))),
      h('div.vs-side.foe', null, h('span.vs-text', null, foeView.name, foeView.hint)),
    ])),
    btn(h('span.btn-in', null, icon('play'), 'Vào trận'), () => start(), 'big block'),
  );
  el.append(topbar(app, local ? 'Song Đấu' : 'Luận Cơ'), h('div.setup-body', null, left, versus));

  function start() {
    const launch = setupMatch(app, { local, st, seats, foe, tableId });
    app.go(launch);
  }
  return { el };
}

interface SeatPlate {
  seats: Seat[];
  plates: HTMLButtonElement[];
  meCut: HTMLImageElement;
  foeCut: HTMLImageElement;
}

function seatPlate(app: App, x: SeatPlate, i: 0 | 1): HTMLButtonElement {
  const { seats } = x;
  return tap(h('button.vs-side', { class: i ? 'foe' : 'me', 'aria-label': `Chọn tướng, tên và Pháp Cơ cho người chơi ${i + 1}` }), () =>
    seatModal(app, seats[i], seats[i ? 0 : 1].champion, () => paintSeatPlates(x)));
}

function paintSeatPlates(x: SeatPlate) {
  const { seats, plates, meCut, foeCut } = x;
  seats.forEach((seat, i) => {
    const c = champion(seat.champion);
    const cue = CUES.find((q) => q.id === seat.cue) ?? CUES[0];
    const text = h('span.vs-text', null, h('b.vs-name', null, seat.name), h('span.vs-sub', null, `${c.name} · ${cue.name}`));
    plates[i].replaceChildren(...(i ? [h('span.vs-edit', null, icon('edit')), text] : [text, h('span.vs-edit', null, icon('edit'))]));
  });
  meCut.src = cutoutUrl(seats[0].champion);
  foeCut.src = cutoutUrl(seats[1].champion);
}

/** Song Đấu re-rolls both seats from the owned champions (never the same one twice). */
function rerollSeats(app: App, seats: Seat[]) {
  const owned = CHAMPIONS.filter((c) => app.profile.champions.includes(c.id));
  for (const seat of seats) {
    const other = seats.find((x) => x !== seat)!.champion;
    const fresh = owned.filter((c) => c.id !== other && c.id !== seat.champion);
    seat.champion = (pickRandom(fresh) ?? pickRandom(owned.filter((c) => c.id !== other)) ?? champion(seat.champion)).id;
  }
}

function pickRandom<T>(list: T[]): T | undefined {
  return list[Math.floor(Math.random() * list.length)];
}

function rollButton(local: boolean, rollSeats: () => void, chooseFoe: () => void) {
  const roll = btn(h('span.btn-in', null, icon('replay'), local ? 'Đổi tướng' : 'Đổi đối thủ'), () => (local ? rollSeats() : chooseFoe()), 'small secondary vs-roll');
  roll.setAttribute('aria-label', local ? 'Đổi ngẫu nhiên tướng của cả hai người chơi' : 'Đổi ngẫu nhiên tướng đối thủ');
  return roll;
}

interface SetupOptions {
  app: App;
  local: boolean;
  st: SetupState;
  seats: Seat[];
  tableId: string;
  setTable(id: string): void;
  foeView: FoeView;
  chooseFoe(): void;
  into: HTMLElement;
  render(): void;
}

const SHORT: Record<GameMode, string> = { eight: '8 bi', nine: '9 bi', ten: '10 bi', 'carom-libre': 'Phăng', 'carom-3c': '3 Băng' };

function renderSetupOptions(x: SetupOptions) {
  const { local, st, tableId, foeView, chooseFoe, into, render } = x;
  const row = optionRow();
  foeView.hint.textContent = tierRange(st);
  const mut = MUTATORS.find((m) => m.id === st.mutator);
  into.replaceChildren(...[
    row('Chế độ', seg([['tc', 'Tiên Đạo · có chiêu'], ['cd', 'Cổ Điển']], st.classic ? 'cd' : 'tc', (v) => (st.classic = v === 'cd'))),
    row('Thể loại', modeOptions(st, render)),
    local ? null : row('Đối thủ', seg([[1, LEVEL_NAMES[1]], [2, LEVEL_NAMES[2]], [3, LEVEL_NAMES[3]], [4, LEVEL_NAMES[4]]], st.level, (v) => {
      st.level = v;
      chooseFoe();
      foeView.hint.textContent = tierRange(st);
    })),
    local ? null : row('Lối đánh', seg(Object.entries(PERSONALITY_NAMES) as [Personality, string][], st.pers, (v) => (st.pers = v))),
    row('Số ván', seg([1, 2, 3, 5].map((n): [number, string] => [n, raceName(n, true)]), st.race, (v) => (st.race = v))),
    local ? row('Linh Đài', h('div.chips', null, chip(TABLES.find((t) => t.id === tableId)?.name ?? TABLES[0].name, true, () => pickTable(x), 'edit'))) : null,
    st.mode.startsWith('carom')
      ? row('Điểm/ván', seg(st.mode === 'carom-3c' ? [[3, '3 điểm'], [5, '5 điểm'], [10, '10 điểm']] : [[5, '5 điểm'], [10, '10 điểm'], [15, '15 điểm']], st.points, (v) => (st.points = v)))
      : row('Biến thể', h('div.chips', null, chip(mut ? mut.name : 'Không có', !!mut, () => pickMutator(x), 'edit'))),
  ].filter((r): r is HTMLDivElement => r !== null));
}

function pickTable({ app, tableId, setTable, render }: SetupOptions) {
  modal((close) => h('div.modal.scroll', null,
    h('h2', null, 'Chọn Linh Đài'),
    h('div.list', null, ...TABLES.filter((t) => app.profile.tables.includes(t.id)).map((t) =>
      item(t.name, chip(tableId === t.id ? 'Đang chọn' : 'Chọn', tableId === t.id, () => {
        setTable(t.id);
        close();
        render();
      }), { hint: t.desc }))),
    h('div.actions', null, btn('Đóng', close, 'ghost')),
  ), { dismissable: true });
}

function pickMutator({ st, render }: SetupOptions) {
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

function tierRange(st: SetupState) {
  const lo = Math.max(1, st.level);
  const hi = Math.min(5, st.level + 2);
  return `Tướng bậc ${lo}–${hi} · ${LEVEL_NAMES[st.level]}`;
}

function optionRow() {
  return (label: string, ctl: Node) => h('div.opt-row', null, h('span.opt-label', null, label), ctl);
}

function modeOptions(st: SetupState, render: () => void): HTMLElement {
  return seg(Object.keys(MODE_NAMES).map((k) => [k as GameMode, SHORT[k as GameMode]]), st.mode, (v) => {
    st.mode = v;
    st.points = v === 'carom-3c' ? 5 : 10;
    render();
  });
}

function setupMatch(app: App, x: { local: boolean; st: SetupState; seats: Seat[]; foe: Champion; tableId: string }) {
  // AI opponents: a champion whose tier fits the level, with a cue from their own sect.
  // Never the player's own champion: no mirror matches.
  const { local, st, seats, foe } = x;
  const cueOf = (id: string) => CUES.find((c) => c.id === id) ?? CUES[0];
  const foeCue = cueOf(`${foe.sect}-${st.level >= 3 ? 'b' : 'a'}`);
  const p1 = local
    ? { name: seats[0].name, kind: 'human' as const, cue: cueOf(seats[0].cue), champion: seats[0].champion }
    : { name: app.profile.name, kind: 'human' as const, cue: app.cue, champion: app.profile.champion };
  const opp = local
    ? { name: seats[1].name, kind: 'human' as const, cue: cueOf(seats[1].cue), champion: seats[1].champion }
    : { name: foe.name, kind: 'ai' as const, ai: { level: st.level, personality: st.pers }, cue: foeCue, champion: foe.id };
  const options = {
    setup: {
      mode: st.mode, raceTo: st.race, players: [p1, opp] as [PlayerSetup, PlayerSetup], mutator: st.mode.startsWith('carom') ? null : st.mutator,
      tableSkin: local ? TABLES.find((t) => t.id === x.tableId) ?? app.tableSkin : app.tableSkin,
      caromTarget: st.points, firstBreaker: Math.random() < 0.5 ? 0 : 1 as 0 | 1, classic: st.classic,
    },
    titles: (local ? ['Người chơi 1', 'Người chơi 2'] : [`Cấp ${app.level}`, `${LEVEL_NAMES[st.level]} · ${PERSONALITY_NAMES[st.pers]}`]) as [string, string],
    label: local ? 'Song Đấu' : 'Luận Cơ',
  };
  let launch: ReturnType<typeof matchScreen>;
  launch = matchScreen({ ...options, onExit: () => app.pop(), onEnd: (result) => {
    const again = () => app.go(launch, { replace: true });
    return local ? localEnd(app, result, again) : quickEnd(app, st, result, again);
  } });
  return launch;
}

function localEnd(app: App, result: MatchEndResult, again: () => void) {
  const { match } = result;
  app.profile.stats.played++;
  app.profile.stats.pots += match.stats[0].pots;
  app.profile.stats.bestRun = Math.max(app.profile.stats.bestRun, match.stats[0].bestRun);
  app.save();
  return { lines: [], again };
}

function quickEnd(app: App, st: SetupState, result: MatchEndResult, again: () => void) {
  const { won, match } = result;
  const p = app.profile;
  p.stats.played++;
  p.stats.pots += match.stats[0].pots;
  p.stats.bestRun = Math.max(p.stats.bestRun, match.stats[0].bestRun);
  if (won) p.stats.won++;
  const coins = won ? 40 * st.level * st.race : 10 * st.race;
  const xp = won ? 50 * st.level * st.race : 15 * st.race;
  const up = app.reward(coins, xp);
  return { lines: [`+${coins} xu`, `+${xp} EXP`, ...(up ? [`Lên cấp ${app.level}!`] : [])], again };
}

export const quickScreen = (app: App) => setupScreen(app, false);
export const localScreen = (app: App) => setupScreen(app, true);
