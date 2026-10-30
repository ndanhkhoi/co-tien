import { sound } from '../audio/sound';
import { cutoutUrl, sect, sectArtUrl, skillIconUrl, type Champion, type SkillDef } from '../game/content/sects';
import { h, hex6 } from './dom';


/**
 * Ultimate cut-in: a great ink brush stroke sweeps across the screen, the champion's cut-out
 * steps in, and the skill name appears on an ink sweep sealed with the skill's painted icon.
 * The caller owns its active-time duration and removes it on completion or disposal.
 */
export function playCutIn(c: Champion, skill: SkillDef, fromRight: boolean) {
  sound.ultimate();
  const s = sect(c.sect);
  const el = h('div.cutin', {
    class: fromRight ? 'rtl' : '',
    style: `--sect:${hex6(s.main)};--strip:url("${sectArtUrl(c.sect, 'cutin')}")`,
    'aria-hidden': 'true',
  },
  h('div.ci-strip'),
  h('img.ci-hero', { src: cutoutUrl(c.id), alt: '', draggable: false, onerror: (e: Event) => (e.target as HTMLElement).remove() }),
  h('div.ci-plate', null,
    h('img.ci-seal', { src: skillIconUrl(c.id, skill.slot), alt: '', draggable: false }),
    h('div.ci-words', null,
      h('div.ci-kicker', null, `Tuyệt chiêu · ${c.name}`),
      h('div.ci-name', null, skill.name),
    ),
  ));
  document.getElementById('ui')!.append(el);
  return el;
}
