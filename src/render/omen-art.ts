import { MAX_FORCE } from '../game/terrain';
import { Assets, Container, Graphics, Sprite, Texture } from 'pixi.js';
import type { CastEffect } from '../game/skill-cast';
import type { Match } from '../game/match';

const names = ['snow-drift', 'snowflakes', 'wind', 'petal', 'swell', 'sand', 'puddle', 'star-fall', 'star-well', 'roots', 'quake', 'gate-seal', 'silk', 'tilt', 'breath', 'mist'] as const;
const skillNames = ['bumper-stone', 'bumper-wood', 'bumper-bronze', 'rail-soft', 'rail-hard', 'spinwash', 'slick', 'sand', 'well', 'vortex', 'silk', 'wind', 'arrow', 'spin-cw', 'spin-ccw', 'target', 'mark'] as const;
type Art = typeof names[number] | `skill/${typeof skillNames[number]}`;
const base = new URL(import.meta.env.BASE_URL, document.baseURI).href;

interface PutOptions {
  name: Art;
  x: number;
  y: number;
  w: number;
  h: number;
  alpha: number;
  rotation?: number;
  clip?: boolean;
}

/** One reusable sprite placement command, so the frame loop allocates nothing. */
interface PutCommand extends PutOptions {
  alpha: number;
}

interface OmenTiming {
  age: number;
  phase: number;
  fade: number;
  moving: boolean;
}

/** Bounded sprite pool: shared Assets textures survive the view; sprites belong to it. */
export class OmenArt {
  readonly layer = new Container();
  /** Sprites clipped to the bed: the mask is set once on this container, never toggled per sprite. */
  private readonly clipped = new Container();
  /** Sprites that may overhang the bed (pocket seals, pocket breath). */
  private readonly free = new Container();
  private pool: Sprite[] = [];
  private freePool: Sprite[] = [];
  private readonly putCommand: PutCommand = { name: 'snow-drift', x: 0, y: 0, w: 0, h: 0, alpha: 0 };
  private textures = new Map<Art, Texture>();
  private used = 0;
  private freeUsed = 0;
  private clock = 0;
  private started = 0;
  private shotTime = -Infinity;
  private omen: Match['omen'] = null;
  private cracks: { x: number; y: number }[] = [];
  private motion = matchMedia('(prefers-reduced-motion: reduce)');
  private mask = new Graphics();

  constructor(private match: Match) {
    const t = match.table;
    // Terrain never paints outside the physical bed. Pocket seals use a separate unmasked layer.
    // Toggling a shared mask on and off per sprite makes Pixi draw the white mask geometry over the
    // bed whenever the last toggle in a frame removes it, so the mask lives on one container for good.
    this.mask.rect(-t.L / 2, -t.W / 2, t.L, t.W).fill(0xffffff);
    this.layer.addChild(this.mask, this.clipped, this.free);
    this.clipped.mask = this.mask;
    // Allocate once, including the maximum ball-count tremor and decorative overlays.
    for (let i = 0; i < 128; i++) this.pool.push(this.pooledSprite(this.clipped));
    for (let i = 0; i < 16; i++) this.freePool.push(this.pooledSprite(this.free));
    for (const name of [...names, ...skillNames.map(name => `skill/${name}` as const)]) {
      const path = name.startsWith('skill/') ? `skills/${name.slice(6)}` : `omens/${name}`;
      void Assets.load<Texture>(`${base}art/table/${path}.webp`).then(texture => {
        if (!this.layer.destroyed) this.textures.set(name, texture);
      }).catch(() => { /* Missing painted art stays absent; never substitute invented geometry. */ });
    }
  }

  private pooledSprite(parent: Container): Sprite {
    const sprite = new Sprite();
    sprite.anchor.set(0.5);
    sprite.blendMode = 'normal';
    sprite.visible = false;
    parent.addChild(sprite);
    return sprite;
  }

  shot() {
    if (!this.match.omen?.jitter) return;
    this.shotTime = this.clock;
    this.cracks = this.match.balls.filter(b => b.onTable && b.id !== this.match.cueId()).map(b => ({ x: b.x, y: b.y }));
  }

  private put(o: PutOptions) {
    const c = this.putCommand;
    c.name = o.name; c.x = o.x; c.y = o.y; c.w = o.w; c.h = o.h;
    c.alpha = o.alpha; c.rotation = o.rotation ?? 0; c.clip = o.clip ?? true;
    const texture = this.textures.get(c.name);
    if (!texture) return;
    const s = c.clip ? this.pool[this.used] : this.freePool[this.freeUsed];
    if (!s) return;
    if (c.clip) this.used++;
    else this.freeUsed++;
    s.texture = texture;
    s.visible = true;
    s.position.set(c.x, c.y);
    s.rotation = c.rotation;
    s.width = c.w;
    s.height = c.h;
    s.alpha = c.alpha;
  }

  update(dt: number) {
    this.clock += dt;
    const o = this.match.omen;
    if (o !== this.omen) {
      this.omen = o;
      this.started = this.clock;
      this.shotTime = -Infinity;
    }
    this.used = 0;
    this.freeUsed = 0;
    const timing = this.timing();
    this.paintClosedPockets();
    if (o) this.paintOmen(o, timing);
    this.paintSkillLayers();
    for (let i = this.used; i < this.pool.length; i++) this.pool[i].visible = false;
    for (let i = this.freeUsed; i < this.freePool.length; i++) this.freePool[i].visible = false;
  }

  private timing(): OmenTiming {
    const age = this.clock - this.started;
    const moving = !this.motion.matches;
    return {
      age,
      moving,
      phase: moving ? this.clock : 0,
      // Gameplay terrain must be readable immediately, including omens started mid-rack.
      fade: moving ? 0.75 + 0.25 * Math.min(1, age / 0.6) : 1,
    };
  }

  private paintClosedPockets(): void {
    const pockets = this.match.table.pockets;
    for (const i of this.match.closedPockets) {
      const p = pockets[i];
      this.put({ name: 'gate-seal', x: p.hx, y: p.hy, w: p.hr * 2, h: p.hr * 2, alpha: 0.72, clip: false });
    }
  }

  private paintOmen(o: NonNullable<Match['omen']>, q: OmenTiming): void {
    this.paintPatches(o, q);
    this.paintWells(o, q);
    this.paintRoots(o, q.fade);
    const force = o.terrain?.force;
    if (force) this.paintForce(o, force, q);
    if (o.capture) this.paintCapture(o.capture, q.fade);
    if (q.moving && q.age < 0.8) {
      const t = this.match.table;
      this.put({ name: 'mist', x: 0, y: 0, w: t.L, h: t.W, alpha: 0.12 * Math.sin(q.age / 0.8 * Math.PI) });
    }
    this.paintQuake(o);
  }

  private paintPatches(o: NonNullable<Match['omen']>, q: OmenTiming): void {
    const name = o.id === 'snow' ? 'snow-drift' : o.id === 'sandstorm' ? 'sand' : o.id === 'silk' ? 'silk' : 'puddle';
    for (const p of o.terrain?.patches ?? []) {
      this.paintPatch(o.id, name, p, q.fade);
      if (o.id === 'snow') this.paintSnowflakes(p, q);
    }
  }

  private paintPatch(id: string, name: Art, p: { x: number; y: number; r: number }, fade: number): void {
    const t = this.match.table;
    // Sand's radius exceeds the entire table; scale its painted coverage to the bed.
    const wide = p.r >= Math.hypot(t.L, t.W);
    this.put({ name, x: p.x, y: p.y, w: wide ? t.L : p.r * 2, h: wide ? t.W : p.r * 2, alpha: (id === 'snow' ? 0.8 : 0.32) * fade });
  }

  private paintSnowflakes(p: { x: number; y: number; r: number }, q: OmenTiming): void {
    for (let i = 0; i < 3; i++) {
      const a = i * 2.1 + q.phase * 0.16;
      this.put({ name: 'snowflakes', x: p.x + Math.cos(a) * p.r * 0.55, y: p.y + Math.sin(a) * p.r * 0.55, w: p.r * 0.3, h: p.r * 0.3, alpha: 0.36 * q.fade });
    }
  }

  private paintWells(o: NonNullable<Match['omen']>, q: OmenTiming): void {
    for (const w of o.terrain?.wells ?? []) {
      this.put({ name: 'star-well', x: w.x, y: w.y, w: w.r * 2, h: w.r * 2, alpha: 0.38 * q.fade });
      if (!q.moving || q.age >= 0.8) continue;
      const rise = 1 - q.age / 0.8;
      this.put({ name: 'star-fall', x: w.x, y: w.y - rise * w.r, w: w.r, h: w.r, alpha: 0.5 * rise });
    }
  }

  private paintRoots(o: NonNullable<Match['omen']>, fade: number): void {
    for (const s of o.segments ?? []) {
      this.put({ name: 'roots', x: (s.ax + s.bx) / 2, y: (s.ay + s.by) / 2, w: Math.hypot(s.bx - s.ax, s.by - s.ay), h: 0.16, alpha: 0.9 * fade, rotation: Math.atan2(s.by - s.ay, s.bx - s.ax) });
    }
  }

  private paintForce(o: NonNullable<Match['omen']>, force: { x: number; y: number }, q: OmenTiming): void {
    const m = this.match;
    const t = m.table;
    const gust = o.terrain?.gust;
    // Physics resets gust time at the strike, independent of the ambient animation clock.
    const elapsed = m.phase === 'rolling' ? this.clock - this.forceStart : 0;
    const k = gust ? 1 - gust.amp + gust.amp * Math.sin(gust.omega * elapsed) : 1;
    const a = Math.atan2(force.y, force.x) + (k < 0 ? Math.PI : 0);
    const name = o.id === 'swell' ? 'swell' : o.id === 'tilt' ? 'tilt' : 'wind';
    if (name === 'wind') this.paintWindLattice(force, a, k, q.fade);
    for (const side of [-1, 1]) {
      this.put({ name, x: Math.sin(q.phase * 0.8) * 0.015, y: side * (t.W / 2 - 0.09), w: 0.32, h: 0.12, alpha: (0.28 + Math.abs(k) * 0.12) * q.fade, rotation: a });
      if (m.setup.tableSkin.sect === 'hoalinh') this.put({ name: 'petal', x: side * t.L * 0.3, y: side * (t.W / 2 - 0.1), w: 0.07, h: 0.07, alpha: 0.42 * q.fade, rotation: a + q.phase * 0.12 });
    }
  }

  private paintWindLattice(force: { x: number; y: number }, a: number, k: number, fade: number): void {
    // A lattice of ink arrows drifting downwind across the cloth: the direction reads at a
    // glance, and the drift speed follows the gust. Stronger wind: bigger arrows that drift faster.
    const strength = Math.min(1, Math.hypot(force.x, force.y) / MAX_FORCE);
    const ux = Math.cos(a), uy = Math.sin(a);
    const step = 0.42;
    const drift = ((this.clock * (0.06 + strength * 0.14)) % step + step) % step;
    for (let i = -3; i <= 3; i++) {
      for (let j = -1; j <= 1; j++) {
        this.putWindArrow({ i, j, step, drift, ux, uy, a, k, strength, fade });
      }
    }
  }

  private putWindArrow(o: {
    i: number; j: number; step: number; drift: number; ux: number; uy: number;
    a: number; k: number; strength: number; fade: number;
  }): void {
    const t = this.match.table;
    const along = o.i * o.step + o.drift;
    const x = o.ux * along - o.uy * o.j * 0.36;
    const y = o.uy * along + o.ux * o.j * 0.36;
    if (Math.abs(x) > t.L / 2 - 0.06 || Math.abs(y) > t.W / 2 - 0.06) return;
    const edge = Math.min(1, (t.L / 2 - Math.abs(x)) / 0.25);
    this.put({
      name: 'skill/arrow',
      x,
      y,
      w: 0.09 + o.strength * 0.08,
      h: 0.032 + o.strength * 0.026,
      alpha: (0.26 + Math.abs(o.k) * 0.2) * o.fade * edge,
      rotation: o.a,
    });
  }

  private paintCapture(capture: number, fade: number): void {
    for (const p of this.match.table.pockets) {
      this.put({ name: 'breath', x: p.x, y: p.y, w: p.r * capture * 2, h: p.r * capture * 2, alpha: 0.42 * fade, clip: false });
    }
  }

  private paintQuake(o: NonNullable<Match['omen']>): void {
    const quakeAge = this.clock - this.shotTime;
    if (!o.jitter || quakeAge >= 1.2) return;
    const R = this.match.table.R;
    for (const p of this.cracks) this.put({ name: 'quake', x: p.x, y: p.y, w: R * 4, h: R * 4, alpha: 0.5 * (1 - quakeAge / 1.2) });
  }

  private paintSkillLayers(): void {
    const m = this.match;
    for (const e of [...(m.activeEffects ?? []), ...(m.castPreview ?? [])]) {
      this.paintSkillLayer(e, m.castPreview?.includes(e) ? 0.65 : 0.4);
    }
  }

  private paintSkillLayer(e: CastEffect, alpha: number): void {
    for (const p of e.terrain.patches ?? []) {
      this.put({ name: p.roll < 1 ? 'skill/slick' : p.roll > 1 ? 'skill/sand' : 'skill/spinwash', x: p.x, y: p.y, w: p.r * 2, h: p.r * 2, alpha });
    }
    for (const p of e.terrain.wells ?? []) this.put({ name: 'skill/well', x: p.x, y: p.y, w: p.r * 2, h: p.r * 2, alpha });
    this.paintVortices(e, alpha);
    if (e.kind !== 'decoy') this.paintObstacles(e, alpha);
    this.paintForces(e, alpha);
    this.paintCastTarget(e);
  }

  private paintVortices(e: CastEffect, alpha: number): void {
    const vortices = e.terrain.vortices ?? [];
    if (e.kind === 'silk') this.paintSilk(e, vortices, alpha);
    else for (const p of vortices) this.put({ name: 'skill/vortex', x: p.x, y: p.y, w: p.r * 2, h: p.r * 2, alpha });
    for (const p of vortices) this.put({ name: p.sense < 0 ? 'skill/spin-ccw' : 'skill/spin-cw', x: p.x, y: p.y, w: p.r * 1.4, h: p.r * 1.4, alpha: alpha + 0.2 });
  }

  /** The ribbon replaces generic vortex discs; its length still comes from the simulated vortices. */
  private paintSilk(e: CastEffect, vortices: NonNullable<CastEffect['terrain']['vortices']>, alpha: number): void {
    const point = e.cast.point;
    const direction = e.cast.direction;
    if (!point || !direction || !vortices.length) return;
    const axis = { x: direction.x / (Math.hypot(direction.x, direction.y) || 1), y: direction.y / (Math.hypot(direction.x, direction.y) || 1) };
    const halfLength = vortices.reduce((reach, p) => Math.max(reach, Math.abs((p.x - point.x) * axis.x + (p.y - point.y) * axis.y) + p.r), 0);
    const width = halfLength * 2;
    this.put({ name: 'skill/silk', x: point.x, y: point.y, w: width, h: width * 161 / 512, alpha, rotation: Math.atan2(direction.y, direction.x) });
  }

  private paintObstacles(e: CastEffect, alpha: number): void {
    // Slot selects a painted material without changing the physical obstacle.
    const bumper = (['skill/bumper-stone', 'skill/bumper-wood', 'skill/bumper-bronze'] as const)[e.slot] ?? 'skill/bumper-stone';
    for (const s of e.segments) this.paintSegment(bumper, s, 0.06, alpha + 0.2);
    for (const s of e.terrain.rails ?? []) this.paintSegment(s.multiplier > 1 ? 'skill/rail-hard' : 'skill/rail-soft', s, 0.06, alpha + 0.2);
  }

  private paintSegment(name: Art, s: { ax: number; ay: number; bx: number; by: number }, thickness: number, alpha: number): void {
    this.put({ name, x: (s.ax + s.bx) / 2, y: (s.ay + s.by) / 2, w: Math.hypot(s.bx - s.ax, s.by - s.ay), h: thickness, alpha, rotation: Math.atan2(s.by - s.ay, s.bx - s.ax) });
  }

  private paintForces(e: CastEffect, alpha: number): void {
    const point = e.cast.point;
    for (const force of e.terrain.forces ?? []) {
      const zone = force.region;
      this.put({
        name: 'skill/wind',
        x: zone?.x ?? point?.x ?? 0,
        y: zone?.y ?? point?.y ?? 0,
        w: zone ? zone.r * 2 : 0.32,
        h: zone ? zone.r * 2 : 0.12,
        alpha,
        rotation: Math.atan2(force.y, force.x),
      });
    }
    if (e.terrain.force && point) this.put({ name: 'skill/wind', x: point.x, y: point.y, w: 0.32, h: 0.12, alpha, rotation: Math.atan2(e.terrain.force.y, e.terrain.force.x) });
  }

  private paintCastTarget(e: CastEffect): void {
    const point = e.cast.point;
    const direction = e.cast.direction;
    if (this.match.castPreview?.includes(e) && point) {
      const radius = e.terrain.patches?.[0]?.r ?? e.terrain.wells?.[0]?.r ?? e.terrain.vortices?.[0]?.r ?? 0.07;
      this.put({ name: 'skill/target', x: point.x, y: point.y, w: radius * 2, h: radius * 2, alpha: 0.8 });
      this.put({ name: 'skill/mark', x: point.x, y: point.y, w: 0.035, h: 0.035, alpha: 0.95 });
    }
    if (direction && point && (this.match.castPreview?.includes(e) || e.kind === 'wind' || e.kind === 'quake')) {
      this.put({ name: 'skill/arrow', x: point.x, y: point.y, w: 0.16, h: 0.05, alpha: 0.85, rotation: Math.atan2(direction.y, direction.x) });
    }
  }

  private forceStart = 0;
  startShot() {
    this.forceStart = this.clock;
    if (this.omen !== this.match.omen) {
      this.omen = this.match.omen;
      this.started = this.clock;
    }
    this.shot();
  }
}
