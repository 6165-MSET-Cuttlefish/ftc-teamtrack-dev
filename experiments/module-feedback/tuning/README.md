# tuning — fine-tune Gemini on our FTC clips

Full reasoning and open questions: [`PLAN.md`](./PLAN.md).
Where to put new data: [`data/inbox/`](./data/inbox/README.md).

Everything here is driven by one CLI, from the `experiments/module-feedback`
directory:

```bash
yarn install          # first time — adds ffmpeg-static + google-auth-library
yarn tuning --help
```

## The order to run things

```bash
# 1. Build the dataset. No cloud, no keys, no cost — safe to run right now.
yarn tuning prepare

# 2. Phase 2 baseline. Needs GEMINI_API_KEY only.
#    Do this BEFORE spending anything on a tuning job.
yarn tuning evaluate

# --- everything below needs a billed GCP project ---

yarn tuning upload           # clips → gs://
yarn tuning build-jsonl      # → train.jsonl / val.jsonl → gs://
yarn tuning tune             # submit the Vertex job
yarn tuning status           # poll; prints TUNED_MODEL_ENDPOINT when ready

# 3. Phase 5 verdict, after pasting TUNED_MODEL_ENDPOINT into .env
yarn tuning evaluate -c plain,fewshot,tuned
```

## What each step writes

| Path | From | What |
| --- | --- | --- |
| `data/prepared/*.mp4` | `prepare` | normalized 720p H.264, one per clip |
| `data/build/manifest.json` | `prepare` | every clip with its caption, split, size, duration |
| `data/build/uris.json` | `upload` | caption key → `gs://` URI |
| `data/build/train.jsonl` `val.jsonl` | `build-jsonl` | the tuning datasets |
| `data/build/eval.json` | `build-jsonl` | held-out clips, never trained on |
| `data/build/tuning-job.json` | `tune` | the submitted job resource |
| `data/build/eval/grading-*.md` | `evaluate` | the sheet you fill in by hand |

All of it is gitignored. Only `PLAN.md`, this README, the source, and
`data/inbox/captions.json` are tracked.

## Things that will bite you

- **Vertex silently drops over-length examples.** A job can report success
  having trained on half your data. `prepare` enforces the limits locally and
  prints what it dropped — read that output.
- **`mediaResolution` must match on every line** of train *and* val. Changing
  `TUNING_MEDIA_RESOLUTION` means rebuilding both, together.
- **The prompt scaffolding is part of the model.** `SYSTEM_INSTRUCTION` and
  `USER_PROMPT` in `src/prompts.ts` go into the training data *and* every
  inference call. Editing either one invalidates an existing tuned model.
- **Splits are content-addressed, not random.** A clip's split comes from a hash
  of its filename, so adding clips never reshuffles the existing eval set and
  invalidates your earlier baseline numbers. Renaming a file *does* move it.
- **The tuned model is a 2.5-flash; the baseline is a 3.5-flash.** Only Gemini
  2.5 is publicly tunable. `evaluate` runs both anyway, because that handicap
  *is* the question worth answering.
