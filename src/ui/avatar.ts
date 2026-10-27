import { champion, portraitUrl, sect } from '../game/content/sects';
import { h } from './dom';

const hex6 = (n: number) => '#' + n.toString(16).padStart(6, '0');

/**
 * Champion portrait (chibi) on its sect colour. If the portrait is missing (art not
 * generated yet, offline), the champion's initial on the sect colour stands in.
 */
export function avatar(championId: string): HTMLElement {
  const c = champion(championId);
  const s = sect(c.sect);
  const img = h('img.avatar-img', { src: portraitUrl(c.id), alt: c.name, draggable: false, decoding: 'async' });
  img.style.background = hex6(s.main);
  img.addEventListener('error', () => {
    img.replaceWith(h('div.avatar-img.avatar-fallback', { style: `background:radial-gradient(circle at 50% 35%, ${hex6(s.glow)}, ${hex6(s.main)} 70%)`, title: c.name }, c.name.split(' ').pop()!.charAt(0)));
  }, { once: true });
  return img;
}
