/** Hand-tuned 24px line icons (stroke = currentColor). */
const icon = (d: string, extra = '') =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${d}</svg>`;

export const ICONS = {
  back: icon('<path d="M15 5l-7 7 7 7"/>'),
  close: icon('<path d="M6 6l12 12M18 6L6 18"/>'),
  gear: icon('<circle cx="12" cy="12" r="3.2"/><path d="M12 2.8v2.4M12 18.8v2.4M4.2 7.5l2.1 1.2M17.7 15.3l2.1 1.2M4.2 16.5l2.1-1.2M17.7 8.7l2.1-1.2"/><circle cx="12" cy="12" r="7"/>'),
  hint: icon('<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.7.5 1.1 1.3 1.1 2.2h5c0-.9.4-1.7 1.1-2.2A6 6 0 0 0 12 3z"/>'),
  shuffle: icon('<path d="M4 7h3.5c2.5 0 3.5 1.5 5 5s2.5 5 5 5H20"/><path d="M4 17h3.5c1.3 0 2.2-.4 2.9-1.2M13.6 8.2c.7-.8 1.6-1.2 2.9-1.2H20"/><path d="M17.5 4.5L20 7l-2.5 2.5M17.5 14.5L20 17l-2.5 2.5"/>'),
  restart: icon('<path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v4.5h4.5"/>'),
  share: icon('<path d="M12 15V4M8 8l4-4 4 4"/><path d="M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5"/>'),
  play: icon('<path d="M8 5.5v13l10.5-6.5z" fill="currentColor" stroke="none"/>'),
  ad: icon('<rect x="3" y="6" width="18" height="12" rx="3"/><path d="M10 9.5v5l4.2-2.5z" fill="currentColor" stroke="none"/>'),
  star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2.6l2.9 6 6.5.9-4.7 4.6 1.1 6.5L12 17.5l-5.8 3.1 1.1-6.5L2.6 9.5l6.5-.9z"/></svg>',
  petal:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#d98a98" d="M12 21c-4.5-2.6-7-6.3-7-10.2C5 6.6 8.2 3 12 3s7 3.6 7 7.8c0 3.9-2.5 7.6-7 10.2z"/><path fill="#c4677a" d="M12 21c-1.2-3.4-1.4-7-.2-11.2.3 4.1 1 7.6.2 11.2z" opacity=".6"/></svg>',
};
