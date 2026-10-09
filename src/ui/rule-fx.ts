/**
 * Board pieces for the rule mechanics, shared by the game board: the seal
 * impression in a card's corner (도장 · 印) and blots of wet ink (먹 · 墨).
 * Motion is CSS only (transform and opacity), and reduced motion skips it.
 */
import { inkLabel, inkSvg, sealSvg, wetness } from '../art/rule-marks';
import { INK_MAX_LIFE } from '../engine/levels';
import { h } from './dom';
import { reducedMotion } from './motion';

/**
 * Put seal n on a card (0 takes it off). A seal that must wait for a lower one
 * is drawn paler, so the one that may go now reads first.
 */
export function setSeal(card: HTMLElement | undefined, n: number, waiting: boolean): void {
  if (!card) return;
  let s = card.querySelector<HTMLElement>('.rule-seal');
  if (!n) {
    s?.remove();
    card.classList.remove('is-sealed', 'is-waiting');
    return;
  }
  if (!s || s.dataset.seal !== String(n)) {
    s?.remove();
    s = h('span', { class: 'rule-seal', 'aria-hidden': 'true', 'data-seal': n, html: sealSvg(n) });
    card.append(s);
  }
  card.classList.add('is-sealed');
  card.classList.toggle('is-waiting', waiting);
}

/** A blot of wet ink for an empty cell, `left` pairs from dry (`cls`: the board's class for it). */
export function inkBlot(left: number, cls = 'ink'): HTMLElement {
  const el = h('div', { class: cls, role: 'img', html: inkSvg() });
  setWet(el, left);
  return el;
}

/** How wet the blot looks (its calm countdown) and what a screen reader hears. */
export function setWet(el: HTMLElement, left: number): void {
  el.style.setProperty('--wet', wetness(left, INK_MAX_LIFE).toFixed(3));
  el.dataset.left = String(left);
  el.setAttribute('aria-label', inkLabel(left));
}

/** The blot dries away, then leaves the board. */
export function dryBlot(el: HTMLElement): void {
  el.removeAttribute('role');
  el.setAttribute('aria-hidden', 'true');
  el.classList.add('is-dry');
  setTimeout(() => el.remove(), reducedMotion() ? 0 : 700);
}
