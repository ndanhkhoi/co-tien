import type { Sprite } from 'pixi.js';
import type { Match } from '../game/match';
import type { BallMesh } from './ball-mesh';
import type { BallPaint } from './ball-layers';

/** One density update for every painted ball mesh in a layer. */
export function pixelRadius(
  match: Match,
  paint: Pick<BallPaint, 'scale' | 'resolution'>,
  meshes: Iterable<BallMesh>,
): void {
  const pixels = match.table.R * paint.scale() * paint.resolution();
  for (const mesh of meshes) mesh.setPixelRadius(pixels);
}

/** Release meshes and their shadows together, then clear both maps. */
export function destroyMeshes(meshes: Map<unknown, BallMesh>, shadows: Map<unknown, Sprite>): void {
  for (const mesh of meshes.values()) mesh.destroy();
  for (const shadow of shadows.values()) shadow.destroy();
  meshes.clear();
  shadows.clear();
}
