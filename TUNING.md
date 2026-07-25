# Fine-tuning Gemini for FTC module feedback — operator guide

Everything you need to connect Google Cloud, run a tuning job, and read the
results. This is the "how", start to finish. The "why" — the design decisions,
the open questions, the phase plan — lives in
[`experiments/module-feedback/tuning/PLAN.md`](experiments/module-feedback/tuning/PLAN.md).

All commands run from **`experiments/module-feedback/`**:

```bash
cd experiments/module-feedback
```

---

## The accounts and resources involved

| Thing | Value | Notes |
| --- | --- | --- |
| GCP project | `teamtrack-502602` | The tuning project. **Not** the website. |
| GCS bucket | `gs://teamtrack_module_feedback` | **Underscores**, not hyphens. US multi-region. |
| Billing account | `01ECFD-8526A4-D67A42` | Only `teamtrack-502602` is linked to it. |
| Vertex region | `us-central1` | Set by `VERTEX_LOCATION`. |
| Base model | `gemini-2.5-flash` | Only Gemini 2.5 is publicly tunable. |
| Google account | `msetcuttlefish6165@gmail.com` | The account with access to the project. |

> **The website is a separate project.** TeamTrack's Firebase project is
> `teamtrack-572e5` (see `.firebaserc`). Nothing in this guide can affect the
> live site, its Firestore, or its hosting. Disabling billing on
> `teamtrack-502602` is safe for the website.

---

## Part 1 — One-time setup

Skip any step that already passes its check.

### 1.1 Install the Google Cloud SDK

```bash
brew install --cask google-cloud-sdk
```

Check: `gcloud --version`

### 1.2 Log in as the right Google account

```bash
gcloud auth login
```

A browser opens. **Pick `msetcuttlefish6165@gmail.com`** — if you're signed into
another Google account, use "Add account" or switch first. Authorizing the wrong
identity is the most common failure here, and it fails later with confusing
permission errors rather than at login.

Check: `gcloud auth list` shows that address as `ACTIVE`.

### 1.3 Point the SDK at the project

```bash
gcloud config set project teamtrack-502602
```

Check: `gcloud config get-value project` → `teamtrack-502602`

### 1.4 Set up credentials for the code

This is **separate from step 1.2**. `gcloud auth login` authorizes the `gcloud`
command; this authorizes the Node libraries that actually do the work.

```bash
gcloud auth application-default login
gcloud auth application-default set-quota-project teamtrack-502602
```

Check: `ls ~/.config/gcloud/application_default_credentials.json`

### 1.5 Confirm billing, APIs, and the bucket

```bash
# Should print: True  billingAccounts/01ECFD-8526A4-D67A42
gcloud billing projects describe teamtrack-502602 \
  --format="value(billingEnabled,billingAccountName)"

# Should already be enabled; harmless to re-run
gcloud services enable aiplatform.googleapis.com storage.googleapis.com

# Should print the bucket and US
gcloud storage buckets describe gs://teamtrack_module_feedback \
  --format="value(name,location)"
```

If `billingEnabled` is `False`, tuning will refuse to run. Link a billing account
at [console.cloud.google.com/billing](https://console.cloud.google.com/billing).

### 1.6 Install project dependencies

```bash
cd experiments/module-feedback
npm install          # or: yarn install
```

### 1.7 Fill in `.env`

`experiments/module-feedback/.env` (gitignored — create from `.env.example` if
missing). These should already be set:

```bash
GOOGLE_CLOUD_PROJECT=teamtrack-502602
GCS_BUCKET=teamtrack_module_feedback
TUNING_BUCKET=teamtrack_module_feedback
VERTEX_LOCATION=us-central1
TUNING_BASE_MODEL=gemini-2.5-flash
TUNING_MEDIA_RESOLUTION=MEDIA_RESOLUTION_LOW
```

A **Gemini API key** is only needed for the untuned baselines in `evaluate` —
nothing else in the tuning pipeline uses it. To set one:

```bash
./set-gemini-key.sh          # prompts for the key, writes it to .env
```

Get a key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey).

---

## Part 2 — Adding training data

Drop clips and captions in **`experiments/module-feedback/tuning/data/inbox/`**:

```
inbox/
  captions.json      <- tracked in git
  IMG_1234.mp4       <- gitignored
```

`captions.json` maps filename → the exact text you want the model to produce:

```json
{
  "IMG_1234.mp4": "hinged intake, full-width, vector wheels on ends, compliant wheels in middle, intakes well from middle"
}
```

Rules that matter:

- **The caption is the answer key**, not a note to yourself. Write it in the
  voice you want the model to speak in.
- Keep the style consistent across every entry. Inconsistent phrasing is the
  fastest route to a mushy model.
- One mechanism per clip. The model can only be told one answer per video.
- Start with the mechanism type (`intake`, `shooter`, `transfer`, `spindexer`,
  `hanger`, `drivetrain`).
- Filenames must match caption keys exactly, including extension.

The 30 existing captions in `/dev-videos/captions.json` are picked up
automatically — leave them where they are. Both sources get merged.

**Targets:** ~100 clips total (29 usable today), a mix of mechanisms (25 of 30
are currently intakes), and **failure cases** — jams, misses, drops — with
captions saying so. Without negatives the model learns the answer is always
"intakes well from middle."

---

## Part 3 — Running it

### Cost summary

| Command | Cost |
| --- | --- |
| `prepare` | free — fully local |
| `evaluate` (plain/fewshot) | cents — Gemini API |
| `upload`, `build-jsonl` | fractions of a cent — GCS storage |
| **`tune`** | **the real cost — billed per training token** |
| `status` | free |
| `evaluate -c tuned` | cents — Vertex inference |

Only `tune` is meaningfully expensive. Check current rates at
[Vertex AI pricing](https://cloud.google.com/vertex-ai/generative-ai/pricing),
and budget for 2–3 jobs — the first run is rarely the one you keep.

### Step 1 — Prepare the dataset (free, local)

```bash
npm run tuning -- prepare
```

Merges caption sources, validates every caption has a file and vice versa,
transcodes everything to 720p H.264 mp4, and enforces the Vertex limits locally.

**Read this output.** Vertex silently *drops* over-length examples — a job can
report success having trained on half your data. This step catches that first.
It also prints the train/val/eval split and warns if you're under ~100 examples.

Last run: 29 clips, 305 MB → 27 MB, split 18 train / 3 val / 8 eval.

### Step 2 — Baseline before you spend anything

```bash
npm run tuning -- evaluate
```

Runs the held-out eval clips through two untuned conditions — a plain prompt and
a **few-shot** prompt seeded with training captions — and writes a grading sheet
to `tuning/data/build/eval/grading-<timestamp>.md`.

Grade it by hand, 0–2 per criterion. **If few-shot already matches your caption
style, stop — you don't need tuning at all.** Few-shot is the control that
matters; a tuned model that only beats the *plain* prompt has proven nothing.

### Step 3 — Upload to GCS

```bash
npm run tuning -- upload
npm run tuning -- build-jsonl
```

`upload` pushes clips to `gs://teamtrack_module_feedback/module-feedback/tuning/clips/`
(skipping any already there at the same size). `build-jsonl` writes `train.jsonl`
and `val.jsonl` to `…/tuning/datasets/`, holding the eval split out of both.

### Step 4 — Submit the tuning job **(this costs money)**

```bash
npm run tuning -- tune
```

Optional flags: `--epochs <n>`, `--lr-multiplier <n>`, `--adapter-size <size>`,
`--wait` to poll until it finishes. Leave them off by default — Vertex
auto-selects an epoch count based on dataset size.

The job resource is saved to `tuning/data/build/tuning-job.json`.

### Step 5 — Watch it

```bash
npm run tuning -- status
```

Tuning takes anywhere from tens of minutes to hours. When it succeeds, this
prints a line to paste into `.env`:

```
TUNED_MODEL_ENDPOINT=projects/…/locations/us-central1/endpoints/…
```

It also prints a link to the Vertex experiment with the loss curves. **Look for
validation loss rising while training loss falls** — that's overfitting, the
expected failure mode with a small dataset. If you see it, retrain with fewer
epochs or more data rather than shipping the model.

You can also watch it in the console:
[Vertex AI → Tuning](https://console.cloud.google.com/vertex-ai/generative/language/tuning?project=teamtrack-502602)

### Step 6 — Get the results

With `TUNED_MODEL_ENDPOINT` set in `.env`:

```bash
npm run tuning -- evaluate -c plain,fewshot,tuned
```

Writes a three-column grading sheet to
`tuning/data/build/eval/grading-<timestamp>.md`, plus raw JSON alongside it.

**The verdict rule: ship the tuned model only if it beats `fewshot`.** Note the
comparison is deliberately unfair to tuning — the baselines run
`gemini-3.5-flash` while the tuned model is necessarily a `gemini-2.5-flash`,
because only 2.5 is publicly tunable. That handicap *is* the question: does a
tuned smaller model beat a prompted bigger one on our vocabulary?

Record the numbers in `tuning/PLAN.md`. A result table is the entire point.

---

## What gets written where

| Path | From | Contents |
| --- | --- | --- |
| `tuning/data/prepared/*.mp4` | `prepare` | normalized clips |
| `tuning/data/build/manifest.json` | `prepare` | every clip: caption, split, size, duration |
| `tuning/data/build/uris.json` | `upload` | filename → `gs://` URI |
| `tuning/data/build/train.jsonl` `val.jsonl` | `build-jsonl` | the tuning datasets |
| `tuning/data/build/eval.json` | `build-jsonl` | held-out clips |
| `tuning/data/build/tuning-job.json` | `tune` | the job resource |
| `tuning/data/build/eval/grading-*.md` | `evaluate` | the sheet you grade |

All gitignored. Tracked: `PLAN.md`, the READMEs, the source, and
`tuning/data/inbox/captions.json`.

---

## Troubleshooting

**`API key not valid` / `API_KEY_INVALID`** — the Gemini key in `.env` is
rejected. This is "key not recognized," not a quota or model-access problem, so
switching models won't help. Get a fresh key and re-run `./set-gemini-key.sh`.
Only affects `evaluate`'s untuned baselines.

**`Missing GOOGLE_CLOUD_PROJECT…`** — `.env` isn't filled in, or you're running
from the wrong directory. Commands must run from `experiments/module-feedback/`.

**Permission denied on the bucket or Vertex** — you're probably authenticated as
the wrong Google account. Check `gcloud auth list` and redo steps 1.2 and 1.4.

**`prepare` reports dropped clips** — the clip exceeded 20 min or stayed over
100 MB after transcoding. Trim it and re-run.

**A caption key has no matching file** — a rename or a typo. `prepare` warns and
skips it. (`20251203_190621_1.mp4` in `dev-videos/captions.json` is a known one.)

**No ffmpeg** — `npm install` in `experiments/module-feedback/` pulls in
`ffmpeg-static`; a system `ffmpeg` on `PATH` also works.

**Changing `TUNING_MEDIA_RESOLUTION`** — it must be identical on every line of
train *and* val, so rebuild both together with `build-jsonl`.

**Editing the prompts** — `SYSTEM_INSTRUCTION` and `USER_PROMPT` in
`tuning/src/prompts.ts` go into the training data *and* every inference call.
Changing either invalidates an existing tuned model; you must retune.

---

## Turning billing off between sessions

Safe to do. `teamtrack-502602` holds only the bucket, and the website is a
different project entirely. Disabling billing makes the bucket inaccessible and
stops any tuned model from serving; `prepare` and the Gemini-key baseline keep
working. Everything in the bucket is regenerable — re-enable billing and re-run
`upload` and `build-jsonl` to restore it.
