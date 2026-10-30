import { cloneBalls, type Ball } from '../core/physics';
import { canPlaceCue } from '../core/rack';
import { RULES } from '../core/rules';
import { makeCaromTable, makePoolTable, type TableGeom } from '../core/table';
import { skillPower, type SkillKind } from '../game/content/sects';
import { buildCast, mergeTerrain, PLACED_KINDS, type SkillCast } from '../game/skill-cast';
import type { AiDecision, AiRequest, AiShot, CastSkill } from './types';

interface SkillPlan {
  table: TableGeom;
  cueId: number;
  cuePosition?: { x: number; y: number };
  start: Ball[];
}

function castFor(shot: AiShot): SkillCast {
  return { direction: { x: Math.cos(shot.angle), y: Math.sin(shot.angle) } };
}

function positionedStart(req: AiRequest, selected: CastSkill, shot: AiShot, plan: SkillPlan): SkillPlan {
  const start = cloneBalls(req.balls);
  const cue = start.find(b => b.id === plan.cueId)!;
  let cuePosition: {x:number;y:number} | undefined;
  const kinds = selected.kinds ?? [selected.kind];
  if (!kinds.includes('teleport') && !kinds.includes('nudge')) return { ...plan, cuePosition, start };
  const tier = selected.tier ?? 1;
  const place = { table: plan.table, balls: start, cueId: plan.cueId, kitchen: false };
  const radius = kinds.includes('teleport') ? plan.table.L : (skillPower('nudge', tier) as {radius:number}).radius;
  const target = start.filter(b => b.onTable && b.id !== plan.cueId).sort((a,b) => Math.hypot(a.x-cue.x,a.y-cue.y)-Math.hypot(b.x-cue.x,b.y-cue.y))[0];
  if (target) for (const sign of [-1,1]) {
    const x = cue.x + sign * Math.sin(shot.angle) * Math.min(radius * 0.9,0.25);
    const y = cue.y - sign * Math.cos(shot.angle) * Math.min(radius * 0.9,0.25);
    if (canPlaceCue(place, x, y)) { cuePosition={x,y}; break; }
  }
  cuePosition ??= {x:cue.x,y:cue.y};
  Object.assign(cue,cuePosition);
  return { ...plan, cuePosition, start };
}

export function replanWithSkill(req: AiRequest, decision: AiDecision & { shot: AiShot }, selected: CastSkill, planShot: (req: AiRequest) => AiDecision): AiDecision {
  const table = RULES[req.state.mode].table === 'pool' ? makePoolTable() : makeCaromTable();
  const cueId = RULES[req.state.mode].cueId(req.state, req.side);
  const plan = positionedStart(req, selected, decision.shot, { table, cueId, start: req.balls });
  const { cuePosition, start } = plan;
  const cast = castFor(decision.shot);
  const kinds = selected.kinds ?? [selected.kind];
  const tier = selected.tier ?? 1;
  const positionSkill = kinds.includes('teleport') || kinds.includes('nudge');
  const effects = (selected.kinds ?? [selected.kind]).filter(k => PLACED_KINDS.includes(k)).map(k => buildCast(k, selected.tier ?? 1, selected.slot, { table, balls: req.balls, cueId, cast, ult: selected.ult, shape: selected.shape }));
  const submitted = effects[0]?.cast ?? cast;
  const actualEffects = kinds.filter(k => PLACED_KINDS.includes(k)).map(k => buildCast(k,tier,selected.slot,{ table, balls: req.balls, cueId, cast: submitted, ult: selected.ult, shape: selected.shape }));
  const p = (kind: SkillKind) => skillPower(kind, tier) as Record<string, number>;
  const planned = planShot({ ...req, balls: start, skills: [], ballInHand: positionSkill ? 'none' : req.ballInHand,
    maxSpeed: req.maxSpeed * (kinds.includes('power') ? p('power').speed : 1),
    spinMultiplier: kinds.includes('spin') ? p('spin').spin : req.spinMultiplier,
    secondChance: req.secondChance || kinds.includes('second'),
    shield: req.shield || kinds.includes('shield'),
    captureScale: req.captureScale * (kinds.includes('maw') ? p('maw').scale : 1),
    pocketPull: kinds.includes('gravity') ? p('gravity').pull : req.pocketPull,
    blast: kinds.includes('blast') ? { radius: p('blast').radius, force: p('blast').force, directional: kinds.includes('blast') && selected.directionalBlast === true } : req.blast,
    terrain: mergeTerrain(req.terrain, ...(selected.target === 'opponent' ? [] : actualEffects.map(e => e.terrain))),
    extraSegments: [...req.extraSegments, ...(selected.target === 'opponent' ? [] : actualEffects.flatMap(e => e.segments))] });
  return { ...planned, shot: planned.shot ? {...planned.shot, cue: cuePosition ?? planned.shot.cue} : null, skill: selected.slot, cast: submitted };
}
