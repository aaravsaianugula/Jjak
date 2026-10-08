/** Tiny DOM helpers — enough structure without a framework. */

type Attrs = Record<string, string | number | boolean | null | undefined | EventListener>;

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  ...children: (Node | string | null | undefined | false)[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') el.innerHTML = String(v);
    else if (k === 'class') el.className = String(v);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children) if (c != null && c !== false) el.append(c);
  return el;
}

/** Build from an HTML string (trusted, app-authored markup only). */
export function frag(html: string): HTMLElement {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild as HTMLElement;
}

/** A count for display: digits grouped the same way everywhere (1,840). */
export const fmt = (n: number): string => n.toLocaleString('en-US');

export const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/**
 * A short, quiet note above the banner area. Long messages get a little more time.
 * A newer note never stacks on an older one: the old one steps aside first.
 */
export function toast(text: string): void {
  let replacing = false;
  document.querySelectorAll<HTMLElement>('.toast').forEach((t) => {
    if (t.classList.contains('is-out')) return;
    replacing = true;
    t.classList.add('is-out');
    setTimeout(() => t.remove(), 180);
  });
  const el = h('div', { class: 'toast', role: 'status', 'aria-live': 'polite' }, h('span', { class: 'toast__dot', 'aria-hidden': 'true' }), h('span', {}, text));
  const ms = Math.min(4200, 2400 + text.length * 25);
  const delay = replacing ? 140 : 0;
  el.style.setProperty('--toast-ms', `${ms}ms`);
  if (delay) el.style.animationDelay = `${delay}ms`;
  document.body.append(el);
  setTimeout(() => el.remove(), ms + delay + 100);
}

export const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
