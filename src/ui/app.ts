import { App as CapApp } from '@capacitor/app';
import { Capacitor, SystemBars, SystemBarsStyle } from '@capacitor/core';
import { AD_POLICY } from '../config';
import { ads } from '../services/ads';
import { save } from '../services/storage';
import { closeTopSheet } from './modal';

export interface Screen {
  name: string;
  el: HTMLElement;
  /** return true if the screen handled the back gesture itself */
  onBack?(): boolean;
  destroy?(): void;
}

let current: Screen | null = null;
const root = () => document.getElementById('app')!;
let fallbackBack: () => void = () => {};

/**
 * Replace the visible screen with a short cross-fade. Going deeper drifts in from
 * the right; returning Home drifts in from the left, so the motion reads as place.
 */
export function show(next: Screen): void {
  const prev = current;
  current = next;
  const back = !!prev && next.name === 'home';
  next.el.classList.toggle('screen--back', back);
  if (prev) {
    prev.destroy?.();
    prev.el.classList.add('screen--leaving');
    if (back) prev.el.classList.add('screen--leaving-back');
    setTimeout(() => prev.el.remove(), 200);
  }
  root().append(next.el);
  if (AD_POLICY.bannerScreens.includes(next.name) && save.onboarded) void ads.showBanner();
  else void ads.hideBanner();
}

export function setBackFallback(fn: () => void): void {
  fallbackBack = fn;
}

export function applyTheme(): void {
  const t = save.settings.theme;
  const html = document.documentElement;
  // In "auto" leave any host-provided light/dark attribute alone.
  const prev = html.getAttribute('data-theme');
  if (t === 'auto') {
    if (prev === 'paper' || prev === 'ink') html.removeAttribute('data-theme');
  } else html.setAttribute('data-theme', t);
  const hostTheme = html.getAttribute('data-theme');
  const dark = t === 'ink' || (t === 'auto' && (hostTheme === 'dark' || (hostTheme !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches)));
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#1c1b19' : '#f3ecdf');
  if (Capacitor.isNativePlatform()) {
    void SystemBars.setStyle({ style: dark ? SystemBarsStyle.Dark : SystemBarsStyle.Light }).catch(() => {});
  }
}

export function installPlatformHooks(onPause: () => void, onResume: () => void): void {
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
  document.addEventListener('visibilitychange', () => (document.hidden ? onPause() : onResume()));
  if (!Capacitor.isNativePlatform()) return;
  void CapApp.addListener('backButton', () => {
    if (closeTopSheet()) return;
    if (current?.onBack?.()) return;
    if (current?.name === 'home' || current?.name === 'welcome') void CapApp.minimizeApp();
    else fallbackBack();
  });
}

/** Web-only banner placeholder so the demo shows where the banner lives. */
export function installWebBannerPreview(): void {
  if (Capacitor.isNativePlatform()) return;
  let el: HTMLElement | null = null;
  ads.onWebBanner = (visible) => {
    if (visible && !el) {
      el = document.createElement('div');
      el.className = 'web-banner';
      el.textContent = 'Banner ad · Android only';
      document.body.append(el);
      document.documentElement.style.setProperty('--banner-h', '56px');
    } else if (!visible && el) {
      el.remove();
      el = null;
      document.documentElement.style.setProperty('--banner-h', '0px');
    }
  };
}
