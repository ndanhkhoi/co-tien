import type { App, Screen } from '../../app';
import type { MatchOptions } from './options';
import { buildScreen } from './wiring';

export type { MatchOptions } from './options';

export function matchScreen(opts: MatchOptions) {
  return (app: App): Screen => buildScreen(app, opts);
}
