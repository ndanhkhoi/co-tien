import { drawAimLock, drawCue, drawDriftNote, drawEagleReference, drawJumpPath, drawShotHint, hasPathPreview } from './aim-drawing';
import { drawEagle, type EagleRun } from './eagle-preview';
import { Container, Graphics, Sprite, Texture, type Application } from 'pixi.js';
import { FrameDiff, MetreGraphics } from './frame-diff';
import { drawOverlay, type OverlayView } from './table-overlays';
import { ballStyle } from '../core/ball-styles';
import type { Ball } from '../core/physics';
import { champion, sectArtUrl, type SkillDef } from '../game/content/sects';
import type { CueDef } from '../game/content/gear';
import type { Match } from '../game/match';
import { artImage, paintCue, paintGlow, paintNumberAtlas, paintShadow, paintTable } from './art';
import { BallMesh } from './ball-mesh';
import { SkillFx } from './skill-fx';
import { OmenArt } from './omen-art';
import { ballPortrait } from './ball-portrait';

export interface AimView {
  /** Cue elevation in radians. */
  elevation?: number;
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

export class TableView {
  readonly root = new Container();
  private world = new Container();
  private tableSprite = new Sprite();
  private under = new Container();
  private shadows = new Container();
  private ballsLayer = new Container();
  private guideG = new Graphics();
  private overlayG = new Graphics();
  private frame = new FrameDiff();
  private guide = new MetreGraphics(this.guideG, this.frame);
  private overlay = new MetreGraphics(this.overlayG, this.frame);
  private readonly overlayView: OverlayView;
  /** Frame drawing: whether the picture changed, a window of forced frames, the last draw time. */
  private dirty = true;
  private forceUntil = 0;
  private lastDrawn = 0;
  private readonly invalidateSoon = () => this.invalidate();
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
  private omenArt: OmenArt;
  private disposed = false;
  private scale = 100;
  private artScale = 0;
  private shake = 0;
  private time = 0;
  private eagle: { key: string; runs: EagleRun[] } | null = null;
  private lastPocketOf = new Map<number, number>();
  /** The shooter's declared call, shown to everyone (pocket -1 = ball chosen, pocket not yet). */
  calledShot: { ball: number | null; pocket: number } | null = null;
  /** Challenge marks: target pocket and cue-ball landing zone. */
  goal: { pocket?: number; zone?: [number, number, number] } | null = null;

  constructor(private app: Application, private match: Match) {
    this.overlayView = { guide: this.guide, overlay: this.overlay, match, calledShot: null, goal: null, time: 0 };
    this.numbers = paintNumberAtlas();
    this.shadowTex = paintShadow();
    this.glowTex = paintGlow();
    this.omenArt = new OmenArt(match);
    this.under.addChild(this.omenArt.layer);
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
    // A resized, restored or re-shown canvas may come back blank: draw it whatever it holds.
    window.addEventListener('resize', this.invalidateSoon);
    document.addEventListener('visibilitychange', this.invalidateSoon);
    app.canvas.addEventListener('webglcontextrestored', this.invalidateSoon);
    match.on((e) => {
      if (this.disposed) return;
      if (e.type === 'shot') this.omenArt.startShot();
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

  /** Fit the entire rail inside the space left by the measured HUD, preserving table proportions. */
  fit(width: number, height: number, insets: { left: number; right: number; top: number; bottom: number }) {
    const w = Math.max(1, width - insets.left - insets.right);
    const h = Math.max(1, height - insets.top - insets.bottom);
    const scale = Math.min(w / this.outer.w, h / this.outer.h);
    const cx = insets.left + w / 2;
    const cy = insets.top + h / 2;
    this.layout(cx, cy, scale);
    return { cx, cy, scale };
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
    this.invalidate();
  }

  /**
   * Whether the canvas must be drawn this frame. A still table (aiming, waiting for the AI,
   * reading an announcement) is left on screen as it is instead of being drawn 60–120 times a second.
   */
  shouldRender(now = performance.now()): boolean {
    // A slow heartbeat as well, in case the browser ever drops the canvas contents unannounced.
    const due = this.dirty || now < this.forceUntil || now - this.lastDrawn > 1000;
    if (due) {
      this.dirty = false;
      this.lastDrawn = now;
    }
    return due;
  }

  /** Draw the next frames whatever they hold. */
  invalidate(ms = 300) {
    this.forceUntil = Math.max(this.forceUntil, performance.now() + ms);
  }

  /** Write every visible transform and texture under `o` into the frame description. */
  private describe(o: Container) {
    const f = this.frame;
    if (!o.visible) {
      f.add(0);
      return;
    }
    f.add(o.x); f.add(o.y); f.add(o.scale.x); f.add(o.scale.y); f.add(o.rotation); f.add(o.alpha);
    f.add(o.pivot.x); f.add(o.pivot.y); f.add(o.mask ? 1 : 2);
    if (o instanceof Sprite) {
      f.add(o.texture.uid);
      f.add(o.tint);
    }
    for (const c of o.children) this.describe(c);
  }

  private repaintQueued = false;

  /** Table and cue textures at the current pixel density; painted art is used once it has loaded. */
  private paintArt(want: number) {
    if (this.disposed) return;
    this.artScale = want;
    const skin = this.match.setup.tableSkin;
    // Several images may finish loading in the same moment: repaint once for all of them.
    const ready = () => {
      if (this.repaintQueued) return;
      this.repaintQueued = true;
      requestAnimationFrame(() => {
        this.repaintQueued = false;
        this.paintArt(this.artScale);
      });
    };
    const rail = artImage(sectArtUrl(skin.sect, 'rail'), ready);
    const art = paintTable({ t: this.match.table, skin, pxPerM: want }, rail);
    const previous = this.tableSprite.texture;
    this.tableSprite.texture = art.texture;
    dropTexture(previous);
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

  /** Cue texture follows whoever is shooting; each player's cue is painted once per pixel density. */
  refreshCue() {
    if (this.disposed) return;
    const want = this.artScale || this.scale;
    const c = this.match.current.cue;
    const img = this.cueImage(c);
    const key = `${c.id}|${want}|${img ? 'art' : 'plain'}`;
    let texture = this.cueTextures.get(key);
    if (!texture) {
      // A new density or the painting arriving replaces that cue's older texture.
      for (const [k, t] of this.cueTextures) {
        if (k.startsWith(`${c.id}|`) || !k.includes(`|${want}|`)) {
          dropTexture(t);
          this.cueTextures.delete(k);
        }
      }
      texture = paintCue(c, want, img).texture;
      this.cueTextures.set(key, texture);
    }
    this.cue.texture = texture;
    this.cueShadow.texture = texture;
  }
  private cueTextures = new Map<string, Texture>();

  toTable(sx: number, sy: number): { x: number; y: number } {
    return { x: (sx - this.world.position.x) / this.scale, y: (sy - this.world.position.y) / this.scale };
  }

  toScreen(x: number, y: number): { x: number; y: number } {
    return { x: this.world.position.x + x * this.scale, y: this.world.position.y + y * this.scale };
  }

  private rebuildBalls() {
    for (const m of this.meshes.values()) m.destroy();
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
    this.eagle = null;
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
    this.frame.begin();
    this.time += dt;
    this.skills.update(dt);
    this.omenArt.update(dt);
    const R = this.match.table.R;
    // Balls.
    for (const b of this.match.balls) {
      const mesh = this.meshes.get(b.id);
      const sh = this.shadowSprites.get(b.id);
      if (!mesh || !sh) continue;
      if (!this.syncBallPresence(b, mesh, sh, R)) continue;
      this.poseBall(b, mesh, sh, dt);
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
    this.describe(this.root);
    for (const m of this.meshes.values()) m.describe(this.frame);
    if (this.frame.changed()) this.dirty = true;
  }

  private syncBallPresence(b: Ball, mesh: BallMesh, sh: Sprite, R: number): boolean {
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
    if (b.onTable) return true;
    if (!this.falling.some((f) => f.mesh === mesh)) {
      mesh.mesh.visible = false;
      sh.visible = false;
    }
    return false;
  }

  private poseBall(b: Ball, mesh: BallMesh, sh: Sprite, dt: number) {
    const R = this.match.table.R;
    const height = b.z ?? 0;
    mesh.mesh.position.set(b.x, b.y - height * 0.7);
    mesh.mesh.scale.set(R * (1 + Math.min(height, 0.25) * 0.5));
    sh.alpha = 1 / (1 + height * 12);
    sh.position.set(b.x + R * 0.28, b.y + R * 0.38);
    const w = Math.hypot(b.wx, b.wy, b.wz);
    if (w > 0) mesh.rotate(b.wx, b.wy, b.wz, w * dt);
  }

  private startFall(b: Ball, mesh: BallMesh, sh: Sprite) {
    const pi = this.lastPocketOf.get(b.id);
    const pk = pi !== undefined ? this.match.table.pockets[pi] : null;
    const tx = pk ? pk.hx : mesh.mesh.position.x;
    const ty = pk ? pk.hy : mesh.mesh.position.y;
    this.falling.push({ mesh, shadow: sh, fx: mesh.mesh.position.x, fy: mesh.mesh.position.y, tx, ty, t: 0 });
    if (pk) this.burst(pk.hx, pk.hy, { color: 0xefe8da, count: 10, speed: 0.25 });
  }

  private updateFalling(dt: number) {
    if (!this.falling.length) return;
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
    dropTexture(this.fogSprite.texture);
    this.fogSprite.texture = Texture.from(c);
    this.fogSprite.width = this.fogSprite.height = size;
  }

  private drawOverlay(aim: AimView | null) {
    const v = this.overlayView;
    v.calledShot = this.calledShot;
    v.goal = this.goal;
    v.time = this.time;
    drawOverlay(v, aim);
  }

  private drawAim(aim: AimView | null) {
    this.guide.clear();
    const m = this.match;
    if (!aim || m.phase !== 'aim') {
      this.cue.visible = this.cueShadow.visible = !!aim && aim.strike > 0 && aim.strike < 1;
      if (!this.cue.visible) return;
    }
    const t = m.table;
    const R = t.R;
    const cue = m.cueBall();
    drawCue({ cue: this.cue, shadow: this.cueShadow }, aim!, cue, R);
    if (!aim!.showGuide || m.phase !== 'aim') return;
    if (m.aimLock) drawAimLock(m, this.guide, aim!);
    if (hasPathPreview(m)) {
      drawEagleReference(m, this.guide, aim!, cue);
      this.eagle = drawEagle(m, this.guide, this.eagle, aim!);
      return;
    }
    if ((aim!.elevation ?? 0) > 10 * Math.PI / 180) {
      drawJumpPath(m, this.guide, aim!, cue);
      return;
    }
    drawShotHint(m, this.guide, aim!, cue);
    drawDriftNote(m, this.guide, aim!);
  }

  // ---------- Effects ----------

  burst(x: number, y: number, o: { color: number; count: number; speed: number; size?: number }) {
    for (let i = 0; i < o.count; i++) {
      const s = new Sprite(this.glowTex);
      s.anchor.set(0.5);
      s.tint = o.color;
      s.blendMode = 'normal'; // ink droplets, not light
      const size = o.size ?? 0.012;
      s.width = s.height = size * (0.6 + Math.random());
      s.position.set(x, y);
      const a = Math.random() * Math.PI * 2;
      const v = o.speed * (0.3 + Math.random());
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
      this.skills.play({ kinds: [k], sect: champion(championId).sect, ultimate: skill.slot === 2, cue, pockets: k === 'seal' ? (sealed.length ? sealed : open) : open });
    }
    if (skill.slot === 2) this.addShake(0.8);
  }

  addShake(k: number) {
    this.shake = Math.min(1.2, this.shake + k);
  }

  private updateParticles(dt: number) {
    if (!this.particles.length) return;
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

  /**
   * A portrait of ball `id` drawn by the same shader as the table, number facing the viewer,
   * for DOM labels. Cached per ball; `px` is the CSS diameter it will be shown at.
   */
  ballPortrait(id: number, px: number): string {
    return ballPortrait({ app: this.app, match: this.match, numbers: this.numbers }, id, px);
  }

  destroy() {
    this.disposed = true;
    window.removeEventListener('resize', this.invalidateSoon);
    document.removeEventListener('visibilitychange', this.invalidateSoon);
    this.app.canvas.removeEventListener('webglcontextrestored', this.invalidateSoon);
    // Textures painted for this table are its own; the shared art loaded through Assets is not.
    const own = [this.tableSprite.texture, ...this.cueTextures.values(), this.fogSprite.texture, this.numbers, this.shadowTex, this.glowTex];
    for (const m of this.meshes.values()) m.destroy();
    this.root.destroy({ children: true });
    for (const t of own) dropTexture(t);
  }
}

/** Free a canvas-painted texture and its GPU copy; every match and repaint makes new ones. */
function dropTexture(t: Texture): void {
  if (t !== Texture.EMPTY && t !== Texture.WHITE && !t.destroyed) t.destroy(true);
}
