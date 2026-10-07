import { beforeEach, describe, expect, test } from 'vitest';
import { CARD_BACKS, DECK_STYLES } from '../src/art/styles';
import { GARDEN_ITEMS } from '../src/art/garden';
import { MARKET_ITEMS, MAX_STREAK_FREEZES, PATH_EXCLUSIVES, TOOL, cosmeticsTotal, itemByKey, itemsIn } from '../src/data/market';
import {
  DEFAULTS,
  activeBrush,
  activeFx,
  applyCosmetics,
  buy,
  check,
  equip,
  equipped,
  grant,
  hasAffordableNew,
  isEquipped,
  isListed,
  isNew,
  isOwned,
  markSeen,
  onPurchase,
  paperName,
} from '../src/services/market';
import { defaultMarket, hydrateMarket } from '../src/services/save-market';
import { defaultSave, save } from '../src/services/storage';

beforeEach(() => {
  Object.assign(save, defaultSave());
});

describe('catalog', () => {
  test('keys are unique and match category:id', () => {
    const keys = MARKET_ITEMS.map((it) => it.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const it of MARKET_ITEMS) expect(it.key).toBe(`${it.category}:${it.id}`);
  });

  test('covers every deck style, card back and garden item', () => {
    expect(itemsIn('deck').map((i) => i.id)).toEqual(DECK_STYLES.map((d) => d.id));
    expect(itemsIn('back').map((i) => i.id)).toEqual(CARD_BACKS.map((d) => d.id));
    expect(itemsIn('garden').map((i) => i.id)).toEqual(GARDEN_ITEMS.map((d) => d.id));
    expect(itemsIn('brush')).toHaveLength(6);
    expect(itemsIn('fx')).toHaveLength(7);
    expect(itemsIn('music')).toHaveLength(5);
    expect(itemsIn('paper').filter((p) => !p.source && !p.isDefault)).toHaveLength(6);
    expect(itemsIn('paper').filter((p) => p.source?.kind === 'album')).toHaveLength(12);
  });

  test('exclusives are not priced and carry their source', () => {
    for (const [key, rank] of Object.entries(PATH_EXCLUSIVES)) {
      const it = itemByKey(key)!;
      expect(it, key).toBeDefined();
      expect(it.price).toBe(0);
      expect(it.source).toEqual({ kind: 'path', rank });
    }
    expect(itemByKey('back:clouds')!.source).toEqual({ kind: 'supporter' });
  });

  test('every buyable item has a price; garden needs point at real items', () => {
    for (const it of MARKET_ITEMS) {
      if (!it.isDefault && !it.source) expect(it.price, it.key).toBeGreaterThan(0);
      if (it.needs) expect(itemByKey(it.needs), it.key).toBeDefined();
    }
    expect(itemByKey('garden:koi')!.needs).toBe('garden:pond');
  });

  test('pricing follows the economy plan', () => {
    const total = cosmeticsTotal();
    expect(total).toBeGreaterThan(11_000);
    expect(total).toBeLessThan(13_000);
    const starters = MARKET_ITEMS.filter((it) => it.category !== 'tool' && it.price >= 60 && it.price <= 150);
    expect(starters.length).toBeGreaterThanOrEqual(5);
    // Coveted garden pieces cost more than the simple ones.
    expect(itemByKey('garden:cat')!.price).toBeGreaterThan(itemByKey('garden:stones')!.price * 5);
    expect(itemByKey('garden:koi')!.price).toBeGreaterThan(itemByKey('garden:lantern')!.price);
  });
});

describe('owning and buying', () => {
  test('defaults are always owned and equipped', () => {
    for (const [slot, id] of Object.entries(DEFAULTS)) {
      expect(isOwned(`${slot}:${id}`)).toBe(true);
      expect(isEquipped(`${slot}:${id}`)).toBe(true);
    }
    expect(isOwned('paper:plain')).toBe(true);
    expect(check('deck:classic')).toMatchObject({ ok: false, reason: 'owned' });
  });

  test('buy spends petals and owns the item', () => {
    save.petals = 100;
    const r = buy('brush:vermilion');
    expect(r.ok).toBe(true);
    expect(save.petals).toBe(20);
    expect(save.market.spent).toBe(80);
    expect(isOwned('brush:vermilion')).toBe(true);
    expect(buy('brush:vermilion')).toMatchObject({ ok: false, reason: 'owned' });
    expect(save.petals).toBe(20);
  });

  test('not enough petals reports how many are missing', () => {
    save.petals = 30;
    expect(buy('brush:vermilion')).toMatchObject({ ok: false, reason: 'petals', missing: 50 });
    expect(save.petals).toBe(30);
    expect(isOwned('brush:vermilion')).toBe(false);
  });

  test('exclusives can never be bought, however many petals', () => {
    save.petals = 99_999;
    for (const key of [...Object.keys(PATH_EXCLUSIVES), 'back:clouds']) {
      expect(buy(key), key).toMatchObject({ ok: false, reason: 'exclusive' });
    }
    expect(save.petals).toBe(99_999);
  });

  test('grant gives exclusives without petals, once', () => {
    expect(grant('deck:gilded')).toBe(true);
    expect(grant('deck:gilded')).toBe(false);
    expect(isOwned('deck:gilded')).toBe(true);
    expect(save.market.owned.filter((k) => k === 'deck:gilded')).toHaveLength(1);
  });

  test('garden prerequisites: koi need the pond', () => {
    save.petals = 2000;
    expect(buy('garden:koi')).toMatchObject({ ok: false, reason: 'needs' });
    expect(buy('garden:pond').ok).toBe(true);
    expect(buy('garden:koi').ok).toBe(true);
  });

  test('unknown keys are refused', () => {
    save.petals = 500;
    expect(buy('deck:nope')).toMatchObject({ ok: false, reason: 'unknown' });
  });

  test('tools: hints and shuffles come in threes', () => {
    save.petals = 200;
    const h0 = save.hints;
    const s0 = save.shuffles;
    expect(buy(TOOL.hints).ok).toBe(true);
    expect(buy(TOOL.shuffles).ok).toBe(true);
    expect(save.hints).toBe(h0 + 3);
    expect(save.shuffles).toBe(s0 + 3);
    expect(isOwned(TOOL.hints)).toBe(false);
    expect(buy(TOOL.hints).ok).toBe(true);
    expect(save.petals).toBe(200 - 50 - 40 - 50);
  });

  test('warm tea: at most two cups', () => {
    save.petals = 1000;
    expect(buy(TOOL.tea).ok).toBe(true);
    expect(buy(TOOL.tea).ok).toBe(true);
    expect(save.streakFreezes).toBe(MAX_STREAK_FREEZES);
    expect(buy(TOOL.tea)).toMatchObject({ ok: false, reason: 'max' });
    expect(save.petals).toBe(1000 - 240);
  });

  test('album card draws a missing card, and is hidden once the album is complete', () => {
    save.petals = 1000;
    save.album = Array.from({ length: 47 }, (_, i) => i);
    const r = buy(TOOL.card);
    expect(r).toMatchObject({ ok: true, drawn: 47 });
    expect(save.album).toContain(47);
    expect(isListed(itemByKey(TOOL.card)!)).toBe(false);
    expect(buy(TOOL.card)).toMatchObject({ ok: false, reason: 'complete' });
    expect(save.petals).toBe(800);
  });

  test('onPurchase listeners hear about purchases', () => {
    const heard: string[] = [];
    const off = onPurchase((it) => heard.push(it.key));
    save.petals = 500;
    buy('fx:ink');
    buy('fx:ink');
    off();
    buy('fx:maple');
    expect(heard).toEqual(['fx:ink']);
  });
});

describe('equipping', () => {
  test('only owned items can be equipped', () => {
    expect(equip('deck', 'sumi')).toBe(false);
    expect(equipped('deck')).toBe('classic');
    save.petals = 1000;
    buy('deck:sumi');
    expect(equip('deck', 'sumi')).toBe(true);
    expect(equipped('deck')).toBe('sumi');
    expect(isEquipped('deck:sumi')).toBe(true);
    expect(isEquipped('deck:classic')).toBe(false);
  });

  test('equipping the default clears the slot', () => {
    grant('brush:gold');
    equip('brush', 'gold');
    expect(save.market.equip.brush).toBe('gold');
    equip('brush', 'ink');
    expect(save.market.equip.brush).toBeUndefined();
    expect(equipped('brush')).toBe('ink');
  });

  test('a stale equip (no longer owned) falls back to the default', () => {
    save.market.equip.fx = 'cranes';
    expect(equipped('fx')).toBe('blossom');
  });

  test('applyCosmetics sets the live brush and effect', () => {
    save.petals = 1000;
    buy('brush:firefly');
    buy('fx:snow');
    equip('brush', 'firefly');
    equip('fx', 'snow');
    expect(activeBrush()).toBe('firefly');
    expect(activeFx()).toBe('snow');
    Object.assign(save, defaultSave());
    applyCosmetics();
    expect(activeBrush()).toBe('ink');
    expect(activeFx()).toBe('blossom');
  });

  test('papers: bought papers and album papers', () => {
    save.petals = 100;
    expect(equip('paper', 'hanji')).toBe(false);
    buy('paper:hanji');
    expect(equip('paper', 'hanji')).toBe(true);
    expect(save.paper).toBe('hanji');
    expect(paperName()).toBe('Hanji fibre');
    // Pine paper unlocks with all four pine cards.
    expect(isOwned('paper:0')).toBe(false);
    save.album = [0, 1, 2, 3];
    expect(isOwned('paper:0')).toBe(true);
    expect(equip('paper', '0')).toBe(true);
    expect(paperName()).toBe('Pine paper');
    expect(buy('paper:1')).toMatchObject({ ok: false, reason: 'exclusive' });
  });
});

describe('new dots', () => {
  test('affordable unseen items light the Home dot until seen', () => {
    save.petals = 0;
    expect(hasAffordableNew()).toBe(false);
    save.petals = 60;
    expect(hasAffordableNew()).toBe(true);
    const cheap = MARKET_ITEMS.filter((it) => isNew(it) && it.price <= 60).map((it) => it.key);
    markSeen(...cheap);
    expect(hasAffordableNew()).toBe(false);
  });
});

describe('save slice', () => {
  test('hydrate keeps fields and repairs bad data', () => {
    expect(hydrateMarket(null)).toEqual(defaultMarket());
    const m = hydrateMarket({ owned: ['deck:sumi', 4], equip: { deck: 'sumi' }, seen: 'x', spent: -3 });
    expect(m.owned).toEqual(['deck:sumi']);
    expect(m.seen).toEqual([]);
    expect(m.gardenHidden).toEqual([]);
    expect(m.spent).toBe(0);
    expect(m.equip.deck).toBe('sumi');
  });
});
