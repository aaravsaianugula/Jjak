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
  const stars = starCount(s.stars());
  save.stats.pairs += s.pairsMade;
  save.stats.clears++;
  save.stats.bestCombo = Math.max(save.stats.bestCombo, s.bestCombo);

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
      save.daily.results[key] = { ms: s.elapsedMs(s.finishedAt), score: s.score, combo: s.bestCombo, stars };
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
