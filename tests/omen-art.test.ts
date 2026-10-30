import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Assets, Graphics, Sprite, Texture } from 'pixi.js';
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
  const sprites = () => view.layer.children.flatMap(c => c.children.length ? c.children : [c])
    .filter((s): s is Sprite => s instanceof Sprite && s.visible && s.alpha > 0);
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
      expect(drift.parent?.mask).toBeTruthy();
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
  it('draws one silk ribbon over its vortices and keeps their spin marks readable', async () => {
    const { match, view, sprites } = fixture();
    await Promise.resolve();
    const vortices = [
      { x: -0.16, y: -0.08, r: 0.1, sense: 1 },
      { x: 0, y: 0, r: 0.1, sense: -1 },
      { x: 0.16, y: 0.08, r: 0.1, sense: 1 },
    ];
    match.activeEffects = [{
      kind: 'silk', slot: 0, segments: [],
      cast: { point: { x: 0.2, y: -0.1 }, direction: { x: 1, y: 2 } },
      terrain: { vortices },
    }] as unknown as Match['activeEffects'];
    view.update(0);
    const painted = sprites();
    expect(painted).toHaveLength(4);
    const [ribbon, ...spins] = painted;
    const angle = Math.atan2(2, 1);
    const axis = { x: Math.cos(angle), y: Math.sin(angle) };
    const halfLength = vortices.reduce((reach, p) => Math.max(reach,
      Math.abs((p.x - 0.2) * axis.x + (p.y + 0.1) * axis.y) + p.r), 0);
    expect(ribbon.rotation).toBeCloseTo(angle);
    expect(ribbon.x).toBeCloseTo(0.2);
    expect(ribbon.y).toBeCloseTo(-0.1);
    expect(ribbon.width * view.layer.scale.x).toBeCloseTo(halfLength * 2 * 250);
    expect(ribbon.parent?.mask).toBeTruthy();
    for (const [i, spin] of spins.entries()) {
      expect(spin.x).toBeCloseTo(vortices[i].x);
      expect(spin.y).toBeCloseTo(vortices[i].y);
      expect(spin.rotation).toBe(0);
    }
    view.layer.destroy({ children: true });
  });

  it('never lets the white bed mask draw when a pocket seal sits beside clipped terrain', async () => {
    const { match, view } = fixture();
    await Promise.resolve();
    // A sealed pocket paints unclipped; roots paint clipped to the bed. Mixing both in one frame used to
    // leave the shared white mask switched on, painting the cloth white.
    Object.assign(match.table, { pockets: [{ hx: 0.95, hy: 0.45, hr: 0.05 }] });
    match.closedPockets = [0];
    match.omen = { id: 'roots', name: '', desc: '', segments: [{ ax: -0.1, ay: -0.1, bx: 0.2, by: 0.3 }] };
    for (let i = 0; i < 3; i++) view.update(0.016);
    const mask = view.layer.children.find((c): c is Graphics => c instanceof Graphics)!;
    expect(mask.includeInBuild).toBe(false);
    view.layer.destroy({ children: true });
  });
});
