/**
 * Flower Path: rank curve, rewards, missions, chests, gold leaf, purchases,
 * and Warm tea (streak freeze) consumption.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { BONUS_IDS } from '../src/data/deck';
import {
  MAX_RANK, MISSIONS, PATH_EXCLUSIVES, TITLES, rankInfo, rankOf, rankReward, xpForRank, xpToNext,
} from '../src/data/meta';
import { dailyLevel, journeyLevel, localDateKey, zenLevel } from '../src/engine/levels';
import { Session } from '../src/engine/session';
import { emit } from '../src/services/events';
import {
  boardReport, claimChest, claimMission, claimRank, drawMissions, grant, grantPouch, grantSupporter, missions, pending,
  ranksToClaim, rerollMission, starChests,
} from '../src/services/meta';
import { liveStreak, recordClear, teaToBridge } from '../src/services/progress';
import { defaultSave, save } from '../src/services/storage';
import { checkSeals, SEALS } from '../src/services/achievements';

const dayKey = (offset: number) => {
  const d = new Date();
  return localDateKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() + offset));
};

/** Reset the shared save object in place (storage exports a live binding). */
function fresh() {
  const d = defaultSave();
  for (const k of Object.keys(save) as (keyof typeof save)[]) delete (save as Partial<typeof save>)[k];
  Object.assign(save, d);
}

/** A finished board for `spec`, cleared in `ms` with no assists. */
function cleared(spec = journeyLevel(8), ms = 30_000): Session {
  const s = new Session(spec, 0);
  s.pairsMade = 20;
  s.score = 4000;
  s.finishedAt = ms;
  return s;
}

beforeEach(fresh);

describe('rank curve', () => {
  it('has 100 ranks with growing steps', () => {
    expect(xpForRank(1)).toBe(0);
    for (let r = 2; r < MAX_RANK; r++) expect(xpToNext(r)).toBeGreaterThanOrEqual(xpToNext(r - 1) - 0);
    expect(xpToNext(MAX_RANK)).toBe(Infinity);
    expect(rankOf(xpForRank(MAX_RANK) + 1e6)).toBe(MAX_RANK);
  });

  it('rankInfo splits XP into rank and progress', () => {
    const at = xpForRank(12);
    expect(rankInfo(at).rank).toBe(12);
    expect(rankInfo(at).into).toBe(0);
    expect(rankInfo(at - 1).rank).toBe(11);
    expect(rankInfo(at + 5).into).toBe(5);
  });

  it('has a title every ten ranks and rewards on every rank', () => {
    expect(TITLES.map((t) => t.rank)).toEqual([1, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
    for (let r = 2; r <= MAX_RANK; r++) expect(Object.keys(rankReward(r)).length).toBeGreaterThan(0);
  });

  it('grants the Flower Path exclusives at the planned ranks', () => {
    expect(Object.fromEntries(Object.entries(PATH_EXCLUSIVES).map(([r, e]) => [r, e.key]))).toEqual({
      25: 'back:moon', 40: 'brush:gold', 55: 'garden:crane', 70: 'deck:gilded', 85: 'fx:gold', 100: 'music:moonlight',
    });
    save.meta.xp = xpForRank(26);
    while (ranksToClaim()) claimRank();
    expect(save.meta.claimed).toBe(26);
    expect(save.market.owned).toContain('back:moon');
    expect(save.market.owned).not.toContain('brush:gold');
  });
});

describe('rewards', () => {
  it('Warm tea caps at 2 and turns into petals after that', () => {
    save.streakFreezes = 1;
    const g = grant({ tea: 2 });
    expect(save.streakFreezes).toBe(2);
    expect(g.tea).toBe(1);
    expect(g.petals).toBeGreaterThan(0);
  });

  it('gold leaf only drops for cards already in the album', () => {
    save.album = [5, 9];
    const g = grant({ foil: 3 });
    expect(g.foil.sort()).toEqual([5, 9]);
    expect(save.meta.foil.sort()).toEqual([5, 9]);
    expect(g.petals).toBeGreaterThan(0); // the third one became petals
  });
});

describe('missions', () => {
  it('has a pool of 30+ templates across every mode', () => {
    expect(MISSIONS.length).toBeGreaterThanOrEqual(30);
    expect(new Set(MISSIONS.map((m) => m.id)).size).toBe(MISSIONS.length);
    expect(new Set(MISSIONS.map((m) => m.go))).toEqual(new Set(['journey', 'daily', 'rush', 'zen']));
  });

  it('draws three per day, one per tier, seeded by date', () => {
    const a = drawMissions('2026-10-07', () => true);
    expect(a).toEqual(drawMissions('2026-10-07', () => true));
    expect(a.map((id) => MISSIONS.find((m) => m.id === id)!.tier)).toEqual([1, 2, 3]);
    const metrics = a.map((id) => MISSIONS.find((m) => m.id === id)!.metric);
    expect(new Set(metrics).size).toBe(3);
    const days = new Set(Array.from({ length: 20 }, (_, i) => drawMissions(`2026-11-${String(i + 1).padStart(2, '0')}`, () => true).join()));
    expect(days.size).toBeGreaterThan(10);
  });

  it('skips missions for mechanics the player has not met', () => {
    save.level = 1;
    for (let i = 0; i < 30; i++) {
      const ids = drawMissions(`2027-01-${String(i + 1).padStart(2, '0')}`, (d) => !d.needs && !d.minLevel);
      for (const id of ids) expect(MISSIONS.find((m) => m.id === id)!.needs).toBeUndefined();
    }
  });

  it('tracks pairs from the event bus, completes, and claims once', () => {
    save.meta.missions = { date: localDateKey(), list: [{ id: 'pairs40', n: 38, done: false, claimed: false, rerolled: false }, { id: 'zen2', n: 0, done: false, claimed: false, rerolled: false }, { id: 'pairs200', n: 0, done: false, claimed: false, rerolled: false }] };
    const s = new Session(journeyLevel(9), 0);
    emit('start', { session: s });
    emit('pair', { mode: 'journey', cards: [0, 1], combo: 1, fever: false, yaku: [], session: s });
    emit('pair', { mode: 'journey', cards: [4, 5], combo: 2, fever: false, yaku: [], session: s });
    const [m] = missions();
    expect(m.state.done).toBe(true);
    expect(save.meta.week.count).toBe(1);
    expect(pending().missions).toBe(1);
    const xp = save.meta.xp;
    expect(claimMission(0)).not.toBeNull();
    expect(claimMission(0)).toBeNull();
    expect(save.meta.xp).toBeGreaterThan(xp);
  });

  it('allows one reroll per mission per day', () => {
    save.level = 60;
    const before = missions()[1].def.id;
    expect(rerollMission(1)).toBe(true);
    expect(missions()[1].def.id).not.toBe(before);
    expect(missions()[1].def.tier).toBe(2);
    expect(rerollMission(1)).toBe(false);
  });
});

describe('XP from play', () => {
  it('gives XP for pairs, clears, blossoms and first clears, and reports it for the result sheet', () => {
    const s = cleared(journeyLevel(8));
    emit('start', { session: s });
    emit('pair', { mode: 'journey', cards: [0, 1], combo: 1, fever: false, yaku: [], session: s });
    const summary = recordClear(s);
    emit('clear', { session: s, summary });
    const rep = boardReport(s)!;
    expect(rep.xp).toBeGreaterThan(20);
    expect(rep.after.rank).toBeGreaterThanOrEqual(rep.before.rank);
    expect(save.meta.xp).toBe(rep.xp);
  });

  it('counts the lucky cards and collects them for the Album', () => {
    const s = new Session(zenLevel('z'), 0);
    emit('pair', { mode: 'zen', cards: [BONUS_IDS[0], BONUS_IDS[1]], combo: 1, fever: false, yaku: [], session: s });
    expect(save.meta.bonus.sort()).toEqual([48, 49]);
    expect(boardReport(s)!.bonus.length).toBe(2);
  });
});

describe('star chests', () => {
  it('opens at 12 / 24 / 36 blossoms per chapter, once each', () => {
    save.level = 14;
    for (let n = 1; n <= 12; n++) save.stars[n] = 2; // 24 blossoms
    const ch = starChests().find((c) => c.chapter === 0)!;
    expect(ch.stars).toBe(24);
    expect(ch.chests.map((c) => c.ready)).toEqual([true, true, false]);
    expect(claimChest(0, 12)).not.toBeNull();
    expect(claimChest(0, 12)).toBeNull();
    expect(claimChest(0, 36)).toBeNull();
    expect(starChests().length).toBe(2);
  });
});

describe('purchases', () => {
  it('credits a petal pouch once per purchase token', () => {
    expect(grantPouch(600, 'tok-1')).toBe(true);
    expect(grantPouch(600, 'tok-1')).toBe(false);
    expect(save.petals).toBe(600);
  });

  it('Supporter pack: petals once, Clouds back, and its seal joins the book only when owned', () => {
    expect(SEALS.some((s) => s.id === 'supporter')).toBe(false);
    expect(grantSupporter()).toBe(true);
    expect(grantSupporter()).toBe(false);
    expect(save.petals).toBeGreaterThanOrEqual(1500);
    expect(save.market.owned).toContain('back:clouds');
    checkSeals();
    expect(save.seals).toContain('supporter');
  });
});

describe('Warm tea (streak freeze)', () => {
  const playDaily = () => {
    const s = cleared(dailyLevel(dayKey(0)), 60_000);
    return recordClear(s);
  };

  it('keeps the streak through missed days when there is enough tea, and says so once', () => {
    save.daily = { streak: 5, best: 5, lastDate: dayKey(-3), results: {} }; // missed 2 days
    save.streakFreezes = 2;
    expect(liveStreak()).toBe(5);
    const sum = playDaily();
    expect(save.daily.streak).toBe(6);
    expect(save.streakFreezes).toBe(0);
    expect(sum.daily?.tea).toBe(2);
    expect(save.meta.stats.teaUsed).toBe(2);
    expect(save.meta.teaNotice).toBe(2);
  });

  it('does not spend tea when it cannot cover the whole gap', () => {
    save.daily = { streak: 5, best: 5, lastDate: dayKey(-3), results: {} };
    save.streakFreezes = 1;
    expect(liveStreak()).toBe(0);
    playDaily();
    expect(save.daily.streak).toBe(1);
    expect(save.streakFreezes).toBe(1);
  });

  it('does not spend tea when no day was missed', () => {
    save.daily = { streak: 3, best: 3, lastDate: dayKey(-1), results: {} };
    save.streakFreezes = 2;
    expect(teaToBridge(dayKey(0))).toBe(0);
    playDaily();
    expect(save.daily.streak).toBe(4);
    expect(save.streakFreezes).toBe(2);
  });

  it('shows a live streak only while tea would cover the gap', () => {
    save.daily = { streak: 9, best: 9, lastDate: dayKey(-2), results: {} };
    save.streakFreezes = 0;
    expect(liveStreak()).toBe(0);
    save.streakFreezes = 1;
    expect(liveStreak()).toBe(9);
  });
});
