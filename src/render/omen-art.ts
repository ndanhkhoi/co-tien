import { Assets, Container, Graphics, Sprite, Texture } from 'pixi.js';
import type { Match } from '../game/match';

const names = ['snow-drift', 'snowflakes', 'wind', 'petal', 'swell', 'sand', 'puddle', 'star-fall', 'star-well', 'roots', 'quake', 'gate-seal', 'silk', 'tilt', 'breath', 'mist'] as const;
type Art = typeof names[number];
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
    for (let i = 0; i < 96; i++) {
      const sprite = new Sprite();
      sprite.anchor.set(0.5);
      sprite.blendMode = 'normal';
      sprite.visible = false;
      this.pool.push(sprite);
      this.layer.addChild(sprite);
    }
    for (const name of names) {
      void Assets.load<Texture>(`${base}art/table/omens/${name}.webp`).then(texture => {
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
    const fade = moving ? Math.min(1, age / 0.6) : 1;
    for (const i of m.closedPockets) {
      const p = t.pockets[i];
      this.put('gate-seal', p.hx, p.hy, p.hr * 2, p.hr * 2, 0.72, 0, false);
    }
    if (o) {
      for (const p of o.terrain?.patches ?? []) {
        const name = o.id === 'snow' ? 'snow-drift' : o.id === 'sandstorm' ? 'sand' : o.id === 'silk' ? 'silk' : 'puddle';
        // Sand's radius exceeds the entire table; scale its painted coverage to the bed.
        const wide = p.r >= Math.hypot(t.L, t.W);
        this.put(name, p.x, p.y, wide ? t.L : p.r * 2, wide ? t.W : p.r * 2, 0.32 * fade);
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
        this.put('roots', (s.ax + s.bx) / 2, (s.ay + s.by) / 2, Math.hypot(s.bx - s.ax, s.by - s.ay), t.R * 0.6, 0.8 * fade, Math.atan2(s.by - s.ay, s.bx - s.ax));
      }
      const force = o.terrain?.force;
      if (force) {
        const gust = o.terrain?.gust;
        // Physics resets gust time at the strike, independent of the ambient animation clock.
        const elapsed = m.phase === 'rolling' ? this.clock - this.forceStart : 0;
        const k = gust ? 1 - gust.amp + gust.amp * Math.sin(gust.omega * elapsed) : 1;
        const a = Math.atan2(force.y, force.x) + (k < 0 ? Math.PI : 0);
        const name = o.id === 'swell' ? 'swell' : o.id === 'tilt' ? 'tilt' : 'wind';
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
