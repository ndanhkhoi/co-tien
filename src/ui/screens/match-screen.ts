import type { App, Screen } from '../app';
import type { MatchOptions } from './match/options';
import { buildScreen } from './match/wiring';

export type { MatchOptions } from './match/options';

export function matchScreen(opts: MatchOptions) {
  return (app: App): Screen => buildScreen(app, opts);
}
