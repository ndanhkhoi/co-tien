import { other } from '../core/rules/types';
import { PLACED_KINDS } from '../game/skill-cast';
import type { SkillKind } from '../game/content/sects';
import type { AiDecision, AiShot, CastSkill } from './types';
import { tableEase } from './shot-lines';
import type { Ctx } from './search-context';

export function addNoise(ctx: Ctx, shot: AiShot): AiShot {
  const t = ctx.tune;
  const pers = ctx.req.profile.personality;
  const aimMul = pers === 'aggressive' ? 1.15 : pers === 'defensive' ? 0.9 : 1;
  return {
    ...shot,
    angle: shot.angle + ctx.rng.gauss() * t.aimSigma * aimMul,
    power: Math.max(0.03, Math.min(1, shot.power * (1 + ctx.rng.gauss() * t.powerSigma))),
  };
}

/** Families that help when the coming shot looks hard, and ones that hurt the opponent. */
const RESCUE: SkillKind[] = ['maw', 'gravity', 'second', 'shield', 'blast', 'sand', 'bumper', 'spinwash'];
const HEX: SkillKind[] = ['chill', 'freeze', 'seal', 'drain'];

export function chooseSkill(ctx: Ctx, confidence: number): AiDecision['skill'] {
  const { skills, profile } = ctx.req;
  if (!skills.length) return undefined;
  const usable = skills.filter((s) => s.kind !== 'nudge' && s.kind !== 'teleport' && s.kind !== 'rewind');
  const late = ctx.req.balls.filter((b) => b.onTable && b.id !== ctx.cueId).length <= 5;
  const ult = usable.find((s) => s.ultimate);
  if (ult && (profile.level === 1 || late || confidence >= 0.5 || RESCUE.includes(ult.kind))) return ult.slot;
  if (profile.level === 1) return basicForLevel1(ctx, usable, confidence);
  return basicForLaterLevel(ctx, usable, confidence);
}

function basicForLevel1(ctx: Ctx, usable: CastSkill[], confidence: number): AiDecision['skill'] {
  if (ctx.rng.next() >= 0.6) return undefined;
  const wanted = confidence < 0.5 ? RESCUE : undefined;
  const prefer = usable.find((s) => !s.ultimate && (wanted ? wanted.includes(s.kind) : !HEX.includes(s.kind)))?.slot;
  return prefer ?? usable.find((s) => !s.ultimate)?.slot;
}

function basicForLaterLevel(ctx: Ctx, usable: CastSkill[], confidence: number): AiDecision['skill'] {
  // Save basics for a deliberate opportunity rather than spending on every ready shot.
  if (ctx.rng.next() > 0.42) return undefined;
  const rescue = usable.find((s) => !s.ultimate && RESCUE.includes(s.kind));
  if (rescue && confidence < 0.5) return rescue.slot;
  const hex = usable.find((s) => !s.ultimate && HEX.includes(s.kind));
  if (hex && tableEase(ctx, ctx.req.balls, ctx.req.state, other(ctx.side)) > 0.6) return hex.slot;
  const terrain = usable.find(s => !s.ultimate && PLACED_KINDS.includes(s.kind));
  if (terrain) return terrain.slot;
  const boost = usable.find((s) => !s.ultimate && !HEX.includes(s.kind));
  if (boost && confidence >= 0.5 && goodFinish(ctx)) return boost.slot;
  return undefined;
}

function goodFinish(ctx: Ctx): boolean {
  const targets = ctx.rules.legalTargets(ctx.req.state, ctx.req.balls, ctx.side);
  const ease = ctx.req.ballInHand === 'none' ? tableEase(ctx, ctx.req.balls, ctx.req.state, ctx.side) : 0.9;
  return targets.length <= 3 && ease >= 0.65;
}
