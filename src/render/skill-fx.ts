import { Assets, Container, Sprite, Texture } from 'pixi.js';
import { sect as sectInfo, vfxUrl, type SectId, type SkillKind } from '../game/content/sects';

type Pt = { x: number; y: number };

interface PieceOptions {
  tex: Texture | null;
  tint: number;
  at: Pt;
  recipe: Recipe;
  follow?: () => Pt;
  frames?: Texture[];
}

interface PlayOptions {
  kinds: SkillKind[];
  sect: SectId;
  ultimate: boolean;
  cue: () => Pt;
  pockets: Pt[];
}

interface Piece {
  s: Sprite;
  t: number;
  dur: number;
  size: [number, number];
  alpha: [number, number];
  spin: number;
  /** Follows a moving target (the cue ball) when set. */
  at?: () => Pt;
  frames?: Texture[];
}

interface Recipe {
  el: string;
  /** Size in metres at start and end. */
  size: [number, number];
  alpha?: [number, number];
  dur: number;
  spin?: number;
  where: 'cue' | 'pockets';
  follow?: boolean;
}

const BASE = import.meta.env.BASE_URL;

/** How each effect family reads on the table, built from the sect's painted VFX pieces. */
const RECIPES: Record<SkillKind, Recipe[]> = {
  slick: [], sand: [], bumper: [], railcraft: [], wind: [], well: [], spinwash: [], vortex: [],
  vision: [{ el: 'circle', size: [0.08, 0.3], dur: 1.1, spin: 1.2, where: 'cue', follow: true }, { el: 'pillar', size: [0.12, 0.22], dur: 0.8, where: 'cue' }],
  reveal: [{ el: 'runes', size: [0.1, 0.26], dur: 1, spin: -1.5, where: 'cue', follow: true }, { el: 'spark', size: [0.05, 0.12], dur: 0.6, where: 'cue' }],
  spin: [{ el: 'vortex', size: [0.06, 0.16], dur: 1.2, spin: 7, where: 'cue', follow: true }],
  power: [{ el: 'aura', size: [0.06, 0.32], dur: 0.8, where: 'cue' }, { el: 'burst', size: [0.05, 0.2], dur: 0.5, where: 'cue' }],
  blast: [{ el: 'sigil', size: [0.06, 0.14], alpha: [1, 0.6], dur: 1.4, spin: 2, where: 'cue', follow: true }, { el: 'burst', size: [0.06, 0.22], dur: 0.6, where: 'cue' }],
  shield: [{ el: 'aura', size: [0.1, 0.16], alpha: [1, 0.2], dur: 1.2, where: 'cue', follow: true }, { el: 'runes', size: [0.08, 0.2], dur: 1, spin: 1, where: 'cue' }],
  nudge: [{ el: 'runes', size: [0.12, 0.2], dur: 1.2, spin: 2, where: 'cue', follow: true }],
  teleport: [{ el: 'circle', size: [0.04, 0.24], dur: 1, spin: -3, where: 'cue', follow: true }, { el: 'pillar', size: [0.1, 0.24], dur: 0.8, where: 'cue' }],
  seal: [{ el: 'talisman', size: [0.06, 0.14], dur: 1.3, where: 'pockets' }, { el: 'chain', size: [0.08, 0.16], dur: 1.1, spin: 0.6, where: 'pockets' }],
  maw: [{ el: 'vortex', size: [0.06, 0.2], dur: 1.6, spin: 5, where: 'pockets' }],
  gravity: [{ el: 'vortex', size: [0.08, 0.24], dur: 1.8, spin: -5, where: 'pockets' }, { el: 'orb', size: [0.04, 0.1], dur: 1, where: 'pockets' }],
  chill: [{ el: 'mist1', size: [0.1, 0.34], dur: 1.2, where: 'cue' }, { el: 'flake', size: [0.03, 0.08], dur: 0.9, spin: 3, where: 'cue' }],
  freeze: [{ el: 'crack', size: [0.08, 0.3], dur: 1.2, where: 'cue' }, { el: 'mist2', size: [0.1, 0.3], dur: 1, where: 'cue' }],
  drain: [{ el: 'orb', size: [0.12, 0.03], dur: 0.9, where: 'cue' }, { el: 'trail', size: [0.1, 0.24], dur: 0.7, where: 'cue' }],
  rewind: [{ el: 'sigil', size: [0.3, 0.06], dur: 1.1, spin: -6, where: 'cue' }, { el: 'circle', size: [0.3, 0.1], dur: 1.1, spin: -3, where: 'cue' }],
  blind: [{ el: 'mist2', size: [0.1, 0.32], dur: 1.1, where: 'cue', follow: true }],
  drift: [{ el: 'trail', size: [0.08, 0.24], dur: 1.1, where: 'cue', follow: true }],
  called: [{ el: 'talisman', size: [0.05, 0.13], dur: 1, where: 'cue', follow: true }],
  displace: [{ el: 'slash', size: [0.08, 0.24], dur: 0.8, where: 'cue' }],
  swap: [{ el: 'circle', size: [0.08, 0.2], dur: 0.9, spin: 2, where: 'cue' }],
  decoy: [{ el: 'orb', size: [0.06, 0.14], dur: 1, where: 'cue' }],
  counter: [{ el: 'runes', size: [0.08, 0.2], dur: 1.2, spin: -1, where: 'cue' }],
  puppet: [{ el: 'sigil', size: [0.08, 0.22], dur: 1.2, spin: 1, where: 'cue', follow: true }],
  silk: [{ el: 'petal', size: [0.1, 0.3], dur: 1.2, where: 'cue' }],
  quake: [{ el: 'crack', size: [0.1, 0.34], dur: 1, where: 'cue' }],
  second: [{ el: 'cross', size: [0.06, 0.22], dur: 0.8, where: 'cue' }, { el: 'slash', size: [0.08, 0.24], dur: 0.7, spin: 2, where: 'cue' }],
};

export class SkillFx {
  private pieces: Piece[] = [];
  private cache = new Map<string, Promise<Texture | null>>();

  constructor(private layer: Container, private fallback: Texture) {}

  private load(url: string): Promise<Texture | null> {
    let p = this.cache.get(url);
    if (!p) {
      p = Assets.load<Texture>(url).catch(() => null);
      this.cache.set(url, p);
    }
    return p;
  }

  private add(o: PieceOptions) {
    const { tex, tint, at, recipe: r, follow, frames } = o;
    const s = new Sprite(tex ?? this.fallback);
    s.anchor.set(0.5);
    // Ink brushwork is painted over the cloth (normal blending), never added as light.
    // The soft fallback blot, used while art is missing, takes the sect colour.
    if (!tex) s.tint = tint;
    s.position.set(at.x, at.y);
    s.width = s.height = r.size[0];
    this.layer.addChild(s);
    this.pieces.push({ s, t: 0, dur: r.dur, size: r.size, alpha: r.alpha ?? [1, 0], spin: r.spin ?? 0, at: follow, frames });
  }

  /** Play every family of a cast; ultimates add the sect's flipbook and grow 40%. */
  play(o: PlayOptions) {
    const { kinds, sect, ultimate, cue, pockets } = o;
    const tint = sectInfo(sect).glow;
    const boost = ultimate ? 1.4 : 1;
    for (const kind of kinds) {
      for (const r0 of RECIPES[kind]) {
        const r = { ...r0, size: [r0.size[0] * boost, r0.size[1] * boost] as [number, number] };
        void this.load(vfxUrl(sect, r.el)).then((tex) => {
          if (r.where === 'pockets') for (const p of pockets) this.add({ tex, tint, at: p, recipe: r });
          else this.add({ tex, tint, at: cue(), recipe: r, follow: r.follow ? cue : undefined });
        });
      }
    }
    if (ultimate) {
      const urls = Array.from({ length: 16 }, (_, i) => `${BASE}art/sects/${sect}/flip/${String(i).padStart(2, '0')}.webp`);
      void Promise.all(urls.map((u) => this.load(u))).then((frames) => {
        if (frames.some((f) => !f)) return;
        this.add({ tex: frames[0], tint, at: cue(), recipe: { el: '', size: [0.42, 0.42], alpha: [1, 1], dur: 0.8, where: 'cue' }, frames: frames as Texture[] });
      });
    }
  }

  update(dt: number) {
    this.pieces = this.pieces.filter((p) => {
      p.t += dt;
      const k = Math.min(1, p.t / p.dur);
      const e = 1 - (1 - k) * (1 - k);
      if (p.frames) {
        p.s.texture = p.frames[Math.min(p.frames.length - 1, Math.floor(k * p.frames.length))];
      }
      const size = p.size[0] + (p.size[1] - p.size[0]) * e;
      p.s.width = p.s.height = size;
      p.s.alpha = p.alpha[0] + (p.alpha[1] - p.alpha[0]) * (p.frames ? 0 : k);
      if (p.frames && k > 0.85) p.s.alpha = (1 - k) / 0.15;
      p.s.rotation += p.spin * dt;
      if (p.at) {
        const at = p.at();
        p.s.position.set(at.x, at.y);
      }
      if (k >= 1) {
        p.s.destroy();
        return false;
      }
      return true;
    });
  }
}
