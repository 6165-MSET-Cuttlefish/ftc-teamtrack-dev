#!/usr/bin/env bash
#
# set-gemini-key.sh — paste your Gemini API key into .env
#
#   ./set-gemini-key.sh            # then paste the key when prompted
#   ./set-gemini-key.sh <key>      # or pass it directly
#
# Get a key at:  https://aistudio.google.com/apikey
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
  printf "Paste your Gemini API key and press Enter:\n> "
  read -r KEY
fi

# Strip any stray whitespace/newlines from the paste.
KEY="$(printf '%s' "$KEY" | tr -d '[:space:]')"
if [ -z "$KEY" ]; then
  echo "✗ No key entered — nothing changed."
  exit 1
fi

# Replace the GEMINI_API_KEY line (or append it if missing).
awk -v k="$KEY" '
  /^GEMINI_API_KEY=/ { print "GEMINI_API_KEY=" k; found=1; next }
  { print }
  END { if (!found) print "GEMINI_API_KEY=" k }
' .env > .env.tmp && mv .env.tmp .env

echo "✓ Saved your Gemini key to .env (${#KEY} characters)."
echo "  Try it:  yarn gemini-fps --video ./samples/your-clip.mp4"
echo "           or pick “Gemini” in the web UI (yarn ui)."
echo "  Free-tier key? If a model error appears, set GEMINI_ANALYSIS_MODEL=gemini-2.5-flash in .env"
