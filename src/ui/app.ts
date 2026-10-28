import { Application } from 'pixi.js';
import { AiClient } from '../ai/ai-client';
import { sound } from '../audio/sound';
import { CUES, TABLES } from '../game/content/gear';
import { levelOf, loadProfile, saveProfile, type Profile } from '../game/profile';
import { setHaptics } from '../platform/device';
import { h, modal as baseModal, toast } from './dom';

export interface Screen {
  el: HTMLElement;
  /** Hardware/browser back. Return true when handled (e.g. opens a pause menu). */
  onBack?: () => boolean;
  /** Called when the screen is removed. */
  dispose?: () => void;
  /** Uses the WebGL stage (game screens). */
  usesStage?: boolean;
}

export type ScreenFactory = (app: App) => Screen;

export class App {
  pixi!: Application;
  readonly profile: Profile;
  readonly ai = new AiClient();
  private ui = document.getElementById('ui')!;
  private stageEl = document.getElementById('stage')!;
  private stack: ScreenFactory[] = [];
  private current: Screen | null = null;
  private pendingUpdate: (() => void) | null = null;

  constructor() {
    this.profile = loadProfile();
    this.applySettings();
  }

  async init() {
    this.pixi = new Application();
    await this.pixi.init({
      resizeTo: window,
      antialias: true,
      backgroundAlpha: 0,
      resolution: Math.min(window.devicePixelRatio || 1, 2.5),
      autoDensity: true,
      preference: 'webgl',
      powerPreference: 'high-performance',
    });
    this.stageEl.append(this.pixi.canvas);
    this.pixi.ticker.stop();
    // Back button / swipe-back: route through screens instead of leaving the page.
    history.replaceState({ tc: 0 }, '');
    history.pushState({ tc: 1 }, '');
    window.addEventListener('popstate', () => {
      history.pushState({ tc: 1 }, '');
      this.back();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) sound.suspend();
      else sound.resume();
    });
  }

  applySettings() {
    const s = this.profile.settings;
    sound.setVolumes(s.sfx, s.music);
    setHaptics(s.haptics);
  }

  save() {
    saveProfile(this.profile);
  }

  get level() {
    return levelOf(this.profile.xp);
  }

  get cue() {
    return CUES.find((c) => c.id === this.profile.cue) ?? CUES[0];
  }

  get tableSkin() {
    return TABLES.find((t) => t.id === this.profile.table) ?? TABLES[0];
  }

  /** Navigate. `replace` swaps the top of the stack (used for results → next match). */
  go(factory: ScreenFactory, opts: { replace?: boolean; reset?: boolean } = {}) {
    if (opts.reset) this.stack = [];
    else if (opts.replace) this.stack.pop();
    this.stack.push(factory);
    this.show(factory, opts.reset ? 'reset' : 'forward');
  }

  back() {
    if (document.querySelector('.modal-wrap')) {
      // Close the top modal first.
      document.querySelectorAll('.modal-wrap').forEach((m, i, all) => i === all.length - 1 && (m.querySelector('.motion-sheet') ? m.dispatchEvent(new Event('motion-close')) : m.remove()));
      return;
    }
    if (this.current?.onBack?.()) return;
    if (this.stack.length <= 1) return;
    this.stack.pop();
    this.show(this.stack[this.stack.length - 1], 'back');
  }

  /** A new version is ready: apply now from menus, or after the current match. */
  setPendingUpdate(apply: () => void) {
    this.pendingUpdate = apply;
    // Updates are mandatory: right away from menus, and the moment the current match ends.
    if (this.current?.usesStage) toast('Có bản mới — game sẽ tự cập nhật ngay khi hết trận', 'gold');
    else this.applyUpdate();
  }

  private applyUpdate() {
    const apply = this.pendingUpdate;
    if (!apply) return;
    this.pendingUpdate = null;
    // A blocking sheet: nothing can be tapped while the new version loads.
    document.body.append(h('div.update-sheet', { role: 'alert' }, h('div.us-seal'), h('b', null, 'Đang cập nhật bản mới…')));
    setTimeout(apply, 700);
  }

  /** Leave the current screen unconditionally (closes any open dialogs). */
  pop() {
    document.querySelectorAll('.modal-wrap').forEach((m) => m.remove());
    if (this.stack.length <= 1) return;
    this.stack.pop();
    this.show(this.stack[this.stack.length - 1], 'back');
  }

  private show(factory: ScreenFactory, direction: 'forward' | 'back' | 'reset') {
    this.ui.querySelectorAll('.screen.out').forEach((el) => el.remove());
    const prev = this.current;
    if (prev) {
      prev.dispose?.();
      prev.el.inert = true;
      prev.el.dataset.direction = direction;
      prev.el.classList.add('out');
      setTimeout(() => prev.el.remove(), 280);
    }
    const next = factory(this);
    this.current = next;
    this.stageEl.style.visibility = next.usesStage ? 'visible' : 'hidden';
    if (next.usesStage) this.pixi.ticker.start();
    else this.pixi.ticker.stop();
    next.el.dataset.direction = direction;
    this.ui.append(next.el);
    if (!next.usesStage && this.pendingUpdate) this.applyUpdate();
  }

  /** Coins / XP reward with level-up detection. Returns levels gained. */
  reward(coins: number, xp: number): number {
    const before = this.level;
    this.profile.coins += coins;
    this.profile.xp += xp;
    this.save();
    return this.level - before;
  }
}

export function screenEl(cls = ''): HTMLElement {
  return h('div.screen.felt-noise', { class: cls });
}

/** Snapshot only the outgoing paint; live content and controls update immediately. */
export function turnPage(el: HTMLElement, update: () => void, direction = 1, fade = false) {
  el.getAnimations().forEach((a) => a.cancel());
  const parent = el.parentElement;
  parent?.querySelectorAll(':scope > .page-echo').forEach((e) => e.remove());
  if (!parent || !el.isConnected || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    update();
    return;
  }
  if (getComputedStyle(parent).position === 'static') parent.classList.add('page-motion-host');
  const bounds = { left: el.offsetLeft, top: el.offsetTop, width: el.offsetWidth, height: el.offsetHeight };
  const echo = el.cloneNode(true) as HTMLElement;
  echo.removeAttribute('id');
  echo.classList.add('page-echo');
  echo.inert = true;
  echo.setAttribute('aria-hidden', 'true');
  Object.assign(echo.style, { left: `${bounds.left}px`, top: `${bounds.top}px`, width: `${bounds.width}px`, height: `${bounds.height}px`, margin: '0' });
  parent.append(echo);
  echo.scrollTop = el.scrollTop;
  update();
  const options = { duration: 280, easing: 'cubic-bezier(.2,.8,.25,1)' };
  const x = fade ? 0 : 32 * direction;
  const exit = echo.animate([{ opacity: 1, transform: 'translateX(0)' }, { opacity: 0, transform: `translateX(${-x}px)` }], options);
  el.animate([{ opacity: 0, transform: `translateX(${x}px)` }, { opacity: 1, transform: 'translateX(0)' }], options);
  exit.onfinish = () => echo.remove();
}

/** Directional sheets, including backdrop and hardware-back dismissal. */
export function motionModal(build: (close: () => void) => HTMLElement, opts: { dismissable?: boolean } = {}) {
  let box: HTMLElement;
  let closing = false;
  const close = () => {
    if (closing) return;
    closing = true;
    const wrap = box.parentElement;
    if (wrap) wrap.inert = true;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { remove(); return; }
    const exit = box.animate([{ opacity: 1, transform: 'translateX(0)' }, { opacity: 0, transform: 'translateX(36px)' }], { duration: 280, easing: 'ease-out' });
    exit.onfinish = remove;
  };
  const remove = baseModal(() => {
    box = build(close);
    box.classList.add('motion-sheet');
    return box;
  });
  const wrap = box!.parentElement!;
  wrap.addEventListener('motion-close', close);
  if (opts.dismissable) wrap.addEventListener('pointerdown', (e) => { if (e.target === wrap) close(); });
  return close;
}
