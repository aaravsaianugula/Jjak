# Next session prompt: a smarter Level Director, new mechanics, lunar festivals and new features

> Run this in a **local** Claude Code session in the repo folder (`D:\Coding\Jjak`), ideally with the Android phone
> plugged in over USB. Paste everything below the line, or say: "Read `docs/NEXT_SESSION.md` and do it."
> The previous prompt (validate on a real phone, polish, launch prep) is done; it lives in git history for this file.

---

You're continuing work on **Jjak (짝)**, a calm pair-connecting puzzle (Shisen-sho rules) on the 48-card
Hwatu/Hanafuda flower deck that Korea and Japan share. It ships to Google Play for a 13+ US/global audience.
The look is paper and ink: no neon, no gamer style, nothing childish, and **no dot, stipple or dashed textures**
(the owner's words: "Dots make it look cheap").

The owner's asks, in their words:
1. Make the game algorithm and system work better, so levels get **harder and more fun** as the player progresses;
   make the **patterns hard to spot based on the user**; **adjust the difficulty** to the user and how they play.
2. Add more **game mechanics**.
3. Add **lunar festivals like Seollal and Chuseok** to the festival calendar.
4. Add **new features**.

Work is on branch **`claude/pensive-goodall-f3ocnt`** (draft PR https://github.com/aaravsaianugula/Jjak/pull/1).
`main` mirrors it; push both when a checkpoint is green (`git push origin HEAD:main`).

## 0. Set up, prove the baseline, ask the owner once

```bash
git checkout claude/pensive-goodall-f3ocnt && git pull
npm ci
npx tsc --noEmit && npx vitest run && npm run build      # expect 367+ tests passing
npm run bank:audit                                         # the current curve: save it as the "before" snapshot
```

If the baseline isn't green, fix that first.

Then ask the owner **one batch** of questions (AskUserQuestion, with a recommendation on each):
- Which 3–4 new mechanics to build (menu in Part 2).
- Which new features to build (menu in Part 4).
- Whether festival weeks also bring in-game content (Part 4, item 1) or stay as the ad offer only.

Decide everything else yourself.

## 1. Read first (only these up front)

1. `docs/EXPANSION_PLAN.md` Part C (C1 Level Director, C3 mechanics and goals, C4 show-don't-tell, C5 endless).
2. `docs/GAME_DESIGN.md` §4 (level curve) and §5 (generation, solvable by construction).
3. `docs/level-audit.md` and `docs/level-curve.json` (how difficulty is measured today).
4. `docs/MONETIZATION.md` §4–4a (Remove ads and the festival-week ask).

Map of the code:
- `src/engine/`: rules, path finding, solver (`solve.ts`), generation (`generate.ts`), mechanics library
  (`mechanics.ts`), goals, session.
- `src/director/`:
  - `plan.ts`: level grammar (50 places × 12-slot rhythm).
  - `model.ts`: the player model.
  - `director.ts`: target difficulty and tiers.
  - `search.ts` + `bots.ts` + `metrics.ts`: generate-and-test, with bot players measuring difficulty d.
  - `validate.ts`: hard gates.
  - `bank.ts`: 600 levels × 5 tiers, built offline by `npm run bank`.
  - `endless*.ts`: 601+, generated live in a Web Worker.
- `src/ui/demos.ts`, `src/ui/intros.ts`: the animated one-time intro for each new idea.
- `src/services/ad-offer.ts`: the festival calendar (12 fixed-date festivals, a 7-day week each) and the
  Remove-ads ask rules. Its tests are in `tests/ad-offer.test.ts`.
- Tests: `tests/director.test.ts`, `model.test.ts`, `journey.test.ts`, `mechanics.test.ts`, `endless*.test.ts`,
  `personas.ts` (bot personas).

What exists today:
- **Mechanics:** variants, stones, falling leaves (gravity), first snow (hidden cards), lucky cards, knots, wind,
  gates, fences.
- **Goals:** Rhythm, Clean read, Full bloom, Straight brush.
- **Player model:** a skill rating, per-mechanic proficiency, frustration/boredom signals, and it already records
  first-tap positions (scan pattern) and time per bend count.
- **Policy:** the Director aims at 75–85 % assist-free clears, picks one of 5 tiers, pins the tier per level, and
  relieves after two failed tries. Struggling players floor at tier 0.

## Part 1. A harder, more personal Level Director

**A. Harder and more fun as the player progresses.**
- Redesign the target curve so difficulty clearly climbs across chapters, with a tension → peak → breather
  sawtooth inside each chapter and peaks a skilled player remembers.
- Difficulty comes from **arrangement and reading**, not smaller cards (board stays ≤ 8×7):
  - fewer free opening moves;
  - convincing decoy pairs;
  - longer two-bend paths;
  - critical pairs that must be cleared in a smart order;
  - late-board crunches that open into a combo finish.
- Make "fun" measurable in `metrics.ts` and in `search.ts`'s fitness, with tests:
  - an early foothold (never stuck in the first 10 s);
  - a mid-board crunch;
  - a satisfying run at the end;
  - variety between neighbouring levels.

**B. Patterns that are hard to spot, for this player.**
- From the model, find the player's habits:
  - where they look first (scan region);
  - which path shapes they're slow to see (bends, long detours, edge routes);
  - which mechanics they struggle with;
  - whether they rush (blocked taps) or freeze (long think time).
- Tailor each board to stretch those habits:
  - critical pairs outside their usual scan region;
  - the path shapes they read slowest;
  - believable decoys where they look first.
- Rotate the challenge so it never becomes one repeated trick, and keep a per-player record so the same blind spot
  isn't exploited board after board.
- **Fair and readable, always.** Every board is solver-proven and has a real foothold, and no pattern only a
  computer could see. Tailoring adds challenge inside the tier; it doesn't replace the tier.

**C. Difficulty that adjusts to how they play.**
- A richer skill estimate: ratings per path shape and per mechanic, each with a confidence.
- Flow detection from think time, pair rhythm and assists.
- Adjust both the tier and the *kind* of challenge (shapes, decoys, mechanics), not just one number.
- Calm guardrails:
  - smooth steps (no whiplash between boards);
  - relief after real struggle;
  - a stretch after easy streaks;
  - a breather after a peak.
- Fix the tier-0 trap, so hint-heavy players still progress and learn.

**D. Prove it with personas.**
- Add bot personas with distinct habits to `tests/personas.ts`: edge-scanner, centre-scanner, bend-blind, rusher
  and hinter.
- Show that each persona converges to its target clear rate without oscillating.
- Show that late chapters are harder than early ones for every persona.
- Show that tailored boards are harder *for the habit they target*, while staying solver-proven.
- Daily boards stay byte-identical (one board for the whole world). Rush and Zen keep their own rules.

## Part 2. New mechanics (build the 3–4 the owner picks)

The menu:
- **Torii portals:** a path entering one gate leaves from its twin.
- **Bridges:** a path may cross a bridge cell but can't bend on it.
- **Rivers:** water cells a path can only cross in a straight line.
- **Ink that dries:** a blotted cell blocks paths for the next few pairs, then clears.
- **Ordered seals:** numbered cards must be paired in order.
- **Lantern night:** only cards near a lit lantern are readable; pairing lights the way.
- **Tide:** every few pairs one fixed row or column slides (unlike wind).

Better ideas found while researching are welcome; recommend the strongest four.

Each mechanic ships complete:
- the engine rule;
- solver and bot support;
- generation that is solvable by construction;
- an entry in `mechanics.ts` (clashes, difficulty weight);
- an intro chapter in `plan.ts`;
- a one-time animated intro (demo, then "your turn") in `demos.ts`;
- paper-and-ink art in `src/art/` (no dots, stipple or dashes);
- reduced-motion handling;
- tests (rules, solver, generation, director).

## Part 3. Lunar festivals in the calendar

Add the lunisolar festivals to `src/services/ad-offer.ts`:
- **Seollal** (설날, Korean Lunar New Year, lunar 1/1; its week runs from the eve).
- **Chuseok** (추석, lunar 8/15), shown with Japan's **Tsukimi** (お月見 · 十五夜), which falls on the same night.
- Recommended: **Jeongwol Daeboreum** (정월대보름, lunar 1/15), **Dano** (단오, lunar 5/5) and **Chilseok**
  (칠석, lunar 7/7).

**Dates must be exact, never guessed.**
- Build a Gregorian date table covering at least **2026–2045** from the official Korean lunar calendar (KASI, the
  Korea Astronomy and Space Science Institute).
- Cross-check every date against a second independent source.
- Record the sources in a comment and in `docs/MONETIZATION.md`.
- A test pins every table date.
- A test starts failing in 2044 as a reminder to extend the table. After the table ends, the calendar falls back
  to the fixed festivals; it never guesses.

Rules to settle and test:
- **One ask per month still holds.** When a lunar festival's week shares a month with a fixed festival, the major
  lunar festival (Seollal, Chuseok) takes precedence. Decide the minor ones and write the rule down.
- **Weeks that cross a month boundary** (e.g. Chuseok from 30 Sep) count as one ask, for the month the week starts
  in, with no second ask when the next month begins.
- **Discount and copy** stay exactly as today (Play's two real prices, "this week (usually …)", no countdown).
- **Seals and art:** each festival gets its seal mark and names (Korean, plus Japanese where it's kept in Japan).

Run `npm run fonts` after adding the Korean and Japanese text.

## Part 4. New features (build what the owner picks)

Present this menu with a recommendation. Each item must fit the calm, on-device, no-pressure tone.

1. **Festival weeks in the game (recommended; it pairs with Part 3).** During each calendar festival:
   - a quiet festival touch on Home (the scene, the festival's seal);
   - a short set of themed festival boards;
   - a festival seal for the passport or album;
   - a cosmetic that is earned by playing, never bought.

   Missed items come back next year: no FOMO or countdowns.
2. **Your play style (recommended; it uses Part 1).** A stats screen with personal insights, for example "You read
   straight paths fast; two-bend routes are your growth edge". It shows a calm skill-trend chart, mastery per
   mechanic and best runs, all on device.
3. **Friend challenge codes.** Share any board as a short code through the OS share sheet; a friend enters it to
   play the same board and compare times. Deterministic seeds, no server.
4. **Practice room.** Replay any mechanic's intro plus a few practice boards for it, once the player has met it.
5. **Travel journal.** Each place on the Flower Road gives a postcard with a short real-world note, collected in a
   journal screen.
6. **Accessibility pack:**
   - a larger-cards option (fewer columns);
   - a high-contrast ink theme;
   - a left-handed tool bar;
   - colour-blind-safe month marks (numerals or shapes; never dots).
7. **Android home-screen widget** for today's Daily and the streak (native work: verify on the phone).

Each feature needs:
- tests for its logic;
- both themes, at 360×640 and 390×844;
- reduced motion;
- a browser check, then a phone check;
- docs updated.

## Part 5. Rebuild and prove it

- Rebuild the bank (`npm run bank`) and the audit (`npm run bank:audit`). Every entry must validate.
- Write a before/after section in `docs/level-audit.md`:
  - the curve per tier;
  - the d distribution per chapter;
  - persona clear rates;
  - the mechanic mix.
- Play-test on the phone (section 7). Endless 601+ must still reach the screen within 1.5 s with no freeze.

## 6. Rules

- **Never raise difficulty to sell hints, never fake near-misses, never punish streaks.** Assists keep their prices.
- Every board is solver-proven through the real rules. A generator change must not silently stale the bank (the
  bank test checks hashes).
- Saves keep `level`, `stars`, tier pins and the ad-offer state; new fields hydrate with safe defaults.
- Privacy: everything stays on the device. No analytics or play data leave the phone.
- Tests first for every rule and policy change; never weaken, skip or special-case a test to get green.
- After adding Korean or Japanese text, run `npm run fonts`.
- UI and motion: transform and opacity only, `prefers-reduced-motion`, the shared `--ease-settle`, both themes,
  360×640 and 390×844.
- Commit in green checkpoints (`npx tsc --noEmit`, `npx vitest run`, `npm run build`), push the branch and `main`,
  and keep PR #1's description current.
- End commits with the session's attribution lines; never put a model name in commits, the PR or code.
- Never touch Play Console or AdMob: the owner is doing those (§0a of `docs/PLAY_STORE_RELEASE.md`).

## 7. Device play-test (if the phone is plugged in)

Tools:
- `scripts/device-play.mjs`: `seed --level N` (test installs only), `play --seconds N --boards N`, `endless`
  (times boards), `eval`.
- `scripts/device-qa.sh`: frame pacing, cold start, app errors.

Pitfalls:
- `adb` lives in `C:\Users\aarav\AppData\Local\Android\Sdk\platform-tools` (not on PATH).
- The driver turns off Playwright's light colour-scheme emulation; raw CDP is the truth for theme checks.
- `adb shell wm size` locks the phone: don't use it.
- The phone dreams and locks when idle: ask the owner to unlock it.
- Android Auto Backup restores the save on reinstall; use `adb shell pm clear com.jjak.puzzle` for a clean start,
  only with the owner's OK, because it wipes their progress.

Measure on the phone:
- board generation time for 601+;
- frame pacing on the hardest boards;
- a few boards of each new mechanic (intros and feel);
- each new feature screen in both themes;
- a festival week, by seeding the device date in a test build or testing the pure date logic. Never change the
  phone's system clock without asking.

## 8. Working model (the owner's standing rules)

The main session plans and manages; implementation runs in subagents (default Opus), up to **4 threads** at once.
Each thread:
- takes a big milestone in its own git worktree (`git worktree add ../Jjak-thread-x`; the harness's built-in
  worktree isolation may not work in this repo);
- is time-boxed to 2 hours;
- writes tests first;
- runs one validation cycle at the end: the full gate plus an independent verifier pass.

Overlapping work goes to the same thread. Suggested split:
1. metrics, fitness and the curve;
2. the player model, tailoring and policy, with personas;
3. the new mechanics;
4. lunar festivals plus the chosen features.

Bigger work becomes sequential 2-hour milestones. The bank rebuild, audit and device play-test come last, once the
threads are merged. Review every thread's screenshots yourself before merging (subagents can't view images).

## 9. Definition of done

- A before/after audit in `docs/level-audit.md`:
  - late chapters measurably harder for every persona;
  - each persona converging to its target clear rate;
  - tailored boards harder for the habit they target;
  - everything solver-proven.
- The chosen mechanics are in the game with intros, art, tests and a place on the road. The bank is rebuilt and
  every entry validates.
- The lunar festivals are in the calendar with a verified, tested date table (2026–2045) and clear precedence
  rules.
- The chosen features work on the phone in both themes.
- tsc, all tests and the build are green, Android CI is green on the final commit, and the branch and `main` are
  pushed.
- The final message lists:
  - commits;
  - the measured before/after numbers;
  - what was play-tested on the phone;
  - the decisions still open.
