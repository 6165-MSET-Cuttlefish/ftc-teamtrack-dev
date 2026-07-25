# Fine-tuning Gemini for FTC module feedback — plan

Goal: a Gemini model that watches a clip of an FTC mechanism and writes feedback
in **our** style and vocabulary ("full-width intake", "vector wheels on the ends",
"intakes well from the middle", "hinged"), instead of generic
"the robot appears to be picking up an object" LLM output.

This folder is the tuning track. It sits beside the existing prompt-based
methods in `experiments/module-feedback/src/methods/`, and reuses the same
clips in `dev-videos/`.

---

## Phase 0 — What we have today (already checked)

| Thing | State |
| --- | --- |
| Clips | 29 files in `dev-videos/` (`.mov`/`.mp4`), 305 MB total, largest 69 MB |
| Transcoded copies | 18 in `dev-videos/_transcoded/` (`<name>.mov.mp4`) |
| Captions | 30 entries in `dev-videos/captions.json`, avg **21 words** |
| Alignment | Every video has a caption. One caption key, `20251203_190621_1.mp4`, has **no matching file** — either the file is missing or it was renamed to one of the `VID-2025120*` files. Needs a decision in Phase 2. |

Two gaps to close before any tuning job is worth running:

1. **Volume.** Google's guidance for supervised tuning is to start around
   **100 examples**. We have 30. Below that the job will run but is likely to
   overfit to 30 clips of intakes rather than learn a style.
2. **Task mismatch — this is the important one.** The captions are *descriptive
   labels* ("not full-width intake, rubber band roller, intakes well from
   middle"). The stated goal is *feedback* — suggestions for improvement. If we
   tune on the captions as they are, we get a model that **describes** in FTC
   vocabulary. That is genuinely useful, but it is not the same deliverable.
   Phase 1 forces this choice.

---

## Phase 1 — Decide what the tuned model outputs

Pick one before writing a single line of the dataset. The captions you upload
next have to *be* the target output, verbatim.

### Option A — Tune the **observation** layer (recommended first)

- Target output = FTC-vocabulary description, i.e. what `captions.json` already
  contains.
- The "suggestions for improvement" layer stays in the prompt, running on the
  tuned model's description (or as a second call).
- **Why first:** your existing 30 captions are already valid training targets.
  Zero re-authoring. You only need more clips, not more writing per clip.
- This is where a tuned model actually beats prompting — vocabulary, house
  terminology, and consistent structure are exactly what SFT is good at.

### Option B — Tune the **feedback** layer directly

- Target output = full critique: observations + concrete mechanical suggestions,
  in the voice you want the product to speak in.
- Requires rewriting all 30 captions into full feedback paragraphs and writing
  ~70+ more. That is the real cost: roughly 100 × (a careful paragraph per clip).
- Best done **after** A proves the pipeline works, and after Phase 2 shows what
  prompting alone can't do.

### Option C — One model, structured output

- Target = a JSON object with both layers:
  ```json
  {
    "mechanism": "intake",
    "observations": ["full-width", "vector wheels on ends", "hinged"],
    "performance": "intakes well from middle, struggles at edges",
    "suggestions": ["..."]
  }
  ```
- Cleanest for wiring into the TeamTrack UI later, hardest to author.
- If you want this eventually, author the captions in this shape **now** —
  converting free text to JSON later is a second labeling pass.

> **Decision needed from you.** Default assumption if you say nothing: **Option A**,
> using `captions.json` as-is.

---

## Phase 2 — Baseline first (do not skip)

Before spending on a tuning job, measure the thing tuning has to beat.

1. Hold out **6 clips** (20%) as an eval set. Never put them in training.
2. Run the existing `experiments/module-feedback` Gemini path on those 6 with a
   plain prompt → record outputs.
3. Run again with **few-shot prompting**: stuff 8–10 of the training captions
   into the prompt as examples.
4. Grade all three (plain / few-shot / later: tuned) against the human caption.

Grading rubric — score each 0–2, by hand, in a spreadsheet:

- Uses correct FTC vocabulary (full-width, wedges, compliant/vector wheels, hinged)
- Gets the mechanism facts right (roller type, width, wedge shape)
- Judges performance correctly (intakes well from middle vs. edges)
- No hallucinated parts

**If few-shot prompting scores close to the human captions, stop here.** Tuning
costs money and a maintenance burden; prompting may be enough for 30-clip
vocabulary. Few-shot is also the honest control condition — a tuned model that
only ties few-shot is not a win.

Also resolve the orphaned caption key in this phase.

---

## Phase 3 — Build the dataset

### Hard constraints from Vertex AI (verified against current docs)

| Constraint | Value |
| --- | --- |
| Videos per training example | **1** |
| Max length @ `MEDIA_RESOLUTION_LOW` | 20 min |
| Max length @ `MEDIA_RESOLUTION_MEDIUM` | 5 min |
| File size | chunk to **≤ 100 MB** |
| `mediaResolution` | must be **identical on every line** of train + validation |
| Over-length examples | silently **dropped** (not billed, not trained on) |
| Storage | videos referenced by `gs://` URI — must live in GCS, not locally |
| Format | JSONL, one example per line |

Notes for our clips specifically:

- `WIN_20260130_17_49_44_Pro.mp4` (69 MB) and
  `Movie_on_1-29-26_at_5.46_PM.mov` (63 MB) are under 100 MB but worth
  re-encoding down anyway — transcode cost is zero, upload time is not.
- `.mov` is not a safe `mimeType`. **Transcode everything to `video/mp4`** —
  the `_transcoded/` cache already does this for 18 clips; extend it to all.
- Use `MEDIA_RESOLUTION_LOW` (64 tokens/frame). Our clips are short and the
  signal (roller type, wedge shape, full-width or not) survives low res. It is
  also the documented recommendation for efficiency on 2.0+ models.

### JSONL shape

```jsonc
{
  "systemInstruction": {
    "role": "system",
    "parts": [{ "text": "<the same system prompt used at inference time>" }]
  },
  "contents": [
    {
      "role": "user",
      "parts": [
        { "fileData": { "mimeType": "video/mp4", "fileUri": "gs://BUCKET/clips/IMG_3221.mp4" } },
        { "text": "Describe this FTC mechanism." }
      ]
    },
    {
      "role": "model",
      "parts": [{ "text": "Intake with alternating surgical tubing and compliant wheels, curved wedges on sides of intake, not full-width, good at intaking from middle" }]
    }
  ],
  "mediaResolution": "MEDIA_RESOLUTION_LOW"
}
```

Two rules that matter more than they look:

- The `systemInstruction` and the user `text` must be **byte-identical to what
  you will send at inference time**. A tuned model is sensitive to the prompt
  scaffolding it was trained under.
- Keep the user text short and constant. The video carries the signal; the text
  is just the task marker.

### Scripts — **built**, see [`README.md`](./README.md)

| Command | Job | Status |
| --- | --- | --- |
| `yarn tuning prepare` | merge caption sources → normalize to mp4 → enforce Vertex limits locally → `manifest.json` | ✅ run against the 29 clips |
| `yarn tuning upload` | push clips to `gs://<bucket>/…/clips/`, emit the URI map | ✅ needs GCP to exercise |
| `yarn tuning build-jsonl` | emit `train.jsonl` / `val.jsonl`, hold the eval split out of both | ✅ format verified |
| `yarn tuning tune` / `status` | submit + poll the Vertex SFT job | ✅ needs GCP to exercise |
| `yarn tuning evaluate` | run plain / fewshot / tuned over the eval clips → hand-grading sheet | ✅ needs a Gemini key to exercise |

They reuse the POC's `src/config.ts`, `src/logger.ts` and `src/gemini.ts`.

**First run result** (`prepare`, 29 clips): 305 MB → 27 MB after normalization,
every clip 1–43 s, nothing near the 100 MB or 20 min caps. Split came out
**18 train / 3 val / 8 eval**. The eval share is high because splits are
content-addressed for stability rather than proportioned exactly; it self-corrects
as clips are added. The one orphaned caption key was reported as a warning.

---

## Phase 4 — Run the tuning job

Prerequisites — **note this is a real blocker**: video tuning is **Vertex AI
only**, so it needs a GCP project with **billing enabled**, not the free Gemini
API key path. The POC README notes the Gemini key was blocked at one point;
that needs sorting before this phase. Method 2 (TwelveLabs) is unaffected and
remains the $0 fallback.

- Base model: **`gemini-2.5-flash`** — cheapest capable tunable model, and the
  right target for a per-clip feature that may run often.
- Set **`thinkingBudget: 0`** when tuning and serving 2.5 Flash. Documented
  recommendation for tuned thinking models; also cuts cost.
- Leave epochs on the Vertex default — it auto-adjusts to dataset size.
- Turn on the validation set so you get a loss curve. **Watch for validation
  loss rising while training loss falls** — with ~100 short examples, overfitting
  is the expected failure mode, not underfitting.
- Expect to run this **more than once**. Budget for 2–3 jobs.

---

## Phase 5 — Evaluate honestly

Run `eval.ts` over the 6 held-out clips and fill in the same rubric from Phase 2.
Three columns: plain prompt / few-shot prompt / tuned model.

Ship the tuned model only if it beats **few-shot**, not just plain. Record the
numbers in this folder — a result table is the whole point of an experiment.

---

## Phase 6 — Wire into TeamTrack

Only after Phase 5. Same shape as the rest of the POC: keys stay server-side,
only the resulting JSON reaches the browser. The tuned model endpoint is a
drop-in swap for the model ID in `src/gemini.ts`.

---

## Your move — where to upload

Drop new clips and captions here:

```
experiments/module-feedback/tuning/data/inbox/
```

See `data/inbox/README.md` for the exact format. Short version:

- Clips: `.mp4` preferred, any filename, one mechanism per clip.
- Captions: `captions.json`, `{ "<exact filename>": "<target output text>" }`.
- Aim for **100+** total (you have 30 — so ~70 more).
- **The caption text is what the model will learn to say.** Write it in the
  final voice you want, per your Phase 1 choice.

Videos in that folder are gitignored; the captions file is tracked.

### Two things that will improve the result more than any hyperparameter

1. **Mechanism variety.** 25 of 30 captions are intakes. A model tuned on that
   will call a hanger an intake. Add shooters, transfers, spindexers, hangers,
   drivetrains — and label the mechanism type in the caption.
2. **Negative examples.** Most captions describe things that work. Include clips
   of mechanisms that jam, miss, or fail, with captions saying so. Without them
   the model learns that the answer is always "intakes well from middle."

---

## Infrastructure status (verified)

GCP project `teamtrack-502602`, bucket `gs://teamtrack_module_feedback` (US
multi-region). Billing enabled, `aiplatform` + `storage` APIs on, ADC present.
`prepare` → `upload` → `build-jsonl` all run clean against it: 29 clips and both
datasets are in the bucket.

**Not yet run:** `tune` (see the clip-count problem below) and `evaluate` (the
Gemini API key in `.env` returns `API_KEY_INVALID`).

## Where this stands right now

Built and verified locally: the full pipeline, plus a first `prepare` run over
the existing 29 clips. Phase 1 is implemented as **Option A** (the default) —
switching to B or C is a change to the caption *text* you upload plus the
`SYSTEM_INSTRUCTION` in `src/prompts.ts`, not a change to the pipeline.

**Next action that costs nothing:** `yarn tuning evaluate` — the Phase 2
baseline, which needs only the existing `GEMINI_API_KEY`. Everything past
`upload` is blocked on a billed GCP project.

## Open questions for you

1. Phase 1: Option A, B, or C?
2. Is there a GCP project with billing available, or does that need setting up?
3. `20251203_190621_1.mp4` — missing file, or a renamed one?
4. Realistic clip ceiling — can you get to 100, or is 50 the honest number?
   (If 50, we stay on few-shot prompting and revisit.)

## Sources

- [About supervised fine-tuning for Gemini models](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models/gemini-supervised-tuning)
- [Video tuning](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/tuning/video)
- [Tune Gemini models by using supervised fine-tuning](https://cloud.google.com/vertex-ai/generative-ai/docs/models/gemini-use-supervised-tuning)
- [How to fine-tune video outputs using Vertex AI (Google Cloud blog)](https://cloud.google.com/blog/products/ai-machine-learning/how-to-fine-tune-video-outputs-using-vertex-ai)
