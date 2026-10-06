import { h } from './dom';

export interface SheetHandle {
  el: HTMLElement;
  close(): void;
  closed: Promise<void>;
}

const stack: SheetHandle[] = [];

/** Bottom sheet (or centred dialog). Tapping the scrim closes it when dismissible. */
export function openSheet(content: HTMLElement, opts: { center?: boolean; dismissible?: boolean; label?: string } = {}): SheetHandle {
  const sheet = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': opts.label ?? '' }, content);
  const scrim = h('div', { class: `scrim${opts.center ? ' scrim--center' : ''}` }, sheet);
  let resolve!: () => void;
  const closed = new Promise<void>((r) => (resolve = r));
  const handle: SheetHandle = {
    el: sheet,
    closed,
    close() {
      const i = stack.indexOf(handle);
      if (i < 0) return;
      stack.splice(i, 1);
      scrim.style.transition = 'opacity 160ms';
      scrim.style.opacity = '0';
      setTimeout(() => scrim.remove(), 170);
      resolve();
    },
  };
  if (opts.dismissible !== false) {
    scrim.addEventListener('click', (e) => {
      if (e.target === scrim) handle.close();
    });
  }
  (handle as SheetHandle & { dismissible: boolean }).dismissible = opts.dismissible !== false;
  stack.push(handle);
  document.body.append(scrim);
  return handle;
}

/** Android back: close the top sheet if it allows it. Returns true if handled. */
export function closeTopSheet(): boolean {
  const top = stack[stack.length - 1] as (SheetHandle & { dismissible?: boolean }) | undefined;
  if (!top) return false;
  if (top.dismissible) top.close();
  return true;
}

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
    const content = h('div', {}, h('h2', {}, title), h('p', { class: 'muted' }, body), actions);
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
