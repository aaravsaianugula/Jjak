import { describe, expect, it } from 'vitest';
import { cardsLeft } from '../src/engine/board';
import { GOALS, type GoalId } from '../src/engine/goals';
import { MECHANIC_IDS } from '../src/engine/mechanics';
import { type DemoEvent, type DemoScript, DemoRun, ghostPath, gridOf, parseGrid, runScript, runTurn } from '../src/ui/demo-model';
import { ALL_DEMOS, BASIC_DEMOS, GOAL_DEMOS, MECHANIC_DEMOS, VARIANTS_DEMO, windDemo } from '../src/ui/demos';

/** Run a script beat by beat and keep what each beat reported. */
function events(s: DemoScript): { run: DemoRun; ev: DemoEvent[] } {
  const run = new DemoRun(s);
  return { run, ev: s.steps.map((x) => run.step(x)) };
}
const pairs = (ev: DemoEvent[]) => ev.filter((e): e is Extract<DemoEvent, { kind: 'pair' }> => e.kind === 'pair');

describe('demo scripts', () => {
  it('every mechanic has a demo', () => {
    for (const m of MECHANIC_IDS) expect(MECHANIC_DEMOS[m], m).toBeDefined();
  });

  it('grid notation round-trips', () => {
    for (const s of ALL_DEMOS) expect(gridOf(parseGrid(s.grid, s.wind ?? null)), s.id).toEqual(s.grid.map((r) => r.trim().split(/\s+/).join(' ')));
  });

  for (const s of ALL_DEMOS) {
    it(`${s.id}: every beat is legal under the rules and the board ends as written`, () => {
      const run = runScript(s);
      expect(gridOf(run.state), s.id).toEqual(s.end);
      // Captions stay two or three words.
      for (const st of s.steps) if (st.kind === 'caption') expect(st.text.split(/\s+/).length, st.text).toBeLessThanOrEqual(3);
    });

    it(`${s.id}: the "your turn" pairs are legal`, () => {
      const runs = runTurn(s);
      expect(runs.length).toBeGreaterThan(0);
      if (s.turn !== 'any') expect(gridOf(runs[0].state), s.id).toEqual(s.end);
    });
  }
});

describe('each demo shows its idea', () => {
  it('stones: the straight line is blocked by the stone, then the pair goes around', () => {
    const { ev } = events(MECHANIC_DEMOS.stones);
    const b = ev.find((e) => e.kind === 'blocked')!;
    expect(b.kind === 'blocked' && b.ghost!.pts.length).toBe(2); // straight through the stone
    expect(pairs(ev).at(-1)!.turns).toBe(2);
  });

  it('leaves: a card falls into line', () => {
    const { ev } = events(MECHANIC_DEMOS.leaves);
    expect(pairs(ev)[0].res.moved).toEqual([[0, 3]]);
  });

  it('snow turns over and knots come untied when a neighbour clears', () => {
    const snow = events(MECHANIC_DEMOS.snow).ev;
    expect(snow.find((e) => e.kind === 'tap')).toMatchObject({ locked: 'snow' });
    expect(pairs(snow)[0].res.revealed).toEqual([4]);
    const knots = events(MECHANIC_DEMOS.knots).ev;
    expect(knots.find((e) => e.kind === 'tap')).toMatchObject({ locked: 'knot' });
    expect(pairs(knots)[0].res.untied).toEqual([4]);
  });

  it('lucky: the two bonus cards pair', () => {
    expect(pairs(events(MECHANIC_DEMOS.lucky).ev).some((p) => p.lucky)).toBe(true);
  });

  it('wind drifts the card the way the wind blows, in all three directions', () => {
    for (const dir of ['right', 'left', 'up'] as const) {
      const s = windDemo(dir);
      expect(s.wind).toBe(dir);
      const first = pairs(events(s).ev)[0];
      expect(first.res.moved.length, dir).toBe(1);
    }
  });

  it('gates: blocked until the pines pair, then the gate opens', () => {
    const { ev } = events(MECHANIC_DEMOS.gates);
    expect(ev.some((e) => e.kind === 'blocked')).toBe(true);
    const [pines, plums] = pairs(ev);
    expect(pines.res.opened).toEqual([4]);
    expect(plums.turns).toBe(0);
  });

  it('fences: the neighbours are fenced apart, then pair around the fence', () => {
    const { ev } = events(MECHANIC_DEMOS.fences);
    expect(ev.some((e) => e.kind === 'blocked')).toBe(true);
    expect(pairs(ev).at(-1)!.turns).toBe(2);
  });

  it('variants: different pictures of one flower pair', () => {
    const p = pairs(events(VARIANTS_DEMO).ev);
    expect(p.every((x) => x.cards[0] !== x.cards[1])).toBe(true);
  });

  it('bends: 0, then 1, then 2 bends, and the first real pair is left for the player', () => {
    const { run, ev } = events(BASIC_DEMOS.bends);
    expect(pairs(ev).map((p) => p.turns)).toEqual([0, 1, 2]);
    expect(cardsLeft(run.state.board)).toBe(4);
    expect(runTurn(BASIC_DEMOS.bends).length).toBe(2);
  });

  it('blocked: the would-be path has three bends, and clearing the way fixes it', () => {
    const { ev } = events(BASIC_DEMOS.blocked);
    const b = ev.find((e) => e.kind === 'blocked');
    expect(b && b.kind === 'blocked' && b.ghost!.pts.length).toBe(5);
    const s = parseGrid(BASIC_DEMOS.blocked.grid);
    expect(ghostPath(s.board, 0, 8)!.why).toBe('bends');
  });

  it('combo and fever: quick pairs build ×3, then full bloom at ×5', () => {
    expect(runScript(BASIC_DEMOS.combo).bestCombo).toBe(3);
    expect(runScript(BASIC_DEMOS.fever).feverCount).toBe(1);
  });

  it('goal demos meet their goal (clean: only when the player reads first)', () => {
    for (const g of Object.keys(GOAL_DEMOS) as GoalId[]) {
      const s = GOAL_DEMOS[g];
      const total = cardsLeft(parseGrid(s.grid).board) / 2;
      const watch = runScript(s);
      const turn = runTurn(s)[0];
      expect(GOALS[g].met(turn, total), g).toBe(true);
      expect(GOALS[g].met(watch, total), g).toBe(g !== 'clean');
    }
  });
});
