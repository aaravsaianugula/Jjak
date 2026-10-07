import { ECONOMY, GIFTS } from '../config';
import { ALL_CARD_IDS } from '../data/deck';
import { ROUTE, ROUTE_LEVELS_PER_CHAPTER, routeOf } from '../data/route';
import { localDateKey } from '../engine/levels';
import { LUCKY_PETALS, type Session, starCount } from '../engine/session';
import { persist, save } from './storage';

export interface ClearSummary {
  stars: number;
  firstClear: boolean;
  petals: number;
  /** newly unlocked album card, if any */
  drawn: number | null;
  /** daily only */
  daily?: { counted: boolean; streak: number; number: number; tea?: number };
  /** lantern gift for every 4th Journey level */
  lantern?: { petals: number; hints: number; shuffles: number };
  /** petals from lucky bonus pairs on this board (already added to the balance; not part of `petals`) */
  lucky?: number;
  /** passport stamp earned by first clearing a chapter's festival board */
  stamp?: { id: string; date: string };
}

const yesterdayKey = (today: string) => {
  const [y, m, d] = today.split('-').map(Number);
  return localDateKey(new Date(y, m - 1, d - 1));
};

/** Whole days from one date key to another (local calendar, DST-safe). */
export function daysBetween(from: string, to: string): number {
  const at = (k: string) => {
    const [y, m, d] = k.split('-').map(Number);
    return new Date(y, m - 1, d).getTime();
  };
  return Math.round((at(to) - at(from)) / 86400000);
}

/**
 * Warm tea (streak freezes) needed to bridge the days missed since the last
 * Daily, or 0 if none were missed or there isn't enough tea to cover them all.
 */
export function teaToBridge(today: string, last = save.daily.lastDate): number {
  if (!last || save.daily.streak <= 0) return 0;
  const missed = daysBetween(last, today) - 1;
  return missed >= 1 && missed <= save.streakFreezes ? missed : 0;
}

/** Pick a random locked card and add it to the album. */
export function drawCard(): number | null {
  const owned = new Set(save.album);
  const locked = ALL_CARD_IDS.filter((id) => !owned.has(id));
  if (!locked.length) return null;
  const id = locked[Math.floor(Math.random() * locked.length)];
  save.album.push(id);
  persist();
  return id;
}

/** Apply a finished board to the save file and report what the player earned. */
export function recordClear(s: Session): ClearSummary {
  const st = s.stars();
  const stars = starCount(st);
  save.stats.pairs += s.pairsMade;
  save.stats.clears++;
  save.stats.bestCombo = Math.max(save.stats.bestCombo, s.bestCombo);
  if (st.noAssist) save.stats.cleanClears++;
  if (st.underPar) save.stats.fastClears++;

  const out: ClearSummary = { stars, firstClear: false, petals: 0, drawn: null };

  if (s.spec.mode === 'journey') {
    const n = s.spec.number;
    const prev = save.stars[n] ?? 0;
    out.firstClear = prev === 0;
    // Petals only for stars you didn't have before — replays can't be farmed.
    out.petals = Math.max(0, stars - prev) * ECONOMY.petalsPerStar;
    save.stars[n] = Math.max(prev, stars);
    if (n >= save.level) save.level = n + 1;
    if (out.firstClear) out.drawn = drawCard();
    if (out.firstClear && n % ECONOMY.lanternEvery === 0) {
      // Alternate the bonus tool so both stay topped up.
      const hint = (n / ECONOMY.lanternEvery) % 2 === 1;
      out.lantern = { petals: ECONOMY.lanternPetals, hints: hint ? 1 : 0, shuffles: hint ? 0 : 1 };
      save.petals += out.lantern.petals;
      save.hints += out.lantern.hints;
      save.shuffles += out.lantern.shuffles;
    }
    // A small gift at the end of each chapter.
    if (out.firstClear && n % 12 === 0) {
      save.hints++;
      save.shuffles++;
    }
    // The place's passport stamp, the first time its festival board is cleared.
    if (n % ROUTE_LEVELS_PER_CHAPTER === 0) {
      const id = routeOf(n).chapter.id;
      if (!save.journey.stamps[id]) {
        save.journey.stamps[id] = localDateKey();
        out.stamp = { id, date: save.journey.stamps[id] };
      }
    }
  } else if (s.spec.mode === 'daily') {
    const today = localDateKey();
    const key = s.spec.seed.replace('daily-', '');
    const counted = key === today && !save.daily.results[key];
    if (counted) {
      const ms = s.elapsedMs(s.finishedAt);
      save.daily.results[key] = { ms, score: s.score, combo: s.bestCombo, stars };
      save.stats.bestDailyMs = save.stats.bestDailyMs ? Math.min(save.stats.bestDailyMs, ms) : ms;
      // Warm tea keeps the streak through missed days, one cup per day.
      const tea = teaToBridge(today);
      if (tea) {
        save.streakFreezes -= tea;
        save.meta.teaNotice += tea;
        save.meta.stats.teaUsed += tea;
      }
      save.daily.streak = save.daily.lastDate === yesterdayKey(today) || tea > 0 ? save.daily.streak + 1 : 1;
      save.daily.best = Math.max(save.daily.best, save.daily.streak);
      save.daily.lastDate = today;
      out.petals = ECONOMY.dailyPetals;
      out.drawn = drawCard();
    }
    out.daily = { counted, streak: save.daily.streak, number: s.spec.number };
    if (counted && save.meta.teaNotice) out.daily.tea = save.meta.teaNotice;
  } else {
    save.stats.zenBoards++;
    out.petals = ECONOMY.zenPetals;
  }

  // Lucky bonus pairs: a small gift of petals on top of the board's own.
  if (s.luckyPairs > 0) {
    out.lucky = s.luckyPairs * LUCKY_PETALS;
    save.petals += out.lucky;
    save.journey.luckyPairs += s.luckyPairs;
    save.journey.luckyPetals += out.lucky;
  }

  save.petals += out.petals;
  persist();
  return out;
}

/**
 * Stamps for festival boards cleared before stamps existed (older saves), dated
 * today. Returns how many were added.
 */
export function syncStamps(): number {
  let added = 0;
  ROUTE.forEach((c, i) => {
    if (save.journey.stamps[c.id]) return;
    if ((save.stars[(i + 1) * ROUTE_LEVELS_PER_CHAPTER] ?? 0) > 0) {
      save.journey.stamps[c.id] = localDateKey();
      added++;
    }
  });
  if (added) persist();
  return added;
}

/** Streak to display: still alive if the last daily was today or yesterday, or Warm tea would cover the gap. */
export function liveStreak(): number {
  const today = localDateKey();
  const last = save.daily.lastDate;
  if (last === today || last === yesterdayKey(today)) return save.daily.streak;
  return teaToBridge(today) > 0 ? save.daily.streak : 0;
}

export function shareTextFor(s: Session, summary: ClearSummary, storeUrl: string): string {
  const st = s.stars();
  const flowers = [st.clear, st.noAssist, st.underPar].map((on) => (on ? '🌸' : '▫️')).join('');
  const secs = Math.floor(s.elapsedMs(s.finishedAt) / 1000);
  const time = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
  const claps = '짝'.repeat(Math.min(5, Math.max(1, s.bestCombo)));
  const streak = summary.daily && summary.daily.streak > 1 ? ` · ${summary.daily.streak}-day streak` : '';
  return `Jjak 짝 · Daily #${s.spec.number}\n${flowers}  ${time}  ${claps}${streak}\n${storeUrl}`;
}

/** Months whose four cards are all in the album (unlocks that board paper). */
export function completedMonths(): number[] {
  const out: number[] = [];
  for (let m = 0; m < 12; m++) if ([0, 1, 2, 3].every((v) => save.album.includes(m * 4 + v))) out.push(m);
  return out;
}

/** Milliseconds until the next local midnight (next Daily). */
export function msToNextDaily(now = new Date()): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return next.getTime() - now.getTime();
}

export function formatCountdown(ms: number): string {
  const m = Math.ceil(ms / 60000);
  const h = Math.floor(m / 60);
  return h > 0 ? `${h}h ${m % 60}m` : `${m}m`;
}

/** Last 7 days of Daily results, oldest first, for the home calendar strip. */
export function lastWeek(today = new Date()): { key: string; day: string; solved: boolean; isToday: boolean }[] {
  const out = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    const key = localDateKey(d);
    out.push({ key, day: 'SMTWTFS'[d.getDay()], solved: !!save.daily.results[key], isToday: i === 0 });
  }
  return out;
}

/** Levels until the next lantern gift (0 = this level has one). */
export function levelsToLantern(level = save.level): number {
  const r = level % ECONOMY.lanternEvery;
  return r === 0 ? 0 : ECONOMY.lanternEvery - r;
}

export interface RushSummary {
  score: number;
  best: number;
  newBest: boolean;
  petals: number;
  rounds: number;
}

/** Record a finished Rush run. */
export function recordRush(score: number, rounds: number, pairs: number, bestCombo: number): RushSummary {
  const prevBest = save.rush.best;
  save.rush.runs++;
  save.rush.best = Math.max(prevBest, score);
  save.rush.bestRound = Math.max(save.rush.bestRound, rounds);
  save.stats.pairs += pairs;
  save.stats.bestCombo = Math.max(save.stats.bestCombo, bestCombo);
  const petals = Math.min(ECONOMY.rushPetalCap, Math.floor(score / ECONOMY.rushPointsPerPetal));
  save.petals += petals;
  persist();
  return { score, best: save.rush.best, newBest: score > prevBest && prevBest > 0, petals, rounds };
}

/** Today's gift if it hasn't been claimed yet. */
export function pendingGift(): { day: number; gift: (typeof GIFTS)[number] } | null {
  if (save.gift.lastClaim === localDateKey()) return null;
  return { day: save.gift.day % GIFTS.length, gift: GIFTS[save.gift.day % GIFTS.length] };
}

/** Claim today's gift (×2 when doubled by a rewarded ad). Returns any card drawn. */
export function claimGift(times = 1): number | null {
  const p = pendingGift();
  if (!p) return null;
  const g = p.gift;
  save.petals += (g.petals ?? 0) * times;
  save.hints += (g.hints ?? 0) * times;
  save.shuffles += (g.shuffles ?? 0) * times;
  let card: number | null = null;
  if (g.card) card = drawCard();
  save.gift.day = (save.gift.day + 1) % GIFTS.length;
  save.gift.lastClaim = localDateKey();
  persist();
  return card;
}

export const localToday = () => localDateKey();
