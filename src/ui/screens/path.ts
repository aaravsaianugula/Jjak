/** Flower Path · 꽃길 · 花道 — placeholder screen; the feature fills this in. */
import { type Screen } from '../app';
import { frag } from '../dom';
import { nav } from '../nav';

export function pathScreen(): Screen {
  const el = frag(`<section class="screen path"><header class="screen__head"><button class="icon-btn" data-back aria-label="Back">‹</button><h1>Flower Path · 꽃길 · 花道</h1></header></section>`);
  el.querySelector('[data-back]')?.addEventListener('click', () => nav.home());
  return { name: 'path', el };
}
