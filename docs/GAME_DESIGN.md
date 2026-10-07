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
| **Journey** | Session | Endless levels in 4 seasonal chapters × 12 levels, then "Year 2" with more stones. |
| **Daily Jjak** | Daily | One worldwide board per date with a weekday theme (Stone Monday, Snowy Tuesday, Leaf-fall Wednesday…). Streak counter, a 7-day strip on Home, a countdown to the next board, and an emoji share card. |
| **Album** | Weeks | 48 collectible cards with KR/JP names, romanization, and culture notes. One new card per first clear and per Daily. Each card shows which real card sets (yaku) it belongs to. |
| **Seals 印** | Weeks–months | 33 achievements in four groups (Play, Journey, Daily, Album sets), each paying petals. The Album sets are real Go-Stop / Koi-Koi yaku: 홍단 red poetry ribbons, 청단 blue ribbons, 초단 plain red ribbons, 고도리 Godori, 猪鹿蝶 Ino-Shika-Chō, 月見酒 / 花見酒, and 오광 Five Brights. Collecting is the only goal; nothing is wagered. |
| **Board papers** | Weeks | Completing all four cards of a flower unlocks that flower's paper (tinted backdrop with a faint motif) under Settings. 12 to collect. |
| **Journey map** | Any time | Every unlocked level with its blossoms, so you can replay for missing ones. |
| **Zen** | Any time | Endless, untimed, no stars. |
| **Rush** | Minutes | 60-second score attack: pairs add time, cleared boards add more, boards grow. Personal best, plus an optional rewarded "keep going +20 s" once per run. |
| **Fever** | Seconds | A ×5 combo starts 6 s of 만개 · 満開 "full bloom": double points and a glowing board. |
| **Card sets on the board** | Per board | Clearing every card of a real Go-Stop / Koi-Koi set (yaku) within one board scores a named bonus: 고도리 Godori +700, 猪鹿蝶 +700, 홍단/청단/초단 +500, 月見酒/花見酒 +400, 삼광 Three brights +900, 오광 Five brights +2000. The intro card hints when a board holds one. |
| **Gifts** | Daily / every 4 levels | 7-day gift calendar (never resets) and a lantern gift every 4th Journey level. |

## 4. Level curve

| Levels | Board | Months | Variants | Stones | Teaches |
|---|---|---|---|---|---|
| 1 | 4×4 | 4 | identical | 0 | Tapping pairs, path bends |
| 2–5 | 4×4 → 6×5 | 6 → 12 | identical | 0 | Scanning bigger boards |
| 6 | 6×4 | 12 | **4 per flower** | 0 | "Match the flower, not the picture" (tip sheet) |
| 7–12 (Spring) | 6×5 → 8×6 | 12 | yes | 0 | Full 48-card boards |
| 13–24 (Summer) | as above | 12 | yes | 2 from slot 4 | **Stones** block paths |
| 25–36 (Autumn) | as above | 12 | yes | 2–4 | **Falling leaves** on every other level from 27: cards drop to fill gaps after each pair |
| 37–48 (Winter) | as above | 12 | yes | 2–6 | **First snow** on every other level from 38: ~20% of cards start face-down and are revealed when a neighbour clears |
| 49+ (Year 2…) | loops | 12 | yes | up to `maxStones` | All three ideas mixed (never falling leaves and snow on the same board) |

Falling-leaves and snow boards get +10 s of par time. If snow is the only reason a board is stuck, all snow melts for free; if it's still stuck, the board reshuffles.

`maxStones(rows, cols) = floor(interior / 4)` (rounded down to an even number) keeps
boards open. **Par time** = `ceil((pairs × 4.5 + 10) / 5) × 5` seconds.

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
| **Petals** 🌸 | 5 per *new* blossom (no replay farming), 15 per Daily, 3 per Zen board | Hint (20), Shuffle (15) |
| **Hints/Shuffles** | 3 / 2 at start, +1 each per chapter finished, rewarded ad (+1) | Using them |
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

1. Localize the UI (ko, ja, es, pt-BR, id). The card names are already trilingual.
2. Play Games Services: Daily leaderboard and achievements ("Complete the Album").
3. "Remove ads" in-app purchase and cosmetic card backs and board papers.
4. Weekly "Festival" boards tied to real seasonal events (Seollal, Hanami, Chuseok, Tsukimi).
5. Optional "Yaku" sets (Korean *Godori*, red/blue ribbons) as bonus objectives, with no wagering.


See [`MONETIZATION.md`](MONETIZATION.md) for the full ad and engagement strategy.
