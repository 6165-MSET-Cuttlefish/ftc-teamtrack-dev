# Upload clips + captions here

This is the drop folder for tuning data. Nothing else reads it yet —
`../../PLAN.md` Phase 3 describes the scripts that will.

## What to put in this folder

```
inbox/
  captions.json      <- tracked in git
  <clip>.mp4         <- gitignored (too large)
  <clip>.mov
  ...
```

## Clips

- **`.mp4` strongly preferred.** `.mov` works but gets transcoded before upload
  (Vertex wants `video/mp4`).
- **One mechanism per clip.** Don't put the intake and the shooter in the same
  file — the model can only be told one answer per video.
- Keep them short. Under 20 minutes is the hard limit; under ~60 seconds is what
  actually helps.
- Under 100 MB each. Trim rather than compress if you can.
- Filenames can be anything, but they must match the caption keys **exactly**,
  including extension.

## captions.json

```json
{
  "IMG_1234.mp4": "hinged intake, full-width, vector wheels on ends, compliant wheels in middle, intakes well from middle",
  "IMG_5678.mp4": "shooter launching 3 balls, consistent arc, one miss on the third"
}
```

Rules:

- **The caption is the model's target output — write it exactly as you want the
  model to speak.** It is not a note-to-self, it is the answer key.
- Keep the style consistent across all entries. Inconsistent phrasing is the
  single fastest way to get a mushy tuned model.
- Every file needs a caption; every caption needs a file. The prepare script
  will fail loudly on mismatches.
- Start each caption with the mechanism type (`intake`, `shooter`, `transfer`,
  `spindexer`, `hanger`, `drivetrain`) so the model learns to classify before it
  describes.

## Targets

- **100+ clips total.** The existing `dev-videos/` set contributes 30, so ~70 more.
- **Mix the mechanisms.** The current set is almost entirely intakes.
- **Include failures.** Jams, misses, drops — with captions that say so.

## Existing data

The 30 already-labeled clips live in `/dev-videos/` with their own
`captions.json`. Leave them there — the prepare script merges both sources.
