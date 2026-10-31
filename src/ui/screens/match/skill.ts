import { champion, skillIconUrl, type SkillDef, type SkillKind } from '../../../game/content/sects';
import { skillUsage } from '../../../game/content/skill-usage';
import { buildCast, PLACED_KINDS, type SkillCast } from '../../../game/skill-cast';
import { calledTarget, ENERGY_MAX } from '../../../game/match';
import { sound } from '../../../audio/sound';
import { btn, h } from '../../dom';
import { hintOnce } from '../../hints';
import { icon } from '../../icons';
import { controllerIsHuman, shotController } from './controller';
import type { MatchCtx } from './context';
import { frag, type MatchDom } from './dom';
import { closeCatcher, sheetCloseButton, type Sheets } from './sheet';

interface SkillDeps {
  closeSheets(): void;
  renderHud(): void;
  canInspectSkills(): boolean;
}

export function createSkillDock(ctx: MatchCtx, dom: MatchDom, sheets: Sheets, deps: SkillDeps): { render(): void; open(slot: number): void; skillBlock(side: 0 | 1, slot: number): string | null } {
  const render = () => renderSkills(ctx, dom);
  const open = (slot: number) => {
    if (!deps.canInspectSkills()) return;
    const side = humanSide(ctx);
    if (side === null) return;
    deps.closeSheets();
    openSkill({ ctx, dom, sheets, deps, side, slot });
  };
  return { render, open, skillBlock: (side, slot) => skillBlock(ctx, side, slot) };
}

export function humanSide(ctx: MatchCtx): 0 | 1 | null {
  const { match } = ctx;
  if (controllerIsHuman(match)) return shotController(match);
  const hs = match.setup.players.findIndex((p) => p.kind === 'human');
  return hs < 0 ? null : (hs as 0 | 1);
}

function renderSkills(ctx: MatchCtx, dom: MatchDom): void {
  const { match, opts, hasSkills, flags } = ctx;
  const side = humanSide(ctx);
  if (!hasSkills || side === null) return;
  const champ = champion(opts.setup.players[side].champion);
  let anyReady = false;
  for (const sk of champ.skills) {
    const s = dom.slots[sk.slot];
    const key = `${champ.id}-${sk.slot}`;
    if (s.key !== key) {
      s.key = key;
      s.img.src = skillIconUrl(champ.id, sk.slot);
      s.name.textContent = sk.name;
    }
    const wait = match.skillWait(side, sk.slot);
    const can = canInspectSkills(ctx) && match.canUseSkill(side, sk.slot);
    anyReady ||= can;
    paintSlot(ctx, s, { side, slot: sk.slot, wait, can, name: sk.name });
  }
  if (flags.begun && anyReady && isHumanTurn(ctx)) showSkillHint(ctx, dom, champ);
}

function paintSlot(ctx: MatchCtx, s: { b: HTMLButtonElement; state: HTMLElement }, x: {
  side: 0 | 1; slot: number; wait: number; can: boolean; name: string;
}): void {
  const ult = x.slot === 2;
  s.b.classList.toggle('ready', x.can);
  s.b.classList.toggle('cool', !ult && x.wait > 0);
  s.b.classList.toggle('charging', ult && x.wait < 0);
  const pct = Math.round((ctx.match.energy[x.side] / ENERGY_MAX) * 100);
  s.b.style.setProperty('--e', String(Math.min(100, pct)));
  // Short words inside the pill so it never spills past the slot on narrow phones.
  if (ult && x.wait < 0) s.state.replaceChildren(icon('energy'), h('span', null, `${pct}%`));
  else if (!ult && x.wait > 0) s.state.replaceChildren(icon('cooldown'), h('span', null, `${x.wait} lượt`));
  // Ready needs no tick: the painted ring around the slot already says so.
  else s.state.replaceChildren(h('span', null, x.can ? 'Sẵn sàng' : 'Chờ'));
  s.b.setAttribute('aria-label', `${x.name}${ult ? ' (tuyệt chiêu)' : ''}: ${x.can ? 'sẵn sàng' : skillBlock(ctx, x.side, x.slot) ?? ''}. Chạm để xem.`);
}

function showSkillHint(ctx: MatchCtx, dom: MatchDom, champ: ReturnType<typeof champion>): void {
  void champ;
  hintOnce(ctx.app, { key: 'skill-dock', title: 'Chiêu thức', text: 'Chạm ô sáng để đọc và dùng chiêu. Hai chiêu đầu hồi chiêu theo lượt đánh của bạn; tuyệt chiêu cần đầy thanh năng lượng.',
    anchor: () => dom.dock, place: ctx.lefty ? 'left' : 'right', rail: true });
}

function isHumanTurn(ctx: MatchCtx): boolean {
  return controllerIsHuman(ctx.match) && !ctx.flags.aiActing;
}

export function canInspectSkills(ctx: MatchCtx): boolean {
  return !ctx.flags.presenting && !ctx.flags.paused && ctx.power.strikeT === 0;
}

function skillBlock(ctx: MatchCtx, side: 0 | 1, slot: number): string | null {
  const { match, flags } = ctx;
  if (match.canUseSkill(side, slot)) return null;
  const wait = match.skillWait(side, slot);
  if (slot === 2 && wait < 0) return `Cần đầy thanh năng lượng: ${Math.round(match.energy[side])}/${ENERGY_MAX}`;
  if (wait > 0) return `Hồi chiêu: còn ${wait} lượt đánh của bạn`;
  if (match.phase === 'rolling') return 'Chờ bi dừng lăn';
  if (match.phase === 'rack-over' || match.phase === 'match-over') return 'Ván đã kết thúc';
  if (match.turn !== side || flags.aiActing) return 'Chưa dùng được lúc này, đợi tới lượt bạn';
  return 'Hiệu ứng đang có tác dụng hoặc chưa hợp lúc này';
}

interface OpenSkillArgs {
  ctx: MatchCtx;
  dom: MatchDom;
  sheets: Sheets;
  deps: SkillDeps;
  side: 0 | 1;
  slot: number;
}

function openSkill({ ctx, dom, sheets, deps, side, slot }: OpenSkillArgs): void {
  const { match } = ctx;
  sound.unlock();
  const sk = match.skills(side)[slot];
  const champ = champion(ctx.opts.setup.players[side].champion);
  const ult = slot === 2;
  const req = h('div.mx-sc-req');
  const reason = h('div.mx-sc-reason');
  const useBtn = createUseButton(ctx, dom, deps, { side, slot, sk, ult });
  const box = h('div.mx-sheet.mx-skillcard', { role: 'dialog', 'aria-label': sk.name },
    sheetCloseButton(deps.closeSheets),
    h('div.mx-sc-head', null,
      h('img.mx-sc-icon', { src: skillIconUrl(champ.id, slot), alt: '', draggable: false }),
      h('div.mx-sc-titles', null,
        h('div.mx-sc-kicker', null, ult ? 'Tuyệt chiêu' : `Chiêu ${slot + 1}`, ' · ', champ.name),
        h('div.mx-sc-name', null, sk.name))),
    h('div.mx-sc-desc', null, sk.desc),
    h('div.mx-sc-use', null, h('b', null, 'Cách dùng:'), ' ', skillUsage(sk)),
    req,
    h('div.mx-sc-foot', null, reason, useBtn));
  const catcher = closeCatcher(deps.closeSheets);
  dom.el.append(catcher, box);
  dom.dock.classList.add('sheet-open');
  const refresh = () => refreshSkill(ctx, { req, reason, useBtn }, { side, slot, sk, ult });
  refresh();
  sheets.skill = { el: box, catcher, refresh };
}

interface SkillInfo {
  side: 0 | 1;
  slot: number;
  sk: SkillDef;
  ult: boolean;
}


function createUseButton(ctx: MatchCtx, dom: MatchDom, deps: SkillDeps, info: SkillInfo): HTMLButtonElement {
  const { match, aim } = ctx;
  const { side, slot, sk } = info;
  return btn(frag(icon(info.ult ? 'ultimate' : 'energy'), 'Dùng'), () => {
    if (!canInspectSkills(ctx) || !match.canUseSkill(side, slot)) return;
    deps.closeSheets();
    const placed = sk.kinds.some(k => PLACED_KINDS.includes(k));
    const pick = !placed && picksBall(ctx, side, sk);
    if (!placed && !pick) { match.useSkill(side, slot); return; }
    // A called ball starts on the opponent's ball nearest a pocket; a tap on another ball moves the mark.
    const start = pick ? calledTarget(match, side) : undefined;
    const cast = start ? { point: { x: start.x, y: start.y } } : { direction: { x: Math.cos(aim.angle), y: Math.sin(aim.angle) } };
    ctx.skill.placement = { side, slot, cast };
    previewCast(ctx, cast);
    dom.cancelCast.hidden = false;
    dom.castSense.hidden = pick;
    deps.renderHud();
  }, 'big');
}

function refreshSkill(ctx: MatchCtx, els: { req: HTMLElement; reason: HTMLElement; useBtn: HTMLButtonElement }, info: SkillInfo): void {
  const { match } = ctx;
  const e = Math.round(match.energy[info.side]);
  els.req.replaceChildren(info.ult
    ? frag(icon('energy'), e >= ENERGY_MAX
      ? h('span', null, 'Năng lượng đã đầy, dùng được ngay')
      : h('span', null, `Cần đầy thanh năng lượng (${ENERGY_MAX}) · đang có `, h('b.num', null, String(e))))
    : frag(icon('cooldown'), h('span', null, `Hồi chiêu: ${info.sk.cooldown} lượt đánh của bạn`)));
  const why = skillBlock(ctx, info.side, info.slot);
  els.reason.textContent = why ?? 'Sẵn sàng';
  els.reason.classList.toggle('ok', !why);
  els.useBtn.disabled = !!why || !canInspectSkills(ctx);
}

export function previewCast(ctx: MatchCtx, cast: SkillCast): void {
  const placement = ctx.skill.placement;
  const { match } = ctx;
  if (!placement) return;
  const { side, slot } = placement;
  if (slot === -1) {
    match.castPreview = [buildRailCast(match, side, cast)];
    placement.cast = match.castPreview[0].cast;
    return;
  }
  const sk = match.skills(side)[slot];
  match.castPreview = sk.kinds.filter(k => PLACED_KINDS.includes(k)).map(k => buildCastFor(ctx, { sk, slot, cast, kind: k }));
  placement.cast = match.castPreview[0]?.cast ?? cast;
  previewCalled(ctx, sk);
}

/** A called skill with nothing to lay on the cloth lets the caster tap the ball to mark, on their own turn. */
function picksBall(ctx: MatchCtx, side: 0 | 1, sk: SkillDef): boolean {
  const { match } = ctx;
  return sk.kinds.some((k) => match.effectiveKind(k) === 'called') && match.phase === 'aim' && match.turn === side && controllerIsHuman(match);
}

function previewCalled(ctx: MatchCtx, sk: SkillDef): void {
  const { match } = ctx;
  const placement = ctx.skill.placement!;
  if (!sk.kinds.some((k) => match.effectiveKind(k) === 'called')) { match.calledPreview = null; return; }
  const placed = sk.kinds.some((k) => PLACED_KINDS.includes(k));
  const pick = placed ? undefined : placement.cast.point;
  const ball = calledTarget(match, placement.side, pick);
  match.calledPreview = ball?.id ?? null;
  if (pick && ball) placement.cast = { ...placement.cast, point: { x: ball.x, y: ball.y }, pick: { x: ball.x, y: ball.y } };
}

function buildRailCast(match: MatchCtx['match'], side: 0 | 1, cast: SkillCast) {
  return buildCast('railcraft', 1, -1, { table: match.table, balls: match.balls, cueId: match.cueId(side), cast: { ...cast, hardness: 'soft' } });
}

function buildCastFor(ctx: MatchCtx, x: { sk: SkillDef; slot: number; cast: SkillCast; kind: SkillKind }) {
  const { match } = ctx;
  return buildCast(x.kind, x.sk.tier, x.slot, { table: match.table, balls: match.balls, cueId: match.cueId(ctx.skill.placement!.side), cast: x.cast, ult: x.sk.ult, shape: x.sk.shape });
}
