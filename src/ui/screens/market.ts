/** Market · 장터 · 市 — placeholder screen; the feature fills this in. */
import { type Screen } from '../app';
import { frag } from '../dom';
import { nav } from '../nav';

export function marketScreen(): Screen {
  const el = frag(`<section class="screen market"><header class="screen__head"><button class="icon-btn" data-back aria-label="Back">‹</button><h1>Market · 장터 · 市</h1></header></section>`);
  el.querySelector('[data-back]')?.addEventListener('click', () => nav.home());
  return { name: 'market', el };
}
