/**
 * Economy + hours check for the Flower Path (docs/EXPANSION_PLAN.md §1).
 *
 * Simulates a *steady* player: ~50 minutes a day, the Daily every day, three
 * daily missions (the hard one most days), two Rush runs and two Zen boards
 * the missions send them to, and Journey for the rest of the time, replaying
 * one level in three for the missing blossom. Expected values, no randomness,
 * so the numbers are stable. Run `npx vitest run tests/economy.test.ts` to see
 * the table.
 */
import { describe, expect, it } from 'vitest';
import { ECONOMY, GIFTS } from '../src/config';
import { journeyLevel } from '../src/engine/levels';
import {
  CHEST_STEPS, MAX_RANK, MAX_TEA, MISSION_REWARD, STAR_CHESTS, TEA_FALLBACK_PETALS, WEEKLY, XP,
  rankOf, rankReward, xpForRank,
} from '../src/data/meta';
import { lanternGift } from '../src/services/progress';

/** Assumptions about the steady player (documented in EXPANSION_PLAN §1). */
const PLAYER = {
  minutesPerDay: 50,
  dailyMinutes: 3,
  dailyPairs: 21,
  dailyStars: 2,
  rushRunsPerDay: 2,
  rushMinutes: 2,
  rushScore: 6000,
  rushPairs: 34,
  zenPerDay: 2,
  zenMinutes: 3,
  zenPairs: 17,
  /** expected blossoms on a first clear: the clear plus one of the other two */
  firstStars: 2.0,
  /** one level in three is replayed once for a missing blossom */
  replayEvery: 3,
  /** tier-3 missions finished on this share of days */
  hardMissionRate: 0.7,
  /** existing seals (≈1,030 petals) and new Flower Path seals (≈480), earned evenly over 50 h */
  sealPetals: 1030 * 0.85 + 480 * 0.7,
  /** Lucky cards (Journey feature): assumed 10 petals, on 1 in 8 boards from level 61 */
  luckyPetals: 10,
  luckyEvery: 8,
  luckyFrom: 61,
  /** chapters where every level reaches 3 blossoms (36-star chest) */
  perfectChapterShare: 0.1,
};

/** Minutes per Journey board, including the intro and result sheet (≈2.8 min on average). */
const minutesFor = (pairs: number) => 1.1 + pairs * 0.1;

interface SimOut {
  hours: number;
  xp: number;
  petals: Record<string, number>;
  rankAt: (h: number) => number;
  hoursTo: (rank: number) => number;
  level: number;
  foil: number;
  missions: number;
  xpAt: (h: number) => number;
}

function simulate(totalHours = 60): SimOut {
  let minutes = 0;
  let xp = 0;
  let level = 1;
  let tea = 0;
  let foil = 0;
  let missions = 0;
  let weekMissions = 0;
  let day = 0;
  let rankPaid = 1;
  const petals: Record<string, number> = {};
  const add = (k: string, n: number) => (petals[k] = (petals[k] ?? 0) + n);
  const timeline: { min: number; xp: number }[] = [];
  const chapterStars: number[] = [];
  const tick = (m: number, gainedXp: number) => {
    minutes += m;
    xp += gainedXp;
    timeline.push({ min: minutes, xp });
    // Claim rank rewards as they arrive.
    const r = rankOf(xp);
    while (rankPaid < r) {
      rankPaid++;
      const rw = rankReward(rankPaid);
      add('rank rewards', rw.petals ?? 0);
      if (rw.tea) {
        if (tea < MAX_TEA) tea++;
        else add('rank rewards', TEA_FALLBACK_PETALS);
      }
      foil += rw.foil ?? 0;
    }
  };

  while (minutes < totalHours * 60) {
    day++;
    const dayStart = minutes;
    // Daily
    tick(PLAYER.dailyMinutes, PLAYER.dailyPairs * XP.pair + XP.clear + PLAYER.dailyStars * XP.perStar + XP.daily);
    add('daily', ECONOMY.dailyPetals);
    const g = GIFTS[(day - 1) % GIFTS.length];
    add('gift calendar', g.petals);
    // Mission-driven boards: Rush and Zen
    for (let i = 0; i < PLAYER.rushRunsPerDay; i++) {
      tick(PLAYER.rushMinutes, PLAYER.rushPairs * XP.pair + Math.min(XP.rushCap, Math.floor(PLAYER.rushScore / XP.rushPointsPerXp)));
      add('rush', Math.min(ECONOMY.rushPetalCap, Math.floor(PLAYER.rushScore / ECONOMY.rushPointsPerPetal)));
    }
    for (let i = 0; i < PLAYER.zenPerDay; i++) {
      tick(PLAYER.zenMinutes, PLAYER.zenPairs * XP.pair + XP.zenClear);
      add('zen', ECONOMY.zenPetals);
    }
    // Journey for the rest of the day
    while (minutes - dayStart < PLAYER.minutesPerDay) {
      const spec = journeyLevel(level);
      const pairs = (spec.rows * spec.cols - spec.stones) / 2;
      const stars = PLAYER.firstStars;
      tick(minutesFor(pairs), pairs * XP.pair + XP.clear + stars * XP.perStar + XP.firstClear);
      add('journey blossoms', stars * ECONOMY.petalsPerStar);
      add('lanterns', lanternGift(level));
      if (level >= PLAYER.luckyFrom && level % PLAYER.luckyEvery === 0) add('lucky cards (est.)', PLAYER.luckyPetals);
      let final = stars;
      if (level % PLAYER.replayEvery === 0) {
        const gain = 3 - stars;
        tick(minutesFor(pairs) * 0.9, pairs * XP.pair + XP.clear + 3 * XP.perStar);
        add('journey blossoms', gain * ECONOMY.petalsPerStar);
        final = 3;
      }
      const ch = Math.floor((level - 1) / 12);
      chapterStars[ch] = (chapterStars[ch] ?? 0) + final;
      if (level % 12 === 0) {
        const perfect = Math.round((ch + 1) * PLAYER.perfectChapterShare) > Math.round(ch * PLAYER.perfectChapterShare);
        const total = perfect ? 36 : chapterStars[ch];
        for (const step of CHEST_STEPS) {
          if (total >= step) {
            add('star chests', STAR_CHESTS[step].petals ?? 0);
            tick(0, STAR_CHESTS[step].xp ?? 0);
            foil += STAR_CHESTS[step].foil ?? 0;
          }
        }
      }
      level++;
    }
    // Missions (credited at the end of the day's play)
    const done = 2 + PLAYER.hardMissionRate;
    const mxp = MISSION_REWARD[1].xp + MISSION_REWARD[2].xp + PLAYER.hardMissionRate * MISSION_REWARD[3].xp;
    add('missions', MISSION_REWARD[1].petals + MISSION_REWARD[2].petals + PLAYER.hardMissionRate * MISSION_REWARD[3].petals);
    tick(0, mxp);
    missions += done;
    weekMissions += done;
    if (day % 7 === 0) {
      if (weekMissions >= WEEKLY.target) {
        add('weekly chest', WEEKLY.reward.petals ?? 0);
        tick(0, WEEKLY.reward.xp ?? 0);
        foil += WEEKLY.reward.foil ?? 0;
      }
      weekMissions = 0;
    }
  }
  const hours = minutes / 60;
  add('seals', PLAYER.sealPetals * Math.min(1, hours / 50));
  const hoursTo = (rank: number) => {
    const need = xpForRank(rank);
    const hit = timeline.find((t) => t.xp >= need);
    return hit ? hit.min / 60 : Infinity;
  };
  const rankAt = (h: number) => {
    let last = 0;
    for (const t of timeline) if (t.min <= h * 60) last = t.xp;
    return rankOf(last);
  };
  const xpAt = (h: number) => {
    let last = 0;
    for (const t of timeline) if (t.min <= h * 60) last = t.xp;
    return Math.round(last);
  };
  return { hours, xp, petals, rankAt, hoursTo, level, foil, missions, xpAt };
}

describe('Flower Path economy (steady player)', () => {
  const sim = simulate(50);
  const total = Object.values(sim.petals).reduce((a, b) => a + b, 0);
  const perHour = total / sim.hours;

  it('prints the table', () => {
    const rows = Object.entries(sim.petals)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `  ${k.padEnd(20)} ${Math.round(v).toString().padStart(6)}  ${(v / sim.hours).toFixed(0).padStart(4)}/h`);
    const ranks = [2, 5, 10, 20, 25, 40, 50, 55, 70, 85, 100].map((r) => `  rank ${String(r).padStart(3)} at ${sim.hoursTo(r).toFixed(2)} h`);
    console.log(
      [
        `Simulated ${sim.hours.toFixed(1)} h · Journey level ${sim.level} · ${Math.round(sim.xp).toLocaleString('en-US')} XP · ${Math.round(sim.missions)} missions · ${sim.foil} foil drops (+ ~6 from 3-blossom clears)`,
        `Petals: ${Math.round(total).toLocaleString('en-US')} total = ${perHour.toFixed(0)}/h`,
        ...rows,
        ...ranks,
        `  XP at 0.25/0.5/1/2/5/10/25/50 h: ${[0.25, 0.5, 1, 2, 5, 10, 25, 50].map((h) => sim.xpAt(h)).join(' / ')}`,
        `  rank at 1 h: ${sim.rankAt(1)} · 10 h: ${sim.rankAt(10)} · 25 h: ${sim.rankAt(25)}`,
      ].join('\n'),
    );
  });

  // Until 2026-10-07 this was "near 300 petals per hour" (292/h measured), with
  // another ≈169/h of value handed out as free hints and shuffles. The owner
  // made every free tool grant petals of the same value (ECONOMY.hintCost per
  // hint, ECONOMY.shuffleCost per shuffle: gift calendar, rank rewards, star
  // chests, the weekly chest, lanterns and the chapter gift), so the petal rate
  // rises to ≈461/h while the total value a steady player earns is unchanged.
  it('lands near 460 petals per hour (≈300 earned as petals + ≈160 that used to be free tools)', () => {
    expect(perHour).toBeGreaterThan(430);
    expect(perHour).toBeLessThan(490);
  });

  it('reaches rank 100 near 50 hours', () => {
    const h = simulate(70).hoursTo(MAX_RANK);
    expect(h).toBeGreaterThan(45);
    expect(h).toBeLessThan(55);
  });

  it('feels fast early: rank 2 in the first session, rank 5 inside the first hour', () => {
    expect(sim.hoursTo(2)).toBeLessThan(0.25);
    expect(sim.hoursTo(5)).toBeLessThan(1);
  });
});
