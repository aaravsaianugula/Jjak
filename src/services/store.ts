/**
 * One-time "Remove ads" purchase via Google Play Billing.
 *
 * The entitlement is cached in the save file so ads stay off offline, and is
 * re-checked against Play on every launch (also handles refunds and new devices).
 */
import { Capacitor } from '@capacitor/core';
import { NativePurchases, PURCHASE_TYPE } from '@capgo/native-purchases';
import { IAP } from '../config';
import { ads } from './ads';
import { grantPouch, grantSupporter } from './meta';
import { flush, persist, save } from './storage';

const native = Capacitor.isNativePlatform();

class Store {
  /** Billing works on this device and the product exists in Play Console. */
  available = false;
  price = IAP.fallbackPrice;
  /** Petal pouches and the Supporter pack are set up in Play Console. */
  extrasAvailable = false;
  private billing = false;
  /** Play's localized price per product id (pouches + Supporter). */
  prices: Record<string, string> = {};
  private readyResolve!: () => void;
  /** Resolves once init() has finished (prices known, or billing unavailable). */
  readonly ready = new Promise<void>((r) => (this.readyResolve = r));

  async init(): Promise<void> {
    try {
      await this.initCore();
      await this.initExtras();
    } finally {
      this.readyResolve();
    }
  }

  private async initCore(): Promise<void> {
    if (!native) return;
    try {
      const { isBillingSupported } = await NativePurchases.isBillingSupported();
      if (!isBillingSupported) return;
      this.billing = true;
      const { product } = await NativePurchases.getProduct({ productIdentifier: IAP.removeAds, productType: PURCHASE_TYPE.INAPP });
      this.available = true;
      this.price = product.priceString || IAP.fallbackPrice;
      await this.syncOwnership();
    } catch {
      this.available = false; // product not set up yet, or no Play services
    }
  }

  private async syncOwnership(): Promise<void> {
    const { purchases } = await NativePurchases.getPurchases({ productType: PURCHASE_TYPE.INAPP });
    const done = (p: { purchaseState?: string }) => p.purchaseState === undefined || p.purchaseState === '1';
    // The Supporter pack also removes ads.
    const supporter = purchases.some((p) => p.productIdentifier === IAP.supporter && done(p));
    if (supporter) grantSupporter();
    const owned = purchases.some((p) => (p.productIdentifier === IAP.removeAds || p.productIdentifier === IAP.supporter) && done(p));
    // Pouches bought but not yet consumed (app closed mid-purchase, or a pending payment that completed).
    for (const p of purchases) {
      const pouch = IAP.pouches.find((x) => x.id === p.productIdentifier);
      if (pouch && done(p) && p.purchaseToken) await this.creditPouch(pouch.petals, p.purchaseToken);
    }
    if (owned !== save.adFree) {
      save.adFree = owned;
      persist();
      if (owned) void ads.hideBanner();
    }
  }

  /** Returns true if the player now owns "Remove ads". */
  async buyRemoveAds(): Promise<boolean> {
    if (!native || !this.available) return false;
    try {
      const t = await NativePurchases.purchaseProduct({ productIdentifier: IAP.removeAds, productType: PURCHASE_TYPE.INAPP });
      if (t.purchaseState !== undefined && t.purchaseState !== '1') return false; // pending (e.g. cash payment)
      save.adFree = true;
      persist();
      void ads.hideBanner();
      return true;
    } catch {
      return false; // cancelled or failed
    }
  }

  /** Load the pouch and Supporter products (separately, so Remove ads works even if these aren't set up). */
  private async initExtras(): Promise<void> {
    if (!native || !this.billing) return;
    try {
      const ids = [...IAP.pouches.map((p) => p.id), IAP.supporter];
      const { products } = await NativePurchases.getProducts({ productIdentifiers: ids, productType: PURCHASE_TYPE.INAPP });
      for (const p of products) if (p.priceString) this.prices[p.identifier] = p.priceString;
      this.extrasAvailable = products.length > 0;
      if (!this.available) await this.syncOwnership();
    } catch {
      this.extrasAvailable = false;
    }
  }

  priceOf(id: string): string {
    const pouch = IAP.pouches.find((p) => p.id === id);
    return this.prices[id] ?? (id === IAP.supporter ? IAP.supporterFallbackPrice : pouch?.fallbackPrice ?? '');
  }

  /** Is this extra product live in Play? */
  has(id: string): boolean {
    return this.extrasAvailable && !!this.prices[id];
  }

  /** Credit petals once per token, save, then consume so the pouch can be bought again. */
  private async creditPouch(petals: number, token: string): Promise<boolean> {
    const fresh = grantPouch(petals, token);
    await flush(); // the petals are on disk before Play forgets the purchase
    try {
      await NativePurchases.consumePurchase({ purchaseToken: token });
    } catch {
      /* retried on next launch: the token is remembered, so no double credit */
    }
    return fresh;
  }

  /**
   * Buy a petal pouch (consumable). Resolves 'done' once the petals are credited,
   * 'pending' for a slow payment method (credited on a later launch), or 'failed'.
   */
  async buyPouch(id: string): Promise<'done' | 'pending' | 'failed'> {
    const pouch = IAP.pouches.find((p) => p.id === id);
    if (!native || !pouch || !this.has(id)) return 'failed';
    try {
      const t = await NativePurchases.purchaseProduct({
        productIdentifier: id,
        productType: PURCHASE_TYPE.INAPP,
        // We grant first, then consume ourselves (consuming also acknowledges).
        isConsumable: false,
        autoAcknowledgePurchases: false,
      });
      if (t.purchaseState !== undefined && t.purchaseState !== '1') return 'pending';
      if (!t.purchaseToken) {
        grantPouch(pouch.petals, t.transactionId);
        persist();
        return 'done';
      }
      await this.creditPouch(pouch.petals, t.purchaseToken);
      return 'done';
    } catch {
      return 'failed'; // cancelled or failed
    }
  }

  /** Buy the Supporter pack (non-consumable). Returns true once it's owned. */
  async buySupporter(): Promise<boolean> {
    if (!native || !this.has(IAP.supporter)) return false;
    try {
      const t = await NativePurchases.purchaseProduct({ productIdentifier: IAP.supporter, productType: PURCHASE_TYPE.INAPP });
      if (t.purchaseState !== undefined && t.purchaseState !== '1') return false; // pending
      grantSupporter();
      save.adFree = true;
      persist();
      void ads.hideBanner();
      return true;
    } catch {
      return false;
    }
  }

  async restore(): Promise<boolean> {
    if (!native) return false;
    try {
      await NativePurchases.restorePurchases();
      await this.syncOwnership();
    } catch {
      /* offline */
    }
    return save.adFree;
  }
}

export const store = new Store();
