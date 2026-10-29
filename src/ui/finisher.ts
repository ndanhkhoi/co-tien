import { sound } from '../audio/sound';
import { cutoutUrl, finisherUrl, sect, sectArtUrl, type Champion } from '../game/content/sects';
import { h } from './dom';

const hex6 = (n: number) => '#' + n.toString(16).padStart(6, '0');
const BASE = import.meta.env.BASE_URL;

/** The deciding ball: its painted portrait and how to say it ("Bi 8 vào lỗ"). */
export interface FinalBall { src: string; caption: string }

/**
 * Kết liễu: the shot that wins a rack, told as one action. An ink stroke tears across the stage,
 * the champion lunges in with after-images and drives the cue, the deciding ball flies off the tip
 * on an ink trail and slams into an ink pocket that bursts, the stage shakes, and "Kết liễu" is
 * stamped with the shot's name. About 2.6 s; any tap ends it early. Resolves once it is gone.
 */
export function playFinisher(stage: HTMLElement, c: Champion, feats: string[], ball: FinalBall | null, fromRight: boolean): Promise<void> {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const s = sect(c.sect);
  const art = finisherUrl(c.id);
  // Champions whose finishing pose is not painted yet strike with their cut-out.
  const fallback = (e: Event) => {
    const img = e.target as HTMLImageElement;
    if (!img.src.endsWith('cutout.webp')) img.src = cutoutUrl(c.id);
  };
  const hero = (cls: string) => h(`img.${cls}`, { src: art, alt: '', draggable: false, onerror: fallback });
  const el = h('div.fin', {
    class: `${fromRight ? 'rtl' : ''}${reduced ? ' calm' : ''}`,
    style: `--sect:${hex6(s.main)};--strip:url("${sectArtUrl(c.sect, 'cutin')}");--slash:url("${BASE}art/sects/${c.sect}/vfx/slash.webp");--ring:url("${BASE}art/sects/${c.sect}/vfx/circle.webp");--burst:url("${BASE}art/sects/${c.sect}/vfx/burst.webp");--trail:url("${BASE}art/sects/${c.sect}/vfx/trail.webp")`,
    role: 'status', 'aria-live': 'polite',
  },
  h('div.fin-veil'),
  h('div.fin-strip'),
  h('div.fin-figure', null, hero('fin-ghost g2'), hero('fin-ghost g1'), hero('fin-hero')),
  h('div.fin-slash'),
  // The strike itself: pocket, trail and the deciding ball, mirrored with the champion.
  h('div.fin-play', null,
    h('div.fin-hole', null, h('i.fin-ring'), h('i.fin-burst')),
    h('div.fin-trail'),
    ball ? h('img.fin-ball', { src: ball.src, alt: '', draggable: false }) : null),
  h('div.fin-words', null,
    h('div.fin-title', null, 'Kết liễu'),
    h('div.fin-line', null, [c.name, ...feats.slice(0, 2), ball?.caption].filter(Boolean).join(' · '))),
  );
  stage.append(el);
  sound.finisher();
  if (!reduced) stage.classList.add('fin-shake');
  return new Promise((resolve) => {
    let done = false;
    const end = () => {
      if (done) return;
      done = true;
      el.classList.add('out');
      stage.classList.remove('fin-shake');
      setTimeout(() => {
        el.remove();
        resolve();
      }, 260);
    };
    el.addEventListener('pointerdown', end, { once: true });
    setTimeout(end, reduced ? 1800 : 2700);
  });
}
