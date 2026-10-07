# Shipping Jjak to Google Play: step-by-step

Everything the code can do is done. The steps below need **your** accounts, keys, or
decisions. Expect about 2–3 hours of hands-on work, plus the 14-day closed test if your
developer account is a new personal one.

---

## 0. Prerequisites

- [ ] Google Play Console developer account (one-time US$25). New **personal** accounts
      (created after 13 Nov 2023) must run a **closed test with ≥ 12 testers for 14
      consecutive days** before Production unlocks. Organization accounts are exempt.
- [ ] AdMob account (free), linked to the Play Console.
- [ ] Node 22+, JDK 21, Android Studio (or just the GitHub Actions build in this repo).

## 1. Decide the package name (permanent)

`capacitor.config.ts` → `appId: 'com.jjak.puzzle'`. You can't change it after the first
upload. If you want your own reverse domain (e.g. `com.yourname.jjak`), change it now:

```bash
# 1) edit appId in capacitor.config.ts and LINKS.store in src/config.ts
# 2) regenerate the native project
rm -rf android && npx cap add android && npm run assets
# 3) re-apply the edits listed in section 9 below (they're all in git history — `git diff HEAD~ -- android`)
```

## 2. AdMob (replace the test IDs)

1. In AdMob, go to **Apps → Add app → Android → "Not listed yet"** (link it to the store
   listing after publishing).
2. Create three ad units: **Banner**, **Interstitial**, **Rewarded**.
3. Paste the unit IDs into `src/config.ts` → `AD_UNITS`. `ADS_TEST_MODE` turns off
   automatically.
4. Paste the **App ID** (`ca-app-pub-…~…`) into
   `android/app/src/main/res/values/strings.xml` → `admob_app_id`.
5. AdMob → **Privacy & messaging**: create a **GDPR** message and a **US state
   regulations** message. The app already calls UMP, so the forms appear automatically.
6. **app-ads.txt**: AdMob → Apps → *Jjak* → app-ads.txt. Host the line it gives you at
   `https://<your developer website>/app-ads.txt`, and put that website in the Play
   listing's contact details.
7. While testing on your phone, add it as a **test device** (AdMob → Settings → Test
   devices). Never tap your own live ads.

> ⚠️ Until the IDs are replaced the app shows Google *test* ads and earns nothing. That's
> intended for development.

## 2b. In-app products: Remove ads, petal pouches, Supporter pack

All five are **one-time products** (Play Console → **Monetize → Products → In-app
products → Create product**). The ids must match `IAP` in `src/config.ts`. The app
always shows Play's own localized `priceString`; the prices below are suggestions (set
the US price and let Play's price templates convert it).

| Product ID | Name | Type in the app | Suggested price | What it gives |
|---|---|---|---|---|
| `jjak_remove_ads` | Remove ads | Non-consumable | US$2.99 | No interstitials or banners. Rewarded ads stay. |
| `jjak_petals_small` | Small pouch | **Consumable** | US$0.99 | 600 petals |
| `jjak_petals_medium` | Pouch of petals | **Consumable** | US$2.49 | 1,600 petals |
| `jjak_petals_large` | Large pouch | **Consumable** | US$4.99 | 4,000 petals |
| `jjak_supporter` | Supporter pack | Non-consumable | US$4.99 | Remove ads + 1,500 petals once + the Clouds card back (`back:clouds`, only here) + a Supporter seal |

1. Create each product with the id above, a plain description of exactly what it
   gives (copy the "What it gives" column), and activate it.
2. Play has no separate "consumable" type: the app **consumes** a pouch itself, after
   the petals are credited and saved (`NativePurchases.consumePurchase`), so it can be
   bought again. If the app closes between payment and consumption, the next launch
   finds the unconsumed purchase, credits it (each purchase token is remembered, so
   never twice) and consumes it. Pending payments (e.g. cash) are credited on a later
   launch once Play marks them purchased.
3. Remove ads and the Supporter pack are **restored** on every launch and by
   *Settings → Restore purchase* (both remove ads; the Supporter gifts are granted once).
   Refunded non-consumables drop out of Play's list and ads come back on next launch.
4. Products only appear in builds installed from a Play track (internal testing is
   fine), so add your account as a **license tester** (Settings → License testing) to
   buy without being charged. Test a pouch twice in a row to confirm consumption.
5. If the pouch / Supporter products aren't set up, their section hides itself; Remove
   ads keeps working on its own.
6. Data safety: add **Purchase history** (collected, not shared, purpose: app
   functionality). It's read from Google Play on the device to restore purchases; the
   app keeps only pouch purchase tokens locally to avoid double credit. No payment
   details ever reach the app.

**Honesty rules for these products** (Play's policies and our own tone): every product
says exactly what it contains, there are no timers, no "% off" or fake "best value"
labels, no random rewards for money, and petals only buy cosmetics, garden items and
tools: never levels or progress gates.

## 3. Signing

Create an **upload key** once and back it up in two places. If you lose it, you have to
ask Google to reset it.

```bash
keytool -genkeypair -v -keystore jjak-upload.jks -alias jjak -keyalg RSA -keysize 2048 -validity 10000
```

**Local builds:** create `android/keystore.properties` (it's git-ignored):

```properties
storeFile=/absolute/path/to/jjak-upload.jks
storePassword=••••
keyAlias=jjak
keyPassword=••••
```

**CI builds:** add these repository secrets (GitHub → Settings → Secrets → Actions):

| Secret | Value |
|---|---|
| `JJAK_KEYSTORE_BASE64` | `base64 -w0 jjak-upload.jks` |
| `JJAK_KEYSTORE_PASSWORD` | store password |
| `JJAK_KEY_ALIAS` | `jjak` |
| `JJAK_KEY_PASSWORD` | key password |

In Play Console, opt into **Play App Signing** (the default). Google then holds the app
signing key and you sign uploads with the upload key.

## 4. Build

```bash
npm ci
npm test                 # engine tests must be green
npm run android:sync     # tsc + vite build + cap sync
cd android && ./gradlew bundleRelease -PversionCode=2
# → android/app/build/outputs/bundle/release/app-release.aab
```

Alternatively, push to GitHub. The **Android build** workflow tests, builds, and uploads
`jjak-debug-apk` and `jjak-release-aab` artifacts. `versionCode` is set to the run
number, so it always increases. Bump `versionName` in `android/app/build.gradle` for each
public release.

Install the debug APK on a real phone (`adb install app-debug.apk`) and run the QA list
in section 8.

## 5. Host the privacy policy

Ads require a public privacy policy. `docs/privacy-policy.html` is ready. To publish it
with GitHub Pages:

1. Fill in the contact email in `docs/privacy-policy.html`.
2. Go to GitHub → *Settings → Pages* → Deploy from branch `main`, folder `/docs`.
3. The URL becomes `https://<user>.github.io/Jjak/privacy-policy.html`. Put it in
   `src/config.ts` → `LINKS.privacy` and in Play Console.

## 6. Play Console setup

### App content (Policy → App content)

| Section | Answer |
|---|---|
| Privacy policy | URL from section 5 |
| Ads | **Yes, contains ads** |
| App access | All functionality available without special access |
| Target audience | **13–15, 16–17, 18+** (13+ only). The app isn't in the Families programme, so it has no age gate. Ads are capped at Parental Guidance content in `src/services/ads.ts`. |
| Unintentional appeal to children? | **No**. The art, copy and store listing are aimed at teens and young adults: no cartoon mascots, no childish language. Keep the listing that way, or Google may ask you to join Families. |
| Content rating (IARC) | Category **Game**. No violence, sexuality, language, or drugs. **No gambling or simulated gambling**: the cards come from a deck that's also used for gambling games, but Jjak has no wagering, chips, or betting. Users can't interact or share user-generated content (the share button sends plain text through the OS). Expected result: **Everyone / PEGI 3 / USK 0**. |
| Data safety | See below. |
| Government app / financial / health | No |

### Data safety (what the AdMob SDK collects)

Check Google's current "Google Mobile Ads SDK data disclosure" page before you submit,
because it's the authoritative source. At the time of writing, typical answers are:

| Data type | Collected | Shared | Purpose | Notes |
|---|---|---|---|---|
| Device or other IDs (advertising ID) | Yes | Yes | Advertising, analytics, fraud prevention | Not sent for child-directed requests. |
| Approximate location (from IP) | Yes | Yes | Advertising, fraud prevention | |
| App interactions | Yes | Yes | Advertising, analytics | |
| Crash logs / diagnostics | Yes | Yes | Analytics, fraud prevention | |
| Purchase history (Google Play Billing) | Yes | No | App functionality | Read from Play on the device to restore Remove ads / Supporter pack and credit petal pouches once. Not sent anywhere by the app. |

* Data is encrypted in transit: **Yes**.
* Users can request deletion: game data is local, so uninstalling or using *Settings →
  Reset progress* removes it.

### Store listing

| Field | Text |
|---|---|
| App name (≤ 30) | `Jjak: Flower Pair Puzzle` |
| Short description (≤ 80) | `Pair flower cards from the deck Korea and Japan share. Calm, clever puzzles.` |
| Category | Game → Puzzle |
| Tags | Puzzle, Matching, Relaxing, Brain games, Offline |
| Contact | your email; the website that hosts app-ads.txt |

**Full description:**

```
Jjak (짝) means "pair" in Korean — and that's the whole idea.

Find two cards of the same flower and connect them with a line of up to three strokes.
Clear the board, chain combos (짝짝짝!), and travel through spring, summer, autumn and
winter.

The cards come from the 48-card flower deck that Korea (Hwatu 화투) and Japan
(Hanafuda 花札) share — redrawn from scratch in a calm, paper-and-ink style.

◆ JOURNEY — endless, always-solvable boards across four seasons. Stones in summer,
  falling leaves in autumn, first snow in winter
◆ DAILY JJAK — one board for the whole world each day, with a new theme every weekday.
  Keep your streak, share your time
◆ RUSH — a 60-second score attack. Chain combos into Full Bloom for double points
◆ ZEN — endless boards with no clock at all, with gentle generative music that changes with the seasons
◆ CARD SETS — clear Godori, the red ribbons or the Five Brights on one board for a bonus
◆ ALBUM — collect all 48 cards and learn each flower's name in Korean and Japanese,
  with little stories behind them (why is the October deer looking away?)
◆ SEALS — 28 achievements, including the classic card sets players in Korea and Japan
  know by heart: Five Brights, Godori, Boar-Deer-Butterfly
◆ BOARD PAPERS — complete a flower to unlock its paper for your board
◆ Paper and Ink themes, gentle sound design, satisfying haptics
◆ Plays offline. Short sessions. No account needed.

Fair ads, promised: never in the middle of a puzzle, never in your first levels, and
rewarded ads are always your choice.
```

**Graphics** (in `store/`):

* App icon 512×512: `store/icon-512.png`
* Feature graphic 1024×500: `store/feature-graphic.png`
* Phone screenshots, 2–8 at 1080×1920: `store/screenshots/` (regenerate with
  `SCALE=2.62 VIEW=412x732 npm run screens -- http://localhost:5173/ store/screenshots`)

## 7. Release tracks

1. **Internal testing**: upload the AAB and add yourself. Install from the Play link and
   check that test ads and the consent form work.
2. **Closed testing** (required for new personal accounts): ≥ 12 testers opted in for 14
   days straight. Friends, classmates, or a Discord or Reddit community work. Keep them
   playing, because Google asks about tester engagement when you apply for production.
3. **Production**: apply for access, answer the questionnaire, then roll out at 20% →
   100%.

## 8. Pre-launch QA checklist

- [ ] First launch: welcome (three rules) → Level 1 tutorial shows a hint and coach text
- [ ] Level 6 shows the "Match the flower" tip with its tap-the-pair practice (wrong pick explains, right pick turns the button into "Start Level 6"); Level 27 shows Falling leaves; Level 38 shows First snow
- [ ] Seals: earning one shows it on the result sheet and adds petals
- [ ] Settings → Board paper: locked papers can't be picked; a completed flower unlocks its paper
- [ ] EU test (UMP debug geography EEA): consent form appears, and Settings shows "Ad privacy choices"
- [ ] Levels 1–5 never show an interstitial; after that, at most one every 3 boards / 150 s
- [ ] Rewarded: closing early grants nothing, and finishing grants the item
- [ ] After a rewarded ad, no interstitial for 6 minutes; every interstitial is preceded by the "Short break" card
- [ ] Remove ads: buy as a license tester → banners and interstitials stop, rewarded stays; reinstall → "Restore purchase" brings it back
- [ ] Petal pouch: buy → petals credited once; buy the same pouch again right away (proves it was consumed); kill the app mid-purchase → next launch credits it once
- [ ] Supporter pack: buy → ads off, +1,500 petals, Clouds back owned, Supporter seal; reinstall → restore brings ads-off and the back, petals are not granted twice
- [ ] Flower Path: Home strip shows rank, title, XP bar and missions; a result sheet shows +XP and the bar fills; a rank-up shows the rank-up moment; claims stamp and pay out
- [ ] Missions: 3 a day, progress during play with a small toast; one reroll each; the weekly chest opens at 15
- [ ] Warm tea: miss a day with tea → the Daily keeps the streak and says "Warm tea kept your streak" once
- [ ] Rush: timer, +time floaters, next board on clear, "Keep going +20s" once per run
- [ ] Daily gift opens once a day; claiming advances the calendar; skipping a day doesn't reset it
- [ ] Daily reminder: offered after the first Daily; Android 13+ asks for notification permission; a notification arrives at the chosen hour with the day's theme and doesn't arrive for days already played
- [ ] Music: starts after the first tap, changes with the season, fades during ads, stops in the background
- [ ] Banner on Home and Album only; the layout isn't covered (bottom padding adjusts)
- [ ] Android back button: closes sheets → returns home → minimizes on home
- [ ] Rotate / split-screen / large-screen: layout still fits (portrait locked on phones)
- [ ] Airplane mode: game fully playable, ads simply absent
- [ ] Kill and relaunch mid-level: progress (levels, album, petals) persists
- [ ] Dark mode: Ink theme, with status bar icons readable
- [ ] Daily: completing once counts toward the streak; replays are marked "practice"
- [ ] Play Console pre-launch report: no crashes, accessibility warnings reviewed

## 9. Native edits already applied (for reference if you regenerate `android/`)

* `AndroidManifest.xml`: AdMob `APPLICATION_ID` meta-data, portrait orientation, and
  backup rules for progress.
* `res/values/strings.xml`: `admob_app_id`.
* `app/build.gradle`: release signing from `keystore.properties` or env, and
  `versionCode` from `-PversionCode`.
* `res/xml/backup_rules.xml`, `data_extraction_rules.xml`.
* Icons and splash generated from `resources/` with `npm run assets`.
