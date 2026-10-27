/**
 * Scroll affordance: every `.scroll` area gets `data-more` = "b" / "r" / "br" while content
 * remains below / to the right, so CSS can fade that edge and show a chevron. Players on
 * touch screens otherwise have no hint that a settings list or a grid continues.
 */
const tracked = new WeakSet<Element>();

const chevrons = new WeakMap<HTMLElement, HTMLElement>();

function update(el: HTMLElement) {
  const below = el.scrollHeight - el.clientHeight - el.scrollTop > 6;
  const right = el.scrollWidth - el.clientWidth - el.scrollLeft > 6;
  const v = `${below ? 'b' : ''}${right ? 'r' : ''}`;
  if (v) el.dataset.more = v;
  else delete el.dataset.more;
  // The chevron lives beside the list (the fade mask would hide it inside), placed over its bottom edge.
  let chev = chevrons.get(el);
  const host = el.offsetParent as HTMLElement | null;
  if (below && host) {
    if (!chev) {
      chev = document.createElement('div');
      chev.className = 'more-chevron';
      chev.setAttribute('aria-hidden', 'true');
      chevrons.set(el, chev);
    }
    if (chev.parentElement !== host) host.append(chev);
    chev.style.left = `${el.offsetLeft + el.offsetWidth / 2}px`;
    chev.style.top = `${el.offsetTop + el.offsetHeight - 26}px`;
  } else {
    chev?.remove();
  }
}

function track(el: HTMLElement) {
  if (tracked.has(el)) return;
  tracked.add(el);
  const run = () => update(el);
  el.addEventListener('scroll', run, { passive: true });
  new ResizeObserver(run).observe(el);
  // Content that arrives later (tab switches, re-renders) changes the scroll size too.
  new MutationObserver(run).observe(el, { childList: true, subtree: true });
  requestAnimationFrame(run);
}

export function installScrollHints(root: HTMLElement) {
  const scan = (n: ParentNode) => n.querySelectorAll<HTMLElement>('.scroll').forEach(track);
  scan(root);
  new MutationObserver((muts) => {
    for (const m of muts) {
      m.addedNodes.forEach((node) => {
        if (!(node instanceof HTMLElement)) return;
        if (node.classList.contains('scroll')) track(node);
        scan(node);
      });
    }
  }).observe(root, { childList: true, subtree: true });
}
