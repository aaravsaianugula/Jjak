import './styles/fonts.css';
import './styles/main.css';
import './styles/game.css';
import './styles/journey.css';
import './styles/market.css';
import './styles/garden.css';
import './styles/meta.css';
import './styles/cards-extra.css';
import { SplashScreen } from '@capacitor/splash-screen';
import { Capacitor } from '@capacitor/core';
import { installCardSprite } from './art/cards';
import { ads } from './services/ads';
import { store } from './services/store';
import { haptic } from './services/haptics';
import { music } from './services/music';
import { planReminders } from './services/reminders';
import { flush, loadSave, save } from './services/storage';
import { applyTheme, installPlatformHooks, installWebBannerPreview, setBackFallback, show } from './ui/app';
import { nav } from './ui/nav';
import { albumScreen } from './ui/screens/album';
import { gameScreen } from './ui/screens/game';
import { homeScreen } from './ui/screens/home';
import { gardenScreen } from './ui/screens/garden';
import { mapScreen } from './ui/screens/map';
import { marketScreen } from './ui/screens/market';
import { pathScreen } from './ui/screens/path';
import { sealsScreen } from './ui/screens/seals';
import { settingsScreen } from './ui/screens/settings';
import { welcomeScreen } from './ui/screens/welcome';

nav.home = () => show(homeScreen());
nav.game = (spec) => show(gameScreen(spec));
nav.album = () => show(albumScreen());
nav.settings = () => show(settingsScreen());
nav.welcome = () => show(welcomeScreen());
nav.map = () => show(mapScreen());
nav.seals = () => show(sealsScreen());
nav.market = () => show(marketScreen());
nav.garden = () => show(gardenScreen());
nav.path = () => show(pathScreen());

async function boot() {
  await loadSave();
  applyTheme();
  installCardSprite();
  installWebBannerPreview();
  setBackFallback(() => nav.home());
  let heard = false;
  installPlatformHooks(
    () => {
      void flush();
      music.stop();
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
  if (!save.onboarded) nav.welcome();
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
