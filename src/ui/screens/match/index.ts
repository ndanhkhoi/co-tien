import type { App, ScreenFactory } from '../../app';
import type { MatchOptions } from './options';
import { buildScreen } from './wiring';

export type { MatchOptions } from './options';

/** A match screen; `stage` has the app open the WebGL table before building it. */
export function matchScreen(opts: MatchOptions): ScreenFactory {
  return Object.assign((app: App) => buildScreen(app, opts), { stage: true });
}
