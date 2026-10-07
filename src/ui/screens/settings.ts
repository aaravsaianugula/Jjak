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
  const el = frag(`<section class="screen">
    <header class="topbar">
      <button class="icon-btn" data-back aria-label="Back">${ICONS.back}</button>
      <div class="topbar__title">Settings</div>
      <span style="width:44px"></span>
    </header>
    <div class="scroll" style="flex:1;padding-top:8px">
      <div class="section-label">Play</div>
      <div class="list">
        <div class="row"><span>Sound effects</span><button class="switch" role="switch" data-toggle="sound" aria-label="Sound effects"></button></div>
        <div class="row"><span>Music<small>Generative, changes with the seasons</small></span><button class="switch" role="switch" data-toggle="music" aria-label="Music"></button></div>
        <div class="row"><span>Haptics</span><button class="switch" role="switch" data-toggle="haptics" aria-label="Haptics"></button></div>
        <div class="row row--wrap"><span>Daily reminder<small>A quiet nudge when the new Daily is ready</small></span>
          <div class="seg" role="group" aria-label="Daily reminder">
            <button data-remind="off">Off</button>${REMINDER_TIMES.map((t) => `<button data-remind="${t.hour}">${t.hour}:00</button>`).join('')}
          </div>
        </div>
        <button class="row" data-act="paper"><span>Board paper<small data-paper-name></small></span><span class="muted">›</span></button>
        <div class="row"><span>Theme</span>
          <div class="seg" role="group" aria-label="Theme">
            <button data-set-theme="auto">Auto</button><button data-set-theme="paper">Paper</button><button data-set-theme="ink">Ink</button>
          </div>
        </div>
      </div>
      <div class="section-label">Support Jjak</div>
      <div class="list">
        ${save.adFree
          ? `<div class="row"><span>Ads removed<small>Thank you for supporting Jjak. Optional reward ads stay available.</small></span><span class="muted">✓</span></div>`
          : `<button class="row" data-act="buy"><span>Remove ads<small>No ads between boards and no banners. Rewards you choose stay optional.</small></span><span class="price">${store.available ? esc(store.price) : 'Android'}</span></button>`}
        <button class="row" data-act="restore"><span>Restore purchase<small>Already bought it on another device?</small></span><span class="muted">›</span></button>
      </div>
      <div class="section-label">Help</div>
      <div class="list">
        <button class="row" data-act="how"><span>How to play</span><span class="muted">›</span></button>
      </div>
      <div class="section-label">Privacy</div>
      <div class="list">
        ${ads.privacyOptionsRequired ? `<button class="row" data-act="consent"><span>Ad privacy choices<small>Change your consent</small></span><span class="muted">›</span></button>` : ''}
        <a class="row" href="${esc(LINKS.privacy)}" target="_blank" rel="noopener" style="color:inherit;text-decoration:none"><span>Privacy policy</span><span class="muted">↗</span></a>
        <button class="row" data-act="reset"><span>Reset progress<small>Clears levels, petals and album</small></span><span class="muted">›</span></button>
      </div>
      <p class="fineprint" style="text-align:center;margin:18px 0 8px">Jjak ${APP_VERSION} · Original artwork inspired by traditional Hwatu & Hanafuda.<br>Fonts: Gowun Batang, Gowun Dodum, Zen Old Mincho (SIL OFL).</p>
    </div>
  </section>`);

  const paperName = () => (save.paper === 'plain' ? 'Plain hanji' : MONTHS[Number(save.paper)].en);
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
    <h2>How to play</h2>
    <p><b>Make a jjak (짝).</b> Tap two cards of the same flower. Every card shows its month number in the corner — matching numbers always pair.</p>
    <p><b>Mind the path.</b> The two cards must connect with a line of up to three straight strokes (two turns) that crosses only empty space. The line may travel around the outside of the board.</p>
    <p><b>Chain combos.</b> Make your next pair within four seconds to build a combo: 짝짝, 짝짝짝…</p>
    <p><b>Three blossoms per board:</b> clear it, use no hints or shuffles, and beat the par time.</p>
    <p><b>Stuck?</b> If no pairs are possible the board reshuffles itself. Hints and shuffles are there when you want them.</p>
    <p class="muted">Daily Jjak gives everyone in the world the same board each day. Zen has no clock at all.</p>
  </div>`);
  const btn = h('button', { class: 'btn btn--primary btn--block', style: 'margin-top:12px' }, 'Close');
  content.append(btn);
  const s = openSheet(content, { label: 'How to play' });
  btn.addEventListener('click', () => s.close());
}

/** Board papers: one per flower, unlocked by collecting all four of its cards. */
function pickPaper(): Promise<void> {
  const done = new Set(completedMonths());
  const swatch = (key: string, name: string, tint: string, motif: number, locked: boolean) => `
    <button class="swatch ${save.paper === key ? 'is-on' : ''}" data-paper="${key}" ${locked ? 'disabled' : ''} aria-label="${esc(name)}${locked ? ', locked' : ''}">
      <span class="swatch__face" style="--paper-tint:${tint}">${motif >= 0 ? `<svg viewBox="0 0 100 140"><use href="#motif-${motif}"/></svg>` : ''}</span>
      <span class="swatch__name">${esc(name)}</span>
      ${locked ? '<span class="swatch__lock">Collect all 4</span>' : ''}
    </button>`;
  const content = frag(`<div>
    <h2>Board paper</h2>
    <p class="muted">Collect all four cards of a flower in the Album to unlock its paper.</p>
    <div class="swatches">
      ${swatch('plain', 'Plain hanji', 'transparent', -1, false)}
      ${MONTHS.map((m) => swatch(String(m.index), m.en, MONTH_TINTS[m.index], m.index, !done.has(m.index))).join('')}
    </div>
  </div>`);
  const sheet = openSheet(content, { label: 'Board paper' });
  content.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-paper]');
    if (!b || b.disabled) return;
    save.paper = b.dataset.paper!;
    persist();
    sheet.close();
  });
  return sheet.closed;
}
