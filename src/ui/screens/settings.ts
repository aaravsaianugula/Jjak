import { MONTH_TINTS } from '../../art/cards';
import { MONTHS } from '../../data/deck';
import { completedMonths } from '../../services/progress';
import { APP_VERSION, LINKS } from '../../config';
import { ads } from '../../services/ads';
import { store } from '../../services/store';
import { music } from '../../services/music';
import { REMINDER_TIMES, disableReminder, enableReminder } from '../../services/reminders';
import { resetSave, save, persist, type Theme } from '../../services/storage';
import { applyTheme, type Screen } from '../app';
import { esc, frag, h, toast } from '../dom';
import { ICONS } from '../icons';
import { choose, openSheet } from '../modal';
import { nav } from '../nav';

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
          : `<button class="row row--feature" data-act="buy">${row(ICONS.heart, 'Remove ads', 'No ads between boards and no banners. Rewards you choose stay optional.')}<span class="price${store.available ? '' : ' price--off'}">${store.available ? esc(store.price) : 'Android'}</span></button>`}
        <button class="row" data-act="restore">${row(ICONS.restart, 'Restore purchase', 'Already bought it on another device?')}${chevron}</button>
      </div>
      <h2 class="section-label" id="set-help">Help &amp; privacy</h2>
      <div class="list list--icons" role="group" aria-labelledby="set-help">
        <button class="row" data-act="how">${row(ICONS.help, 'How to play')}${chevron}</button>
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

  const paperName = () => (save.paper === 'plain' ? 'Plain hanji' : `${MONTHS[Number(save.paper)].en} paper`);
  const sync = () => {
    el.querySelectorAll<HTMLElement>('[data-remind]').forEach((b) =>
      b.setAttribute('aria-pressed', String(b.dataset.remind === (save.reminder.hour == null ? 'off' : String(save.reminder.hour)))),
    );
    el.querySelector('[data-paper-name]')!.textContent = paperName();
    el.querySelectorAll<HTMLElement>('[data-toggle]').forEach((b) => {
      const k = b.dataset.toggle as 'sound' | 'music' | 'haptics';
      b.setAttribute('aria-checked', String(save.settings[k]));
    });
    el.querySelectorAll<HTMLElement>('[data-set-theme]').forEach((b) => b.setAttribute('aria-pressed', String(save.settings.theme === b.dataset.setTheme)));
  };
  sync();

  el.addEventListener('click', async (e) => {
    const t = e.target as HTMLElement;
    if (t.closest('[data-back]')) return nav.home();
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
    if (act === 'how') showHowToPlay();
    if (act === 'buy') {
      if (!store.available) return toast('Remove ads is available in the Android app from Google Play.');
      if (await store.buyRemoveAds()) {
        toast('Ads removed. Thank you!');
        nav.settings();
      }
    }
    if (act === 'restore') {
      const owned = await store.restore();
      toast(owned ? 'Purchase restored. Ads are off.' : 'No purchase found for this Google account.');
      if (owned) nav.settings();
    }
    if (act === 'paper') {
      await pickPaper();
      sync();
    }
    if (act === 'consent') await ads.showPrivacyOptions();
    if (act === 'reset') {
      const ok = await choose('Reset all progress?', 'Levels, stars, petals, streaks and your album will be erased. This can’t be undone.', [
        { key: 'yes', label: 'Erase progress', style: 'accent' },
        { key: 'no', label: 'Cancel', style: 'quiet' },
      ]);
      if (ok === 'yes') {
        await resetSave();
        toast('Progress reset');
        nav.home();
      }
    }
  });
  return { name: 'settings', el };
}

export function showHowToPlay(): void {
  const content = frag(`<div>
    <div class="sheet__head">
      <div class="detail__kind">How to play · <span lang="ko">방법</span></div>
      <h2>Make a jjak</h2>
    </div>
    <ol class="howto">
      <li><span><b>Tap two cards of the same flower.</b>Every card shows its month number in the corner. Matching numbers always pair.</span></li>
      <li><span><b>Mind the path.</b>The two cards must connect with a line of up to three straight strokes (two turns) that crosses only empty space. The line may travel around the outside of the board.</span></li>
      <li><span><b>Chain combos.</b>Make your next pair within four seconds to build a combo: 짝짝, 짝짝짝…</span></li>
      <li><span><b>Three blossoms per board.</b>Clear it, use no hints or shuffles, and beat the par time.</span></li>
      <li><span><b>Stuck?</b>If no pairs are possible the board reshuffles itself. Hints and shuffles are there when you want them.</span></li>
    </ol>
    <p class="howto__foot">Daily Jjak gives everyone in the world the same board each day. Zen has no clock at all.</p>
  </div>`);
  const btn = h('button', { class: 'btn btn--primary btn--block', style: 'margin-top:16px' }, 'Got it');
  content.append(btn);
  const s = openSheet(content, { label: 'How to play', close: true });
  btn.addEventListener('click', () => s.close());
}

/** Board papers: one per flower, unlocked by collecting all four of its cards. */
function pickPaper(): Promise<void> {
  const done = new Set(completedMonths());
  const swatch = (key: string, name: string, tint: string, motif: number, locked: boolean) => `
    <button class="swatch ${save.paper === key ? 'is-on' : ''}" data-paper="${key}" ${locked ? 'disabled' : ''} aria-pressed="${save.paper === key}" aria-label="${esc(name)}${locked ? ', locked. Collect all four cards of this flower' : ''}">
      <span class="swatch__face" style="--paper-tint:${tint}">${motif >= 0 ? `<svg class="swatch__motif" viewBox="0 0 100 140" aria-hidden="true"><use href="#motif-${motif}"/></svg>` : ''}${save.paper === key ? `<span class="swatch__check" aria-hidden="true">${ICONS.check}</span>` : ''}</span>
      <span class="swatch__name">${esc(name)}</span>
      ${locked ? '<span class="swatch__lock" aria-hidden="true">Collect all 4</span>' : ''}
    </button>`;
  const content = frag(`<div>
    <div class="sheet__head">
      <div class="detail__kind">Board paper · ${done.size + 1} of 13 unlocked</div>
      <h2>Choose a paper</h2>
      <p class="muted">Collect all four cards of a flower in the Album to unlock its paper.</p>
    </div>
    <div class="swatches">
      ${swatch('plain', 'Plain hanji', 'transparent', -1, false)}
      ${MONTHS.map((m) => swatch(String(m.index), m.en, MONTH_TINTS[m.index], m.index, !done.has(m.index))).join('')}
    </div>
  </div>`);
  const sheet = openSheet(content, { label: 'Board paper', close: true });
  content.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-paper]');
    if (!b || b.disabled) return;
    save.paper = b.dataset.paper!;
    persist();
    sheet.close();
  });
  return sheet.closed;
}
