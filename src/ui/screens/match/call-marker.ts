import type { MatchCtx } from './context';
import { callBallId } from './hud';

export function currentCall(ctx: MatchCtx): { ball: number | null; pocket: number } | null {
  const { match, flags, aiCall, firedCall } = ctx;
  if (match.phase === 'rolling') return firedCall;
  if (match.phase !== 'aim' || match.callType() === 'none') return null;
  if (flags.aiActing || match.current.kind === 'ai') return aiCall;
  const ball = match.callType() === 'ball-pocket' ? callBallId(ctx) : 8;
  return flags.callPocket === null && flags.callBall === null ? null : { ball, pocket: flags.callPocket ?? -1 };
}
