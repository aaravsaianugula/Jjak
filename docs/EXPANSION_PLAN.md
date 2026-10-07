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

Flower Path (rank track, 100 ranks) and the Market price list are tuned to the same
clock. A steady player reaches rank 100 and can afford roughly the whole Market at
around 50 hours.

**Economy target:** about **300 petals per hour** of active play, from all sources together
(stars, lanterns, Daily, missions, rank rewards, lucky cards, chests). The Market's
cosmetics + garden total is about **12,000 petals**. The cheapest items cost 60–150, so the
first purchase happens in the first session.

**Verified by simulation** (`tests/economy.test.ts`, run `npx vitest run tests/economy.test.ts`
to print the table). A steady player, ~50 min a day: the Daily, two Rush runs and two Zen
boards from missions, Journey for the rest (≈2.8 min a board, a replay for one level in
three), two blossoms on a first clear, three missions a day with the hard one done 70% of
days. Over 50.7 h they reach Journey level ~620 and earn **≈ 15,960 petals = 315 / h**:

| Source | Petals / h | | Source | Petals / h |
|---|---|---|---|---|
| Journey blossoms | 143 | | Rush | 16 |
| Lanterns | 46 | | Missions | 16 |
| Seals (old + new) | 24 | | Lucky cards (estimate: 10 on 1 board in 8 from level 61) | 14 |
| Flower Path rank rewards | 19 | | Gift calendar | 9 |
| Daily | 17 | | Zen | 7 |
| Star chests | 4 | | Weekly chest (XP, tools, gold leaf; no petals) | 0 |

The base game alone already gives ~270 / h, so the Progression pillar pays mostly in XP,
tools, Warm tea, gold leaf and exclusives and adds only ~45 petals / h. **XP:** ≈ 76,500 by
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
