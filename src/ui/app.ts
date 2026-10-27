import { Application } from 'pixi.js';
import { AiClient } from '../ai/ai-client';
import { sound } from '../audio/sound';
import { CUES, TABLES } from '../game/content/gear';
import { levelOf, loadProfile, saveProfile, type Profile } from '../game/profile';
import { setHaptics } from '../platform/device';
import { h, toast } from './dom';

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
    this.show(factory);
  }

  back() {
    if (document.querySelector('.modal-wrap')) {
      // Close the top modal first.
      document.querySelectorAll('.modal-wrap').forEach((m, i, all) => i === all.length - 1 && m.remove());
      return;
    }
    if (this.current?.onBack?.()) return;
    if (this.stack.length <= 1) return;
    this.stack.pop();
    this.show(this.stack[this.stack.length - 1]);
  }

  /** A new version is ready: apply now from menus, or after the current match. */
  setPendingUpdate(apply: () => void) {
    this.pendingUpdate = apply;
    if (this.current?.usesStage) toast('Có bản mới — sẽ cập nhật khi bạn về menu', 'gold');
    else this.applyUpdate();
  }

  private applyUpdate() {
    const apply = this.pendingUpdate;
    if (!apply) return;
    this.pendingUpdate = null;
    toast('Đang cập nhật bản mới…', 'gold');
    setTimeout(apply, 700);
  }

  /** Leave the current screen unconditionally (closes any open dialogs). */
  pop() {
    document.querySelectorAll('.modal-wrap').forEach((m) => m.remove());
    if (this.stack.length <= 1) return;
    this.stack.pop();
    this.show(this.stack[this.stack.length - 1]);
  }

  private show(factory: ScreenFactory) {
    const prev = this.current;
    if (prev) {
      prev.dispose?.();
      prev.el.classList.add('out');
      setTimeout(() => prev.el.remove(), 200);
    }
    const next = factory(this);
    this.current = next;
    this.stageEl.style.visibility = next.usesStage ? 'visible' : 'hidden';
    if (next.usesStage) this.pixi.ticker.start();
    else this.pixi.ticker.stop();
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
