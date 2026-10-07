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
import { persist, save } from './storage';

const native = Capacitor.isNativePlatform();

class Store {
  /** Billing works on this device and the product exists in Play Console. */
  available = false;
  price = IAP.fallbackPrice;

  async init(): Promise<void> {
    if (!native) return;
    try {
      const { isBillingSupported } = await NativePurchases.isBillingSupported();
      if (!isBillingSupported) return;
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
    const owned = purchases.some((p) => p.productIdentifier === IAP.removeAds && (p.purchaseState === undefined || p.purchaseState === '1'));
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
