import { Capacitor } from '@capacitor/core';
import { APP_VERSION, LINKS } from '../../config';
import { ads } from '../../services/ads';
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
        <div class="row"><span>Sound</span><button class="switch" role="switch" data-toggle="sound" aria-label="Sound"></button></div>
        <div class="row"><span>Haptics</span><button class="switch" role="switch" data-toggle="haptics" aria-label="Haptics"></button></div>
        <div class="row"><span>Theme</span>
          <div class="seg" role="group" aria-label="Theme">
            <button data-theme="auto">Auto</button><button data-theme="paper">Paper</button><button data-theme="ink">Ink</button>
          </div>
        </div>
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

  const sync = () => {
    el.querySelectorAll<HTMLElement>('[data-toggle]').forEach((b) => {
      const k = b.dataset.toggle as 'sound' | 'haptics';
      b.setAttribute('aria-checked', String(save.settings[k]));
    });
    el.querySelectorAll<HTMLElement>('[data-theme]').forEach((b) => b.setAttribute('aria-pressed', String(save.settings.theme === b.dataset.theme)));
  };
  sync();

  el.addEventListener('click', async (e) => {
    const t = e.target as HTMLElement;
    if (t.closest('[data-back]')) return nav.home();
    const tog = t.closest<HTMLElement>('[data-toggle]');
    if (tog) {
      const k = tog.dataset.toggle as 'sound' | 'haptics';
      save.settings[k] = !save.settings[k];
      persist();
      sync();
      return;
    }
    const th = t.closest<HTMLElement>('[data-theme]');
    if (th) {
      save.settings.theme = th.dataset.theme as Theme;
      persist();
      applyTheme();
      sync();
      return;
    }
    const act = t.closest<HTMLElement>('[data-act]')?.dataset.act;
    if (act === 'how') showHowToPlay();
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
  if (!Capacitor.isNativePlatform()) void 0;
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
