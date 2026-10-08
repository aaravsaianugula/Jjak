/**
 * Owner rule (2026-10-07): players start with 5 hints and 5 shuffles, and more
 * come only from a rewarded ad or buying them with petals. Every reward source
 * that used to hand out a free hint or shuffle now gives petals of the same
 * value (ECONOMY.hintCost per hint, ECONOMY.shuffleCost per shuffle).
 *
 * These tests walk every reward source and check that none of them touches the
 * tool counts, and that the converted rewards carry the petals they replaced.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { ECONOMY, GIFTS } from '../src/config';
import { MAX_RANK, STAR_CHESTS, WEEKLY, rankReward, xpForRank } from '../src/data/meta';
import { LEVELS_PER_CHAPTER, dailyLevel, journeyLevel, localDateKey, zenLevel } from '../src/engine/levels';
import { Session } from '../src/engine/session';
import { checkSeals } from '../src/services/achievements';
import { emit } from '../src/services/events';
import { claimChest, claimMission, claimRank, claimWeekly, weekKey } from '../src/services/meta';
import { claimGift, lanternGift, recordClear, recordRush } from '../src/services/progress';
import { defaultSave, save } from '../src/services/storage';

const HINT = ECONOMY.hintCost;
const SHUFFLE = ECONOMY.shuffleCost;

/** Reset the shared save object in place (storage exports a live binding). */
function fresh(): void {
  const d = defaultSave();
  for (const k of Object.keys(save) as (keyof typeof save)[]) delete (save as Partial<typeof save>)[k];
  Object.assign(save, d);
}

/** A finished, unaided board for `spec`. */
function cleared(spec = journeyLevel(8), ms = 30_000): Session {
  const s = new Session(spec, 0);
  s.pairsMade = 20;
  s.score = 4000;
  s.finishedAt = ms;
  return s;
}

/** Run `fn` and fail if it changed the player's hints or shuffles. */
function expectNoTools(fn: () => void): void {
  const before = { hints: save.hints, shuffles: save.shuffles };
  fn();
  expect({ hints: save.hints, shuffles: save.shuffles }).toEqual(before);
}

beforeEach(fresh);

describe('no reward source grants hints or shuffles', () => {
  it('reward definitions carry no tool fields', () => {
    const defs: object[] = [...GIFTS, WEEKLY.reward, ...Object.values(STAR_CHESTS)];
    for (let r = 2; r <= MAX_RANK; r++) defs.push(rankReward(r));
    for (const d of defs) {
      expect(d).not.toHaveProperty('hints');
      expect(d).not.toHaveProperty('shuffles');
    }
  });

  it('the gift calendar, claimed for two full weeks (plain and doubled by an ad)', () => {
    for (let day = 0; day < GIFTS.length * 2; day++) {
      save.gift.lastClaim = null;
      expectNoTools(() => claimGift(day < GIFTS.length ? 1 : 2));
    }
  });

  it('every rank reward up to rank 100', () => {
    save.meta.xp = xpForRank(MAX_RANK);
    expectNoTools(() => {
      while (claimRank());
    });
    expect(save.meta.claimed).toBe(MAX_RANK);
  });

  it('Journey first clears, lanterns and chapter ends, over four chapters', () => {
    save.level = 1;
    for (let n = 1; n <= LEVELS_PER_CHAPTER * 4; n++) expectNoTools(() => recordClear(cleared(journeyLevel(n))));
  });

  it('Daily, Zen and Rush', () => {
    const today = localDateKey();
    expectNoTools(() => recordClear(cleared(dailyLevel(today))));
    expectNoTools(() => recordClear(cleared(zenLevel('zen-tools'))));
    expectNoTools(() => recordRush(12_000, 3, 40, 4));
  });

  it('missions, the weekly chest and the star chests', () => {
    save.meta.missions = {
      date: localDateKey(),
      list: [
        { id: 'pairs40', n: 39, done: false, claimed: false, rerolled: false },
        { id: 'zen2', n: 0, done: false, claimed: false, rerolled: false },
        { id: 'pairs200', n: 0, done: false, claimed: false, rerolled: false },
      ],
    };
    const s = new Session(journeyLevel(9), 0);
    emit('start', { session: s });
    emit('pair', { mode: 'journey', cards: [0, 1], combo: 1, fever: false, yaku: [], session: s });
    expectNoTools(() => expect(claimMission(0)).not.toBeNull());

    save.meta.week = { key: weekKey(), count: WEEKLY.target, claimed: false };
    expectNoTools(() => expect(claimWeekly()).not.toBeNull());

    save.level = LEVELS_PER_CHAPTER + 1;
    for (let n = 1; n <= LEVELS_PER_CHAPTER; n++) save.stars[n] = 3;
    for (const step of [12, 24, 36] as const) expectNoTools(() => expect(claimChest(0, step)).not.toBeNull());
  });

  it('seals', () => {
    Object.assign(save.stats, { pairs: 10_000, clears: 1_000, cleanClears: 1_000, fastClears: 1_000, bestCombo: 9 });
    save.rush.best = 50_000;
    expectNoTools(() => expect(checkSeals().length).toBeGreaterThan(0));
  });
});

describe('converted rewards keep their value, as petals', () => {
  it('gift calendar: a hint day gives the hint price, a shuffle day the shuffle price, the pair day both', () => {
    expect(GIFTS.map((g) => g.petals)).toEqual([10, HINT, 15, SHUFFLE, 20, HINT + SHUFFLE, 10]);
    expect(GIFTS.map((g) => g.label)).toEqual(['10 petals', `${HINT} petals`, '15 petals', `${SHUFFLE} petals`, '20 petals', `${HINT + SHUFFLE} petals`, 'Album card']);
    save.gift.day = 1;
    const before = save.petals;
    claimGift(2);
    expect(save.petals - before).toBe(2 * HINT);
  });

  it('rank rewards: the old tool ranks pay their tools in petals (plus the early-rank bonus)', () => {
    expect(rankReward(2).petals).toBe(HINT + 15);
    expect(rankReward(5).petals).toBe(HINT + SHUFFLE + 15);
    expect(rankReward(7).petals).toBe(SHUFFLE);
    expect(rankReward(9).petals).toBe(2 * HINT);
    expect(rankReward(12).petals).toBe(HINT);
    expect(rankReward(15).petals).toBe(HINT + SHUFFLE);
    expect(rankReward(97).petals).toBe(SHUFFLE);
    expect(rankReward(99).petals).toBe(2 * HINT);
  });

  it('weekly chest and star chests', () => {
    expect(WEEKLY.reward).toEqual({ xp: 200, petals: 2 * HINT + SHUFFLE, foil: 1 });
    expect(STAR_CHESTS[12]).toEqual({ xp: 40, petals: HINT });
    expect(STAR_CHESTS[24]).toEqual({ xp: 60, petals: HINT + SHUFFLE });
    expect(STAR_CHESTS[36]).toEqual({ xp: 100, petals: 40, foil: 1 });
  });

  it('lanterns alternate a hint’s and a shuffle’s worth; the chapter-end lantern adds the old chapter gift', () => {
    expect(LEVELS_PER_CHAPTER % ECONOMY.lanternEvery).toBe(0); // every chapter end hangs a lantern
    expect(lanternGift(3)).toBe(0);
    expect(lanternGift(4)).toBe(ECONOMY.lanternPetals + HINT);
    expect(lanternGift(8)).toBe(ECONOMY.lanternPetals + SHUFFLE);
    expect(lanternGift(12)).toBe(ECONOMY.lanternPetals + HINT + HINT + SHUFFLE);
    expect(lanternGift(24)).toBe(ECONOMY.lanternPetals + SHUFFLE + HINT + SHUFFLE);
  });

  it('a lantern first clear pays the lantern petals once, and a replay pays none', () => {
    save.level = 12;
    const before = save.petals;
    const first = recordClear(cleared(journeyLevel(12)));
    expect(first.lantern).toEqual({ petals: lanternGift(12) });
    expect(save.petals - before).toBe(first.petals + lanternGift(12) + (first.lucky ?? 0));
    const replay = recordClear(cleared(journeyLevel(12)));
    expect(replay.lantern).toBeUndefined();
  });
});
