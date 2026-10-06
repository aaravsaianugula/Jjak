# Prompt: plan and build "Jjak" (paste into Claude / Claude Code)

> Use this as the opening message for a fresh Claude Code session in an empty repo, or to
> rebuild or extend the game. It holds the research conclusions, so Claude doesn't need to
> redo the market analysis. Change anything in `[brackets]`.

---

You are a senior mobile game designer and engineer. Plan, design, and build **Jjak (짝)**,
a puzzle game for Google Play aimed at a **global audience aged 10–25** (US first). Be
creative, but make choices that ship. Work in phases, and verify each phase before moving on.

## 1. Product brief (fixed decisions)

- **Name:** Jjak. 짝 is Korean for "pair / partner" and is also the sound of a clap.
- **Pitch:** a calm, beautiful *pair-connecting* puzzle built on the 48-card flower deck
  that Korea (Hwatu 화투) and Japan (Hanafuda 花札) share. Players match cards of the same
  **flower/month**, chain combos, collect all 48 cards, and pick up Korean and Japanese
  words as they go.
- **Why (research):** Match Pair and Sort are the fastest-growing puzzle sub-genres in
  Sensor Tower's 2026 report, and Match Pair is ad-friendly. Block Blast proves that simple,
  juicy, endless play wins. Daily shareable logic games (Wordle, Connections, LinkedIn
  Queens) are a Gen Z ritual. Japanese and Korean are top-6 languages for 13–22 Duolingo
  learners. Ads are the #1 complaint in puzzle reviews, so fair ads are a feature.
  See `docs/RESEARCH.md`.
- **Aesthetic:** "modern hanji": warm paper, sumi ink, vermilion seal stamps, muted
  seasonal colours, and elegant serif type for Hangul and kanji. **Not** neon, "gamer",
  childish, or cartoony. It should look like a design studio made it. Include a light
  "Paper" theme and a dark "Ink" theme.
- **Tone:** calm, confident, a little poetic. No exclamation-mark spam.

## 2. Core gameplay (implement exactly, then improve)

1. **Board:** a grid of cards. Two cards form a *jjak* when they share the same month (flower).
2. **Connect rule (Shisen-sho):** the two cards must be joinable by a path of at most
   **3 straight segments (≤2 turns)** that crosses only empty cells. The path may run one
   cell outside the board edge. Draw the path as an ink brush stroke, then remove both cards.
3. **Generation:** boards must be **solvable by construction**. Place pairs one at a time
   into empty cells that are connectable given the pairs placed so far. Removing them in
   reverse order then always works. Stones are permanent blockers. Generation is seeded and
   deterministic.
4. **Dead ends:** if no move exists, auto-shuffle the remaining cards into a solvable layout
   (this costs the "no assists" star).
5. **Teaching curve:** levels 1–5 use identical-looking cards (plain variant only). From
   level 6, the 4 variants of each month (plain / ribbon / animal / bright) appear, so the
   player learns to match by flower, not by picture. Stones arrive in later chapters.
   Boards grow from 4×4 to about 8×10.
6. **Juice:** combo chain if the next pair is made within ~4 s (×2…×5), with rising musical
   pitch, haptics, and a petal burst. Tiny wrong-match shake. No timers that punish in Journey.
7. **Stars (transparent goals):** ★ clear · ★ no hints/shuffles · ★ under par time.

## 3. Modes and meta

- **Journey:** endless seeded levels grouped into four seasonal chapters (Spring, Summer,
  Autumn, Winter, then loop with higher difficulty).
- **Daily Jjak:** one board per calendar day, the same for everyone (seeded by date).
  Timed. Streak counter. **Share card** text in the style of
  `Jjak #142 · 1:42 · ×5 combo · 🌸🌸🌸`. One attempt per day; free replays don't
  count toward the streak.
- **Zen:** endless relaxing boards with no score and no timer.
- **Album (collection):** after each Journey clear, draw one new card with a reveal
  animation. Each card shows the English name, Korean (Hangul + romanization), Japanese
  (kanji/kana + romaji), its month, and a short cultural note, including KR/JP differences
  (Nov/Dec swapped, blue vs purple ribbons, 흑싸리 vs 藤).
- **Petals** (soft currency) are earned from stars and the daily. They are spent on hints
  and shuffles. There is no real-money gambling, no loot boxes for money, and no pay-to-win.

## 4. Monetization (fair-ads policy, which is also a store-listing feature)

- AdMob through `@capacitor-community/admob` (Capacitor 8 compatible).
- **Rewarded** (opt-in): +1 hint, +1 shuffle, double petals, extra album draw.
- **Interstitial:** only *between* levels, never before level 5, at most once every 3 clears
  and once every 150 s. Never mid-puzzle.
- **Banner:** home/album screens only, never over the board.
- **Consent:** Google UMP (GDPR/US states) on launch; privacy-options entry in Settings.
- **Ages 10–25 means Families policy.** Use a neutral age screen on first launch (birth
  year). For users under 13, use child-directed / under-age-of-consent ad requests, max
  content rating G, and no personalized ads. Never ask for any other personal data.
- Put all ad unit IDs in one config file. Ship with Google's **test IDs** and document the swap.

## 5. Tech stack and constraints

- TypeScript + Vite (no UI framework needed) + **Capacitor 8** (Android target/compile SDK
  36, minSdk 24). Plugins: AdMob, Haptics, Preferences, Share, Status Bar, Splash Screen, App.
- All art is **original SVG** made in code. No copyrighted hanafuda scans and no Nintendo
  marks. Fonts are bundled locally (OFL): Gowun Batang (KR/Latin) and Zen Old Mincho (JP).
  Subset them to the glyphs you use.
- Sounds are synthesized with WebAudio (soft wooden "tok", bell chime, combo arpeggio).
  There are no audio files.
- Works offline. Saves progress locally (Preferences, with a localStorage fallback).
- 60 fps on mid-range phones: CSS transforms only, no layout thrash, one SVG `<defs>` sprite.
- Accessibility: month numeral on every card, colour-blind-safe shapes, large tap targets
  (≥44 px), honours reduced motion.

## 6. Deliverables

1. `docs/GAME_DESIGN.md`: final GDD (loops, level curve table, economy, ad rules).
2. Source code with a clear structure: `src/engine` (pure, tested), `src/ui`, `src/art`,
   `src/services` (ads, storage, audio, haptics).
3. **Unit tests** (Vitest) for path finding, solvable generation (fuzz 1,000 seeds), shuffle,
   daily determinism, and scoring.
4. Android project (`npx cap add android`), app icon (vermilion seal with 짝), splash,
   versioning, and release signing through `keystore.properties` / CI secrets.
5. GitHub Actions: test → build web → `cap sync` → `assembleDebug` + `bundleRelease`,
   then upload the APK/AAB artifacts.
6. `docs/PLAY_STORE_RELEASE.md`: the step-by-step publishing checklist, store listing copy
   (title ≤30, short description ≤80, full description), Data Safety answers, content-rating
   answers, target-audience setup, app-ads.txt, the 12-tester closed test, and a
   privacy-policy template.
7. Phone-size screenshots of every screen (Playwright) to check the aesthetic.

## 7. Process

1. Restate the plan as milestones with acceptance criteria.
2. Build the engine and tests first, and get them green.
3. Build the UI. Screenshot it, critique it like an art director, and iterate at least twice.
4. Wire up ads, consent, and the age gate, with test IDs.
5. Package Android and CI. Make sure the build passes in CI.
6. Finish with a report covering what was built, how it was verified, what the owner must do
   (AdMob IDs, keystore, Play Console), and known limitations.

Quality bar: no placeholder lorem, no TODO-only screens, no invented "official" claims. If
something can't be verified, say so.
