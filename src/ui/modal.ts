import { h } from './dom';
import { ICONS } from './icons';

export interface SheetHandle {
  el: HTMLElement;
  close(): void;
  closed: Promise<void>;
}

const stack: (SheetHandle & { dismissible: boolean })[] = [];

/**
 * Bottom sheet (or centred dialog). Tapping the scrim closes it when dismissible.
 * `close: true` adds a round close button in the top corner (for long, browsable sheets).
 */
export function openSheet(
  content: HTMLElement,
  opts: { center?: boolean; dismissible?: boolean; label?: string; close?: boolean } = {},
): SheetHandle {
  const dismissible = opts.dismissible !== false;
  const sheet = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': opts.label ?? '', tabindex: '-1' }, content);
  const scrim = h('div', { class: `scrim ${opts.center ? 'scrim--center' : 'scrim--sheet'}${dismissible ? '' : ' scrim--fixed'}` }, sheet);
  const opener = document.activeElement as HTMLElement | null;
  let resolve!: () => void;
  const closed = new Promise<void>((r) => (resolve = r));
  const handle = {
    el: sheet,
    closed,
    dismissible,
    close() {
      const i = stack.indexOf(handle);
      if (i < 0) return;
      stack.splice(i, 1);
      scrim.classList.add('is-closing');
      setTimeout(() => scrim.remove(), 280);
      if (opener?.isConnected) opener.focus({ preventScroll: true });
      resolve();
    },
  };
  if (opts.close && dismissible) {
    sheet.prepend(h('button', { class: 'icon-btn sheet__close', 'aria-label': 'Close', html: ICONS.close, onclick: () => handle.close() }));
  }
  if (dismissible) {
    scrim.addEventListener('click', (e) => {
      if (e.target === scrim) handle.close();
    });
    if (!opts.center) swipeToDismiss(sheet, () => handle.close());
  }
  stack.push(handle);
  document.body.append(scrim);
  // Move focus inside so keyboard and screen-reader users land in the dialog.
  requestAnimationFrame(() => sheet.focus({ preventScroll: true }));
  return handle;
}

/** Pull a bottom sheet down (from its top, when not scrolled) to dismiss it. */
function swipeToDismiss(sheet: HTMLElement, close: () => void): void {
  let y0 = 0;
  let dy = 0;
  let dragging = false;
  let armed = false;
  sheet.addEventListener(
    'touchstart',
    (e) => {
      armed = sheet.scrollTop <= 0 && e.touches.length === 1;
      y0 = e.touches[0].clientY;
      dy = 0;
      dragging = false;
    },
    { passive: true },
  );
  sheet.addEventListener(
    'touchmove',
    (e) => {
      if (!armed) return;
      dy = e.touches[0].clientY - y0;
      if (!dragging && dy > 8) {
        dragging = true;
        sheet.style.transition = 'none';
      }
      if (!dragging) {
        if (dy < -4) armed = false; // scrolling up: let the sheet scroll
        return;
      }
      e.preventDefault();
      sheet.style.transform = `translateY(${Math.max(0, dy - 8)}px)`;
    },
    { passive: false },
  );
  const end = () => {
    if (!dragging) return;
    dragging = false;
    sheet.style.transition = 'transform 240ms cubic-bezier(0.2, 0.8, 0.2, 1)';
    if (dy > Math.min(140, sheet.offsetHeight * 0.25)) {
      sheet.style.transform = 'translateY(calc(100% + 24px))';
      close();
    } else sheet.style.transform = '';
  };
  sheet.addEventListener('touchend', end);
  sheet.addEventListener('touchcancel', end);
}

/** Android back (and Escape on the web): close the top sheet if it allows it. Returns true if handled. */
export function closeTopSheet(): boolean {
  const top = stack[stack.length - 1];
  if (!top) return false;
  if (top.dismissible) top.close();
  return true;
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && stack.length) {
    e.preventDefault();
    closeTopSheet();
  }
});

export const sheetOpen = () => stack.length > 0;

/** Simple choice dialog. Resolves with the chosen key, or null if dismissed. */
export function choose(
  title: string,
  body: string,
  options: { key: string; label: string; style?: 'primary' | 'accent' | 'ghost' | 'quiet'; disabled?: boolean }[],
): Promise<string | null> {
  return new Promise((resolve) => {
    let picked: string | null = null;
    const actions = h('div', { class: 'sheet__actions' });
    const content = h('div', { class: 'dialog' }, h('h2', {}, title), h('p', { class: 'muted' }, body), actions);
    const sheet = openSheet(content, { center: true, label: title });
    for (const o of options) {
      actions.append(
        h(
          'button',
          {
            class: `btn btn--${o.style ?? 'ghost'} btn--block`,
            disabled: o.disabled,
            onclick: () => {
              picked = o.key;
              sheet.close();
            },
          },
          o.label,
        ),
      );
    }
    void sheet.closed.then(() => resolve(picked));
  });
}
