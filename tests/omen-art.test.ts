import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Assets, Sprite, Texture } from 'pixi.js';
import type { Match } from '../src/game/match';
import type { OmenArt } from '../src/render/omen-art';

let OmenView: typeof OmenArt;
beforeAll(async () => {
  vi.stubGlobal('document', { baseURI: 'http://localhost/' });
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
  vi.spyOn(Assets, 'load').mockImplementation(async () => Texture.WHITE as never);
  OmenView = (await import('../src/render/omen-art')).OmenArt;
});
afterAll(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function fixture() {
  const match = {
    table: { L: 1.981, W: 0.991, R: 0.028575, pockets: [] },
    closedPockets: [], omen: null,
  } as unknown as Match;
  const view = new OmenView(match);
  // Mirrors TableView.world's metre-to-pixel transform.
  view.layer.scale.set(250);
  const sprites = () => view.layer.children.filter((s): s is Sprite => s instanceof Sprite && s.visible && s.alpha > 0);
  return { match, view, sprites };
}

describe('painted omen overlays', () => {
  it('stretches roots to the segment length with a readable thickness below the balls', async () => {
    const { match, view, sprites } = fixture();
    await Promise.resolve();
    match.omen = { id: 'roots', name: '', desc: '', segments: [{ ax: -0.1, ay: -0.1, bx: 0.2, by: 0.3 }] };
    view.update(1);
    view.update(1);
    const [root] = sprites();
    expect(root.width * view.layer.scale.x).toBeCloseTo(125);
    expect(root.height * view.layer.scale.y).toBeCloseTo(40);
    expect(root.rotation).toBeCloseTo(Math.atan2(0.4, 0.3));
    expect(root.x).toBeCloseTo(0.05);
    expect(root.y).toBeCloseTo(0.1);
    expect(root.alpha).toBeCloseTo(0.9);
    view.layer.destroy({ children: true });
  });

  it('draws every snow patch immediately and replaces old overlays mid-rack', async () => {
    const { match, view, sprites } = fixture();
    await Promise.resolve();
    const patches = [0.12, 0.16, 0.2].map((r, i) => ({ x: (i - 1) * 0.4, y: 0, r, roll: 3.2, slide: 1.4 }));
    match.omen = { id: 'snow', name: '', desc: '', terrain: { patches } };
    view.update(0);
    expect(sprites()).toHaveLength(12);
    for (const [i, patch] of patches.entries()) {
      const drift = sprites()[i * 4];
      expect(drift.width * view.layer.scale.x).toBeCloseTo(patch.r * 2 * 250);
      expect(drift.height).toBeCloseTo(patch.r * 2);
      expect(drift.alpha).toBeGreaterThanOrEqual(0.6);
      expect(drift.mask).toBeTruthy();
    }
    match.omen = { id: 'snow', name: '', desc: '', terrain: { patches: [{ ...patches[0], x: 0.5 }] } };
    view.update(0);
    expect(sprites()).toHaveLength(4);
    expect(sprites()[0].x).toBe(0.5);
    match.omen = null;
    view.update(0);
    expect(sprites()).toHaveLength(0);
    view.layer.destroy({ children: true });
  });
});
