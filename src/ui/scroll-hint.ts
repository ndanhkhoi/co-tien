import { icon } from './icons';
/**
 * Scroll affordance: every `.scroll` area gets `data-more` = "b" / "r" / "br" while content
 * remains below / to the right, so CSS can fade that edge and show a chevron. Players on
 * touch screens otherwise have no hint that a settings list or a grid continues.
 */
const tracked = new WeakSet<Element>();

const observers = new WeakMap<HTMLElement, { resize: ResizeObserver; mutation: MutationObserver }>();

const chevrons = new WeakMap<HTMLElement, HTMLElement>();

/**
 * `measure` allows layout reads (the chevron's place); only the resize/mutation paths pass it.
 * A scroll event just flips `data-more` — the chevron never depends on `scrollTop`, so geometry
 * reads stay off the per-frame scroll path.
 */
function update(el: HTMLElement, measure: boolean) {
  const below = el.scrollHeight - el.clientHeight - el.scrollTop > 6;
  const right = el.scrollWidth - el.clientWidth - el.scrollLeft > 6;
  const v = `${below ? 'b' : ''}${right ? 'r' : ''}`;
  if (v !== el.dataset.more) {
    if (v) el.dataset.more = v;
    else delete el.dataset.more;
  }
  // The chevron lives beside the list (the fade mask would hide it inside), placed over its bottom edge.
  const host = el.parentElement;
  let chev = chevrons.get(el);
  if (!below || !host) {
    chev?.remove();
    return;
  }
  if (!chev) {
    chev = document.createElement('div');
    chev.className = 'more-chevron';
    chev.append(icon('turn'));
    chev.setAttribute('aria-hidden', 'true');
    chevrons.set(el, chev);
    measure = true;
  }
  // Keep each affordance in its own panel's stacking context. Appending to #ui
  // puts a story reader's chevron behind the reader itself (z-index 70).
  if (chev.parentElement !== host) {
    if (getComputedStyle(host).position === 'static') host.classList.add('scroll-hint-host');
    host.append(chev);
    measure = true;
  }
  if (measure) {
    chev.style.left = `${el.offsetLeft + el.offsetWidth / 2}px`;
    // Sits wholly inside the bottom edge of the faded strip, so it never sits on readable text.
    chev.style.top = `${el.offsetTop + el.offsetHeight - 28}px`;
  }
}

function track(el: HTMLElement) {
  // A panel may opt for the fading edge alone (`no-scroll-hint`), e.g. when a chevron would sit on copy.
  if (el.classList.contains('no-scroll-hint')) return;
  if (tracked.has(el)) return;
  tracked.add(el);
  if (!el.hasAttribute('tabindex')) el.tabIndex = 0;
  el.addEventListener('scroll', () => { if (el.isConnected) update(el, false); }, { passive: true });
  const measure = () => { if (el.isConnected) update(el, true); };
  const resize = new ResizeObserver(measure);
  resize.observe(el);
  // Content that arrives later (tab switches, re-renders) changes the scroll size too.
  const mutation = new MutationObserver(measure);
  mutation.observe(el, { childList: true, subtree: true });
  observers.set(el, { resize, mutation });
  requestAnimationFrame(measure);
}

export function installScrollHints(root: HTMLElement) {
  const scan = (n: ParentNode) => n.querySelectorAll<HTMLElement>('.scroll').forEach(track);
  scan(root);
  new MutationObserver((muts) => {
    for (const m of muts) {
      m.removedNodes.forEach((node) => {
        if (!(node instanceof HTMLElement) || node.isConnected) return;
        const release = (el: HTMLElement) => {
          observers.get(el)?.resize.disconnect();
          observers.get(el)?.mutation.disconnect();
          chevrons.get(el)?.remove();
          tracked.delete(el);
        };
        release(node);
        node.querySelectorAll<HTMLElement>('.scroll').forEach(release);
      });
      m.addedNodes.forEach((node) => {
        if (!(node instanceof HTMLElement)) return;
        if (node.classList.contains('scroll')) track(node);
        scan(node);
      });
    }
  }).observe(root, { childList: true, subtree: true });
}
