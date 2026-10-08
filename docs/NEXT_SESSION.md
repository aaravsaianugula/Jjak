# Next session prompt: a smarter, harder, more personal Level Director, and new mechanics

> Run this in a **local** Claude Code session in the repo folder (`D:\Coding\Jjak`), ideally with the Android phone
> plugged in over USB. Paste everything below the line, or say: "Read `docs/NEXT_SESSION.md` and do it."
> The previous prompt (validate on a real phone, polish, launch prep) is done; it lives in git history for this file.

---

You're continuing work on **Jjak (짝)**, a calm pair-connecting puzzle (Shisen-sho rules) on the 48-card
Hwatu/Hanafuda flower deck that Korea and Japan share. It ships to Google Play for a 13+ US/global audience.
The look is paper and ink: no neon, no gamer style, nothing childish, and **no dot, stipple or dashed textures**
(the owner's words: "Dots make it look cheap").

The owner's ask, in their words: *make the game algorithm and system work better, so levels get harder and more fun
as the player progresses; make the patterns hard to spot based on the user; adjust the difficulty to the user and
how they play; then add more game mechanics.*

Work is on branch **`claude/pensive-goodall-f3ocnt`** (draft PR https://github.com/aaravsaianugula/Jjak/pull/1).
`main` mirrors it; push both when a checkpoint is green (`git push origin HEAD:main`).

## 0. Set up and prove the baseline

```bash
git checkout claude/pensive-goodall-f3ocnt && git pull
npm ci
npx tsc --noEmit && npx vitest run && npm run build      # expect 367+ tests passing
npm run bank:audit                                         # the current curve, for the "before" numbers
```

If the baseline isn't green, fix that first. Save the audit output as the **before** snapshot.

## 1. Read first (in this order, and only these up front)

1. `docs/EXPANSION_PLAN.md` Part C (C1 Level Director, C3 mechanics and goals, C4 show-don't-tell, C5 endless).
2. `docs/GAME_DESIGN.md` §4 (level curve) and §5 (generation, solvable by construction).
3. `docs/level-audit.md` and `docs/level-curve.json` (how difficulty is measured today).

Map of the code:
- `src/engine/`: rules, path finding, solver (`solve.ts`), generation (`generate.ts`), mechanics library
  (`mechanics.ts`), goals, session.
- `src/director/`: `plan.ts` (level grammar: 50 places × 12-slot rhythm), `model.ts` (player model),
  `director.ts` (target difficulty and tiers), `search.ts` + `bots.ts` + `metrics.ts` (generate-and-test with
  bot players measuring difficulty d), `validate.ts` (hard gates), `bank.ts` (600 levels × 5 tiers, built offline
  by `npm run bank`), `endless*.ts` (601+, generated live in a Web Worker).
- `src/ui/demos.ts`, `src/ui/intros.ts`: the animated one-time intro for each new idea.
- Tests: `tests/director.test.ts`, `model.test.ts`, `journey.test.ts`, `mechanics.test.ts`, `endless*.test.ts`,
  `personas.ts` (bot personas).

What exists today:
- **Mechanics:** variants, stones, falling leaves (gravity), first snow (hidden cards), lucky cards, knots, wind,
  gates, fences.
- **Goals:** Rhythm, Clean read, Full bloom, Straight brush.
- **Player model:** a skill rating, per-mechanic proficiency, frustration/boredom signals, and it *already
  records* first-tap positions (scan pattern) and time per bend count.
- **Policy:** the Director aims at 75–85 % assist-free clears, picks one of 5 tiers, pins the tier per level, and
  relieves after two failed tries. Struggling players floor at tier 0.

## 2. The work

### A. Harder and more fun as the player progresses
- The late road should feel genuinely demanding, not just bigger. Today the curve rises gently and
  hint-heavy players sink to tier 0 fast. Redesign the target curve so difficulty climbs across chapters with a
  clear sawtooth (tension → peak → breather) inside each chapter, and peaks that a skilled player remembers.
- Difficulty must come from **arrangement and reading**, not smaller cards: fewer free opening moves, more
  convincing decoy pairs, longer 2-bend paths, critical pairs that must be cleared in a smart order, late-board
  crunches that open into a combo finish. Board size stays ≤ 8 rows × 7 columns.
- "Fun" is measurable: an early foothold (no stuck first 10 s), a mid-board crunch, a satisfying run at the end,
  variety between neighbouring levels. Extend `metrics.ts` and the fitness in `search.ts` with these, with tests.

### B. Patterns that are hard to spot, for *this* player
- Use what the model already records to find each player's habits: where they look first (scan region), which
  path shapes they're slow to see (bends, long detours, edge routes), which mechanics they struggle with, and
  whether they rush (blocked taps) or freeze (long think time).
- Tailor the board to stretch those habits: put the critical pairs outside their usual scan region, use the path
  shapes they read slowest, place believable decoys where they look first, and rotate the challenge so it never
  becomes one repeated trick. Keep a per-player record so the same "blind spot" isn't exploited board after board.
- It has to stay **fair and readable**. Every board is solver-proven, has a real foothold, and never uses a
  pattern that only a computer could see. Tailoring adds challenge inside the tier, it doesn't replace the tier.

### C. Difficulty that adjusts to how they play
- Make the model and policy more responsive and more robust. Use a richer skill estimate (e.g. per-shape and
  per-mechanic ratings with confidence), detect flow from think time, pair rhythm and assists, and adjust both
  the tier and the *kind* of challenge (shape, decoys, mechanics), not only one difficulty number.
- Calm guardrails: smooth steps (no whiplash between boards), relief after real struggle, stretch after easy
  streaks, a breather after a peak. Fix the tier-0 trap so hint-heavy players still progress and learn.
- Simulate it: the bot personas (`tests/personas.ts`, `endless-personas.test.ts`) must show each persona
  converging to its target clear rate, late chapters harder than early ones for every persona, and no
  oscillation. Add personas with distinct habits (edge-scanner, centre-scanner, bend-blind, rusher, hinter) and
  prove tailoring makes boards harder *for that habit* while staying solvable.
- Daily boards stay byte-identical (one board for the whole world). Rush and Zen keep their own rules.

### D. New mechanics
Propose a short menu to the owner with one-line descriptions and a recommendation, then build the 3 or 4 they
pick. Candidates (or better ideas you find while researching):
- **Torii portals:** a path entering one gate leaves from its twin.
- **Bridges:** a path may cross a bridge cell but can't bend on it.
- **Rivers:** water cells a path can cross only in a straight line.
- **Ink that dries:** a blotted cell blocks paths for the next few pairs, then clears.
- **Ordered seals:** numbered cards must be paired in order.
- **Lantern night:** only cards near a lit lantern are readable; pairing lights the way.
- **Tide:** every few pairs a row or column slides (unlike wind, a fixed lane).

Each new mechanic needs, together:
- the engine rule and solver/bot support, and generation that is solvable by construction;
- an entry in `mechanics.ts` with its clashes and difficulty weight;
- a place on the road (intro chapter) in `plan.ts`;
- a one-time animated intro (demo, then "your turn") in `demos.ts`;
- paper-and-ink art in `src/art/` (no dots, stipple or dashes);
- reduced-motion handling;
- tests (rules, solver, generation, director);
- a bank rebuild.

### E. Rebuild and prove it
- Rebuild the bank (`npm run bank`) and the audit (`npm run bank:audit`). Write a before/after section in
  `docs/level-audit.md`: the curve per tier, the d distribution per chapter, persona clear rates, mechanic mix.
- Play-test on the phone (section 4). Endless 601+ must still reach the screen within 1.5 s with no freeze.

## 3. Rules

- **Never raise difficulty to sell hints, never fake near-misses, never punish streaks.** Assists keep their prices.
- Every board is solver-proven through the real rules. A generator change must not silently stale the bank (the
  bank test checks hashes).
- Saves keep `level`, `stars` and the player's tier pins; new model fields hydrate with safe defaults.
- Privacy: everything stays on the device. No analytics leave the phone.
- Tests first for every rule and policy change; never weaken, skip or special-case a test to get green.
- After adding any Korean or Japanese text, run `npm run fonts`.
- UI and motion: transform and opacity only, `prefers-reduced-motion`, the shared `--ease-settle`, both themes,
  360×640 and 390×844.
- Commit in green checkpoints (`npx tsc --noEmit`, `npx vitest run`, `npm run build`); push the branch and `main`;
  keep PR #1's description current. End commits with the session's attribution lines; never put a model name in
  commits, the PR or code. Never touch Play Console or AdMob (the owner is doing those: §0a of
  `docs/PLAY_STORE_RELEASE.md`).

## 4. Device play-test (if the phone is plugged in)

Tools from the last session:
- `scripts/device-play.mjs`: `seed --level N` (test installs only), `play --seconds N --boards N`, `endless`
  (times boards), `eval`.
- `scripts/device-qa.sh`: frame pacing, cold start, app errors.

Pitfalls:
- `adb` is in `C:\Users\aarav\AppData\Local\Android\Sdk\platform-tools` (not on PATH).
- The driver turns off Playwright's light colour-scheme emulation; raw CDP is the truth for theme checks.
- `adb shell wm size` locks the phone. Don't use it.
- The phone dreams and locks when idle; ask the owner to unlock it.
- Don't wipe the owner's own save without asking.

Measure on the phone: board generation time for 601+, frame pacing on the hardest boards, and play a few boards
of each new mechanic to check the intros and the feel.

## 5. Working model (the owner's standing rules)

The main session plans and manages; implementation runs in subagents (default Opus), up to 4 threads at once, each
a big milestone in its own git worktree (`git worktree add ../Jjak-thread-x`), time-boxed to 2 hours, tests first,
one validation cycle at the end (full gate + an independent verifier pass). Overlapping work goes to the same
thread. Suggested split: (1) metrics, fitness and the curve; (2) the player model, tailoring and policy, with
personas; (3) and (4) the new mechanics once the owner has picked them. The bank rebuild and audit come last, once
the threads are merged. Ask the owner direction questions as one short batch; decide implementation details
yourself.

## 6. Definition of done

- Before/after audit in `docs/level-audit.md`. Late chapters are measurably harder for every persona. Each
  persona converges to its target clear rate, and tailored boards are harder for the habit they target, all
  solver-proven.
- The new mechanics are in the game with intros, art, tests and a place on the road. The bank is rebuilt and
  every entry validates.
- tsc, all tests and the build are green, Android CI is green on the final commit, and the branch and `main`
  are pushed.
- The final message lists commits, the measured before/after numbers, what was play-tested on the phone, and the
  decisions still open.
