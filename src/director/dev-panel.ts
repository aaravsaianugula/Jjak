/**
 * Dev builds only (main.ts mounts it behind `import.meta.env.DEV`, as a dynamic
 * import, so it never ships): a small collapsible chip, bottom-left, that shows what
 * the Level Director and the player model think. Updates when a board starts or ends.
 */
import '../styles/dev.css';
import { mechanicsOf } from '../engine/mechanics';
import type { LevelSpec } from '../engine/levels';
import { on } from '../services/events';
import { save } from '../services/storage';
import { cleanRate, targetFor } from './director';
import { engagement, parRatio, performance, specD } from './model';
import { playStyle } from './profile';

const f2 = (v: number) => (Number.isFinite(v) ? v.toFixed(2) : '–');
const sec = (ms: number) => (ms >= 0 ? `${(ms / 1000).toFixed(1)}s` : '–');
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c);

let current: LevelSpec | null = null;
let open = false;

function row(label: string, value: string): string {
  return `<div class="devp__row"><span>${esc(label)}</span><b>${esc(value)}</b></div>`;
}

function render(root: HTMLElement): void {
  const a = save.analytics;
  const chip = root.querySelector<HTMLButtonElement>('.devp__chip')!;
  const body = root.querySelector<HTMLElement>('.devp__body')!;
  const last = a.last;
  chip.textContent = `R ${f2(a.rating)}±${f2(a.dev)}${last ? ` · t${last.tier}` : ''}`;
  chip.setAttribute('aria-expanded', String(open));
  body.hidden = !open;
  if (!open) return;

  const eng = engagement(a);
  const rate = cleanRate(a);
  const parts: string[] = [];
  parts.push('<h3>Model</h3>');
  parts.push(row('rating ± dev', `${f2(a.rating)} ± ${f2(a.dev)}`));
  parts.push(row('boards rated', String(a.boards)));
  parts.push(row('mood', `${eng.mood} · fr ${f2(eng.frustration)} · bo ${f2(eng.boredom)}`));
  parts.push(row('clean rate (12)', rate == null ? '–' : `${Math.round(rate * 100)}%`));
  parts.push(row('sessions', `${a.sessions.count} · ${Math.round(a.sessions.ms / 60000)} min`));

  if (last) {
    const t = targetFor(a, last.n);
    parts.push(`<h3>Director · level ${last.n}</h3>`);
    parts.push(row('tier · reason', `${last.tier} · ${last.reason}`));
    parts.push(row('target · board d', `${f2(last.target)} · ${f2(last.d)}`));
    const sgn = (v: number) => `${v >= 0 ? '+' : '−'}${f2(Math.abs(v))}`;
    // what the policy would say now (after the latest record), split into its parts
    parts.push(row('now b·s·p·f', `${f2(t.base)} ${sgn(t.skill)} ${sgn(t.pacing)} ${sgn(t.flow)}`));
    if (a.tries.count) parts.push(row('failed tries', `${a.tries.count} at ${a.tries.n}`));
  }

  if (current) {
    parts.push(`<h3>Board · ${esc(current.mode)}${current.mode === 'journey' ? ` ${current.number}` : ''}</h3>`);
    parts.push(row('d · tier', `${f2(specD(current))}${current.difficulty == null ? ' (est.)' : ''} · ${current.tier ?? '–'}`));
    parts.push(row('mechanics', mechanicsOf(current).join(', ') || 'none'));
    parts.push(row('size · par', `${current.rows}×${current.cols} · ${current.par}s${current.goal ? ` · ${current.goal}` : ''}`));
  }

  const r = a.recent[0];
  if (r) {
    parts.push(`<h3>Last record · ${esc(r.mode)}${r.n ? ` ${r.n}` : ''}</h3>`);
    parts.push(row('ended · score', `${r.ended} · p ${f2(performance(r))} · ${r.stars}★`));
    parts.push(row('time / par', `${sec(r.ms)} / ${r.par}s (${f2(parRatio(r))})`));
    parts.push(row('first · gap', `${sec(r.firstMs)} · ${sec(r.gapMs)}`));
    parts.push(row('blocked · resel', `${r.blocked} · ${r.reselects}`));
    parts.push(row('hint · shuf · auto', `${r.hints} · ${r.shuffles} · ${r.autoShuffles}`));
    parts.push(row('bends 0/1/2', `${r.turns.join('/')} · ${r.turnMs.map(sec).join(' ')}`));
  }

  const ps = playStyle(a);
  parts.push('<h3>Style</h3>');
  parts.push(row('scan', `${ps.scan.start} · ${ps.scan.vertical}`));
  parts.push(row('speed', `${ps.speed.style} · 2-bend ×${f2(ps.bends.twoBendCost)}`));
  parts.push(row('assists', ps.assists.habit));
  if (ps.favourites.length) parts.push(row('enjoys', ps.favourites.join(', ')));
  if (ps.blindSpots.length) parts.push(row('blind spots', ps.blindSpots.join(', ')));
  body.innerHTML = parts.join('');
}

/** Mount the dev overlay once. */
export function mountDevPanel(): void {
  if (document.querySelector('.devp')) return;
  const root = document.createElement('aside');
  root.className = 'devp';
  root.setAttribute('aria-label', 'Director dev panel');
  root.innerHTML = '<button type="button" class="devp__chip" aria-expanded="false"></button><div class="devp__body" hidden></div>';
  document.body.append(root);
  const chip = root.querySelector<HTMLButtonElement>('.devp__chip')!;
  chip.addEventListener('click', (e) => {
    e.stopPropagation();
    open = !open;
    render(root);
  });
  const later = () => setTimeout(() => render(root), 0);
  on('start', ({ session }) => {
    current = session.spec;
    later();
  });
  on('clear', later);
  on('leave', later);
  render(root);
}
