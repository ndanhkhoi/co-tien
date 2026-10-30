import { Sprite, type Texture } from 'pixi.js';
import { ballStyle } from '../core/ball-styles';
import type { Match } from '../game/match';
import { BallMesh } from './ball-mesh';
import { destroyMeshes, pixelRadius } from './ball-layer-utils';
import type { Texture as PaintTexture } from 'pixi.js';

export interface DecoySpot { x: number; y: number }

/** Ball meshes and shadows for Bi Giả, rendered by the same ball shader as object balls. */
export interface DecoyPaint {
  layer: { addChild(child: unknown): void };
  shadowLayer: { addChild(child: unknown): void };
  numbers: PaintTexture;
  shadowTex: Texture;
  scale(): number;
  resolution(): number;
}

export class DecoyBalls {
  private meshes = new Map<string, BallMesh>();
  private shadows = new Map<string, Sprite>();

  constructor(private match: Match, private paint: DecoyPaint) {}

  sync(): void {
    const live = this.liveSpots();
    this.removeStale(live);
    for (const [key, spot] of live) this.pose(key, spot);
  }

  setPixelRadius(): void {
    pixelRadius(this.match, this.paint, this.meshes.values());
  }

  destroy(): void {
    destroyMeshes(this.meshes, this.shadows);
  }

  private liveSpots(): Map<string, DecoySpot> {
    const live = new Map<string, DecoySpot>();
    for (const effect of this.match.activeEffects) {
      if (effect.kind !== 'decoy') continue;
      const spot = decoyCentre(effect.segments, this.match.table.R);
      if (spot) live.set(`${effect.slot}:${spot.x.toFixed(3)}:${spot.y.toFixed(3)}`, spot);
    }
    return live;
  }

  private removeStale(live: Map<string, DecoySpot>): void {
    for (const [key, mesh] of this.meshes) {
      if (live.has(key)) continue;
      mesh.destroy();
      this.shadows.get(key)?.destroy();
      this.shadows.delete(key);
      this.meshes.delete(key);
    }
  }

  private pose(key: string, spot: DecoySpot): void {
    let mesh = this.meshes.get(key);
    if (!mesh) {
      const t = this.match.table;
      mesh = new BallMesh(objectStyle(this.match), this.paint.numbers, this.match.setup.tableSkin.cloth, Math.random);
      mesh.mesh.scale.set(t.R);
      mesh.mesh.position.set(spot.x, spot.y);
      this.paint.layer.addChild(mesh.mesh);
      this.meshes.set(key, mesh);
      const shadow = new Sprite(this.paint.shadowTex);
      shadow.anchor.set(0.5);
      shadow.width = shadow.height = t.R * 2.7;
      shadow.position.set(spot.x + t.R * 0.28, spot.y + t.R * 0.38);
      this.paint.shadowLayer.addChild(shadow);
      this.shadows.set(key, shadow);
      this.setPixelRadius();
      return;
    }
    const t = this.match.table;
    mesh.mesh.position.set(spot.x, spot.y);
    mesh.mesh.visible = true;
    this.shadows.get(key)?.position.set(spot.x + t.R * 0.28, spot.y + t.R * 0.38);
  }
}

/** Pick a real numbered object ball on the cloth; decoys must not look like cue balls. */
function objectStyle(m: Match): ReturnType<typeof ballStyle> {
  const id = m.balls.find((b) => b.onTable && b.id > 0)?.id ?? 1;
  return ballStyle(m.table.kind, id);
}

/** A decoy polygon is a regular ball circle; its segment midpoints recover that centre. */
function decoyCentre(segments: { ax: number; ay: number; bx: number; by: number }[], r: number): DecoySpot | null {
  if (!segments.length) return null;
  let x = 0;
  let y = 0;
  for (const s of segments) {
    x += (s.ax + s.bx) / 2;
    y += (s.ay + s.by) / 2;
  }
  const c = { x: x / segments.length, y: y / segments.length };
  return Math.hypot(segments[0].ax - c.x, segments[0].ay - c.y) > r * 1.2 ? null : c;
}
