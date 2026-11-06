import { Assets, type Texture } from 'pixi.js';

/**
 * Painted table art (omen terrain, skill brushwork) is shared through Assets so a match uploads each
 * file once. Its GPU copies belong to the renderer that drew them, so the stage releases them all
 * before that renderer goes away; the next match reads the files again from the HTTP cache.
 */
const loaded = new Set<string>();

export function loadTableArt(url: string): Promise<Texture> {
  loaded.add(url);
  return Assets.load<Texture>(url);
}

export async function releaseTableArt(): Promise<void> {
  if (!loaded.size) return;
  const urls = [...loaded];
  loaded.clear();
  await Assets.unload(urls).catch(() => undefined);
}
