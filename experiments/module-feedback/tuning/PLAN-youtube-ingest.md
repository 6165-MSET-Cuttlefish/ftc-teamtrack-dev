# Plan — YouTube ingest for training data

Turning FTC robotics playlists into training pairs, split across several
developers. Companion to [`TUNING.md`](../../../TUNING.md) and
[`PLAN.md`](PLAN.md); read those for the tuning pipeline itself.

Status: **proposed, not yet built.** Playlists TBD.

---

## 1. The core problem: a transcript is not a caption

We already tested this. Five YouTube transcripts were pulled into
`dev-videos/captions.json` earlier. Even after stripping greetings, team IDs and
sponsor ads, they were still wrong as labels:

| | Hand-written captions | Raw transcripts |
| --- | --- | --- |
| Length | ~118 chars | 642–849 chars |
| Voice | observation — *"top-down view of a gecko wheel and vector wheel intake taking in 3 balls"* | narration — *"I'd like to tell you about our drivetrain…"* |
| Grounding | only what's on screen | includes parts never shown |

`TUNING.md` is blunt about why that matters: *"Keep the style consistent across
every entry. Inconsistent phrasing is the fastest route to a mushy model."*

**So the transcript is evidence, not the answer key.** It contributes vocabulary
a vision model would otherwise miss — `Axon mini`, `goBILDA`, `vector wheels`,
`compliant wheels`, `surgical tubing`, gear ratios — while the caption itself
describes what is *visible*, in the team's house voice.

## 2. Three kinds of source video

Detected from duration + metadata at enumeration time:

**A. Shorts / short clips (≤ ~60s)** — usually one mechanism, one continuous
shot. The transcript, if any, describes roughly the whole clip. Lowest-effort
tier: one clip → one caption.

**B. Long-form (robot reveals, 3–20 min)** — covers drivetrain → intake →
shooter → turret → auto, in sequence. **One caption for the whole video is
worthless**; `TUNING.md` requires *"one mechanism per clip."* These must be
segmented before they're useful.

**C. No usable speech** (music-only b-roll) — no transcript signal. Vision-only
draft, or skip. Cheapest to skip if volume is high.

## 3. Pipeline

```
enumerate → download + timestamped VTT → classify → segment → draft → HUMAN REVIEW → train
```

**3.1 Enumerate.** `yt-dlp --flat-playlist` gives id / title / duration without
downloading. Output one committed manifest — this is also the work-split ledger
(§5).

**3.2 Download.** Video (≤1080p mp4) plus subtitles **with timestamps kept**.
The earlier pass flattened VTT to prose; here the cue times are the whole point.
Filenames are the YouTube ID so every developer produces identical names.

**3.3 Segment (long-form only).** Feed the *timestamped* transcript to Gemini and
ask for `{startSec, endSec, mechanism}` spans — one per mechanism discussed.
Text-only, so it costs ~nothing. Keyword matching on mechanism nouns is the
fallback when there's no speech.

Two ways to realise a segment, and we should use both:
- **`videoMetadata.startOffset/endOffset`** in the tuning JSONL — reference a
  span of the original file without cutting it. Confirmed supported in tuning.
- **Physically cut with ffmpeg** — needed anyway for the human review UI, which
  plays one file per caption.

**3.4 Draft a caption per segment.** Gemini watches the segment (at high
inference FPS — that *is* available) and receives:
- that segment's transcript text, as vocabulary evidence
- ~10 existing hand-written captions as few-shot style anchors
- the DECODE game context we already maintain (`ui/decode-context.md`)

and returns a caption in house style: mechanism type first, observational, ~120
chars. Explicitly instructed to describe only what's visible and to ignore
anything the speaker mentions off-screen.

**3.5 Human review — non-negotiable.** Drafts land in the existing captioning UI
(`/dev/videos`) for approve/edit. Training on unreviewed model output means the
model learns from a model; the caption is the answer key and a human has to own
it. Realistically ~20–30s per clip to accept or fix, which is far faster than
writing from scratch.

**3.6 Only approved captions enter training.** Drafts are marked as such until a
human clears them (§4).

## 4. Provenance — track where every caption came from

Mixing hand-written, transcript-derived, and model-drafted captions without
tracking which is which is how the dataset silently goes mushy. Every caption
gets a source tag:

```json
{ "caption": "...", "source": "human" | "draft" | "transcript", "reviewed": true }
```

`prepare` should be able to filter — e.g. train on `reviewed: true` only. This
also finally answers the open question about the 6 existing transcript captions:
tag them `transcript`, and decide by experiment rather than argument.

## 5. Splitting the work across developers

Four failure modes to design against, three of which already bit us this session:

**a) Duplicate downloads.** Solved by a committed assignment manifest — every
video ID is assigned to exactly one developer up front, in contiguous ranges.

**b) `captions.json` merge conflicts.** Three collisions so far; one silently
**deleted 14 captions** because someone resolved by taking one side. With several
developers this becomes routine. **Fix: one file per video** —
`tuning/data/captions/<video-id>.json`. Git then never merges the same file, and
the failure mode disappears structurally rather than by discipline.

**c) Videos never reaching each other.** This is the big one. Today: **100
captions but only 55 trainable pairs**, because captions are committed and videos
are gitignored, so each person's footage stays on their laptop. Scaling that up
just makes a bigger pile of orphans. **A shared video store (Drive/S3), keyed by
the same YouTube-ID filenames, is a prerequisite, not a nice-to-have.**

**d) Style drift between annotators.** Different humans write different captions.
Mitigate with a short style guide + the few-shot anchors + one person doing a
final consistency pass.

**Assignment manifest** (committed, single source of truth):

```json
{ "videoId": "iZT_aNIQRX0", "title": "...", "durationSec": 84,
  "kind": "long", "assignee": "alice", "status": "todo" }
```

Each developer gets a generated `HANDOFF-<name>.md` addressed to their Claude,
containing only their slice, the setup steps, the style guide, and the escalation
rules. Same structure as the existing [`HANDOFF.md`](../../../HANDOFF.md).

## 6. FPS — what's actually possible

**You cannot set FPS for tuning.** The tuning JSONL exposes `mediaResolution`
and `videoMetadata.startOffset/endOffset` only; the `fps` field available at
inference is not accepted. Assume Vertex samples at its default (~1 FPS).

What we *can* do, in order of value:

1. **Tight segments.** A 12-second clip of one intake cycle gets ~12 sampled
   frames all showing the mechanism. A 15-minute reveal gets ~1 frame per
   mechanism-second and wastes the rest on faces and pit tables. Segmenting is
   the single biggest win in effective temporal resolution.
2. **Slow-motion re-encode.** `ffmpeg -filter:v "setpts=4*PTS"` turns a 2-second
   intake grab into 8 seconds — at fixed ~1 FPS sampling that's 4× the frames of
   the actual event. This is the closest thing to "training at higher FPS."
   Costs 4× the tokens for that clip; only worth it for fast mechanisms.
3. **`MEDIA_RESOLUTION_MEDIUM`** (256 tokens/frame vs 64) buys *spatial* detail,
   not temporal — useful for small parts like wheel surfaces. It caps clips at
   5 min instead of 20 and costs 4× per frame. Must be identical on every JSONL
   line.
4. **Inference FPS is separate and free to tune.** `videoMetadata.fps` up to 24
   works at inference. The `gemini-fps` command already in this repo sweeps
   1/5/15/24 FPS and reports quality vs token cost — **run it before choosing**,
   rather than guessing.

⚠️ **Train/inference mismatch.** If we train at ~1 FPS and serve at 24, the model
sees a different frame distribution than it learned on. Worth measuring; the
sweep gives us the data.

## 7. Sequencing

1. Agree the plan; get the playlist URLs.
2. Enumerate → assignment manifest → per-developer handoffs.
3. **Run the `plain` vs `fewshot` baseline that still hasn't run.** It costs
   cents and may show tuning isn't needed at all. Doing large-scale ingest before
   that gate is backwards.
4. Build the ingest tooling; pilot on ~10 videos across both kinds.
5. Review the pilot captions by hand. If drafts need heavy editing, fix the
   prompt before scaling to hundreds.
6. Scale out, gather footage into shared storage, then retrain.

## 8. Open questions for the team

- Which playlists, and roughly how many videos?
- How many developers, and their names for the assignment split?
- Where does shared video storage live? (Drive is fine; it just has to exist.)
- Are we accepting other teams' robots as training data, or only our own?
- Budget ceiling for Vertex, and who approves spending it? Billing is currently
  unlinked at the user's request.
