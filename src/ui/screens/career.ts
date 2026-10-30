import { LEVEL_NAMES, PERSONALITY_NAMES, type Npc } from '../../game/content/career';
import { MODE_NAMES, raceName } from '../../core/rules';
import { CUES, MUTATORS, TABLES, type TableSkin } from '../../game/content/gear';
import { CHAMPIONS, champion, sect } from '../../game/content/sects';
import type { Match } from '../../game/match';
import { motionModal as modal, type App } from '../app';
import { avatar } from '../avatar';
import { btn, h, stars, toast } from '../dom';
import { icon } from '../icons';
import { closeX, fmt, hex6, statChip } from '../screen-bits';
import { matchScreen } from './match-screen';

const tableOf = (n: Npc): TableSkin => TABLES.find((t) => t.id === n.sect) ?? TABLES[0];

export function npcModal(app: App, n: Npc) {
  const mut = n.mutator ? MUTATORS.find((m) => m.id === n.mutator)! : null;
  const best = app.profile.career[n.id];
  const recruited = app.profile.champions.includes(n.id);
  const facts = [MODE_NAMES[n.mode], raceName(n.raceTo), n.caromTarget ? `${n.caromTarget} điểm/ván` : '', LEVEL_NAMES[n.level], PERSONALITY_NAMES[n.personality]].filter(Boolean).join(' · ');
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
      h('p.nm-facts', null, h('b', null, facts), h('br'), `Linh Đài: ${tableOf(n).name}`),
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
    toast(`Trận này ${champion(mine).name} ra trận thay, vì không ai đấu với chính mình`, 'gold');
  }
  let launch: ReturnType<typeof matchScreen>;
  launch = matchScreen({
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
    onEnd: ({ won, match }) => careerEnd(app, n, { won, match }, () => app.go(launch, { replace: true })),
  });
  app.go(launch);
}

function careerEnd(app: App, n: Npc, { won, match }: { won: boolean; match: Match }, again: () => void) {
  const p = app.profile;
  p.stats.played++;
  p.stats.pots += match.stats[0].pots;
  p.stats.bestRun = Math.max(p.stats.bestRun, match.stats[0].bestRun);
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
}
