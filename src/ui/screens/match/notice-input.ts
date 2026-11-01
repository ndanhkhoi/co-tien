/** The table gesture that dismisses a notice must never reach aiming, placement or pocket calls. */
export function attachNoticeInput(canvas: EventTarget, root: EventTarget, dismiss: (target: EventTarget | null) => boolean): () => void {
  const onPointer = (e: Event) => {
    if ((e as PointerEvent).button > 0) return;
    const closed = dismiss(e.target);
    if (closed && e.currentTarget === canvas) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  };
  const onKey = (e: Event) => { dismiss(e.target); };
  const capture = { capture: true };
  canvas.addEventListener('pointerdown', onPointer, capture);
  root.addEventListener('pointerdown', onPointer, capture);
  window.addEventListener('keydown', onKey, capture);
  return () => {
    canvas.removeEventListener('pointerdown', onPointer, capture);
    root.removeEventListener('pointerdown', onPointer, capture);
    window.removeEventListener('keydown', onKey, capture);
  };
}
