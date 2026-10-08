# Shipping Jjak to Google Play: step-by-step

Everything the code can do is done. The steps below need **your** accounts, keys, or
decisions. Expect about 2–3 hours of hands-on work, plus the 14-day closed test if your
developer account is a new personal one.

---

## 0a. Owner checklist (do these in order)

Each step links to the section with the details. Play Console renames its menus now and
then: if a label below doesn't match, type the **bold** name into the search box at the top
of Play Console.

1. **Put `main` on GitHub** (§5). GitHub only has two `claude/…` branches today and the
   default branch is `claude/quirky-lamport-37q8ip`. Push `main`, then GitHub → repo →
   *Settings → General → Default branch* → switch to `main` → *Update*.
2. **Create the upload key** on your PC and back it up (§3): `keytool` command, two backup
   copies, password in your password manager.
3. **Add the four signing secrets** (§3): GitHub → repo → *Settings → Secrets and variables
   → Actions → New repository secret*. Without them CI builds an unsigned AAB that Play
   rejects.
4. **AdMob app + three ad units** (§2): admob.google.com → *Apps → Add app*; then
   *Apps → Jjak → Ad units → Add ad unit* ×3 (Banner, Interstitial, Rewarded). Give the four
   IDs to Claude to paste into the two files listed in §2 (or paste them yourself), commit,
   push.
5. **Fill in and publish the privacy policy** (§5): fill the three `[…]` placeholders in
   `docs/privacy-policy.html`, push, then GitHub → repo → *Settings → Pages* → *Deploy from a
   branch* → `main` / `/docs` → *Save*. Check
   `https://aaravsaianugula.github.io/Jjak/privacy-policy.html` opens.
6. **AdMob consent messages** (§2, they ask for the policy URL): AdMob → *Privacy &
   messaging* → *European regulations* → create and publish; then *US state regulations* →
   create and publish.
7. **Create the app in Play Console**: play.google.com/console → *Create app* → name
   `Jjak: Flower Pair Puzzle`, default language English (US), **Game**, **Free**, tick the
   declarations → *Create app*. The package name `com.jjak.puzzle` becomes permanent with
   the first upload in step 10 (§1).
8. **Payments profile** (needed to sell anything): Play Console → *Settings* (gear, left
   menu at account level) → **Payments profile** → create or link one.
9. **Build the release AAB** (§7): GitHub → *Actions → Android build → Run workflow* →
   branch `main` → *Run workflow*; when it's green, open the run → *Artifacts* →
   `jjak-release-aab` → unzip → `app-release.aab`.
10. **Internal testing release** (§7): Play Console → app → **Test and release → Testing →
    Internal testing** → *Testers* tab (email list) → *Releases* tab → *Create new release*
    → accept **Play App Signing** (Google-generated key) → upload `app-release.aab` →
    *Next* → *Save and publish*.
11. **In-app products** (§2b): Play Console → app → **Monetize with Play → Products →
    One-time products** → *Create one-time product* ×6, ids from §2b (including
    `jjak_remove_ads_festival`, the festival price of Remove ads: suggested US$2.49, local
    prices from Play's templates), then *Activate*. (Play
    only offers this once a build with billing is uploaded: that's step 10.)
12. **License testers** (§2b): Play Console → *Settings* (account level) → **License
    testing** → add your Gmail → response *RESPOND_NORMALLY* → *Save changes*.
13. **Test on your phone** (§7, §8): open the internal-testing join link, install from Play,
    run the 📱 items in §8, and read the **Pre-launch report**.
14. **App content, store listing, closed test, production** (§6, §7): App content
    declarations (privacy policy URL, ads, advertising ID, data safety, content rating,
    target audience), the store listing, then the 14-day closed test and production.

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

**Where every AdMob value lives.** Only two files hold IDs; everything else reads them.
The `ca-app-pub-3940256099942544` publisher is Google's public sample account: those IDs
always fill with test ads and never earn.

| File:line | What | Today (Google test ID) | Replace with |
|---|---|---|---|
| `android/app/src/main/res/values/strings.xml:9` | `admob_app_id` (the **App ID**, has a `~`) | `ca-app-pub-3940256099942544~3347511713` | your App ID `ca-app-pub-<your pub id>~<10 digits>` |
| `src/config.ts:12` | `AD_UNITS.banner` | `ca-app-pub-3940256099942544/9214589741` | your Banner unit `ca-app-pub-<pub id>/<10 digits>` |
| `src/config.ts:13` | `AD_UNITS.interstitial` | `ca-app-pub-3940256099942544/1033173712` | your Interstitial unit |
| `src/config.ts:14` | `AD_UNITS.rewarded` | `ca-app-pub-3940256099942544/5224354917` | your Rewarded unit |

Read-only, no edit needed:

* `src/config.ts:18`: `ADS_TEST_MODE` is `true` while the **banner** ID starts with the
  Google sample publisher. It switches the SDK's test flags (`initializeForTesting`,
  `isTesting`) in `src/services/ads.ts`. Replace **all three** unit IDs in the same commit:
  if only the banner changes, the other two would request Google's test units with
  testing turned off.
* `android/app/src/main/AndroidManifest.xml:27`: the
  `com.google.android.gms.ads.APPLICATION_ID` meta-data points at `@string/admob_app_id`.
* `capacitor.config.ts`: no AdMob settings (the plugin needs none).
* Consent (UMP) is code-complete: `src/services/ads.ts:59–64` asks for consent info, shows
  the form when it's required, and only initialises ads when `canRequestAds` is true;
  `src/services/ads.ts:217–220` plus `src/ui/screens/settings.ts:62` give the
  *Ad privacy choices* row when UMP says it's required. What the forms *say* is set up in
  the AdMob console (step 5), not in code.

Steps:

1. admob.google.com → **Apps → Add app** → platform **Android** → "Is the app listed on a
   supported app store?" **No** → app name `Jjak` → *Add app*. (After the Play listing is
   live: *Apps → Jjak → App settings → App store details → Add* to link it.)
2. Copy the **App ID**: *Apps → Jjak → App settings* → App ID (`ca-app-pub-…~…`).
3. *Apps → Jjak → Ad units → Add ad unit*, three times:
   **Banner** (name `jjak-banner`), **Interstitial** (`jjak-interstitial`), **Rewarded**
   (`jjak-rewarded`; reward amount `1`, item `reward`: the app only checks that a reward
   was earned). Copy each ad unit ID (`ca-app-pub-…/…`).
4. Put the four IDs into the table's files above (or give them to Claude), commit and push.
5. AdMob → **Privacy & messaging** → **European regulations** → *Create message* → select
   *Jjak*, add your privacy policy URL (§5), languages → *Publish*. Then **US state
   regulations** → *Create message* → *Jjak* → *Publish*. The app picks them up on the next
   launch, without a new build.
6. **app-ads.txt**: AdMob → *Apps → View all apps → app-ads.txt* gives you one line. It
   must sit at the **root** of the developer website you list in Play
   (`https://<domain>/app-ads.txt`). A project page like `…github.io/Jjak/` is not a root,
   so: create a new **public** GitHub repo named exactly `aaravsaianugula.github.io` →
   *Add file → Create new file* → name `app-ads.txt`, paste the line → *Commit*; then that
   repo's *Settings → Pages* → *Deploy from a branch* → `main` / `/ (root)` → *Save*. Use
   `https://aaravsaianugula.github.io` as the **Website** in Play's store listing contact
   details. AdMob checks it within about 24 hours of the listing going live.
7. While testing on your phone, register it as a **test device**: AdMob → *Settings → Test
   devices → Add test device* → Android, with the phone's advertising ID (phone *Settings →
   Google → All services → Ads*). Never tap your own live ads.
8. **Keep the ads calm and in keeping with the game.** The app already caps every request at
   **G** (general audiences, `src/services/ads.ts` `AD_PROFILE`), shows interstitials only
   between boards, and never more than one per 3 boards / 150 s. The rest is console-only:
   - *Apps → Jjak → Blocking controls → Content* → **Maximum ad content rating: G** (matches
     the app; the stricter of the two wins).
   - *Blocking controls → Sensitive categories* → block all of them (dating, gambling and
     lotteries, alcohol, politics, religion, get-rich-quick, cosmetic procedures and the rest).
   - *Blocking controls → General categories* → block any that feel loud for a calm puzzle
     (for example *Shooter/action games*, *Social casino*), keeping *Games → Puzzle & word*,
     *Arts & entertainment*, *Books & literature* and *Hobbies & leisure*, which fit Jjak.
   - *Ad units → jjak-interstitial → Advanced settings → Ad type* → **Display** only (untick
     Video), so a break is a still image, never a loud video. Rewarded stays video: the
     player chooses it.
   - *Blocking controls → Ad review center* → after launch, review the first week's ads and
     block any that look off; this applies within hours, no new build.
   - Link the Play listing (step 1) once it's live: AdMob then knows Jjak is a puzzle game,
     and contextual demand leans toward related apps and games.
   The plugin has no per-request content URL or keywords on Android, so these console
   settings are where relevance is steered.

> ⚠️ Until the IDs are replaced the app shows Google *test* ads and earns nothing. That's
> intended for development.

## 2b. In-app products: Remove ads, petal pouches, Supporter pack

All six are **one-time products** (Play Console → app → **Monetize with Play → Products →
One-time products**; older consoles call it *In-app products*). The ids must match `IAP` in
`src/config.ts`, and the billing service (`src/services/store.ts`) asks Play for all
of them as one-time (`PURCHASE_TYPE.INAPP`) products. The app always shows Play's own
localized `priceString`; the prices below are the fallbacks in `src/config.ts` and are
suggestions (set the US price and let Play convert it).

**Before you can create them:** Play only offers products once a build that contains the
billing library is uploaded to any track (the internal-testing release in §7 does it), and
your account needs a **payments profile** (Play Console → *Settings* at account level →
*Payments profile*).

| Product ID | Name | Type in the app | Suggested price | What it gives |
|---|---|---|---|---|
| `jjak_remove_ads` | Remove ads | Non-consumable | US$2.99 | No interstitials or banners. Rewarded ads stay. |
| `jjak_remove_ads_festival` | Remove ads (festival price) | Non-consumable | US$2.49 | The same as Remove ads, offered only during a festival week (MONETIZATION.md §4a). Keep it **below** Remove ads in every country, or the app shows no discount. |
| `jjak_petals_small` | Small pouch | **Consumable** | US$0.99 | 600 petals |
| `jjak_petals_medium` | Pouch of petals | **Consumable** | US$2.49 | 1,600 petals |
| `jjak_petals_large` | Large pouch | **Consumable** | US$4.99 | 4,000 petals |
| `jjak_supporter` | Supporter pack | Non-consumable | US$4.99 | Remove ads + 1,500 petals once + the Clouds card back (`back:clouds`, only here) + a Supporter seal |

1. For each row: *Create one-time product* → **Product ID** (exactly as above; it can
   never be changed or reused) → **Name** (the Name column) → **Description** (copy the
   "What it gives" column) → *Save*. Then under **Purchase options** keep the single *Buy*
   option, leave it marked **Backwards compatible** (the app's billing library reads that
   one), *Set price* → US price from the table → *Update prices* → *Save* → **Activate**.
2. Play has no separate "consumable" type: the app **consumes** a pouch itself, after
   the petals are credited and saved (`NativePurchases.consumePurchase`), so it can be
   bought again. If the app closes between payment and consumption, the next launch
   finds the unconsumed purchase, credits it (each purchase token is remembered, so
   never twice) and consumes it. Pending payments (e.g. cash) are credited on a later
   launch once Play marks them purchased.
3. Remove ads (either price) and the Supporter pack are **restored** on every launch and by
   *Settings → Restore purchase* (all remove ads; the Supporter gifts are granted once).
   Refunded non-consumables drop out of Play's list and ads come back on next launch.
4. Products only appear in builds installed from a Play track (internal testing is
   fine). **License testers** buy without being charged: Play Console → *Settings*
   (account level, not inside the app) → **License testing** → add the Gmail address(es)
   signed in on the test phone (they must also be on the internal-testing email list, §7)
   → *License response*: `RESPOND_NORMALLY` → *Save changes*. At checkout a tester sees
   test cards: *Test card, always approves* (normal purchase), *Test card, always
   declines*, and *Slow test card, approves after a few minutes* (exercises the
   pending-payment path). Test a pouch twice in a row to confirm consumption.
5. If the pouch / Supporter products aren't set up, their section hides itself; Remove
   ads keeps working on its own. If `jjak_remove_ads_festival` isn't set up, festival weeks
   still show the festival but sell Remove ads at the regular price, with no discount claim.
6. Data safety: add **Purchase history** (collected, not shared, purpose: app
   functionality). It's read from Google Play on the device to restore purchases; the
   app keeps only pouch purchase tokens locally to avoid double credit. No payment
   details ever reach the app.

**Honesty rules for these products** (Play's policies and our own tone): every product
says exactly what it contains, there are no timers, no "% off" or fake "best value"
labels (the festival price only says "this week (usually …)", using Play's two real prices), no random rewards for money, and petals only buy cosmetics, garden items and
tools: never levels or progress gates.

## 3. Signing

Create an **upload key** once and back it up in two places. If you lose it, you have to
ask Google to reset it (Play Console → *App integrity* → *Request upload key reset*,
which takes a few days).

**1. Create it** (Windows PowerShell). `keytool` ships with any JDK; if PowerShell can't
find it, use Android Studio's copy at
`& "C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe"` instead of `keytool`.

```powershell
New-Item -ItemType Directory -Force "$env:USERPROFILE\Keys" | Out-Null
keytool -genkeypair -v -storetype PKCS12 -keystore "$env:USERPROFILE\Keys\jjak-upload.jks" -alias jjak -keyalg RSA -keysize 4096 -validity 10950
```

It asks for a password (twice) and your name / organisation / country (any honest values;
they're inside the certificate, not shown to players). RSA 4096, alias `jjak`, valid 10,950
days (30 years). In a PKCS12 keystore the key password **is** the store password, so
there is one password.

**2. Keep it safe, never in the repo.** The file lives at
`C:\Users\aarav\Keys\jjak-upload.jks`, outside every project folder (the repo also
git-ignores `*.jks`, `*.keystore` and `android/keystore.properties`). Make two backups
(e.g. a USB stick and an encrypted cloud copy), and store the password in your password
manager, not in a text file next to the key.

**3. CI secrets.** The workflow (`.github/workflows/android.yml`, step *Prepare release
signing*) decodes `JJAK_KEYSTORE_BASE64` to a file and points `JJAK_KEYSTORE_PATH` at it;
the *Gradle build* step passes the other three, and `android/app/build.gradle:8–34` reads
them. Add them at GitHub → repo → *Settings → Secrets and variables → Actions → New
repository secret*:

| Secret (exact name) | Value |
|---|---|
| `JJAK_KEYSTORE_BASE64` | the keystore as one line of base64 (command below) |
| `JJAK_KEYSTORE_PASSWORD` | the keystore password |
| `JJAK_KEY_ALIAS` | `jjak` |
| `JJAK_KEY_PASSWORD` | the same password again (PKCS12) |

Base64 on Windows PowerShell, straight to the clipboard, then paste it as the secret value:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("$env:USERPROFILE\Keys\jjak-upload.jks")) | Set-Clipboard
```

Or set it without the clipboard, with the GitHub CLI (`gh` is installed and logged in):

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("$env:USERPROFILE\Keys\jjak-upload.jks")) | gh secret set JJAK_KEYSTORE_BASE64 --repo aaravsaianugula/Jjak
gh secret set JJAK_KEYSTORE_PASSWORD --repo aaravsaianugula/Jjak   # prompts for the value
gh secret set JJAK_KEY_ALIAS --repo aaravsaianugula/Jjak --body jjak
gh secret set JJAK_KEY_PASSWORD --repo aaravsaianugula/Jjak        # prompts for the value
```

If `JJAK_KEYSTORE_BASE64` is missing, CI skips the signing step and the release AAB comes
out **unsigned**; Play refuses unsigned uploads.

**Local builds (optional):** create `android/keystore.properties` (git-ignored). Use
forward slashes in the path: a backslash is an escape character in `.properties` files.

```properties
storeFile=C:/Users/aarav/Keys/jjak-upload.jks
storePassword=••••
keyAlias=jjak
keyPassword=••••
```

**4. Play App Signing (first upload).** New apps are enrolled automatically: on your first
internal-testing release (§7), Play Console shows a *Play App Signing* box; keep **Use a
Google-generated key** and continue. Google then holds the app signing key that signs
what players install, and your `jjak-upload.jks` becomes the registered **upload key**
(every later upload must be signed with it). Afterwards both certificates are listed
under **Test and release → Setup → App signing** (some consoles: *App integrity*).

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

Ads require a public privacy policy. `docs/privacy-policy.html` is written; it only needs
your details. The app already links to
**`https://aaravsaianugula.github.io/Jjak/privacy-policy.html`** (`src/config.ts:92`,
`LINKS.privacy`, opened from *Settings → Privacy policy*, `src/ui/screens/settings.ts:63`),
so publish it at exactly that address with GitHub Pages on the public repo
`aaravsaianugula/Jjak`:

1. In `docs/privacy-policy.html` line 23, replace `[FILL IN DATE]`, `[YOUR NAME OR
   STUDIO]` and both `[YOUR EMAIL]` (or give Claude the three values).
2. Make sure `main` is on GitHub and is the default branch: today the remote only has
   `claude/quirky-lamport-37q8ip` (the default) and `claude/pensive-goodall-f3ocnt`. Push
   `main`, then GitHub → repo → *Settings → General → Default branch* → ⇄ → `main` →
   *Update*.
3. GitHub → repo → *Settings → Pages* → *Build and deployment* → Source **Deploy from a
   branch** → Branch **`main`**, folder **`/docs`** → *Save*. After a minute or two the
   page shows *Your site is live at `https://aaravsaianugula.github.io/Jjak/`*.
4. Open `https://aaravsaianugula.github.io/Jjak/privacy-policy.html` in a private window
   to check it's public.
5. Paste the same URL in Play Console → app → **Policy and programs → App content →
   Privacy policy** → *Save*, and in the AdMob consent messages (§2 step 5).

> Pages serves **every file in `docs/`** as a web page, not just the policy (the design,
> monetization and session notes too). The repo is public, so they're readable on GitHub
> anyway; if you'd still rather the site carry only the policy, ask Claude to serve it from
> a separate `gh-pages` branch instead. The URL stays the same.

## 6. Play Console setup

### App content (Policy and programs → App content)

| Section | Answer |
|---|---|
| Privacy policy | `https://aaravsaianugula.github.io/Jjak/privacy-policy.html` (section 5) |
| Ads | **Yes, contains ads** |
| Advertising ID | **Yes**, the app uses it (the Google Mobile Ads SDK adds the `AD_ID` permission to the build). Purposes: **Advertising or marketing**, **Analytics**, **Fraud prevention, security, and compliance**. |
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

**Full description** (about 2,300 characters; the limit is 4,000):

```
Jjak (짝) means "pair" in Korean, and that's the whole idea.

Find two cards of the same flower and connect them with a line of up to three strokes.
Clear the board, chain combos (짝짝짝!), and travel the Flower Road through Korea and
Japan, one season at a time.

The cards come from the 48-card flower deck that Korea (Hwatu 화투) and Japan
(Hanafuda 花札) share, redrawn from scratch in a calm paper-and-ink style.

◆ THE FLOWER ROAD: 600 levels across 50 real places, from Gyeongju's cherry blossoms
  to Kyoto's maples and Shirakawa-go's snow. Every place ends with a festival board
  and a passport stamp for your collection
◆ NEW IDEAS AS YOU TRAVEL: stones, falling leaves, first snow, lucky cards, silk
  knots, wind that slides the cards, wooden gates and bamboo fences. Each one is
  shown to you in a short animation, then you try it. Every board can be solved
◆ BOARDS THAT FIT YOU: the game notices how you play and keeps each board
  challenging but fair, with a breather after a tough one. It all stays on your phone
◆ FLOWER PATH: a free 100-rank journey with a reward on every rank and exclusive
  decks, brushes and garden pieces you can only earn
◆ DAILY JJAK: one board for the whole world each day, three daily missions and a
  weekly chest. Keep your streak (a cup of Warm tea saves it on a busy day)
◆ THE MARKET: spend the petals you earn on deck styles (ink wash, moonlit,
  celadon, woodblock), card backs, path brushes, match effects, board papers and music
◆ YOUR GARDEN: build a quiet courtyard piece by piece (koi pond, stone lantern,
  pavilion, a sleeping cat) in all four seasons, by day and by night. A visitor
  drops by every day
◆ ALBUM: collect all 48 cards plus rare gold-leaf editions, and learn each flower's
  name in Korean and Japanese with the little stories behind them
◆ RUSH and ZEN: a 60-second score attack, or endless boards with no clock at all
◆ CARD SETS and SEALS: clear Godori, the red ribbons or the Five Brights on one
  board for a bonus, and earn seals for the classic sets
◆ Paper and Ink themes that follow your phone's light or dark mode, gentle
  generative music, satisfying haptics
◆ Plays offline. Short sessions. No account needed.

Fair ads, promised: never in the middle of a puzzle, never in your first levels, and
rewarded ads are always your choice. A one-time purchase removes the rest.
```

**In-app products** (shown on the listing automatically): Remove ads, the Supporter
pack and petal pouches. In the IARC questionnaire, answer **Yes** to "digital purchases".

**Graphics** (in `store/`):

* App icon 512×512: `store/icon-512.png`
* Feature graphic 1024×500: `store/feature-graphic.png`
* Phone screenshots, 8 at 1080×1920 (9:16, 24-bit PNG, no alpha): `store/screenshots/` (regenerate with
  `SCALE=2.5 VIEW=432x768 npm run screens -- http://localhost:5173/ store/screenshots`)

## 7. Release tracks

1. **Internal testing** (up to 100 testers, no review, live within minutes):
   1. **Get the AAB.** The signing secrets (§3) must be set first. GitHub → repo →
      *Actions* → **Android build** → *Run workflow* → branch `main` → *Run workflow*
      (any push also runs it). When the run is green, open it → *Artifacts* →
      **`jjak-release-aab`** (a zip; artifacts are kept 90 days) → unzip →
      `app-release.aab`. Its `versionCode` is the run number, so every run can be uploaded.
   2. **Testers.** Play Console → app → **Test and release → Testing → Internal testing** →
      *Testers* tab → *Create email list* → name `Jjak testers`, add your Gmail (and any
      friends) → *Save changes* → tick the list → *Save*.
   3. **Release.** Same page → *Releases* tab (or *Create new release* at the top) → on the
      first release keep **Play App Signing** with *Use a Google-generated key* (§3) →
      *App bundles* → *Upload* → `app-release.aab` → release name fills in (versionCode
      and versionName) → release notes, e.g. `<en-US>First internal build</en-US>` →
      *Next* → fix any errors it lists (warnings are fine) → *Save and publish*.
   4. **Install.** *Testers* tab → *Copy link* (the "join on the web" opt-in link) → open it
      on the phone signed in with a tester Gmail → *Accept invite* → *Download it on Google
      Play*. Check that ads (test ads until §2 is done) and, from an EU connection, the
      consent form work. A Play build has no UMP debug geography, so to see the GDPR form from
      outside the EU, connect the phone through an EU VPN before the first launch (a local QA build
      can instead use `VITE_UMP_DEBUG_DEVICE=<hashed id> npx vite build --mode qa`; UMP logs the id).
   5. **Pre-launch report.** Google tests every testing-track upload on real devices
      automatically (about an hour). Play Console → app → **Test and release → Testing →
      Pre-launch report → Overview**: check *Stability* (crashes, ANRs: must be zero),
      *Performance*, *Accessibility* warnings (review each; fix real issues) and the
      screenshots (no clipped layouts).
2. **Closed testing** (required for new personal accounts): ≥ 12 testers opted in for 14
   days straight. Friends, classmates, or a Discord or Reddit community work. Keep them
   playing, because Google asks about tester engagement when you apply for production.
3. **Production**: apply for access, answer the questionnaire, then roll out at 20% →
   100%.

## 8. Pre-launch QA checklist

Legend: **[x] web-verified** = checked in Chromium on the web build at 360×640 and 390×844, paper and
ink themes (and reduced motion where motion matters), with no console errors, on the
launch-candidate commit. **[ ] 📱 device** = needs a real Android device or Play Console (billing,
ads, notifications, the hardware Back button, WebView behaviour). Re-run the device items on the
first internal-test build.

**Onboarding and teaching**
- [x] web-verified · Every launch: the loader takes over from the native splash (same ground, seal centred), the seal is pressed, a brush stroke draws, the line follows the real boot steps; held 0.7 s, then it cross-fades into the first screen (Edge: boot done ≈0.4 s after load, loader gone ≈1.1 s after its motion starts, fresh and returning alike)
- [x] 📱 device (Pixel 10a · Android 17) · The splash-to-loader handoff is invisible in both themes (seal size and position match the system splash icon) — the splash now uses a seal-only icon (`drawable/splash_icon.xml`, no paper disk on ink); the seal measures 291 px wide at the same centre before and after the handoff, light and dark
- [x] web-verified · First launch: the intro title (seasonal landscape, seal, Jjak, tagline, Begin), then the animated first minute (pair, bends, blocked path, combo) with Skip from the first frame; a fresh player's first real pair lands ~7.1 s after Begin (measured from the Begin tap, not launch: `jjak:begin-to-first-pair`); ends in Level 1 with the first pair glowing
- [x] web-verified · Returning players never see the first minute; Settings → How to play → Replay intro plays it again
- [x] web-verified · Each idea gets a one-time animated intro (demo, then "your turn") the first time it appears: Level 6 variants · Stones L14 · Falling leaves L26 · First snow L38 · Lucky cards L50 · Knots L74 · Wind L98 · Gates L122 · Fences L158 · each goal kind on its first goal board
- [x] web-verified · Pause → Replay intro shows the board's newest idea; the clock stays stopped
- [x] web-verified · Level 12 is the first festival board and stamps the Gyeongju passport page

**Level Director**
- [x] web-verified · Levels 1–30 played start to finish in the browser (and 121–124, 157–159, 598–600): every board clears, intros show once, tiers adapt (a fast, clean player reaches tier 4 by level 10)
- [x] web-verified · A retry or replay gives the same board (tier pinned per level)
- [x] web-verified · Nothing mentions levels past 600 until level 600 is cleared; then "The road goes on" plays once, Home and the Map show Wanderer · Year 2
- [x] 📱 device (Pixel 10a · Android 17) · Endless levels (601+) generate in a Web Worker without a visible pause on a mid-range phone — worker 529–697 ms per board, never the main-thread fallback; tap → painted cards 259–561 ms; the board builds under the title card

**Screens**
- [x] web-verified · Map: scrolls to the current place; opening a place lists its 12 levels (gates 門, fences 垣, goal marks); any unlocked level replays
- [x] web-verified · Flower Path: XP shows on the result sheet **and the Rush end sheet**; Claim all stamps ranks and pays out; missions reroll; star chests open
- [x] web-verified · Market: every tab, buy, equip, "can't afford" shows what's missing; petal pouches / Supporter section shows "Available in the Android app" on the web
- [x] web-verified · Garden: empty, partial, full, night; the visitor line follows the previewed season; tapping open water opens the pond, not the koi
- [x] web-verified · Album (bonus + gold leaf), Seals (a burst of many seals gives one short toast), Settings, gift calendar
- [x] web-verified · Reset progress: cosmetics fall back to defaults; Remove ads, Supporter and pouch receipts survive (unit test + browser check)
- [x] web-verified · Rush: timer, +time floaters, next board on clear, end sheet with petals, XP and seals
- [x] web-verified · Reduced motion: no deal cascade, static intro steps, the reveal shows its end state
- [x] 📱 device (Pixel 10a · Android 17) · Deck style and card back persist after a restart; every deck style keeps the 12 months distinguishable on an 8×7 board — Ink wash + Blue waves equipped in the Market survive a force-stop; all six decks on the 8×7 level 624 (the near-monochrome Ink wash, Celadon and Moonlit read by motif and corner numeral)

**Purchases (license tester)**
- [ ] 📱 device · Remove ads: buy → banners and interstitials stop, rewarded stays; reinstall → "Restore purchase" brings it back — **Blocked on the owner:** the products don't exist in Play Console yet (the phone's billing calls return "Product not found"), and they need a license-tester account (§0a)
- [ ] 📱 device · Remove ads asks (MONETIZATION.md §4a): the first Home after the first board opens the sheet with "Don't ask again"; in a festival week, with both Remove ads products live, it shows the festival and "this week (usually …)" and buys `jjak_remove_ads_festival`; "Don't ask again" stops every ask — needs the products and a license tester (§0a)
- [ ] 📱 device · Petal pouch: buy → petals credited once; buy the same pouch again right away (proves it was consumed); kill the app mid-purchase → next launch credits it once — **Blocked on the owner:** same as above
- [ ] 📱 device · Supporter pack: buy → ads off, +1,500 petals, Clouds back owned, Supporter seal; reinstall → restore brings ads-off and the back, petals are not granted twice — **Blocked on the owner:** same as above

**Ads**
- [x] 📱 device (Pixel 10a · Android 17) · EU test (QA build: `VITE_UMP_DEBUG_DEVICE=<hashed id from logcat> npx vite build --mode qa`, or an EU VPN on a normal build): consent form appears, and Settings shows "Ad privacy choices" — form shown at launch; "Do not consent" stored no purposes; the Settings row reopens the form
- [x] 📱 device (Pixel 10a · Android 17) · Levels 1–5 never show an interstitial; after that, at most one every 3 boards / 150 s — the first comes after level 5's clear ("never before level 5"); then 3 clears and ≥150 s apart in two 6-board runs
- [x] 📱 device (Pixel 10a · Android 17) · Rewarded: closing early grants nothing, and finishing grants the item; afterwards no interstitial for 6 minutes; every interstitial is preceded by the "Short break" card — reward → +1 hint, used at once; no interstitial for 6 min though one was due; the card before every interstitial. Google's test rewarded ad grants its reward when skipped, so "closed early" is covered by tests/ad-show.test.ts, not the device. Fixed on the way: the next ad was lost after each interstitial (card with no ad), music came back under ads, and a rewarded ad closed early left the board paused
- [x] 📱 device (Pixel 10a · Android 17) · Banner on Home and Album only; the layout isn't covered (bottom padding adjusts) — 64 px padding on Home/Album, none on Market and boards; offline: no banner and no gap

**Platform**
- [x] 📱 device (Pixel 10a · Android 17) · Daily reminder: offered after the first Daily; Android 13+ asks for notification permission; a notification arrives at the chosen hour and not on days already played — offered on the first Daily's result sheet; choosing 8:00 raised "Allow Jjak to send you notifications?"; after Allow, six reminders were pending at 08:00 for the next six days and none for today (already played). The first actual arrival (next morning) is for the owner to confirm
- [x] 📱 device (Pixel 10a · Android 17) · Music: starts after the first tap, changes with the season, fades during ads, stops in the background — audio stream stopped until the first tap, started after; suspended in the background (fixed: it stayed running), back on return; season from the board's chapter; ducked until the ad closes
- [x] 📱 device (Pixel 10a · Android 17) · Android back button: closes sheets → pauses a board in progress → returns home → minimizes on home (a board with no pairs made goes straight Home: nothing to lose)
- [x] 📱 device (Pixel 10a · Android 17) · Rotate / split-screen / large-screen: layout still fits (portrait locked on phones) — forced landscape keeps portrait on the phone; split and large windows measured in Edge at the same sizes (changing `wm size` locks the test phone): no overflow at 411×449, 800×1280, 1280×800 (Android 16+ ignores the portrait lock on large screens) or 912×1368. In a half-height split the cards shrink to ~23 px wide: it fits, but it's cramped
- [x] 📱 device (Pixel 10a · Android 17) · Airplane mode: game fully playable, ads simply absent — cold start 1.0 s, a full board to its clear, only an "ads: start failed" warning
- [x] 📱 device (Pixel 10a · Android 17) · Kill and relaunch mid-level: progress (levels, album, petals, analytics) persists — force-stopped 1 s after a clear: level, petals, album, clears, pairs and stars all kept
- [x] 📱 device (Pixel 10a · Android 17) · Dark mode: Ink theme, with status bar icons readable — Auto follows the phone live and after a restart; splash on ink, no flash
- [x] web-verified · Daily: completing once counts toward the streak; replays are marked "practice"; Warm tea keeps a streak through a missed day (unit tests)
- [ ] 📱 device · Play Console pre-launch report: no crashes, accessibility warnings reviewed — **Blocked on the owner:** needs the upload keystore secrets (§3) so CI signs the AAB, then an internal-testing upload

## 9. Native edits already applied (for reference if you regenerate `android/`)

* `AndroidManifest.xml`: AdMob `APPLICATION_ID` meta-data, portrait orientation, and
  backup rules for progress.
* `res/values/strings.xml`: `admob_app_id`.
* `app/build.gradle`: release signing from `keystore.properties` or env, and
  `versionCode` from `-PversionCode`.
* `res/xml/backup_rules.xml`, `data_extraction_rules.xml`.
* Icons and splash generated from `resources/` with `npm run assets`.
