/**
 * The Practice room: replay a mechanic's intro and a few gentle boards of it, once the
 * player has met it. Practice boards come from the shipped, solver-proven bank at the
 * gentle tier, and practice play never reaches progression (level, stars, petals, the
 * skill model, tier pins): the event bus drops it, and lucky pairs pay nothing.
 */
import { describe, expect, it, vi } from 'vitest';
import { proveClear, initialState } from '../src/director/bots';
import { bankSpec } from '../src/director/bank';
import { PRACTICE_BOARDS, firstLevelWith, metMechanics, practiceBoards } from '../src/director/practice';
import { buildBoard, journeyLevel, windOf } from '../src/engine/levels';
import { MECHANICS, MECHANIC_IDS, mechanicsOf } from '../src/engine/mechanics';
import { Session } from '../src/engine/session';
import { emit, on } from '../src/services/events';
import { type ClearSummary, luckyPays } from '../src/services/progress';

const never = () => false;

describe('which mechanics the Practice room shows', () => {
  it('shows nothing to a new player', () => {
    expect(metMechanics(never, 1)).toEqual([]);
  });

  it('shows a mechanic once its intro was seen, in library order', () => {
    const seen = new Set(['gates', 'stones']);
    expect(metMechanics((m) => seen.has(m), 1)).toEqual(['stones', 'gates']);
  });

  it('shows a mechanic once the first board with it is behind the player, never before (no spoilers)', () => {
    for (const m of MECHANIC_IDS) {
      const first = firstLevelWith(m);
      expect(first, m).toBeGreaterThan(1);
      expect(mechanicsOf(journeyLevel(first)), m).toContain(m);
      expect(metMechanics(never, first), m).not.toContain(m);
      expect(metMechanics(never, first + 1), m).toContain(m);
    }
  });

  it('a later level never hides a mechanic shown earlier', () => {
    let before: string[] = [];
    for (let level = 1; level <= 200; level += 7) {
      const now = metMechanics(never, level);
      expect(now.filter((m) => before.includes(m))).toEqual(before);
      before = now;
    }
  });
});

describe('practice boards', () => {
  it.each(MECHANIC_IDS)('%s: a few gentle bank boards that feature it, the same every time', (m) => {
    const boards = practiceBoards(m);
    expect(boards).toHaveLength(PRACTICE_BOARDS);
    expect(practiceBoards(m)).toEqual(boards);
    expect(new Set(boards.map((b) => b.seed)).size).toBe(PRACTICE_BOARDS);
    boards.forEach((spec, i) => {
      expect(spec.mode).toBe('practice');
      expect(spec.practice).toBe(m);
      expect(spec.number).toBe(i + 1);
      expect(spec.tier).toBe(0);
      expect(MECHANICS[m].on(spec), spec.seed).toBe(true);
      // Nothing on it the player meets later than this mechanic.
      for (const other of mechanicsOf(spec)) expect(MECHANICS[other].introChapter, `${spec.seed} ${other}`).toBeLessThanOrEqual(MECHANICS[m].introChapter);
      expect(spec.goal).toBeUndefined();
      expect(spec.festival).toBeUndefined();
    });
  });

  it.each(MECHANIC_IDS)('%s: every practice board is the bank’s own board and the solver clears it', (m) => {
    for (const spec of practiceBoards(m)) {
      const level = Number(/^journey-(\d+)-t0-/.exec(spec.seed)?.[1]);
      const bank = bankSpec(level, 0);
      expect(buildBoard(spec)).toEqual(buildBoard(bank));
      const proof = proveClear(initialState(spec, buildBoard(spec)), windOf(spec), 20000);
      expect(proof.moves, spec.seed).not.toBeNull();
    }
  });
});

describe('practice never reaches progression', () => {
  const practice = new Session(practiceBoards('stones')[0], 0);
  const journey = new Session(journeyLevel(20), 0);
  const summary = {} as ClearSummary;

  it('the event bus drops every practice event, so no listener can count it', () => {
    const seen = vi.fn();
    const offs = [on('start', seen), on('clear', seen), on('leave', seen), on('tap', seen), on('pair', seen), on('tool', seen)];
    emit('start', { session: practice });
    emit('clear', { session: practice, summary });
    emit('leave', { session: practice, reason: 'quit' });
    emit('pair', { mode: 'practice', cards: [0, 1], combo: 1, fever: false, yaku: [], session: practice });
    emit('tool', { kind: 'hint', mode: 'practice' });
    expect(seen).not.toHaveBeenCalled();
    emit('start', { session: journey });
    emit('tool', { kind: 'hint', mode: 'journey' });
    expect(seen).toHaveBeenCalledTimes(2);
    offs.forEach((off) => off());
  });

  it('lucky pairs pay no petals in practice', () => {
    expect(luckyPays('practice', true)).toBe(false);
    expect(luckyPays('practice', false)).toBe(false);
    expect(luckyPays('journey', true)).toBe(true);
    expect(luckyPays('zen', false)).toBe(true);
  });
});
