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
| **Journey** | Minutes | Up to three blossoms per level, a new mechanic each season, and a **lantern gift every 4 levels** (petals + a hint or shuffle). The Home card counts down to the next lantern. |
| **Near miss** | Per board | Missing a blossom puts "Retry for 3 blossoms" on the result sheet, along with what you missed. |
| **Rush** | Minutes | A 60-second score attack. Pairs add 1 s (2 s at ×3+), clearing a board adds 8 s, and boards grow as the run goes on. You chase your personal best. |
| **Daily Jjak** | Daily | The same board worldwide, a weekday theme, a streak, a 7-day strip, and a share card. |
| **Gift calendar** | Daily | Seven days of gifts ending in an album card. **Missing a day never resets it.** |
| **Daily reminder** | Daily | Opt-in only, offered inline after your first Daily (never a pop-up). It names that day's theme ("Leaf-fall Wednesday · Daily #8 is ready"), skips days you've already played, and uses inexact alarms (no special permission). |
| **Card sets** | Per board | Clearing a real yaku set inside one board scores a named bonus, a discovery layer for players who learn the deck. |
| **Album, Seals, papers** | Weeks | 48 cards, 31 seals including real yaku sets, and 12 board papers. |

We deliberately avoid dark patterns: no paid loot boxes, no energy or lives, no streak
shaming, no fake countdown offers, and no ads that block progress.

## 3. Ad placements

| Placement | Format | When | Rules |
|---|---|---|---|
| Out of hints or shuffles | Rewarded | Player taps Hint/Shuffle with none left | Opt-in. +1 on completion only. |
| Double petals | Rewarded | Result sheet | Opt-in, once per board. |
| Draw one more card | Rewarded | Result sheet | Opt-in, until the album is complete. |
| Rush "Keep going +20 s" | Rewarded | Rush time runs out | Opt-in, once per run. This is the highest-intent placement. |
| Daily gift ×2 | Rewarded | Gift sheet | Opt-in, once per day. |
| Between boards | Interstitial | After a board, before the next one starts | Never before level 5, at most 1 per 3 boards and 150 s, never within **6 minutes of a rewarded ad**, always preceded by a **"Short break" notice**, never mid-puzzle. |
| Home and Album | Adaptive banner | On menus only | Never over the board. |
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
* The only nudges: a Settings row, and a small text link on the result sheet **at most once
  a day, and only after 3+ interstitials**. No pop-ups.
* Implemented with `@capgo/native-purchases` (Capacitor 8, Google Play Billing). Purchases
  are auto-acknowledged.

## 5. Raising revenue without more ads

1. **AdMob mediation** (biggest lever, no extra ads): AdMob → Mediation, then add AppLovin,
   Meta Audience Network, Unity Ads, Liftoff and others, and the matching Android adapters
   in `android/app/build.gradle`. Competition raises eCPM for the same impressions.
2. **Rewarded placement quality:** offers that save the player time (Rush continue,
   gifts ×2) convert best. Keep the reward generous; stingy rewards erode trust.
3. **app-ads.txt** on your site, which AdMob needs for full demand.
4. **Later:** cosmetic IAP (card backs, board papers) and a seasonal "festival" pass with
   no gameplay advantage.

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
| Store rating and review keywords "ads" | Leading indicator of ad fatigue. |

**A/B test ideas:** interstitial every 3 vs 4 boards; first interstitial after level 5 vs 8;
rewarded grace window of 6 vs 10 minutes; Rush continue +20 s vs +15 s.
