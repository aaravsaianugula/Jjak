# Jjak: monetization and engagement design

**Goal:** earn money from ads without making the game feel cheap. Players should feel
that ads are a fair trade they *choose*, not a toll.

## 1. What the data says

| Finding | Source | Confidence |
|---|---|---|
| Ads are the #1 complaint in puzzle-game reviews (~41%): forced unskippable interstitials, ads on every screen, rewarded ads that fail to pay out. | [unstar.app 2026 review analysis](https://unstar.app/blog/gaming-app-reviews-what-mobile-gamers-hate-most-2026) | Medium (secondary analysis) |
| Mid-level interruptions in casual puzzle games can cut retention 20–30%. Excessive ad exposure cut DAU ~15% in a 2025 study. **Post-level completion** is the sweet spot for ads. | [Applixir — rewarded ad best practices](https://www.applixir.com/?p=3237) | Medium (vendor blog citing studies) |
| Use a **cooldown** so a player who just watched a rewarded ad isn't immediately hit with an interstitial, and limit frequency in early sessions. | [Applixir](https://www.applixir.com/?p=3237), [Unity — interstitial best practices](https://unity.com/blog/best-practices-for-maximizing-revenue-from-interstitial-ads-in-your-app) | Medium-High (ad-network guidance) |
| Rewarded video: **~87% of players view it positively**, 80–90% completion, the highest eCPMs (often 3–5× interstitials), and ~39% of casual-game ad revenue. | [Prado — rewarded video vs interstitials](https://prado.co/post/rewarded-video-holds-the-crown-but-interstitial-ads-are-catching-up), [Udonis — monetization trends](https://www.blog.udonis.co/mobile-marketing/mobile-games/mobile-game-monetization-trends) | Medium |
| Interstitials still make up a large share of casual-game revenue (~44% in some reports), so removing them entirely leaves money on the table. | [Prado](https://prado.co/post/rewarded-video-holds-the-crown-but-interstitial-ads-are-catching-up) | Medium |
| **Hybrid** (ads + IAP) earns ~28% higher ARPU than ads only, and a "remove ads" purchase monetizes the players who dislike ads most. | [Udonis](https://www.blog.udonis.co/mobile-marketing/mobile-games/mobile-game-monetization-trends), [Verve — hybrid monetization](https://verve.com/blog/hybrid-monetization-in-casual-games-how-beresnev-strikes-the-right-balance/) | Medium |
| Block Blast's pull comes from an **endless score chase** with no gates, plus short sessions and daily challenges. | [App Store listing](https://apps.apple.com/us/app/block-blast/id1617391485), [Sensor Tower / AppMagic rankings](https://maf.ad/en/blog/top-mobile-games-2025/) | Medium |

Numbers from vendor blogs are directional. Validate them with Jjak's own data (section 6).

## 2. Engagement loops (why people come back)

| Loop | Cadence | Hook |
|---|---|---|
| **Combo → Fever** | Seconds | Pairs within 4 s chain 짝짝짝…. At ×5 the board blooms (**만개 · 満開**) for 6 s of double points. |
| **Journey** | Minutes | Up to three blossoms per level, a new mechanic each season, and a **lantern gift every 4 levels** (petals; a chapter's last lantern holds more). The Home card counts down to the next lantern. |
| **Near miss** | Per board | Missing a blossom puts "Retry for 3 blossoms" on the result sheet, along with what you missed. |
| **Rush** | Minutes | A 60-second score attack. Pairs add 1 s (2 s at ×3+), clearing a board adds 8 s, and boards grow as the run goes on. You chase your personal best. |
| **Daily Jjak** | Daily | The same board worldwide, a weekday theme, a streak, a 7-day strip, and a share card. |
| **Gift calendar** | Daily | Seven days of gifts ending in an album card. **Missing a day never resets it.** |
| **Daily reminder** | Daily | Opt-in only, offered inline after your first Daily (never a pop-up). It names that day's theme ("Leaf-fall Wednesday · Daily #8 is ready"), skips days you've already played, and uses inexact alarms (no special permission). |
| **Card sets** | Per board | Clearing a real yaku set inside one board scores a named bonus, a discovery layer for players who learn the deck. |
| **Album, Seals, papers** | Weeks | 48 cards, 44 seals including real yaku sets, and 12 board papers. |
| **Flower Path 꽃길 · 花道** | Every board → ~50 h | Free 100-rank track fed by XP from all play. A title every 10 ranks, a reward on every rank (petals, Warm tea, gold-leaf cards), and six exclusives that can't be bought (`back:moon` r25 … `music:moonlight` r100). Rank 2 comes in the first session, rank 5 in the first hour, rank 100 at about 50 hours. |
| **Daily missions** | Daily | Three a day (light, steady, long) drawn from 40 templates across Journey, Daily, Rush and Zen, one free swap each. Completing them fills a **weekly chest** (15 → XP, petals and a gold-leaf card). Missing days costs nothing. |
| **Star chests** | Per chapter | Three chests per 12-level chapter at 12 / 24 / 36 blossoms: a reason to replay for missing blossoms. |
| **Gold leaf 金箔** | Months | Rare foil editions of album cards from rank rewards, weekly and 36-blossom chests, and a small chance on perfect first clears later on. Never for sale. |
| **Warm tea** | Daily | A streak freeze (hold up to 2). Missed days are covered automatically when the Daily is next solved. |

We deliberately avoid dark patterns: no paid loot boxes, no energy or lives, no streak
shaming, no fake countdown offers, and no ads that block progress.

## 3. Ad placements

| Placement | Format | When | Rules |
|---|---|---|---|
| Out of hints or shuffles | Rewarded | Player taps Hint/Shuffle with none left | Opt-in. +1 on completion only. With buying for petals, this is the only way to get more tools. |
| Double petals | Rewarded | Result sheet | Opt-in, once per board. |
| Draw one more card | Rewarded | Result sheet | Opt-in, until the album is complete. |
| Rush "Keep going +20 s" | Rewarded | Rush time runs out | Opt-in, once per run. This is the highest-intent placement. |
| Daily gift ×2 | Rewarded | Gift sheet | Opt-in, once per day. |
| Between boards | Interstitial | After a board, before the next one starts | Never before level 5, at most 1 per 3 boards and 150 s, never within **6 minutes of a rewarded ad**, always preceded by a **"Short break" notice**, never mid-puzzle. |
| Home and Album | Adaptive banner | On menus only | Never over the board. Home says beside it that ads can be removed. |
| App-open | — | — | **Not used**: high annoyance, low value for a puzzle game. |

All numbers live in `src/config.ts` (`AD_POLICY`), so you can tune them without touching game code.

## 4. Remove ads (one-time purchase)

* Google Play **managed product** `jjak_remove_ads`, suggested at **US$2.99**. Set it in
  Play Console → Monetize → Products → In-app products, using Play's local price
  templates for each country.
* Removes interstitials and banners. **Rewarded ads stay available**, because the player
  chooses them and some players like the rewards.
* Ownership is re-checked with Play on every launch. "Restore purchase" is in Settings,
  and resetting progress never removes the purchase.
* Where players learn they can remove ads (quiet text, plus the asks in §4a): a Settings row; a
  Remove ads card in Market → Tools → Support Jjak; one line above the banner on Home
  ("Ads keep Jjak free · Remove ads for $2.99"); a line on every "Short break" card; and a
  small text link on the result sheet **at most once a day, from the first interstitial on**.
  The Home line and the Market card appear only when Play has the product (no dead buttons).
* Ads themselves are capped at **G** in code, and the AdMob console blocks sensitive
  categories and keeps interstitials to still images (PLAY_STORE_RELEASE.md §2, step 8).
* Implemented with `@capgo/native-purchases` (Capacitor 8, Google Play Billing). Purchases
  are auto-acknowledged.

## 4a. When the game asks (first start, then one festival week a month)

The game itself opens the Remove ads sheet only on these occasions (`src/services/ad-offer.ts`,
triggered from Home by `askRemoveAdsIfDue` in `src/ui/remove-ads.ts`):

* **First start:** the first time a player reaches Home (for a new player that's after the
  intro, the first minute and the first board). Existing players who update are asked once
  the same way, since they were never asked before.
* **Then at most once a month, during that month's festival week** (the festival's date and
  the six days after it, by the phone's own calendar day). The first ask counts for its month,
  so a first start inside a festival week is one ask, not two.
* **Never** once ads are off (Remove ads, the festival product or the Supporter pack), and
  never after **"Don't ask again"**, a quiet button beside "Not now" that appears only on
  these asks. It's a preference: Reset progress keeps it (and keeps the ask history, so a
  reset isn't a new first start). Remove ads stays in Settings, Market and on Home.
* Only on Home, Android only, after the launch loader has gone, after the daily gift (and any
  card it reveals) has closed, never over the road's reveal, the board, or mid-puzzle. If the
  player leaves Home before it's time, the next visit to Home asks instead; if they opened
  Remove ads themselves this session, a later launch asks instead.

**Festival calendar.** Twelve fixed-date Korean and Japanese festivals, one per month. Lunar
festivals (Seollal, Chuseok, Dano) are left out on purpose: their dates move every year.

| Month | Festival | Native name | Week |
|---|---|---|---|
| Jan | New Year | 正月 · 신정 | Jan 1–7 |
| Feb | Setsubun | 節分 | Feb 3–9 |
| Mar | Hinamatsuri | 雛祭り | Mar 3–9 |
| Apr | Hanami | 花見 | Apr 1–7 |
| May | Children's Day | 어린이날 · こどもの日 | May 5–11 |
| Jun | Summer solstice | 하지 · 夏至 | Jun 21–27 |
| Jul | Tanabata | 七夕 | Jul 7–13 |
| Aug | Obon | お盆 | Aug 13–19 |
| Sep | Autumn equinox | 추분 · 秋分 | Sep 22–28 |
| Oct | Hangeul Day | 한글날 | Oct 9–15 |
| Nov | Shichi-Go-San | 七五三 | Nov 15–21 |
| Dec | Dongji | 동지 · 冬至 | Dec 22–28 |

**The festival price.** A second one-time, non-consumable product, `jjak_remove_ads_festival`
(suggested **US$2.49** against the regular US$2.99; Play sets local prices). It does exactly
what Remove ads does and is restored the same way. While a festival week is on, the Remove
ads sheet (asked or opened by the player) shows the festival's seal, date and names and, only
when Play reported both prices in the same currency and the festival one is lower, says
plainly: "Remove ads for $2.49 this week (usually $2.99)", and its Buy button buys the
festival product. If the festival product isn't set up (or isn't cheaper), the sheet still
shows the festival but sells Remove ads at the regular price and claims no discount. No
countdowns, no "last chance", no percentages.

## 4b. Petal pouches and the Supporter pack

Optional purchases for players who want to support the game or save time. They're shown
in one quiet "Support Jjak" section of the Market (`bundlesSection()` in
`src/ui/screens/path.ts`), never as pop-ups.

| Product | Type | Suggested price | Contents |
|---|---|---|---|
| `jjak_petals_small` | Consumable | US$0.99 | 600 petals |
| `jjak_petals_medium` | Consumable | US$2.49 | 1,600 petals |
| `jjak_petals_large` | Consumable | US$4.99 | 4,000 petals |
| `jjak_supporter` | Non-consumable | US$4.99 | Remove ads + 1,500 petals once + the Clouds card back (only here) + a Supporter seal |

* **Honest by design:** each tile shows exactly what you get and Play's own localized
  price. No timers, no "% off", no "best value" badges, no random contents. Larger
  pouches cost a little less per petal, simply because the prices step that way.
* **No pay-to-skip:** petals buy cosmetics, garden pieces and tools. Journey levels,
  ranks, titles, the Flower Path exclusives and gold leaf can't be bought. For scale, a
  steady player earns about 460 petals an hour, so the large pouch is roughly 9 hours of
  play and the whole Market (~12,000) about 26.
* **Tools come from ads or petals only:** players start with 5 hints and 5 shuffles. More
  come only from the rewarded ad on the "Out of hints" sheet or the petal price (20 a hint,
  15 a shuffle, or threes in the Market's Tools tab). Every other reward that once held a
  tool (gift calendar, rank rewards, star and weekly chests, lanterns, the chapter gift)
  gives that tool's price in petals instead (`tests/rewards.test.ts`).
* **Paid seal is opt-in:** the Supporter seal joins the seal book only for owners, so
  completing the book never requires a purchase.
* **Consumables are consumed** right after the petals are credited and saved. A
  purchase interrupted mid-way is credited on the next launch, once per purchase token.
  Remove ads and the Supporter pack restore from Play on every launch and via Settings.
* On the web demo the section shows a disabled preview; on a device where the products
  aren't set up it hides itself.

## 5. Raising revenue without more ads

1. **AdMob mediation** (biggest lever, no extra ads): AdMob → Mediation, then add AppLovin,
   Meta Audience Network, Unity Ads, Liftoff and others, and the matching Android adapters
   in `android/app/build.gradle`. Competition raises eCPM for the same impressions.
2. **Rewarded placement quality:** offers that save the player time (Rush continue,
   gifts ×2) convert best. Keep the reward generous; stingy rewards erode trust.
3. **app-ads.txt** on your site, which AdMob needs for full demand.
4. **Shipped in 1.0:** petal pouches and the Supporter pack (section 4b). **Later:** a
   seasonal "festival" pass with no gameplay advantage.

## 6. Measure, then tune

Add Firebase Analytics + Remote Config (free) before scaling, so `AD_POLICY` can be tuned
without app updates. Watch:

| KPI | Healthy direction |
|---|---|
| D1 / D7 / D30 retention | Should not drop when ad pressure rises. If it does, roll back. |
| Interstitials per DAU | Start low (~3–5) and raise only if retention holds. |
| Rewarded engagement rate (watchers ÷ DAU) | Higher is better. It means the offers feel worth it. |
| ARPDAU (ads + IAP) | Primary revenue metric. |
| Remove-ads conversion | Typically a small share of players; price-test $1.99 vs $2.99 vs $3.99. |
| Pouch / Supporter conversion | Watch alongside D30: purchases should follow engagement, not frustration. |
| Flower Path rank at D7 / D30 | Should track the simulated curve (rank ~38 at 10 h). Much slower means XP is too stingy. |
| Missions completed per DAU | ~2–3. If the hard one is rarely done, swap harder templates for steadier ones. |
| Store rating and review keywords "ads" | Leading indicator of ad fatigue. |

**A/B test ideas:** interstitial every 3 vs 4 boards; first interstitial after level 5 vs 8;
rewarded grace window of 6 vs 10 minutes; Rush continue +20 s vs +15 s.
