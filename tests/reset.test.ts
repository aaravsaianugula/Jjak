/**
 * Settings → Reset progress: progress is erased, every cosmetic falls back to
 * its default without errors, and purchase receipts survive (so a restore can't
 * pay one-time petals twice and Remove ads stays removed).
 */
import { describe, expect, it } from 'vitest';
import { IAP } from '../src/config';
import { DEFAULTS, activeBrush, activeFx, applyCosmetics, equip, equipped, grant, isOwned } from '../src/services/market';
import { grantPouch, grantSupporter } from '../src/services/meta';
import { defaultSave, resetSave, save } from '../src/services/storage';

describe('starting tools', () => {
  it('a new player (or a reset) starts with 5 hints and 5 shuffles; more come from an ad or petals', async () => {
    expect(defaultSave().hints).toBe(5);
    expect(defaultSave().shuffles).toBe(5);
    Object.assign(save, defaultSave(), { hints: 0, shuffles: 1 });
    await resetSave();
    expect(save.hints).toBe(5);
    expect(save.shuffles).toBe(5);
  });
});

describe('reset progress', () => {
  it('drops cosmetics to the defaults and keeps purchase receipts', async () => {
    Object.assign(save, defaultSave());
    // A late-game player: exclusives and bought cosmetics equipped, a paper, purchases.
    save.level = 240;
    save.petals = 3000;
    save.album = [0, 1, 2, 3];
    for (const k of ['deck:moonlit', 'brush:gold', 'fx:gold', 'music:moonlight', 'paper:hanji', 'garden:pond']) grant(k);
    expect(grantSupporter()).toBe(true);
    expect(grantPouch(500, 'token-1')).toBe(true);
    save.adFree = true;
    expect(equip('deck', 'moonlit')).toBe(true);
    expect(equip('back', 'clouds')).toBe(true);
    expect(equip('brush', 'gold')).toBe(true);
    expect(equip('fx', 'gold')).toBe(true);
    expect(equip('music', 'moonlight')).toBe(true);
    expect(equip('paper', 'hanji')).toBe(true);
    expect(equip('paper', '0')).toBe(true);
    expect(activeBrush()).toBe('gold');

    await resetSave();

    // Progress is gone.
    expect(save.level).toBe(1);
    expect(save.album).toEqual([]);
    expect(save.petals).toBe(defaultSave().petals);
    expect(isOwned('deck:moonlit')).toBe(false);
    expect(isOwned('garden:pond')).toBe(false);
    // Every slot falls back to its default, and applying them doesn't throw.
    for (const slot of Object.keys(DEFAULTS) as (keyof typeof DEFAULTS)[]) expect(equipped(slot)).toBe(DEFAULTS[slot]);
    expect(equipped('paper')).toBe('plain');
    expect(() => applyCosmetics()).not.toThrow();
    expect(activeBrush()).toBe(DEFAULTS.brush);
    expect(activeFx()).toBe(DEFAULTS.fx);
    // Purchases survive: ad-free, the Supporter pack and its back, the receipt tokens.
    expect(save.adFree).toBe(true);
    expect(save.meta.supporter).toBe(true);
    expect(isOwned('back:clouds')).toBe(true);
    expect(save.meta.iapTokens).toContain('token-1');
    // …so restoring them can't pay their petals again.
    const petals = save.petals;
    expect(grantPouch(500, 'token-1')).toBe(false);
    expect(grantSupporter()).toBe(false);
    expect(save.petals).toBe(petals);
    expect(IAP.supporterPetals).toBeGreaterThan(0);
  });

  it('a stale saved equip (item no longer owned) loads as the default', async () => {
    await resetSave();
    save.market.equip = { deck: 'gilded', back: 'moon', brush: 'gold', fx: 'gold', music: 'moonlight' };
    save.paper = '7';
    for (const slot of Object.keys(DEFAULTS) as (keyof typeof DEFAULTS)[]) expect(equipped(slot)).toBe(DEFAULTS[slot]);
    expect(equipped('paper')).toBe('plain');
    expect(() => applyCosmetics()).not.toThrow();
  });
});
