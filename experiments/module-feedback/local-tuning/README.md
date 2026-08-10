# local-tuning — QLoRA fine-tune, no GCP/billing required

An alternative to the Gemini/Vertex pipeline in `../tuning/`: fine-tunes an
open model (`Qwen/Qwen2-VL-2B-Instruct`) locally with QLoRA on the same
`dev-videos/captions.json` data, entirely on-machine. No cloud cost, but a
much smaller model than Gemini.

## Setup

```bash
python -m venv .venv
.venv\Scripts\pip install torch torchvision --index-url https://download.pytorch.org/whl/cu124
.venv\Scripts\pip install -r requirements.txt
```

**`transformers` must stay pinned to `4.49.0`.** Newer 5.x releases changed
Qwen2-VL's vision-tower internals in a way that's incompatible with
`qwen_vl_utils` — it doesn't error cleanly, it silently corrupts tensor
shapes deep in vision attention. Don't `pip install -U transformers` in this
venv without re-verifying `train.py` still runs end to end.

Needs `ffmpeg`/`ffprobe` on `PATH` (frame extraction) and a CUDA GPU with
~8GB+ VRAM for 4-bit QLoRA on the 2B model.

## Running it

```bash
python prepare_dataset.py   # builds data/manifest.json + data/frames/ from dev-videos/
python train.py             # QLoRA fine-tune, writes data/adapter/
python eval.py               # spot-check data/adapter/ against held-out val clips
```

`data/` (frames, checkpoints, the trained adapter) is gitignored — regenerate
with the commands above. Frame extraction and training are both deterministic
given the same `dev-videos/` contents.

## Known gotchas (already fixed here, don't rediscover them)

- **Windows `file://` URIs**: must be `file://C:/path`, not `file:///C:/path`
  — the extra slash makes `qwen_vl_utils` construct an invalid path with a
  leading slash before the drive letter.
- **`pixel_values`/`image_grid_thw` have no per-example batch dimension**,
  unlike `input_ids`/`attention_mask`. Indexing them with `[0]` in a collate
  function silently truncates a multi-frame clip down to one patch instead
  of raising an error. See `VISION_KEYS` handling in `train.py`.

## Honest result (last run)

3 epochs on 81 train / 14 val clips (96 matched video+caption pairs from
`dev-videos/`, minus a few skipped for missing pairs or an ffmpeg seek
failure). Training loss 4.06 → eval loss 2.79, no overfitting divergence —
mechanically the training worked.

**But the training set is 77% intake examples (62/81)**, and the model
collapsed to describing nearly everything as an intake, including shooter
clips it was never right about once in the 14-clip eval set. This is a
data-imbalance problem, not a training-process problem — more epochs on the
same data would not fix it. Rebalancing toward shooters/transfers/failure
cases (same imbalance flagged in `../HANDOFF.md`) is the next step before
this is worth comparing against the Gemini few-shot baseline.
