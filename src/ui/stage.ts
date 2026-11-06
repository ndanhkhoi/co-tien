import { Application } from 'pixi.js';
import { warmBallShader } from '../render/ball-warmup';
import { releaseTableArt } from '../render/table-art';
import { btn, h } from './dom';

/**
 * The WebGL table exists only while a match is on screen. Menus are plain DOM, so they hold no
 * context: a GPU process reset while the player scrolls a menu (phones under raster pressure) only
 * repaints the page, and never strands a dead table behind a "graphics stopped" sheet. Leaving the
 * match frees the drawing buffer, compiled programs and every uploaded texture with the context.
 */
export class Stage {
  private app: Application | null = null;
  private opening: Promise<Application> | null = null;
  private closing: Promise<void> = Promise.resolve();
  private lostTimer = 0;

  constructor(private readonly host: HTMLElement) {}

  get isOpen(): boolean {
    return this.app !== null;
  }

  /** The live renderer; only match code calls this, and matches mount after `open()` resolved. */
  get pixi(): Application {
    if (!this.app) throw new Error('Stage is closed');
    return this.app;
  }

  /** Create the renderer, or hand back the one already up (a rematch keeps it). */
  open(): Promise<Application> {
    if (this.app) return Promise.resolve(this.app);
    this.opening ??= this.create().finally(() => (this.opening = null));
    return this.opening;
  }

  /** Free the context and everything uploaded to it. Safe to call when nothing is open. */
  close(): void {
    const pixi = this.app;
    if (!pixi) return;
    this.app = null;
    removeEventListener('resize', this.onResize);
    clearTimeout(this.lostTimer);
    document.querySelector('.gpu-sheet')?.remove();
    const gl = (pixi.renderer as { gl?: WebGLRenderingContext }).gl;
    // Table art is released through the renderer that holds its GPU copies, then the renderer goes.
    this.closing = releaseTableArt().then(() => {
      pixi.destroy({ removeView: true }, { children: true });
      // Destroying the renderer does not give the context back; the browser would keep it until GC.
      gl?.getExtension('WEBGL_lose_context')?.loseContext();
    });
  }

  /** WebGL could not start at all (the browser blocks it after repeated GPU resets). */
  fail(): void {
    showGpuSheet();
  }

  private async create(): Promise<Application> {
    await this.closing;
    const pixi = new Application();
    // The canvas spans the window, so cap its pixel count: a 4K-class buffer with MSAA cannot hold
    // 60 fps on most GPUs, and a late frame stutters both the rolling balls and the power bar.
    // Dense screens skip MSAA; balls are anti-aliased in their own shader.
    const dpr = window.devicePixelRatio || 1;
    const resolution = Math.max(1, Math.min(dpr, 2, Math.sqrt(3_600_000 / (innerWidth * innerHeight))));
    await pixi.init({
      width: innerWidth, height: innerHeight,
      antialias: resolution < 1.5,
      backgroundAlpha: 0,
      resolution,
      autoDensity: true,
      preference: 'webgl',
      powerPreference: 'high-performance',
    });
    // Screens draw the stage themselves, and only when its picture changed (TableView.shouldRender):
    // a still table must not cost a full redraw and composite every frame.
    pixi.ticker.stop();
    pixi.ticker.remove(pixi.render, pixi);
    this.watch(pixi.canvas);
    this.host.append(pixi.canvas);
    // Link every program a match uses before its screen slides in, so the first table frame does not stall.
    warmBallShader(pixi);
    // Sized by hand, not `resizeTo`, so a resize never renders behind the screen's own frame loop.
    addEventListener('resize', this.onResize);
    this.app = pixi;
    return pixi;
  }

  private readonly onResize = () => this.app?.renderer.resize(innerWidth, innerHeight);

  /**
   * A GPU reset mid-match drops the context. PixiJS rebuilds the table once the browser restores it;
   * when the browser keeps it away the table would stay blank, so the player is offered a reload.
   */
  private watch(canvas: HTMLCanvasElement) {
    canvas.addEventListener('webglcontextlost', () => {
      if (this.app?.canvas !== canvas) return;
      clearTimeout(this.lostTimer);
      this.lostTimer = window.setTimeout(showGpuSheet, 3000);
    });
    canvas.addEventListener('webglcontextrestored', () => {
      clearTimeout(this.lostTimer);
      document.querySelector('.gpu-sheet')?.remove();
    });
  }
}

function showGpuSheet() {
  if (document.querySelector('.gpu-sheet')) return;
  document.body.append(h('div.update-sheet.gpu-sheet', { role: 'alert', 'aria-live': 'assertive' },
    h('div.us-card', null, h('img.us-logo', { src: `${import.meta.env.BASE_URL}art/ui/logo.webp`, alt: 'Cơ Tiên' }),
      h('b.us-text', null, 'Đồ hoạ bị gián đoạn'),
      h('span.us-note', null, 'Trình duyệt vừa tạm dừng bộ xử lý đồ hoạ. Tải lại để bàn hiện lại. Hồ sơ được giữ nguyên, riêng trận đang chơi sẽ không được lưu.'),
      btn('Tải lại', () => location.reload()))));
}
