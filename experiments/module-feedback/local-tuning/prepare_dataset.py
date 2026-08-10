"""
Build the local training manifest from dev-videos/.

Only keeps pairs where BOTH the caption and the video file exist (the 96-pair
case on this machine). Videos with no caption are skipped, as are the few
orphan captions with no matching video file.

Extracts N evenly-spaced frames per clip to local-tuning/data/frames/<stem>/.
"""
import hashlib
import json
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[3]
DEV_VIDEOS = REPO / "dev-videos"
OUT_DIR = Path(__file__).resolve().parent / "data"
FRAMES_DIR = OUT_DIR / "frames"
MANIFEST = OUT_DIR / "manifest.json"

NUM_FRAMES = 8
FRAME_SIZE = 336  # shorter side, keeps aspect ratio

FFPROBE = "ffprobe"
FFMPEG = "ffmpeg"


def probe_duration(video_path: Path) -> float:
    out = subprocess.run(
        [FFPROBE, "-v", "error", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", str(video_path)],
        capture_output=True, text=True, check=True,
    )
    return float(out.stdout.strip())


def extract_frames(video_path: Path, dest_dir: Path, n: int) -> list[str]:
    dest_dir.mkdir(parents=True, exist_ok=True)
    existing = sorted(dest_dir.glob("frame_*.jpg"))
    if len(existing) == n:
        return [str(p) for p in existing]
    for p in existing:
        p.unlink()

    duration = probe_duration(video_path)
    if duration <= 0:
        raise RuntimeError(f"bad duration for {video_path}")

    # Evenly spaced timestamps, avoiding the very first/last frame.
    timestamps = [duration * (i + 0.5) / n for i in range(n)]
    paths = []
    for i, ts in enumerate(timestamps):
        out_path = dest_dir / f"frame_{i:02d}.jpg"
        subprocess.run(
            [FFMPEG, "-y", "-ss", f"{ts:.3f}", "-i", str(video_path),
             "-frames:v", "1", "-vf", f"scale={FRAME_SIZE}:-2",
             "-q:v", "3", str(out_path)],
            capture_output=True, text=True, check=True,
        )
        paths.append(str(out_path))
    return paths


def main():
    captions = json.loads((DEV_VIDEOS / "captions.json").read_text(encoding="utf-8"))
    video_files = {p.name: p for p in DEV_VIDEOS.iterdir()
                   if p.suffix.lower() in (".mp4", ".mov")}

    matched = {name: cap for name, cap in captions.items() if name in video_files}
    missing_video = [name for name in captions if name not in video_files]
    missing_caption = [name for name in video_files if name not in captions]

    print(f"captions total:        {len(captions)}")
    print(f"video files total:     {len(video_files)}")
    print(f"matched (trainable):   {len(matched)}")
    print(f"captions, no video (skipped): {len(missing_video)}")
    print(f"videos, no caption (skipped): {len(missing_caption)}")

    manifest = []
    for i, (name, caption) in enumerate(sorted(matched.items())):
        video_path = video_files[name]
        stem = Path(name).stem.replace(" ", "_")
        dest_dir = FRAMES_DIR / stem
        try:
            frames = extract_frames(video_path, dest_dir, NUM_FRAMES)
        except Exception as e:
            print(f"  SKIP {name}: {e}", file=sys.stderr)
            continue
        manifest.append({
            "name": name,
            "caption": caption.strip(),
            "frames": frames,
        })
        if (i + 1) % 10 == 0:
            print(f"  ...{i + 1}/{len(matched)} processed")

    # Deterministic split by hash of filename, ~85/15 train/val
    train, val = [], []
    for item in manifest:
        h = int(hashlib.sha1(item["name"].encode()).hexdigest(), 16)
        (val if h % 100 < 15 else train).append(item)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    MANIFEST.write_text(json.dumps({"train": train, "val": val}, indent=2), encoding="utf-8")
    print(f"\nWrote manifest: {len(train)} train / {len(val)} val -> {MANIFEST}")


if __name__ == "__main__":
    main()
