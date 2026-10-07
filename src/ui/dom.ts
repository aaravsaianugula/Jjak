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

export const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** A short, quiet note above the banner area. Long messages get a little more time. */
export function toast(text: string): void {
  document.querySelectorAll('.toast').forEach((t) => t.remove());
  const el = h('div', { class: 'toast', role: 'status', 'aria-live': 'polite' }, h('span', { class: 'toast__dot', 'aria-hidden': 'true' }), h('span', {}, text));
  const ms = Math.min(4200, 2400 + text.length * 25);
  el.style.setProperty('--toast-ms', `${ms}ms`);
  document.body.append(el);
  setTimeout(() => el.remove(), ms + 100);
}

export const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
