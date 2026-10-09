import { describe, expect, it } from 'vitest';
import { GARDEN_ITEMS, GARDEN_SPOTS, GARDEN_VISITORS, gardenItemSvg, gardenItemSvgCached, gardenSvg, gardenVisitorSvg, placedItems, seasonOf } from '../src/art/garden';
import { hydrateGarden } from '../src/services/save-garden';

const ALL = GARDEN_ITEMS.map((i) => i.id);
const ids = (svg: string) => [...svg.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
const refs = (svg: string) => [...svg.matchAll(/(?:url\(#|href="#)([^)"]+)/g)].map((m) => m[1]);

describe('garden art', () => {
  it('has a fixed spot for every catalog item', () => {
    for (const id of ALL) expect(GARDEN_SPOTS[id], id).toBeTruthy();
    expect(ALL).toHaveLength(24);
  });

  it('respects needs: koi, bridge and crane only appear with the pond', () => {
    expect(placedItems(['koi', 'bridge', 'crane', 'cat'])).toEqual(['cat']);
    expect(placedItems(['koi', 'pond']).sort()).toEqual(['koi', 'pond']);
    const svg = gardenSvg(1, ['koi', 'bridge', 'crane']);
    expect(svg).not.toContain('data-item="koi"');
    expect(svg).not.toContain('data-item="crane"');
  });

  it('draws every item in every season, day and night, with resolvable ids', () => {
    for (let s = 0; s < 4; s++) {
      for (const night of [false, true]) {
        const svg = gardenSvg(s, ALL, { night });
        const own = new Set(ids(svg));
        for (const r of refs(svg)) expect(own.has(r), `season ${s} night ${night}: #${r}`).toBe(true);
        for (const id of ALL) {
          if (id === 'fireflies') continue;
          expect(svg, `${id} in season ${s}`).toContain(`data-item="${id}"`);
        }
        expect(svg.includes('ga-fly'), `fireflies only at night (season ${s})`).toBe(night);
        expect(svg).not.toMatch(/NaN|undefined/);
      }
    }
  });

  it('keeps SVG ids unique between scenes and vignettes on one page', () => {
    const page = gardenSvg(2, ALL) + gardenSvg(2, ['pond']) + ALL.map((id) => gardenItemSvg(id, 2)).join('');
    const list = ids(page);
    expect(new Set(list).size).toBe(list.length);
  });

  it('reuses a built vignette with fresh ids for every copy', () => {
    const scoped = (svg: string) => svg.replace(/gi\d+-/g, 'gi#-');
    for (const id of ALL) {
      const a = gardenItemSvgCached(id, 1);
      const b = gardenItemSvgCached(id, 1);
      // Same picture as the uncached builder, apart from its id scope.
      expect(scoped(a), id).toBe(scoped(gardenItemSvg(id, 1)));
      expect(scoped(b), id).toBe(scoped(a));
      // Two copies can share one page: no id is repeated and every reference resolves in its own copy.
      const both = ids(a + b);
      expect(new Set(both).size, id).toBe(both.length);
      for (const svg of [a, b]) {
        const own = new Set(ids(svg));
        for (const r of refs(svg)) expect(own.has(r), `${id}: #${r}`).toBe(true);
      }
    }
    expect(scoped(gardenItemSvgCached('pond', 0))).not.toBe(scoped(gardenItemSvgCached('pond', 2)));
  });

  it('draws a vignette for each item and visitor', () => {
    for (const id of ALL) {
      const svg = gardenItemSvg(id, 3);
      expect(svg).toContain('viewBox="0 0 120 120"');
      expect(svg).not.toMatch(/NaN|undefined/);
    }
    for (const v of GARDEN_VISITORS) expect(gardenVisitorSvg(v.id, 0, ALL)).toContain('<svg');
  });

  it('shows the visitor or its note only when its host is in the garden', () => {
    expect(gardenSvg(0, ALL, { visitor: 'magpie' })).toContain('data-visitor="magpie"');
    expect(gardenSvg(0, ['pond'], { visitor: 'magpie' })).not.toContain('data-visitor');
    expect(gardenSvg(0, ['wall'], { note: 'magpie' })).toContain('data-note="magpie"');
  });

  it('maps months to seasons', () => {
    expect(seasonOf(new Date(2026, 3, 1))).toBe(0);
    expect(seasonOf(new Date(2026, 6, 1))).toBe(1);
    expect(seasonOf(new Date(2026, 9, 7))).toBe(2);
    expect(seasonOf(new Date(2026, 0, 1))).toBe(3);
  });
});

describe('garden save slice', () => {
  it('hydrates missing or bad fields to defaults', () => {
    expect(hydrateGarden(null)).toEqual({ v: 1, giftDay: null, met: [], gifts: 0, seen: [] });
    expect(hydrateGarden({ v: 1 })).toEqual({ v: 1, giftDay: null, met: [], gifts: 0, seen: [] });
    expect(hydrateGarden({ v: 1, giftDay: '2026-10-07', met: ['heron', 3], gifts: 2 })).toMatchObject({ giftDay: '2026-10-07', met: ['heron'], gifts: 2 });
  });
});
