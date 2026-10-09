/**
 * The Remove ads products, with Google Play faked at the native boundary: the festival
 * product loads beside Remove ads without being able to break it, buying it removes ads
 * exactly like Remove ads does, and owning it is found again by sync and restore.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IAP } from '../src/config';

interface FakeProduct {
  identifier: string;
  priceString: string;
  price: number;
  currencyCode: string;
}
interface FakePurchase {
  productIdentifier: string;
  purchaseState?: string;
  purchaseToken?: string;
}

/** What Play Console has set up, and what this Google account owns. */
let catalog: FakeProduct[] = [];
let owned: FakePurchase[] = [];
const bought: string[] = [];

const product = (identifier: string, price: number): FakeProduct => ({ identifier, price, priceString: `$${price.toFixed(2)}`, currencyCode: 'USD' });

const fakePurchases = {
  isBillingSupported: vi.fn(async () => ({ isBillingSupported: true })),
  getProduct: vi.fn(async ({ productIdentifier }: { productIdentifier: string }) => {
    const p = catalog.find((x) => x.identifier === productIdentifier);
    if (!p) throw new Error(`No product ${productIdentifier}`);
    return { product: p };
  }),
  getProducts: vi.fn(async ({ productIdentifiers }: { productIdentifiers: string[] }) => ({
    products: catalog.filter((p) => productIdentifiers.includes(p.identifier)),
  })),
  getPurchases: vi.fn(async () => ({ purchases: owned })),
  purchaseProduct: vi.fn(async ({ productIdentifier }: { productIdentifier: string }) => {
    bought.push(productIdentifier);
    return { transactionId: `t-${productIdentifier}`, purchaseState: '1' };
  }),
  restorePurchases: vi.fn(async () => {}),
  consumePurchase: vi.fn(async () => {}),
};

vi.mock('@capacitor/core', async (importOriginal) => {
  const real = await importOriginal<typeof import('@capacitor/core')>();
  return { ...real, Capacitor: { ...real.Capacitor, isNativePlatform: () => true } };
});
vi.mock('@capgo/native-purchases', async (importOriginal) => ({ ...(await importOriginal<object>()), NativePurchases: fakePurchases }));
vi.mock('../src/services/ads', () => ({ ads: { hideBanner: async () => {} } }));

/** A fresh store and save, as on app launch. */
async function launch() {
  vi.resetModules();
  const { store } = await import('../src/services/store');
  const { save, defaultSave } = await import('../src/services/storage');
  Object.assign(save, defaultSave());
  await store.init();
  return { store, save };
}

beforeEach(() => {
  catalog = [product(IAP.removeAds, 2.99), product(IAP.removeAdsFestival, 2.49)];
  owned = [];
  bought.length = 0;
});

describe('loading the festival product', () => {
  it('loads beside Remove ads with both of Play’s prices', async () => {
    const { store } = await launch();
    expect(store.available).toBe(true);
    expect(store.festivalAvailable).toBe(true);
    expect(store.festivalPrice).toBe('$2.49');
    expect(store.regular).toEqual({ label: '$2.99', amount: 2.99, currency: 'USD' });
    expect(store.festival).toEqual({ label: '$2.49', amount: 2.49, currency: 'USD' });
  });

  it('a festival product missing from Play leaves Remove ads working', async () => {
    catalog = [product(IAP.removeAds, 2.99)];
    const { store } = await launch();
    expect(store.available).toBe(true);
    expect(store.price).toBe('$2.99');
    expect(store.festivalAvailable).toBe(false);
    expect(store.festival).toBeNull();
    expect(await store.buyRemoveAds({ festival: true })).toBe(true);
    expect(bought).toEqual([IAP.removeAds]);
  });
});

describe('buying', () => {
  it('the festival price buys the festival product and removes ads', async () => {
    const { store, save } = await launch();
    expect(await store.buyRemoveAds({ festival: true })).toBe(true);
    expect(bought).toEqual([IAP.removeAdsFestival]);
    expect(save.adFree).toBe(true);
  });

  it('the regular price buys Remove ads', async () => {
    const { store, save } = await launch();
    expect(await store.buyRemoveAds()).toBe(true);
    expect(bought).toEqual([IAP.removeAds]);
    expect(save.adFree).toBe(true);
  });

  it('a pending festival payment does not remove ads yet', async () => {
    fakePurchases.purchaseProduct.mockImplementationOnce(async ({ productIdentifier }) => {
      bought.push(productIdentifier);
      return { transactionId: 't', purchaseState: '0' };
    });
    const { store, save } = await launch();
    expect(await store.buyRemoveAds({ festival: true })).toBe(false);
    expect(save.adFree).toBe(false);
  });
});

describe('owning the festival product', () => {
  it('is found on launch: ads stay off, and the Supporter pack is not granted', async () => {
    owned = [{ productIdentifier: IAP.removeAdsFestival, purchaseState: '1' }];
    const { save } = await launch();
    expect(save.adFree).toBe(true);
    expect(save.meta.supporter).toBe(false);
  });

  it('is found again by Restore purchase', async () => {
    const { store, save } = await launch();
    expect(save.adFree).toBe(false);
    owned = [{ productIdentifier: IAP.removeAdsFestival, purchaseState: '1' }];
    expect(await store.restore()).toBe(true);
    expect(save.adFree).toBe(true);
  });

  it('a refunded festival purchase (gone from Play) turns ads back on', async () => {
    owned = [{ productIdentifier: IAP.removeAdsFestival, purchaseState: '1' }];
    const { store, save } = await launch();
    expect(save.adFree).toBe(true);
    owned = [];
    await store.restore();
    expect(save.adFree).toBe(false);
  });
});
