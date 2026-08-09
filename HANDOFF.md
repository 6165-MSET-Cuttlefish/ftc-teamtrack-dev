# Handoff — FTC module-feedback fine-tuning

**To the next Claude picking this up.** Written 2026-08-09 by the previous session.
Everything below was true when written. **Verify before you act on it** — files
move, teammates push, and at least one thing in here is a judgment call I'd rather
you make yourself than inherit.

Branch: `experiment/module-feedback-poc`. Working tree was clean and pushed.
The operator manual is [`TUNING.md`](TUNING.md); the rationale is
`experiments/module-feedback/tuning/PLAN.md`. Read TUNING.md first — this file
only covers what it doesn't say.

---

## The goal

Fine-tune a model to watch a short clip of one FTC robot mechanism and describe it
in the team's own build vocabulary — "hinged intake, full-width, vector wheels on
ends, compliant wheels in middle, intakes well from middle." The training pairs
are `video file → caption`.

---

## Read this first: it's 55 examples, not 100

The team has **100 captions** but only **55 trainable examples**, and the gap is
the single most important fact here.

```
captions in dev-videos/captions.json ...... 100
video files on the previous machine ....... 55
├─ caption + video both present ........... 55   ← the only trainable pairs
└─ captions whose video is missing ........ 45   ← useless until the file turns up
```

Training needs the **pair**. A caption alone is nothing — the video is the input.
Those 45 orphans exist because captions are committed to git but **videos are
gitignored**, so every teammate's labels sync while their footage stays on their
own laptop.

**This is the highest-value work available.** Collecting the 45 missing videos
takes the dataset from 55 → ~100, which is exactly the threshold Google
recommends and that `prepare` currently warns about. That is worth far more than
writing new captions or tweaking hyperparameters. Ask the user who has the files;
a shared Drive folder keyed by the same filenames would fix it permanently.

Verify the current split yourself:

```bash
cd experiments/module-feedback && npm run tuning -- prepare
```

---

## State

**Done and verified**
- Google Cloud setup complete on the previous machine (auth, project
  `teamtrack-502602`, APIs, bucket `gs://teamtrack_module_feedback`).
- `prepare` → 55 clips, 83 MB, split 35 train / 7 val / 13 eval.
- `upload` + `build-jsonl` → datasets in GCS.
- A **schema bug is fixed and pushed** (see below).
- 14 captions that a bad merge had deleted were recovered from git history.

**Not done**
- **The baseline `evaluate` has never successfully run.** It failed on a dead
  Gemini API key, then a fresh key was added but the baseline was never re-run.
- No tuning job has ever completed. Two attempts: one failed on the schema bug,
  one ran 4½ minutes and was cancelled by the user over cost.
- There is no tuned model and no `TUNED_MODEL_ENDPOINT`.

---

## ⚠️ Billing is OFF — do not turn it back on by yourself

The user explicitly asked to remove all charging. Confirmed state:

```
teamtrack-502602 → billingEnabled: false
projects on billing account 01ECFD-8526A4-D67A42 → none
```

Vertex tuning **cannot run** in this state, by design. Re-linking is one command
and it means real money:

```bash
gcloud billing projects link teamtrack-502602 --billing-account=01ECFD-8526A4-D67A42
```

**Get explicit human approval before running that.** The user was surprised that
training cost money, and cancelled a job mid-flight because of it. Do not treat
"continue the tuning work" as consent to spend. Also note the charge lands on the
*billing account*, not on whoever's Google login submits the job.

The website is a different project (`teamtrack-572e5`) and is unaffected by any
of this.

---

## The gate you must not skip

TUNING.md says it, and the previous session got it wrong:

> Run the baseline **first**. If few-shot prompting already matches the caption
> style, you don't need tuning at all.

The previous session submitted a paid tuning job while the baseline was broken,
so there was nothing to compare against. Don't repeat that. The verdict rule is
**ship the tuned model only if it beats `fewshot`** — beating the plain prompt
proves nothing.

The baseline needs only a Gemini API key (cents, no GCP billing):

```bash
cd experiments/module-feedback
npm run tuning -- evaluate          # writes tuning/data/build/eval/grading-*.md
```

A human grades that sheet 0–2 per criterion. It may well show tuning is
unnecessary — which is the cheapest possible outcome.

---

## Bug already fixed — don't rediscover it

The first job died in ~87s with:

```
Cannot find field: mediaResolution in message cloud.ai.platform.llm.GeminiTuneExample
```

`mediaResolution` was being written as a **top-level** field of each JSONL line.
Vertex requires it inside `generationConfig`. Fixed at
`experiments/module-feedback/tuning/src/buildJsonl.ts` (~line 50), rebuilt, and
the next job reached `JOB_STATE_RUNNING`. The fix is on origin — confirm it's
still there before submitting anything:

```bash
grep -n "generationConfig" experiments/module-feedback/tuning/src/buildJsonl.ts
```

The value must be **identical on every line of train and val**, so always rebuild
both together with `build-jsonl`.

---

## Hardware / local training

The new machine reportedly has **~13 GB RAM**. Check it (`sysctl hw.memsize`,
`sw_vers`) rather than trusting that.

If the plan is to train **locally instead of paying for Vertex**, be straight with
the user about the tradeoffs:

- **Gemini cannot be trained locally.** Closed weights. Fine-tuning it is
  Vertex-only and paid — free tuning was removed from the Gemini API/AI Studio
  when Gemini 1.5 Flash-001 was deprecated.
- An **open** video-language model can be fine-tuned locally. On Apple Silicon,
  [MLX-VLM](https://github.com/Blaizzy/mlx-vlm) does LoRA/QLoRA on VLMs including
  video. On ~13 GB, expect to be limited to a small model (~2–3B, 4-bit) with few
  frames per clip.
- **Free cloud GPU is probably better than local**: Colab (T4 16 GB) or Kaggle
  (~30 GPU-hrs/week). Same code, no thermal limits, still $0.
- Set expectations honestly: a 2–3B open model fine-tuned on 55 clips is
  **unlikely to beat few-shot-prompted Gemini** on FTC vocabulary. If the real
  goal is good output rather than owning the weights, run the baseline first.

---

## Calls I'm leaving to you

Make these yourself, with the user — don't just inherit my opinion.

1. **The 6 YouTube transcript captions.** Clips whose captions came from YouTube
   auto-transcripts (filenames ending in a YouTube ID, e.g.
   `..._iZT_aNIQRX0.mp4`) run 642–849 chars of teams *narrating design intent*,
   sometimes describing parts not on screen. The hand-written captions are ~118
   chars of pure observation. TUNING.md warns that mixed style is "the fastest
   route to a mushy model." I'd cut them from training; 6 clips isn't worth
   muddying 55. Your call — look at them and decide.
2. **Dataset skew.** ~36 of 55 are intakes; shooters, spindexers, drivetrain are
   thin. 25 of 55 mention a failure case, which is healthier than expected.
3. **Whether to train at all yet**, given 55 examples and an unrun baseline.
4. **`captions.json` merge conflicts.** Three collisions happened; one silently
   deleted 14 captions because someone resolved by taking one side. **Always
   union-merge** — and after any merge, check the count didn't drop. A durable
   fix is one file per video (`captions/<name>.txt`) so git never merges the same
   file; that was proposed and not done.

---

## Quick reference

```bash
cd experiments/module-feedback

npm run tuning -- prepare       # free, local. transcodes + splits + validates
npm run tuning -- evaluate      # cents. baselines — RUN THIS FIRST
npm run tuning -- upload        # GCS (needs billing)
npm run tuning -- build-jsonl   # GCS (needs billing)
npm run tuning -- tune          # $$$ — needs explicit human approval
npm run tuning -- status        # free. poll the job
```

If `gcloud` isn't found: `export PATH="/opt/homebrew/share/google-cloud-sdk/bin:$PATH"`

---

## What the previous session got wrong

So you can do better, not just differently:

- **Submitted a paid job without a working baseline.** The comparison is the
  entire point; without it a tuned model is unjudgeable.
- **Didn't flag the cost clearly enough up front.** "Start training" was taken as
  consent to spend; the user hadn't understood Vertex bills per training token
  and cancelled mid-run. Say the number out loud *before* submitting.
- **Published an artifact without asking** (unrelated to tuning, earlier in the
  session). This user wants to be asked before anything leaves their machine.
  TwelveLabs/Gemini uploads they've already opted into are fine.
