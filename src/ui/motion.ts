/**
 * Small shared motion helpers. Transform and opacity only; everything settles
 * at once under prefers-reduced-motion.
 */

export const reducedMotion = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

const pending = new WeakMap<Element, Map<string, number>>();
/**
 * Re-run a one-shot CSS animation class without forcing a synchronous reflow
 * (reading offsetWidth mid-frame cost a full style + layout pass per call on
 * the board). A class that isn't on yet is simply added; one that is comes off
 * for a frame and goes back on, so the animation starts over.
 */
export function retrigger(node: Element | null | undefined, cls: string): void {
  if (!node) return;
  let map = pending.get(node);
  const was = map?.get(cls);
  if (was) cancelAnimationFrame(was);
  if (!node.classList.contains(cls) && !was) {
    node.classList.add(cls);
    return;
  }
  node.classList.remove(cls);
  if (!map) pending.set(node, (map = new Map()));
  const m = map;
  const id = requestAnimationFrame(() => {
    m.set(cls, requestAnimationFrame(() => {
      m.delete(cls);
      node.classList.add(cls);
    }));
  });
  m.set(cls, id);
}

/** Drop a pending retrigger and the class itself (e.g. a shake on a card that was just selected). */
export function untrigger(node: Element | null | undefined, cls: string): void {
  if (!node) return;
  const id = pending.get(node)?.get(cls);
  if (id) {
    cancelAnimationFrame(id);
    pending.get(node)!.delete(cls);
  }
  node.classList.remove(cls);
}

const easeOut = (k: number) => 1 - (1 - k) ** 3;

/**
 * A petal balance changed: count the pill's number from `from` to `to` and give
 * the pill a small bump (`.petals.is-bump` in main.css). The number lives in
 * `.petals__n` (or the pill's `<b>`). Safe to call when nothing changed.
 */
export function petalBump(
  pill: HTMLElement | null | undefined,
  from: number,
  to: number,
  { delay = 0, ms = 650, format = (n: number) => String(n) }: { delay?: number; ms?: number; format?: (n: number) => string } = {},
): void {
  if (!pill) return;
  const num = pill.querySelector<HTMLElement>('.petals__n') ?? pill.querySelector<HTMLElement>('b') ?? pill;
  if (pill.hasAttribute('aria-label') && /petals/.test(pill.getAttribute('aria-label') ?? '')) pill.setAttribute('aria-label', `${to} petals`);
  if (from === to) {
    num.textContent = format(to);
    return;
  }
  if (reducedMotion()) {
    num.textContent = format(to);
    return;
  }
  num.textContent = format(from);
  setTimeout(() => {
    if (!pill.isConnected) return void (num.textContent = format(to));
    retrigger(pill, 'is-bump');
    const t0 = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, Math.max(0, (t - t0) / ms));
      num.textContent = format(Math.round(from + (to - from) * easeOut(k)));
      if (k < 1 && pill.isConnected) requestAnimationFrame(step);
      else num.textContent = format(to);
    };
    requestAnimationFrame(step);
  }, delay);
}

/**
 * FLIP: animate `nodes` from where they were (`before`, from `measure`) to
 * where layout puts them now, with transforms only.
 */
export function measure(nodes: HTMLElement[]): Map<HTMLElement, number> {
  return new Map(nodes.map((n) => [n, n.getBoundingClientRect().top]));
}
export function flip(before: Map<HTMLElement, number>, ms = 320): void {
  if (reducedMotion()) return;
  const moved: HTMLElement[] = [];
  for (const [n, top] of before) {
    if (!n.isConnected) continue;
    const dy = top - n.getBoundingClientRect().top;
    if (Math.abs(dy) < 1) continue;
    n.style.transition = 'none';
    n.style.transform = `translateY(${dy}px)`;
    moved.push(n);
  }
  if (!moved.length) return;
  void document.body.offsetWidth;
  for (const n of moved) {
    n.style.transition = `transform ${ms}ms cubic-bezier(0.2, 0.8, 0.2, 1)`;
    n.style.transform = '';
  }
  setTimeout(() => {
    for (const n of moved) n.style.transition = '';
  }, ms + 40);
}
