import { Container, Graphics, Sprite, Texture, type Application } from 'pixi.js';
import { ballStyle } from '../core/ball-styles';
import { cloneBalls, step, strike, type Ball } from '../core/physics';
import { powerToSpeed } from '../core/cue-power';
import type { Match } from '../game/match';
import { paintCue, paintGlow, paintNumberAtlas, paintShadow, paintTable } from './art';
import { BallMesh } from './ball-mesh';

export interface AimView {
  angle: number;
  /** Shown cue pull-back 0..1 while charging. */
  pull: number;
  side: number;
  vert: number;
  power: number;
  showCue: boolean;
  showGuide: boolean;
  /** Fraction of the normal guide length (fog, cue aim stat). */
  guideScale: number;
  /** Called pocket to highlight. */
  callPocket: number | null;
  callBall: number | null;
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
  stroke(style: { width: number; color: number; alpha?: number }) { this.g.stroke(style); return this; }
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
  private scale = 100;
  private artScale = 0;
  private shake = 0;
  private time = 0;
  private eagleCache: { key: string; paths: { id: number; pts: number[] }[] } | null = null;
  private lastPocketOf = new Map<number, number>();
  /** Challenge marks: target pocket and cue-ball landing zone. */
  goal: { pocket?: number; zone?: [number, number, number] } | null = null;

  constructor(private app: Application, private match: Match) {
    this.numbers = paintNumberAtlas();
    this.shadowTex = paintShadow();
    this.glowTex = paintGlow();
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
    if (Math.abs(want - this.artScale) / Math.max(1, this.artScale) > 0.08) {
      this.artScale = want;
      const art = paintTable(this.match.table, this.match.setup.tableSkin, want);
      this.tableSprite.texture?.destroy(true);
      this.tableSprite.texture = art.texture;
      this.tableSprite.scale.set(1 / want);
      const cue = paintCue(this.match.current.cue, want);
      this.cue.texture = cue.texture;
      this.cueShadow.texture = cue.texture;
      this.cue.scale.set(1 / want);
      this.cueShadow.scale.set(1 / want);
      this.paintFog(want);
    }
    for (const m of this.meshes.values()) m.setPixelRadius(this.match.table.R * scale * res);
  }

  /** Cue texture follows whoever is shooting. */
  refreshCue() {
    const want = this.artScale || this.scale;
    const cue = paintCue(this.match.current.cue, want);
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
    }
    this.falling = [];
  }

  update(dt: number, aim: AimView | null) {
    this.time += dt;
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
    if (pk) this.burst(pk.hx, pk.hy, 0xfff3c4, 10, 0.25);
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
    // Pocket choices / called pocket.
    if (aim.pocketChoices) {
      t.pockets.forEach((p, i) => {
        if (m.closedPockets.includes(i)) return;
        const on = aim.callPocket === i;
        g.circle(p.hx, p.hy, p.hr * (on ? 1.05 : 0.9)).stroke({ width: on ? 3 : 1.5, color: on ? 0xffd34d : 0xffffff, alpha: on ? 0.95 : 0.35 });
      });
    }
    if (aim.callBall !== null) {
      const b = m.balls.find((x) => x.id === aim.callBall);
      if (b && b.onTable) g.circle(b.x, b.y, t.R * 1.3).stroke({ width: 2, color: 0xffd34d, alpha: 0.85 });
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
    // Only a short pointer off the cue ball: where it is going, not what it will hit.
    const len = 0.05 + 0.05 * aim!.guideScale;
    const r0 = R * 1.25;
    const tipX = cue.x + dx * (r0 + len);
    const tipY = cue.y + dy * (r0 + len);
    g.moveTo(cue.x + dx * r0, cue.y + dy * r0).lineTo(tipX - dx * R * 0.5, tipY - dy * R * 0.5).stroke({ width: 2, color: 0xffffff, alpha: 0.8 });
    const hw = R * 0.42;
    const bx = tipX - dx * R * 0.75;
    const by = tipY - dy * R * 0.75;
    g.moveTo(tipX, tipY).lineTo(bx - dy * hw, by + dx * hw).lineTo(bx + dy * hw, by - dx * hw).lineTo(tipX, tipY).fill({ color: 0xffffff, alpha: 0.85 });
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
      const world = { table: m.table, balls, params: m.params, closedPockets: m.closedPockets, extraSegments: m.closedPockets.map((i) => m.table.pockets[i].mouth) };
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
      s.blendMode = 'add';
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
    s.blendMode = 'add';
    s.width = s.height = size * 0.3;
    s.position.set(x, y);
    this.fxLayer.addChild(s);
    this.particles.push({ s, vx: 0, vy: 0, life: 0, max: 0.45, grow: size * 6 });
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
