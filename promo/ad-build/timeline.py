"""Single source of truth for the retimed TeamTrack ad.

Maps every source frame (30 fps, 360 frames) to an output time, so the
video retime and the soundtrack are driven by the same numbers.
"""
import json

SRC_FPS = 30
BPM = 128
BEAT = 60 / BPM

# Part 1 (free timing): (start_frame, end_frame_exclusive, output_seconds)
PART1 = [
    (0, 2, 0.50),     # black pre-roll
    (2, 13, 0.75),    # match timer 2:30 -> 2:29
    (13, 21, 0.60),   # arena / field lines
    (21, 30, 0.75),   # robot silhouette, EVERY MATCH CREATES DATA.
    (30, 37, 0.60),   # red vs blue score count
    (37, 54, 1.00),   # field top-down, telemetry callouts
    (54, 68, 0.85),   # data overload
    (68, 77, 0.65),   # converge swirl, MAKE IT MEAN SOMETHING.
    (77, 92, 1.00),   # logo mark + wordmark
    (92, 98, 0.40),   # push into the mark
]
# Part 2 (on the 128 BPM grid): (start, end, beats)
PART2 = [
    (98, 106, 1),     # push-through -> TRACK.
    (106, 134, 3),    # sessions dashboard -> ANALYZE.
    (134, 160, 3),    # session analysis -> IMPROVE.
    (160, 190, 4),    # pan down, transition -> SEE WHAT...
    (190, 270, 9),    # match details -> charts -> comparison -> breakdown
    (270, 278, 1),    # +131%
    (278, 285, 1),    # stat cards
    (285, 293, 1),    # 0:00 match timer, 137 pts
    (293, 300, 1),    # ranking points +2
    (300, 306, 1),    # early season vs qualifier +72
    (306, 314, 1),    # pull back, dashboard compresses
]
END_CARD = (314, 360, 2.30)   # logo, TEAMTRACK, tagline
END_HOLD = 0.70


def build():
    segs = []
    t = 0.0
    for a, b, d in PART1:
        segs.append((a, b, t, d))
        t += d
    groove_start = t
    for a, b, beats in PART2:
        d = beats * BEAT
        segs.append((a, b, t, d))
        t += d
    a, b, d = END_CARD
    segs.append((a, b, t, d))
    t += d
    return segs, groove_start, t, t + END_HOLD


SEGS, GROOVE_START, VIDEO_END, TOTAL = build()


def frame_time(n):
    """Output time (s) at which source frame n is shown (fractional n ok)."""
    for a, b, t0, d in SEGS:
        if a <= n < b or (n == b and b == SEGS[-1][1]):
            return t0 + (n - a) * d / (b - a)
    raise ValueError(n)


def beat_time(k):
    return GROOVE_START + k * BEAT


def setpts_expr():
    # Nested if() over frame index N, value in seconds / TB.
    expr = None
    for a, b, t0, d in reversed(SEGS):
        piece = f"({t0:.6f}+(N-{a})*{d / (b - a):.8f})"
        expr = piece if expr is None else f"if(lt(N,{b}),{piece},{expr})"
    return f"({expr})/TB"


if __name__ == "__main__":
    for a, b, t0, d in SEGS:
        print(f"frames {a:3d}-{b - 1:3d}  out {t0:6.3f}-{t0 + d:6.3f}  "
              f"slow {d / ((b - a) / SRC_FPS):.2f}x")
    print("groove start", round(GROOVE_START, 3), "video end", round(VIDEO_END, 3),
          "total", round(TOTAL, 3))
    json.dump({"setpts": setpts_expr(), "video_end": VIDEO_END, "total": TOTAL},
              open("timeline.json", "w"))
