import type { AiDecision, AiRequest } from '../../../ai/types';
import { champion } from '../../../game/content/sects';
import type { Side } from '../../../core/rules/types';
import type { MatchCtx } from './context';
import type { FireArgs } from './shooting';
import { POCKET_NAMES } from './hud';
import type { HeraldMsg } from './herald';

export interface AiTurnDeps {
  renderHud(): void;
  herald(m: HeraldMsg): void;
  setFocus(side: Side, on: boolean): void;
  setThinking(side: Side | null): void;
  sleep(ms: number): Promise<void>;
  animate(ms: number, fn: (k: number) => void, ease?: (k: number) => number): Promise<void>;
  fire(...args: FireArgs): Promise<void>;
}

export function createAiTurn(ctx: MatchCtx, deps: AiTurnDeps): { turn(): Promise<void> } {
  return { turn: () => aiTurn(ctx, deps) };
}

async function aiTurn(ctx: MatchCtx, deps: AiTurnDeps): Promise<void> {
  const { flags, match, rng, app } = ctx;
  const token = ++flags.aiToken;
  const side = match.turn;
  const player = match.setup.players[side];
  flags.aiActing = true;
  flags.showAiCue = false;
  deps.setFocus(side, true);
  deps.setThinking(side);
  deps.renderHud();
  if (match.phase === 'aim') choosePassive(ctx, side);
  const req = buildRequest(ctx, side, player);
  const started = performance.now();
  const decision = await app.ai.think(req);
  const minThink = 350 + rng.next() * 400;
  const wait = minThink - (performance.now() - started);
  if (wait > 0) await deps.sleep(wait);
  if (cancelled(ctx, token)) return;
  deps.setThinking(null);
  if (match.phase === 'option') return chooseOption(ctx, deps, side, decision.option ?? 'play');
  const shot = decision.shot;
  if (!shot) {
    flags.aiActing = false;
    deps.setFocus(side, false);
    return;
  }
  if (shot.call) announceCall(ctx, deps, { side, name: player.name, call: shot.call });
  await useSkill(ctx, deps, side, decision);
  flags.showAiCue = true;
  await moveCue(ctx, deps, shot);
  if (cancelled(ctx, token)) return;
  await lineUp(ctx, deps, shot);
  await deps.sleep(120 + rng.next() * 160);
  if (cancelled(ctx, token)) return;
  await charge(ctx, deps, shot);
  if (cancelled(ctx, token)) return;
  flags.aiActing = false;
  deps.setFocus(side, false);
  // The AI's call comes from its plan, not from the human aim helpers.
  await deps.fire(...[shot.angle, shot.power, shot.side, shot.vert, shot.call] as FireArgs);
}

function cancelled(ctx: MatchCtx, token: number): boolean {
  return ctx.flags.disposed || token !== ctx.flags.aiToken;
}

function choosePassive(ctx: MatchCtx, side: Side): void {
  const { match } = ctx;
  const passive = match.passive(side);
  if (passive === 'hophap') match.useGuard();
  if (passive === 'phaptu') match.choosePassive(match.isCarom ? 'side' : 'vert');
  if (passive === 'anhsat') match.choosePassive('power');
}

function buildRequest(ctx: MatchCtx, side: Side, player: (typeof ctx.match.setup.players)[number]): AiRequest {
  const { match } = ctx;
  const view0 = match.aiView();
  return {
    balls: view0.balls, state: view0.state, side, profile: player.ai!, maxSpeed: match.vmax(side), spinReach: match.spinReach(side), secondChance: match.secondChance, shield: match.shield[side], pocketPull: match.pull, blast: match.blast ? { radius: match.blast.radius, force: match.blast.force, directional: !!match.blast.direction } : undefined,
    ballInHand: match.placing === 'nudge' ? 'none' : match.placing, closedPockets: view0.closedPockets,
    params: match.params, terrain: match.terrain(),
    extraSegments: match.obstacles().slice(match.closedPockets.length), captureScale: match.simulationWorld().captureScale ?? 1, seed: (Math.random() * 1e9) | 0, option: match.phase === 'option',
    pushOutAvailable: match.state.pushOutAvailable, energy: match.energy[side],
    blind: match.blindNow, calledBall: match.calledNow, driftAngle: match.driftNow,
    skills: match.skills(side).filter((sk) => match.canUseSkill(side, sk.slot)).map((sk) => ({ slot: sk.slot, kind: match.effectiveKind(sk.kinds[0]), ultimate: sk.slot === 2, tier: sk.tier, kinds: sk.kinds.map(k => match.effectiveKind(k)), target: sk.target, ult: sk.ult, shape: sk.shape, directionalBlast: champion(match.current.champion).sect === 'huyetsat' })),
  };
}

function chooseOption(ctx: MatchCtx, deps: AiTurnDeps, side: Side, choice: 'play' | 'pass'): void {
  const { match, flags } = ctx;
  const player = match.setup.players[side];
  deps.herald({ side, title: `${player.name} chọn ${choice === 'play' ? 'đánh tiếp' : match.state.pendingOption === 'illegal-break-8' ? 'xếp lại bi' : 'nhường lại'}` });
  flags.aiActing = false;
  deps.setFocus(side, false);
  match.chooseOption(choice);
}

function announceCall(ctx: MatchCtx, deps: AiTurnDeps, x: {
  side: Side; name: string; call: { ball: number | null; pocket: number };
}): void {
  const { match } = ctx;
  ctx.aiCall = x.call;
  const ballTxt = match.callType() === 'ball-pocket' || x.call.ball !== 8 ? `bi ${x.call.ball}` : 'bi 8';
  deps.herald({ side: x.side, expr: 'focus', icon: 'target', title: `${x.name} gọi ${ballTxt}`, line: POCKET_NAMES[x.call.pocket] });
}

async function useSkill(ctx: MatchCtx, deps: AiTurnDeps, side: Side,
  decision: AiDecision): Promise<void> {
  if (decision.skill === undefined || !ctx.match.canUseSkill(side, decision.skill)) return;
  ctx.match.useSkill(side, decision.skill, decision.cast);
  await deps.sleep(decision.skill === 2 ? 1400 : 450);
}

async function moveCue(ctx: MatchCtx, deps: AiTurnDeps, shot: {
  cue?: { x: number; y: number };
}): Promise<void> {
  const { match } = ctx;
  if (!shot.cue || !match.canMoveCue) return;
  const c = match.cueBall();
  const from = { x: c.x, y: c.y };
  await deps.animate(380, (k) => {
    c.x = from.x + (shot.cue!.x - from.x) * k;
    c.y = from.y + (shot.cue!.y - from.y) * k;
  });
  match.placeCue(shot.cue.x, shot.cue.y);
}

async function lineUp(ctx: MatchCtx, deps: AiTurnDeps, shot: {
  angle: number; side: number; vert: number;
}): Promise<void> {
  const { aim } = ctx;
  aim.elevation = 0;
  const a0 = aim.angle;
  let da = shot.angle - a0;
  da = Math.atan2(Math.sin(da), Math.cos(da));
  await deps.animate(300 + Math.abs(da) * 120, (k) => {
    aim.angle = a0 + da * k;
    aim.side = shot.side * k;
    aim.vert = shot.vert * k;
  });
}

async function charge(ctx: MatchCtx, deps: AiTurnDeps, shot: { power: number }): Promise<void> {
  const { power } = ctx;
  ctx.power.charging = true;
  ctx.power.holdT = 0;
  await deps.animate(200 + shot.power * 450, (k) => {
    power.power = shot.power * k;
  }, (k) => k);
  ctx.power.charging = false;
}
