import { Container, Graphics, Sprite, Texture, type Application } from 'pixi.js';
import { predictAim } from '../core/aim';
import { ballStyle } from '../core/ball-styles';
import { cloneBalls, step, strike, type Ball } from '../core/physics';
import { powerToSpeed } from '../core/cue-power';
import { champion, sectArtUrl, type SkillDef } from '../game/content/sects';
import type { CueDef } from '../game/content/gear';
import type { Match } from '../game/match';
import { artImage, paintCue, paintGlow, paintNumberAtlas, paintShadow, paintTable } from './art';
import { BallMesh } from './ball-mesh';
import { SkillFx } from './skill-fx';

export interface AimView {
  angle: number;
  /** Shown cue pull-back 0..1 while charging. */
  pull: number;
  side: number;
  vert: number;
  power: number;
  showCue: boolean;
  showGuide: boolean;
  /** Cue aim stat as a 0.6–1.2 factor: longer object-ball hint for better cues. */
  guideScale: number;
  /** Fog mutator: the aim line stops short and the ghost ball is hidden. */
  fog: boolean;
  /** Pockets the player may tap when calling. */
  pocketChoices: boolean;
  /** Strike animation 0..1 (cue moving through). */
  strike: number;
}

interface Particle {
  s: Sprite;
  vx: number; vy: number;
  life: number; max: number;
  grow: number;
}

interface Falling {
  mesh: BallMesh;
  shadow: Sprite;
  fx: number; fy: number;
  tx: number; ty: number;
  t: number;
}

/**
 * Draws in table metres onto a Graphics that lives in pixel space, so circle
 * tessellation is based on on-screen size (metre-sized radii would turn into diamonds).
 */
class MetreGraphics {
  k = 1;
  constructor(readonly g: Graphics) {}
  clear() { this.g.clear(); return this; }
  moveTo(x: number, y: number) { this.g.moveTo(x * this.k, y * this.k); return this; }
  lineTo(x: number, y: number) { this.g.lineTo(x * this.k, y * this.k); return this; }
  circle(x: number, y: number, r: number) { this.g.circle(x * this.k, y * this.k, r * this.k); return this; }
  rect(x: number, y: number, w: number, h: number) { this.g.rect(x * this.k, y * this.k, w * this.k, h * this.k); return this; }
  stroke(style: { width: number; color: number; alpha?: number; cap?: 'round' | 'butt' | 'square'; join?: 'round' | 'miter' | 'bevel' }) { this.g.stroke(style); return this; }
  fill(style: { color: number; alpha?: number }) { this.g.fill(style); return this; }
}

export class TableView {
  readonly root = new Container();
  private world = new Container();
  private tableSprite = new Sprite();
  private under = new Container();
  private shadows = new Container();
  private ballsLayer = new Container();
  private guideG = new Graphics();
  private overlayG = new Graphics();
  private guide = new MetreGraphics(this.guideG);
  private overlay = new MetreGraphics(this.overlayG);
  private pxLayer = new Container();
  private pxTop = new Container();
  private cueShadow = new Sprite();
  private cue = new Sprite();
  private fxLayer = new Container();
  private fogSprite = new Sprite();
  private meshes = new Map<number, BallMesh>();
  private shadowSprites = new Map<number, Sprite>();
  private onTable = new Map<number, boolean>();
  private falling: Falling[] = [];
  private particles: Particle[] = [];
  private numbers: Texture;
  private shadowTex: Texture;
  private glowTex: Texture;
  private skills: SkillFx;
  private scale = 100;
  private artScale = 0;
  private shake = 0;
  private time = 0;
  private eagleCache: { key: string; paths: { id: number; pts: number[] }[] } | null = null;
  private lastPocketOf = new Map<number, number>();
  /** The shooter's declared call, shown to everyone (pocket -1 = ball chosen, pocket not yet). */
  calledShot: { ball: number | null; pocket: number } | null = null;
  /** Challenge marks: target pocket and cue-ball landing zone. */
  goal: { pocket?: number; zone?: [number, number, number] } | null = null;

  constructor(private app: Application, private match: Match) {
    this.numbers = paintNumberAtlas();
    this.shadowTex = paintShadow();
    this.glowTex = paintGlow();
    this.skills = new SkillFx(this.fxLayer, this.glowTex);
    this.root.addChild(this.world);
    this.pxLayer.addChild(this.guideG);
    this.pxTop.addChild(this.overlayG);
    this.world.addChild(this.tableSprite, this.under, this.shadows, this.pxLayer, this.cueShadow, this.ballsLayer, this.cue, this.pxTop, this.fxLayer, this.fogSprite);
    this.tableSprite.anchor.set(0.5);
    this.cue.anchor.set(0, 0.5);
    this.cueShadow.anchor.set(0, 0.5);
    this.cueShadow.tint = 0x000000;
    this.cueShadow.alpha = 0.28;
    this.fogSprite.anchor.set(0.5);
    this.fogSprite.visible = false;
    this.rebuildBalls();
    match.on((e) => {
      if (e.type === 'new-rack') this.rebuildBalls();
      if (e.type === 'phys' && e.e.t === 'pocket') this.lastPocketOf.set(e.e.id, e.e.pocket);
    });
  }

  get pxPerM() {
    return this.scale;
  }

  /** Outer size in metres including rails. */
  get outer() {
    const t = this.match.table;
    return { w: t.L + 2 * t.railWidth, h: t.W + 2 * t.railWidth };
  }

  layout(cx: number, cy: number, scale: number) {
    this.scale = scale;
    this.pxLayer.scale.set(1 / scale);
    this.pxTop.scale.set(1 / scale);
    this.guide.k = scale;
    this.overlay.k = scale;
    this.world.position.set(cx, cy);
    this.world.scale.set(scale);
    const res = this.app.renderer.resolution;
    const want = scale * res;
    if (Math.abs(want - this.artScale) / Math.max(1, this.artScale) > 0.08) this.paintArt(want);
    for (const m of this.meshes.values()) m.setPixelRadius(this.match.table.R * scale * res);
  }

  /** Table and cue textures at the current pixel density; painted art is used once it has loaded. */
  private paintArt(want: number) {
    this.artScale = want;
    const skin = this.match.setup.tableSkin;
    const rail = artImage(sectArtUrl(skin.sect, 'rail'), () => this.paintArt(this.artScale));
    const art = paintTable(this.match.table, skin, want, rail);
    this.tableSprite.texture?.destroy(true);
    this.tableSprite.texture = art.texture;
    this.tableSprite.scale.set(1 / want);
    this.cue.scale.set(1 / want);
    this.cueShadow.scale.set(1 / want);
    this.refreshCue();
    this.paintFog(want);
  }

  private cueImage(c: CueDef): HTMLImageElement | null {
    if (!c.sect) return null;
    return artImage(sectArtUrl(c.sect, c.id.endsWith('-b') ? 'cue-b' : 'cue-a'), () => this.refreshCue());
  }

  /** Cue texture follows whoever is shooting. */
  refreshCue() {
    const want = this.artScale || this.scale;
    const c = this.match.current.cue;
    const cue = paintCue(c, want, this.cueImage(c));
    this.cue.texture = cue.texture;
    this.cueShadow.texture = cue.texture;
  }

  toTable(sx: number, sy: number): { x: number; y: number } {
    return { x: (sx - this.world.position.x) / this.scale, y: (sy - this.world.position.y) / this.scale };
  }

  toScreen(x: number, y: number): { x: number; y: number } {
    return { x: this.world.position.x + x * this.scale, y: this.world.position.y + y * this.scale };
  }

  private rebuildBalls() {
    for (const m of this.meshes.values()) m.mesh.destroy();
    for (const s of this.shadowSprites.values()) s.destroy();
    this.meshes.clear();
    this.shadowSprites.clear();
    this.onTable.clear();
    this.falling = [];
    const t = this.match.table;
    let seed = this.match.rackNo * 97;
    const rng = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (const b of this.match.balls) {
      const mesh = new BallMesh(ballStyle(t.kind, b.id), this.numbers, this.match.setup.tableSkin.cloth, rng);
      mesh.mesh.scale.set(t.R);
      mesh.setPixelRadius(t.R * this.scale * this.app.renderer.resolution);
      this.ballsLayer.addChild(mesh.mesh);
      this.meshes.set(b.id, mesh);
      const sh = new Sprite(this.shadowTex);
      sh.anchor.set(0.5);
      sh.width = sh.height = t.R * 2.7;
      this.shadows.addChild(sh);
      this.shadowSprites.set(b.id, sh);
      this.onTable.set(b.id, b.onTable);
    }
    this.eagleCache = null;
  }

  /** After a rewind the ball set is the same but positions jump; resync visibility. */
  resync() {
    for (const b of this.match.balls) {
      this.onTable.set(b.id, b.onTable);
      const m = this.meshes.get(b.id);
      if (m) {
        m.mesh.visible = b.onTable;
        m.setAlpha(1);
        m.mesh.scale.set(this.match.table.R);
      }
      const sh = this.shadowSprites.get(b.id);
      if (sh) {
        sh.visible = b.onTable;
        sh.alpha = 1;
      }
    }
    this.falling = [];
  }

  update(dt: number, aim: AimView | null) {
    this.time += dt;
    this.skills.update(dt);
    const t = this.match.table;
    const R = t.R;
    // Balls.
    for (const b of this.match.balls) {
      const mesh = this.meshes.get(b.id);
      const sh = this.shadowSprites.get(b.id);
      if (!mesh || !sh) continue;
      const was = this.onTable.get(b.id);
      if (was && !b.onTable) this.startFall(b, mesh, sh);
      if (!was && b.onTable) {
        // A ball can come back (scratch respot) before its drop animation ends: cancel the
        // drop, or it would finish by shrinking the ball into the pocket and hiding it.
        this.falling = this.falling.filter((f) => f.mesh !== mesh);
        sh.alpha = 1;
        mesh.mesh.visible = true;
        mesh.setAlpha(1);
        mesh.mesh.scale.set(R);
        sh.visible = true;
      }
      this.onTable.set(b.id, b.onTable);
      if (!b.onTable) {
        if (!this.falling.some((f) => f.mesh === mesh)) {
          mesh.mesh.visible = false;
          sh.visible = false;
        }
        continue;
      }
      mesh.mesh.position.set(b.x, b.y);
      sh.position.set(b.x + R * 0.28, b.y + R * 0.38);
      const w = Math.hypot(b.wx, b.wy, b.wz);
      if (w > 0) mesh.rotate(b.wx, b.wy, b.wz, w * dt);
    }
    this.updateFalling(dt);
    this.updateParticles(dt);
    this.drawOverlay(aim);
    this.drawAim(aim);
    // Fog follows the cue ball.
    if (this.match.setup.mutator === 'fog') {
      const cue = this.match.cueBall();
      this.fogSprite.visible = true;
      this.fogSprite.position.set(cue.x, cue.y);
    }
    // Screen shake.
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 2.5);
      const a = this.shake * this.shake * 0.012;
      this.world.pivot.set((Math.random() - 0.5) * a, (Math.random() - 0.5) * a);
    } else {
      this.world.pivot.set(0, 0);
    }
  }

  private startFall(b: Ball, mesh: BallMesh, sh: Sprite) {
    const pi = this.lastPocketOf.get(b.id);
    const pk = pi !== undefined ? this.match.table.pockets[pi] : null;
    const tx = pk ? pk.hx : mesh.mesh.position.x;
    const ty = pk ? pk.hy : mesh.mesh.position.y;
    this.falling.push({ mesh, shadow: sh, fx: mesh.mesh.position.x, fy: mesh.mesh.position.y, tx, ty, t: 0 });
    if (pk) this.burst(pk.hx, pk.hy, 0xefe8da, 10, 0.25);
  }

  private updateFalling(dt: number) {
    const R = this.match.table.R;
    this.falling = this.falling.filter((f) => {
      f.t += dt / 0.28;
      const k = Math.min(1, f.t);
      const e = k * k;
      f.mesh.mesh.position.set(f.fx + (f.tx - f.fx) * e, f.fy + (f.ty - f.fy) * e);
      f.mesh.mesh.scale.set(R * (1 - 0.45 * e));
      f.mesh.setAlpha(1 - e * 0.85);
      f.shadow.alpha = 1 - k;
      if (k >= 1) {
        f.mesh.mesh.visible = false;
        f.shadow.visible = false;
        f.shadow.alpha = 1;
        return false;
      }
      return true;
    });
  }

  private paintFog(pxPerM: number) {
    if (this.match.setup.mutator !== 'fog') return;
    const size = 4.2;
    const px = Math.min(2048, size * pxPerM * 0.25);
    const c = document.createElement('canvas');
    c.width = c.height = Math.round(px);
    const g = c.getContext('2d')!;
    const gr = g.createRadialGradient(px / 2, px / 2, px * 0.07, px / 2, px / 2, px * 0.2);
    gr.addColorStop(0, 'rgba(180,190,200,0)');
    gr.addColorStop(1, 'rgba(150,160,172,0.86)');
    g.fillStyle = gr;
    g.fillRect(0, 0, px, px);
    this.fogSprite.texture = Texture.from(c);
    this.fogSprite.width = this.fogSprite.height = size;
  }

  // ---------- Overlays ----------

  private drawOverlay(aim: AimView | null) {
    const g = this.overlay;
    const t = this.match.table;
    const m = this.match;
    g.clear();
    // Closed (ghost) pockets.
    for (const i of m.closedPockets) {
      const p = t.pockets[i];
      g.circle(p.hx, p.hy, p.hr * 0.95).fill({ color: 0x2a1240, alpha: 0.92 });
      g.circle(p.hx, p.hy, p.hr * 0.95).stroke({ width: 2, color: 0xb57bff, alpha: 0.6 + 0.3 * Math.sin(this.time * 4) });
      const s = p.hr * 0.4;
      g.moveTo(p.hx - s, p.hy - s).lineTo(p.hx + s, p.hy + s).moveTo(p.hx + s, p.hy - s).lineTo(p.hx - s, p.hy + s).stroke({ width: 2.5, color: 0xd8b4ff });
    }
    // Thiên Tượng: show exactly where and which way the land acts on this shot.
    const tr = m.omen?.terrain;
    if (tr) {
      const pulse = 0.5 + 0.5 * Math.sin(this.time * 2.5);
      for (const pa of tr.patches ?? []) {
        if (pa.r > t.L) continue; // table-wide sand: the banner says it
        const col = pa.slide > pa.roll ? 0x8cff5a : 0xeaf6ff;
        g.circle(pa.x, pa.y, pa.r).fill({ color: col, alpha: 0.16 + 0.05 * pulse });
        g.circle(pa.x, pa.y, pa.r).stroke({ width: 1.5, color: col, alpha: 0.55 });
      }
      for (const wl of tr.wells ?? []) {
        for (let i = 0; i < 3; i++) {
          g.circle(wl.x, wl.y, wl.r * ((i + ((this.time * 0.6) % 1)) / 3)).stroke({ width: 1.5, color: 0xb9a8ff, alpha: 0.6 * (1 - i / 3) });
        }
      }
      if (tr.force) {
        // Wind / tilt: arrows streaming across the cloth, scaled by the gust right now.
        const k = tr.gust ? 1 - tr.gust.amp + tr.gust.amp * Math.sin(tr.gust.omega * this.time) : 1;
        const len = Math.hypot(tr.force.x, tr.force.y) || 1;
        const ux = (tr.force.x / len) * Math.sign(k || 1);
        const uy = (tr.force.y / len) * Math.sign(k || 1);
        const a = 0.25 + 0.5 * Math.abs(k);
        for (let i = -2; i <= 2; i++) {
          for (let j = -1; j <= 1; j++) {
            const drift = ((this.time * 0.25) % 0.4) - 0.2;
            const cx = (i * t.L) / 5 + ux * drift;
            const cy = (j * t.W) / 3 + uy * drift;
            const s = 0.05;
            g.moveTo(cx - ux * s, cy - uy * s).lineTo(cx + ux * s, cy + uy * s)
              .moveTo(cx + ux * s - (ux * 0.4 - uy * 0.3) * s, cy + uy * s - (uy * 0.4 + ux * 0.3) * s).lineTo(cx + ux * s, cy + uy * s)
              .lineTo(cx + ux * s - (ux * 0.4 + uy * 0.3) * s, cy + uy * s - (uy * 0.4 - ux * 0.3) * s)
              .stroke({ width: 2, color: 0xffffff, alpha: a * 0.6 });
          }
        }
      }
    }
    for (const sg of m.omen?.segments ?? []) {
      g.moveTo(sg.ax, sg.ay).lineTo(sg.bx, sg.by).stroke({ width: 7, color: 0x5a3b1d, alpha: 0.95 });
      g.moveTo(sg.ax, sg.ay).lineTo(sg.bx, sg.by).stroke({ width: 2, color: 0x9c7a4a, alpha: 0.9 });
    }
    // Challenge goal.
    if (this.goal) {
      const pulse = 0.5 + 0.5 * Math.sin(this.time * 4);
      if (this.goal.pocket !== undefined) {
        const p = t.pockets[this.goal.pocket];
        g.circle(p.hx, p.hy, p.hr * (1.05 + pulse * 0.12)).stroke({ width: 3, color: 0xffd34d, alpha: 0.6 + pulse * 0.4 });
      }
      if (this.goal.zone) {
        const [zx, zy, zr] = this.goal.zone;
        g.circle(zx, zy, zr).fill({ color: 0x3ddc84, alpha: 0.13 + pulse * 0.07 });
        g.circle(zx, zy, zr).stroke({ width: 2, color: 0x8af5b8, alpha: 0.8 });
      }
    }
    // Bomb ball.
    if (m.bombId >= 0 && !m.bombUsed) {
      const b = m.balls.find((x) => x.id === m.bombId);
      if (b && b.onTable) {
        const pulse = 0.5 + 0.5 * Math.sin(this.time * 7);
        g.circle(b.x, b.y, t.R * (1.35 + pulse * 0.25)).stroke({ width: 2, color: 0xff3b30, alpha: 0.55 + pulse * 0.4 });
        g.circle(b.x, b.y - t.R * 1.1, t.R * 0.22).fill({ color: 0xffd34d, alpha: 0.6 + pulse * 0.4 });
      }
    }
    // Called shot: visible to both players from the call until the result.
    if (this.calledShot) {
      const pulse = 0.5 + 0.5 * Math.sin(this.time * 6);
      const cs = this.calledShot;
      if (cs.pocket >= 0) {
        const p = t.pockets[cs.pocket];
        g.circle(p.hx, p.hy, p.hr * (1.02 + pulse * 0.1)).stroke({ width: 3.5, color: 0xffc531, alpha: 0.95 });
        g.circle(p.hx, p.hy, p.hr * (1.3 + pulse * 0.25)).stroke({ width: 2, color: 0xffc531, alpha: 0.5 * (1 - pulse) + 0.15 });
      }
      if (cs.ball !== null) {
        const b = m.balls.find((x) => x.id === cs.ball);
        if (b && b.onTable) g.circle(b.x, b.y, t.R * (1.3 + pulse * 0.12)).stroke({ width: 2.5, color: 0xffc531, alpha: 0.9 });
      }
    }
    if (!aim) return;
    // Ball in hand.
    if (m.canMoveCue && m.current.kind === 'human') {
      if (m.placing === 'kitchen') {
        g.rect(-t.L / 2, -t.W / 2, t.L / 4, t.W).fill({ color: 0xffffff, alpha: 0.05 });
        g.moveTo(t.headStringX, -t.W / 2).lineTo(t.headStringX, t.W / 2).stroke({ width: 1.5, color: 0xffffff, alpha: 0.35 });
      }
      if (m.placing === 'nudge' && m.nudgeOrigin) {
        g.circle(m.nudgeOrigin.x, m.nudgeOrigin.y, 0.12).stroke({ width: 1.5, color: 0x7fd6ff, alpha: 0.7 });
      }
      const c = m.cueBall();
      const pulse = 0.5 + 0.5 * Math.sin(this.time * 5);
      g.circle(c.x, c.y, t.R * (1.6 + pulse * 0.3)).stroke({ width: 2, color: 0xffffff, alpha: 0.4 + pulse * 0.4 });
    }
    // Pockets the shooter can tap to call.
    if (aim.pocketChoices) {
      t.pockets.forEach((p, i) => {
        if (m.closedPockets.includes(i) || this.calledShot?.pocket === i) return;
        g.circle(p.hx, p.hy, p.hr * 0.9).stroke({ width: 1.5, color: 0xffffff, alpha: 0.35 });
      });
    }
  }

  private drawAim(aim: AimView | null) {
    const g = this.guide;
    g.clear();
    const m = this.match;
    if (!aim || m.phase !== 'aim') {
      this.cue.visible = this.cueShadow.visible = !!aim && aim.strike > 0 && aim.strike < 1;
      if (!this.cue.visible) return;
    }
    const t = m.table;
    const R = t.R;
    const cue = m.cueBall();
    const dx = Math.cos(aim!.angle);
    const dy = Math.sin(aim!.angle);

    // Cue stick.
    this.cue.visible = this.cueShadow.visible = aim!.showCue;
    if (aim!.showCue) {
      const gap = R * 1.1 + aim!.pull * 0.22 * (1 - aim!.strike) - aim!.strike * R * 0.1;
      const ox = cue.x - dx * gap + (-dy) * aim!.side * R * 0.5;
      const oy = cue.y - dy * gap + dx * aim!.side * R * 0.5;
      this.cue.position.set(ox, oy);
      this.cue.rotation = aim!.angle + Math.PI;
      this.cueShadow.position.set(ox + R * 0.5, oy + R * 0.9);
      this.cueShadow.rotation = this.cue.rotation;
    }
    if (!aim!.showGuide || m.phase !== 'aim') return;

    if (m.eagle) {
      this.drawEagle(aim!);
      return;
    }
    // Line to the first thing the cue ball meets and the ghost ball there, plus a short
    // chevron hint of where the object ball leaves: enough to read the cut, never a full path.
    const pred = predictAim(t, m.balls, m.cueId(), aim!.angle, m.obstacles());
    const legal = m.legalTargets();
    const illegal = pred.hitBall !== null && legal.length > 0 && !legal.includes(pred.hitBall) && !m.state.pushOutAvailable;
    if (aim!.fog) {
      // Fog: the line fades out before reaching anything, no ghost ball.
      const maxLen = 0.35 + 0.5 * aim!.guideScale;
      const dist = Math.hypot(pred.gx - cue.x, pred.gy - cue.y);
      if (dist > maxLen) {
        g.moveTo(cue.x + dx * R, cue.y + dy * R).lineTo(cue.x + dx * maxLen, cue.y + dy * maxLen).stroke({ width: 1.6, color: 0xffffff, alpha: 0.6 });
        return;
      }
    }
    g.moveTo(cue.x + dx * R, cue.y + dy * R).lineTo(pred.gx - dx * R, pred.gy - dy * R).stroke({ width: 1.6, color: 0xffffff, alpha: 0.85 });
    g.circle(pred.gx, pred.gy, R).stroke({ width: 1.6, color: illegal ? 0xff4d4d : 0xffffff, alpha: 0.9 });
    if (illegal) {
      const sx = R * 0.55;
      g.moveTo(pred.gx - sx, pred.gy - sx).lineTo(pred.gx + sx, pred.gy + sx).moveTo(pred.gx + sx, pred.gy - sx).lineTo(pred.gx - sx, pred.gy + sx).stroke({ width: 2, color: 0xff4d4d });
      return;
    }
    const obj = pred.hitBall !== null ? m.balls.find((b) => b.id === pred.hitBall) : null;
    if (obj && pred.objDir) {
      const ux = pred.objDir.x;
      const uy = pred.objDir.y;
      const n = aim!.guideScale >= 1 ? 4 : 3;
      for (let i = 0; i < n; i++) {
        const d = R * (1.55 + i * 0.95);
        const tipX = obj.x + ux * (d + R * 0.32);
        const tipY = obj.y + uy * (d + R * 0.32);
        const bx = obj.x + ux * d;
        const by = obj.y + uy * d;
        const w = R * 0.5;
        g.moveTo(bx - uy * w, by + ux * w).lineTo(tipX, tipY).lineTo(bx + uy * w, by - ux * w)
          .stroke({ width: 2.2, color: 0xffc531, alpha: 0.95 - i * 0.22, cap: 'round', join: 'round' });
      }
    }
  }

  /** Thần Nhãn: simulate the exact shot and draw every moving ball's path. */
  private drawEagle(aim: AimView) {
    const m = this.match;
    const key = `${aim.angle.toFixed(4)}|${aim.power.toFixed(2)}|${aim.side.toFixed(2)}|${aim.vert.toFixed(2)}|${m.cueBall().x.toFixed(3)}`;
    if (!this.eagleCache || this.eagleCache.key !== key) {
      const balls = cloneBalls(m.balls);
      const cue = balls.find((b) => b.id === m.cueId())!;
      const power = Math.max(aim.power, 0.35);
      strike(cue, m.table.R, { angle: aim.angle, speed: powerToSpeed(power, m.vmax()), side: aim.side, vert: aim.vert });
      const world = { table: m.table, balls, params: m.params, closedPockets: m.closedPockets, extraSegments: m.obstacles(), terrain: m.omen?.terrain ?? null, time: 0 };
      const paths = new Map<number, number[]>();
      for (const b of balls) paths.set(b.id, [b.x, b.y]);
      for (let i = 0; i < 600; i++) {
        const moving = step(world, 1 / 30, null);
        for (const b of balls) {
          const p = paths.get(b.id)!;
          if (b.onTable && (p[p.length - 2] !== b.x || p[p.length - 1] !== b.y)) p.push(b.x, b.y);
        }
        if (!moving) break;
      }
      this.eagleCache = { key, paths: [...paths.entries()].filter(([, p]) => p.length > 4).map(([id, pts]) => ({ id, pts })) };
    }
    const g = this.guide;
    for (const p of this.eagleCache.paths) {
      const col = p.id === m.cueId() ? 0xffffff : 0xffd34d;
      g.moveTo(p.pts[0], p.pts[1]);
      for (let i = 2; i < p.pts.length; i += 2) g.lineTo(p.pts[i], p.pts[i + 1]);
      g.stroke({ width: 1.6, color: col, alpha: 0.75 });
    }
  }

  // ---------- Effects ----------

  burst(x: number, y: number, color: number, count: number, speed: number, size = 0.012) {
    for (let i = 0; i < count; i++) {
      const s = new Sprite(this.glowTex);
      s.anchor.set(0.5);
      s.tint = color;
      s.blendMode = 'normal'; // ink droplets, not light
      s.width = s.height = size * (0.6 + Math.random());
      s.position.set(x, y);
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.3 + Math.random());
      this.fxLayer.addChild(s);
      this.particles.push({ s, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, max: 0.35 + Math.random() * 0.4, grow: 1 });
    }
  }

  /** Expanding ring (pocket, explosion). */
  ring(x: number, y: number, color: number, size: number) {
    const s = new Sprite(this.glowTex);
    s.anchor.set(0.5);
    s.tint = color;
    s.blendMode = 'normal';
    s.width = s.height = size * 0.3;
    s.position.set(x, y);
    this.fxLayer.addChild(s);
    this.particles.push({ s, vx: 0, vy: 0, life: 0, max: 0.45, grow: size * 6 });
  }

  /** Cast animation on the table in the caster's sect style. */
  skillFx(championId: string, skill: SkillDef, _side: number) {
    const m = this.match;
    const kinds = skill.kinds.map((k) => m.effectiveKind(k));
    const pockets = m.table.pockets.map((p) => ({ x: p.hx, y: p.hy }));
    // Seals show on the pockets they close; pocket-boosting skills on the open ones.
    const sealed = m.closedPockets.map((i) => pockets[i]);
    const open = pockets.filter((_, i) => !m.closedPockets.includes(i));
    const cue = () => {
      const c = m.cueBall();
      return { x: c.x, y: c.y };
    };
    for (const k of kinds) {
      this.skills.play([k], champion(championId).sect, skill.slot === 2, cue, k === 'seal' ? (sealed.length ? sealed : open) : open);
    }
    if (skill.slot === 2) this.addShake(0.8);
  }

  addShake(k: number) {
    this.shake = Math.min(1.2, this.shake + k);
  }

  private updateParticles(dt: number) {
    this.particles = this.particles.filter((p) => {
      p.life += dt;
      const k = p.life / p.max;
      if (k >= 1) {
        p.s.destroy();
        return false;
      }
      p.s.x += p.vx * dt;
      p.s.y += p.vy * dt;
      p.vx *= 0.92;
      p.vy *= 0.92;
      if (p.grow > 1) {
        p.s.width = p.s.height = p.s.width + p.grow * dt;
      }
      p.s.alpha = 1 - k;
      return true;
    });
  }

  destroy() {
    this.root.destroy({ children: true });
  }
}
