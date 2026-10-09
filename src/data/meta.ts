/**
 * Flower Path (꽃길 · 花道) data: the XP table, the 100-rank curve, titles, rank
 * rewards, the daily-mission pool, star chests and the weekly chest.
 *
 * Pure data and pure functions only (no save access), so the economy simulation
 * in tests/economy.test.ts can run every number here without a browser.
 * Tuned against the 50-hour budget in docs/EXPANSION_PLAN.md §1.
 */
import { ECONOMY } from '../config';
import { MAX_STREAK_FREEZES } from './market';


// ───────────────────────────── XP ─────────────────────────────

/** XP for everything a player does. Missions add most of the rest. */
export const XP = {
  /** every pair, in any mode */
  pair: 1,
  /** a cleared Journey or Daily board */
  clear: 10,
  /** a cleared Zen board (untimed, no blossoms) */
  zenClear: 8,
  /** per blossom on the board just played */
  perStar: 4,
  /** first time a Journey level is cleared */
  firstClear: 14,
  /** today's Daily, counted once */
  daily: 30,
  /** Rush: 1 XP per this many points, capped */
  rushPointsPerXp: 200,
  rushCap: 60,
} as const;

export const MAX_RANK = 100;

/**
 * XP needed to go from rank `r` to `r + 1` (r = 1…99). Fast at first (rank 2 in
 * the first few boards, rank 5 inside the first hour), then a long gentle slope.
 */
export function xpToNext(r: number): number {
  if (r >= MAX_RANK) return Infinity;
  if (r <= 1) return CURVE.first;
  const k = r - 1;
  return Math.round((CURVE.base + CURVE.step * k ** CURVE.pow) / 10) * 10;
}
/** Curve constants (tuned by the economy simulation in tests/economy.test.ts). */
export const CURVE = { first: 80, base: 180, step: 12.1, pow: 1 };

/** Total XP needed to *reach* rank r (rank 1 = 0). */
const CUM: number[] = [0, 0];
for (let r = 1; r < MAX_RANK; r++) CUM[r + 1] = CUM[r] + xpToNext(r);
export const xpForRank = (r: number): number => CUM[Math.max(1, Math.min(MAX_RANK, r))];

/** Rank for a lifetime XP total, plus progress inside that rank. */
export function rankInfo(xp: number): { rank: number; into: number; need: number; pct: number } {
  let rank = 1;
  while (rank < MAX_RANK && xp >= CUM[rank + 1]) rank++;
  const into = xp - CUM[rank];
  const need = rank >= MAX_RANK ? 0 : xpToNext(rank);
  return { rank, into, need, pct: need ? Math.min(1, into / need) : 1 };
}
export const rankOf = (xp: number) => rankInfo(xp).rank;

// ───────────────────────────── Titles ─────────────────────────────

export interface RankTitle {
  /** first rank that carries this title */
  rank: number;
  en: string;
  ko: string;
  ja: string;
  /** one quiet line shown when the title is revealed */
  line: string;
  /** the single carved character on the title seal */
  glyph: string;
}

/** A new title every ten ranks. */
export const TITLES: RankTitle[] = [
  { rank: 1, en: 'Seedling', ko: '새싹', ja: '芽生え', glyph: '芽', line: 'Every garden begins with one small green thing.' },
  { rank: 10, en: 'Bud', ko: '꽃봉오리', ja: '蕾', glyph: '蕾', line: 'Closed for now, and full of colour.' },
  { rank: 20, en: 'Wanderer', ko: '나그네', ja: '旅人', glyph: '旅', line: 'The road bends, and you follow it gladly.' },
  { rank: 30, en: 'Petal Gatherer', ko: '꽃잎 줍는 이', ja: '花びら拾い', glyph: '拾', line: 'You notice what the wind leaves behind.' },
  { rank: 40, en: 'Moon Viewer', ko: '달맞이꾼', ja: '月見人', glyph: '月', line: 'Some nights are for simply looking up.' },
  { rank: 50, en: 'Garden Keeper', ko: '정원지기', ja: '庭守', glyph: '庭', line: 'Half the path behind you, the garden in your care.' },
  { rank: 60, en: 'Poet of Seasons', ko: '계절의 시인', ja: '四季の歌人', glyph: '詠', line: 'Spring, summer, autumn, winter: you know each by heart.' },
  { rank: 70, en: 'Gold-leaf Artisan', ko: '금박장', ja: '金箔師', glyph: '金', line: 'Patient hands, and a thin sheet of light.' },
  { rank: 80, en: 'Keeper of Seals', ko: '도장지기', ja: '印守', glyph: '印', line: 'Your name is pressed in vermilion now.' },
  { rank: 90, en: 'Sage of Four Seasons', ko: '사계의 현자', ja: '四季の賢者', glyph: '賢', line: 'Quiet, unhurried, and rarely surprised.' },
  { rank: 100, en: 'Master of Flowers', ko: '꽃의 명인', ja: '花の名人', glyph: '花', line: 'The whole deck blooms for you. Thank you for walking the path.' },
];

export const titleFor = (rank: number): RankTitle => [...TITLES].reverse().find((t) => rank >= t.rank) ?? TITLES[0];
export const isTitleRank = (rank: number) => TITLES.some((t) => t.rank === rank && rank > 1);
export const nextTitle = (rank: number): RankTitle | null => TITLES.find((t) => t.rank > rank) ?? null;

// ───────────────────────────── Rewards ─────────────────────────────

export interface Reward {
  /** Flower Path XP (chests only; rank rewards never give XP) */
  xp?: number;
  petals?: number;
  /** Warm tea: keeps the Daily streak through one missed day (max 2 held) */
  tea?: number;
  /** gold-leaf editions of cards already in the album */
  foil?: number;
  /** Market item keys granted for good, e.g. 'back:moon' */
  items?: string[];
}

/** Flower Path exclusives (not sold for petals). Keys match docs/EXPANSION_PLAN.md §3. */
export const PATH_EXCLUSIVES: Record<number, { key: string; name: string }> = {
  25: { key: 'back:moon', name: 'Moon card back' },
  40: { key: 'brush:gold', name: 'Gold brush trail' },
  55: { key: 'garden:crane', name: 'Crane for the garden' },
  70: { key: 'deck:gilded', name: 'Gilded deck' },
  85: { key: 'fx:gold', name: 'Gold-leaf match burst' },
  100: { key: 'music:moonlight', name: 'Moonlight music' },
};

/**
 * What reaching rank `r` (2…100) gives. A ten-rank rhythm, with exclusives on top.
 * Ranks that once gave hints or shuffles give their petal price instead: tools
 * come only from a rewarded ad or the Market.
 */
export function rankReward(r: number): Reward {
  const out: Reward = {};
  switch (r % 10) {
    case 1:
      out.petals = 10;
      break;
    case 2:
      out.petals = ECONOMY.hintCost;
      break;
    case 3:
      out.petals = 10;
      break;
    case 4:
      out.tea = 1;
      break;
    case 5:
      out.petals = ECONOMY.hintCost + ECONOMY.shuffleCost;
      break;
    case 6:
      out.petals = 15;
      break;
    case 7:
      out.petals = ECONOMY.shuffleCost;
      break;
    case 8:
      out.petals = 10;
      break;
    case 9:
      out.petals = 2 * ECONOMY.hintCost;
      break;
    case 0:
      out.petals = 30;
      out.foil = 1;
      break;
  }
  // The first few ranks come quickly; make each one feel like something.
  if (r <= 5) out.petals = (out.petals ?? 0) + 15;
  const ex = PATH_EXCLUSIVES[r];
  if (ex) out.items = [ex.key];
  return out;
}

// ───────────────────────────── Missions ─────────────────────────────

export type MissionTier = 1 | 2 | 3;

export type MissionMetric =
  | 'pairs'
  | 'combo4'
  | 'fever'
  | 'journey3'
  | 'journeyNew'
  | 'blossoms'
  | 'improve'
  | 'rushBest'
  | 'rushRuns'
  | 'rushPairs'
  | 'daily'
  | 'dailyPerfect'
  | 'clean'
  | 'underPar'
  | 'yaku'
  | 'brights'
  | 'animals'
  | 'ribbons'
  | 'monthCards'
  | 'gravity'
  | 'snow'
  | 'stones'
  | 'knots'
  | 'wind'
  | 'gates'
  | 'fences'
  | 'goal'
  | 'lucky'
  | 'zen'
  | 'boards'
  | 'score';

/** Metrics that track a single best result instead of a running total. */
export const BEST_METRICS: MissionMetric[] = ['rushBest', 'score'];

/** Mechanic a mission needs the player to have met first. */
export type MissionNeed = 'gravity' | 'snow' | 'stones' | 'knots' | 'wind' | 'lucky' | 'gates' | 'fences' | 'goal';

export interface MissionDef {
  id: string;
  tier: MissionTier;
  metric: MissionMetric;
  target: number;
  /** `{n}` is the target, `{month}` this calendar month's flower */
  text: string;
  /** where the "Play" shortcut goes */
  go: 'journey' | 'daily' | 'rush' | 'zen';
  needs?: MissionNeed;
  /** only offered from this Journey level on (keeps day one gentle) */
  minLevel?: number;
}

/** 43 templates across every mode. Three are drawn each day: one per tier. */
export const MISSIONS: MissionDef[] = [
  // ── Tier 1: a few minutes ──
  { id: 'pairs40', tier: 1, metric: 'pairs', target: 40, text: 'Make {n} pairs', go: 'journey' },
  { id: 'boards3', tier: 1, metric: 'boards', target: 3, text: 'Clear {n} boards in any mode', go: 'journey' },
  { id: 'new2', tier: 1, metric: 'journeyNew', target: 2, text: 'Clear {n} new Journey levels', go: 'journey' },
  { id: 'blossoms6', tier: 1, metric: 'blossoms', target: 6, text: 'Collect {n} blossoms in Journey', go: 'journey' },
  { id: 'daily', tier: 1, metric: 'daily', target: 1, text: 'Finish today’s Daily', go: 'daily' },
  { id: 'clean1', tier: 1, metric: 'clean', target: 1, text: 'Clear a board with no hints or shuffles', go: 'journey' },
  { id: 'rush2', tier: 1, metric: 'rushRuns', target: 2, text: 'Play {n} Rush runs', go: 'rush' },
  { id: 'zen2', tier: 1, metric: 'zen', target: 2, text: 'Finish {n} Zen boards', go: 'zen' },
  { id: 'animals8', tier: 1, metric: 'animals', target: 8, text: 'Pair {n} Animal cards', go: 'journey', minLevel: 6 },
  { id: 'ribbons8', tier: 1, metric: 'ribbons', target: 8, text: 'Pair {n} Ribbon cards', go: 'journey', minLevel: 6 },
  { id: 'month8', tier: 1, metric: 'monthCards', target: 8, text: 'Pair {n} {month} cards', go: 'zen', minLevel: 6 },
  { id: 'combo4x1', tier: 1, metric: 'combo4', target: 1, text: 'Reach a ×4 combo', go: 'journey' },

  // ── Tier 2: a short session ──
  { id: 'pairs100', tier: 2, metric: 'pairs', target: 100, text: 'Make {n} pairs', go: 'journey' },
  { id: 'combo4x3', tier: 2, metric: 'combo4', target: 3, text: 'Reach a ×4 combo {n} times', go: 'rush' },
  { id: 'fever1', tier: 2, metric: 'fever', target: 1, text: 'Reach Full bloom (a ×5 combo)', go: 'rush' },
  { id: 'three2', tier: 2, metric: 'journey3', target: 2, text: 'Clear {n} Journey levels with 3 blossoms', go: 'journey' },
  { id: 'new4', tier: 2, metric: 'journeyNew', target: 4, text: 'Clear {n} new Journey levels', go: 'journey' },
  { id: 'improve1', tier: 2, metric: 'improve', target: 1, text: 'Win a missing blossom on an earlier level', go: 'journey', minLevel: 8 },
  { id: 'rush6k', tier: 2, metric: 'rushBest', target: 6000, text: 'Score {n} in one Rush run', go: 'rush' },
  { id: 'rushPairs60', tier: 2, metric: 'rushPairs', target: 60, text: 'Make {n} pairs in Rush', go: 'rush' },
  { id: 'clean3', tier: 2, metric: 'clean', target: 3, text: 'Clear {n} boards with no hints or shuffles', go: 'journey' },
  { id: 'par2', tier: 2, metric: 'underPar', target: 2, text: 'Beat par time on {n} boards', go: 'journey' },
  { id: 'yaku1', tier: 2, metric: 'yaku', target: 1, text: 'Complete a card set (yaku) on a board', go: 'zen', minLevel: 6 },
  { id: 'brights6', tier: 2, metric: 'brights', target: 6, text: 'Pair {n} Bright cards', go: 'zen', minLevel: 6 },
  { id: 'zen4', tier: 2, metric: 'zen', target: 4, text: 'Finish {n} Zen boards', go: 'zen' },
  { id: 'stones2', tier: 2, metric: 'stones', target: 2, text: 'Clear {n} boards with stones', go: 'journey', needs: 'stones' },
  { id: 'leaves1', tier: 2, metric: 'gravity', target: 1, text: 'Clear a Falling-leaves board', go: 'journey', needs: 'gravity' },
  { id: 'snow1', tier: 2, metric: 'snow', target: 1, text: 'Clear a First-snow board', go: 'journey', needs: 'snow' },
  { id: 'knots1', tier: 2, metric: 'knots', target: 1, text: 'Clear a board with knots', go: 'journey', needs: 'knots' },
  { id: 'wind1', tier: 2, metric: 'wind', target: 1, text: 'Clear a Wind board', go: 'journey', needs: 'wind' },
  { id: 'gates1', tier: 2, metric: 'gates', target: 1, text: 'Clear a board with gates', go: 'journey', needs: 'gates' },
  { id: 'fences1', tier: 2, metric: 'fences', target: 1, text: 'Clear a board with bamboo fences', go: 'journey', needs: 'fences' },
  { id: 'goal2', tier: 2, metric: 'goal', target: 2, text: 'Meet the goal on {n} goal boards', go: 'journey', needs: 'goal' },
  { id: 'score8k', tier: 2, metric: 'score', target: 8000, text: 'Score {n} on one board', go: 'journey', minLevel: 8 },

  // ── Tier 3: a proper sit-down ──
  { id: 'pairs200', tier: 3, metric: 'pairs', target: 200, text: 'Make {n} pairs', go: 'journey' },
  { id: 'fever3', tier: 3, metric: 'fever', target: 3, text: 'Reach Full bloom {n} times', go: 'rush', minLevel: 6 },
  { id: 'three4', tier: 3, metric: 'journey3', target: 4, text: 'Clear {n} Journey levels with 3 blossoms', go: 'journey', minLevel: 6 },
  { id: 'rush10k', tier: 3, metric: 'rushBest', target: 10000, text: 'Score {n} in one Rush run', go: 'rush', minLevel: 6 },
  { id: 'dailyPerfect', tier: 3, metric: 'dailyPerfect', target: 1, text: 'Finish today’s Daily with 3 blossoms', go: 'daily' },
  { id: 'lucky1', tier: 3, metric: 'lucky', target: 1, text: 'Pair the two lucky cards', go: 'journey', needs: 'lucky' },
  { id: 'brights12', tier: 3, metric: 'brights', target: 12, text: 'Pair {n} Bright cards', go: 'zen', minLevel: 12 },
  { id: 'leaves3', tier: 3, metric: 'gravity', target: 3, text: 'Clear {n} Falling-leaves boards', go: 'journey', needs: 'gravity' },
  { id: 'new8', tier: 3, metric: 'journeyNew', target: 8, text: 'Clear {n} new Journey levels', go: 'journey', minLevel: 6 },
];

export const MISSIONS_PER_DAY = 3;
export const missionDef = (id: string) => MISSIONS.find((m) => m.id === id);

/** XP and petals for completing a mission of each tier. */
export const MISSION_REWARD: Record<MissionTier, { xp: number; petals: number }> = {
  1: { xp: 70, petals: 3 },
  2: { xp: 110, petals: 5 },
  3: { xp: 160, petals: 8 },
};

/** Weekly chest: fills with each completed daily mission (Monday to Sunday). */
export const WEEKLY = {
  target: 15,
  /** petals: the price of the two hints and a shuffle it used to hold */
  reward: { xp: 200, petals: 2 * ECONOMY.hintCost + ECONOMY.shuffleCost, foil: 1 } as Reward,
};

// ───────────────────────────── Star chests ─────────────────────────────

export const CHEST_STEPS = [12, 24, 36] as const;
export type ChestStep = (typeof CHEST_STEPS)[number];

/** Each Journey chapter (12 levels, 36 blossoms) has three chests. The first two pay a hint's and a hint-and-shuffle's price. */
export const STAR_CHESTS: Record<ChestStep, Reward> = {
  12: { xp: 40, petals: ECONOMY.hintCost },
  24: { xp: 60, petals: ECONOMY.hintCost + ECONOMY.shuffleCost },
  36: { xp: 100, petals: 40, foil: 1 },
};

/** Gold leaf can also drop on a 3-blossom first clear from this chapter (0-based) on. */
export const FOIL_DROP = { fromChapter: 4, chance: 0.04 };

/** Petals given instead when a foil would drop but every album card is already gilded. */
export const FOIL_FALLBACK_PETALS = 25;

/** Warm tea a player can hold: the Market's cap, so rewards and purchases agree. */
export const MAX_TEA = MAX_STREAK_FREEZES;
/** Petals given instead of tea when the pot is full. */
export const TEA_FALLBACK_PETALS = 20;

/** Plain-language list of a reward, e.g. "20 petals · Warm tea". */
export function rewardText(r: Reward, itemNames: Record<string, string> = {}): string {
  const parts: string[] = [];
  if (r.petals) parts.push(`${r.petals} petals`);
  if (r.tea) parts.push('Warm tea');
  if (r.foil) parts.push('Gold-leaf card');
  for (const k of r.items ?? []) parts.push(itemNames[k] ?? k);
  return parts.join(' · ');
}

export const exclusiveName = (key: string) => Object.values(PATH_EXCLUSIVES).find((e) => e.key === key)?.name ?? key;
