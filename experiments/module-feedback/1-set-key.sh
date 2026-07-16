#!/usr/bin/env bash
#
# 1-set-key.sh — paste your TwelveLabs API key into .env
#
#   ./1-set-key.sh            # then paste the key when prompted
#   ./1-set-key.sh <key>      # or pass it directly
#
# Get a free key (no credit card) at:
#   https://playground.twelvelabs.io/dashboard/api-keys
#
set -euo pipefail
cd "$(cd "$(dirname "$0")" && pwd)"

# First run: create .env from the template.
if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env"
fi

KEY="${1:-}"
if [ -z "$KEY" ]; then
  printf "Paste your TwelveLabs API key and press Enter:\n> "
  read -r KEY
fi

# Strip any stray whitespace/newlines from the paste.
KEY="$(printf '%s' "$KEY" | tr -d '[:space:]')"
if [ -z "$KEY" ]; then
  echo "✗ No key entered — nothing changed."
  exit 1
fi

# Replace the TWELVELABS_API_KEY line (or append it if missing).
awk -v k="$KEY" '
  /^TWELVELABS_API_KEY=/ { print "TWELVELABS_API_KEY=" k; found=1; next }
  { print }
  END { if (!found) print "TWELVELABS_API_KEY=" k }
' .env > .env.tmp && mv .env.tmp .env

echo "✓ Saved your key to .env (${#KEY} characters)."
echo "  Next:  ./2-analyze-video.sh /path/to/your-clip.mp4"
