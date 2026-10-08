import { Capacitor } from '@capacitor/core';
import { store } from '../services/store';
import { save } from '../services/storage';
import { esc, frag, toast } from './dom';
import { ICONS } from './icons';
import { openSheet } from './modal';

const native = Capacitor.isNativePlatform();

/** What every Remove ads promotion says, and the label of its button. */
export const removeAdsLabel = (): string => (store.available ? `Remove ads · ${store.price}` : 'Remove ads');

/**
 * The one Remove ads offer that every promotion opens (Home, Market, Settings, the result
 * sheet): what it does, the price, Buy and Restore. If Google Play billing can't be reached
 * (offline, still starting, no Play services) it says so and the player can try again.
 * Resolves true if ads are off when it closes.
 */
export function openRemoveAds(): Promise<boolean> {
  const content = frag(`<div class="dialog noads-sheet">
    <h2>Play without ads</h2>
    <ul class="supporter__list">
      <li>${ICONS.check}<span><b>No ads</b> between boards.</span></li>
      <li>${ICONS.check}<span><b>No banners</b> on Home or the Album.</span></li>
      <li>${ICONS.check}<span>Reward ads stay <b>optional</b>: only when you choose one.</span></li>
    </ul>
    <p class="muted">One-time purchase. It stays yours on every device signed in to the same Google account.</p>
    <p class="noads-sheet__note" role="status" hidden></p>
    <div class="sheet__actions">
      <button class="btn btn--accent btn--block" data-noads="buy">${esc(removeAdsLabel())}</button>
      <button class="btn btn--quiet btn--block" data-noads="restore">Restore purchase</button>
      <button class="btn btn--quiet btn--block" data-noads="close">Not now</button>
    </div>
  </div>`);
  const sheet = openSheet(content, { center: true, label: 'Play without ads' });
  const note = content.querySelector<HTMLElement>('.noads-sheet__note')!;
  const buy = content.querySelector<HTMLButtonElement>('[data-noads="buy"]')!;
  const say = (text: string) => {
    note.textContent = text;
    note.hidden = false;
  };

  content.addEventListener('click', async (e) => {
    const act = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-noads]');
    if (!act || act.disabled) return;
    if (act.dataset.noads === 'close') return sheet.close();
    act.disabled = true;
    try {
      if (act.dataset.noads === 'buy') {
        if (!native) return say('Remove ads is part of the Android app on Google Play.');
        if (!(await store.retry())) return say('Google Play billing isn’t available right now. Check your connection and try again.');
        buy.textContent = removeAdsLabel();
        if (await store.buyRemoveAds()) {
          sheet.close();
          toast('Thank you! Ads are gone. Rewards you choose stay optional.');
        }
      } else {
        const owned = await store.restore();
        if (owned) {
          sheet.close();
          toast('Purchase restored. Ads are off.');
        } else say('No Remove ads purchase was found for this Google account.');
      }
    } finally {
      act.disabled = false;
    }
  });
  return sheet.closed.then(() => save.adFree);
}
