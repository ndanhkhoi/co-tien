import type { Ball, Terrain } from '../../../core/physics';
import { appliesTo } from '../../../game/match/skills';
import { h, uiOrigin, uiScale } from '../../dom';
import type { MatchCtx } from './context';
import type { MatchDom } from './dom';

/**
 * Skill callouts: a skill's effect is named on the table at the moment it acts, so it never works unseen.
 * Fields (swirls, hollows, friction patches) pulse and name what they did to a ball as it leaves them; the shooter's
 * modifiers (tremor, drift, power cap or boost, wider or pulling pockets) are named at the cue ball on the strike.
 */

type FieldKind = 'bend' | 'slick' | 'sand' | 'wash';

interface Field { x: number; y: number; r: number; name: string; kind: FieldKind }

/** A ball's state on entering a field; `hit` once it touched a ball or rail inside, which spoils the measure. */
interface Crossing { heading: number; speed: number; spin: number; hit: boolean }

/** Names of the families that lay fields; omens use their own name. */
const FIELD_NAMES: Record<string, string> = {
  vortex: 'Xoáy', well: 'Giếng hút', silk: 'Dải lụa', slick: 'Nỉ trơn', sand: 'Cát', spinwash: 'Mực tan',
};

/** At most this many field callouts per shot, so a crowded break never buries the table in labels. */
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
  pocketed(pocket: number): void;
  /** Name an instant skill effect at a table point (a displaced or swapped ball). */
  note(x: number, y: number, text: string): void;
  /** Forget the shot (resolved, rewound or a new rack). */
  reset(): void;
}

export function createSkillCallouts(ctx: MatchCtx, dom: MatchDom): SkillCallouts {
  let fields: Field[] = [];
  let pocketNote: string | null = null;
  let shown = 0;
  const inside = new Map<string, Crossing>();
  const reset = () => { fields = []; inside.clear(); pocketNote = null; shown = 0; };
  const say = (x: number, y: number, text: string, tone: 'ink' | 'red' = 'ink') => {
    placeLabel(ctx, dom, { x, y, text, tone });
  };
  return {
    beforeShot() {
      reset();
      if (!ctx.hasSkills) return;
      fields = activeFields(ctx.match);
      pocketNote = pocketBuff(ctx.match);
      const cue = ctx.match.cueBall();
      shooterNotes(ctx.match).forEach((text, i) => say(cue.x, cue.y - ctx.match.table.R * (3 + i * 2.6), text, 'red'));
    },
    tick() {
      if (!fields.length || ctx.match.phase !== 'rolling') return;
      for (const b of ctx.match.balls) {
        if (!b.onTable) continue;
        fields.forEach((f, i) => {
          const note = crossField(inside, `${b.id}:${i}`, b, f);
          if (note === 'enter') ctx.view.ring(f.x, f.y, 0xb03522, f.r / 3);
          else if (note && shown < MAX_PER_SHOT) { shown++; say(b.x, b.y, note); }
        });
      }
    },
    contact(id) {
      for (const [key, c] of inside) if (key.startsWith(`${id}:`)) c.hit = true;
    },
    pocketed(pocket) {
      if (!pocketNote) return;
      const p = ctx.match.table.pockets[pocket];
      say(p.hx * 0.86, p.hy * 0.8, pocketNote, 'red');
      pocketNote = null;
    },
    note: (x, y, text) => say(x, y, text),
    reset,
  };
}

/** Fields acting on the shot about to be played, each named after the skill or omen that laid it. */
function activeFields(m: MatchCtx['match']): Field[] {
  const out: Field[] = [];
  if (m.omen?.terrain) out.push(...terrainFields(m.omen.terrain, m.omen.name));
  for (const e of m.activeEffects) {
    if (appliesTo(e.target, m.turn)) out.push(...terrainFields(e.terrain, FIELD_NAMES[e.kind] ?? 'Chiêu'));
  }
  return out;
}

function terrainFields(t: Terrain, name: string): Field[] {
  const bends = [...(t.vortices ?? []), ...(t.wells ?? [])].map((f): Field => ({ x: f.x, y: f.y, r: f.r, name, kind: 'bend' }));
  const patches = (t.patches ?? []).map((p): Field => ({
    x: p.x, y: p.y, r: p.r, name, kind: (p.spin ?? 1) < 1 ? 'wash' : p.roll < 1 ? 'slick' : 'sand',
  }));
  return [...bends, ...patches];
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
function shooterNotes(m: MatchCtx['match']): string[] {
  const n: string[] = [];
  const num = (x: number, d = 1) => x.toFixed(d).replace('.', ',');
  if (m.tremorNow > 1) n.push(`Run tay ×${num(m.tremorNow)}`);
  if (m.driftNow) n.push(`Dắt lệch ${num(m.driftNow)}°`);
  if (m.freezeNow < 1) n.push(`Lực tối đa ${Math.round(m.freezeNow * 100)}%`);
  if (m.powerBoost > 1) n.push(`Lực +${Math.round((m.powerBoost - 1) * 100)}%`);
  if (m.spinBoost > 1) n.push(`Áp phê +${Math.round((m.spinBoost - 1) * 100)}%`);
  if (m.blindNow) n.push('Mất đường ngắm');
  if (m.blast) n.push('Xung lực chờ va chạm');
  if (m.secondChance) n.push('Trượt vẫn được đánh tiếp');
  const force = m.terrain().force;
  if (force && Math.hypot(force.x, force.y) > 0 && m.activeEffects.some((e) => appliesTo(e.target, m.turn) && (e.kind === 'wind' || e.kind === 'quake'))) {
    n.push(m.activeEffects.some((e) => e.kind === 'quake') ? 'Bàn nghiêng' : 'Gió đẩy bi');
  }
  return n.slice(0, 3);
}

function pocketBuff(m: MatchCtx['match']): string | null {
  if (m.pull > 0) return 'Lỗ hút bi';
  if (m.mawScale > 1) return `Miệng lỗ rộng +${Math.round((m.mawScale - 1) * 100)}%`;
  return null;
}

/** One ink label pinned to a table point; it fades out by itself. */
function placeLabel(ctx: MatchCtx, dom: MatchDom, x: { x: number; y: number; text: string; tone: 'ink' | 'red' }): void {
  const k = uiScale();
  const sp = ctx.view.toScreen(x.x, x.y);
  const o = uiOrigin();
  const el = h('div.mx-callout', { class: x.tone, role: 'status' }, x.text);
  el.style.left = `${Math.round((sp.x - o.left) / k)}px`;
  el.style.top = `${Math.round((sp.y - o.top) / k)}px`;
  dom.el.append(el);
  window.setTimeout(() => el.remove(), 1900);
}
