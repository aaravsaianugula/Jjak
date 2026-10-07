import { MONTH_TINTS, cardSvg } from '../../art/cards';
import { ECONOMY, LINKS } from '../../config';
import { cardDef, monthDef, KIND_LABEL, MONTHS } from '../../data/deck';
import { type Point, STONE, cardsLeft, isCard } from '../../engine/board';
import { type LevelSpec, chapterOf, dailyTheme, journeyLevel, zenLevel } from '../../engine/levels';
import { Session, formatTime } from '../../engine/session';
import { checkSeals, type Seal } from '../../services/achievements';
import { ads } from '../../services/ads';
import { sfx, unlockAudio } from '../../services/audio';
import { haptic } from '../../services/haptics';
import { type ClearSummary, completedMonths, drawCard, formatCountdown, msToNextDaily, recordClear, shareTextFor } from '../../services/progress';
import { shareText } from '../../services/share';
import { persist, save } from '../../services/storage';
import { type Screen } from '../app';
import { esc, frag, h, toast, wait } from '../dom';
import { ICONS } from '../icons';
import { choose, openSheet } from '../modal';
import { showHowToPlay } from './settings';
import { nav } from '../nav';

const MARGIN = 0.32; // outer lane for paths, in card widths
const ASPECT = 1.4; // card height / width
const GAP = 0.06; // gap between cards, in card widths

const COMBO_WORDS = ['', '', 'Pair', 'Nice', 'Lovely', 'Brilliant'];

function titleFor(spec: LevelSpec): string {
  if (spec.mode === 'daily') return `Daily #${spec.number}`;
  if (spec.mode === 'zen') return 'Zen';
  return `Level ${spec.number}`;
}

export function gameScreen(spec: LevelSpec): Screen {
  let session = new Session(spec, performance.now());
  const total = cardsLeft(session.board);

  // ── Layout ────────────────────────────────────────────────────────
  const timeEl = h('b', { class: 'hud__v' }, spec.mode === 'zen' ? `0/${total / 2}` : '0:00');
  const scoreEl = h('b', { class: 'hud__v' }, '0');
  const leftEl = h('b', { class: 'hud__v' }, String(total / 2));
  const bar = h('i');
  const board = h('div', { class: 'board', role: 'grid', 'aria-label': 'Card board' });
  const stage = h('div', { class: 'stage' }, board);
  const coach = h('div', { class: 'coach', hidden: true });
  const hintBadge = h('span', { class: 'tool__badge' });
  const shuffleBadge = h('span', { class: 'tool__badge' });
  const hintBtn = h('button', { class: 'tool', 'aria-label': 'Hint', html: ICONS.hint }, h('span', {}, 'Hint'), hintBadge);
  const shuffleBtn = h('button', { class: 'tool', 'aria-label': 'Shuffle', html: ICONS.shuffle }, h('span', {}, 'Shuffle'), shuffleBadge);
  const restartBtn = h('button', { class: 'tool', 'aria-label': 'Restart', html: ICONS.restart }, h('span', {}, 'Restart'));

  const twist = spec.gravity ? ' · Falling leaves' : spec.snow ? ' · First snow' : '';
  const sub =
    spec.mode === 'journey'
      ? `${chapterOf(spec.number).name} · ${chapterOf(spec.number).ja}${twist}`
      : spec.mode === 'daily'
        ? `${dailyTheme(spec.seed.replace('daily-', '')).name} · same board worldwide`
        : 'No clock, no pressure';
  const comboBar = h('div', { class: 'combo-bar', 'aria-hidden': 'true' }, h('i'));
  const el = h(
    'section',
    { class: 'screen game' },
    h(
      'header',
      { class: 'topbar' },
      h('button', { class: 'icon-btn', 'aria-label': 'Back', html: ICONS.back, onclick: () => leave() }),
      h('div', { class: 'topbar__title' }, titleFor(spec), h('div', { class: 'muted', style: 'font-size:12px;font-weight:400;font-family:var(--font-sans)' }, sub)),
      h('button', { class: 'icon-btn', 'aria-label': 'Pause', html: ICONS.pause, onclick: () => openPause() }),
    ),
    h(
      'div',
      { class: 'hud' },
      h('div', { class: 'hud__stat' }, h('span', { class: 'hud__k' }, spec.mode === 'zen' ? 'Pairs' : 'Time'), timeEl),
      h('div', { class: 'hud__stat hud__stat--mid' }, h('span', { class: 'hud__k' }, 'Pairs left'), leftEl),
      h('div', { class: 'hud__stat' }, h('span', { class: 'hud__k' }, 'Score'), scoreEl),
    ),
    h('div', { class: 'progress' }, bar),
    comboBar,
    stage,
    coach,
    h('nav', { class: 'toolbar' }, hintBtn, shuffleBtn, restartBtn),
  );

  // ── Board rendering ───────────────────────────────────────────────
  let cw = 40; // card width px
  let ch = 56;
  let margin = 16;
  const cardEls = new Map<number, HTMLElement>();
  const paperMonth = save.paper === 'plain' ? -1 : Number(save.paper);
  const paper = h('div', {
    class: 'paper',
    'aria-hidden': 'true',
    html: paperMonth >= 0 ? `<svg viewBox="0 0 100 140"><use href="#motif-${paperMonth}"/></svg>` : '',
  });
  if (paperMonth >= 0) paper.style.setProperty('--paper-tint', MONTH_TINTS[paperMonth]);
  const paths = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  paths.classList.add('paths');

  const xOf = (c: number) => (c < 0 ? margin / 2 : c >= spec.cols ? margin + spec.cols * cw + margin / 2 : margin + (c + 0.5) * cw);
  const yOf = (r: number) => (r < 0 ? margin / 2 : r >= spec.rows ? margin + spec.rows * ch + margin / 2 : margin + (r + 0.5) * ch);

  function layout() {
    const w = stage.clientWidth;
    const hgt = stage.clientHeight;
    if (!w || !hgt) return;
    const byW = w / (spec.cols + 2 * MARGIN);
    const byH = hgt / (spec.rows * ASPECT + 2 * MARGIN);
    cw = Math.floor(Math.min(byW, byH, 96));
    ch = Math.round(cw * ASPECT);
    margin = Math.round(cw * MARGIN);
    board.style.width = `${spec.cols * cw + 2 * margin}px`;
    board.style.height = `${spec.rows * ch + 2 * margin}px`;
    const gap = Math.max(2, Math.round(cw * GAP));
    for (const [i, cel] of cardEls) {
      const r = Math.floor(i / spec.cols);
      const c = i % spec.cols;
      cel.style.left = `${margin + c * cw + gap / 2}px`;
      cel.style.top = `${margin + r * ch + gap / 2}px`;
      cel.style.width = `${cw - gap}px`;
      cel.style.height = `${ch - gap}px`;
    }
  }

  function faceLabel(id: number) {
    const m = monthDef(id);
    const d = cardDef(id);
    return `${m.en}, month ${m.index + 1}${d.kind === 'plain' ? '' : `, ${d.en}`}`;
  }

  function renderBoard() {
    board.replaceChildren(paper);
    cardEls.clear();
    session.board.cells.forEach((v, i) => {
      if (v === STONE) {
        const s = h('div', { class: 'stone', 'aria-hidden': 'true' });
        cardEls.set(i, s);
        board.append(s);
      } else if (isCard(v)) {
        const snowy = session.hidden.has(i);
        const c = h('button', {
          class: `card${snowy ? ' is-snow' : ''}`,
          'data-cell': i,
          'aria-label': snowy ? 'Card under snow' : faceLabel(v),
          html: cardSvg(snowy ? 'snow' : v),
        });
        cardEls.set(i, c);
        board.append(c);
      }
    });
    board.append(paths);
    layout();
  }

  function refreshFaces(flip: boolean) {
    session.board.cells.forEach((v, i) => {
      const c = cardEls.get(i);
      if (!c || !isCard(v) || c.classList.contains('stone')) return;
      const snowy = session.hidden.has(i);
      const swap = () => {
        c.innerHTML = cardSvg(snowy ? 'snow' : v);
        c.classList.toggle('is-snow', snowy);
        c.setAttribute('aria-label', snowy ? 'Card under snow' : faceLabel(v));
      };
      if (flip) {
        c.classList.remove('is-flip');
        void c.offsetWidth;
        c.classList.add('is-flip');
        setTimeout(swap, 200);
        setTimeout(() => c.classList.remove('is-flip'), 440);
      } else swap();
    });
  }

  /** Ink-brush stroke: a wide wash under a crisp line, with a blot at each end. */
  function drawPath(pts: Point[]) {
    const coords = pts.map((p) => `${xOf(p.c).toFixed(1)},${yOf(p.r).toFixed(1)}`).join(' ');
    let len = 0;
    for (let i = 1; i < pts.length; i++) len += Math.abs(xOf(pts[i].c) - xOf(pts[i - 1].c)) + Math.abs(yOf(pts[i].r) - yOf(pts[i - 1].r));
    const ns = 'http://www.w3.org/2000/svg';
    const g = document.createElementNS(ns, 'g');
    g.classList.add('stroke');
    for (const [cls, w] of [['wash', Math.max(7, cw * 0.2)], ['line', Math.max(3, cw * 0.07)]] as const) {
      const line = document.createElementNS(ns, 'polyline');
      line.setAttribute('points', coords);
      line.setAttribute('stroke-width', String(w));
      line.classList.add(cls);
      line.style.strokeDasharray = `${len}`;
      line.style.setProperty('--len', `${len}`);
      g.append(line);
    }
    for (const p of [pts[0], pts[pts.length - 1]]) {
      const dot = document.createElementNS(ns, 'circle');
      dot.setAttribute('cx', xOf(p.c).toFixed(1));
      dot.setAttribute('cy', yOf(p.r).toFixed(1));
      dot.setAttribute('r', String(Math.max(3, cw * 0.1)));
      dot.classList.add('blot');
      g.append(dot);
    }
    paths.append(g);
    setTimeout(() => g.remove(), 620);
  }

  function petals(cell: number) {
    const c = cardEls.get(cell);
    if (!c) return;
    const colors = ['#d98a98', '#e8b9c1', '#c4472f', '#e6c27a'];
    for (let k = 0; k < 6; k++) {
      const p = h('i', { class: 'petal' });
      const a = (k / 6) * Math.PI * 2 + Math.random();
      const d = cw * (0.6 + Math.random() * 0.6);
      p.style.left = `${c.offsetLeft + c.offsetWidth / 2 - 5}px`;
      p.style.top = `${c.offsetTop + c.offsetHeight / 2 - 5}px`;
      p.style.background = colors[k % colors.length];
      p.style.setProperty('--dx', `${Math.cos(a) * d}px`);
      p.style.setProperty('--dy', `${Math.sin(a) * d}px`);
      p.style.setProperty('--rot', `${Math.random() * 360}deg`);
      board.append(p);
      setTimeout(() => p.remove(), 720);
    }
  }

  function showCombo(n: number) {
    if (n < 2) return;
    stage.querySelectorAll('.combo').forEach((x) => x.remove());
    const node = h('div', { class: 'combo' }, h('b', {}, '짝'.repeat(n)), h('span', {}, `${COMBO_WORDS[n]} · ×${n}`.toUpperCase()));
    stage.append(node);
    setTimeout(() => node.remove(), 950);
  }

  // ── HUD ───────────────────────────────────────────────────────────
  function updateHud() {
    scoreEl.textContent = session.score.toLocaleString('en-US');
    const left = cardsLeft(session.board);
    leftEl.textContent = String(left / 2);
    bar.style.width = `${((total - left) / total) * 100}%`;
    if (spec.mode === 'zen') timeEl.textContent = `${session.pairsMade}/${total / 2}`;
    const badge = (b: HTMLElement, n: number) => {
      b.textContent = n > 0 ? String(n) : '+';
      b.classList.toggle('tool__badge--ad', n === 0);
    };
    badge(hintBadge, save.hints);
    badge(shuffleBadge, save.shuffles);
  }

  let paused = false;
  let pausedAt = 0;
  const tick = setInterval(() => {
    if (paused || session.done || spec.mode === 'zen') return;
    timeEl.textContent = formatTime(session.elapsedMs(performance.now()));
  }, 250);

  // ── Input ─────────────────────────────────────────────────────────
  let hintCells: number[] = [];
  const clearHint = () => {
    hintCells.forEach((i) => cardEls.get(i)?.classList.remove('is-hint'));
    hintCells = [];
  };
  let busy = false;

  board.addEventListener('pointerdown', (e) => {
    const target = (e.target as HTMLElement).closest<HTMLElement>('.card');
    if (!target || busy || session.done) return;
    e.preventDefault();
    unlockAudio();
    const cell = Number(target.dataset.cell);
    const res = session.tap(cell, performance.now());
    switch (res.kind) {
      case 'select':
        target.classList.add('is-selected');
        sfx.tap();
        haptic.light();
        break;
      case 'deselect':
        target.classList.remove('is-selected');
        sfx.deselect();
        break;
      case 'reselect':
        cardEls.get(res.from)?.classList.remove('is-selected');
        target.classList.add('is-selected');
        sfx.tap();
        haptic.light();
        break;
      case 'mismatch':
        cardEls.get(res.a)?.classList.remove('is-selected');
        for (const i of [res.a, res.b]) {
          const c = cardEls.get(i);
          c?.classList.remove('is-shake');
          void c?.offsetWidth;
          c?.classList.add('is-shake');
        }
        sfx.miss();
        haptic.warn();
        if (spec.mode === 'journey' && spec.number <= 3) setCoach('Same flower — but the path between them needs more than two turns. Clear what’s in the way first.');
        break;
      case 'match':
        onMatch(res);
        break;
      case 'hidden':
        target.classList.remove('is-shake');
        void target.offsetWidth;
        target.classList.add('is-shake');
        sfx.deselect();
        setCoach('This card is under snow. Clear a card next to it to reveal it.');
        break;
    }
  });

  function onMatch(res: Extract<ReturnType<Session['tap']>, { kind: 'match' }>) {
    clearHint();
    drawPath(res.path);
    const gone = [res.a, res.b].map((i) => cardEls.get(i)).filter((x): x is HTMLElement => !!x);
    for (const i of [res.a, res.b]) petals(i);
    for (const c of gone) {
      c.classList.remove('is-selected');
      c.classList.add('is-gone');
    }
    cardEls.delete(res.a);
    cardEls.delete(res.b);
    setTimeout(() => gone.forEach((c) => c.remove()), 380);

    // Falling leaves: re-key the moved cards now, slide them once the pair has faded.
    if (res.moved.length) {
      for (const [from, to] of res.moved) {
        const c = cardEls.get(from);
        if (!c) continue;
        cardEls.delete(from);
        cardEls.set(to, c);
        c.dataset.cell = String(to);
        c.classList.add('is-falling');
      }
      setTimeout(() => {
        layout();
        setTimeout(() => cardEls.forEach((c) => c.classList.remove('is-falling')), 320);
      }, 200);
    }
    if (res.revealed.length) {
      setTimeout(() => {
        for (const i of res.revealed) {
          const c = cardEls.get(i);
          const v = session.board.cells[i];
          if (!c || !isCard(v)) continue;
          c.classList.add('is-flip');
          setTimeout(() => {
            c.innerHTML = cardSvg(v);
            c.classList.remove('is-snow');
            c.setAttribute('aria-label', faceLabel(v));
          }, 200);
          setTimeout(() => c.classList.remove('is-flip'), 440);
        }
      }, res.moved.length ? 420 : 160);
    }

    sfx.match(res.combo);
    haptic.medium();
    showCombo(res.combo);
    restartComboBar();
    updateHud();
    tutorialStep();
    if (res.reshuffled) {
      setTimeout(() => {
        sfx.shuffle();
        refreshFaces(true);
        toast('No moves left — the cards were reshuffled.');
      }, 520);
    }
    if (res.cleared) void finish();
  }

  function restartComboBar() {
    comboBar.classList.remove('on');
    void comboBar.offsetWidth;
    comboBar.classList.add('on');
  }

  // ── Tools ─────────────────────────────────────────────────────────
  async function acquire(kind: 'hint' | 'shuffle'): Promise<boolean> {
    const have = kind === 'hint' ? save.hints : save.shuffles;
    if (have > 0) return true;
    const cost = kind === 'hint' ? ECONOMY.hintCost : ECONOMY.shuffleCost;
    const name = kind === 'hint' ? 'hints' : 'shuffles';
    const pick = await choose(`Out of ${name}`, `Spend petals, or watch a short ad for one more.`, [
      { key: 'ad', label: 'Watch an ad · +1', style: 'primary', disabled: !ads.rewardedAvailable },
      { key: 'petals', label: `Use ${cost} petals (you have ${save.petals})`, style: 'ghost', disabled: save.petals < cost },
      { key: 'no', label: 'Not now', style: 'quiet' },
    ]);
    if (pick === 'petals') {
      save.petals -= cost;
    } else if (pick === 'ad') {
      paused = true;
      pausedAt = performance.now();
      const ok = await ads.rewarded();
      resume();
      if (!ok) {
        toast('The ad didn’t finish, so no reward this time.');
        return false;
      }
    } else return false;
    if (kind === 'hint') save.hints++;
    else save.shuffles++;
    persist();
    updateHud();
    return true;
  }

  hintBtn.addEventListener('click', async () => {
    if (session.done || busy) return;
    if (hintCells.length) return;
    if (!(await acquire('hint'))) return;
    const m = session.hint();
    if (!m) return;
    save.hints--;
    persist();
    hintCells = m;
    m.forEach((i) => cardEls.get(i)?.classList.add('is-hint'));
    sfx.hint();
    updateHud();
  });

  shuffleBtn.addEventListener('click', async () => {
    if (session.done || busy) return;
    if (!(await acquire('shuffle'))) return;
    save.shuffles--;
    persist();
    clearHint();
    cardEls.get(session.selected)?.classList.remove('is-selected');
    session.shuffle();
    sfx.shuffle();
    haptic.light();
    refreshFaces(true);
    updateHud();
  });

  restartBtn.addEventListener('click', async () => {
    if (busy) return;
    const ok = await choose('Restart this board?', 'Your time and score start over.', [
      { key: 'yes', label: 'Restart', style: 'primary' },
      { key: 'no', label: 'Keep playing', style: 'quiet' },
    ]);
    if (ok !== 'yes') return;
    restartBoard();
  });

  // ── Tutorial coach marks ──────────────────────────────────────────
  function setCoach(text: string | null) {
    if (!text) {
      coach.hidden = true;
      return;
    }
    coach.textContent = text;
    coach.hidden = false;
  }
  let coachStep = 0;
  function tutorialStep() {
    if (spec.mode !== 'journey' || spec.number > 2) return;
    coachStep++;
    if (spec.number === 1 && coachStep === 1) setCoach('A path can bend up to twice, and may run around the outside of the board.');
    else if (coachStep >= 3) setCoach(null);
  }
  function startTutorial() {
    if (spec.mode !== 'journey') return;
    if (spec.number === 1) {
      setCoach('Tap two cards with the same flower to make a jjak (짝) — a pair.');
      const m = session.hint();
      session.hintsUsed = 0; // the teaching hint is free
      if (m) {
        hintCells = m;
        m.forEach((i) => cardEls.get(i)?.classList.add('is-hint'));
      }
    }
    if (spec.number === 6 && !save.seenTips.includes('variants')) showVariantTip();
    if (spec.gravity && !save.seenTips.includes('gravity'))
      showMechanicTip('gravity', 'Falling leaves', '낙엽 · 落葉', 'From now on, cards drop down to fill the gaps after every pair — like leaves settling. Plan from the bottom up, and watch new pairs line up as things fall.', [36, 37, 38, 39]);
    else if (spec.snow > 0 && !save.seenTips.includes('snow'))
      showMechanicTip('snow', 'First snow', '첫눈 · 初雪', 'Some cards start under snow. They can’t be picked until a card next to them is cleared. Snowy cards still block paths.', ['snow', 44, 'snow', 45]);
    if (spec.stones > 0 && !save.seenTips.includes('stones')) {
      save.seenTips.push('stones');
      persist();
      setCoach('Stones (돌 · 石) block paths. Route around them.');
    }
  }

  function showVariantTip() {
    save.seenTips.push('variants');
    persist();
    const m = MONTHS[0];
    const content = frag(`<div>
      <h2>Match the flower, not the picture</h2>
      <p class="muted">From here on, each flower has four different cards — plain, ribbon, animal and bright. Any two cards of the same flower (and number) make a pair.</p>
      <div class="month__cards" style="margin:16px 0">${[0, 1, 2, 3].map((v) => `<div>${cardSvg(v)}</div>`).join('')}</div>
      <p class="muted" style="text-align:center">${esc(m.en)} · <span class="serif">${m.ko}</span> · <span class="ja">${m.ja}</span> — all four are January.</p>
    </div>`);
    content.querySelectorAll('svg').forEach((s) => ((s as SVGElement).style.cssText = 'width:100%;height:auto;border-radius:6px;box-shadow:var(--card-shadow)'));
    const btn = h('button', { class: 'btn btn--primary btn--block', style: 'margin-top:10px' }, 'Got it');
    content.append(btn);
    paused = true;
    pausedAt = performance.now();
    const sheet = openSheet(content, { label: 'New rule' });
    btn.addEventListener('click', () => sheet.close());
    void sheet.closed.then(resume);
  }

  function showMechanicTip(id: string, title: string, native: string, body: string, cards: (number | 'snow')[]) {
    save.seenTips.push(id);
    persist();
    const content = frag(`<div>
      <div class="detail__kind">New this season</div>
      <h2>${esc(title)} <span class="muted serif" style="font-size:18px;font-weight:400">${native}</span></h2>
      <p class="muted">${esc(body)}</p>
      <div class="month__cards" style="margin:16px 0">${cards.map((c) => `<div>${cardSvg(c)}</div>`).join('')}</div>
    </div>`);
    content.querySelectorAll('svg').forEach((s) => ((s as SVGElement).style.cssText = 'width:100%;height:auto;border-radius:6px;box-shadow:var(--card-shadow)'));
    const btn = h('button', { class: 'btn btn--primary btn--block' }, 'Got it');
    content.append(btn);
    paused = true;
    pausedAt = performance.now();
    const sheet = openSheet(content, { label: title });
    btn.addEventListener('click', () => sheet.close());
    void sheet.closed.then(resume);
  }

  // ── Finish ────────────────────────────────────────────────────────
  async function finish() {
    busy = true;
    clearInterval(tick);
    timeEl.textContent = spec.mode === 'zen' ? timeEl.textContent : formatTime(session.elapsedMs(session.finishedAt));
    setCoach(null);
    await wait(420);
    const seal = h('div', { class: 'seal stamp' }, '짝');
    stage.append(seal);
    shower();
    sfx.stamp();
    haptic.success();
    await wait(900);
    const papersBefore = completedMonths().length;
    const summary = recordClear(session);
    const seals = checkSeals();
    showResult(summary, seals, completedMonths().length > papersBefore);
  }

  /** Petal shower across the stage when a board is cleared. */
  function shower() {
    const colors = ['#e3a5b0', '#d98a98', '#f2d4da', '#c4472f', '#e6c27a'];
    for (let k = 0; k < 28; k++) {
      const p = h('i', { class: 'fall' });
      p.style.left = `${Math.random() * 100}%`;
      p.style.background = colors[k % colors.length];
      p.style.animationDelay = `${Math.random() * 600}ms`;
      p.style.animationDuration = `${1600 + Math.random() * 1200}ms`;
      p.style.setProperty('--sway', `${(Math.random() - 0.5) * 80}px`);
      p.style.setProperty('--spin', `${(Math.random() - 0.5) * 720}deg`);
      stage.append(p);
      setTimeout(() => p.remove(), 3200);
    }
  }

  function showResult(summary: ClearSummary, seals: Seal[], newPaper: boolean) {
    const st = session.stars();
    const secs = session.elapsedMs(session.finishedAt);
    const starBox = (on: boolean, label: string) =>
      `<div class="star ${on ? 'on' : ''}">${ICONS.blossom}${esc(label)}</div>`;
    const heading =
      spec.mode === 'daily' ? `Daily #${spec.number} cleared` : spec.mode === 'zen' ? 'Board cleared' : `Level ${spec.number} cleared`;
    const subline =
      spec.mode === 'daily'
        ? summary.daily?.counted
          ? `${summary.daily.streak}-day streak`
          : 'Practice round — today’s result is already saved'
        : spec.mode === 'journey'
          ? `${chapterOf(spec.number).name} · ${chapterOf(spec.number).ko} · ${chapterOf(spec.number).ja}`
          : 'Breathe in, breathe out';

    const content = frag(`<div>
      <div class="result__head"><div class="seal">짝</div><div><h2>${esc(heading)}</h2><div class="muted">${esc(subline)}</div></div></div>
      ${spec.mode === 'zen' ? '' : `<div class="stars">${starBox(st.clear, 'Clear')}${starBox(st.noAssist, 'No assists')}${starBox(st.underPar, `Under ${formatTime(spec.par * 1000)}`)}</div>`}
      <div class="statline">
        <div><b>${formatTime(secs)}</b><span>Time</span></div>
        <div><b>${session.score.toLocaleString('en-US')}</b><span>Score</span></div>
        <div><b>×${session.bestCombo}</b><span>Best combo</span></div>
      </div>
    </div>`);

    // Petals earned + optional rewarded double.
    if (summary.petals > 0) {
      const earned = h('div', { class: 'earned' }, h('span', { class: 'petals', html: `${ICONS.petal}+${summary.petals}` }));
      if (ads.rewardedAvailable) {
        const dbl = h('button', { class: 'btn btn--ghost', html: `${ICONS.ad}<span>Double it</span>` });
        dbl.addEventListener('click', async () => {
          dbl.setAttribute('disabled', '');
          if (await ads.rewarded()) {
            save.petals += summary.petals;
            persist();
            earned.firstElementChild!.innerHTML = `${ICONS.petal}+${summary.petals * 2}`;
            dbl.remove();
          } else dbl.removeAttribute('disabled');
        });
        earned.append(dbl);
      }
      content.append(earned);
    }

    if (summary.drawn != null) content.append(drawPanel(summary.drawn, 'New card'));
    if (newPaper) content.append(frag(`<p class="unlock">A flower is complete — a new board paper is ready in Settings.</p>`));
    if (seals.length) content.append(sealRow(seals));
    if (spec.mode === 'daily') content.append(frag(`<p class="muted" style="text-align:center;margin-top:14px">Next Daily in ${formatCountdown(msToNextDaily())}</p>`));

    const actions = h('div', { class: 'sheet__actions' });
    content.append(actions);
    const sheet = openSheet(content, { dismissible: false, label: heading });

    const nextSpec = (): LevelSpec | null =>
      spec.mode === 'journey' ? journeyLevel(spec.number + 1) : spec.mode === 'zen' ? zenLevel(`zen-${Date.now()}`) : null;

    if (spec.mode === 'daily') {
      actions.append(
        h('button', {
          class: 'btn btn--accent btn--block',
          html: `${ICONS.share}<span>Share result</span>`,
          onclick: async () => {
            const res = await shareText(shareTextFor(session, summary, LINKS.store));
            if (res === 'copied') toast('Copied to clipboard');
          },
        }),
      );
    }
    const next = nextSpec();
    if (next) {
      actions.append(
        h('button', {
          class: 'btn btn--primary btn--block',
          onclick: async () => {
            sheet.close();
            await ads.betweenBoards(spec.mode === 'journey' ? spec.number : null);
            nav.game(next);
          },
          html: `${spec.mode === 'journey' ? `Level ${next.number}` : 'Next board'} ${ICONS.play}`,
        }),
      );
    }
    actions.append(
      h('button', {
        class: 'btn btn--quiet btn--block',
        onclick: async () => {
          sheet.close();
          await ads.betweenBoards(spec.mode === 'journey' ? spec.number : null);
          nav.home();
        },
      }, 'Home'),
    );
    if (summary.drawn != null) setTimeout(() => sfx.reveal(), 350);
  }

  function sealRow(seals: Seal[]): HTMLElement {
    const shown = seals.slice(0, 3);
    const more = seals.length - shown.length;
    return frag(`<div class="earned-seals">${shown
      .map((sl) => `<div class="earned-seal"><span class="seal seal--sm">印</span><span><b>${esc(sl.title)}</b>${sl.native ? ` <span class="muted serif">${sl.native}</span>` : ''}<br><span class="muted">Seal earned · +${sl.reward} petals</span></span></div>`)
      .join('')}${more > 0 ? `<p class="muted" style="margin:0;font-size:13px">…and ${more} more in your seal book.</p>` : ''}</div>`);
  }

  function drawPanel(id: number, label: string): HTMLElement {
    const m = monthDef(id);
    const d = cardDef(id);
    const kind = KIND_LABEL[d.kind];
    const panel = frag(`<div class="draw">
      <div class="draw__card is-reveal">${cardSvg(id)}</div>
      <div>
        <div class="draw__label">${esc(label)} · ${save.album.length}/48</div>
        <div class="draw__name">${esc(m.en)}${d.kind === 'plain' ? '' : ` · ${esc(d.en)}`}</div>
        <div class="draw__langs"><span class="serif">${m.ko}</span> ${esc(m.koRoman)} · <span class="ja">${m.ja}</span> ${esc(m.jaRoman)}<br><span class="muted">${esc(kind.en)} · ${kind.ko} · <span class="ja">${kind.ja}</span></span></div>
      </div>
    </div>`);
    if (save.album.length < 48 && ads.rewardedAvailable) {
      const more = h('button', { class: 'btn btn--ghost btn--block', style: 'margin-top:10px', html: `${ICONS.ad}<span>Draw one more card</span>` });
      more.addEventListener('click', async () => {
        more.setAttribute('disabled', '');
        if (await ads.rewarded()) {
          const extra = drawCard();
          if (extra != null) {
            more.replaceWith(drawPanel(extra, 'Bonus card'));
            sfx.reveal();
            const won = checkSeals();
            if (won.length) toast(`Seal earned: ${won.map((w) => w.title).join(', ')}`);
          }
        } else more.removeAttribute('disabled');
      });
      const wrap = h('div', {}, panel, more);
      return wrap;
    }
    return panel;
  }

  // ── Lifecycle ─────────────────────────────────────────────────────
  function resume() {
    if (!paused) return;
    paused = false;
    session.startedAt += performance.now() - pausedAt;
  }

  function leave() {
    if (session.done || session.pairsMade === 0) nav.home();
    else openPause();
  }

  let pauseOpen = false;
  function openPause() {
    if (pauseOpen || session.done) return;
    pauseOpen = true;
    if (!paused) {
      paused = true;
      pausedAt = performance.now();
    }
    const tog = (k: 'sound' | 'haptics', label: string) =>
      `<div class="row"><span>${label}</span><button class="switch" role="switch" data-toggle="${k}" aria-checked="${save.settings[k]}" aria-label="${label}"></button></div>`;
    const content = frag(`<div>
      <div class="detail__kind">Paused</div>
      <h2>${esc(titleFor(spec))}</h2>
      <p class="muted">${esc(sub)} · ${session.pairsMade} of ${total / 2} pairs · ${formatTime(session.elapsedMs(pausedAt))}</p>
      <div class="list" style="margin:14px 0 0">${tog('sound', 'Sound')}${tog('haptics', 'Haptics')}</div>
      <div class="sheet__actions">
        <button class="btn btn--primary btn--block" data-p="resume">Resume ${ICONS.play}</button>
        <div class="sheet__row">
          <button class="btn btn--ghost" data-p="restart">${ICONS.restart}<span>Restart</span></button>
          <button class="btn btn--ghost" data-p="how">${ICONS.hint}<span>Rules</span></button>
        </div>
        <button class="btn btn--quiet btn--block" data-p="home">Leave to Home</button>
      </div>
    </div>`);
    const sheet = openSheet(content, { label: 'Paused' });
    content.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      const sw = t.closest<HTMLElement>('[data-toggle]');
      if (sw) {
        const k = sw.dataset.toggle as 'sound' | 'haptics';
        save.settings[k] = !save.settings[k];
        sw.setAttribute('aria-checked', String(save.settings[k]));
        persist();
        return;
      }
      const act = t.closest<HTMLElement>('[data-p]')?.dataset.p;
      if (!act) return;
      if (act === 'how') {
        showHowToPlay();
        return;
      }
      sheet.close();
      if (act === 'home') nav.home();
      if (act === 'restart') restartBoard();
    });
    void sheet.closed.then(() => {
      pauseOpen = false;
      resume();
    });
  }

  function restartBoard() {
    session = new Session(spec, performance.now());
    clearHint();
    renderBoard();
    updateHud();
    comboBar.classList.remove('on');
  }

  /** Title card at the start of a board; the clock starts when it clears. */
  function intro(): Promise<void> {
    const twistNote = spec.gravity ? 'Cards fall to fill the gaps' : spec.snow ? 'Some cards start under snow' : spec.stones ? 'Stones block the way' : '';
    const card = frag(`<div class="intro" aria-hidden="true">
      <div class="intro__kicker">${esc(spec.mode === 'journey' ? `${chapterOf(spec.number).name} · ${chapterOf(spec.number).ko} · ${chapterOf(spec.number).ja}` : spec.mode === 'daily' ? dailyTheme(spec.seed.replace('daily-', '')).name : 'Zen · 禅')}</div>
      <div class="intro__title">${esc(titleFor(spec))}</div>
      <div class="intro__sub">${total / 2} pairs${twistNote ? ` · ${esc(twistNote)}` : ''}</div>
    </div>`);
    stage.append(card);
    busy = true;
    return wait(spec.mode === 'journey' && spec.number === 1 ? 900 : 1150).then(() => {
      card.classList.add('intro--out');
      busy = false;
      setTimeout(() => card.remove(), 400);
    });
  }

  const ro = new ResizeObserver(() => layout());
  const onVis = () => {
    if (document.hidden && !paused) {
      paused = true;
      pausedAt = performance.now();
    } else if (!document.hidden) resume();
  };
  document.addEventListener('visibilitychange', onVis);

  requestAnimationFrame(() => {
    renderBoard();
    ro.observe(stage);
    updateHud();
    paused = true;
    pausedAt = performance.now();
    void intro().then(() => {
      session.startedAt = performance.now();
      paused = false;
      startTutorial();
    });
  });

  return {
    name: 'game',
    el,
    onBack() {
      if (session.done) return false;
      leave();
      return true;
    },
    destroy() {
      clearInterval(tick);
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVis);
    },
  };
}
