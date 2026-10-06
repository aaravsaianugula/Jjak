import './styles/fonts.css';
import './styles/main.css';
import { SplashScreen } from '@capacitor/splash-screen';
import { Capacitor } from '@capacitor/core';
import { installCardSprite } from './art/cards';
import { ads } from './services/ads';
import { flush, loadSave, save } from './services/storage';
import { applyTheme, installPlatformHooks, installWebBannerPreview, setBackFallback, show } from './ui/app';
import { nav } from './ui/nav';
import { albumScreen } from './ui/screens/album';
import { gameScreen } from './ui/screens/game';
import { homeScreen } from './ui/screens/home';
import { settingsScreen } from './ui/screens/settings';
import { welcomeScreen } from './ui/screens/welcome';

nav.home = () => show(homeScreen());
nav.game = (spec) => show(gameScreen(spec));
nav.album = () => show(albumScreen());
nav.settings = () => show(settingsScreen());
nav.welcome = () => show(welcomeScreen());

async function boot() {
  await loadSave();
  applyTheme();
  installCardSprite();
  installWebBannerPreview();
  setBackFallback(() => nav.home());
  installPlatformHooks(() => void flush(), () => {});

  // Wait for fonts so card glyphs never flash in a fallback face.
  try {
    await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1200))]);
  } catch {
    /* fonts API unavailable */
  }

  if (save.birthYear == null) nav.welcome();
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
