# Next session prompt: validate on a real phone, polish, launch

> Run this in a **local** Claude Code session on the owner's PC (Claude Desktop, or `claude` / `claude remote-control`
> in the repo folder), with the Android phone plugged in over USB.
> Paste everything below the line, or say: "Read `docs/NEXT_SESSION.md` and do it."
> The previous prompt (the Level Director expansion) is done; it lives in git history for this file.

---

You're continuing work on **Jjak (짝)**, a calm pair-connecting puzzle (Shisen-sho rules) on the 48-card
Hwatu/Hanafuda flower deck that Korea and Japan share. It ships to Google Play for a 13+ US/global audience.
The look is paper and ink: no neon, no gamer style, nothing childish, and **no dot, stipple or dashed textures**
(the owner's words: "Dots make it look cheap").

Everything up to now was built in a cloud session that could not reach a phone. All of it is committed on branch
**`claude/pensive-goodall-f3ocnt`** (draft PR https://github.com/aaravsaianugula/Jjak/pull/1, CI green).
Your job is to validate on the real device, fix and polish what that shows, and get the build ready for the
Play internal testing track.

## 0. Set up and prove the baseline (do this first)

```bash
git fetch origin claude/pensive-goodall-f3ocnt
git checkout claude/pensive-goodall-f3ocnt && git pull
npm ci
npx tsc --noEmit && npx vitest run && npm run build      # expect 292 tests passing
adb devices -l                                            # the phone must be listed as "device"
```

- Toolchain CI uses: Node 22, JDK 21, the Android SDK (see `.github/workflows/`). If `adb`, a JDK or the SDK is
  missing on this PC, say exactly what is missing and how to install it, then wait. Don't guess paths.
- Playwright (for `scripts/*.mjs` browser checks) may need a browser on this PC. Ask before downloading one.
- If the baseline is not green, stop and fix that before anything else.

## 1. Read first

1. `docs/PLAY_STORE_RELEASE.md` §8: the launch checklist. Items marked **📱 device** are what this session is for.
2. `docs/GAME_DESIGN.md` §4 and `docs/EXPANSION_PLAN.md` Part C: the Level Director, gates and fences, goals,
   show-don't-tell intros, and the hidden endless road past level 600.
3. `README.md`: features, commands, screenshots.

Map of the code: `src/engine` (rules, solver, generation), `src/director` (level plan, player model, bank,
endless road + Web Worker), `src/ui` (screens, motion, demos, reveal), `src/art` (all SVG art),
`src/styles`, `android/` (native shell: DayNight theme, `MainActivity.paintBackground()`, themed icon).

## 2. Validate on the phone

Build and install a debug APK, then run the device script:

```bash
npm run android:sync && (cd android && ./gradlew assembleDebug)
scripts/device-qa.sh android/app/build/outputs/apk/debug/app-debug.apk
```

On Windows, run the script from Git Bash or WSL (or translate its `adb` steps).
`scripts/device-qa.sh` was written without a device to test on. Fix it first if it misbehaves.
It installs the APK, times 3 cold starts, and flips the system dark mode (live and after a restart) with
screenshots. It then records frame pacing while the owner plays about 60 s, and collects app errors into
`qa-device/<timestamp>/` (git-ignored).

Debug builds can be inspected from desktop Chrome (`chrome://inspect`). Release builds can't
(`capacitor.config.ts` leaves `webContentsDebuggingEnabled` unset on purpose).

### 2a. Endless road (601+), the riskiest unverified item

The target is a board within 1.5 s on a mid-range phone; the browser measured about 370 ms.
To jump a **test install** to level 601:

1. Run this in the `chrome://inspect` console. It overwrites progress on that install.
   ```js
   const P = Capacitor.Plugins.Preferences;
   const s = JSON.parse((await P.get({ key: 'jjak.save.v1' })).value);
   s.level = 601; s.onboarded = true; s.journey = { ...s.journey, revealed: true };
   s.stars = Object.fromEntries(Array.from({ length: 600 }, (_, i) => [i + 1, 3]));
   await P.set({ key: 'jjak.save.v1', value: JSON.stringify(s) });
   ```
2. Run `adb shell am force-stop com.jjak.puzzle`. Don't reload instead: the app persists its in-memory save on
   page hide and would overwrite the edit.
3. Reopen and tap Continue.

Also play level 600 → the "The road goes on" reveal, and check that the 601+ boards feel fair. If the worker is slow, the
fallback runs on the main thread; check that there is no visible freeze. Tune budgets in
`src/director/endless.ts` (worker round-trip limit) and `endless-core.ts`.

### 2b. The rest of §8 📱

Go through every **📱 device** line in `docs/PLAY_STORE_RELEASE.md` §8:
- Back button, rotation and split-screen, airplane mode, kill-and-relaunch persistence.
- Music lifecycle, the daily reminder with the Android 13+ notification permission, banners and padding.
- Interstitial pacing and rewarded-ad rules, using AdMob **test** IDs.
- The EU consent form, using UMP debug geography.
- Billing flows. These need Play Console products and a license-tester account. If those aren't set up yet,
  mark the items blocked on the owner instead of faking them.

Tick each item in the doc as you verify it, noting the device and Android version. Write down anything that fails.

### 2c. Light and dark on the device

The phone's light/dark setting (with the app on Auto) should match the app's colours, live and after a restart:
- Status and navigation bar icons readable in both.
- No white or black flash at launch.
- The splash and the themed (monochrome) icon follow the setting.

The web side was verified with `scripts/theme-parity.mjs`; the native side was verified only by CI compiling it.

## 3. Fix and polish

Fix every device failure first (root cause, no skipped tests). Then the known leftovers, in this order:

1. **Frame pacing.** The biggest browser cost left is Chrome laying out the card-face SVGs (about 1.5 s per
   9-pair run at 4× CPU throttle). If the device feels janky on a full board (90th-percentile frame time over 16 ms,
   or more than about 5% janky frames), make card faces cheaper to paint. Options: pre-rasterise each face
   once per deck to a bitmap or `<img>`, or flatten symbol nesting in `src/art/cards.ts`. Measure before and after.
2. **Market tabs.** Effects, Papers and Music open about 40–90 ms slower at 4× throttle after the new art
   (`src/art/market-art.ts`). Lazy-build their symbols off-screen, or defer the preview animations.
3. **Motion leftovers.**
   - The Flower Path rank-up moment (`src/ui/screens/path.ts`).
   - The intro progress dots animate `width`; switch to transform.
   - The Map chapter card's own height snaps when it collapses.
4. **Art.** The Garden tree canopies still read a little like cloud-pruned pads (`src/art/garden.ts`).
5. **Code-review minors** that were skipped:
   - Duplicate small helpers across `src/ui`.
   - Per-pair work in the meta pair handler.

Rules for all polish:
- Transform and opacity only.
- Honour `prefers-reduced-motion`.
- Calm settle curves; use the shared `--ease-settle`.
- Both themes, at 360×640 and 390×844.
- Never raise difficulty to sell hints, never fake near-misses, never punish streaks.

## 4. Launch prep

Prepare everything that doesn't need the owner's accounts, and give the owner exact click-paths for what does.

**Owner-only:**
- **Play Console in-app products**, with IDs and prices matching `src/data/market.ts` / the billing service.
  Defaults: $0.99, $2.49, $4.99 and the $4.99 supporter pack.
- **Real AdMob app and unit IDs.** They replace the test IDs; find every place they're set and list them.
- **Upload keystore + Play App Signing.** CI reads optional signing secrets (see the workflow's
  "Prepare release signing" step).
- **Privacy-policy hosting.** `docs/privacy-policy.html` exists; it needs a public URL in the listing.
- **Merge into `main`.** PR #1's base is `claude/quirky-lamport-37q8ip`, not `main`; confirm the owner's intended
  merge path before touching branches.

**Then:**
1. Build a signed release AAB.
2. Upload to the **internal testing** track and read the **pre-launch report** (crashes, accessibility warnings).
3. Fix what it finds.

Store assets are ready:
- `store/screenshots/` (8 shots at 1080×1920, 24-bit PNG). Regenerate with
  `SCALE=2.5 VIEW=432x768 npm run screens -- http://localhost:5173/ store/screenshots`.
- `store/feature-graphic.png` (`node scripts/render-feature.mjs`).
- `store/icon-512.png`.
- The listing text in `docs/PLAY_STORE_RELEASE.md`.

Regenerate any shot whose screen changes.

## 5. Open decisions (ask the owner; recommendations included)

| # | Decision | Recommendation |
|---|---|---|
| a | Lucky cards start in chapter 5 | Keep |
| b | A wind auto-reshuffle doesn't cost the no-assist blossom | Keep: the player didn't choose it |
| c | Lucky petals pay on first clear only (anti-farming) | Keep; revert is one line in `luckyPays` |
| d | Fonts add about 4.4 MB (244 subset slices) | Accept for launch; trim the JP serif first if size matters |
| e | IAP prices $0.99 / $2.49 / $4.99 / $4.99 | Keep; check local pricing in Play Console |
| f | Struggling players floor at tier 0 (a weak bot persona clears about 67% of boards cleanly) | Keep; add a below-floor tier only if real data shows quitting |
| g | Fixed par times; goals cost only a blossom; 5 tiers | Keep |
| h | Remote analytics (Firebase / Play Games) | Written proposal only; everything stays on-device |
| i | Effects/Papers/Music tabs slightly slower with the new art | Accept unless the device shows it |

## 6. Working rules

- **Commit in green checkpoints**: `npx tsc --noEmit`, `npx vitest run` and `npm run build` all pass first.
  Push to `claude/pensive-goodall-f3ocnt` and keep PR #1's description current.
- End commit messages with the session's attribution lines. Never put a model name in commits, the PR or code.
- After adding any Korean or Japanese text, run `npm run fonts`.
- Privacy: all on-device. The Data safety form and privacy policy stay as they are.
- If you spawn subagents: tell each one to commit but not push, use its own dev-server port, and not run
  `npm run fonts`. Review its screenshots before merging.
- Report outcomes faithfully. If a device check fails or is blocked on the owner, say so plainly.

## 7. Definition of done

- Every §8 📱 item is ticked, or explicitly marked blocked on the owner with the reason.
- The device QA output is reviewed: no app errors, cold start and frame pacing acceptable, and light/dark correct
  live and after a restart.
- Endless level 601+ appears within 1.5 s on the test phone, with no visible freeze.
- The polish leftovers in §3 are done or consciously deferred with a reason.
- tsc, tests and build are green locally, and Android CI is green on the final commit.
- A signed release AAB is on the internal testing track (if the owner has set up signing) with a clean
  pre-launch report.
- The final message lists:
  - Commits (with hashes) and the device results.
  - What only the owner can still do.
  - The decisions still open.
