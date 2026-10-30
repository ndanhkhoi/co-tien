import { Rng } from '../core/rng';
import { RULES } from '../core/rules';
import { skillPower } from '../game/content/sects';
import type { AiDecision, AiRequest, CastSkill } from './types';
import { makeCtx, type Ctx, type Plan } from './search-context';
import { tableEase } from './shot-lines';
import { breakShot, caromPlan, makeShot, placements, potPlans, safetyPlans, shortlist } from './shot-plans';
import { addNoise, chooseSkill } from './skill-choice';
import { replanWithSkill } from './skill-replan';



function attackPlan(ctx: Ctx): Plan | null {
  const { req } = ctx;
  const balls = req.balls;
  if (req.ballInHand !== 'none') {
    let best: Plan | null = null;
    const spots = shortlist(ctx, balls, placements(ctx, balls, req.ballInHand === 'kitchen'));
    for (const pos of spots) {
      const plan = potPlans(ctx, balls, pos, true)[0];
      if (plan && (!best || plan.ev > best.ev)) best = plan;
    }
    return best;
  }
  const cue = balls.find((b) => b.id === ctx.cueId)!;
  return potPlans(ctx, balls, cue, false)[0] ?? null;
}

/** Safety when the best attack is too risky for this personality. */
function safetyPlan(ctx: Ctx, best: Plan | null): Plan | null {
  const { req } = ctx;
  const balls = req.balls;
  const cue = req.ballInHand !== 'none'
    ? placements(ctx, balls, req.ballInHand === 'kitchen')[0] ?? balls.find((b) => b.id === ctx.cueId)!
    : balls.find((b) => b.id === ctx.cueId)!;
  const safe = safetyPlans(ctx, balls, cue, req.ballInHand !== 'none')[0];
  if (!safe || (best && safe.ev <= best.ev)) return best;
  if (req.pushOutAvailable && req.profile.level >= 2) safe.shot.pushOut = true;
  return safe;
}

function planShot(req: AiRequest): AiDecision {
  const ctx = makeCtx(req);
  const rules = ctx.rules;

  if (req.option) {
    const kind = req.state.pendingOption;
    const ease = tableEase(ctx, req.balls, req.state, req.side);
    if (kind === 'illegal-break-8') return { shot: null, option: ease > 0.25 ? 'play' : 'pass', confidence: ease };
    return { shot: null, option: ease > 0.3 ? 'play' : 'pass', confidence: ease };
  }

  if (req.state.isBreak && rules.table === 'pool') {
    return { shot: addNoise(ctx, breakShot(ctx)), confidence: 0.6 };
  }

  if (rules.table === 'carom') {
    const plan = caromPlan(ctx);
    return { shot: addNoise(ctx, plan.shot), confidence: plan.p, skill: chooseSkill(ctx, plan.p) };
  }

  let best = attackPlan(ctx);
  const threshold = { aggressive: 15, balanced: 40, defensive: 70, trickster: 35 }[req.profile.personality];
  if ((!best || best.ev < threshold) && req.profile.level >= 2) best = safetyPlan(ctx, best);
  if (!best) return fallbackDecision(ctx);
  return { shot: addNoise(ctx, best.shot), confidence: best.p, skill: chooseSkill(ctx, best.p) };
}

/** Nothing found: roll softly into the lowest legal ball. */
function fallbackDecision(ctx: Ctx): AiDecision {
  const { req } = ctx;
  const balls = req.balls;
  const targets = ctx.rules.legalTargets(req.state, balls, ctx.side);
  const cue = balls.find((b) => b.id === ctx.cueId)!;
  const ob = balls.find((b) => targets.includes(b.id) && b.onTable) ?? balls.find((b) => b.id !== ctx.cueId && b.onTable)!;
  const shot = makeShot({ angle: Math.atan2(ob.y - cue.y, ob.x - cue.x), speed: 1.6 }, ctx, {
    cue: req.ballInHand !== 'none' ? { x: cue.x, y: cue.y } : undefined,
    call: ctx.rules.callType(req.state, balls, ctx.side) === 'none' ? null : { ball: ob.id, pocket: 0 },
  });
  return { shot: addNoise(ctx, shot), confidence: 0.05, skill: chooseSkill(ctx, 0.05) };
}

function selectedSkill(req: AiRequest, decision: AiDecision): CastSkill | undefined {
  const forced = req.skills.find(s => s.ultimate && (s.kind === 'teleport' || s.kind === 'nudge'));
  const rescue = decision.confidence < 0.5 && new Rng(req.seed + 17).next() < 0.42;
  return forced ?? (rescue ? req.skills.find(s => s.kind === 'teleport' || s.kind === 'nudge') : undefined)
    ?? req.skills.find(s => s.slot === decision.skill);
}

/** Placement skills must return a shot planned from the position the match will accept. */
export function think(req: AiRequest): AiDecision {
  const decision = planShot(req);
  if (req.option || req.state.isBreak) return decision;
  const selected = selectedSkill(req, decision);
  if (selected && decision.shot) return replanWithSkill(req, { ...decision, shot: decision.shot }, selected, planShot);
  return planPlacementUltimate(req, decision);
}

function planPlacementUltimate(req: AiRequest, decision: AiDecision): AiDecision {
  if (RULES[req.state.mode].table === 'carom') return decision;
  const placementUltimate = req.skills.some((s) => s.ultimate && (s.kind === 'nudge' || s.kind === 'teleport'));
  if (decision.skill !== undefined && !placementUltimate) return decision;
  const placements = req.skills.filter((s) => s.kind === 'teleport' || (s.kind === 'nudge' && s.tier !== undefined));
  const skill = placements.find((s) => s.ultimate) ?? (decision.confidence < 0.5 ? placements[0] : undefined);
  if (!skill) return decision;
  if (req.profile.level === 1 && !skill.ultimate && new Rng(req.seed + 17).next() >= 0.6) return decision;
  const cue = req.balls.find((b) => b.id === RULES[req.state.mode].cueId(req.state, req.side))!;
  const placed = planShot({
    ...req, skills: [], ballInHand: 'anywhere',
    nudge: skill.kind === 'nudge' ? { x: cue.x, y: cue.y, radius: (skillPower('nudge', skill.tier!) as { radius: number }).radius } : undefined,
  });
  if (!placed.shot?.cue || (!skill.ultimate && placed.confidence <= decision.confidence)) return decision;
  return { ...placed, skill: skill.slot };
}
