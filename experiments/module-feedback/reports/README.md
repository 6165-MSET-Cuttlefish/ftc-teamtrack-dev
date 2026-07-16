# reports/ — local visual timeline

`intake-timeline.html` is a self-contained visual review of the TwelveLabs
per-clip intake analysis: a scrubbable video of the five clips joined together,
a segmented timeline, and each clip's AI findings (observations → fixes) with a
"what kept recurring" synthesis.

**It is local-only.** The HTML embeds the footage (as data URIs), so it — and the
`media/` folder — are **gitignored** and never get pushed to GitHub. Only this
README and the generator `build-timeline.mjs` are tracked. Nothing here is
uploaded anywhere; open it straight off your disk.

## Open it

Double-click `intake-timeline.html`, or:

```bash
open reports/intake-timeline.html      # macOS
```

Works fully offline — no server, no network.

## Regenerate the HTML

The generator assembles the page from `media/` + the analysis text baked into
the script. If `media/` is present:

```bash
node reports/build-timeline.mjs        # rewrites reports/intake-timeline.html
```

Edit the `clips` / `recurring` data at the top of `build-timeline.mjs` to update
the findings, then re-run.

## Rebuild the media from the clips (only if media/ is missing)

`media/` holds a compressed web video + one thumbnail per clip, derived from the
originals in `../samples/`. To rebuild them (run from `experiments/module-feedback/`):

```bash
# 1. Join the 5 clips into one 854x480 video (clip 5 is portrait → scaled+padded)
ffmpeg -y -i "samples/IMG_2037.mov" -i "samples/IMG_2038 (1).mov" \
       -i "samples/IMG_2040 (1).mov" -i "samples/IMG_2041 (1).mov" -i "samples/IMG_2042 (1).mov" \
  -filter_complex "[0:v]scale=854:480:force_original_aspect_ratio=decrease,pad=854:480:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30[v0];[1:v]scale=854:480:force_original_aspect_ratio=decrease,pad=854:480:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30[v1];[2:v]scale=854:480:force_original_aspect_ratio=decrease,pad=854:480:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30[v2];[3:v]scale=854:480:force_original_aspect_ratio=decrease,pad=854:480:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30[v3];[4:v]scale=854:480:force_original_aspect_ratio=decrease,pad=854:480:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30[v4];[v0][v1][v2][v3][v4]concat=n=5:v=1:a=0[outv]" \
  -map "[outv]" -c:v libx264 -pix_fmt yuv420p -movflags +faststart combined-all-clips.mp4

# 2. Compressed, muted web version for embedding
ffmpeg -y -i combined-all-clips.mp4 -vf "scale=640:-2" -c:v libx264 -crf 30 \
       -preset veryfast -an -movflags +faststart reports/media/combined-web.mp4

# 3. One thumbnail per clip (midpoints in the combined video)
for i_t in 1:2.35 2:6.46 3:9.74 4:13.33; do i=${i_t%%:*}; t=${i_t##*:}; \
  ffmpeg -y -ss "$t" -i combined-all-clips.mp4 -frames:v 1 -vf "scale=380:-2" -q:v 4 "reports/media/thumb$i.jpg"; done
# Clip 5 is portrait — pull its thumbnail from the source and crop to landscape
ffmpeg -y -i "samples/IMG_2042 (1).mov" -ss 2 -frames:v 1 -vf "scale=380:-2,crop=380:238" -pix_fmt yuvj420p -q:v 3 reports/media/thumb5.jpg
```

## Caveat carried in the page

The ball **counts** are the model's rough estimates and aren't reliable (a
stricter structured pass over the joined footage hallucinated 100+). The
repeated **qualitative** fixes — roller grip/material, spacing, dead-zone
compliance — are the trustworthy signal.
