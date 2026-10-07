# Next session prompt: Jjak launch push

> Paste everything below the line into a new Claude Code session on this repo,
> or say: "Read `docs/NEXT_SESSION.md` and do it."
> **Part C is for your new requests.** Replace the placeholder with your list before you start.

---

You're continuing work on **Jjak (짝)**, a calm pair-connecting puzzle game (Shisen-sho rules) on the
48-card Hwatu/Hanafuda flower deck that Korea and Japan share. It ships to Google Play for a
13+ US/global audience. The look is paper and ink: no neon, no gamer style, nothing childish.

The previous session built a large launch expansion and was cut off by a usage limit midway
through the final QA and polish pass. Finish that work (Part A), get the build launch-ready
(Part B), then think through, design and build the owner's new requests (Part C).

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

## Part B: launch readiness
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
   - **(a)** Lucky cards start at chapter 5, so festival boards 1–4 don't have them.
   - **(b)** On Wind boards, the automatic reshuffle doesn't cost the no-assist blossom.
   - **(c)** Lucky petals pay on replays too (10 per lucky board).
   - **(d)** Font payload grew to 4.4 MB. Consider trimming.
   - **(e)** Suggested IAP prices: $0.99 / $2.49 / $4.99 for the pouches and $4.99 for the Supporter pack.

## Part C: the owner's new requests (think, reason, then develop)

> **OWNER: paste your list here before running this prompt.**
>
> - …
> - …

For **each** item:
1. **Think it through:** the goal, what the player actually wants, how it fits the calm 13+
   paper-and-ink tone, and how it interacts with the economy (≈ 300 petals per hour), the fair-ads promises
   and the 50-hour content budget. Research when facts matter (Play policy, plugin APIs, cultural
   accuracy for Korean and Japanese content) and cite primary sources.
2. **Reason about options:** 2–3 approaches with trade-offs (player value, build cost, risk, performance on
   mid-range Android). Pick one and say why.
3. **Develop it:** write a short spec into `docs/EXPANSION_PLAN.md` (a new section), then build it.
   - For large items, run parallel worktree subagents with explicit file ownership and contracts, as the
     last session did.
   - Add tests, verify with screenshots in both themes, commit and push.
4. **Report:** what shipped, what you decided and why, what the owner needs to do, and the open questions.

If Part C is still the placeholder when you start, finish Parts A and B. Then propose the 3–5 most
valuable next features for retention, revenue and launch quality, with reasoning, and ask the owner
which to build. Don't build them unasked.

## Definition of done
- Every Part A flow has been walked, with no console errors and nothing clipped at 360×640 or 390×844, in
  both themes.
- `npx tsc --noEmit`, `npx vitest run` and `npm run build` pass, and CI is green on the final pushed commit.
- Store screenshots, README, docs and the demo artifact match the shipped build.
- The final message lists: what changed (with commit hashes), what's left that only the owner can do (Play Console
  products, AdMob IDs, signing keys, `main` branch, privacy-policy hosting), and the open decisions.
