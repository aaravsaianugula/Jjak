/**
 * Flower Path (꽃길 · 花道): XP and ranks, daily missions, the weekly chest,
 * chapter star chests, gold-leaf (foil) cards and the bonus-card collection.
 *
 * Listens to the game's event bus (src/services/events.ts); importing this
 * module once (the game screen does) is enough to start tracking.
 */
import { IAP } from '../config';
import { BONUS_IDS, MONTHS, cardDef, isBonus } from '../data/deck';
import {
  BEST_METRICS, CHEST_STEPS, type ChestStep, FOIL_DROP, FOIL_FALLBACK_PETALS, MAX_RANK, MAX_TEA, MISSIONS, MISSIONS_PER_DAY,
  MISSION_REWARD, type MissionDef, type MissionMetric, type MissionNeed, type RankTitle, type Reward, STAR_CHESTS,
  TEA_FALLBACK_PETALS, WEEKLY, XP, isTitleRank, missionDef, rankInfo, rankReward, titleFor,
} from '../data/meta';
import { type LevelSpec, LEVELS_PER_CHAPTER, dailyLevel, journeyLevel, localDateKey, windOf } from '../engine/levels';
import { createRng } from '../engine/rng';
import type { Session } from '../engine/session';
import { toast } from '../ui/dom';
import { checkSeals } from './achievements';
import { on } from './events';
import type { MissionState } from './save-meta';
import { persist, save } from './storage';

/** Mechanic flags as missions see them: Falling leaves is wind 'down'; any other direction is Wind. */
type SpecX = LevelSpec & { wind?: boolean };
const specX = (s: LevelSpec): SpecX => {
  const w = windOf(s);
  return { ...s, gravity: w === 'down', wind: !!w && w !== 'down' };
};

/** A quiet toast (skipped where there's no DOM, e.g. in tests). */
const notify = (text: string) => {
  if (typeof document !== 'undefined') toast(text);
};

/** Item key granted by the Supporter pack. */
export const SUPPORTER_ITEM = 'back:clouds';

// ───────────────────────────── Rank ─────────────────────────────

export const rank = () => rankInfo(save.meta.xp);
export const currentTitle = (): RankTitle => titleFor(rank().rank);

/** Ranks reached whose rewards haven't been claimed yet. */
export const ranksToClaim = () => Math.max(0, rank().rank - Math.max(1, save.meta.claimed));

function addXp(n: number): void {
  if (n <= 0) return;
  save.meta.xp += Math.round(n);
  if (board) board.xp += Math.round(n);
}

export interface Granted {
  petals: number;
  hints: number;
  shuffles: number;
  tea: number;
  /** card ids newly gilded */
  foil: number[];
  items: string[];
  xp: number;
}

/** Give a reward to the player. Tea over the cap and foil with nothing left to gild turn into petals. */
export function grant(r: Reward): Granted {
  const out: Granted = { petals: r.petals ?? 0, hints: r.hints ?? 0, shuffles: r.shuffles ?? 0, tea: 0, foil: [], items: [], xp: r.xp ?? 0 };
  for (let i = 0; i < (r.tea ?? 0); i++) {
    if (save.streakFreezes < MAX_TEA) {
      save.streakFreezes++;
      out.tea++;
    } else out.petals += TEA_FALLBACK_PETALS;
  }
  for (let i = 0; i < (r.foil ?? 0); i++) {
    const id = dropFoil();
    if (id != null) out.foil.push(id);
    else out.petals += FOIL_FALLBACK_PETALS;
  }
  for (const key of r.items ?? []) {
    if (!save.market.owned.includes(key)) save.market.owned.push(key);
    out.items.push(key);
  }
  save.petals += out.petals;
  save.hints += out.hints;
  save.shuffles += out.shuffles;
  addXp(out.xp);
  persist();
  return out;
}

export interface RankClaim {
  rank: number;
  reward: Reward;
  granted: Granted;
  /** set when this rank brings a new title */
  title: RankTitle | null;
}

/** Claim the next unclaimed rank reward, if any. */
export function claimRank(): RankClaim | null {
  if (ranksToClaim() <= 0) return null;
  const r = Math.max(1, save.meta.claimed) + 1;
  const reward = rankReward(r);
  save.meta.claimed = r;
  const granted = grant(reward);
  checkSeals();
  return { rank: r, reward, granted, title: isTitleRank(r) ? titleFor(r) : null };
}

// ───────────────────────────── Gold leaf ─────────────────────────────

/** Gild a random album card that isn't gilded yet. Only cards already collected can drop. */
export function dropFoil(): number | null {
  const have = new Set(save.meta.foil);
  const pool = save.album.filter((id) => !have.has(id) && !isBonus(id));
  if (!pool.length) return null;
  const id = pool[Math.floor(Math.random() * pool.length)];
  save.meta.foil.push(id);
  persist();
  return id;
}

export const hasFoil = (id: number) => save.meta.foil.includes(id);

// ───────────────────────────── Missions ─────────────────────────────

export interface MissionView {
  slot: number;
  def: MissionDef;
  state: MissionState;
  target: number;
  text: string;
  reward: { xp: number; petals: number };
}

const today = () => localDateKey();

/** Monday of the week containing `d`, as a date key. */
export function weekKey(d = new Date()): string {
  const day = (d.getDay() + 6) % 7; // Monday = 0
  return localDateKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() - day));
}

let reachedCache: { level: number; out: Partial<Record<MissionNeed, boolean>> } | null = null;

/** Has the player met this mechanic (Journey so far, or today's unplayed Daily)? */
function mechanicReached(need: MissionNeed): boolean {
  if (!reachedCache || reachedCache.level !== save.level) reachedCache = { level: save.level, out: {} };
  const cached = reachedCache.out[need];
  if (cached !== undefined) return cached;
  const has = (s: SpecX) =>
    need === 'gravity' ? !!s.gravity : need === 'snow' ? s.snow > 0 : need === 'stones' ? s.stones > 0 : !!s[need];
  let hit = false;
  for (let n = 1; n <= save.level && !hit; n++) hit = has(specX(journeyLevel(n)));
  const t = today();
  if (!hit && !save.daily.results[t]) hit = has(specX(dailyLevel(t)));
  reachedCache.out[need] = hit;
  return hit;
}

function eligible(def: MissionDef, dateKey: string): boolean {
  if (def.minLevel && save.level < def.minLevel) return false;
  if (def.needs && !mechanicReached(def.needs)) return false;
  if ((def.metric === 'daily' || def.metric === 'dailyPerfect') && save.daily.results[dateKey]) return false;
  return true;
}

/** Today's draw: one mission per tier, seeded by the date, no two with the same goal. */
export function drawMissions(dateKey: string, isEligible: (d: MissionDef) => boolean = (d) => eligible(d, dateKey)): string[] {
  const rng = createRng(`missions-${dateKey}`);
  const picked: MissionDef[] = [];
  for (const tier of [1, 2, 3] as const) {
    const pool = MISSIONS.filter((m) => m.tier === tier && isEligible(m) && !picked.some((p) => p.metric === m.metric));
    const fallback = MISSIONS.filter((m) => m.tier === tier && !m.needs && !picked.some((p) => p.metric === m.metric));
    const from = pool.length ? pool : fallback;
    picked.push(from[rng.int(from.length)]);
  }
  return picked.slice(0, MISSIONS_PER_DAY).map((m) => m.id);
}

function ensureWeek(): void {
  const k = weekKey();
  if (save.meta.week.key !== k) save.meta.week = { key: k, count: 0, claimed: false };
}

/** Make sure today's missions exist (new day → new draw). */
export function ensureToday(): void {
  const t = today();
  ensureWeek();
  if (save.meta.missions.date === t && save.meta.missions.list.length === MISSIONS_PER_DAY) return;
  save.meta.missions = {
    date: t,
    list: drawMissions(t).map((id) => ({ id, n: 0, done: false, claimed: false, rerolled: false })),
  };
  persist();
}

const monthFor = (dateKey: string) => MONTHS[Math.max(0, Math.min(11, Number(dateKey.slice(5, 7)) - 1))];

export function missionText(def: MissionDef, dateKey = save.meta.missions.date ?? today()): string {
  return def.text.replace('{n}', def.target.toLocaleString('en-US')).replace('{month}', monthFor(dateKey).en);
}

export function missions(): MissionView[] {
  ensureToday();
  return save.meta.missions.list.flatMap((state, slot) => {
    const def = missionDef(state.id);
    if (!def) return [];
    return [{ slot, def, state, target: def.target, text: missionText(def), reward: MISSION_REWARD[def.tier] }];
  });
}

/** One free reroll per mission per day (not once it's finished). */
export function rerollMission(slot: number): boolean {
  ensureToday();
  const list = save.meta.missions.list;
  const cur = list[slot];
  const def = cur && missionDef(cur.id);
  if (!cur || !def || cur.rerolled || cur.done) return false;
  const t = save.meta.missions.date!;
  const others = list.filter((_, i) => i !== slot).map((s) => missionDef(s.id)?.metric);
  const pool = MISSIONS.filter((m) => m.tier === def.tier && m.id !== def.id && !others.includes(m.metric) && m.metric !== def.metric && eligible(m, t));
  if (!pool.length) return false;
  const next = pool[createRng(`missions-${t}-reroll-${slot}`).int(pool.length)];
  list[slot] = { id: next.id, n: 0, done: false, claimed: false, rerolled: true };
  persist();
  return true;
}

export function claimMission(slot: number): { xp: number; petals: number } | null {
  ensureToday();
  const s = save.meta.missions.list[slot];
  const def = s && missionDef(s.id);
  if (!s || !def || !s.done || s.claimed) return null;
  s.claimed = true;
  const r = MISSION_REWARD[def.tier];
  save.petals += r.petals;
  addXp(r.xp);
  persist();
  checkSeals();
  return r;
}

/** Advance every open mission that tracks `metric`. */
function bump(metric: MissionMetric, amount = 1): void {
  if (amount <= 0) return;
  ensureToday();
  const best = BEST_METRICS.includes(metric);
  for (const s of save.meta.missions.list) {
    const def = missionDef(s.id);
    if (!def || def.metric !== metric || s.done) continue;
    s.n = best ? Math.max(s.n, amount) : s.n + amount;
    if (s.n >= def.target) {
      s.n = def.target;
      s.done = true;
      save.meta.stats.missions++;
      ensureWeek();
      save.meta.week.count++;
      if (board) board.missions.push(missionText(def));
      notify(`Mission complete · ${missionText(def)}`);
    }
  }
  persist();
}

export function weekly(): { count: number; target: number; claimed: boolean; ready: boolean; reward: Reward } {
  ensureWeek();
  const w = save.meta.week;
  return { count: Math.min(w.count, WEEKLY.target), target: WEEKLY.target, claimed: w.claimed, ready: !w.claimed && w.count >= WEEKLY.target, reward: WEEKLY.reward };
}

export function claimWeekly(): Granted | null {
  const w = weekly();
  if (!w.ready) return null;
  save.meta.week.claimed = true;
  save.meta.stats.weeks++;
  const g = grant(WEEKLY.reward);
  checkSeals();
  return g;
}

// ───────────────────────────── Star chests ─────────────────────────────

export interface ChestView {
  step: ChestStep;
  key: string;
  ready: boolean;
  claimed: boolean;
  reward: Reward;
}

export interface ChapterChests {
  chapter: number;
  first: number;
  stars: number;
  chests: ChestView[];
}

export const chapterStars = (chapter: number) => {
  let sum = 0;
  for (let n = chapter * LEVELS_PER_CHAPTER + 1; n <= (chapter + 1) * LEVELS_PER_CHAPTER; n++) sum += save.stars[n] ?? 0;
  return sum;
};

/** Every chapter the player has reached, newest first. */
export function starChests(): ChapterChests[] {
  const last = Math.floor((Math.max(1, save.level) - 1) / LEVELS_PER_CHAPTER);
  const out: ChapterChests[] = [];
  for (let c = last; c >= 0; c--) {
    const stars = chapterStars(c);
    out.push({
      chapter: c,
      first: c * LEVELS_PER_CHAPTER + 1,
      stars,
      chests: CHEST_STEPS.map((step) => {
        const key = `${c}-${step}`;
        const claimed = save.meta.chests.includes(key);
        return { step, key, claimed, ready: !claimed && stars >= step, reward: STAR_CHESTS[step] };
      }),
    });
  }
  return out;
}

export function claimChest(chapter: number, step: ChestStep): Granted | null {
  const key = `${chapter}-${step}`;
  if (save.meta.chests.includes(key) || chapterStars(chapter) < step) return null;
  save.meta.chests.push(key);
  if (step === 36) save.meta.stats.fullChests++;
  const g = grant(STAR_CHESTS[step]);
  checkSeals();
  return g;
}

// ───────────────────────────── Badge ─────────────────────────────

export function pending(): { ranks: number; missions: number; weekly: boolean; chests: number; total: number } {
  ensureToday();
  const ranks = ranksToClaim();
  const m = save.meta.missions.list.filter((s) => s.done && !s.claimed).length;
  const w = weekly().ready;
  const chests = starChests().reduce((a, c) => a + c.chests.filter((x) => x.ready).length, 0);
  return { ranks, missions: m, weekly: w, chests, total: ranks + m + (w ? 1 : 0) + chests };
}

export const missionsDone = () => {
  ensureToday();
  return save.meta.missions.list.filter((s) => s.done).length;
};

// ───────────────────────────── Per-board report ─────────────────────────────

interface BoardTrack {
  session: Session;
  xp: number;
  xpBefore: number;
  missions: string[];
  foil: number | null;
  bonus: number[];
  fever: number;
  prevStars: number;
}
let board: BoardTrack | null = null;

function track(session: Session): BoardTrack {
  if (!board || board.session !== session) {
    const n = session.spec.mode === 'journey' ? session.spec.number : 0;
    board = { session, xp: 0, xpBefore: save.meta.xp, missions: [], foil: null, bonus: [], fever: 0, prevStars: n ? save.stars[n] ?? 0 : 0 };
  }
  return board;
}

export interface BoardReport {
  xp: number;
  before: { rank: number; into: number; need: number; pct: number };
  after: { rank: number; into: number; need: number; pct: number };
  /** mission texts completed during this board */
  missions: string[];
  /** a gold-leaf card that dropped on this clear */
  foil: number | null;
  /** lucky cards collected for the first time on this board */
  bonus: number[];
  /** Warm tea cups that kept the streak (shown once) */
  tea: number;
}

/** What this board added to the Flower Path (for the result sheet). */
export function boardReport(session: Session): BoardReport | null {
  if (!board || board.session !== session) return null;
  const tea = save.meta.teaNotice;
  if (tea) {
    save.meta.teaNotice = 0;
    persist();
  }
  return {
    xp: board.xp,
    before: rankInfo(board.xpBefore),
    after: rankInfo(save.meta.xp),
    missions: board.missions.slice(),
    foil: board.foil,
    bonus: board.bonus.slice(),
    tea,
  };
}

/** Warm tea cups waiting to be announced (consumes the notice). */
export function takeTeaNotice(): number {
  const n = save.meta.teaNotice;
  if (n) {
    save.meta.teaNotice = 0;
    persist();
  }
  return n;
}

// ───────────────────────────── Purchases ─────────────────────────────

/** Credit a petal pouch once per purchase token. Returns false if it was already credited. */
export function grantPouch(petals: number, token: string | undefined): boolean {
  if (token && save.meta.iapTokens.includes(token)) return false;
  if (token) {
    save.meta.iapTokens.push(token);
    if (save.meta.iapTokens.length > 60) save.meta.iapTokens.splice(0, save.meta.iapTokens.length - 60);
  }
  save.petals += petals;
  persist();
  return true;
}

/** Supporter pack: one-time petals, the Clouds card back and the Supporter seal. Ads are handled by the store. */
export function grantSupporter(): boolean {
  if (save.meta.supporter) {
    if (!save.market.owned.includes(SUPPORTER_ITEM)) save.market.owned.push(SUPPORTER_ITEM);
    return false;
  }
  save.meta.supporter = true;
  save.petals += IAP.supporterPetals;
  if (!save.market.owned.includes(SUPPORTER_ITEM)) save.market.owned.push(SUPPORTER_ITEM);
  persist();
  checkSeals();
  return true;
}

// ───────────────────────────── Event wiring ─────────────────────────────

on('start', ({ session }) => {
  track(session);
  ensureToday();
});

on('pair', (e) => {
  const b = track(e.session);
  addXp(XP.pair);
  bump('pairs');
  if (e.mode === 'rush') bump('rushPairs');
  if (e.combo === 4) bump('combo4');
  if (e.session.feverCount > b.fever) {
    bump('fever', e.session.feverCount - b.fever);
    b.fever = e.session.feverCount;
  }
  if (e.yaku.length) bump('yaku', e.yaku.length);
  const kinds = e.cards.filter((id) => !isBonus(id)).map((id) => cardDef(id).kind);
  bump('brights', kinds.filter((k) => k === 'bright').length);
  bump('animals', kinds.filter((k) => k === 'animal').length);
  bump('ribbons', kinds.filter((k) => k === 'ribbon').length);
  const month = monthFor(save.meta.missions.date ?? today()).index;
  bump('monthCards', e.cards.filter((id) => !isBonus(id) && id >> 2 === month).length);
  if (e.cards.some(isBonus)) {
    bump('lucky');
    const fresh = BONUS_IDS.filter((id) => !save.meta.bonus.includes(id));
    if (fresh.length) {
      save.meta.bonus.push(...fresh);
      b.bonus.push(...fresh);
      persist();
      notify('Lucky cards added to your Album');
    }
  }
  if (e.mode === 'rush' && e.session.done) bump('boards');
  persist();
});

on('clear', ({ session, summary }) => {
  const b = track(session);
  const spec = session.spec as SpecX;
  const st = session.stars();
  const mode = spec.mode;
  if (mode === 'zen') {
    addXp(XP.zenClear);
    bump('zen');
  } else {
    addXp(XP.clear + summary.stars * XP.perStar);
    if (summary.firstClear) addXp(XP.firstClear);
    if (summary.daily?.counted) addXp(XP.daily);
  }
  bump('boards');
  if (st.noAssist) bump('clean');
  if (st.underPar && mode !== 'zen') bump('underPar');
  bump('score', session.score);
  if (mode === 'journey') {
    bump('blossoms', summary.stars);
    if (summary.firstClear) bump('journeyNew');
    if (summary.stars >= 3) bump('journey3');
    if (!summary.firstClear && summary.stars > b.prevStars) bump('improve');
    // A rare gold-leaf drop on a perfect first clear, later in the road.
    const chapter = Math.floor((spec.number - 1) / LEVELS_PER_CHAPTER);
    if (summary.firstClear && summary.stars >= 3 && chapter >= FOIL_DROP.fromChapter && Math.random() < FOIL_DROP.chance) {
      b.foil = dropFoil();
    }
  }
  if (summary.daily?.counted) {
    bump('daily');
    if (summary.stars >= 3) bump('dailyPerfect');
  }
  const mx = specX(spec);
  if (mx.gravity) bump('gravity');
  if (spec.snow > 0) bump('snow');
  if (spec.stones > 0) bump('stones');
  if (spec.knots) bump('knots');
  if (mx.wind) bump('wind');
  if (spec.gates) bump('gates');
  if (spec.fences) bump('fences');
  if (spec.goal && st.goal) bump('goal');
  persist();
});

on('rush', (e) => {
  addXp(Math.min(XP.rushCap, Math.floor(e.score / XP.rushPointsPerXp)));
  bump('rushRuns');
  bump('rushBest', e.score);
  persist();
});

export { MAX_RANK };
