import { Container, Rectangle, type Application, type Texture } from 'pixi.js';
import { ballStyle } from '../core/ball-styles';
import type { Match } from '../game/match';
import { BallMesh } from './ball-mesh';

/**
 * Ball portraits for DOM labels, kept for the whole session: each one costs a GPU read-back and a
 * PNG encode, and the same balls on the same cloth return in every match.
 */
const portraits = new Map<string, string>();

/** A portrait of ball `id` drawn by the same shader as the table, number facing the viewer. */
export function ballPortrait(view: { app: Application; match: Match; numbers: Texture }, id: number, px: number): string {
  const { app, match, numbers } = view;
  const res = Math.min(3, Math.max(1, window.devicePixelRatio || 1));
  const key = `${match.table.kind}|${match.setup.tableSkin.cloth}|${id}|${px}|${res}`;
  const hit = portraits.get(key);
  if (hit) return hit;
  const r = px / 2;
  const mesh = new BallMesh(ballStyle(match.table.kind, id), numbers, match.setup.tableSkin.cloth, () => 0.5);
  mesh.rot.set([1, 0, 0, 0, 1, 0, 0, 0, 1]);
  mesh.rotate(1, 0, 0, -0.35);
  mesh.mesh.scale.set(r);
  mesh.mesh.position.set(r, r);
  mesh.setPixelRadius(r * res);
  const holder = new Container();
  holder.addChild(mesh.mesh);
  const url = app.renderer.extract.canvas({ target: holder, resolution: res, frame: new Rectangle(0, 0, px, px), clearColor: [0, 0, 0, 0] }).toDataURL!('image/png');
  mesh.destroy();
  holder.destroy();
  portraits.set(key, url);
  return url;
}
