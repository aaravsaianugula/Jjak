/** Garden · 정원 · 庭 — placeholder screen; the feature fills this in. */
import { type Screen } from '../app';
import { frag } from '../dom';
import { nav } from '../nav';

export function gardenScreen(): Screen {
  const el = frag(`<section class="screen garden"><header class="screen__head"><button class="icon-btn" data-back aria-label="Back">‹</button><h1>Garden · 정원 · 庭</h1></header></section>`);
  el.querySelector('[data-back]')?.addEventListener('click', () => nav.home());
  return { name: 'garden', el };
}
