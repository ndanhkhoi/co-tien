import { Assets, Container, Graphics, Sprite, Texture } from 'pixi.js';
import type { Match } from '../game/match';

const names = ['snow-drift', 'snowflakes', 'wind', 'petal', 'swell', 'sand', 'puddle', 'star-fall', 'star-well', 'roots', 'quake', 'gate-seal', 'silk', 'tilt', 'breath', 'mist'] as const;
const skillNames = ['bumper-stone', 'bumper-wood', 'bumper-bronze', 'rail-soft', 'rail-hard', 'spinwash', 'slick', 'sand', 'well', 'vortex', 'wind', 'arrow', 'spin-cw', 'spin-ccw', 'target', 'mark'] as const;
type Art = typeof names[number] | `skill/${typeof skillNames[number]}`;
const base = new URL(import.meta.env.BASE_URL, document.baseURI).href;

/** Bounded sprite pool: shared Assets textures survive the view; sprites belong to it. */
export class OmenArt {
  readonly layer = new Container();
  private pool: Sprite[] = [];
  private textures = new Map<Art, Texture>();
  private used = 0;
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
    this.mask.rect(-t.L / 2, -t.W / 2, t.L, t.W).fill(0xffffff);
    this.layer.addChild(this.mask);
    // Allocate once, including the maximum ball-count tremor and decorative overlays.
    for (let i = 0; i < 128; i++) {
      const sprite = new Sprite();
      sprite.anchor.set(0.5);
      sprite.blendMode = 'normal';
      sprite.visible = false;
      this.pool.push(sprite);
      this.layer.addChild(sprite);
      // Register the mask before assets load so its white geometry never paints the bed.
      sprite.mask = this.mask;
    }
    for (const name of [...names, ...skillNames.map(name => `skill/${name}` as const)]) {
      const path = name.startsWith('skill/') ? `skills/${name.slice(6)}` : `omens/${name}`;
      void Assets.load<Texture>(`${base}art/table/${path}.webp`).then(texture => {
        if (!this.layer.destroyed) this.textures.set(name, texture);
      }).catch(() => { /* Missing painted art stays absent; never substitute invented geometry. */ });
    }
  }

  shot() {
    if (!this.match.omen?.jitter) return;
    this.shotTime = this.clock;
    this.cracks = this.match.balls.filter(b => b.onTable && b.id !== this.match.cueId()).map(b => ({ x: b.x, y: b.y }));
  }

  private put(name: Art, x: number, y: number, w: number, h: number, alpha: number, rotation = 0, clip = true) {
    const texture = this.textures.get(name);
    if (!texture) return;
    const s = this.pool[this.used];
    if (!s) return;
    this.used++;
    s.texture = texture;
    s.visible = true;
    s.position.set(x, y);
    s.rotation = rotation;
    s.width = w;
    s.height = h;
    s.alpha = alpha;
    s.mask = clip ? this.mask : null;
  }

  update(dt: number) {
    this.clock += dt;
    const m = this.match, t = m.table, o = m.omen;
    if (o !== this.omen) {
      this.omen = o;
      this.started = this.clock;
      this.shotTime = -Infinity;
    }
    this.used = 0;
    const age = this.clock - this.started;
    const moving = !this.motion.matches;
    const phase = moving ? this.clock : 0;
    // Gameplay terrain must be readable immediately, including omens started mid-rack.
    const fade = moving ? 0.75 + 0.25 * Math.min(1, age / 0.6) : 1;
    for (const i of m.closedPockets) {
      const p = t.pockets[i];
      this.put('gate-seal', p.hx, p.hy, p.hr * 2, p.hr * 2, 0.72, 0, false);
    }
    if (o) {
      for (const p of o.terrain?.patches ?? []) {
        const name = o.id === 'snow' ? 'snow-drift' : o.id === 'sandstorm' ? 'sand' : o.id === 'silk' ? 'silk' : 'puddle';
        // Sand's radius exceeds the entire table; scale its painted coverage to the bed.
        const wide = p.r >= Math.hypot(t.L, t.W);
        this.put(name, p.x, p.y, wide ? t.L : p.r * 2, wide ? t.W : p.r * 2, (o.id === 'snow' ? 0.8 : 0.32) * fade);
        if (o.id === 'snow') {
          for (let i = 0; i < 3; i++) {
            const a = i * 2.1 + phase * 0.16;
            this.put('snowflakes', p.x + Math.cos(a) * p.r * 0.55, p.y + Math.sin(a) * p.r * 0.55, p.r * 0.3, p.r * 0.3, 0.36 * fade);
          }
        }
      }
      for (const w of o.terrain?.wells ?? []) {
        this.put('star-well', w.x, w.y, w.r * 2, w.r * 2, 0.38 * fade);
        if (moving && age < 0.8) this.put('star-fall', w.x, w.y - (1 - age / 0.8) * w.r, w.r, w.r, 0.5 * (1 - age / 0.8));
      }
      for (const s of o.segments ?? []) {
        this.put('roots', (s.ax + s.bx) / 2, (s.ay + s.by) / 2, Math.hypot(s.bx - s.ax, s.by - s.ay), 0.16, 0.9 * fade, Math.atan2(s.by - s.ay, s.bx - s.ax));
      }
      const force = o.terrain?.force;
      if (force) {
        const gust = o.terrain?.gust;
        // Physics resets gust time at the strike, independent of the ambient animation clock.
        const elapsed = m.phase === 'rolling' ? this.clock - this.forceStart : 0;
        const k = gust ? 1 - gust.amp + gust.amp * Math.sin(gust.omega * elapsed) : 1;
        const a = Math.atan2(force.y, force.x) + (k < 0 ? Math.PI : 0);
        const name = o.id === 'swell' ? 'swell' : o.id === 'tilt' ? 'tilt' : 'wind';
        if (name === 'wind') {
          // A lattice of ink arrows drifting downwind across the cloth: the direction reads at a
          // glance, and the drift speed follows the gust.
          const ux = Math.cos(a), uy = Math.sin(a);
          const step = 0.42;
          const drift = ((this.clock * 0.12) % step + step) % step;
          for (let i = -3; i <= 3; i++) {
            for (let j = -1; j <= 1; j++) {
              const along = i * step + drift;
              const x = ux * along - uy * j * 0.36;
              const y = uy * along + ux * j * 0.36;
              if (Math.abs(x) > t.L / 2 - 0.06 || Math.abs(y) > t.W / 2 - 0.06) continue;
              const edge = Math.min(1, (t.L / 2 - Math.abs(x)) / 0.25);
              this.put('skill/arrow', x, y, 0.13, 0.045, (0.22 + Math.abs(k) * 0.18) * fade * edge, a);
            }
          }
        }
        for (const side of [-1, 1]) {
          this.put(name, Math.sin(phase * 0.8) * 0.015, side * (t.W / 2 - 0.09), 0.32, 0.12, (0.28 + Math.abs(k) * 0.12) * fade, a);
          if (m.setup.tableSkin.sect === 'hoalinh') this.put('petal', side * t.L * 0.3, side * (t.W / 2 - 0.1), 0.07, 0.07, 0.42 * fade, a + phase * 0.12);
        }
      }
      if (o.capture) for (const p of t.pockets) this.put('breath', p.x, p.y, p.r * o.capture * 2, p.r * o.capture * 2, 0.42 * fade, 0, false);
      if (moving && age < 0.8) this.put('mist', 0, 0, t.L, t.W, 0.12 * Math.sin(age / 0.8 * Math.PI));
      const quakeAge = this.clock - this.shotTime;
      if (o.jitter && quakeAge < 1.2) for (const p of this.cracks) this.put('quake', p.x, p.y, t.R * 4, t.R * 4, 0.5 * (1 - quakeAge / 1.2));
    }
    for (const e of [...(m.activeEffects ?? []), ...(m.castPreview ?? [])]) {
      const preview = m.castPreview?.includes(e);
      const alpha = preview ? 0.65 : 0.4;
      for (const p of e.terrain.patches ?? []) this.put(p.roll < 1 ? 'skill/slick' : p.roll > 1 ? 'skill/sand' : 'skill/spinwash', p.x, p.y, p.r * 2, p.r * 2, alpha);
      for (const p of e.terrain.wells ?? []) this.put('skill/well', p.x, p.y, p.r * 2, p.r * 2, alpha);
      for (const p of e.terrain.vortices ?? []) {
        this.put('skill/vortex', p.x, p.y, p.r * 2, p.r * 2, alpha);
        this.put(p.sense < 0 ? 'skill/spin-ccw' : 'skill/spin-cw', p.x, p.y, p.r * 1.4, p.r * 1.4, alpha + 0.2);
      }
      // Slot selects a painted material without changing the physical obstacle.
      const bumper = (['skill/bumper-stone', 'skill/bumper-wood', 'skill/bumper-bronze'] as const)[e.slot] ?? 'skill/bumper-stone';
      for (const s of e.segments) this.put(bumper, (s.ax + s.bx) / 2, (s.ay + s.by) / 2, Math.hypot(s.bx - s.ax, s.by - s.ay), 0.06, alpha + 0.2, Math.atan2(s.by - s.ay, s.bx - s.ax));
      for (const s of e.terrain.rails ?? []) this.put(s.multiplier > 1 ? 'skill/rail-hard' : 'skill/rail-soft', (s.ax + s.bx) / 2, (s.ay + s.by) / 2, Math.hypot(s.bx - s.ax, s.by - s.ay), 0.06, alpha + 0.2, Math.atan2(s.by - s.ay, s.bx - s.ax));
      const point = e.cast.point;
      const direction = e.cast.direction;
      for (const force of e.terrain.forces ?? []) {
        const zone = force.region;
        this.put('skill/wind', zone?.x ?? point?.x ?? 0, zone?.y ?? point?.y ?? 0, zone ? zone.r * 2 : 0.32, zone ? zone.r * 2 : 0.12, alpha, Math.atan2(force.y, force.x));
      }
      if (e.terrain.force && point) this.put('skill/wind', point.x, point.y, 0.32, 0.12, alpha, Math.atan2(e.terrain.force.y, e.terrain.force.x));
      if (preview && point) {
        const radius = e.terrain.patches?.[0]?.r ?? e.terrain.wells?.[0]?.r ?? e.terrain.vortices?.[0]?.r ?? 0.07;
        this.put('skill/target', point.x, point.y, radius * 2, radius * 2, 0.8);
        this.put('skill/mark', point.x, point.y, 0.035, 0.035, 0.95);
      }
      if (direction && point && (preview || e.kind === 'wind')) this.put('skill/arrow', point.x, point.y, 0.16, 0.05, 0.85, Math.atan2(direction.y, direction.x));
    }
    for (let i = this.used; i < this.pool.length; i++) this.pool[i].visible = false;
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
