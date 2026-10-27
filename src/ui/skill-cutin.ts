import { cutoutUrl, sect, sectArtUrl, type Champion, type SkillDef } from '../game/content/sects';
import { h } from './dom';

const hex6 = (n: number) => '#' + n.toString(16).padStart(6, '0');

/**
 * Ultimate cut-in: a great ink brush stroke sweeps across the screen, the champion's cut-out
 * steps in, and the skill name is written on paper and sealed with a vermilion stamp.
 * Purely decorative (pointer-events: none), so play never waits on it.
 */
export function playCutIn(c: Champion, skill: SkillDef, fromRight: boolean) {
  const s = sect(c.sect);
  const el = h('div.cutin', {
    class: fromRight ? 'rtl' : '',
    style: `--sect:${hex6(s.main)};--glow:${hex6(s.glow)};--strip:url("${sectArtUrl(c.sect, 'cutin')}")`,
    'aria-hidden': 'true',
  },
  h('div.ci-flash'),
  h('div.ci-strip'),
  h('img.ci-hero', { src: cutoutUrl(c.id), alt: '', draggable: false, onerror: (e: Event) => (e.target as HTMLElement).remove() }),
  h('div.ci-plate', null,
    h('div.ci-kicker', null, `Tuyệt chiêu · ${c.name}`),
    h('div.ci-name', null, skill.name),
    h('span.ci-seal', null, '仙'),
  ));
  document.getElementById('ui')!.append(el);
  setTimeout(() => el.remove(), 1500);
}
