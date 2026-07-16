# module-feedback (proof-of-concept)

An AI system that watches video of an FTC robot mechanism and returns
**Suggestions for Improvement** — concrete mechanical changes (roller geometry,
compliance, gearing, ramps) — plus a few quantitative measurements (e.g. how
many game elements the intake actually grabbed).

This is **TeamTrack v2 "BioBuzz"** work. It is built **on the side**: a
standalone CLI experiment that is **not wired into the TeamTrack website** and
**not deployed** anywhere. The website build (`client/` → `dist/spa`) never
touches this folder. Wiring the best method into the site is a later milestone
(7/18 in the plan).

> Plan: [`docs/planning/TeamTrack v2 BioBuzz.pdf`](../../docs/planning/)

## Status

- [x] Repo / project organization for the new module (this folder)
- [x] **Method 1** — Google Cloud Video Intelligence `OBJECT_TRACKING` +
      Gemini analysis pass, chained into one pipeline
- [x] **Method 2** — TwelveLabs Pegasus (video-native analysis). **No Gemini and
      no Google Cloud needed**, and TwelveLabs has a free plan — this is the
      **$0, single-key path** (built early because the Gemini key was blocked).
- [x] **Method 3** — Gemini Robotics-ER (`gemini-robotics-er-1.6-preview`)
- [x] A `compare` command to run all methods on one clip (skips any whose keys
      are missing) and line up the results
- [x] Offline `--mock` mode so the pipeline + output shape are demonstrable
      with no keys
- [ ] Run against real robot clips and record which is actually useful
      _(Method 2 needs only a free TwelveLabs key + a clip)_

YOLO is still a later (7/11) item and is intentionally **not** built yet.

> **Easiest path to a real test right now:** `Method 2`. Get a free TwelveLabs
> key (below), drop a clip in `samples/`, and run `yarn method2 --video ...`.

## Why a separate Node CLI (not in the React app)

Both methods need server-side API keys (Gemini, Google Cloud) that must never
ship to a browser. So the POC is a Node/TypeScript CLI. When a method proves
out, only its _outputs_ (the suggestions JSON) would flow into the website —
the keys stay server-side.

## The methods

**Method 1 — measure, then interpret.** `OBJECT_TRACKING` gives a quantitative
layer (bounding boxes, track IDs, timestamps → speeds, trajectories, counts).
We condense that to a compact JSON, pick key moments, and hand the video **plus
that JSON** to Gemini for the "what's wrong and why" layer. Two tools, chained:
one measures, one interprets.

**Method 2 — one video-native pass (TwelveLabs).** The plan's alternative to
Google's Video Intelligence API. Pegasus is a video foundation model that both
understands the clip (visual **and** audio) and writes the suggestions in a
single call — so there's no separate tracking layer and **no Gemini**. We
create/reuse an index with Pegasus enabled, upload + index the clip, then
`analyze` it with our prompt. TwelveLabs' free plan (600 min/month, no card)
makes this the cheapest path to a real test.

**Method 3 — reason directly.** Gemini Robotics-ER is built for spatial/physical
reasoning, so it gets the video and reasons about geometry and contact points
directly, no separate tracking layer.

**The FPS lever.** The screenshots in the plan were wrong partly because the app
sampled video at **1 FPS**. The API path lets us sample faster
(`GEMINI_VIDEO_FPS`, default 5) to catch fast mechanism motion.

## Setup

```bash
cd experiments/module-feedback
yarn install          # or npm install
cp .env.example .env  # then fill in keys (see the file's comments)
```

### Get a free TwelveLabs key (Method 2 — no credit card)

1. Sign up at **https://playground.twelvelabs.io** (Free plan is automatic).
2. Go to **https://playground.twelvelabs.io/dashboard/api-keys** → **Create API Key**.
3. Put it in `.env` as `TWELVELABS_API_KEY=...`.

The Free plan gives 600 minutes/month shared across indexing + analysis — plenty
for testing robot clips. The CLI auto-creates one reusable index on first run.

### Two one-command scripts (Method 2)

```bash
./1-set-key.sh                         # paste your TwelveLabs key when prompted
./2-analyze-video.sh ./my-robot.mp4    # analyze a clip (drag the file in to paste its path)
./2-analyze-video.sh demo              # offline demo — no key or video needed
```

`1-set-key.sh` writes the key into `.env` (gitignored). `2-analyze-video.sh`
checks the key is set, then runs Method 2 on your video.

## Usage

```bash
# Offline demo — no keys, no network. Shows the exact output shape.
yarn demo
#   └─ tsx src/cli.ts compare --mock

# Real runs (need .env filled in):
tsx src/cli.ts method2 --video ./samples/intake.mp4   # only needs a free TwelveLabs key
tsx src/cli.ts method1 --video ./samples/intake.mp4
tsx src/cli.ts method3 --video ./samples/intake.mp4
tsx src/cli.ts compare --video ./samples/intake.mp4   # runs all it has keys for

# Method 1 can also read a clip already in a bucket:
tsx src/cli.ts method1 --video gs://your-bucket/intake.mp4

# Inspect resolved config (no secrets printed):
tsx src/cli.ts config
```

Reports print to the console and are written to `output/` as JSON + Markdown
(pass `--no-write` to skip). `output/` and any local clips are gitignored.

### Simple web UI

A minimal browser interface — a prompt box, a video upload, and an **Engine**
picker to A/B **TwelveLabs (Pegasus)** vs **Gemini** on the same clip:

```bash
yarn ui        # → http://localhost:5178
```

Needs `TWELVELABS_API_KEY` and/or `GEMINI_API_KEY` in `.env` (whichever engine you
pick). Runs entirely on your machine — the key stays server-side; the only upload
is to the engine you choose. Both engines get the same prompt + DECODE game
context, so the comparison is fair. Edit the prompt, choose a clip, pick an
engine, click Analyze. See `ui/`.

### Gemini experiments (only need a Gemini key — no Google Cloud)

Two things you can run with just `GEMINI_API_KEY`, while Method 1's tracking pass
and Method 3 are being built:

```bash
# FPS sweep — the plan's core hypothesis ("1 FPS is why it's off; try 30 FPS").
# Runs the same clip through Gemini at several frame rates and reports the game-
# element count AND the exact token cost at each rate.
yarn gemini-fps --video ./samples/clip.mp4            # default 1,5,15,24 FPS
yarn gemini-fps --video ./samples/clip.mp4 --fps 1,10,24
yarn gemini-fps --mock                                # offline demo

# Method 3 (Gemini Robotics-ER) works with a plain Gemini key too:
tsx src/cli.ts method3 --video ./samples/clip.mp4
```

Read the sweep table yourself: does the element count get closer to the truth as
FPS rises, and is the extra cost worth it? That's the number that decides Method 1.

**Finding:** the plan targets 30 FPS, but Gemini's API caps video sampling at
**24 FPS** (`videoMetadata.fps` valid range is `(0, 24]`), so 24 is the practical
ceiling — the sweep clamps anything higher and warns.

**Free-tier note:** `gemini-3.5-flash` (the default, ~$1.50/1M input tokens) may be
paid-only. If your key is free-tier, set `GEMINI_ANALYSIS_MODEL=gemini-2.5-flash`
in `.env` (video-capable, cheaper, on the free tier).

## What each method needs

| | Method 1 | Method 2 | Method 3 |
|---|---|---|---|
| `GEMINI_API_KEY` | ✅ (analysis pass) | — | ✅ |
| GCP project + `GCS_BUCKET` + creds | ✅ (tracking pass) | — | — |
| `TWELVELABS_API_KEY` (free) | — | ✅ | — |
| Local video file | recommended¹ | ✅ required | ✅ required |

¹ Method 1 accepts a `gs://` URI, but Gemini's Files API needs a local upload;
with a `gs://` input it reasons over the tracking JSON only.

**Method 2 is the only one that needs a single, free, no-card key** — start there.

## Layout

```
src/
  cli.ts                 commander entry (method1 | method2 | method3 | compare | config)
  config.ts              env config + friendly credential checks
  types.ts               Suggestion / Measurement / AnalysisReport / tracking
  prompts.ts             the "Suggestions for Improvement" prompt contract
  gemini.ts              @google/genai client, video upload+FPS, JSON parsing
  gcs.ts                 upload local clip → gs:// URI
  twelvelabs.ts          twelvelabs-js client, index resolve, upload + index
  normalize.ts           model JSON → strict Suggestion/Measurement shapes
  report.ts              console + JSON/Markdown rendering
  methods/
    videoIntelligence.ts OBJECT_TRACKING pass → compact TrackingSummary
    method1.ts           tracking + Gemini pipeline
    method2.ts           TwelveLabs Pegasus pipeline
    method3.ts           Robotics-ER pipeline
  mock/fixtures.ts       offline fixtures for --mock
samples/                 drop robot clips here (gitignored)
```

## Cost note

Per the plan's pricing table: with Google's $300 new-account credit, early
testing is effectively free (Video Intelligence: first 1,000 min/month free;
Gemini Flash has a free tier). Frame rate sent to Gemini is the main cost lever.
