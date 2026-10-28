import { expect, it } from 'vitest';
import { think } from '../src/ai/brain';
import type { AiRequest } from '../src/ai/types';
import { makeBall, DEFAULT_PHYS } from '../src/core/physics';
import { canPlaceCue } from '../src/core/rack';
import { newGameState } from '../src/core/rules/types';
import { buildCast } from '../src/game/skill-cast';
import { makeCaromTable } from '../src/core/table';

it('plans a mixed placement and well ultimate from its actual cue position on carom', () => {
  const state = newGameState('carom-libre', 0); state.isBreak = false;
  const request: AiRequest = { balls: [makeBall(0,-0.5,0),makeBall(1,0.4,0.15),makeBall(2,0.1,-0.2)],
    state, side: 0, profile:{level:1,personality:'balanced'}, maxSpeed:5, ballInHand:'anywhere',
    closedPockets:[],params:DEFAULT_PHYS, terrain:null,extraSegments:[],captureScale:1, seed:3,
    option:false,pushOutAvailable:false,energy:100,skills:[{slot:2,kind:'nudge',kinds:['nudge','well'],tier:5,ultimate:true}] };
  const decision=think(request);
  expect(decision.skill).toBe(2);
  const point=decision.shot!.cue!;
  expect(point).toBeDefined();
  expect(canPlaceCue(makeCaromTable(),request.balls,0,point.x,point.y,false)).toBe(true);
  expect(Math.hypot(point.x+0.5,point.y)).toBeLessThanOrEqual(0.185);
  const fixed=think({...request, balls:request.balls.map(b=>b.id===0?{...b,...point}:b), ballInHand:'none',skills:[],
    terrain: buildCast('well',5,2,makeCaromTable(),request.balls,0,decision.cast).terrain });
  expect(fixed.shot!.angle).toBeCloseTo(decision.shot!.angle, 10);
  expect(fixed.shot!.power).toBeCloseTo(decision.shot!.power, 10);
});
