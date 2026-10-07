/**
 * Small shared motion helpers. Transform and opacity only; everything settles
 * at once under prefers-reduced-motion.
 */

export const reducedMotion = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Re-run a one-shot CSS animation class. */
export function retrigger(node: Element | null | undefined, cls: string): void {
  if (!node) return;
  node.classList.remove(cls);
  void (node as HTMLElement).offsetWidth;
  node.classList.add(cls);
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
