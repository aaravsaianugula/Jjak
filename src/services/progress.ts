import { ECONOMY } from '../config';
import { ALL_CARD_IDS } from '../data/deck';
import { localDateKey } from '../engine/levels';
import { type Session, starCount } from '../engine/session';
import { persist, save } from './storage';

export interface ClearSummary {
  stars: number;
  firstClear: boolean;
  petals: number;
  /** newly unlocked album card, if any */
  drawn: number | null;
  /** daily only */
  daily?: { counted: boolean; streak: number; number: number };
}

const yesterdayKey = (today: string) => {
  const [y, m, d] = today.split('-').map(Number);
  return localDateKey(new Date(y, m - 1, d - 1));
};

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
    // A small gift at the end of each chapter.
    if (out.firstClear && n % 12 === 0) {
      save.hints++;
      save.shuffles++;
    }
  } else if (s.spec.mode === 'daily') {
    const today = localDateKey();
    const key = s.spec.seed.replace('daily-', '');
    const counted = key === today && !save.daily.results[key];
    if (counted) {
      const ms = s.elapsedMs(s.finishedAt);
      save.daily.results[key] = { ms, score: s.score, combo: s.bestCombo, stars };
      save.stats.bestDailyMs = save.stats.bestDailyMs ? Math.min(save.stats.bestDailyMs, ms) : ms;
      save.daily.streak = save.daily.lastDate === yesterdayKey(today) ? save.daily.streak + 1 : 1;
      save.daily.best = Math.max(save.daily.best, save.daily.streak);
      save.daily.lastDate = today;
      out.petals = ECONOMY.dailyPetals;
      out.drawn = drawCard();
    }
    out.daily = { counted, streak: save.daily.streak, number: s.spec.number };
  } else {
    save.stats.zenBoards++;
    out.petals = ECONOMY.zenPetals;
  }

  save.petals += out.petals;
  persist();
  return out;
}

/** Streak to display: still alive if the last daily was today or yesterday. */
export function liveStreak(): number {
  const today = localDateKey();
  const last = save.daily.lastDate;
  return last === today || last === yesterdayKey(today) ? save.daily.streak : 0;
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
