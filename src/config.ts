/**
 * Everything you must change before release lives here.
 * See docs/PLAY_STORE_RELEASE.md → "AdMob".
 */

/**
 * Google's public **test** ad units. They always fill and never earn money.
 * Replace with your own units from https://admob.google.com before release
 * (and replace the app ID in android/app/src/main/res/values/strings.xml).
 */
export const AD_UNITS = {
  banner: 'ca-app-pub-3940256099942544/9214589741',
  interstitial: 'ca-app-pub-3940256099942544/1033173712',
  rewarded: 'ca-app-pub-3940256099942544/5224354917',
};

/** true while AD_UNITS above are Google's test IDs. */
export const ADS_TEST_MODE = AD_UNITS.banner.startsWith('ca-app-pub-3940256099942544');

/** Fair-ads policy (see docs/GAME_DESIGN.md §6). */
export const AD_POLICY = {
  /** no interstitials until the player has cleared this many Journey levels */
  firstInterstitialAfterLevel: 5,
  /** at most one interstitial every N completed boards */
  interstitialEveryClears: 3,
  /** and never more often than this */
  interstitialMinSeconds: 150,
  /** banners only on these screens — never over the board */
  bannerScreens: ['home', 'album'] as string[],
};

export const ECONOMY = {
  startHints: 3,
  startShuffles: 2,
  hintCost: 20,
  shuffleCost: 15,
  petalsPerStar: 5,
  dailyPetals: 15,
  zenPetals: 3,
};

/** Public URLs (host the privacy policy from docs/privacy-policy.html, e.g. on GitHub Pages). */
export const LINKS = {
  privacy: 'https://aaravsaianugula.github.io/Jjak/privacy-policy.html',
  store: 'https://play.google.com/store/apps/details?id=com.jjak.puzzle',
};

export const APP_VERSION = '1.0.0';
