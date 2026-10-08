import { Capacitor } from '@capacitor/core';
import { type Festival, festivalDeal, festivalOn, offerDue, recordOffer } from '../services/ad-offer';
import { store } from '../services/store';
import { persist, save } from '../services/storage';
import { esc, frag, toast, wait } from './dom';
import { ICONS } from './icons';
import { loaderGone } from './launch';
import { openSheet, sheetOpen, sheetsClosed } from './modal';

const native = Capacitor.isNativePlatform();

/**
 * How long Home settles before the game asks, and before it asks again once other
 * sheets have closed. Longer than the daily gift's auto-open (650 ms, home.ts), so the
 * gift always goes first and the ask never lands on top of it.
 */
const ASK_SETTLE_MS = 1200;

/** The sheet was opened this session (asked or by hand): the ask then waits for a later launch. */
let seenThisSession = false;

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const HANGUL = /[가-힣]/;

/** What every Remove ads promotion says, and the label of its button. */
export const removeAdsLabel = (): string => (store.available ? `Remove ads · ${store.price}` : 'Remove ads');

export interface RemoveAdsOptions {
  /** the game asked (first start or a festival week), so the player may say "Don't ask again" */
  prompted?: boolean;
  /** the festival whose week is on; defaults to today's festival, if any */
  festival?: Festival | null;
}

/** The festival's name with its Korean and/or Japanese name. */
function festivalNames(f: Festival): string {
  const names = [f.ko ? `<span class="serif" lang="ko">${f.ko}</span>` : '', f.ja ? `<span class="ja" lang="ja">${f.ja}</span>` : '']
    .filter(Boolean)
    .join(' · ');
  return `<b class="noads-fest__name">${esc(f.en)}</b><span class="noads-fest__native">${names}</span>`;
}

/** A small seal for the festival, its date and its names. */
function festivalHeader(f: Festival): string {
  const markClass = HANGUL.test(f.mark) ? 'serif' : 'ja';
  return `<div class="noads-fest">
    <span class="seal noads-fest__seal ${markClass}" aria-hidden="true">${f.mark}</span>
    <span class="noads-fest__text"><span class="noads-fest__date">${MONTHS[f.month - 1]} ${f.day}</span>${festivalNames(f)}</span>
  </div>`;
}

/**
 * The one Remove ads offer that every promotion opens (Home, Market, Settings, the result
 * sheet, and the game's own ask): what it does, the price, Buy and Restore. During a
 * festival week it shows the festival and, when Play's prices show a real discount, the
 * festival price with the usual one beside it. If Google Play billing can't be reached
 * (offline, still starting, no Play services) it says so and the player can try again.
 * Resolves true if ads are off when it closes.
 */
export function openRemoveAds(opts: RemoveAdsOptions = {}): Promise<boolean> {
  const festival = opts.festival === undefined ? festivalOn(new Date()) : opts.festival;
  const deal = () => (festival ? festivalDeal(store.regular, store.festival) : null);
  const buyLabel = (): string => {
    const d = deal();
    return d ? `Remove ads · ${d.price}` : removeAdsLabel();
  };
  const d = deal();
  const content = frag(`<div class="dialog noads-sheet">
    ${festival ? festivalHeader(festival) : ''}
    <h2>Play without ads</h2>
    ${opts.prompted ? '<p class="muted noads-sheet__lead">Jjak is free, with an ad between some boards. Rather play without them?</p>' : ''}
    <ul class="supporter__list">
      <li>${ICONS.check}<span><b>No ads</b> between boards.</span></li>
      <li>${ICONS.check}<span><b>No banners</b> on Home or the Album.</span></li>
      <li>${ICONS.check}<span>Reward ads stay <b>optional</b>: only when you choose one.</span></li>
    </ul>
    ${d ? `<p class="noads-sheet__deal">Remove ads for <b>${esc(d.price)}</b> this week <span class="muted">(usually ${esc(d.usually)})</span>.</p>` : ''}
    <p class="muted">One-time purchase. It stays yours on every device signed in to the same Google account.</p>
    <p class="noads-sheet__note" role="status" hidden></p>
    <div class="sheet__actions">
      <button class="btn btn--accent btn--block" data-noads="buy">${esc(buyLabel())}</button>
      <button class="btn btn--quiet btn--block" data-noads="restore">Restore purchase</button>
      ${
        opts.prompted
          ? `<div class="sheet__row noads-sheet__later">
        <button class="btn btn--quiet" data-noads="close">Not now</button>
        <button class="btn btn--quiet" data-noads="never">Don’t ask again</button>
      </div>`
          : '<button class="btn btn--quiet btn--block" data-noads="close">Not now</button>'
      }
    </div>
  </div>`);
  const sheet = openSheet(content, { center: true, label: 'Play without ads' });
  seenThisSession = true;
  const note = content.querySelector<HTMLElement>('.noads-sheet__note');
  const buy = content.querySelector<HTMLButtonElement>('[data-noads="buy"]');
  if (!note || !buy) throw new Error('The Remove ads sheet lost its note or Buy button');
  const say = (text: string) => {
    note.textContent = text;
    note.hidden = false;
  };

  content.addEventListener('click', async (e) => {
    const act = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-noads]');
    if (!act || act.disabled) return;
    if (act.dataset.noads === 'close') return sheet.close();
    if (act.dataset.noads === 'never') {
      save.adOffer = { ...save.adOffer, never: true };
      persist();
      sheet.close();
      return toast('We won’t ask again. Remove ads stays in Settings.');
    }
    act.disabled = true;
    try {
      if (act.dataset.noads === 'buy') {
        if (!native) return say('Remove ads is part of the Android app on Google Play.');
        if (!(await store.retry())) return say('Google Play billing isn’t available right now. Check your connection and try again.');
        buy.textContent = buyLabel();
        if (await store.buyRemoveAds({ festival: deal() !== null })) {
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

/**
 * The game's own ask, from Home: on first start, then once in each month's festival week
 * (src/services/ad-offer.ts). Android only. Waits for the launch loader to go and Play's
 * prices to arrive, lets the daily gift and any other sheet finish first, and gives up
 * if the player has left Home by then (the next visit to Home tries again) or has already
 * opened the sheet themselves this session (a later launch asks instead).
 * Resolves true if ads are off afterwards.
 */
export async function askRemoveAdsIfDue(home: HTMLElement): Promise<boolean> {
  if (!native) return save.adFree;
  await loaderGone;
  await store.ready;
  for (;;) {
    await wait(ASK_SETTLE_MS);
    if (!home.isConnected) return save.adFree;
    if (!sheetOpen() && !document.querySelector('.reveal')) break;
    await sheetsClosed();
  }
  const now = new Date();
  const due = offerDue(now, { adFree: save.adFree, ...save.adOffer });
  if (!due || seenThisSession) return save.adFree;
  save.adOffer = recordOffer(save.adOffer, now);
  persist();
  return openRemoveAds({ prompted: true, festival: due.festival ?? null });
}
