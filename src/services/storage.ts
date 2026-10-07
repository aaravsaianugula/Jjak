import { Preferences } from '@capacitor/preferences';
import { ECONOMY } from '../config';

export type Theme = 'auto' | 'paper' | 'ink';

export interface DailyResult {
  ms: number;
  score: number;
  combo: number;
  stars: number;
}

export interface SaveData {
  v: 1;
  /** finished the first-launch welcome */
  onboarded: boolean;
  /** legacy (pre-13+ builds asked for it); no longer collected */
  birthYear: number | null;
  /** highest Journey level unlocked (1-based) */
  level: number;
  stars: Record<number, number>;
  petals: number;
  hints: number;
  shuffles: number;
  album: number[];
  daily: { streak: number; best: number; lastDate: string | null; results: Record<string, DailyResult> };
  settings: { sound: boolean; haptics: boolean; theme: Theme };
  stats: {
    pairs: number;
    clears: number;
    bestCombo: number;
    zenBoards: number;
    /** boards cleared with no hint/shuffle */
    cleanClears: number;
    /** boards cleared under par */
    fastClears: number;
    /** fastest daily, ms */
    bestDailyMs: number;
  };
  /** earned achievement ids */
  seals: string[];
  /** selected board paper: 'plain' or a month key */
  paper: string;
  ads: {
    clearsSinceInterstitial: number;
    lastInterstitialAt: number;
    /** when the player last finished a rewarded ad (earns an interstitial-free window) */
    lastRewardedAt: number;
    interstitialsShown: number;
    rewardedWatched: number;
    /** date key of the last gentle "remove ads" mention */
    lastUpsell: string | null;
  };
  /** owns the one-time "Remove ads" purchase */
  adFree: boolean;
  rush: { best: number; runs: number; bestRound: number };
  /** 7-day gift calendar: next day index (0–6) and the date it was last claimed */
  gift: { day: number; lastClaim: string | null };
  seenTips: string[];
}

const KEY = 'jjak.save.v1';

export const defaultSave = (): SaveData => ({
  v: 1,
  onboarded: false,
  birthYear: null,
  level: 1,
  stars: {},
  petals: 0,
  hints: ECONOMY.startHints,
  shuffles: ECONOMY.startShuffles,
  album: [],
  daily: { streak: 0, best: 0, lastDate: null, results: {} },
  settings: { sound: true, haptics: true, theme: 'auto' },
  stats: { pairs: 0, clears: 0, bestCombo: 0, zenBoards: 0, cleanClears: 0, fastClears: 0, bestDailyMs: 0 },
  seals: [],
  paper: 'plain',
  ads: { clearsSinceInterstitial: 0, lastInterstitialAt: 0, lastRewardedAt: 0, interstitialsShown: 0, rewardedWatched: 0, lastUpsell: null },
  adFree: false,
  rush: { best: 0, runs: 0, bestRound: 0 },
  gift: { day: 0, lastClaim: null },
  seenTips: [],
});

/** Merge stored data over defaults so new fields appear after app updates. */
function hydrate(raw: unknown): SaveData {
  const base = defaultSave();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<SaveData>;
  return {
    ...base,
    ...r,
    onboarded: r.onboarded ?? r.birthYear != null,
    daily: { ...base.daily, ...(r.daily ?? {}) },
    settings: { ...base.settings, ...(r.settings ?? {}) },
    stats: { ...base.stats, ...(r.stats ?? {}) },
    ads: { ...base.ads, ...(r.ads ?? {}) },
    rush: { ...base.rush, ...(r.rush ?? {}) },
    gift: { ...base.gift, ...(r.gift ?? {}) },
  };
}

export let save: SaveData = defaultSave();

export async function loadSave(): Promise<SaveData> {
  let text: string | null = null;
  try {
    text = (await Preferences.get({ key: KEY })).value;
  } catch {
    /* Preferences unavailable — fall through */
  }
  if (!text) {
    try {
      text = localStorage.getItem(KEY);
    } catch {
      /* private mode */
    }
  }
  try {
    save = hydrate(text ? JSON.parse(text) : null);
  } catch {
    save = defaultSave();
  }
  return save;
}

let pending: ReturnType<typeof setTimeout> | null = null;

/** Debounced write — call after every change. */
export function persist(): void {
  if (pending) clearTimeout(pending);
  pending = setTimeout(flush, 150);
}

export async function flush(): Promise<void> {
  pending = null;
  const text = JSON.stringify(save);
  try {
    await Preferences.set({ key: KEY, value: text });
  } catch {
    /* ignore */
  }
  try {
    localStorage.setItem(KEY, text);
  } catch {
    /* ignore */
  }
}

export async function resetSave(): Promise<void> {
  // A purchase is never lost by resetting progress.
  const keep = { onboarded: save.onboarded, settings: save.settings, adFree: save.adFree };
  save = { ...defaultSave(), ...keep };
  await flush();
}
