import { Sprite, type Texture } from 'pixi.js';
import { ballStyle } from '../core/ball-styles';
import type { Match } from '../game/match';
import { BallMesh } from './ball-mesh';
import { destroyMeshes, pixelRadius } from './ball-layer-utils';

export interface BallPaint {
  layer: { addChild(child: unknown): void };
  shadowLayer: { addChild(child: unknown): void };
  numbers: Texture;
  shadowTex: Texture;
  scale(): number;
  resolution(): number;
}

/** Real ball meshes, shadows and presence bookkeeping for one table. */
export class BallLayers {
  readonly meshes = new Map<number, BallMesh>();
  readonly shadows = new Map<number, Sprite>();
  private onTable = new Map<number, boolean>();

  constructor(private match: Match, private paint: BallPaint) {}

  rebuild(): void {
    this.destroy();
    const t = this.match.table;
    let seed = this.match.rackNo * 97;
    const rng = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (const b of this.match.balls) {
      const mesh = new BallMesh(ballStyle(t.kind, b.id), this.paint.numbers, this.match.setup.tableSkin.cloth, rng);
      mesh.mesh.scale.set(t.R);
      mesh.setPixelRadius(t.R * this.paint.scale() * this.paint.resolution());
      this.paint.layer.addChild(mesh.mesh);
      this.meshes.set(b.id, mesh);
      const sh = new Sprite(this.paint.shadowTex);
      sh.anchor.set(0.5);
      sh.width = sh.height = t.R * 2.7;
      this.paint.shadowLayer.addChild(sh);
      this.shadows.set(b.id, sh);
      this.onTable.set(b.id, b.onTable);
    }
  }

  setPixelRadius(): void {
    pixelRadius(this.match, this.paint, this.meshes.values());
  }

  resync(): void {
    for (const b of this.match.balls) {
      this.onTable.set(b.id, b.onTable);
      this.posePresence(b);
    }
  }

  /** First frame off the cloth: false so the caller can start its pocket-fall animation. */
  leftTable(b: { id: number; onTable: boolean }): boolean {
    const was = this.onTable.get(b.id) ?? b.onTable;
    this.onTable.set(b.id, b.onTable);
    return was && !b.onTable;
  }

  /** A ball returned before its drop animation ended: cancel that drop. */
  returned(b: { id: number; onTable: boolean }, mesh: BallMesh, shadow: Sprite): boolean {
    const was = this.onTable.get(b.id) ?? b.onTable;
    if (!(!was && b.onTable)) return false;
    mesh.mesh.visible = true;
    mesh.setAlpha(1);
    mesh.mesh.scale.set(this.match.table.R);
    shadow.visible = true;
    shadow.alpha = 1;
    this.onTable.set(b.id, b.onTable);
    return true;
  }

  destroy(): void {
    destroyMeshes(this.meshes, this.shadows);
    this.onTable.clear();
  }

  private posePresence(b: { id: number; onTable: boolean }): void {
    const mesh = this.meshes.get(b.id);
    const shadow = this.shadows.get(b.id);
    if (mesh) {
      mesh.mesh.visible = b.onTable;
      mesh.setAlpha(1);
      mesh.mesh.scale.set(this.match.table.R);
    }
    if (shadow) {
      shadow.visible = b.onTable;
      shadow.alpha = 1;
    }
  }
}
