/**
 * The Market service: what the player owns, buying, equipping and applying the
 * equipped cosmetics. All rules live here (the screen only renders them).
 *
 *   isOwned(key)            owned, a default, or an unlocked flower paper
 *   check(key) / buy(key)   petals, prerequisites and exclusivity
 *   equip(slot, id)         deck / back / brush / fx / music / paper
 *   applyCosmetics()        once at boot and after every equip
 *   grant(key)              for other features (Flower Path rank rewards, Supporter pack)
 */
import { applyCardBack, applyDeckStyle } from '../art/styles';
import { type MarketCategory, type MarketItem, MARKET_ITEMS, MAX_STREAK_FREEZES, TOOL, itemByKey } from '../data/market';
import { completedMonths, drawCard } from './progress';
import { music } from './music';
import { type CosmeticSlot } from './save-market';
import { persist, save } from './storage';

/** The look every player starts with (always owned, never sold). */
export const DEFAULTS: Record<CosmeticSlot, string> = { deck: 'classic', back: 'classic', brush: 'ink', fx: 'blossom', music: 'default' };

export type EquipSlot = CosmeticSlot | 'paper';
const SLOT_OF: Partial<Record<MarketCategory, EquipSlot>> = { deck: 'deck', back: 'back', brush: 'brush', fx: 'fx', music: 'music', paper: 'paper' };
export const slotOf = (category: MarketCategory): EquipSlot | null => SLOT_OF[category] ?? null;

/** Live brush / effect for the game screen (set by applyCosmetics). */
const live = { brush: DEFAULTS.brush, fx: DEFAULTS.fx };
export const activeBrush = (): string => live.brush;
export const activeFx = (): string => live.fx;

export function isOwned(key: string): boolean {
  const it = itemByKey(key);
  if (!it) return save.market.owned.includes(key);
  if (it.isDefault) return true;
  if (it.consumable) return false;
  if (it.source?.kind === 'album') return completedMonths().includes(it.source.month);
  return save.market.owned.includes(key);
}

/** The equipped id for a slot (the default when nothing, or something no longer owned, is set). */
export function equipped(slot: EquipSlot): string {
  if (slot === 'paper') return isOwned(`paper:${save.paper}`) ? save.paper : 'plain';
  const id = save.market.equip[slot];
  return id && isOwned(`${slot}:${id}`) ? id : DEFAULTS[slot];
}

export function isEquipped(key: string): boolean {
  const it = itemByKey(key);
  const slot = it && slotOf(it.category);
  return !!slot && equipped(slot) === it.id;
}

export type BuyFail =
  /** not in the catalog */
  | 'unknown'
  /** already owned (cosmetics) */
  | 'owned'
  /** Flower Path, Supporter pack or Album only */
  | 'exclusive'
  /** needs another item first */
  | 'needs'
  /** Warm tea: already holding the maximum */
  | 'max'
  /** Album card: the album is complete */
  | 'complete'
  /** not enough petals */
  | 'petals';

export type BuyCheck = { ok: true; item: MarketItem } | { ok: false; reason: BuyFail; item?: MarketItem; missing?: number; needs?: MarketItem };

const albumComplete = () => new Set(save.album.filter((id) => id < 48)).size >= 48;

/** Is this item for sale right now? (Hidden items: album card once the album is complete.) */
export function isListed(it: MarketItem): boolean {
  if (it.key === TOOL.card) return !albumComplete();
  return true;
}

/** Can the player buy `key` right now, and if not, why. */
export function check(key: string): BuyCheck {
  const item = itemByKey(key);
  if (!item) return { ok: false, reason: 'unknown' };
  if (item.isDefault || isOwned(key)) return { ok: false, reason: 'owned', item };
  if (item.source) return { ok: false, reason: 'exclusive', item };
  if (item.needs && !isOwned(item.needs)) return { ok: false, reason: 'needs', item, needs: itemByKey(item.needs) };
  if (key === TOOL.tea && save.streakFreezes >= MAX_STREAK_FREEZES) return { ok: false, reason: 'max', item };
  if (key === TOOL.card && albumComplete()) return { ok: false, reason: 'complete', item };
  if (save.petals < item.price) return { ok: false, reason: 'petals', item, missing: item.price - save.petals };
  return { ok: true, item };
}

export type BuyResult = (BuyCheck & { ok: false }) | { ok: true; item: MarketItem; drawn?: number };

type PurchaseListener = (item: MarketItem) => void;
const listeners: PurchaseListener[] = [];
/** EXTENSION POINT: missions / seals can react to purchases. Returns an unsubscribe. */
export function onPurchase(fn: PurchaseListener): () => void {
  listeners.push(fn);
  return () => void listeners.splice(listeners.indexOf(fn), 1);
}

/** Spend petals on an item. Tools take effect at once; cosmetics become owned. */
export function buy(key: string): BuyResult {
  const c = check(key);
  if (!c.ok) return c;
  const item = c.item;
  save.petals -= item.price;
  save.market.spent += item.price;
  let drawn: number | undefined;
  if (item.consumable) {
    if (key === TOOL.hints) save.hints += 3;
    else if (key === TOOL.shuffles) save.shuffles += 3;
    else if (key === TOOL.tea) save.streakFreezes = Math.min(MAX_STREAK_FREEZES, save.streakFreezes + 1);
    else if (key === TOOL.card) drawn = drawCard() ?? undefined;
  } else if (!save.market.owned.includes(key)) save.market.owned.push(key);
  markSeen(key);
  persist();
  for (const fn of listeners.slice()) {
    try {
      fn(item);
    } catch (err) {
      console.error('[market] purchase listener failed', err);
    }
  }
  return drawn != null ? { ok: true, item, drawn } : { ok: true, item };
}

/**
 * EXTENSION POINT: give an item without petals (Flower Path rank rewards, the
 * Supporter pack). Idempotent. Returns true if it was newly granted.
 */
export function grant(key: string): boolean {
  if (save.market.owned.includes(key)) return false;
  save.market.owned.push(key);
  persist();
  return true;
}

/** Equip an owned cosmetic. Returns false if it isn't owned (nothing changes). */
export function equip(slot: EquipSlot, id: string): boolean {
  if (!isOwned(`${slot}:${id}`)) return false;
  if (slot === 'paper') save.paper = id;
  else if (id === DEFAULTS[slot]) delete save.market.equip[slot];
  else save.market.equip[slot] = id;
  persist();
  applyCosmetics();
  return true;
}

/** Install the equipped deck, back, music, brush and effect. Safe to call any time. */
export function applyCosmetics(): void {
  live.brush = equipped('brush');
  live.fx = equipped('fx');
  music.setPreset(equipped('music'));
  if (typeof document === 'undefined') return;
  applyDeckStyle(equipped('deck'));
  applyCardBack(equipped('back'));
}

/** Garden: owned items the player hasn't put away. */
export function gardenShown(id: string): boolean {
  return isOwned(`garden:${id}`) && !save.market.gardenHidden.includes(id);
}
export function setGardenShown(id: string, shown: boolean): void {
  const hidden = save.market.gardenHidden.filter((x) => x !== id);
  if (!shown) hidden.push(id);
  save.market.gardenHidden = hidden;
  persist();
}

// ── "New" dots ─────────────────────────────────────────────────────
export function markSeen(...keys: string[]): void {
  let changed = false;
  for (const k of keys) {
    if (!save.market.seen.includes(k)) {
      save.market.seen.push(k);
      changed = true;
    }
  }
  if (changed) persist();
}

/** Worth a "new" dot: buyable for petals, not yet owned and never looked at. */
export function isNew(it: MarketItem): boolean {
  return !it.isDefault && !it.source && !it.consumable && !save.market.seen.includes(it.key) && !isOwned(it.key);
}

/** For Home: an unseen item the player can afford right now. */
export function hasAffordableNew(): boolean {
  return MARKET_ITEMS.some((it) => isNew(it) && it.price <= save.petals && (!it.needs || isOwned(it.needs)));
}

/** Human name of the current board paper (for Settings). */
export function paperName(): string {
  return itemByKey(`paper:${equipped('paper')}`)?.name ?? 'Plain hanji';
}
