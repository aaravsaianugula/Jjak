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
