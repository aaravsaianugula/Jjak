#!/usr/bin/env bash
# Device QA for the 📱 items in docs/PLAY_STORE_RELEASE.md §8. Needs adb and one phone with USB debugging on.
#   scripts/device-qa.sh path/to/app-debug.apk      (the CI artifact "jjak-debug-apk", or android/app/build/outputs/apk/debug)
# Writes screenshots and logs to qa-device/<timestamp>/. Only reads from the phone, apart from installing the APK
# and flipping the system dark mode (restored at the end).
set -euo pipefail

APK="${1:?usage: scripts/device-qa.sh path/to/app-debug.apk}"
PKG=com.jjak.puzzle
ACT="$PKG/.MainActivity"
OUT="qa-device/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$OUT"

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

echo "4. Frame pacing: play a board for about 60 s now (match pairs, trigger a combo). Press Enter when done."
adb shell dumpsys gfxinfo "$PKG" reset >/dev/null
read -r _
adb shell dumpsys gfxinfo "$PKG" > "$OUT/gfxinfo.txt"
grep -E 'Total frames rendered|Janky frames|50th percentile|90th percentile|95th percentile|99th percentile' "$OUT/gfxinfo.txt" | sed 's/^/  /'

echo "5. Errors from the app since step 3"
adb logcat -d -v brief | grep -iE "chromium.*(error|uncaught)|Capacitor.*(error|exception)|AndroidRuntime|FATAL" > "$OUT/errors.txt" || true
if [ -s "$OUT/errors.txt" ]; then echo "  $(wc -l < "$OUT/errors.txt") lines in $OUT/errors.txt"; else echo "  none"; fi

echo "Done: $OUT"
