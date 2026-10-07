# Jjak — Market & Player Research (October 2026)

Purpose: decide *what* puzzle game to build for a global, 13–25 audience on Google Play,
grounded in current data rather than vibes. Every claim below links to its source; the
**Confidence** column says how much weight it deserves.

---

## 1. Key findings

| # | Finding | Evidence | Confidence |
|---|---------|----------|------------|
| 1 | Puzzle is the single biggest download genre on mobile and is still growing. | Sensor Tower *State of Gaming 2026*: puzzle earned **$14.4B** in 2025 and "dominated downloads in every country" ([gamedevreports summary](https://gamedevreports.substack.com/p/sensor-tower-state-of-gaming-2026), [Sensor Tower](https://sensortower.com/blog/state-of-gaming-2026)). | High (analytics firm, primary report) |
| 2 | The fastest-growing puzzle sub-genres are **Sort (+45.8% YoY)**, **Match Pair**, **Block**, and **Match-Merge**. | Same Sensor Tower 2026 report. | High |
| 3 | **Match Pair** is one of the most ad-heavy, ad-friendly sub-genres (≈3× the average ad-network impression share). That means interstitial/rewarded ads are an accepted part of the format. | Same report: "Match Pair, Sandbox, Match-Merge 2 each delivering 3x or more the global average". | High |
| 4 | **Block Blast!** was the #1 downloaded game worldwide in 2025 (~368M downloads; ~70M DAU) — proof that a *dead-simple, endless, score-chasing* puzzle can beat big-budget games. | [maf.ad 2025 roundup](https://maf.ad/en/blog/top-mobile-games-2025/), [Statista](https://www.statista.com/statistics/1222711/most-downloaded-puzzle-games-worldwide/), [PocketGamer.biz](https://www.pocketgamer.biz/the-most-downloaded-mobile-games-of-2025) | Medium-High (aggregated from AppMagic/Sensor Tower) |
| 5 | **Daily, shareable logic puzzles** are a Gen Z habit: NYT Games doubled to 8B plays (2023); LinkedIn *Queens/Zip/Tango* built daily streak rituals; ~40% of LinkedIn game players arrive via a shared link. | [Dazed](https://www.dazeddigital.com/life-culture/article/62601/1/are-puzzles-cool-now-gen-z-nyt-connections-strands-mini-wordle), [LinkedIn Help](https://www.linkedin.com/help/linkedin/answer/a6863543), [Fortune](https://fortune.com/2024/07/22/linkedin-microsoft-puzzles-games-ai-network-attract-users), [YPulse 2026](https://www.ypulse.com/newsfeed/2026/06/03/gen-z-is-doing-more-crossword-puzzles-than-older-gens/) (50% of Gen Z say they do crosswords daily) | Medium-High |
| 6 | Gen Z is heavily into **Japanese & Korean culture**: ~54% of Gen Z (13–28) call themselves anime fans; Crunchyroll has 60% awareness among 18–24s; Hallyu content time is rising YoY. | [Campaign Live](https://www.campaignlive.com/article/brands-court-gen-z-anime-popularity-surges/1839694), [Senal News](https://senalnews.com/en/data/usa-gen-z-drives-streaming-shift-as-anime-and-international-content-go-mainstream), [Korea MCST](https://www.mcst.go.kr/english/policy/pressView.jsp?pSeq=511) | Medium (survey-based) |
| 7 | **Japanese is the #3 and Korean the #6 most-studied language for 13–17/13–22 Duolingo learners**; 86% of Japanese learners are under 30. A light "learn words while you play" layer is genuinely wanted. | [Duolingo blog — generations](https://blog.duolingo.com/dear-duolingo-how-does-language-learning-differ-between-generations), [Duolingo Asia-Pacific report](https://blog.duolingo.com/special-report-asian-and-pacific-language-trends-on-duolingo) | High (first-party data) |
| 8 | Many Gen Z players (especially women) use puzzle games for **stress relief**; a *cozy / no-pressure* aesthetic trend is strong. | [YPulse — Gen Z favorite games 2025](https://www.ypulse.com/article/2025/09/11/gen-zs-favorite-video-and-mobile-games-in-2025/) | Medium |
| 9 | **Ads are the #1 complaint** in casual/puzzle reviews (~41%): forced unskippable interstitials, fake close buttons, rewarded ads that don't pay out, "watch an ad" on every screen. r/shittymobilegameads has ~160k members. | [unstar.app 2026 review analysis](https://unstar.app/blog/gaming-app-reviews-what-mobile-gamers-hate-most-2026), [Sherwood News](https://sherwood.news/business/mobile-game-ads-industry-fake-misleading), [Global Games Forum](https://www.globalgamesforum.com/ctv/burny-games-katerina-malairan-on-ad-pressure-and-its-effect-on-user-experience) | Medium (secondary analysis) |
| 10 | Connect-pair games (Onet / Shisen-sho) are a proven but **visually stale** niche: *Onnect* has ~48M downloads, yet most competitors use generic fruit/animal tiles. | [MixRank — Onnect](https://mixrank.com/playstore/apps/com.gamebility.onet), [App Store listings](https://apps.apple.com/us/app/-/id1529787514) | Medium |
| 11 | Hanafuda (JP) and Hwatu (KR) are the **same 48-card, 12-month flower deck** shared by both cultures — with fun differences (Nov/Dec swapped in Korea; blue vs purple ribbons). Existing hanafuda apps are almost all traditional Koi-Koi/Go-Stop *gambling-style* card games, not casual puzzles. | [Wikipedia — Hanafuda](https://en.wikipedia.org/wiki/Hanafuda), [U. Waterloo playing-card museum](https://healthy.uwaterloo.ca/museum/VirtualExhibits/Playing%20Cards/decks/korea/index.html), [Nintendo](https://www.nintendo.com/en-gb/News/2021/August/Revisit-Nintendo-s-roots-with-Hanafuda-2019412.html) | High |

### Platform & policy facts that constrain the build

| Fact | Source | Confidence |
|------|--------|------------|
| From **Aug 31, 2026** new apps/updates must target **Android 16 (API 36)** (extension to Nov 1, 2026 available). | [Android Developers — target SDK](https://developer.android.com/google/play/requirements/target-sdk), [Play Console Help](https://support.google.com/googleplay/android-developer/answer/11926878) | High (official) |
| **Capacitor 8** targets SDK 36, minSdk 24, AGP 8.13, Gradle 8.14.3, Java 21. | [Capacitor 8 upgrade guide](https://capacitorjs.com/docs/updating/8-0) | High (official) |
| New **personal** Play developer accounts (created after Nov 13, 2023) must run a **closed test with ≥12 testers for 14 consecutive days** before production. | [Choicely](https://www.choicely.com/blog/google-play-12-tester-rule), [testerscommunity](https://www.testerscommunity.com/guides/how-many-testers-do-you-need-google-play) | Medium-High (consistent secondary sources; confirm in Play Console) |
| An audience that includes **under-13s triggers the Google Play Families policy** (Jjak therefore targets 13+). Ads to children must be tagged child-directed, use Families-certified SDKs (AdMob is), and must not send the Advertising ID for kids/unknown-age users. AdMob's TFCD/TFUA tags are being superseded by a "tag for age treatment". | [AdMob Help — Families](https://support.google.com/admob/answer/6223431), [AdMob Help — child-directed](https://support.google.com/admob/answer/6219315) | High (official) |
| `@capacitor-community/admob` **8.x** supports Capacitor 8 incl. UMP consent (`requestConsentInfo`, `showConsentForm`, `showPrivacyOptionsForm`). | [npm](https://www.npmjs.com/package/@capacitor-community/admob), [Capgo guide](https://capgo.app/blog/admob-gdpr-consent-capacitor/) | High |

---

## 2. What players like (synthesis)

1. **Instantly readable rules** — Block Blast, Candy Crush, Onet: you understand it in 3 seconds.
2. **Fast, juicy feedback** — combos, escalating sounds, satisfying clears.
3. **Short sessions with a "one more" hook** — 1–3 minute levels, instant retry.
4. **A daily ritual + streak + share card** — Wordle/Connections/Queens.
5. **Collection / meta progress** — something that fills up over time.
6. **Calm, beautiful presentation** — cozy aesthetic, no stress for the default mode.
7. **Fair monetization** — ads that are opt-in (rewarded) and predictable.

## 3. What players hate

* Interstitials after every level, especially in the first session.
* Unskippable 30 s ads, fake ✕ buttons, ads that crash or don't reward.
* "Watch ad" prompts on every screen; pay-to-win difficulty spikes.
* Childish art (for teens/young adults) and loud "gamer" neon.

---

## 4. Gap analysis → the opportunity

| Existing product | What's missing |
|---|---|
| Onet / Shisen-sho clones | Generic tiles, dated UI, ad spam, no culture, no daily ritual |
| Hanafuda / Hwatu apps | Gambling-style rules, intimidating for newcomers, old-school UI |
| NYT / LinkedIn dailies | One puzzle a day, then nothing; no collection; not on Play as standalone |
| Language apps (Duolingo) | Learning is the *point*, not a by-product of play |
| Block Blast | Addictive but culturally blank; no story or collection |

**Positioning:** *Jjak (짝, "pair") — a calm, beautiful pair-connecting puzzle built on the
flower-card deck that Korea and Japan share. Match by flower, chain combos, collect all 48
cards, and pick up Korean & Japanese words along the way. One shared Daily board for the
whole world.*

Why this wins:

* **Proven core** (Match Pair sub-genre, growing + ad-friendly) with a **fresh skin and a
  skill twist**: you match the *flower/month*, not identical pictures — the real hanafuda
  skill — introduced gradually.
* **Culture without cliché:** hanji paper, ink, seal stamps, seasonal palettes. Appeals to
  K-culture and anime fans without licensing anything.
* **Daily + streak + share** for virality; **album** for long-term collection; **combos** for
  moment-to-moment juice.
* **Fair ads** as a selling point in the store listing ("no ads in your first levels, never
  mid-puzzle").

## 5. Risks

| Risk | Mitigation |
|---|---|
| Hwatu is associated with gambling (Go-Stop) in Korea | No betting, no wagering vocabulary, no chips/coins visuals; IARC answer "no simulated gambling" is accurate because there is no wagering mechanic. |
| Under-13 users → Families policy | Target audience set to 13+; no child-oriented marketing; ads capped at Parental Guidance. |
| Cultural accuracy | Both KR and JP names shown; document KR/JP differences as fun facts; native-speaker review before launch. |
| Matching-by-month is harder than identical tiles | Teach gradually: early levels use identical cards only, variants introduced at level 6+, month numeral printed on every card. |

## 6. How to verify / refresh this research

* Sensor Tower *State of Mobile/Gaming* (Jan/Feb yearly) — check sub-genre growth.
* AppMagic / AppBrain "trending puzzle" (monthly) — [AppBrain trending](https://www.appbrain.com/apps/trending/puzzle).
* Reddit: search `r/AndroidGaming "puzzle" ads`, `r/puzzlevideogames daily`, `r/Korean hwatu`, `r/LearnJapanese hanafuda`.
* Google Trends: compare "hanafuda", "hwatu", "onet", "block blast", "queens game".
* Play Console → Policy status & the target-API page before each release.
