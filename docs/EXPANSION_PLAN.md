# Jjak 1.0 launch expansion: plan

Goal: launch with **~50 hours of meaningful play**, more cards, more levels, richer
animation, and a **Market** (reward shop) full of things players actually want, without
breaking the calm, fair tone.

## 1. What "50 hours" means (budget)

| Source | Boards | Avg minutes | Hours |
|---|---|---|---|
| Journey: 600 levels on the Flower Road (50 chapters × 12) | 600 | 2.8 | 28 |
| Re-plays for 3 stars (≈ 1 in 3 levels) | 200 | 2.5 | 8 |
| Daily Jjak (first 60 days) | 60 | 3 | 3 |
| Missions that send players to Rush / Zen / Daily | ~250 | 2.5 | 10 |
| Album, garden, Market browsing (meta time) | | | 1–2 |
| **Total** | | | **≈ 50** |

Flower Path (rank track, 100 ranks) and the Market price list were tuned to the same
clock: a steady player reaches rank 100 at around 50 hours. Since hints and shuffles became
petal-only (2026-10-07), the petals for the whole Market arrive at about 26 hours, less
whatever the player spends on tools.

**Economy target:** about **460 petals per hour** of active play, from all sources together
(stars, lanterns, Daily, missions, rank rewards, lucky cards, chests). Until 2026-10-07 it
was about 300 an hour plus roughly 170 an hour of value as free hints and shuffles; tools
now come only from a rewarded ad or the petal price, so every reward that held a tool pays
its price in petals (20 a hint, 15 a shuffle) and the total value is unchanged. The Market's
cosmetics + garden total is about **12,000 petals**. The cheapest items cost 60–150, so the
first purchase happens in the first session.

**Verified by simulation** (`tests/economy.test.ts`, run `npx vitest run tests/economy.test.ts`
to print the table). A steady player, ~50 min a day: the Daily, two Rush runs and two Zen
boards from missions, Journey for the rest (≈2.8 min a board, a replay for one level in
three), two blossoms on a first clear, three missions a day with the hard one done 70% of
days. Over 50.6 h they reach Journey level ~550 and earn **≈ 23,330 petals = 461 / h**:

| Source | Petals / h | | Source | Petals / h |
|---|---|---|---|---|
| Journey blossoms | 127 | | Daily | 17 |
| Lanterns (with the chapter gift) | 119 | | Rush | 16 |
| Star chests | 53 | | Missions | 16 |
| Flower Path rank rewards | 40 | | Lucky cards (estimate: 10 on 1 board in 8 from level 61) | 12 |
| Seals (old + new) | 24 | | Weekly chest | 9 |
| Gift calendar | 21 | | Zen | 7 |

Lanterns, star chests, rank rewards, the gift calendar and the weekly chest include the
petals that replaced their old hints and shuffles (≈ 169 / h). The Progression pillar
still pays mostly in XP, Warm tea, gold leaf and exclusives. **XP:** ≈ 76,500 by
50 h; the curve (`CURVE` in `src/data/meta.ts`: 80 XP to rank 2, then 180 + 12.1·(r−1))
puts **rank 2 at 5 min, rank 5 at 38 min, rank 10 at 1.5 h, rank 25 at 5.2 h, rank 50 at
15 h, rank 70 at 27 h, rank 85 at 37 h and rank 100 at 49.9 h.** About 22 gold-leaf cards
drop by then (plus a few from perfect clears), so the full gilded deck is a long-tail goal.

## 2. Pillars and owners

| Pillar | What ships | Main files |
|---|---|---|
| **A. Journey: the Flower Road** | 50 named chapters: real places in Korea and Japan, each with a season, KR/JP names and a postcard line. Level curve to 600 (then endless). Festival board at the end of each chapter. New mechanics: **Wind** (cards drift sideways/up), **Knots** (매듭: a tied card can't be picked until a pair clears next to it), **Lucky cards** (bonus pair, ids 48/49). Passport stamps per chapter, map redesign | `src/engine/*`, `src/data/route.ts`, `src/services/save-journey.ts`, `src/ui/screens/map.ts`, `src/styles/journey.css` |
| **B. Market (장터 · 市)** | Shop with tabs: Tools, Decks, Card backs, Brushes (path trails), Effects (match bursts), Papers, Garden, Music. Buy, equip, preview. Streak freeze ("Warm tea"). Album card pack | `src/data/market.ts`, `src/services/market.ts`, `src/services/save-market.ts`, `src/ui/screens/market.ts`, `src/styles/market.css` |
| **C. Progression** | Flower Path: XP → 100 ranks with titles and rewards. Daily missions (3) + weekly chest. Chapter star chests. Gold-leaf foil editions of all 48 cards (rare drops). Album: foil + bonus section. Petal bundles + Supporter pack (IAP) | `src/data/meta.ts`, `src/services/meta.ts`, `src/services/save-meta.ts`, `src/ui/screens/path.ts`, `src/styles/meta.css`, `album.ts`, `store.ts` |
| **D. Card art** | Two bonus card faces, gold-leaf foil overlay with shimmer, 5 extra deck styles, 5 extra card backs | `src/art/cards.ts`, `src/art/styles.ts`, `src/styles/cards-extra.css` |
| **E. Garden (정원 · 庭)** | A courtyard scene with 24 hand-placed items bought in the Market, in all four seasons, day/night, with gentle ambient animation | `src/art/garden.ts`, `src/ui/screens/garden.ts`, `src/styles/garden.css` |

## 3. Shared contracts (already in the code)

- **Events:** `src/services/events.ts` has `on('pair' | 'clear' | 'rush' | 'tool' | 'start', fn)`, emitted
  by the game screen. Features subscribe instead of editing the game loop.
- **Save slices:** `save.journey`, `save.market`, `save.meta`, `save.garden`, each with its own type, default and
  hydrate in `src/services/save-*.ts`.
- **Item keys:** `${category}:${id}`, e.g. `deck:sumi`, `back:seigaiha`, `garden:koi`.
  `save.market.owned` and `save.market.equip`.
- **Art APIs:** `DECK_STYLES`, `CARD_BACKS`, `applyDeckStyle`, `applyCardBack` and `foilOverlay` are in
  `src/art/styles.ts`, plus `cardPreviewSvg(id, style)` and `cardBackPreviewSvg(back)` for the Market. `GARDEN_ITEMS`,
  `gardenSvg` and `gardenItemSvg` are in `src/art/garden.ts`. `cardSvg(id, cls, { foil })`.
- **Streak freeze:** `save.streakFreezes` (Warm tea). The Market sells it and the progression feature consumes it.
- **Flower Path exclusives** (not sold for petals, granted by rank): `back:moon` r25, `brush:gold` r40,
  `garden:crane` r55, `deck:gilded` r70, `fx:gold` r85, `music:moonlight` r100. **Supporter pack** (IAP) exclusive: `back:clouds`.
- **Bonus cards:** ids 48/49 (`BONUS_IDS`, `isBonus`, `BONUS_MONTH` in `src/data/deck.ts`), month 12.
- **Routes:** `nav.market(tab?)`, `nav.garden()` and `nav.path()` (Flower Path + missions).

## 4. Tone rules (unchanged)

13+. Calm paper-and-ink look, no neon, no gamer style, nothing childish. No loot-box mechanics
for money: paid items are always shown with exactly what you get. Petals can't be bought
in a way that skips content walls. Ads stay as fair as before.

---

# Part C: the Level Director, new mechanics, show-don't-tell intros, the endless road

Owner's brief (paraphrased): levels must get properly challenging and stay fun, adapt to each
player from how they actually play, launch with **600 levels built by a system, not by hand**,
explain every new idea **by showing it**, and keep going forever after level 600 for players
who earn it.

## C0. How games do this (research basis)

| Idea | Source (why credible) | What Jjak takes from it |
|---|---|---|
| Templates + randomness + a guaranteed path first | GMTK on Spelunky ([video transcript](https://amara.org/videos/p6MHlmreohsY/en-gb/3101319); a design analysis of Derek Yu's published method) | Authored chapter/role *templates*, randomised boards, solvable by construction before anything is decorated. |
| Constructive vs generate-and-test | Togelius et al. 2011, [Search-based PCG: a taxonomy and survey](https://course.ccs.neu.edu/cs5150f13/readings/togelius_sbpcg.pdf) (peer-reviewed, IEEE TCIAIG) | A **constructive** solvable generator *inside* a **generate-and-test** loop scored by an evaluation function. |
| Experience-driven PCG | Yannakakis & Togelius, [Experience-driven PCG](https://www.um.edu.mt/library/oar//bitstream/123456789/29714/1/Experience-driven_procedural_content_generation_%28extended_abstract%29_2015.pdf) (peer-reviewed, IEEE TAC) | Content chosen from a **computational model of the player** built from gameplay metrics. |
| Dynamic difficulty adjustment | Hunicke & Chapman, [Hamlet (AAAI workshop)](https://users.cs.northwestern.edu/~hunicke/pubs/Hamlet.pdf) | An **evaluation function** (how is the player doing) plus an **adjustment policy** (what to change), reactive and proactive. |
| Pacing director | Left 4 Dead's AI Director ([Mike Booth](https://en.wikipedia.org/wiki/Mike_Booth); [Shacknews GDC write-up](https://www.shacknews.com/article/57892/left-4-dead-at-gdc), first-party talk) | Build-up / peak / relax: a **relief board** after struggle, a **stretch board** after an easy streak. |
| Bot playtesting to predict difficulty | Gudmundsson et al. 2018, [Human-Like Playtesting with Deep Learning](https://www.Gwern.net/doc/reinforcement-learning/imitation-learning/2018-gudmundsson.pdf) (King, IEEE CIG); Mugrai et al. 2019, [Automated Playtesting of Matching Tile Games](https://arxiv.org/abs/1907.06570v1) (IEEE CoG) | Score every candidate board with **bot personas** (greedy, random-legal, look-ahead, human-like scan) instead of guessing. King reports its CNN beat MCTS on accuracy and speed; we treat their speed-up figures as reported claims, not targets. Mugrai's personas (maximise/minimise moves, short vs long planner) map neatly onto our greedy / look-ahead / random bots. |
| Generated levels with a sawtooth curve, validated by players | Khalifa, Gopstein & Togelius 2019, [ELIMINATION from Design to Analysis](https://paperswithcode.com/paper/elimination-from-design-to-analysis) (IEEE CoG) | Every level from a constrained search; play traces of ~1,000 players confirmed the intended **sawtooth**. We use the same curve shape and the same "measure it" habit (audit report). |
| Hard constraints as a design space | Smith & Mateas, [ASP for PCG](https://course.ccs.neu.edu/cs5150f14/readings/smith_asp4pcg.pdf) (peer-reviewed, IEEE TCIAIG) | "Must be solvable", "fits the screen", "no repeats" are **hard validators** (reject and regenerate), never soft scores. |

## C1. The Level Director (launch: 600 levels, then endless)

**Goal.** Every Journey board comes from one system: authored mechanics and level grammar,
a player model, controlled randomness, and validators. Later levels become genuinely
challenging; each player gets boards near their flow zone; nothing is ever unsolvable.

**Options considered.**

| Option | Pros | Cons |
|---|---|---|
| A. Hand-tune 600 levels | Full control | Weeks of work; can't adapt; the owner explicitly ruled it out |
| B. Live generate-and-test on device for every level | Fully adaptive, no data shipped | Heavy search on mid-range phones; harder to audit; the curve isn't reviewable before launch |
| **C. Hybrid (recommended, as King does offline with bots):** offline bank for 1–600 at 5 tiers, live generation past 600 | Every launch level is validated and auditable before release; selection on device is instant; endless levels use the same code and validators | ~90 KB of bank data; the bank must be rebuilt if the generator changes (a test catches drift) |

**Architecture (five layers).**

1. **Authored layer.**
   - `src/engine/mechanics.ts`: the mechanic library (name, glyph, rule, intro chapter, clashes,
     difficulty weight). The engine hook lives in `rules.ts` / `levels.ts`; the intro demo in
     `src/ui/demos.ts`.
   - `src/director/plan.ts`: the **level grammar**. The 50 places × 12-slot rhythm
     (open → focus → plain → focus → focus → mix → rest → focus → mix → focus → peak → festival),
     the chapter's focus, allowed mechanic sets, shape per slot, goal slots, festival rules.
     `levelPlan(n)` is the level's **stable identity**: place, role, shape, mechanics, wind
     direction, goal, par. It never depends on the player.
   - A **bag randomiser** picks partner mechanics and goals so neighbouring levels never repeat
     a combination until the bag empties.
2. **Player model** (`src/director/model.ts`, data in `save.analytics`, never leaves the device).
   Every board writes a capped record: time vs par, think time to the first pair, median gap
   between pairs, the first taps (row/column fractions: scan pattern), blocked-path taps,
   reselects, hints/shuffles/auto-shuffles, best combo, Fever, bends per pair and time per bend
   count, quits and restarts, hour and date. It folds into:
   - a **skill rating** in difficulty units (Elo/Glicko-style: expected vs actual performance,
     step size shrinking with experience, so one bad board doesn't swing it);
   - **per-mechanic proficiency** (rolling score, quits, replays);
   - an **engagement signal** from the last few boards: *frustration* (quits, restarts, assists,
     far over par) vs *boredom* (several fast, clean clears in a row).
3. **Director** (`src/director/director.ts`, the adjustment policy). Target difficulty for level n =
   designed curve (sawtooth inside a chapter, rising across the road) + skill offset (±0.2) +
   pacing (relief after struggle, stretch after an easy streak). Mapped to one of **5 tiers**.
   Aim: **75–85 % of boards cleared without assists**, with real peaks. A level's tier is
   **pinned** when first started, so a retry or replay is the same board; after two failed
   attempts the Director may re-pin one tier lower (relief).
4. **Generator** (`src/director/search.ts`, constructive inside generate-and-test). For level n and
   tier t it builds K candidates with the solvable-by-construction generator from
   `seed(n, t, attempt)`, varying the knobs (stone count and layout, months, snow/knot/gate/fence
   counts). **Bots** (`src/director/bots.ts`) play each candidate: greedy, random-legal,
   look-ahead and a human-like edge-first scanner. Measured: legal moves along the solve
   (min/avg), 2-bend share, blocked decoy pairs, naive dead-end rate, mechanic load and an
   estimated solve time → a difficulty **d ∈ [0, 1]**. **Fitness** = closeness to target + novelty
   vs the previous levels (feature-vector distance) + fun (an early foothold, a mid-board crunch,
   an ending that opens up for a combo finish). The best candidate can be hill-climbed a few steps.
5. **Validators** (`src/director/validate.ts`, hard gates: reject and regenerate). The solver
   (`src/engine/solve.ts`) proves a full clear through the real rules; not trivial (minimum
   branching and 2-bend share by tier); dead-end risk inside the band; safety nets present; board
   ≤ 8 rows × 7 columns (tappable at 360 wide, measured above); generation time within budget; deterministic; Daily and Rush
   untouched.

**Where it runs.** Levels 1–600: `npm run bank` (bundled with rolldown, run on Node worker
threads) writes `src/data/level-bank.json`: per level, per tier, the winning attempt, its knobs and
metrics. On device the Director only *selects* the entry: instant and pre-validated. A test
rebuilds a sample of entries and checks a board hash, so a generator change can't silently
stale the bank. Past 600: the same search with a smaller K, in a Web Worker (C5).

**Fixing "later levels are too simple".** The old curve plateaued at 8×6 with gentle counts.
The Director's knobs: months and 4-variant density; stone count and layout (*lines* that force
long paths, *clusters* with open lanes); fewer free opening moves and more decoys; gate and fence
counts; mechanic combinations (wind + knots, snow + stones, gates + fences); level goals.
**Board size, measured** in Chromium: at 360×640 the play area is 344×421 px and boards are
height-bound, so **8×7** (8 rows, 7 columns) keeps the same ~33×47 px cards as 8×6, while **9×6**
shrinks them to ~31 px. At 390×844: 8×6 = 51 px, 8×7 = 48 px, 9×6 = 46 px. So 8×7 is allowed for
peak and festival boards later on the road; 9 rows never. Difficulty comes mainly from the
arrangement, not smaller cards.

**Dopamine without manipulation (13+).** Reward skill (combos, Fever, card sets, "clean read"
clears); boards that end opening up so a combo finish is possible; small variable rewards that
already exist (lucky cards, gold leaf). Never raise difficulty to sell hints, never fake
near-misses, never punish streaks. Assists stay priced exactly as before.

**Privacy.** All on device. The Data safety form and privacy policy don't change. Opt-in remote
analytics is a written proposal only (decision for the owner).

**Migration.** Saves keep `level` and `stars`. `save.analytics` hydrates to defaults (rating
0.35, mid tier). Levels the player already cleared keep their number; their board may differ
from the pre-Director build, which is fine pre-launch.

**Acceptance criteria.**
- `levelPlan(n)` is deterministic and player-independent; `playLevel(n)` is deterministic for a
  given pinned tier.
- 100 % of the 3,000 bank entries (600 × 5) validate: solver-proven, non-trivial, in band.
- Measured d is monotonic in tier for ≥ 95 % of levels, and the per-tier curve shows a sawtooth
  inside chapters and a rise across the road (audit report + chart, before and after).
- Persona simulations converge to the target clear rate without oscillation.
- Daily boards are byte-identical to the pre-Director build.
- Dev panel (`import.meta.env.DEV`) shows rating, tier, target and the chosen board's metrics.

## C3. New mechanics and level goals

The core is *reading* a same-flower pair joined by ≤ 2 bends. Ten ideas, judged on whether they
deepen that reading:

| Idea | Verdict | Why |
|---|---|---|
| **Gates (門)**: a gate shows a flower; pair that flower and the gate opens | **Ship** | Pure path-reading with planning: "which pair opens the way?" Solvable by construction (gate-aware placement order). |
| **Fences (울타리 · 垣)**: bamboo fences on cell edges block paths | **Ship** | Makes the 2-bend rule richer without hiding information; solvable by construction (fence-aware paths). |
| **Level goals** (third blossom: Rhythm ×4 combo, Clean read, Full bloom, Straight brush) | **Ship** | Rewards *how* you read, not just finishing. Never fails a level; it only takes the par blossom's place. |
| Bridges / stepping stones | Rejected | A cell paths may cross is just an empty cell; it only makes boards easier. |
| Lanterns lit by paths | Rejected | The game picks the path for you, so the player can't steer through a lantern: frustration, not skill. |
| Twin pairs (must clear back to back) | Rejected | An order constraint that can strand a board; reads as a gimmick. |
| Fog / night boards | Rejected | Hides information the core depends on; overlaps with First snow. |
| Rotating tiles | Rejected | Breaks the static reading of the board; busy and gimmicky. |
| Seasons in order | Rejected (as a mechanic) | Too prescriptive for a whole board; the goal system covers "play it a certain way" better. |
| Clear within N moves | Rejected | Pair count is fixed by the board, so "N moves" is either trivial or confusing. |

Gates appear from chapter 11 (Andong Hahoe, a village of gates), fences from chapter 14
(Damyang, the bamboo grove). Goals from chapter 6. Each has engine tests and a solvability fuzz,
and an animated intro (C4). Fences never share a board with sliding (leaves/wind).

## C4. Show, don't tell

**One reusable demo player** (`src/ui/demo.ts`): a mini board rendered with the real card art,
driven by a short script (`pair`, `tap`, `blocked`, `wait`, `caption`) and stepped through the real
rules (`rules.ts`), so a mechanic intro is ~10 lines of data. A soft ink-brush "hand" moves to each
card, the path draws itself, cards lift away and mechanics react (gates open, cards drift, knots
untie, snow turns). Each intro loops for 2–4 s, then hands over: "your turn" on the same mini board,
then play. Reduced motion shows the end state of each step instead of animating it.

**First minute for a new player** replaces the text welcome: (1) the brush pairs two cards and
the path draws, then 0 / 1 / 2 bends shown in turn; (2) the player makes a pair; (3) a blocked pair
shakes and the 3-bend path is shown crossed out; (4) three quick pairs show the combo. Captions of
two or three words. Skippable from the first frame, never shown to a returning player, and
measured: the first real pair should land within 20 s.

**Mechanic intros** for stones, falling leaves, snow, lucky cards, knots, wind, gates, fences
and goals use the demo player. **Replay intro** from How to Play and from the pause menu.

## C5. Beyond 600: the endless, personal road

- **Hidden until earned.** Before level 600 is cleared nothing mentions 601+: no Wanderer tabs,
  no "the road begins again" line, no counters past 600. The road reads as a finished journey of
  50 places.
- **The reveal.** Clearing level 600 plays a short shown sequence: the road draws itself past the
  last stamp into new country, "The road goes on · 길은 계속된다 · 道は続く", and a new passport
  page opens. After it, Home and the Map show "Wanderer · Year 2", rotating places and seasons,
  and a milestone stamp every 12 endless levels.
- **Personal generation.** Each endless level is generated live in a Web Worker with the same
  validators, then its spec is stored in the save so a retry or a restored save gives the same board.
- **Play-style profile** (`src/director/profile.ts`): scan pattern (edges vs centre, top vs bottom),
  bend preferences (time per 0/1/2-bend pair), speed profile (fast-and-loose vs careful),
  per-mechanic proficiency and enjoyment (replays, quits), assist habits, session rhythm.
  Used to **tailor, not trap**: place some key pairs where they don't look first, raise the 2-bend
  share a little at a time if 2-bend pairs slow them, favour mechanics they enjoy (the bag still
  guarantees variety), shorter boards for short sessions, a festival-style peak at a session's
  natural end, the same 75–85 % flow target.
- **Freshness.** A novelty check against the player's recent endless levels (shape, mechanics,
  goal, stone layout, difficulty); never the same feel twice in a row.
- **Rewards keep flowing** (blossoms, lanterns, missions, XP); petals stay first-clear only.

## Decisions for the owner (recommendations)

| Question | Recommendation | Why |
|---|---|---|
| May the Director go below the designed curve for struggling players? | **Yes, by one tier (−0.2 at most), never removing the level's mechanics** | Keeps the place's identity and teaches the idea, but stops frustration loops (Hamlet's goal). |
| Par fixed per level, or adaptive? | **Fixed per level** | Stars mean the same thing for everyone; the board adapts, the yardstick doesn't. |
| Can a goal fail a level? | **No: a goal only costs its blossom** | Calm tone; goals invite, they don't punish. |
| Skill tiers in the bank | **5** | Enough resolution for ±0.2 offsets in 0.1 steps; the bank stays ~90 KB. |
| Opt-in remote analytics later? | **Propose, don't ship at launch** | Data safety stays "no data collected"; revisit with real retention questions. |
