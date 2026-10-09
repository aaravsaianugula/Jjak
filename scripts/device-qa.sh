#!/usr/bin/env bash
# Device QA for the 📱 items in docs/PLAY_STORE_RELEASE.md §8. Needs adb and one phone with USB debugging on.
#   scripts/device-qa.sh path/to/app-debug.apk      (the CI artifact "jjak-debug-apk", or android/app/build/outputs/apk/debug)
#   PLAY_SECONDS=60 scripts/device-qa.sh ...        records frame pacing for that long instead of waiting for Enter
#                                                   (pair it with scripts/device-play.mjs to play the board unattended)
# adb comes from PATH, else $ANDROID_HOME/platform-tools (Git Bash on Windows: run from the repo root).
# Writes screenshots and logs to qa-device/<timestamp>/. Only reads from the phone, apart from installing the APK
# and flipping the system dark mode (restored at the end).
set -euo pipefail

APK="${1:?usage: scripts/device-qa.sh path/to/app-debug.apk}"
PKG=com.jjak.puzzle
ACT="$PKG/.MainActivity"
OUT="qa-device/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$OUT"

if ! command -v adb >/dev/null; then
  sdk="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}"
  [ -n "$sdk" ] && command -v cygpath >/dev/null && sdk=$(cygpath -u "$sdk")
  [ -n "$sdk" ] && [ -d "$sdk/platform-tools" ] && PATH="$sdk/platform-tools:$PATH"
  command -v adb >/dev/null || { echo "adb not found: install the Android SDK platform-tools or put adb on PATH."; exit 1; }
fi

adb get-state >/dev/null || { echo "No phone found: check the cable and that USB debugging is allowed."; exit 1; }
echo "Phone: $(adb shell getprop ro.product.model | tr -d '\r'), Android $(adb shell getprop ro.build.version.release | tr -d '\r')"

shot() { adb exec-out screencap -p > "$OUT/$1.png"; echo "  saved $OUT/$1.png"; }
night_before=$(adb shell cmd uimode night | tr -d '\r' | awk '{print $NF}')
restore() { adb shell cmd uimode night "${night_before:-auto}" >/dev/null 2>&1 || true; }
trap restore EXIT

echo "1. Install"
adb install -r -d "$APK" >/dev/null

echo "2. Cold start (TotalTime is launch to first frame, in ms)"
for i in 1 2 3; do
  adb shell am force-stop "$PKG"
  adb shell am start -W -n "$ACT" | tr -d '\r' | grep -E 'TotalTime|WaitTime' | sed "s/^/  run $i: /"
  sleep 3
done
shot start-default

echo "3. Light and dark: Auto should follow the phone, while the app is open and after a restart"
adb logcat -c
for mode in no yes; do
  adb shell cmd uimode night "$mode" >/dev/null
  sleep 3
  shot "live-night-$mode"
  adb shell am force-stop "$PKG"
  adb shell am start -W -n "$ACT" >/dev/null
  sleep 4
  shot "restart-night-$mode"
done
restore

adb shell dumpsys gfxinfo "$PKG" reset >/dev/null
if [ -n "${PLAY_SECONDS:-}" ]; then
  echo "4. Frame pacing: recording for $PLAY_SECONDS s (play a board now, or let scripts/device-play.mjs play it)"
  sleep "$PLAY_SECONDS"
else
  echo "4. Frame pacing: play a board for about 60 s now (match pairs, trigger a combo). Press Enter when done."
  read -r _
fi
adb shell dumpsys gfxinfo "$PKG" > "$OUT/gfxinfo.txt"
grep -E 'Total frames rendered|Janky frames|50th percentile|90th percentile|95th percentile|99th percentile' "$OUT/gfxinfo.txt" | sed 's/^/  /'

echo "5. Errors from the app since step 3"
# Every process started for the app since step 3 (its own and its WebView renderers, even ones that died
# early): ActivityManager names the host app in each "Start proc" line, so other apps' lines are left out.
adb logcat -d -b main,system,crash -v brief | tr -d '\r' > "$OUT/logcat.txt"
pid_re=$(grep -a "Start proc" "$OUT/logcat.txt" | grep -a "{$PKG/" | sed -E 's/.*Start proc ([0-9]+):.*/\1/' | sort -u | paste -sd'|' -)
grep -aE "\(\s*(${pid_re:-0})\):" "$OUT/logcat.txt" \
  | grep -iE "chromium.*(error|uncaught)|Capacitor.*(error|exception)|AndroidRuntime|FATAL" > "$OUT/errors.txt" || true
if [ -s "$OUT/errors.txt" ]; then echo "  $(wc -l < "$OUT/errors.txt") lines in $OUT/errors.txt"; else echo "  none"; fi

echo "Done: $OUT"
