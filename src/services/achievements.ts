/**
 * Seals (印): achievements stamped into the player's book. Several are real
 * scoring sets (yaku) from Korean Go-Stop and Japanese Koi-Koi — collected
 * here through the Album, never wagered.
 */
import { MONTHS } from '../data/deck';
import { rankOf } from '../data/meta';
import { liveStreak } from './progress';
import { persist, save } from './storage';

export interface Seal {
  id: string;
  title: string;
  /** native-script subtitle shown under the title */
  native?: string;
  desc: string;
  reward: number;
  /** [current, target] */
  progress(): [number, number];
  /** album card ids, for card-set seals */
  cards?: number[];
  group: 'Play' | 'Journey' | 'Daily' | 'Album sets' | 'Flower Path';
}

const has = (ids: number[]) => ids.filter((id) => save.album.includes(id)).length;
const starsTotal = () => Object.values(save.stars).reduce((a, b) => a + b, 0);
const threeStarLevels = () => Object.values(save.stars).filter((s) => s >= 3).length;
const fullMonths = () => MONTHS.filter((m) => [0, 1, 2, 3].every((v) => save.album.includes(m.index * 4 + v))).length;
const cleared = () => save.level - 1;
const pathRank = () => rankOf(save.meta.xp);

export const SEALS: Seal[] = [
  // Play
  { id: 'first', group: 'Play', title: 'First pair', native: '첫 짝', desc: 'Make your first jjak.', reward: 5, progress: () => [Math.min(1, save.stats.pairs), 1] },
  { id: 'pairs500', group: 'Play', title: 'Five hundred pairs', desc: 'Make 500 pairs in total.', reward: 25, progress: () => [save.stats.pairs, 500] },
  { id: 'pairs2000', group: 'Play', title: 'Two thousand pairs', desc: 'Make 2,000 pairs in total.', reward: 60, progress: () => [save.stats.pairs, 2000] },
  { id: 'combo3', group: 'Play', title: 'In rhythm', native: '짝짝짝', desc: 'Reach a ×3 combo.', reward: 10, progress: () => [save.stats.bestCombo, 3] },
  { id: 'combo5', group: 'Play', title: 'Standing ovation', native: '짝짝짝짝짝', desc: 'Reach a ×5 combo.', reward: 25, progress: () => [save.stats.bestCombo, 5] },
  { id: 'clean10', group: 'Play', title: 'Unaided', desc: 'Clear 10 boards without hints or shuffles.', reward: 20, progress: () => [save.stats.cleanClears, 10] },
  { id: 'fast25', group: 'Play', title: 'Swift brush', desc: 'Beat par time on 25 boards.', reward: 30, progress: () => [save.stats.fastClears, 25] },
  { id: 'fever', group: 'Play', title: 'Full bloom', native: '만개 · 満開', desc: 'Trigger Fever with a ×5 combo.', reward: 15, progress: () => [Math.min(save.stats.bestCombo, 5), 5] },
  { id: 'rush5k', group: 'Play', title: 'Quick hands', desc: 'Score 5,000 in a Rush run.', reward: 15, progress: () => [save.rush.best, 5000] },
  { id: 'rush15k', group: 'Play', title: 'Lightning brush', desc: 'Score 15,000 in a Rush run.', reward: 40, progress: () => [save.rush.best, 15000] },
  { id: 'yaku1', group: 'Play', title: 'A set on the board', native: '약 · 役', desc: 'Clear all the cards of a card set (yaku) within one board.', reward: 15, progress: () => [Math.min(1, save.yakuSeen.length), 1] },
  { id: 'yaku5', group: 'Play', title: 'Set collector', desc: 'Complete five different card sets on boards.', reward: 40, progress: () => [save.yakuSeen.length, 5] },
  { id: 'zen10', group: 'Play', title: 'Still water', native: '禅', desc: 'Finish 10 Zen boards.', reward: 15, progress: () => [save.stats.zenBoards, 10] },

  // Journey
  { id: 'spring', group: 'Journey', title: 'Spring', native: '봄 · 春', desc: 'Finish the Spring chapter.', reward: 20, progress: () => [Math.min(cleared(), 12), 12] },
  { id: 'summer', group: 'Journey', title: 'Summer', native: '여름 · 夏', desc: 'Finish the Summer chapter.', reward: 25, progress: () => [Math.min(cleared(), 24), 24] },
  { id: 'autumn', group: 'Journey', title: 'Autumn', native: '가을 · 秋', desc: 'Finish the Autumn chapter.', reward: 30, progress: () => [Math.min(cleared(), 36), 36] },
  { id: 'winter', group: 'Journey', title: 'Winter', native: '겨울 · 冬', desc: 'Finish the Winter chapter — a full year.', reward: 50, progress: () => [Math.min(cleared(), 48), 48] },
  { id: 'stars100', group: 'Journey', title: 'Hundred blossoms', desc: 'Earn 100 blossoms in Journey.', reward: 40, progress: () => [starsTotal(), 100] },
  { id: 'perfect12', group: 'Journey', title: 'Twelve perfect boards', desc: 'Earn all three blossoms on 12 levels.', reward: 30, progress: () => [threeStarLevels(), 12] },

  // Daily
  { id: 'daily1', group: 'Daily', title: 'Good morning', desc: 'Solve a Daily Jjak.', reward: 5, progress: () => [Math.min(1, Object.keys(save.daily.results).length), 1] },
  { id: 'streak3', group: 'Daily', title: 'Three days', desc: 'Reach a 3-day streak.', reward: 15, progress: () => [Math.max(save.daily.best, liveStreak()), 3] },
  { id: 'streak7', group: 'Daily', title: 'A whole week', desc: 'Reach a 7-day streak.', reward: 35, progress: () => [Math.max(save.daily.best, liveStreak()), 7] },
  { id: 'streak30', group: 'Daily', title: 'A full moon', native: '보름 · 満月', desc: 'Reach a 30-day streak.', reward: 100, progress: () => [Math.max(save.daily.best, liveStreak()), 30] },

  // Album sets (real yaku)
  { id: 'month', group: 'Album sets', title: 'A full flower', desc: 'Collect all four cards of one flower.', reward: 10, progress: () => [Math.min(1, fullMonths()), 1] },
  { id: 'hongdan', group: 'Album sets', title: 'Red poetry ribbons', native: '홍단 · 赤短', desc: 'Collect the three poetry ribbons of Pine, Plum and Cherry.', cards: [2, 6, 10], reward: 20, progress: () => [has([2, 6, 10]), 3] },
  { id: 'cheongdan', group: 'Album sets', title: 'Blue ribbons', native: '청단 · 青短', desc: 'Collect the blue ribbons of Peony, Chrysanthemum and Maple.', cards: [22, 34, 38], reward: 20, progress: () => [has([22, 34, 38]), 3] },
  { id: 'chodan', group: 'Album sets', title: 'Plain red ribbons', native: '초단 · 草短', desc: 'Collect the red ribbons of Wisteria, Iris and Bush clover.', cards: [14, 18, 26], reward: 20, progress: () => [has([14, 18, 26]), 3] },
  { id: 'godori', group: 'Album sets', title: 'Five birds', native: '고도리', desc: 'Korea’s Godori: the warbler, the cuckoo and the geese.', cards: [7, 15, 30], reward: 25, progress: () => [has([7, 15, 30]), 3] },
  { id: 'inoshikacho', group: 'Album sets', title: 'Boar, deer, butterfly', native: '猪鹿蝶', desc: 'Japan’s Ino-Shika-Chō set.', cards: [27, 39, 23], reward: 25, progress: () => [has([27, 39, 23]), 3] },
  { id: 'tsukimi', group: 'Album sets', title: 'Moon-viewing sake', native: '月見酒', desc: 'The full moon and the sake cup.', cards: [31, 35], reward: 15, progress: () => [has([31, 35]), 2] },
  { id: 'hanami', group: 'Album sets', title: 'Blossom-viewing sake', native: '花見酒', desc: 'The cherry curtain and the sake cup.', cards: [11, 35], reward: 15, progress: () => [has([11, 35]), 2] },
  { id: 'ogwang', group: 'Album sets', title: 'Five brights', native: '오광 · 五光', desc: 'Crane, curtain, moon, rain and phoenix.', cards: [3, 11, 31, 43, 47], reward: 50, progress: () => [has([3, 11, 31, 43, 47]), 5] },
  { id: 'album48', group: 'Album sets', title: 'The whole deck', native: '화투 · 花札', desc: 'Collect all 48 cards.', reward: 100, progress: () => [save.album.length, 48] },

  // Flower Path
  { id: 'rank10', group: 'Flower Path', title: 'In bud', native: '꽃봉오리 · 蕾', desc: 'Reach rank 10 on the Flower Path.', reward: 20, progress: () => [pathRank(), 10] },
  { id: 'rank50', group: 'Flower Path', title: 'Garden keeper', native: '정원지기 · 庭守', desc: 'Reach rank 50 on the Flower Path.', reward: 50, progress: () => [pathRank(), 50] },
  { id: 'rank100', group: 'Flower Path', title: 'Master of flowers', native: '꽃의 명인 · 花の名人', desc: 'Reach rank 100, the end of the Flower Path.', reward: 100, progress: () => [pathRank(), 100] },
  { id: 'missions10', group: 'Flower Path', title: 'Small errands', desc: 'Complete 10 daily missions.', reward: 20, progress: () => [save.meta.stats.missions, 10] },
  { id: 'missions100', group: 'Flower Path', title: 'A hundred errands', desc: 'Complete 100 daily missions.', reward: 60, progress: () => [save.meta.stats.missions, 100] },
  { id: 'weekly1', group: 'Flower Path', title: 'A week well spent', desc: 'Open a weekly chest.', reward: 20, progress: () => [Math.min(1, save.meta.stats.weeks), 1] },
  { id: 'chest36', group: 'Flower Path', title: 'Every blossom', desc: 'Open a 36-blossom star chest.', reward: 30, progress: () => [Math.min(1, save.meta.stats.fullChests), 1] },
  { id: 'foil1', group: 'Flower Path', title: 'Gold leaf', native: '금박 · 金箔', desc: 'Find a gold-leaf card.', reward: 15, progress: () => [Math.min(1, save.meta.foil.length), 1] },
  { id: 'foil12', group: 'Flower Path', title: 'A gilded dozen', desc: 'Find 12 gold-leaf cards.', reward: 40, progress: () => [save.meta.foil.length, 12] },
  { id: 'bonus2', group: 'Flower Path', title: 'Lucky pair', native: '보너스패', desc: 'Pair the two lucky bonus cards.', reward: 15, progress: () => [save.meta.bonus.length, 2] },
  { id: 'tea1', group: 'Flower Path', title: 'Warm tea', native: '차 · 茶', desc: 'Keep your Daily streak with a cup of Warm tea.', reward: 10, progress: () => [Math.min(1, save.meta.stats.teaUsed), 1] },
];

/**
 * A thank-you seal for Supporter pack owners. It joins the seal book only once
 * owned, so finishing the book never needs a purchase.
 */
const SUPPORTER_SEAL: Seal = { id: 'supporter', group: 'Flower Path', title: 'Supporter', native: '후원 · 応援', desc: 'Thank you for supporting Jjak.', reward: 25, progress: () => [save.meta.supporter ? 1 : 0, 1] };

export const sealDone = (s: Seal) => {
  const [a, b] = s.progress();
  return a >= b;
};

/** Award any newly completed seals; returns them (caller shows a toast). */
export function checkSeals(): Seal[] {
  if (save.meta.supporter && !SEALS.includes(SUPPORTER_SEAL)) SEALS.push(SUPPORTER_SEAL);
  const fresh = SEALS.filter((s) => !save.seals.includes(s.id) && sealDone(s));
  for (const s of fresh) {
    save.seals.push(s.id);
    save.petals += s.reward;
  }
  if (fresh.length) persist();
  return fresh;
}

/** "Seal earned: A" / "Seals earned: A and B" / "Seals earned: A, B and 5 more" — short enough for a toast. */
export function sealToast(won: { title: string }[]): string {
  const t = won.map((w) => w.title);
  if (t.length <= 1) return `Seal earned: ${t[0] ?? ''}`;
  if (t.length === 2) return `Seals earned: ${t[0]} and ${t[1]}`;
  return `Seals earned: ${t[0]}, ${t[1]} and ${t.length - 2} more`;
}
