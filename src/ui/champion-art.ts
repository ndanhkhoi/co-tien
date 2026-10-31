import { cutoutUrl, poseUrl, winUrl, type Champion } from '../game/content/sects';
import { artOnDevice, hasArt, preloadArt } from '../platform/preload';

export interface ChampionPainting { label: string; src: string }

/** Paintings the art tab may show, excluding the finisher (matches keep that pose for impact). */
export function fullFigurePaintings(c: Champion): ChampionPainting[] {
  const poses = (c.gallery ?? []).map((g, i) => ({ label: g.label, src: poseUrl(c.id, i + 1) }));
  return [
    { label: 'Toàn thân', src: cutoutUrl(c.id) },
    { label: 'Thắng', src: winUrl(c.id) },
    ...poses,
  ].filter((p) => hasArt(p.src));
}

/** Menus never trigger a pose download: pick only gallery poses already stored on this device. */
export function menuFigurePaintings(c: Champion): ChampionPainting[] {
  return fullFigurePaintings(c).filter((p) => p.src === cutoutUrl(c.id) || p.src === winUrl(c.id) || artOnDevice(p.src));
}

/** Fetch the paintings the art tab is about to show; absent files stay hidden instead of breaking. */
export function preloadFigures(paintings: ChampionPainting[]): void {
  void preloadArt(paintings.map((p) => p.src).filter((src) => hasArt(src) && !artOnDevice(src)));
}
