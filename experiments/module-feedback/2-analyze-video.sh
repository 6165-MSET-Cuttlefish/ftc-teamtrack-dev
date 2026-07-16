#!/usr/bin/env bash
#
# 2-analyze-video.sh — analyze a robot clip with Method 2 (TwelveLabs / Pegasus)
#
#   ./2-analyze-video.sh /path/to/robot-clip.mp4
#   ./2-analyze-video.sh demo      # offline demo, no key/video needed
#
# Tip: you can drag a video file into the terminal to paste its full path.
#
set -euo pipefail

VIDEO="${1:-}"
if [ -z "$VIDEO" ]; then
  echo "Usage: ./2-analyze-video.sh /path/to/robot-clip.mp4"
  echo "  Drag a video into the terminal to paste its path."
  echo "  No video yet? Try the offline demo:  ./2-analyze-video.sh demo"
  exit 1
fi

DIR="$(cd "$(dirname "$0")" && pwd)"

# Offline demo — runs all methods against fixtures, no key required.
if [ "$VIDEO" = "demo" ]; then
  cd "$DIR"
  exec npx tsx src/cli.ts compare --mock --no-write
fi

# Resolve the video path relative to where you ran this, before we cd.
if [ ! -f "$VIDEO" ]; then
  echo "✗ File not found: $VIDEO"
  exit 1
fi
VIDEO="$(cd "$(dirname "$VIDEO")" && pwd)/$(basename "$VIDEO")"

cd "$DIR"

# Make sure a key was set (script 1).
if [ ! -f .env ] || ! grep -q '^TWELVELABS_API_KEY=.' .env; then
  echo "✗ No TwelveLabs API key set yet. Run this first:"
  echo "    ./1-set-key.sh"
  exit 1
fi

echo "▸ Analyzing $(basename "$VIDEO") with Method 2 (TwelveLabs)…"
echo "  (First run uploads + indexes the clip — that can take a few minutes.)"
exec npx tsx src/cli.ts method2 --video "$VIDEO"
