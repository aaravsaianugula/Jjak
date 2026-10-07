# Next session prompt: Jjak launch push

> Paste everything below the line into a new Claude Code session on this repo,
> or say: "Read `docs/NEXT_SESSION.md` and do it."
> Order: Part A must-fix bugs → **Part C (the main work)** → Part B launch readiness on the final build.

---

You're continuing work on **Jjak (짝)**, a calm pair-connecting puzzle game (Shisen-sho rules) on the
48-card Hwatu/Hanafuda flower deck that Korea and Japan share. It ships to Google Play for a
13+ US/global audience. The look is paper and ink: no neon, no gamer style, nothing childish.

The previous session built a large launch expansion and was cut off by a usage limit midway
through the final QA and polish pass. Fix Part A's bugs first, then think through, design and
build the owner's new requests in Part C: the Level Director (a player-adaptive system that
generates and validates all 600 launch levels and endless ones after), new mechanics, and
show-don't-tell onboarding. Finish with Part B launch readiness on the final build.

## 0. Read first (in this order)
1. `docs/EXPANSION_PLAN.md`: the expansion, the shared contracts and the 50-hour content budget
2. `docs/GAME_DESIGN.md`: loops, the Flower Road level curve, economy, ad rules
3. `docs/MONETIZATION.md` and `docs/PLAY_STORE_RELEASE.md` (release steps, IAP setup, QA checklist §8)
4. `README.md` (project layout)

## 1. Where things stand
- **Branch:** `claude/quirky-lamport-37q8ip`. Develop, commit and push only there:
  `git push -u origin claude/quirky-lamport-37q8ip`.
- **No PR yet.** The repo has no `main` (default) branch. If `main` exists by now, open a
  **draft** PR from the branch.
- **Last verified state:** commit `369a62b`. `npx tsc --noEmit`, 115 Vitest tests and `npm run build` pass, and the
  GitHub Actions Android build (debug APK + release AAB) is green.
- **Built and merged:**
  - **Journey, the Flower Road** (`src/data/route.ts`, `src/engine/levels.ts`):
    - 50 real places, 12 levels each = 600, then "Wanderer" years.
    - Mechanics and the level each first appears: stones (L14), falling leaves (L26), snow (L38), lucky cards ids 48/49 (L50), knots
      (L74), wind (L98). Festival board at every slot 12.
    - Passport stamps (`src/art/stamp.ts`), the Map redesign, effects in `src/ui/journey-fx.ts`.
  - **Market** (`src/data/market.ts`, `src/services/market.ts`, `src/ui/screens/market.ts`, `src/ui/brush-fx.ts`):
    - 77 items. Cosmetics + garden total about 12,220 petals.
    - Extension points are wired in `src/main.ts` (`marketHooks`).
  - **Progression** (`src/data/meta.ts`, `src/services/meta.ts`, `src/ui/screens/path.ts`):
    - Flower Path, 100 ranks.
    - 3 daily missions + weekly chest, star chests, gold-leaf foil cards, Warm tea streak freeze.
    - IAP: `jjak_petals_small/medium/large` (consumable) and `jjak_supporter` (non-consumable), plus
      the existing `jjak_remove_ads`.
    - Economy simulation in `tests/economy.test.ts`: about 315 petals per hour, rank 100 at about 50 h.
  - **Card art** (`src/art/{cards,styles,palette,bonus,backs,specials}.ts`):
    - Lucky cards, the foil overlay, 5 deck styles, 5 card backs.
    - Gallery at `dev/cards.html` (`?view=boards|styles|backs|bench`).
  - **Garden** (`src/art/garden.ts`, `src/services/garden.ts`, `src/ui/screens/garden.ts`):
    - 24 pieces, 4 seasons, day/night, 8 daily visitors.
  - **Shared plumbing:**
    - Event bus `src/services/events.ts` (`pair`, `clear`, `rush`, `tool`, `start`).
    - Save slices `save.{journey,market,meta,garden}` in `src/services/save-*.ts`.
- **QA pass:** only one item finished, Home keeping Continue and Daily above the fold at 360×640
  (`369a62b`). Everything in Part A below is still open.

## 2. Environment facts (save yourself the rediscovery)
- **Stack:** TypeScript + Vite, vanilla DOM (`h()`/`frag()` in `src/ui/dom.ts`), Capacitor 8 Android
  (target SDK 36, min 24), Vitest. Plugins: `@capacitor-community/admob`, `@capgo/native-purchases`
  and `@capacitor/local-notifications`.
- **Android builds only in CI.** `dl.google.com` is blocked locally. Check CI with
  `curl -s "https://api.github.com/repos/aaravsaianugula/Jjak/actions/runs?branch=claude/quirky-lamport-37q8ip&per_page=3"`.
- **Dev server:** `npx vite --port 5173 --strictPort` (in the background).
- **Playwright:** import from `/home/user/Jjak/node_modules/playwright/index.mjs` and launch with
  `executablePath: '/opt/pw-browsers/chromium'`. Never run `playwright install`.
  - Seed saves in a **fresh context** via `storageState`, using localStorage keys `jjak.save.v1`
    **and** `CapacitorStorage.jjak.save.v1`. See `scripts/screenshots.mjs`.
  - Test 390×844, 360×640 and 412×915, in both `paper` and `ink` (`settings.theme`).
- **Running TS outside Vitest:** there's no tsx, vite-node or esbuild binary. Evaluate modules in the
  browser through the dev server instead: `page.evaluate(() => import('/src/engine/levels.ts'))`.
- **Fonts are subset to the glyphs used.** After adding any Korean or Japanese text, run `npm run fonts`.
  It's currently 4.4 MB across 242 slices.
- **Playable demo:** `node scripts/build-demo.mjs` produces `dist-demo/jjak.html`. Copy it to your
  scratchpad and republish it to the existing artifact https://claude.ai/artifact/7e8ecZK5UFJgiD9QqtehZ5
  (pass that URL to the Artifact tool).
- **Store assets:**
  - Screenshots: `SCALE=2.62 VIEW=412x732 npm run screens -- http://localhost:5173/ store/screenshots`
  - Feature graphic: `node scripts/render-feature.mjs`
  - Brand: `npm run brand`
- **Subagents:** they worked well in **git worktrees** (`isolation: "worktree"`; `.claude/worktrees/` is
  git-ignored). In each brief:
  - give each agent its own files and contracts
  - tell it to commit but not push, use its own dev-server port, and not run `npm run fonts`

  Then merge, resolve conflicts, verify, push, and remove the worktrees.
- **Commits:** end every message with the session's attribution lines. Never put a model name in
  commits or the PR. A stop hook demands that uncommitted work be committed and pushed, so commit in green
  checkpoints (tsc, tests and build all pass).

## Part A: finish the interrupted QA and polish pass
Walk every flow with screenshots (both themes; 390×844 and 360×640), fix what's broken or
unfinished, and commit in logical steps.

1. **Flows to walk:**
   - first launch → welcome → L1 tutorial; L6 tip
   - Home (new / mid-game with claimables / late game)
   - Journey: normal, festival, each mechanic, lucky pair, result sheet with stamp, XP, missions and seals
   - Map: open a place, replay
   - Daily, Rush (incl. end sheet), Zen
   - Market: every tab, buy, equip, can't afford, exclusive, album card, Warm tea, petal pouches/Supporter section
   - Garden: empty / partial / full / night / visitor
   - Flower Path: claim, claim all, missions, reroll, weekly chest, star chests
   - Album (foil + bonus), Seals, Settings (paper → Market, reset progress), gift calendar
   - pause, Android back handling, reduced motion
2. **The Rush end sheet** doesn't show XP. Add the Flower Path row (`pathResult`/`boardReport` in
   `src/ui/screens/path.ts` and `src/services/meta.ts`; it may need a Rush variant).
3. **How to Play** (`showHowToPlay` in `src/ui/screens/settings.ts`) lacks Wind, Knots, Lucky cards,
   Market, Garden and Flower Path. Keep it short and visual.
4. **Garden:** when you preview a season that today's visitor can't appear in, the line under the scene
   still offers that visitor.
5. **Market performance:** `cardPreviewSvg` inlines whole motifs (10–40 KB each). Measure the Decks tab
   (scripting time, DOM size) and lighten it if it's sluggish (cache or `<use>` reuse).
6. **Lucky cards 48/49:** confirm the real art shows on the board. Remove any leftover gold placeholder or rim.
7. **Reset progress:** cosmetics fall back to defaults with no crash. Purchase receipts survive
   (`resetSave` in `storage.ts` keeps `meta.supporter` and `meta.iapTokens`).
8. **Animation polish** (the owner asked for more), with transform/opacity only. Respect
   `prefers-reduced-motion`, and keep it smooth on mid-range Android:
   - screen transitions
   - a staggered Home entrance
   - press states
   - the Flower Path strip filling when XP is gained
   - the Market tab switch
   - the Map chapter expanding
   - a petal-count bump wherever the balance changes

   Elegant, not busy.
9. **Small items from the merges:**
   - Garden tap targets: tapping open water in the middle of the pond opens the Koi sheet.
   - Garden piece names wrap at 4 columns.
   - The fountain doesn't clack on its loop.
   - Moonlit deck: dark hills become silver.

   Fix whichever ones are cheap.

## Part B: launch readiness (do this last, on the final build)
1. Update `scripts/screenshots.mjs` for the new screens. Regenerate `store/screenshots/` (pick the 8
   strongest: Home, a Flower Road board with a mechanic, the Map, the Market Decks tab, the Garden at
   night, Flower Path, a result sheet with a stamp, Fever), and update the README screenshot tables.
2. Refresh the feature graphic if it no longer represents the game.
3. Check §8 of `docs/PLAY_STORE_RELEASE.md` against the build. Tick off whatever you can verify in the
   browser, and leave device-only items (ads, billing, notifications, back button) clearly marked.
4. Rebuild and republish the demo artifact. Make sure CI is green on the final commit.
5. Run `/code-review` (high effort) on the expansion diff (`35b4557..HEAD`) for correctness bugs, especially in the
   save hydration and migration of older saves, the IAP grant/consume/restore paths, the economy (no farming
   loops), and the mechanic solvability safety nets. Fix what's real.
6. **Decisions for the owner.** Put them in the final summary, with a recommendation for each:
   - **(a)** Lucky cards start at chapter 5, so festival boards 1–4 don't have them. (May be superseded by the Director.)
   - **(b)** On Wind boards, the automatic reshuffle doesn't cost the no-assist blossom.
   - **(c)** Lucky petals pay on replays too (10 per lucky board).
   - **(d)** Font payload grew to 4.4 MB. Consider trimming.
   - **(e)** Suggested IAP prices: $0.99 / $2.49 / $4.99 for the pouches and $4.99 for the Supporter pack.

## Part C: the owner's new requests (think, reason, then develop)

The owner's words, lightly edited:

> Build an algorithm that looks at the player's data (time to solve, which cards they move first,
> where on the board they make their first moves, and any other gameplay and time-spent analytics the
> app can get) and uses it to make levels harder or easier. Right now the later levels are too simple
> and not challenging enough. Levels need to get challenging while still giving the dopamine hit
> players want, so they get hooked.
>
> Build an intro for new users that shows them how to play and explains the game. When new features
> or mechanics arrive in later levels, the game must explain them by **showing** them, not with text
> like it does now, because text is boring.
>
> Make sure the algorithm makes levels fun, more challenging and adaptive to the player. Every level
> should feel fresh and challenging, never simple, boring or repetitive. Be creative about making
> levels more fun and challenging so players stay hooked.
>
> For launch, have **100–200 levels**. Make sure each one is fun and that the algorithm ties into
> them and changes them for each player. Add new mechanics and things to the game, but keep it fun
> and nice to play. Don't fill it with gimmicks or anything that takes away from the core idea.
>
> **Update from the owner:** launch with **600 levels**, built by a system rather than by hand.
> We author the mechanics and cards, player behaviour feeds in, controlled randomness is added,
> and checks guarantee nothing is broken or unsolvable, giving effectively infinite levels.
> Research how games achieve this.

Treat this as the main work of the session, after Part A's must-fix bugs. Read the current code
first: `src/engine/{levels,generate,session,moves,path}.ts`, `src/data/route.ts`,
`src/ui/screens/{welcome,game}.ts`, `src/ui/journey-fx.ts` (the knots/wind "Try it" tips) and
`showVariantTip` in `game.ts`.

### C1 + C2. The Level Director: a system that builds every level (launch with 600, then endless)

**Owner's decision:** launch with **600 levels**, and don't hand-make them. Build a system:

1. **We author** the mechanics and the cards.
2. **The player-behaviour model** feeds in.
3. **Controlled randomness** is added.
4. **Checks** guarantee nothing is broken or unsolvable.
5. **Result:** effectively infinite levels. From then on we only build new mechanics, and the
   system does the rest.

This is a known, proven pattern. Study it before designing (see "How games do this" below) and
write the design into `docs/EXPANSION_PLAN.md` §C1 first.

#### How games do this (research; read these and cite them in the spec)
| Idea | Who did it, and what it means for Jjak | Source |
|---|---|---|
| **Templates + randomness + a guaranteed path** | Spelunky hand-authors room templates, randomises parts of them, and **first guarantees a solvable route** before decorating. For Jjak: authored chapter/role templates, randomised boards, solvable by construction (we already do the last part). | [GMTK: How and Why Spelunky Makes its Own Levels](https://amara.org/videos/p6MHlmreohsY/en-gb/3101319) |
| **Constructive vs generate-and-test** | Togelius et al.'s taxonomy: constructive generators build once; generate-and-test builds candidates and scores them with an evaluation function (search-based PCG). For Jjak: a constructive solvable generator *inside* a generate-and-test loop. | [Togelius et al. 2011, Search-based PCG: a taxonomy and survey](https://course.ccs.neu.edu/cs5150f13/readings/togelius_sbpcg.pdf) |
| **Experience-driven PCG** | Yannakakis & Togelius: generate content from a **computational model of the player's experience**, built from gameplay metrics and level parameters. This is exactly "player data → level". | [Yannakakis & Togelius, Experience-driven PCG](https://www.um.edu.mt/library/oar//bitstream/123456789/29714/1/Experience-driven_procedural_content_generation_%28extended_abstract%29_2015.pdf) |
| **Dynamic difficulty adjustment** | Hunicke's Hamlet: an *evaluation function* (how is the player doing) plus an *adjustment policy* (what to change), adjusting both reactively and proactively to keep the player in flow. | [Hunicke, Hamlet (PDF)](https://users.cs.northwestern.edu/~hunicke/pubs/Hamlet.pdf) |
| **Pacing director** | Left 4 Dead's AI Director: when things have been intense too long it schedules a break, and when quiet it raises tension. For Jjak: relief and stretch boards. | [Mike Booth (Wikipedia)](https://en.wikipedia.org/wiki/Mike_Booth), [Shacknews GDC write-up](https://www.shacknews.com/article/57892/left-4-dead-at-gdc) |
| **Bot playtesting to measure difficulty** | King plays Candy Crush levels with **human-like bots** to predict difficulty before release. Their CNN beat MCTS in accuracy and speed and cut level iteration from days to minutes. Mugrai et al. used **MCTS "procedural personas"** (different playstyles) to playtest matching-tile games. For Jjak: solver bots with several personas score every candidate board. | [Gudmundsson et al. 2018, Human-Like Playtesting with Deep Learning (PDF)](https://www.Gwern.net/doc/reinforcement-learning/imitation-learning/2018-gudmundsson.pdf), [Mugrai et al. 2019, Automated Playtesting of Matching Tile Games](https://arxiv.org/abs/1907.06570v1) |
| **Generated levels with a sawtooth curve, validated by players** | ELIMINATION generates all levels with a constrained evolutionary algorithm; play traces from about 1,000 users confirmed the intended sawtooth difficulty curve. | [ELIMINATION from Design to Analysis](https://paperswithcode.com/paper/elimination-from-design-to-analysis) |
| **Hard constraints as a design space** | Smith & Mateas describe the design space declaratively and let a solver produce only valid content, which suits "must be solvable" style constraints. | [Smith & Mateas, ASP for PCG (PDF)](https://course.ccs.neu.edu/cs5150f14/readings/smith_asp4pcg.pdf) |

These sources are academic papers and first-party talks or interviews. Treat the industry
numbers (King's 7 days → 1 minute) as reported claims, not targets.

#### Architecture (recommended; challenge it if research suggests better)

**Five layers:**
1. **Authored layer (what we design by hand).**
   - **A mechanic library:** each mechanic (stones, falling leaves, snow, lucky, knots, wind, plus
     the C3 additions) is a module with:
     - its parameters and legal ranges
     - placement rules
     - an engine hook
     - a solvability safety net
     - a difficulty contribution
     - its intro demo (C4)
     - the level it unlocks at
   - **The deck.**
   - **Level grammar:** the Flower Road's 50 places, the 12-slot chapter rhythm (warm-up → focus →
     breather → peak → festival), allowed mechanic sets per chapter, board-shape ranges, goal types
     (C3) and festival rules.
   - **No per-level hand work.** A new mechanic means one new module plus where it may appear.
2. **Player model, on-device** (the Hamlet-style evaluation function). Each board records, into a
   capped `save.analytics` slice:
   - solve time vs par
   - think time before the first pair and between pairs
   - the first cards touched and where (edge vs centre, scan pattern)
   - mismatches and blocked-path taps, reselects
   - hints, shuffles, auto-shuffles
   - combos and Fever
   - restarts and quits mid-board
   - session length, days active
   - per-mechanic results

   These fold into:
   - a skill rating (Elo/Glicko-style)
   - per-mechanic proficiency
   - an engagement signal (frustration vs boredom) from recent boards

   Use rolling windows, so one bad board doesn't swing it.
3. **Director** (the adjustment policy and pacing). It computes a **target difficulty** per level:
   - the designed curve (sawtooth within chapters, rising across the road)
   - plus the player's skill offset
   - plus pacing: a relief board after struggle, a stretch board after an easy streak (the L4D
     Director idea)

   The aim is ~75–85% of boards cleared without assists, with real peaks.
4. **Generator** (constructive inside generate-and-test).
   - **Candidates.** For level *n*, the player tier and an attempt key, build K candidate boards
     with the existing solvable-by-construction generator. Use seeded randomness from
     `seed(level, tier)` so a retry is the same board, and the **Daily stays identical for
     everyone**.
   - **Variety.** Choose mechanics and goals with a **bag randomiser** (no repeats until the bag
     empties), so neighbouring levels never feel the same.
   - **Scoring.** Score each candidate with **bot personas** (greedy, random-legal, lookahead/MCTS-lite,
     "human-like" heuristics such as edge-first scanning) to measure:
     - legal pairs available along the solve (minimum and average)
     - the share of pairs needing 2-turn paths
     - blocked decoy pairs
     - dead-end probability for naive play
     - mechanic load
     - an estimated solve time
   - **Fitness** = closeness to the target + novelty vs the last levels (feature-vector distance) + fun
     heuristics (an early foothold, a mid-board crunch, an ending that opens up for a combo finish).
   - **Refinement.** Optionally hill-climb or evolve the best candidate a few steps (as ELIMINATION does).
5. **Validators** (hard gates; reject and regenerate on failure):
   - a full solver proves the board is clearable from its initial state, including mechanics
   - no trivial boards (minimum branching and 2-turn share)
   - dead-end risk inside the band
   - safety nets present
   - cards tappable at 360-wide (board ≤ the tested size)
   - generation time within budget
   - deterministic output
   - Daily and Rush rules respected

**Where the work runs (recommended hybrid, as King does offline with bots):**
- **Offline, at build time** (a Node script in CI): run the heavy search for levels 1–600 at, say, 5
  skill tiers. Ship a small **level bank** of seeds plus metrics as JSON (a few KB per level). On
  the device, the Director just *selects* the bank entry for the player's tier, which is instant
  and fully validated.
- **On device** (a Web Worker, cheaper K and fast checks): levels 601+ (endless), and fallback.
  Infinite levels with the same guarantees.

**Fixing "later levels are too simple."** The current curve plateaus (8×6 maximum, gentle mechanic
counts). Give the Director real knobs:
- months and 4-variant density
- stone count and placement that forces long paths
- fewer free moves early and more decoys
- tighter par
- mechanic combinations (wind + knots, snow + stones, …)
- level goals (C3)

Test 9×6 or 8×7 at 360 wide before allowing it.

**Dopamine without manipulation** (13+):
- reward skill: combos, Fever, card sets, "perfect read" clears
- small variable rewards
- boards that end on a high note

Never raise difficulty to sell hints, never fake near-misses, never punish streaks.

**Privacy:** all on-device. The Data safety form and privacy policy stay as they are. Remote analytics
(Firebase or Play Games) is a written proposal only.

**Tests:**
- personas converge to the target clear rate without oscillation
- difficulty is monotonic in the knobs
- determinism
- 100% of the 600-level bank plus a fuzz of endless levels validate
- the Daily is unaffected
- generation stays within budget
- an **audit report** with the measured difficulty curve for all 600 levels per tier, flagging
  "too similar to neighbours" and outliers

Publish the curve as a chart artifact, before and after. Add a dev panel (`import.meta.env.DEV`)
showing the player rating, the target and the chosen board's metrics.

**Migration:** existing saves keep their level number and stars. A level's place, role and
mechanic identity stay stable; only the board within that identity adapts.

### C3. New mechanics and level goals that deepen the core
The core is **finding a same-flower pair joined by a path with at most two turns**. New ideas must
make that reading richer, not distract from it. Brainstorm 8–10, pick the best **3–4**, and
explain why the others were rejected. Directions to evaluate (they're not mandatory):
- **Bridges / stepping stones:** a cell paths may cross through.
- **Walls / fences on cell edges:** paths can't cross them.
- **Pair order / "seasons in order":** clear one flower's pairs first for a bonus.
- **Lanterns:** a path through a lantern cell lights it, and the goal is to light them all.
- **Twin pairs:** two matching pairs that must be cleared back to back.
- **Fog / night boards:** you see only near cleared space.
- **Rotating tiles.**
- **Level goals instead of only "clear the board":** clear all Brights, finish with a ×4 combo,
  use only 0- or 1-turn paths for a bonus, clear within N moves of the hint-free solution.

Every mechanic must stay solvable by construction or have a fair safety net. Add engine tests and
solvability fuzz for each, and follow the knots/wind pattern in `journey-fx.ts`.

### C4. Show, don't tell: new-player intro and mechanic introductions
- **New-player intro:** replace the text-heavy welcome and Level 1 coach with an *interactive,
  animated* first minute.
  1. A hand or ink brush **demonstrates** a pair on a tiny board, with the path drawing itself and
     the 0/1/2-turn rule shown visually.
  2. The player does it.
  3. A blocked-path demo shows why a pair doesn't connect.
  4. A combo is demonstrated.

  Minimal words. It must be skippable, never block a returning player, and respect reduced motion.
  Measure it: a new player should make their first real pair in under 20 seconds.
- **Every mechanic intro** (stones, falling leaves, snow, lucky, knots, wind, plus the C3 additions)
  becomes a short **animated demonstration on a mini board** (2–4 seconds, looping, the cards
  actually moving), then a 1-step "your turn" on that mini board, then play. Build one reusable
  "demo player" that scripts card moves, path draws and highlights, so every intro is about
  10 lines of data rather than custom code.
- Also offer a **Replay intro** from How to Play and from the level's pause menu.
- Test all of these with screenshots and short frame sequences in both themes at 360×640.

### Process
1. Spec each of C1–C4 in `docs/EXPANSION_PLAN.md`: goal, options with trade-offs, recommendation,
   acceptance criteria.
2. Build in parallel worktree agents with clear file ownership:
   - Level Director core: player model, Director, generator loop, validators, bots (C1+C2)
   - offline level-bank builder + audit + chart
   - new mechanics as library modules (C3)
   - the demo player + intro + mechanic demos (C4)

   Freeze the mechanic-module interface first, so C3 and C4 plug into the Director.
3. Verify by actually playing the first 30 levels, plus sampled later ones, in the browser.
4. Report the measured difficulty curve as a chart in an artifact, before and after.

**Decisions to put to the owner** (with a recommendation for each):
- whether the Director may go *below* the designed floor for struggling players
- whether par (stars) stays fixed per level (recommended, so stars mean something) or adapts
- whether level goals can fail a level, or only cost a star (recommended: only cost a star)
- how many skill tiers the bank holds (recommended: 5)
- whether to propose opt-in remote analytics later

## Definition of done
- Every Part A flow has been walked, with no console errors and nothing clipped at 360×640 or 390×844, in
  both themes.
- `npx tsc --noEmit`, `npx vitest run` and `npm run build` pass, and CI is green on the final pushed commit.
- Store screenshots, README, docs and the demo artifact match the shipped build.
- The final message lists: what changed (with commit hashes), what's left that only the owner can do (Play Console
  products, AdMob IDs, signing keys, `main` branch, privacy-policy hosting), and the open decisions.
