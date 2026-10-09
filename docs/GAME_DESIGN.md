# Jjak (짝) — Game Design Document

**One-liner:** a calm, beautiful pair-connecting puzzle built on the 48-card flower deck
that Korea (Hwatu 화투) and Japan (Hanafuda 花札) share.
**Audience:** global, ages 13–25 (Play target audience 13+, US first). **Platform:** Android (Google Play) via
Capacitor. **Business model:** free with fair ads. Research basis: [`RESEARCH.md`](RESEARCH.md).

---

## 1. Pillars

| Pillar | What it means in practice |
|---|---|
| **Readable in 3 seconds** | Tap two matching flowers. Month numerals on every card. |
| **Quietly juicy** | Ink-stroke paths, petal bursts, a bell that rises with each combo, and a seal stamp when you clear a board. Nothing loud. |
| **Culture as texture** | Hanji paper, sumi ink, vermilion seals, Korean and Japanese names. Never a theme park. |
| **Respect the player** | No forced ads mid-puzzle, no pay-to-win, no streak shaming, and progress saved offline. |

## 2. Core loop (10–90 seconds)

1. **See** a grid of flower cards (and, later, stones).
2. **Pair** two cards of the same month whose connecting path has ≤ 2 turns
   (Shisen-sho rule). The path may run around the outside of the board.
3. **Chain** pairs within 4 s for a combo (×2…×5): 짝짝, 짝짝짝… The Korean clap
   onomatopoeia doubles as the combo counter.
4. **Clear** the board. A seal stamps it, you get up to three blossoms, petals, and an
   album card.

**Tap rules (gentle by design)**

* Tapping a card of a *different* flower moves the selection; there's no penalty.
* Same flower but no legal path: a soft shake, plus a coach tip on early levels.
* No moves left: the board auto-reshuffles into a solvable layout (this costs the
  no-assist blossom).

## 3. Meta loops

| Loop | Cadence | Hook |
|---|---|---|
| **Journey: the Flower Road** | Session | 600 levels across 50 real places in Korea and Japan (12 per place), each in the season it's famous for, with a postcard line and a festival board at slot 12. After 600, "Wanderer" years revisit the road with fuller boards. |
| **Passport stamps** | Per chapter | Clearing a place's festival board stamps your passport: hand-drawn seals in four shapes and six inks, dated. 50 to collect. |
| **Flower Path 꽃길 · 花道** | Weeks | Free 100-rank track fed by XP from every mode. A reward on every rank, a new title every 10 (Seedling → Master of Flowers), and exclusives you can only earn: Harvest-moon back r25, Gold-thread brush r40, Crane r55, Gold-leaf deck r70, Gold-dust effect r85, Moonlight music r100. Tuned so rank 100 lands near 50 hours. |
| **Missions** | Daily / weekly | 3 missions a day (one light, one steady, one long) from a pool of 40, one free reroll each; 15 completions a week open the weekly chest. |
| **Star chests** | Per chapter | Chests at 12 / 24 / 36 blossoms per place. |
| **Market 장터 · 市** | Any time | Spend petals on tools, Warm tea (streak freeze), album cards, 5 deck styles, 5 card backs, path brushes, match effects, board papers, garden pieces and music. Every price is shown up front: no loot boxes, timers or fake discounts. |
| **Garden 정원 · 庭** | Daily | A courtyard that fills with the 24 pieces you buy, in four seasons, by day and night. A daily visitor (magpie, heron, tanuki…) leaves a short verse and a few petals. |
| **Gold leaf** | Months | Rare gilded editions of the 48 cards from rank rewards, chests and the occasional 3-blossom clear. A second album to finish. |
| **Daily Jjak** | Daily | One worldwide board per date with a weekday theme (Stone Monday, Snowy Tuesday, Leaf-fall Wednesday…). Streak counter, a 7-day strip on Home, a countdown to the next board, and an emoji share card. |
| **Album** | Weeks | 48 collectible cards with KR/JP names, romanization, and culture notes. One new card per first clear and per Daily. Each card shows which real card sets (yaku) it belongs to. |
| **Seals 印** | Weeks–months | More than 40 achievements in five groups (Play, Journey, Daily, Album sets, Flower Path), each paying petals. The Album sets are real Go-Stop / Koi-Koi yaku: 홍단 red poetry ribbons, 청단 blue ribbons, 초단 plain red ribbons, 고도리 Godori, 猪鹿蝶 Ino-Shika-Chō, 月見酒 / 花見酒, and 오광 Five Brights. Collecting is the only goal; nothing is wagered. |
| **Board papers** | Weeks | Completing all four cards of a flower unlocks that flower's paper (tinted backdrop with a faint motif), equipped in the Market. 12 to collect, plus 6 to buy. |
| **Flower Road map** | Any time | A winding route through all 50 places with blossoms and stamps; open a place to replay any of its levels. |
| **Zen** | Any time | Endless, untimed, no stars. |
| **Practice room 연습 · 稽古** | Any time | Every idea met on the road (its intro seen, or its first board behind you) with its animated intro to watch again and 3 gentle boards: the Director's tier-0, solver-proven bank boards for the first levels that feature it. From Settings (and How to play there). Practice never counts: no blossoms, petals, level, missions, skill rating or tier pins, and no hints or shuffles spent. Built from the mechanic registry, so new mechanics join on their own. |
| **Your play style 기풍 · 棋風** | Any time | A calm read-out of the on-device player model, from Settings: up to five plain sentences (strengths, habits, a growth edge) that appear only once their evidence clears a confidence floor (else "play a few more boards"); a comparison (one path shape over another, a mechanic against the overall rating) is named only when the gap clears 1.5 / 1 times the ratings' combined deviation, both signals agree, and a mechanic edge was played lately, which holds false claims under 5 % for players whose skill is the same everywhere (tests/insights-null.test.ts), an ink line of the skill rating over recent rated boards (a capped trail in the save), a learning / steady / at home band per idea met, and best runs from the records the save already keeps. Encouraging wording only; nothing leaves the phone. Rules: `src/director/insights.ts`. |
| **Rush** | Minutes | 60-second score attack: pairs add time, cleared boards add more, boards grow. Personal best, plus an optional rewarded "keep going +20 s" once per run. |
| **Fever** | Seconds | A ×5 combo starts 6 s of 만개 · 満開 "full bloom": double points and a glowing board. |
| **Card sets on the board** | Per board | Clearing every card of a real Go-Stop / Koi-Koi set (yaku) within one board scores a named bonus: 고도리 Godori +700, 猪鹿蝶 +700, 홍단/청단/초단 +500, 月見酒/花見酒 +400, 삼광 Three brights +900, 오광 Five brights +2000. The intro card hints when a board holds one. |
| **Gifts** | Daily / every 4 levels | 7-day gift calendar (never resets) and a lantern gift every 4th Journey level. |

## 4. Level curve

Levels 1–6 teach the basics (unchanged); from level 7 the Journey follows the
Flower Road (`src/data/route.ts`). The grammar lives in the Level Director's plan
(`levelPlan` in `src/director/plan.ts`; `journeyLevel` returns its middle tier), and
the board each player gets comes from the offline-built bank at their tier
(`src/director/bank.ts`, `npm run bank`; audit in `docs/level-audit.md`).

| Levels | Board | Variants | Teaches |
|---|---|---|---|
| 1 | 4×4 | identical | Tapping pairs, path bends |
| 2–5 | 4×4 → 6×5 | identical | Scanning bigger boards |
| 6 | 7×6 | **4 per flower** | "Match the flower, not the picture" (animated intro, then a your-turn pair) |
| Chapter 1 (levels 1–12) | up to 8×6 | yes | Full 48-card boards |
| Chapter 2 | | yes | **Stones** block paths |
| Chapter 3 | | yes | **Falling leaves**: cards drop to fill gaps after each pair |
| Chapter 4 | | yes | **First snow**: some cards start face-down and turn over when a neighbour clears |
| Chapter 5 | | yes | **Lucky cards**: a bonus pair (보너스패) worth +500 points and +10 petals |
| Chapter 7 | | yes | **Knots (매듭)**: a tied card can't be picked until a card beside it clears |
| Chapter 9 | | yes | **Wind**: cards drift left, right or up after each pair |
| Chapter 11 | | yes | **Gates (門)**: a gate opens when its flower is paired |
| Chapter 14 | | yes | **Fences (울타리)**: paths can't cross a bamboo fence |
| Chapter 23 (Miyajima) | | yes | **Torii (鳥居)**: a path that enters one torii comes out of its twin heading the same way; the jump costs no bend, the 2-bend rule holds over the whole path, and a path can't bend on a torii. One twin pair, two on roomy boards: the first vermilion, the second plain wood (白木), each with a bold plaque mark (一 / 二); selecting a card makes each pair's twins lift together for a moment |
| Chapter 25 (Yeosu) | | yes | **Streams (개울 · 小川)**: paths cross water (or run along it) only in a straight line; they never bend on a water cell. Two to six water cells in runs of 2–3 |
| Chapter 31 (Takayama) | | yes | **Seals (도장 · 印)**: two to four pairs carry a numbered vermilion seal on both cards; a sealed card can be picked only once every lower seal has left the board (it may pair with any card of its flower). Unsealed cards are free. Tapping one too soon gives a calm "not yet" shake and the seal that goes first answers; no penalty |
| Chapter 35 (Jeonju) | | yes | **Wet ink (먹 · 墨)**: two blots (four on roomy boards) of wet ink sit on cells with no card and block paths like stones; each dries after its own count of pairs (3–6), lightening a shade with every pair, then the cell is open. All blots are laid at the start; none appear later |
| Chapters 6–50 | | yes | Each place features one idea or a mix; level goals on about one board in four |
| 601+ (Wanderer) | | yes | Hidden until level 600 is cleared, then revealed ("The road goes on"). Each level is generated live for this player in a Web Worker, with the same validators |

**Inside every chapter** the 12 slots follow a rhythm: a warm-up, the chapter's idea, a
plain board, a mix, a smaller breather in the middle, a peak, and the **festival board**
(8×6 with +15 s par; 8×7 for peaks and festivals from place 20). Boards never exceed
8 rows × 7 columns, so cards stay tappable at 360 px wide. Designed difficulty is a
tension → peak → breather sawtooth inside each chapter (the open and rest boards are the
two dips, the peak stands clear of every other board, the festival sits high but below
it) on a road that climbs from about 0.25 (middle tier, first places) to about 0.7 (last
places; the top tier near 0.9). Wanderer years carry on from exactly there (the road
never steps down at a year's start) and level off towards 0.70, leaving the knobs room
for the endless road's variety. If the endless search ever finds nothing in time, the
board served is still solver-proven: the bank's board for the same place and slot
(`src/director/endless-fallback.ts`). Partner ideas and goals come from bag randomisers
so neighbours don't repeat (the bag holds each idea once, so an idea that keeps clashing
can't pile up and bury the newer ones). Snow, fences, torii, streams, seals and ink never
share a board with falling leaves or wind (terrain can't move, cards can't slide over it,
and sliding would scramble the seals' order); seals also keep off snowy and knotted cards
(one lock per card).

**Harder by arrangement, never by smaller cards.** Late and high-tier boards get a tricky
*arrangement* (`arrangeOf` in plan.ts, the generator's `arrange`): pairs placed far apart
(long two-bend reads), look-alike cards of one flower side by side (blocked decoys and
tempting wrong matches that lead to a dead end), and on the hardest boards the rim filled
first so the opening moves sit inside the board. Board sizes are unchanged.

**Fun, measured** (`src/director/metrics.ts`, folded into the search's fitness), each
read off the human-like scanner's games at its calibrated pace (1.1 s a pair plus 0.3 s
per card looked at): an **early foothold** (the scanner makes its first easy 0–1 bend
pair inside 10 s of play; the validators separately insist on at least one easy pair at
the start), a **mid-board crunch** (most games hit a tight spot in the middle third: at
most two legal pairs while five or more are still on the board), a **combo finish** (the
last six pairs, or the whole board if smaller, each come with a choice of pairs and
inside the 4 s combo window, so the top combo is reached and held; it weighs most in the
fitness), and **variety** (a different shape, mechanics or goal from the level before).
The audit reports each mark's pass rate per tier and the distribution of each measure.

**Show, don't tell.** New players get an animated first minute instead of a rules
screen: the brush pairs two cards and the 0/1/2-bend rule draws itself, the player
makes a pair, a blocked pair is crossed out, and quick pairs build a combo. Every
new idea arrives the same way: a 2–4 s demo on a mini board stepped through the real
rules, then the player does it once (`src/ui/demo.ts`, scripts in `src/ui/demos.ts`).

**Adaptive difficulty (the Level Director).** The place, role, shape, mechanics, goal and
par of a level are the same for everyone; the board inside it comes from one of five
skill tiers, chosen on the device from how this player plays (time vs par, think time,
first taps, misreads, hints and quits) with relief boards after a struggle and stretch
boards after an easy streak. A level's tier is pinned so a retry is the same board.
See `docs/EXPANSION_PLAN.md` §C1.

**Mechanic safety nets** (never the player's fault, never a penalty): if snow or knots are
the only reason a board is stuck, they clear for free; if a board is still stuck it
reshuffles (and re-deals onto open cells if a card is walled in by stones). On Wind
boards the automatic reshuffle doesn't cost the no-assist blossom.

`maxStones(rows, cols) = floor(interior / 4)` (rounded down to an even number) keeps
boards open. **Par time** = `ceil((pairs × 4.5 + 10) / 5) × 5` seconds, +10 s for moving
or covered boards, +15 s for festival boards.

## 5. Generation (solvable by construction)

Pairs are placed one at a time into cells that are connectable *given only the pairs
already placed*. Removing them in reverse order is then always legal. Heuristics:

* most-constrained cell first;
* deep (interior) cells first, so the last placements, which are the player's first
  moves, sit near the rim;
* a look-ahead that rejects any placement leaving a free cell with no partner;
* retries, then drop two stones at a time as a last resort.

The tests fuzz 1,000 seeded boards and confirm full solvability by DFS on a sample. A
greedy play-through of levels 1–48 always finishes. Boards are deterministic per seed,
which is why the Daily is identical worldwide.

## 6. Economy and fair-ads policy

| Item | Source | Sink |
|---|---|---|
| **Petals** 🌸 | 5 per *new* blossom (no replay farming), 15 per Daily, 3 per Zen board, lanterns, Rush, lucky pairs, missions, rank rewards, chests, garden visitors. Simulated at **≈ 460 per hour** of steady play (`tests/economy.test.ts`) | Hint (20), Shuffle (15), the Market (≈ 12,200 of cosmetics and garden pieces) |
| **Hints/Shuffles** | 5 / 5 at start; then only a rewarded ad (+1) or the petal price. Rewards that once gave a tool give its price in petals (20 a hint, 15 a shuffle) | Using them |
| **Album cards** | First clear of each level, each Daily, optional rewarded "draw one more" | — |

**Ads** (all IDs in `src/config.ts`):

| Format | Where | Rules |
|---|---|---|
| Rewarded | Out-of-hints/shuffles dialog, "Double petals", "Draw one more card" | Always opt-in, and the reward is granted only on completion. |
| Interstitial | *Between* boards only | Never before level 5. At most once every 3 clears and once every 150 s. Never mid-puzzle. |
| Banner | Home and Album | Never over the board. |

**Audience and ads.** The Play Console target audience is 13+, so Jjak is not in the
Families programme and has no age gate. Ad requests are capped at **Parental Guidance**
content to suit an Everyone-rated game played by teens.

Consent goes through Google UMP before any ad request.

## 7. Art and audio direction

* **Palette (Paper):** paper #F3ECDF, ink #2A2724, vermilion #C4472F, gold #B8893B,
  indigo #2F4A6D. **Ink (dark):** #1C1B19 background with warm paper text.
* **Type:** Gowun Batang (display/Hangul), Gowun Dodum (UI), Zen Old Mincho (kanji/kana).
  All are SIL OFL, bundled, and subset by `npm run fonts`.
* **Cards:** original SVG art for all 48 cards, built in code (`src/art/`). Twelve flower
  motifs (palmate maple leaves, stamened plum and cherry blossoms, hanging wisteria and
  so on). The 14 special cards each have their own illustration: crane and red sun,
  bush warbler, viewing curtain, cuckoo under a crescent, eight-plank bridge,
  butterflies, boar, geese, full moon on a red sky, red-lacquer sake cup, the deer
  looking away, swallow, the umbrella poet with his frog, and the phoenix. Every
  illustration has a paper halo so it reads against the flowers, plus a kanji corner
  tag (a vermilion ring for brights, gold for animals). Ribbons are folded tanzaku
  slips; poetry ribbons carry あかよろし / みよしの. Korean decks use blue ribbons where
  Japanese decks use purple, and we use the Korean blue. The card back uses a seigaiha
  wave pattern (청해파 · 青海波) behind the seal.
* **Home scene:** a layered landscape that follows the player's current season: cherry
  and drifting petals, iris and fireflies, maple and falling leaves, plum and snow
  under a moon.
* **Game feel:** a title card at the start of each board, a two-layer ink-brush path with
  blots at both ends, a seal stamp and petal shower on clear, and a pause menu (Back
  never throws away a board in progress).
* **Music:** generative and synthesised live. Plucked notes wander a seasonal pentatonic scale (spring major, summer warm, autumn yo, winter in-scale) over a slow drone with a soft echo. It fades out during ads and pauses in the background.
* **Sound:** WebAudio synthesis only. A wood "tok" for taps and a pentatonic bell that
  climbs with the combo. The stamp sound is a low thump plus a chord.

## 8. Accessibility

Month number on every card, distinct silhouettes and ground colours per month (not
colour alone), ≥ 44 px tap targets, `prefers-reduced-motion` honoured, the screen-reader
label on each card names its flower and month, and sound/haptics can be toggled.

## 9. Roadmap (post-launch)

1. Localize the UI (ko, ja, es, pt-BR, id). The card and place names are already trilingual.
2. Play Games Services: Daily leaderboard and achievements.
3. Seasonal festival events tied to real dates (Seollal, Hanami, Dano, Tanabata, Chuseok, Tsukimi) with limited garden pieces earned by play.
4. Cloud save (Play Games saved games) so progress moves with the player.
5. More places on the Flower Road (Taiwan, and more of rural Korea and Japan), keeping the 12-level chapter rhythm.

See [`MONETIZATION.md`](MONETIZATION.md) for the full ad and engagement strategy.
