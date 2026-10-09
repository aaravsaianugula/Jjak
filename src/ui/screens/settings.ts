import { APP_VERSION, LINKS } from '../../config';
import { applyCosmetics, paperName } from '../../services/market';
import { ads } from '../../services/ads';
import { store } from '../../services/store';
import { Capacitor } from '@capacitor/core';
import { openRemoveAds } from '../remove-ads';
import { music } from '../../services/music';
import { REMINDER_TIMES, disableReminder, enableReminder } from '../../services/reminders';
import { resetSave, save, persist, type Theme } from '../../services/storage';
import { applyTheme, type Screen } from '../app';
import { esc, frag, h, toast } from '../dom';
import { ICONS } from '../icons';
import { choose, openSheet } from '../modal';
import { nav } from '../nav';
import { slidePill } from '../motion';
import { MECHANIC_IDS, MECHANICS } from '../../engine/mechanics';
import { DemoPlayer } from '../demo';
import { type DemoScript, BASIC_DEMOS, GOAL_DEMOS, MECHANIC_DEMOS, VARIANTS_DEMO } from '../demos';
import { practiceMet } from './practice';
import { replayIntro } from './welcome';

export function settingsScreen(): Screen {
  const row = (icon: string, title: string, sub = '') => `<span class="row__icon" aria-hidden="true">${icon}</span><span class="row__text">${title}${sub ? `<small>${sub}</small>` : ''}</span>`;
  const chevron = `<span class="row__end" aria-hidden="true">${ICONS.chevron}</span>`;
  const el = frag(`<section class="screen settings">
    <header class="topbar">
      <button class="icon-btn" data-back aria-label="Back">${ICONS.back}</button>
      <div class="topbar__title"><h1>Settings</h1></div>
      <span class="topbar__spacer"></span>
    </header>
    <div class="scroll screen__body">
      <h2 class="section-label" id="set-sound">Sound &amp; feel</h2>
      <div class="list list--icons" role="group" aria-labelledby="set-sound">
        <div class="row">${row(ICONS.sound, 'Sound effects')}<button class="switch" role="switch" data-toggle="sound" aria-label="Sound effects"></button></div>
        <div class="row">${row(ICONS.music, 'Music', 'Generative, changes with the seasons')}<button class="switch" role="switch" data-toggle="music" aria-label="Music"></button></div>
        <div class="row">${row(ICONS.haptics, 'Haptics', 'A light tap when cards pair')}<button class="switch" role="switch" data-toggle="haptics" aria-label="Haptics"></button></div>
      </div>
      <h2 class="section-label" id="set-look">Look</h2>
      <div class="list list--icons" role="group" aria-labelledby="set-look">
        <div class="row">${row(ICONS.theme, 'Theme')}
          <div class="seg" role="group" aria-label="Theme">
            <button data-set-theme="auto">Auto</button><button data-set-theme="paper">Paper</button><button data-set-theme="ink">Ink</button>
          </div>
        </div>
        <button class="row" data-act="paper">${row(ICONS.paper, 'Board paper', '<span data-paper-name></span>')}${chevron}</button>
      </div>
      <h2 class="section-label" id="set-daily">Daily</h2>
      <div class="list list--icons" role="group" aria-labelledby="set-daily">
        <div class="row row--stack">${row(ICONS.bell, 'Daily reminder', 'A quiet nudge when the new Daily is ready')}
          <div class="seg" role="group" aria-label="Daily reminder time">
            <button data-remind="off">Off</button>${REMINDER_TIMES.map((t) => `<button data-remind="${t.hour}">${t.hour}:00</button>`).join('')}
          </div>
        </div>
      </div>
      <h2 class="section-label" id="set-support">Support Jjak</h2>
      <div class="list list--icons" role="group" aria-labelledby="set-support">
        ${save.adFree
          ? `<div class="row row--feature">${row(ICONS.heart, 'Ads removed', 'Thank you for supporting Jjak. Optional reward ads stay available.')}<span class="row__end" style="color:var(--good-text)" aria-hidden="true">${ICONS.check}</span></div>`
          : `<button class="row row--feature" data-act="buy">${row(ICONS.heart, 'Remove ads', 'No ads between boards and no banners. Rewards you choose stay optional.')}${store.available ? `<span class="price">${esc(store.price)}</span>` : Capacitor.isNativePlatform() ? chevron : '<span class="price price--off">Android</span>'}</button>`}
        <button class="row" data-act="restore">${row(ICONS.restart, 'Restore purchase', 'Already bought it on another device?')}${chevron}</button>
      </div>
      <h2 class="section-label" id="set-help">Help &amp; privacy</h2>
      <div class="list list--icons" role="group" aria-labelledby="set-help">
        <button class="row" data-act="how">${row(ICONS.help, 'How to play')}${chevron}</button>
        ${practiceMet().length ? `<button class="row" data-act="practice">${row(ICONS.play, 'Practice', 'Intros and gentle boards for ideas you’ve met')}${chevron}</button>` : ''}
        ${ads.privacyOptionsRequired ? `<button class="row" data-act="consent">${row(ICONS.shield, 'Ad privacy choices', 'Change your consent')}${chevron}</button>` : ''}
        <a class="row" href="${esc(LINKS.privacy)}" target="_blank" rel="noopener">${row(ICONS.doc, 'Privacy policy')}<span class="row__end" aria-hidden="true">${ICONS.external}</span><span class="sr-only">(opens in browser)</span></a>
        <button class="row row--danger" data-act="reset">${row(ICONS.trash, 'Reset progress', 'Clears levels, petals and album')}${chevron}</button>
      </div>
      <footer class="about">
        <span class="seal" aria-hidden="true">짝</span>
        <span class="about__name">Jjak <span class="muted">${APP_VERSION}</span></span>
        <p class="fineprint">Original artwork inspired by traditional Hwatu &amp; Hanafuda.<br>Fonts: Gowun Batang, Gowun Dodum, Zen Old Mincho (SIL OFL).</p>
      </footer>
    </div>
  </section>`);

  const sync = () => {
    el.querySelectorAll<HTMLElement>('[data-remind]').forEach((b) =>
      b.setAttribute('aria-pressed', String(b.dataset.remind === (save.reminder.hour == null ? 'off' : String(save.reminder.hour)))),
    );
    el.querySelector('[data-paper-name]')!.textContent = `${paperName()} · choose in the Market`;
    el.querySelectorAll<HTMLElement>('[data-toggle]').forEach((b) => {
      const k = b.dataset.toggle as 'sound' | 'music' | 'haptics';
      b.setAttribute('aria-checked', String(save.settings[k]));
    });
    el.querySelectorAll<HTMLElement>('[data-set-theme]').forEach((b) => b.setAttribute('aria-pressed', String(save.settings.theme === b.dataset.setTheme)));
    el.querySelectorAll<HTMLElement>('.seg').forEach(slidePill);
  };
  sync();

  el.addEventListener('click', async (e) => {
    const t = e.target as HTMLElement;
    if (t.closest('button[data-back]')) return nav.home();
    const tog = t.closest<HTMLElement>('[data-toggle]');
    if (tog) {
      const k = tog.dataset.toggle as 'sound' | 'music' | 'haptics';
      save.settings[k] = !save.settings[k];
      persist();
      if (k === 'music') music.refresh();
      sync();
      return;
    }
    const rm = t.closest<HTMLElement>('[data-remind]');
    if (rm) {
      if (rm.dataset.remind === 'off') await disableReminder();
      else if (!(await enableReminder(Number(rm.dataset.remind)))) toast('Notifications are off for Jjak. Allow them in Android settings.');
      sync();
      return;
    }
    const th = t.closest<HTMLElement>('[data-set-theme]');
    if (th) {
      save.settings.theme = th.dataset.setTheme as Theme;
      persist();
      applyTheme();
      sync();
      return;
    }
    const act = t.closest<HTMLElement>('[data-act]')?.dataset.act;
    if (act === 'how') showHowToPlay({ practice: true });
    if (act === 'practice') nav.practice();
    if (act === 'buy') {
      if (!Capacitor.isNativePlatform()) return toast('Remove ads is available in the Android app from Google Play.');
      if (await openRemoveAds()) nav.settings();
    }
    if (act === 'restore') {
      const owned = await store.restore();
      toast(owned ? 'Purchase restored. Ads are off.' : 'No purchase found for this Google account.');
      if (owned) nav.settings();
    }
    // The paper picker lives in the Market now.
    if (act === 'paper') return nav.market('papers');
    if (act === 'consent') await ads.showPrivacyOptions();
    if (act === 'reset') {
      const ok = await choose('Reset all progress?', 'Levels, stars, petals, streaks and your album will be erased. This can’t be undone.', [
        { key: 'yes', label: 'Erase progress', style: 'accent' },
        { key: 'no', label: 'Cancel', style: 'quiet' },
      ]);
      if (ok === 'yes') {
        await resetSave();
        applyCosmetics();
        toast('Progress reset');
        nav.home();
      }
    }
  });
  return { name: 'settings', el };
}

/**
 * How to play: short and visual. Small looping demo tiles (the pair rule,
 * bends, combos, every mechanic, goals), one line each for the Market, Garden
 * and Flower Path, and Replay intro.
 */
export function showHowToPlay(opts: { practice?: boolean } = {}): void {
  const tiles: { label: string; script: DemoScript; wide?: boolean }[] = [
    { label: 'Same flower', script: VARIANTS_DEMO },
    { label: 'Up to two bends', script: BASIC_DEMOS.bends },
    { label: 'Never three', script: BASIC_DEMOS.blocked },
    { label: 'Combos · Fever', script: BASIC_DEMOS.fever },
    ...MECHANIC_IDS.map((m) => ({ label: MECHANICS[m].name, script: MECHANIC_DEMOS[m] })),
    { label: 'Level goals', script: GOAL_DEMOS.straight, wide: true },
  ];
  const players = tiles.map((t) => new DemoPlayer(t.script, { size: 'tile' }));
  const content = frag(`<div class="howto">
    <div class="sheet__head">
      <div class="detail__kind">How to play · <span lang="ko">방법</span></div>
      <h2>Make a jjak</h2>
    </div>
    <div class="howto__tiles"></div>
    <ul class="howto__more">
      <li><span class="howto__glyph ja" aria-hidden="true">市</span><span><b>Market</b>Petals buy papers, brushes and garden pieces.</span></li>
      <li><span class="howto__glyph ja" aria-hidden="true">庭</span><span><b>Garden</b>Place your pieces; a visitor calls each day.</span></li>
      <li><span class="howto__glyph ja" aria-hidden="true">道</span><span><b>Flower Path</b>Every board earns rank, missions and chests.</span></li>
    </ul>
  </div>`);
  const grid = content.querySelector('.howto__tiles')!;
  tiles.forEach((t, i) => {
    const fig = h('figure', { class: `howto__tile${t.wide ? ' howto__tile--wide' : ''}` }, players[i].el, h('figcaption', {}, t.label));
    grid.append(fig);
  });
  const replay = h('button', { class: 'btn btn--ghost btn--block', html: `${ICONS.play}<span>Replay intro</span>` });
  const btn = h('button', { class: 'btn btn--primary btn--block' }, 'Got it');
  // The Practice room, once there's something in it (not from a board: leaving would quit it).
  const practice = opts.practice && practiceMet().length ? h('button', { class: 'btn btn--ghost btn--block', html: `${ICONS.play}<span>Practice room</span>` }) : null;
  content.append(h('div', { class: 'sheet__actions' }, ...(practice ? [practice] : []), replay, btn));
  const s = openSheet(content, { label: 'How to play', close: true });
  btn.addEventListener('click', () => s.close());
  practice?.addEventListener('click', () => {
    s.close();
    nav.practice();
  });
  replay.addEventListener('click', () => replayIntro());

  // Loop only the tiles on screen.
  const running = new Set<number>();
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const i = Number((e.target as HTMLElement).dataset.tile);
        if (e.isIntersecting && !running.has(i)) {
          running.add(i);
          void players[i].play(Infinity, { fresh: true });
        } else if (!e.isIntersecting && running.has(i)) {
          running.delete(i);
          players[i].load(tiles[i].script);
        }
      }
    },
    { root: s.el, threshold: 0.4 },
  );
  players.forEach((p, i) => {
    p.el.dataset.tile = String(i);
    io.observe(p.el);
  });
  void s.closed.then(() => {
    io.disconnect();
    players.forEach((p) => p.destroy());
  });
}
