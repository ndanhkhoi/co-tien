import type { GameMode } from '../../core/rules/types';
import { CHALLENGES, challengeBalls, FAMILY_INFO, goalText, judgeChallenge, type ChallengeDef } from '../../game/content/challenges';
import type { TableSkin } from '../../game/content/gear';
import { matchScreen } from './match-screen';
import type { App } from '../app';

const POCKET_LABEL = ['lỗ góc trên trái', 'lỗ giữa trên', 'lỗ góc trên phải', 'lỗ góc dưới trái', 'lỗ giữa dưới', 'lỗ góc dưới phải'];

export function startChallenge(app: App, c: ChallengeDef, table: TableSkin = app.tableSkin) {
  const list = CHALLENGES.filter((x) => x.family === c.family);
  const idx = list.indexOf(c);
  const mode: GameMode = c.table === 'carom' ? (c.goal.kind === 'carom' && c.goal.three ? 'carom-3c' : 'carom-libre') : 'eight';
  let launch: ReturnType<typeof matchScreen>;
  launch = matchScreen({
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
      onResult: (ok, attempt) => challengeResult(app, { c, list, idx, table, ok, attempt }),
    },
    onExit: () => app.pop(),
  });
  app.go(launch);
}

function challengeResult(app: App, x: { c: ChallengeDef; list: ChallengeDef[]; idx: number; table: TableSkin; ok: boolean; attempt: number }) {
  const { c, list, idx, table, ok, attempt } = x;
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
}

function startChallengeReplace(app: App, c: ChallengeDef, table: TableSkin) {
  app.pop();
  setTimeout(() => startChallenge(app, c, table), 60);
}
