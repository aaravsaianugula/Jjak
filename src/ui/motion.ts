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

/**
 * Start running CSS animations (by keyframes name, on `node` and its subtree,
 * pseudo-elements included) over from the top, in place: no class toggling,
 * so nothing blinks for a frame. Returns false if none were running.
 */
export function restartAnimations(node: Element | null | undefined, names: string[]): boolean {
  if (!node || typeof node.getAnimations !== 'function') return false;
  const anims = node
    .getAnimations({ subtree: true })
    .filter((a): a is CSSAnimation => typeof CSSAnimation !== 'undefined' && a instanceof CSSAnimation && names.includes(a.animationName));
  for (const a of anims) {
    a.currentTime = 0;
    a.play();
  }
  return anims.length > 0;
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

/**
 * Segmented control: one raised pill under the pressed button that slides to
 * the new choice (transform only; its width is set at once and counter-scaled).
 * Call after updating `aria-pressed`. Safe before the control is in the page.
 */
export function slidePill(seg: HTMLElement | null | undefined): void {
  if (!seg) return;
  let pill = seg.querySelector<HTMLElement>(':scope > .seg__pill');
  if (!pill) {
    pill = document.createElement('span');
    pill.className = 'seg__pill';
    pill.setAttribute('aria-hidden', 'true');
    seg.prepend(pill);
    seg.classList.add('has-pill');
  }
  const on = seg.querySelector<HTMLElement>(':scope > [aria-pressed="true"]');
  if (!on) {
    pill.style.opacity = '0';
    return;
  }
  if (!seg.isConnected || !on.offsetWidth) {
    requestAnimationFrame(() => seg.isConnected && slidePill(seg));
    return;
  }
  const x = on.offsetLeft;
  const w = on.offsetWidth;
  const prev = pill.dataset.x != null ? { x: Number(pill.dataset.x), w: Number(pill.dataset.w) } : null;
  pill.dataset.x = String(x);
  pill.dataset.w = String(w);
  pill.style.width = `${w}px`;
  pill.style.opacity = '1';
  if (!prev || reducedMotion() || (prev.x === x && prev.w === w)) {
    pill.style.transition = 'none';
    pill.style.transform = `translateX(${x}px)`;
    return;
  }
  pill.style.transition = 'none';
  pill.style.transform = `translateX(${prev.x}px) scaleX(${prev.w / w})`;
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      pill!.style.transition = '';
      pill!.style.transform = `translateX(${x}px)`;
    }),
  );
}

/**
 * Shared-element hand-off: a copy of `from` (a thumbnail) lifts out of its
 * place and flies into `to` (the same card in a sheet that is opening), which
 * appears when it lands. `sheet` is the opening sheet: its entrance is paused
 * for one measurement so the flight aims at where the card will settle.
 */
export function flyInto(from: Element, to: HTMLElement, sheet: HTMLElement, ms = 420): void {
  if (reducedMotion() || typeof to.animate !== 'function') return;
  const a = from.getBoundingClientRect();
  if (!a.width) return;
  sheet.style.animation = 'none';
  to.style.animation = 'none';
  const b = to.getBoundingClientRect();
  sheet.style.animation = '';
  if (!b.width) return;
  const fly = document.createElement('div');
  fly.className = 'fly-card';
  fly.setAttribute('aria-hidden', 'true');
  fly.innerHTML = to.innerHTML;
  Object.assign(fly.style, { left: `${b.left}px`, top: `${b.top}px`, width: `${b.width}px`, height: `${b.height}px` });
  document.body.append(fly);
  to.style.opacity = '0';
  (from as HTMLElement).style.visibility = 'hidden';
  const s = a.width / b.width;
  const dx = a.left - b.left;
  const dy = a.top - b.top;
  const anim = fly.animate(
    [
      { transform: `translate(${dx}px, ${dy}px) scale(${s})` },
      { transform: `translate(${dx * 0.42}px, ${dy * 0.42 - 10}px) scale(${(s + 1) / 2 + 0.02}) rotate(-1.5deg)`, offset: 0.55 },
      { transform: 'none' },
    ],
    { duration: ms, easing: 'cubic-bezier(0.3, 0.7, 0.25, 1)' },
  );
  const done = () => {
    to.style.opacity = '';
    (from as HTMLElement).style.visibility = '';
    fly.remove();
  };
  anim.onfinish = done;
  anim.oncancel = done;
}
