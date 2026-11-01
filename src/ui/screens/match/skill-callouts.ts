import type { Ball, Terrain } from '../../../core/physics';
import { appliesTo } from '../../../game/match/skills';
import { h } from '../../dom';
import { icon, type IconName } from '../../icons';
import type { MatchCtx } from './context';
import type { MatchDom } from './dom';

/**
 * Skill effects are named in the top information slot at the moment they act.
 * Fields still pulse on the table; their text never covers the balls or the aiming line.
 */

type FieldKind = 'bend' | 'slick' | 'sand' | 'wash';

interface Field { x: number; y: number; r: number; name: string; kind: FieldKind; glyph: IconName }

/** One line of a callout: the painted glyph of the effect and what it did. */
interface Note { glyph: IconName; text: string }
interface Notice extends Note { tone: 'ink' | 'red' }

/** A ball's state on entering a field; `hit` once it touched a ball or rail inside, which spoils the measure. */
interface Crossing { heading: number; speed: number; spin: number; hit: boolean }

/** Names of the families that lay fields; omens use their own name. */
const FIELD_NAMES: Record<string, string> = {
  vortex: 'Xoáy', well: 'Giếng hút', silk: 'Dải lụa', slick: 'Nỉ trơn', sand: 'Cát', spinwash: 'Mực tan',
};
const FIELD_GLYPHS: Record<string, IconName> = {
  vortex: 'fx-swirl', well: 'fx-well', silk: 'fx-silk', slick: 'fx-slick', sand: 'fx-sand', spinwash: 'fx-wash',
};

/** At most this many field notes per shot, so a crowded break does not flood the information slot. */
const MAX_PER_SHOT = 6;
/** A bend smaller than this is not worth naming. */
const MIN_BEND_DEG = 2;

export interface SkillCallouts {
  /** Read the shooter's modifiers and the active fields just before the cue ball is struck. */
  beforeShot(): void;
  /** Track balls crossing fields; call every frame while the balls roll. */
  tick(): void;
  /** A ball touched another ball or a rail: a bend measured across that contact would be the contact's. */
  contact(id: number): void;
  /** A ball dropped: name the pocket buff that helped, once per shot. */
  pocketed(): void;
  /** Name an instant skill effect (a displaced or swapped ball). */
  note(text: string, glyph?: IconName): void;
  dismiss(): boolean;
  /** Forget the shot (resolved, rewound or a new rack). */
  reset(): void;
}

export function createSkillCallouts(ctx: MatchCtx, dom: MatchDom): SkillCallouts {
  let fields: Field[] = [];
  let pocketNote: Note | null = null;
  let shown = 0;
  let notices: Notice[] = [];
  let timer = 0;
  const inside = new Map<string, Crossing>();
  const dismiss = () => {
    const visible = notices.length > 0;
    notices = [];
    clearTimeout(timer);
    dom.effectNotices.replaceChildren();
    return visible;
  };
  const reset = () => { fields = []; inside.clear(); pocketNote = null; shown = 0; dismiss(); };
  const say = (note: Note, tone: 'ink' | 'red' = 'ink') => {
    if (ctx.flags.disposed) return;
    notices = [...notices.filter((n) => n.text !== note.text), { ...note, tone }].slice(-3);
    dom.effectNotices.replaceChildren(...notices.map((n) =>
      h('div.mx-effect-note', { class: n.tone }, icon(n.glyph), h('span', null, n.text))));
    clearTimeout(timer);
    timer = window.setTimeout(dismiss, 2600);
  };
  return {
    beforeShot() {
      reset();
      if (!ctx.hasSkills) return;
      fields = activeFields(ctx.match);
      pocketNote = pocketBuff(ctx.match);
      shooterNotes(ctx.match).forEach((note) => say(note, 'red'));
    },
    tick() {
      if (!fields.length || ctx.match.phase !== 'rolling') return;
      for (const b of ctx.match.balls) {
        if (!b.onTable) continue;
        fields.forEach((f, i) => {
          const note = crossField(inside, `${b.id}:${i}`, b, f);
          if (note === 'enter') ctx.view.ring(f.x, f.y, 0xb03522, f.r / 3);
          else if (note && shown < MAX_PER_SHOT) { shown++; say({ glyph: f.glyph, text: `Bi ${b.id} · ${note}` }); }
        });
      }
    },
    contact(id) {
      for (const [key, c] of inside) if (key.startsWith(`${id}:`)) c.hit = true;
    },
    pocketed() {
      if (!pocketNote) return;
      say(pocketNote, 'red');
      pocketNote = null;
    },
    note: (text, glyph = 'fx-swap') => say({ glyph, text }),
    dismiss,
    reset,
  };
}

/** Fields acting on the shot about to be played, each named after the skill or omen that laid it. */
function activeFields(m: MatchCtx['match']): Field[] {
  const out: Field[] = [];
  if (m.omen?.terrain) out.push(...terrainFields(m.omen.terrain, m.omen.name));
  for (const e of m.activeEffects) {
    if (appliesTo(e.target, m.turn)) out.push(...terrainFields(e.terrain, FIELD_NAMES[e.kind] ?? 'Chiêu', FIELD_GLYPHS[e.kind]));
  }
  return out;
}

function terrainFields(t: Terrain, name: string, glyph?: IconName): Field[] {
  const swirls = (t.vortices ?? []).map((f): Field => ({ x: f.x, y: f.y, r: f.r, name, kind: 'bend', glyph: glyph ?? 'fx-swirl' }));
  const wells = (t.wells ?? []).map((f): Field => ({ x: f.x, y: f.y, r: f.r, name, kind: 'bend', glyph: glyph ?? 'fx-well' }));
  const patches = (t.patches ?? []).map((p): Field => {
    const kind: FieldKind = (p.spin ?? 1) < 1 ? 'wash' : p.roll < 1 ? 'slick' : 'sand';
    return { x: p.x, y: p.y, r: p.r, name, kind, glyph: glyph ?? ({ wash: 'fx-wash', slick: 'fx-slick', sand: 'fx-sand', bend: 'fx-swirl' } as const)[kind] };
  });
  return [...swirls, ...wells, ...patches];
}

/** 'enter' when the ball comes into the field, a label when it leaves having been changed, otherwise null. */
function crossField(inside: Map<string, Crossing>, key: string, b: Ball, f: Field): 'enter' | string | null {
  const speed = Math.hypot(b.vx, b.vy);
  const within = Math.hypot(b.x - f.x, b.y - f.y) < f.r;
  const was = inside.get(key);
  if (within && !was && speed > 0.05) {
    inside.set(key, { heading: Math.atan2(b.vy, b.vx), speed, spin: Math.hypot(b.wx, b.wy) + Math.abs(b.wz), hit: false });
    return 'enter';
  }
  if (!was || (within && speed > 0.02 && b.onTable)) return null;
  inside.delete(key);
  return was.hit ? null : fieldNote(f, was, b, speed);
}

function fieldNote(f: Field, was: Crossing, b: Ball, speed: number): string | null {
  if (f.kind === 'bend') {
    if (speed < 0.02) return `${f.name} · giữ bi lại`;
    let d = Math.atan2(b.vy, b.vx) - was.heading;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    const deg = Math.round(Math.abs(d) * 180 / Math.PI);
    return deg >= MIN_BEND_DEG ? `${f.name} · lệch ${deg}°` : null;
  }
  if (f.kind === 'wash') return `${f.name} · mất áp phê`;
  if (f.kind === 'slick') return `${f.name} · bi trôi xa`;
  return speed < 0.02 || speed < was.speed * 0.7 ? `${f.name} · hãm bi` : null;
}

/** What the shooter's own and the opponent's skills do to this strike. */
function shooterNotes(m: MatchCtx['match']): Note[] {
  const n: Note[] = [];
  const num = (x: number, d = 1) => x.toFixed(d).replace('.', ',');
  if (m.tremorNow > 1) n.push({ glyph: 'tremor', text: `Run tay ×${num(m.tremorNow)}` });
  if (m.driftNow) n.push({ glyph: 'fx-drift', text: `Dắt lệch ${num(m.driftNow)}°` });
  if (m.freezeNow < 1) n.push({ glyph: 'fx-chain', text: `Lực tối đa ${Math.round(m.freezeNow * 100)}%` });
  if (m.powerBoost > 1) n.push({ glyph: 'fx-boost', text: `Lực +${Math.round((m.powerBoost - 1) * 100)}%` });
  if (m.spinBoost > 1) n.push({ glyph: 'fx-spin', text: `Áp phê +${Math.round((m.spinBoost - 1) * 100)}%` });
  if (m.blindNow) n.push({ glyph: 'vision', text: 'Mất đường ngắm' });
  if (m.blast) n.push({ glyph: 'fx-blast', text: 'Xung lực chờ va chạm' });
  if (m.secondChance) n.push({ glyph: 'replay', text: 'Trượt vẫn được đánh tiếp' });
  const force = m.terrain().force;
  const pushed = m.activeEffects.find((e) => appliesTo(e.target, m.turn) && (e.kind === 'wind' || e.kind === 'quake'));
  if (force && Math.hypot(force.x, force.y) > 0 && pushed) {
    n.push(pushed.kind === 'quake' ? { glyph: 'fx-quake', text: 'Bàn nghiêng' } : { glyph: 'fx-wind', text: 'Gió đẩy bi' });
  }
  return n.slice(0, 3);
}

function pocketBuff(m: MatchCtx['match']): Note | null {
  if (m.pull > 0) return { glyph: 'fx-pull', text: 'Lỗ hút bi' };
  if (m.mawScale > 1) return { glyph: 'fx-wide', text: `Miệng lỗ rộng +${Math.round((m.mawScale - 1) * 100)}%` };
  return null;
}
