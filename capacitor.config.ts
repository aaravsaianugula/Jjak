import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // Permanent once published — change before your first Play upload if needed.
  appId: 'com.jjak.puzzle',
  appName: 'Jjak',
  webDir: 'dist',
  // No fixed background: MainActivity paints Paper or Ink from the player's theme
  // (or the phone's light/dark setting) before the page draws.
  android: {
    allowMixedContent: false,
    // Unset on purpose: Capacitor then enables chrome://inspect only for debuggable (debug) builds,
    // so device QA can profile the WebView while release builds stay locked.
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: false,
      // The splash follows the system theme natively (Theme.SplashScreen colours + drawable-night).
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
    },
    SystemBars: {
      insetsHandling: 'css',
      style: 'DEFAULT',
    },
  },
};

export default config;
