/**
 * The launch: the loader's line advances only with real boot steps, it stays up
 * long enough never to flash (and lets the line finish its last stretch), and the
 * first screen is the intro title for a new player, Home for a returning one.
 */
import { describe, expect, it } from 'vitest';
import { type BootStep, LINE_SETTLE_MS, LOADER_MIN_MS, bootFraction, firstScreen, holdRemaining } from '../src/ui/launch-plan';
import { calendarSeason } from '../src/data/route';

describe('boot progress', () => {
  it('starts empty, advances one step at a time and ends full', () => {
    const done = new Set<BootStep>();
    expect(bootFraction(done)).toBe(0);
    done.add('save');
    expect(bootFraction(done)).toBe(0.25);
    done.add('art');
    done.add('fonts');
    expect(bootFraction(done)).toBe(0.75);
    done.add('screen');
    expect(bootFraction(done)).toBe(1);
  });

  it('counts a step once, whatever order the steps finish in', () => {
    const done = new Set<BootStep>(['screen', 'screen', 'fonts']);
    expect(bootFraction(done)).toBe(0.5);
  });
});

describe('loader hold', () => {
  it('holds a fast boot until the minimum time has passed', () => {
    expect(holdRemaining({ shownAt: 1000, lastStepAt: 1100, now: 1200 })).toBe(LOADER_MIN_MS - 200);
  });

  it('ends at once when boot took longer than the minimum and the line has settled', () => {
    const now = 1000 + LOADER_MIN_MS + 500;
    expect(holdRemaining({ shownAt: 1000, lastStepAt: now - LINE_SETTLE_MS, now })).toBe(0);
    expect(holdRemaining({ shownAt: 1000, lastStepAt: now - LINE_SETTLE_MS - 50, now })).toBe(0);
  });

  it('lets the line finish its last stretch after a slow final step', () => {
    const now = 1000 + LOADER_MIN_MS + 500;
    expect(holdRemaining({ shownAt: 1000, lastStepAt: now - 40, now })).toBe(LINE_SETTLE_MS - 40);
  });

  it('is exactly zero at the minimum boundary', () => {
    expect(holdRemaining({ shownAt: 0, lastStepAt: 0, now: LOADER_MIN_MS })).toBe(0);
  });
});

describe('first screen', () => {
  it('sends a new player to the intro title and a returning player Home', () => {
    expect(firstScreen({ onboarded: false })).toBe('intro');
    expect(firstScreen({ onboarded: true })).toBe('home');
  });
});

describe('calendar season', () => {
  it('follows the months: Mar–May spring, Jun–Aug summer, Sep–Nov autumn, Dec–Feb winter', () => {
    const at = (month: number) => calendarSeason(new Date(2026, month, 15));
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(at)).toEqual([3, 3, 0, 0, 0, 1, 1, 1, 2, 2, 2, 3]);
  });

  it('turns at the first and last day of a month, local time', () => {
    expect(calendarSeason(new Date(2026, 1, 28, 23, 59))).toBe(3);
    expect(calendarSeason(new Date(2026, 2, 1, 0, 0))).toBe(0);
    expect(calendarSeason(new Date(2026, 11, 1, 0, 0))).toBe(3);
  });
});
