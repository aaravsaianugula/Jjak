/**
 * Animated intros in a sheet: the first time a mechanic, the Level 6 rule or a
 * level goal shows up, the demo player plays it twice, then hands the mini
 * board over ("your turn"), then the board starts. Also used by Replay intro.
 */
import { GOALS, type GoalId } from '../engine/goals';
import { type LevelSpec, type Mechanic, windOf } from '../engine/levels';
import { MECHANICS, mechanicsOf } from '../engine/mechanics';
import { type Wind } from '../engine/moves';
import { DemoPlayer } from './demo';
import { type DemoScript, BASIC_DEMOS, GOAL_DEMOS, MECHANIC_DEMOS, VARIANTS_DEMO, windDemo } from './demos';
import { esc, frag, h } from './dom';
import { ICONS } from './icons';
import { type SheetHandle, openSheet } from './modal';

export type IntroId = Mechanic | 'variants' | 'goal' | 'basics';

/** The `save.seenTips` key for an intro (Falling leaves predates the mechanic ids). */
export const tipKey = (id: IntroId): string => (id === 'leaves' ? 'gravity' : id);

export interface IntroContext {
  wind?: Wind | null;
  goal?: GoalId;
}

/** The first intro this Journey board still owes the player, if any. */
export function introFor(spec: LevelSpec, seen: readonly string[]): IntroId | null {
  const owed: IntroId[] = [];
  if (spec.number === 6) owed.push('variants');
  owed.push(...mechanicsOf(spec));
  if (spec.goal) owed.push('goal');
  return owed.find((id) => !seen.includes(tipKey(id))) ?? null;
}

/** The intro for this board's newest idea (for Replay intro), or the basics. */
export function replayIntroFor(spec: LevelSpec): IntroId {
  const ms = mechanicsOf(spec).filter((m) => m !== 'lucky');
  if (ms.length) return ms.reduce((a, b) => (MECHANICS[b].introChapter > MECHANICS[a].introChapter ? b : a));
  if (spec.lucky) return 'lucky';
  if (spec.goal) return 'goal';
  if (spec.mode === 'journey' && spec.number === 6) return 'variants';
  return 'basics';
}

export const contextOf = (spec: LevelSpec): IntroContext => ({ wind: windOf(spec), goal: spec.goal });

export function introScript(id: IntroId, ctx: IntroContext = {}): DemoScript {
  if (id === 'wind') return windDemo(ctx.wind ?? 'right');
  if (id === 'variants') return VARIANTS_DEMO;
  if (id === 'goal') return GOAL_DEMOS[ctx.goal ?? 'combo'];
  if (id === 'basics') return BASIC_DEMOS.bends;
  return MECHANIC_DEMOS[id];
}

interface IntroText {
  kicker: string;
  title: string;
  native: string;
  line: string;
}

function introText(id: IntroId, ctx: IntroContext): IntroText {
  if (id === 'variants') return { kicker: 'New rule', title: 'Match the flower', native: '같은 꽃 · 同じ花', line: 'Pictures differ. The flower, and its number, is what pairs.' };
  if (id === 'goal') {
    const g = GOALS[ctx.goal ?? 'combo'];
    return { kicker: 'Level goal', title: g.name, native: g.native, line: `${g.text}. It earns the third blossom.` };
  }
  if (id === 'basics') return { kicker: 'How to play', title: 'Make a jjak', native: '짝', line: 'Same flower, joined by a line with up to two bends.' };
  const m = MECHANICS[id];
  return { kicker: 'New on the road', title: m.name, native: m.native, line: m.rule };
}

/**
 * Open an intro sheet. Plays the demo twice, then "your turn" on the same mini
 * board; the button turns primary once the player has done it (it always works,
 * so nobody is held up).
 */
export function openIntro(id: IntroId, ctx: IntroContext = {}, cta = 'Play'): SheetHandle {
  const t = introText(id, ctx);
  const player = new DemoPlayer(introScript(id, ctx), { size: 'sheet' });
  const content = frag(`<div class="intro-sheet">
    <div class="tip__kicker">${esc(t.kicker)}</div>
    <h2>${esc(t.title)} <span class="tip__native">${esc(t.native)}</span></h2>
    <div class="intro-sheet__demo"></div>
    <p class="intro-sheet__line">${esc(t.line)}</p>
  </div>`);
  content.querySelector('.intro-sheet__demo')!.append(player.el);
  const btn = h('button', { class: 'btn btn--ghost btn--block', 'data-intro-go': '' }, cta) as HTMLButtonElement;
  const again = h('button', { class: 'btn btn--quiet intro-sheet__again', hidden: true, html: `${ICONS.restart}<span>Watch again</span>` }) as HTMLButtonElement;
  content.append(h('div', { class: 'sheet__actions' }, btn, again));
  const sheet = openSheet(content, { label: `${t.kicker}: ${t.title}` });
  btn.addEventListener('click', () => sheet.close());

  const cycle = async (fresh: boolean) => {
    again.hidden = true;
    btn.className = 'btn btn--ghost btn--block';
    if (!(await player.play(2, { fresh, maxLoopMs: 4500 }))) return;
    await player.yourTurn();
    btn.className = 'btn btn--primary btn--block';
    again.hidden = false;
  };
  again.addEventListener('click', () => void cycle(true));
  void cycle(false);
  void sheet.closed.then(() => player.destroy());
  return sheet;
}
