import './styles/fonts.css';
import './styles/main.css';
import './styles/game.css';
import './styles/journey.css';
import './styles/market.css';
import './styles/garden.css';
import './styles/meta.css';
import './styles/cards-extra.css';
import './styles/mechanics.css';
import './styles/demo.css';
import { SplashScreen } from '@capacitor/splash-screen';
import { Capacitor } from '@capacitor/core';
import { installCardSprite } from './art/cards';
import { ads } from './services/ads';
import { store } from './services/store';
import { haptic } from './services/haptics';
import { suspendAudio } from './services/audio';
import { music } from './services/music';
import { planReminders } from './services/reminders';
import { applyCosmetics } from './services/market';
import { flush, loadSave, save } from './services/storage';
import { applyTheme, installPlatformHooks, installWebBannerPreview, setBackFallback, show } from './ui/app';
import { nav } from './ui/nav';
import { prepareLevel } from './director';
import { prepareEndless } from './director/endless';
import { ROUTE_LEVELS } from './data/route';
import { roadWait } from './ui/reveal';
import { trackSessions } from './services/analytics';
import { albumScreen } from './ui/screens/album';
import { gameScreen } from './ui/screens/game';
import { homeScreen } from './ui/screens/home';
import { gardenScreen } from './ui/screens/garden';
import { mapScreen } from './ui/screens/map';
import { marketHooks, marketScreen } from './ui/screens/market';
import { bundlesSection } from './ui/screens/path';
import { rank } from './services/meta';
import { pathScreen } from './ui/screens/path';
import { sealsScreen } from './ui/screens/seals';
import { settingsScreen } from './ui/screens/settings';
import { welcomeScreen } from './ui/screens/welcome';

nav.home = () => show(homeScreen());
nav.game = (spec) => show(gameScreen(spec));
/** A Journey level, generated first if it is an endless one (past 600) that isn't ready yet. */
let journeyPending: number | null = null;
nav.journey = (n) => {
  if (journeyPending === n) return;
  journeyPending = n;
  // Usually instant (the next endless board is prepared in the background); if not,
  // a quiet "preparing the road" line appears after a moment.
  const slow = setTimeout(() => roadWait(true), 150);
  void prepareLevel(n)
    .then((spec) => nav.game(spec))
    .finally(() => {
      clearTimeout(slow);
      roadWait(false);
      journeyPending = null;
    });
};
nav.album = () => show(albumScreen());
nav.settings = () => show(settingsScreen());
nav.welcome = () => show(welcomeScreen());
nav.map = () => show(mapScreen());
nav.seals = () => show(sealsScreen());
nav.market = (tab) => show(marketScreen(tab));
nav.garden = () => show(gardenScreen());
nav.path = () => show(pathScreen());

// Progression plugs into the Market: petal pouches + Supporter pack, rank meters on exclusives.
marketHooks.bundlesSection = bundlesSection;
marketHooks.rank = () => rank().rank;
marketHooks.supporter = () => {
  nav.market('tools');
  setTimeout(() => document.querySelector('.supporter')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 350);
};
// A purchase changed the petal balance: redraw the Market if it's open.
document.addEventListener('jjak:petals', () => {
  if (document.querySelector('.screen.market')) nav.market('tools');
});

async function boot() {
  await loadSave();
  trackSessions();
  // Past 600: make the current endless board in the background, so Continue is instant.
  if (save.level > ROUTE_LEVELS && save.journey.revealed) void prepareEndless(save.level);
  if (import.meta.env.DEV) void import('./director/dev-panel').then((m) => m.mountDevPanel());
  applyTheme();
  installCardSprite();
  applyCosmetics();
  installWebBannerPreview();
  setBackFallback(() => nav.home());
  let heard = false;
  installPlatformHooks(
    () => {
      void flush();
      music.stop();
      suspendAudio();
    },
    () => {
      if (heard) music.refresh();
    },
  );
  // Music may only start after a user gesture (browser and WebView autoplay rules).
  document.addEventListener(
    'pointerdown',
    () => {
      heard = true;
      music.refresh();
    },
    { once: true, capture: true },
  );
  // A light tick on every button press (cards handle their own feedback).
  document.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest('button');
    if (b && !b.classList.contains('card') && !b.disabled) haptic.light();
  });

  // Wait for fonts so card glyphs never flash in a fallback face.
  try {
    await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1200))]);
  } catch {
    /* fonts API unavailable */
  }

  void store.init();
  void planReminders();
  // DEV only: ?play=<url-encoded JSON LevelSpec> opens that board directly.
  const play = import.meta.env.DEV ? new URLSearchParams(location.search).get('play') : null;
  if (play) nav.game({ mode: 'journey', number: 99, seed: 'dev', rows: 8, cols: 6, stones: 0, months: 12, variants: true, par: 120, gravity: false, snow: 0, ...JSON.parse(play) });
  else if (!save.onboarded) nav.welcome();
  else {
    nav.home();
    void ads.start().then(() => {
      // The banner may have been requested before the SDK was ready.
      if (document.querySelector('.home, .screen[data-banner]')) void ads.showBanner();
    });
  }
  if (Capacitor.isNativePlatform()) void SplashScreen.hide();
}

void boot();
