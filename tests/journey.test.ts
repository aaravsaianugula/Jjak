import { describe, expect, it } from 'vitest';
import { stampDate, stampShape, stampSvg } from '../src/art/stamp';
import { ALL_CARD_IDS, BONUS_IDS, cardDef, monthDef } from '../src/data/deck';
import { ROUTE, ROUTE_CHAPTERS, ROUTE_LEVELS, chapterFirstLevel, festivalTitle, placeLine, routeOf } from '../src/data/route';
import { EMPTY, STONE, type Board, cardsLeft, isCard, isGate, isInk, isTerrain, monthOf } from '../src/engine/board';
import { generateBoard, reshuffle } from '../src/engine/generate';
import {
  CHAPTERS,
  type LevelSpec,
  MECHANIC_INTRO,
  buildBoard,
  chapterOf,
  journeyLevel,
  maxStones,
  mechanicLabel,
  pickKnots,
  windOf,
} from '../src/engine/levels';
import { type Wind, applyGravity, findMove } from '../src/engine/moves';
import { createRng } from '../src/engine/rng';
import { LUCKY_PETALS, LUCKY_SCORE, Session } from '../src/engine/session';
import { possibleYaku, newYaku } from '../src/engine/yaku';
import { defaultEndless, defaultJourney, hydrateJourney } from '../src/services/save-journey';

const grid = (rows: string[]): Board => {
  // '.' empty, '#' stone, digit/letter = month (card id = month * 4)
  const cells = rows.flatMap((row) => [...row].map((ch) => (ch === '.' ? EMPTY : ch === '#' ? STONE : Number.parseInt(ch, 36) * 4)));
  return { rows: rows.length, cols: rows[0].length, cells };
};
const spec = (over: Partial<LevelSpec> = {}): LevelSpec => ({
  mode: 'journey', number: 99, seed: 'test', rows: 1, cols: 4, stones: 0, months: 2, variants: true, par: 60, gravity: false, snow: 0, ...over,
});

/** Play a session to the end, taking a random legal move each turn. */
function playOut(s: Session, seed: string, guard = 500): void {
  const rng = createRng(seed);
  let t = 0;
  for (let k = 0; !s.done && k < guard; k++) {
    const moves: [number, number][] = [];
    const locked = s.locked;
    for (let i = 0; i < s.board.cells.length; i++) {
      if (!isCard(s.board.cells[i]) || locked.has(i)) continue;
      for (let j = i + 1; j < s.board.cells.length; j++) {
        if (!isCard(s.board.cells[j]) || locked.has(j) || monthOf(s.board.cells[i]) !== monthOf(s.board.cells[j])) continue;
        moves.push([i, j]);
      }
    }
    // Prefer pairs that actually connect; fall back to the engine's own move.
    rng.shuffle(moves);
    let done = false;
    for (const [a, b] of moves.slice(0, 12)) {
      s.tap(a, (t += 300));
      const r = s.tap(b, (t += 300));
      if (r.kind === 'match') {
        done = true;
        break;
      }
      if (s.selected >= 0) s.tap(s.selected, (t += 1)); // clear a left-over selection
    }
    if (done) continue;
    const m = s.findMove();
    expect(m, `no move on ${s.spec.seed} after ${s.pairsMade} pairs`).not.toBeNull();
    s.tap(m![0], (t += 300));
    expect(s.tap(m![1], (t += 300)).kind).toBe('match');
  }
}

describe('the Flower Road route', () => {
  it('has 50 chapters with unique ids and names', () => {
    expect(ROUTE.length).toBe(50);
    expect(ROUTE_CHAPTERS).toBe(50);
    expect(ROUTE_LEVELS).toBe(600);
    expect(new Set(ROUTE.map((c) => c.id)).size).toBe(50);
    expect(new Set(ROUTE.map((c) => c.en)).size).toBe(50);
    expect(new Set(ROUTE.map((c) => c.ja)).size).toBe(50);
  });

  it('keeps the season cycle (chapter i plays in season i % 4)', () => {
    ROUTE.forEach((c, i) => expect(c.season).toBe(i % 4));
    // chapterOf (the season object) still lines up with the route
    for (let i = 0; i < 60; i++) expect(chapterOf(i * 12 + 1).id).toBe(CHAPTERS[ROUTE[i % 50].season].id);
  });

  it('roughly alternates Korea and Japan and every field is filled in', () => {
    expect(ROUTE.filter((c) => c.country === 'KR').length).toBe(25);
    expect(ROUTE.filter((c) => c.country === 'JP').length).toBe(25);
    for (let i = 2; i < ROUTE.length; i++) {
      const same = ROUTE[i].country === ROUTE[i - 1].country && ROUTE[i].country === ROUTE[i - 2].country;
      expect(same, `three in a row at ${ROUTE[i].en}`).toBe(false);
    }
    // Each season visits both countries.
    for (let s = 0; s < 4; s++) expect(new Set(ROUTE.filter((c) => c.season === s).map((c) => c.country)).size).toBe(2);
    for (const c of ROUTE) {
      expect(c.ko).toMatch(/[가-힣]/); // Hangul
      expect(c.ja).toMatch(/[぀-ヿ㐀-鿿]/); // Kanji / Hanja (or kana for Seoul)
      expect(c.accent).toMatch(/^#[0-9a-f]{6}$/i);
      expect(c.postcard.length).toBeGreaterThan(30);
      expect(c.postcard.length).toBeLessThan(130);
      expect(c.postcard.endsWith('.')).toBe(true);
      expect(['basics', 'stones', 'leaves', 'snow', 'lucky', 'knots', 'wind', 'gates', 'fences', 'torii', 'streams', 'seals', 'ink', 'mix']).toContain(c.focus);
    }
  });

  it('includes the places the plan names', () => {
    const names = ROUTE.map((c) => c.en).join(' | ');
    for (const p of ['Seoul', 'Busan', 'Jeju', 'Gyeongju', 'Jeonju', 'Andong', 'Damyang', 'Boseong', 'Gangneung', 'Seoraksan', 'Tongyeong', 'Yeosu', 'Suwon', 'Jirisan',
      'Kyoto', 'Nara', 'Yoshino', 'Kamakura', 'Nikko', 'Kanazawa', 'Hakone', 'Sapporo', 'Hakodate', 'Shirakawa-go', 'Takayama', 'Uji', 'Miyajima', 'Matsushima', 'Naoshima', 'Beppu', 'Okinawa', 'Fuji Five Lakes']) {
      expect(names).toContain(p);
    }
  });

  it('maps levels to places, and keeps going as Wanderer years after 600', () => {
    expect(routeOf(1).chapter.id).toBe('gyeongju');
    expect(routeOf(12).slot).toBe(11);
    expect(routeOf(13).chapter.id).toBe('kamakura');
    expect(routeOf(600).chapter.id).toBe('okinawa');
    expect(routeOf(600).year).toBe(0);
    expect(routeOf(601).chapter.id).toBe('gyeongju');
    expect(routeOf(601).year).toBe(1);
    expect(routeOf(1301).year).toBe(2);
    expect(chapterFirstLevel(2)).toBe(25);
    expect(chapterFirstLevel(0, 1)).toBe(601);
    expect(placeLine(ROUTE[0])).toBe('Gyeongju · 경주 · 慶州');
    expect(festivalTitle(ROUTE[0])).toBe('Gyeongju festival board');
  });
});

describe('journey level curve', () => {
  it('keeps the tutorial (1–5) and the level-6 variants lesson', () => {
    const shapes = [[4, 4, 4], [4, 4, 6], [5, 4, 8], [6, 4, 10], [6, 5, 12]];
    shapes.forEach(([rows, cols, months], i) => {
      const sp = journeyLevel(i + 1);
      expect([sp.rows, sp.cols, sp.months, sp.variants, sp.stones, sp.snow, sp.gravity]).toEqual([rows, cols, months, false, 0, 0, false]);
    });
    const six = journeyLevel(6);
    expect([six.rows, six.cols, six.variants, six.stones, six.snow, six.gravity, six.knots ?? 0, !!six.lucky]).toEqual([7, 6, true, 0, 0, false, 0, false]);
    expect(six.seed).toBe('journey-6');
  });

  it('gives a valid, phone-sized board for every level 1..700', () => {
    for (let n = 1; n <= 700; n++) {
      const sp = journeyLevel(n);
      expect(sp.number).toBe(n);
      // 8 rows × 7 columns at most (8×7 only on late peak and festival boards): tappable at 360 wide.
      expect(sp.rows).toBeLessThanOrEqual(8);
      expect(sp.cols).toBeLessThanOrEqual(sp.festival || routeOf(n).slot === 10 ? 7 : 6);
      expect(sp.stones).toBeLessThanOrEqual(maxStones(sp.rows, sp.cols));
      expect(sp.stones % 2).toBe(0);
      expect((sp.rows * sp.cols - sp.stones) % 2).toBe(0);
      expect(sp.months).toBeGreaterThanOrEqual(1);
      expect(sp.months).toBeLessThanOrEqual(12);
      expect(sp.par).toBeGreaterThan(0);
      expect(sp.snow).toBeGreaterThanOrEqual(0);
      expect(sp.knots ?? 0).toBeGreaterThanOrEqual(0);
      expect(!!windOf(sp) && sp.snow > 0).toBe(false); // sliding never mixes with snow
      expect(!!sp.festival).toBe(n % 12 === 0);
    }
  });

  it('closes every chapter with a big festival board (lucky cards once they are known)', () => {
    for (let ch = 0; ch < 60; ch++) {
      const sp = journeyLevel((ch + 1) * 12);
      expect(sp.festival).toBe(true);
      expect(sp.rows * sp.cols).toBeGreaterThanOrEqual(48);
      expect(!!sp.lucky).toBe(ch >= MECHANIC_INTRO.lucky);
      const regular = journeyLevel((ch + 1) * 12 - 1);
      expect(sp.par).toBeGreaterThan(regular.par - 20);
    }
  });

  it('introduces each idea in its own chapter, never earlier', () => {
    const first: Record<string, number> = {};
    for (let n = 1; n <= 600; n++) {
      const sp = journeyLevel(n);
      const w = windOf(sp);
      const seen = { stones: sp.stones > 0, leaves: w === 'down', snow: sp.snow > 0, lucky: !!sp.lucky, knots: (sp.knots ?? 0) > 0, wind: !!w && w !== 'down', gates: (sp.gates ?? 0) > 0, fences: (sp.fences ?? 0) > 0 };
      for (const [k, on] of Object.entries(seen)) if (on && first[k] == null) first[k] = Math.floor((n - 1) / 12);
    }
    expect(first).toEqual({ stones: 1, leaves: 2, snow: 3, lucky: 4, knots: 6, wind: 8, gates: 10, fences: 13 });
    // The first board of each new idea shows it alone, so its tip is the only lesson.
    for (const [m, ch] of Object.entries(MECHANIC_INTRO)) {
      const n = ch * 12 + 2;
      expect(mechanicLabel(journeyLevel(n)).toLowerCase(), `level ${n} for ${m}`).toBeTruthy();
    }
    expect(windOf(journeyLevel(98))).toBe('right');
    expect(journeyLevel(74).knots).toBeGreaterThan(0);
  });

  it('varies inside every chapter and grows across the road', () => {
    for (let ch = 1; ch < 50; ch++) {
      const specs = Array.from({ length: 12 }, (_, s) => journeyLevel(ch * 12 + s + 1));
      expect(new Set(specs.map((s) => `${s.rows}x${s.cols}`)).size, `chapter ${ch + 1}`).toBeGreaterThanOrEqual(3);
      expect(new Set(specs.map((s) => mechanicLabel(s))).size, `chapter ${ch + 1}`).toBeGreaterThanOrEqual(2);
    }
    const cards = (from: number) => Array.from({ length: 48 }, (_, i) => journeyLevel(from + i)).reduce((a, s) => a + s.rows * s.cols - s.stones, 0);
    expect(cards(553)).toBeGreaterThan(cards(13));
  });

  it('Wanderer years reuse the road with a harder curve', () => {
    let harder = 0;
    for (let n = 13; n <= 600; n++) {
      const a = journeyLevel(n);
      const b = journeyLevel(n + 600);
      expect(routeOf(n).chapter.id).toBe(routeOf(n + 600).chapter.id);
      const load = (s: LevelSpec) => s.stones + s.snow + (s.knots ?? 0) + s.rows * s.cols;
      if (load(b) >= load(a)) harder++;
    }
    expect(harder / 588).toBeGreaterThan(0.8);
  });

  it('is deterministic: the same level always gives the same board', () => {
    for (const n of [1, 6, 14, 26, 38, 50, 74, 98, 108, 300, 600, 650]) {
      expect(journeyLevel(n)).toEqual(journeyLevel(n));
      expect(buildBoard(journeyLevel(n)).cells).toEqual(buildBoard(journeyLevel(n)).cells);
      const a = new Session(journeyLevel(n), 0);
      const b = new Session(journeyLevel(n), 0);
      expect([...a.knots]).toEqual([...b.knots]);
      expect([...a.hidden]).toEqual([...b.hidden]);
    }
  });

  it('builds every board 1..700 with the right cards, stones and lucky pair', () => {
    for (let n = 1; n <= 700; n++) {
      const sp = journeyLevel(n);
      const b = buildBoard(sp);
      expect(cardsLeft(b) + b.cells.filter((v) => v === STONE || isGate(v) || isTerrain(v) || isInk(v)).length).toBe(sp.rows * sp.cols);
      const counts = new Map<number, number>();
      for (const v of b.cells) if (isCard(v)) counts.set(monthOf(v), (counts.get(monthOf(v)) ?? 0) + 1);
      for (const c of counts.values()) expect(c % 2).toBe(0);
      const bonus = b.cells.filter((v) => v >= 48);
      expect(bonus.sort()).toEqual(sp.lucky ? [48, 49] : []);
    }
  });

  it('greedy play finishes every Journey board 1..700 (wind, knots, snow, stones, lucky)', () => {
    for (let n = 1; n <= 700; n++) {
      const s = new Session(journeyLevel(n), 0);
      let t = 0;
      for (let guard = 0; !s.done && guard < 400; guard++) {
        const m = s.findMove();
        expect(m, `stuck on level ${n}`).not.toBeNull();
        s.tap(m![0], (t += 700));
        expect(s.tap(m![1], (t += 700)).kind).toBe('match');
      }
      expect(s.done, `level ${n}`).toBe(true);
    }
  });
});

describe('wind (gravity with a direction)', () => {
  const run = (rows: string[], dir: Wind) => {
    const b = grid(rows);
    const moves = applyGravity(b, dir);
    return { b, moves };
  };

  it("keeps 'down' as the default (falling leaves)", () => {
    const { b } = run(['1.', '.2', '#.', '3.', '..'], 'down');
    expect(b.cells).toEqual(grid(['..', '1.', '#.', '..', '32']).cells);
    const c = grid(['1.', '.2', '#.', '3.', '..']);
    applyGravity(c);
    expect(c.cells).toEqual(b.cells);
  });

  it('blows left, right and up, with stones as walls', () => {
    expect(run(['.1.2', '3#.4'], 'left').b.cells).toEqual(grid(['12..', '3#4.']).cells);
    expect(run(['1.2.', '3.#4'], 'right').b.cells).toEqual(grid(['..12', '.3#4']).cells);
    expect(run(['..', '1#', '.2', '3.'], 'up').b.cells).toEqual(grid(['1.', '3#', '.2', '..']).cells);
  });

  it('reports each move once, from → to', () => {
    const { b, moves } = run(['.1.2'], 'left');
    expect(moves).toEqual([[1, 0], [3, 1]]);
    expect(b.cells.filter(isCard).length).toBe(2);
  });

  it('a wind board slides cards after a pair, and snow/knots travel with them', () => {
    // Row 1 is [5 4 4 5 6 6]; wind blows right. Pairing the 4s lets the first 5 drift two cells.
    const b = grid(['112332', '544566']);
    const s = new Session(spec({ rows: 2, cols: 6, months: 6, gravity: 'right', seed: 'w' }), 0, b);
    s.knots.clear();
    s.hidden.clear();
    s.knots.add(6); // the 5 at row 1, col 0
    s.tap(7, 0);
    const r = s.tap(8, 10);
    expect(r.kind).toBe('match');
    if (r.kind !== 'match') return;
    expect(r.moved).toEqual([[6, 8]]);
    expect(s.board.cells.slice(6)).toEqual([EMPTY, EMPTY, 20, 20, 24, 24]);
    // The knot travelled with its card (6 → 8) and came loose there, on the bottom edge.
    expect(r.untied).toEqual([8]);
    expect(s.knots.size).toBe(0);
  });

  it('auto-reshuffles on wind boards never cost the no-assist blossom', () => {
    const s = new Session(journeyLevel(98), 0);
    s.windShuffles = s.autoShuffles = 1;
    s.finishedAt = 10;
    expect(s.stars().noAssist).toBe(true);
  });
});

describe('knots (매듭)', () => {
  it('pickKnots ties only walled-in cards, apart when possible, deterministically', () => {
    const sp = journeyLevel(74);
    const b = buildBoard(sp);
    const k = pickKnots(b, sp.knots ?? 0, sp.seed);
    expect(k.size).toBe(sp.knots);
    expect([...k]).toEqual([...pickKnots(b, sp.knots ?? 0, sp.seed)]);
    for (const i of k) {
      const r = Math.floor(i / b.cols);
      const c = i % b.cols;
      expect(r > 0 && c > 0 && r < b.rows - 1 && c < b.cols - 1).toBe(true);
      for (const n of [i - 1, i + 1, i - b.cols, i + b.cols]) expect(k.has(n)).toBe(false);
    }
  });

  it('a knotted card is visible but taps report "knotted", and the selection stays', () => {
    const b = grid(['1221', '3443', '5665']);
    const s = new Session(spec({ rows: 3, cols: 4, months: 6 }), 0, b);
    s.knots.add(5); // a 4 in the middle row
    expect(s.tap(5, 0)).toEqual({ kind: 'knotted', cell: 5 });
    expect(s.tap(1, 0).kind).toBe('select');
    expect(s.tap(5, 0).kind).toBe('knotted');
    expect(s.selected).toBe(1);
  });

  it('unties when an orthogonal neighbour empties, or at the board edge', () => {
    // The 4 at (1,1) is walled in by cards until the 3 on its left is cleared.
    const b = grid(['22..', '345.', '36.5', '46..']);
    const s = new Session(spec({ rows: 4, cols: 4, months: 5 }), 0, b);
    s.hidden.clear();
    s.knots.clear();
    s.knots.add(5);
    // pair the 3s at (1,0) and (2,0): (1,0) is a neighbour of the knot
    s.tap(4, 0);
    const r = s.tap(8, 10);
    expect(r.kind).toBe('match');
    if (r.kind === 'match') expect(r.untied).toEqual([5]);
    expect(s.knots.has(5)).toBe(false);
  });

  it('findMove and hints never pick a tied card', () => {
    for (let n = 73; n <= 132; n++) {
      const s = new Session(journeyLevel(n), 0);
      if (!s.knots.size) continue;
      const m = s.hint();
      expect(m).not.toBeNull();
      for (const i of m!) expect(s.knots.has(i)).toBe(false);
      const f = findMove(s.board, s.locked);
      for (const i of f!) expect(s.knots.has(i) || s.hidden.has(i)).toBe(false);
    }
  });

  it('a board stuck only because of knots unties them all, for free', () => {
    // After pairing the 1s, only the 2s remain and one of them is tied (in a pocket of stones).
    const b = grid(['11#.', '#2#.', '#2#.', '.#..']);
    const s = new Session(spec({ rows: 4, cols: 4, months: 2 }), 0, b);
    s.hidden.clear();
    s.knots.clear();
    s.knots.add(9); // the lower 2, walled by stones on three sides and a card above
    s.tap(0, 0);
    const r = s.tap(1, 10);
    expect(r.kind).toBe('match');
    if (r.kind !== 'match') return;
    expect(r.untied).toEqual([9]);
    expect(r.reshuffled).toBe(false);
    expect(s.autoShuffles).toBe(0);
    expect(s.findMove()).not.toBeNull();
  });

  it('a session never starts without an opening move', () => {
    for (let n = 1; n <= 700; n++) {
      const s = new Session(journeyLevel(n), 0);
      expect(s.findMove(), `level ${n}`).not.toBeNull();
    }
  });
});

describe('lucky cards (48/49)', () => {
  it('pair with each other, score a bonus, and count for the petal gift', () => {
    const b: Board = { rows: 1, cols: 4, cells: [48, 49, 0, 1] };
    const s = new Session(spec({ lucky: true }), 0, b);
    s.tap(0, 100);
    const r = s.tap(1, 100);
    expect(r.kind).toBe('match');
    if (r.kind !== 'match') return;
    expect(r.lucky).toBe(true);
    expect(r.gained).toBe(100 + LUCKY_SCORE);
    expect(s.luckyPairs).toBe(1);
    s.tap(2, 20000);
    const r2 = s.tap(3, 20000);
    expect(r2.kind === 'match' && r2.lucky).toBe(false);
    expect(s.done).toBe(true);
    expect(LUCKY_PETALS).toBe(10);
  });

  it("don't break card sets, the album, or card lookups", () => {
    expect(possibleYaku([48, 49, 3, 11])).toEqual([]);
    expect(newYaku(new Set([48, 49]), new Set())).toEqual([]);
    expect(ALL_CARD_IDS.includes(48)).toBe(false);
    for (const id of BONUS_IDS) {
      expect(cardDef(id).en).toMatch(/Lucky/);
      expect(monthDef(id).index).toBe(12);
    }
    // Reshuffling a lucky board keeps the bonus pair as a pair.
    const b = buildBoard(journeyLevel(60));
    const after = reshuffle(b, createRng('lucky'));
    expect(after.cells.filter((v) => v >= 48).sort()).toEqual([48, 49]);
  });
});

describe('solvability fuzz across the mechanics', () => {
  it('random boards with wind, knots, snow, stones and lucky cards always finish', () => {
    const shapes: [number, number][] = [[6, 4], [6, 5], [7, 4], [6, 6], [8, 5], [7, 6], [8, 6]];
    const winds: (Wind | false)[] = [false, 'down', 'left', 'right', 'up'];
    let reshuffles = 0;
    for (let k = 0; k < 240; k++) {
      const rng = createRng(`fuzz-mech-${k}`);
      const [rows, cols] = shapes[k % shapes.length];
      const wind = winds[rng.int(winds.length)];
      const stones = 2 * rng.int(maxStones(rows, cols) / 2 + 1);
      const pairs = (rows * cols - stones) / 2;
      const sp = spec({
        rows, cols, stones, seed: `fuzz-mech-${k}`, months: 12,
        gravity: wind,
        snow: wind ? 0 : rng.int(Math.round(pairs * 0.5)),
        knots: rng.int(Math.round(pairs * 0.3) + 1),
        lucky: rng.next() < 0.5,
      });
      const s = new Session(sp, 0);
      expect(s.findMove(), `opening move, fuzz ${k}`).not.toBeNull();
      playOut(s, `play-${k}`);
      expect(s.done, `fuzz ${k}`).toBe(true);
      reshuffles += s.autoShuffles;
    }
    // Dead ends happen, but rarely.
    expect(reshuffles / 240).toBeLessThan(0.5);
  });

  it('reshuffle escapes a dead end that no re-deal of the same cells can fix', () => {
    // A card in a stone pocket whose partner sits behind the stones (found on a real board).
    const cells = new Array(48).fill(EMPTY);
    for (const i of [10, 13, 15, 32, 34, 39]) cells[i] = STONE;
    cells[33] = 35;
    cells[44] = 32;
    const b: Board = { rows: 8, cols: 6, cells };
    expect(findMove(b)).toBeNull();
    const out = reshuffle(b, createRng('pocket'));
    expect(findMove(out)).not.toBeNull();
    expect(out.cells.filter(isCard).sort()).toEqual([32, 35]);
  });

  it('a shuffle that re-deals onto other cells says so and frees snow and knots (they cannot follow a card)', () => {
    const cells = new Array(48).fill(EMPTY);
    for (const i of [10, 13, 15, 32, 34, 39]) cells[i] = STONE;
    cells[33] = 35;
    cells[44] = 32;
    const s = new Session(spec({ rows: 8, cols: 6, seed: 'pocket' }), 0, { rows: 8, cols: 6, cells });
    s.hidden.add(33);
    s.knots.add(44);
    s.shuffle();
    expect(s.relaid).toBe(true);
    expect(s.hidden.size + s.knots.size).toBe(0);
    // Every lock left refers to a cell that still holds a card.
    for (const i of [...s.hidden, ...s.knots]) expect(isCard(s.board.cells[i])).toBe(true);
    expect(s.findMove()).not.toBeNull();
  });

  it('solvable-by-construction still holds for boards built with lucky cards', () => {
    for (let k = 0; k < 120; k++) {
      const rng = createRng(`luckgen-${k}`);
      const rows = 6;
      const cols = 4 + (k % 3);
      const cards: number[] = [48, 49];
      for (let p = 1; p < (rows * cols) / 2; p++) {
        const m = rng.int(12);
        cards.push(m * 4 + rng.int(4), m * 4 + rng.int(4));
      }
      const b = generateBoard({ rows, cols, cards }, rng);
      expect(findMove(b)).not.toBeNull();
    }
  });
});

describe('journey save slice and stamps', () => {
  it('hydrates old and broken slices', () => {
    expect(hydrateJourney(undefined)).toEqual(defaultJourney());
    expect(hydrateJourney({ v: 1 })).toEqual({ v: 1, stamps: {}, luckyPairs: 0, luckyPetals: 0, yearStamps: {}, revealed: false, endless: defaultEndless() });
    const h = hydrateJourney({ v: 1, stamps: { gyeongju: '2026-10-07', bad: 3 }, luckyPairs: -2, luckyPetals: 30 });
    expect(h.stamps).toEqual({ gyeongju: '2026-10-07' });
    expect(h.luckyPairs).toBe(0);
    expect(h.luckyPetals).toBe(30);
  });

  it('draws a stamp for every place, in four shapes, with the name and date', () => {
    const shapes = new Set<string>();
    ROUTE.forEach((c, i) => {
      shapes.add(stampShape(i));
      const earned = stampSvg(c, i, '2026-10-07');
      expect(earned).toContain('2026.10.07');
      expect(earned).toContain(c.ko);
      for (const ch of c.ja.replace(/\s+/g, '')) expect(earned).toContain(ch);
      const empty = stampSvg(c, i, null);
      expect(empty).toContain('is-empty');
      expect(empty).not.toContain('2026');
    });
    expect([...shapes].sort()).toEqual(['gourd', 'rect', 'round', 'square']);
    expect(stampDate('2026-01-02')).toBe('2026.01.02');
  });
});

describe('recordClear: lucky petals and passport stamps', () => {
  it('credits lucky petals and stamps the place on the first festival clear only (no farming on replays)', async () => {
    const { save } = await import('../src/services/storage');
    const { recordClear, syncStamps } = await import('../src/services/progress');
    save.journey = defaultJourney();
    save.stars = {};
    save.level = 12;
    save.petals = 0;
    const play = () => {
      const s = new Session(journeyLevel(12), 0, { rows: 1, cols: 4, cells: [48, 49, 0, 1] });
      s.tap(0, 10);
      s.tap(1, 20);
      s.tap(2, 30);
      s.tap(3, 40);
      expect(s.done).toBe(true);
      return recordClear(s);
    };
    const first = play();
    expect(first.lucky).toBe(LUCKY_PETALS);
    expect(first.stamp?.id).toBe('gyeongju');
    expect(save.journey.stamps.gyeongju).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(save.journey.luckyPairs).toBe(1);
    expect(save.journey.luckyPetals).toBe(LUCKY_PETALS);
    expect(save.petals).toBeGreaterThanOrEqual(first.petals + LUCKY_PETALS);
    const again = play();
    expect(again.stamp).toBeUndefined(); // one stamp per place
    // Replays can't be farmed: the lucky pair still counts, but petals came with the first clear.
    expect(again.lucky).toBeUndefined();
    expect(save.journey.luckyPairs).toBe(2);
    expect(save.journey.luckyPetals).toBe(LUCKY_PETALS);
    // Older saves: festival boards cleared before stamps existed get theirs back.
    save.stars[24] = 2;
    expect(syncStamps()).toBe(1);
    expect(save.journey.stamps.kamakura).toBeTruthy();
    expect(syncStamps()).toBe(0);
  });
});

describe('past level 600: Wanderer stamps', () => {
  it('stamps each place once per year on the endless road, apart from the first-pass passport', async () => {
    const { save } = await import('../src/services/storage');
    const { recordClear } = await import('../src/services/progress');
    save.journey = defaultJourney();
    save.stars = {};
    save.level = 612;
    const play = (n: number) => {
      const s = new Session({ ...journeyLevel(n), number: n }, 0, { rows: 1, cols: 2, cells: [0, 1] });
      s.tap(0, 10);
      s.tap(1, 20);
      return recordClear(s);
    };
    const r = play(612); // Gyeongju, year 1
    expect(r.stamp).toMatchObject({ id: 'gyeongju', year: 1 });
    expect(save.journey.yearStamps['gyeongju@1']).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(save.journey.stamps.gyeongju).toBeUndefined();
    expect(play(612).stamp).toBeUndefined();
    expect(play(1212).stamp).toMatchObject({ id: 'gyeongju', year: 2 });
  });

  it('hydrates the endless-road fields on older saves', () => {
    const j = hydrateJourney({ v: 1, stamps: { gyeongju: '2026-10-01' } });
    expect(j.yearStamps).toEqual({});
    expect(j.revealed).toBe(false);
    expect(hydrateJourney({ revealed: 'yes', yearStamps: { 'a@1': 3 } })).toMatchObject({ revealed: false, yearStamps: {} });
  });
});
