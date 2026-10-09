/**
 * "Your play style" (기풍 · 棋風): what the on-device player model has noticed, in
 * plain words, a calm line of the skill rating over recent boards, how at home the
 * player is with each idea met so far, and their best runs. Everything is computed
 * on the phone (src/director/insights.ts); this module only lays it out.
 */
import { type BestRun, type Insight, type MasteryBand, type MasteryRow, bestRuns, playStyleReport, trendLine } from '../../director/insights';
import { save } from '../../services/storage';
import { type Screen } from '../app';
import { esc, frag } from '../dom';
import { ICONS } from '../icons';
import { nav } from '../nav';
import { practiceMet } from './practice';

const KIND_LABEL: Record<Insight['kind'], string> = { strength: 'Strength', habit: 'Habit', edge: 'Growth edge' };
const BAND_LABEL: Record<MasteryBand, string> = { new: 'just met', learning: 'learning', steady: 'steady', home: 'at home' };
/** chart box (viewBox units) */
const W = 320;
const H = 112;
const PAD = 8;

const insightRow = (i: Insight, k: number) =>
  `<li class="style__insight style__insight--${i.kind}" style="--i:${k}"><span class="style__kind">${KIND_LABEL[i.kind]}<span class="sr-only">: </span></span><span class="style__say">${esc(i.text)}</span></li>`;

function trendCard(points: number[], text: string): string {
  if (!points.length) return `<p class="style__chart-empty muted">Your line starts drawing after a few more boards.</p>`;
  return `<figure class="style__chart">
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(text)}" preserveAspectRatio="none">
      <line class="style__base" x1="0" y1="${H - 1}" x2="${W}" y2="${H - 1}" />
      <path class="style__line" d="${trendLine(points, W, H, PAD)}" />
    </svg>
    <figcaption class="style__caption" aria-hidden="true">${esc(text)}</figcaption>
  </figure>`;
}

const masteryRow = (m: MasteryRow, k: number) =>
  `<li class="style__mech" style="--i:${k}">
    <span class="sealmark style__seal ja" aria-hidden="true">${esc(m.glyph)}</span>
    <span class="style__mech-body">
      <span class="style__mech-name">${esc(m.name)}</span>
      <span class="style__band style__band--${m.band}" aria-hidden="true"><i></i></span>
    </span>
    <span class="style__band-word">${BAND_LABEL[m.band]}</span>
  </li>`;

const runCell = (r: BestRun) =>
  `<div class="style__run"><span class="style__run-label">${r.label}</span><b>${esc(r.value)}</b><small>${r.sub}</small></div>`;

export function playStyleScreen(): Screen {
  const report = playStyleReport(save.analytics, practiceMet());
  const runs = bestRuns(save);
  const nothing = report.empty && runs.length === 0;
  const body = nothing
    ? `<div class="style__empty">
        <span class="sealmark style__empty-seal ja" aria-hidden="true">棋</span>
        <p class="style__empty-title">Your play style takes shape as you play.</p>
        <p class="muted">Clear a few boards and come back. You’ll see what comes easily, where your growth edge is, and your best runs.</p>
      </div>`
    : `<h2 class="section-label">What your play shows</h2>
      ${report.insights.length ? `<ul class="list style__insights">${report.insights.map(insightRow).join('')}</ul>` : ''}
      ${report.note ? `<p class="style__note">${report.note}</p>` : ''}
      <h2 class="section-label">Skill over time</h2>
      <div class="list style__trend">${trendCard(report.trend, report.trendText)}</div>
      ${report.mastery.length ? `<h2 class="section-label">Ideas you’ve met</h2><ul class="list style__mastery">${report.mastery.map(masteryRow).join('')}</ul>` : ''}
      ${runs.length ? `<h2 class="section-label">Best runs</h2><div class="list style__runs">${runs.map(runCell).join('')}</div>` : ''}`;
  const el = frag(`<section class="screen playstyle">
    <header class="topbar">
      <button class="icon-btn" data-back aria-label="Back">${ICONS.back}</button>
      <div class="topbar__title"><h1>Your play style</h1><span class="topbar__sub"><span lang="ko">기풍</span> · <span class="ja" lang="ja">棋風</span></span></div>
      <span class="topbar__spacer"></span>
    </header>
    <div class="screen__body scroll">
      ${body}
      <p class="style__privacy">${ICONS.shield}<span>Everything here stays on this phone.</span></p>
    </div>
  </section>`);
  el.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('[data-back]')) nav.settings();
  });
  return {
    name: 'playstyle',
    el,
    onBack: () => {
      nav.settings();
      return true;
    },
  };
}
