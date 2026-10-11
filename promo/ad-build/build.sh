#!/usr/bin/env bash
# Rebuilds "teamtrack ad v2.mp4" (slowed + soundtrack) from "teamtrack ad.mp4".
# Needs: python3 venv with numpy, scipy, imageio-ffmpeg (provides the ffmpeg binary).
#   python3 -m venv .venv && .venv/bin/pip install numpy scipy imageio-ffmpeg
set -euo pipefail
cd "$(dirname "$0")"
PY=${PY:-.venv/bin/python}
FF=$($PY -c "import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())")
SRC="../../teamtrack ad.mp4"
OUT="../../teamtrack ad v2.mp4"

$PY timeline.py                      # prints the retime map, writes timeline.json
$PY - <<'PY'
import json
from timeline import SEGS, TOTAL
j = json.load(open("timeline.json"))
a, b, t0, d = SEGS[-1]
pad = TOTAL - (t0 + d * (b - 1 - a) / (b - a)) + 0.1
tail = f"tpad=stop_mode=clone:stop_duration={pad:.3f}"
open("vf_mci.txt", "w").write(f"setpts='{j['setpts']}',minterpolate=fps=30:mi_mode=mci:"
                              f"mc_mode=aobmc:me_mode=bidir:vsbmc=1:scd=fdiff:scd_threshold=8,{tail}")
open("vf_dup.txt", "w").write(f"setpts='{j['setpts']}',fps=30,{tail}")
PY
# Motion-interpolated pass, plus a frame-hold pass for shots with fast-counting numbers
"$FF" -y -loglevel error -i "$SRC" -filter_script:v vf_mci.txt -an -t 22.3 -c:v libx264 -crf 12 v_mci.mp4
"$FF" -y -loglevel error -i "$SRC" -filter_script:v vf_dup.txt -an -t 22.3 -c:v libx264 -crf 12 v_dup.mp4
$PY soundtrack.py                    # writes soundtrack.wav (-14 LUFS)

# Splice: frame-hold for the scoreboard (out frames 78-95) and payoff stats (494-564)
"$FF" -y -loglevel error -i v_mci.mp4 -i v_dup.mp4 -i soundtrack.wav -filter_complex "\
[0:v]trim=start_frame=0:end_frame=78,setpts=PTS-STARTPTS[a];\
[1:v]trim=start_frame=78:end_frame=96,setpts=PTS-STARTPTS[b];\
[0:v]trim=start_frame=96:end_frame=494,setpts=PTS-STARTPTS[c];\
[1:v]trim=start_frame=494:end_frame=565,setpts=PTS-STARTPTS[d];\
[0:v]trim=start_frame=565,setpts=PTS-STARTPTS[e];\
[a][b][c][d][e]concat=n=5:v=1:a=0,fps=30[v]" -map "[v]" -map 2:a \
  -c:v libx264 -crf 16 -preset slow -pix_fmt yuv420p -c:a aac -b:a 256k -ar 48000 \
  -movflags +faststart -shortest "$OUT"
rm -f v_mci.mp4 v_dup.mp4 vf_mci.txt vf_dup.txt timeline.json
echo "wrote $OUT"
