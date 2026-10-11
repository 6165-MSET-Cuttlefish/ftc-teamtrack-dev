"""Synthesized soundtrack for the retimed TeamTrack ad.

Cinematic tech: D minor, 128 BPM groove from the push-through into the UI,
every hit placed on the exact frame from timeline.py. Deterministic (seeded).
"""
import numpy as np
import scipy.signal as sg
from scipy.io import wavfile

from timeline import frame_time as ft, beat_time as bt, BEAT

FS = 48000
DUR = 22.3
N = int(DUR * FS)
rng = np.random.default_rng(6165)
STEP = BEAT / 4

BUSES = ["drums", "bass", "music", "lead", "arp", "sfx", "rev"]
bus = {b: np.zeros((2, N)) for b in BUSES}


def note(name):
    names = {"C": 0, "C#": 1, "D": 2, "Eb": 3, "E": 4, "F": 5, "F#": 6, "G": 7,
             "Ab": 8, "A": 9, "Bb": 10, "B": 11}
    p, o = name[:-1], int(name[-1])
    return 440.0 * 2 ** ((names[p] + 12 * (o + 1) - 69) / 12)


def tarr(dur):
    return np.arange(int(dur * FS)) / FS


def add(b, sig, t0, pan=0.0, gain=1.0, send=0.0):
    """Mix a mono (n,) or stereo (2, n) signal into a bus at time t0."""
    if sig.ndim == 1:
        a = (pan + 1) * np.pi / 4
        sig = np.vstack([sig * np.cos(a), sig * np.sin(a)]) * np.sqrt(2)
    sig = sig.copy()
    fo = min(240, sig.shape[1])                       # 5 ms de-click fade-out
    sig[:, -fo:] *= np.linspace(1, 0, fo)
    i0 = int(round(t0 * FS))
    s0, s1 = max(0, -i0), min(sig.shape[1], N - i0)
    if s1 <= s0:
        return
    bus[b][:, i0 + s0:i0 + s1] += gain * sig[:, s0:s1]
    if send:
        bus["rev"][:, i0 + s0:i0 + s1] += gain * send * sig[:, s0:s1]


def filt(x, kind, fc, order=2):
    return sg.sosfilt(sg.butter(order, fc, kind, fs=FS, output="sos"), x)


def svf(x, fc, q=0.7, mode="band"):
    """Time-varying TPT state-variable filter; fc is an array or scalar."""
    fc = np.broadcast_to(np.clip(fc, 20, FS * 0.45), x.shape)
    g = np.tan(np.pi * fc / FS)
    k = 1 / q
    a1 = 1 / (1 + g * (g + k))
    a2 = g * a1
    a3 = g * a2
    y = np.empty_like(x)
    ic1 = ic2 = 0.0
    for n in range(len(x)):
        v3 = x[n] - ic2
        v1 = a1[n] * ic1 + a2[n] * v3
        v2 = ic2 + a2[n] * ic1 + a3[n] * v3
        ic1 = 2 * v1 - ic1
        ic2 = 2 * v2 - ic2
        y[n] = v1 if mode == "band" else v2 if mode == "low" else x[n] - k * v1 - v2
    return y


def noise(n):
    return rng.standard_normal(n)


def env_exp(t, tau, attack=0.002):
    return np.exp(-t / tau) * np.minimum(1, t / attack)


def phase_of(freq):
    return 2 * np.pi * np.cumsum(freq) / FS


# ---------------------------------------------------------------- instruments

def kick(f0=150, f1=50, decay=0.16, dur=0.5, click=0.3):
    t = tarr(dur)
    f = f1 + (f0 - f1) * np.exp(-t / 0.032)
    body = np.sin(phase_of(f)) * env_exp(t, decay, 0.001)
    clk = filt(noise(len(t)), "high", 2500) * np.exp(-t / 0.003) * click
    return np.tanh(1.6 * (body + clk))


def clap(dur=0.35):
    t = tarr(dur)
    n = filt(noise(len(t)), "band", [900, 5200])
    e = np.zeros_like(t)
    for d in (0, 0.009, 0.019):
        e += np.where(t >= d, np.exp(-(t - d) / 0.006), 0)
    e += np.where(t >= 0.027, np.exp(-(t - 0.027) / 0.12), 0) * 0.7
    body = np.sin(2 * np.pi * 185 * t) * np.exp(-t / 0.04) * 0.35
    return (n * e * 0.45 + body)


def hat(open_=False):
    dur = 0.25 if open_ else 0.06
    t = tarr(dur)
    return filt(noise(len(t)), "high", 7500, 4) * np.exp(-t / (0.09 if open_ else 0.018))


def crash(dur=2.2):
    t = tarr(dur)
    n = filt(noise(len(t)), "high", 3500)
    return n * np.exp(-t / 0.7) * np.minimum(1, t / 0.003)


def sub_drop(f0=110, f1=36.7, tau=1.0, dur=3.0, drive=1.8):
    t = tarr(dur)
    f = f1 + (f0 - f1) * np.exp(-t / 0.09)
    s = np.sin(phase_of(f)) * env_exp(t, tau, 0.003)
    return np.tanh(drive * s) / np.tanh(drive)


def impact(size=1.0):
    """Layered hit: sub drop, low boom, crack, inharmonic metal ring."""
    dur = 1.5 + 2.0 * size
    t = tarr(dur)
    sub = sub_drop(tau=0.25 + 0.45 * size, dur=dur)
    boom = filt(noise(len(t)), "low", 160) * np.exp(-t / (0.12 + 0.18 * size)) * 1.1
    body = filt(noise(len(t)), "band", [150, 900]) * np.exp(-t / (0.06 + 0.08 * size)) * 0.9
    crack = filt(noise(len(t)), "band", [900, 7000]) * np.exp(-t / 0.025) * 0.5
    metal = sum(a * np.sin(2 * np.pi * f * t + rng.uniform(0, 6.28))
                for f, a in [(587, 1), (1213, .6), (1847, .45), (2711, .3), (3389, .2)])
    metal = metal * np.exp(-t / (0.35 + 0.4 * size)) * 0.14
    return sub * 0.7 + boom + body + crack + metal


def blip(freq, dur=0.09, bright=0.25):
    t = tarr(dur)
    s = np.sin(2 * np.pi * freq * t + bright * np.sin(2 * np.pi * freq * 2 * t))
    return s * env_exp(t, 0.022, 0.001)


def tick(freq=2600, tau=0.006):
    t = tarr(0.05)
    n = filt(noise(len(t)), "band", [1800, 9000]) * np.exp(-t / 0.0015)
    return n * 0.6 + np.sin(2 * np.pi * freq * t) * np.exp(-t / tau) * 0.5


def additive_saw(freq, t, cutoff=3000, detune_cents=0.0):
    f = freq * 2 ** (detune_cents / 1200)
    out = np.zeros_like(t)
    ph = 2 * np.pi * f * t + rng.uniform(0, 6.28)
    for k in range(1, int(min(60, (FS / 2.2) / f)) + 1):
        w = np.exp(-((k * f) / cutoff) ** 2)
        if w < 1e-3:
            break
        out += np.sin(k * ph) * w / k
    return out


def pad(freqs, dur, attack=0.4, release=0.8, cutoff=1500, gain=1.0):
    t = tarr(dur)
    L = np.zeros_like(t)
    R = np.zeros_like(t)
    for f in freqs:
        L += additive_saw(f, t, cutoff, -6) + 0.6 * additive_saw(f, t, cutoff, 4)
        R += additive_saw(f, t, cutoff, 6) + 0.6 * additive_saw(f, t, cutoff, -4)
    e = np.minimum(1, t / attack) * np.minimum(1, np.maximum(0, (dur - t) / release))
    out = np.vstack([L, R]) * e * gain / len(freqs)
    return np.vstack([filt(c, "high", 110) for c in out])


def stab(freqs, dur=0.7, cutoff=2600):
    t = tarr(dur)
    s = sum(additive_saw(f, t, cutoff, d) for f in freqs for d in (-8, 8))
    fl = np.exp(-t / 0.09)
    bright = sum(additive_saw(f, t, cutoff * 2.5, 0) for f in freqs) * fl * 0.5
    return (s * env_exp(t, 0.22, 0.003) + bright) / len(freqs)


def pluck(freq, dur=0.32, bright=1.0):
    t = tarr(dur)
    out = np.zeros_like(t)
    for k in range(1, int(min(24, 9000 / freq)) + 1):
        out += np.sin(2 * np.pi * k * freq * t) / k * np.exp(-t * (6 + 3.2 * k / bright))
    return out * np.minimum(1, t / 0.002)


def bass_note(freq, dur):
    t = tarr(dur)
    s = (np.sin(2 * np.pi * freq * t) + 0.45 * np.sin(4 * np.pi * freq * t)
         + 0.18 * np.sin(6 * np.pi * freq * t))
    e = np.minimum(1, t / 0.006) * np.minimum(1, np.maximum(0, (dur - t) / 0.03))
    return np.tanh(1.4 * s * e) * 0.8


def bell(freq, dur=2.5, index=2.2):
    t = tarr(dur)
    mod = np.sin(2 * np.pi * freq * 3.5 * t) * index * np.exp(-t / 0.5)
    return np.sin(2 * np.pi * freq * t + mod) * env_exp(t, 0.9, 0.002)


def noise_sweep(dur, f0, f1, q=1.2, shape=2.0, stereo=True, mode="band"):
    """Riser/whoosh: band-passed noise sweeping f0 -> f1, swelling in."""
    t = tarr(dur)
    fc = f0 * (f1 / f0) ** (t / dur)
    amp = (t / dur) ** shape
    chans = []
    for _ in range(2 if stereo else 1):
        chans.append(svf(noise(len(t)), fc, q, mode) * amp)
    return np.vstack(chans) if stereo else chans[0]


def whoosh(dur, f0=300, f1=4000):
    """Pass-by whoosh: swells in and out while the band sweeps."""
    t = tarr(dur)
    fc = f0 * (f1 / f0) ** (t / dur)
    amp = np.sin(np.pi * t / dur) ** 2
    L = svf(noise(len(t)), fc, 1.0) * amp
    R = svf(noise(len(t)), fc * 1.07, 1.0) * amp
    pan = t / dur
    return np.vstack([L * (1.2 - pan), R * (0.2 + pan)])


def reverse_swell(dur, cutoff=5000):
    t = tarr(dur)
    tail = filt(noise(len(t)), "low", cutoff) * np.exp(-t / (dur / 3.5))
    L = tail[::-1]
    tail2 = filt(noise(len(t)), "low", cutoff) * np.exp(-t / (dur / 3.5))
    R = tail2[::-1]
    return np.vstack([L, R])


def glide(f0, f1, dur, cutoff=2500, shape=2.0):
    t = tarr(dur)
    f = f0 * (f1 / f0) ** (t / dur)
    ph = phase_of(f)
    s = np.zeros_like(t)
    for k in range(1, 16):
        s += np.sin(k * ph) / k * np.exp(-((k * f) / cutoff) ** 2)
    return s * (t / dur) ** shape


def buzzer(dur=0.38, f=note("Bb3")):
    t = tarr(dur)
    s = sum(np.sin(2 * np.pi * f * k * t) / k for k in (1, 3, 5, 7, 9, 11))
    s += 0.5 * sum(np.sin(2 * np.pi * f * 1.5 * k * t) / k for k in (1, 3, 5))
    e = np.minimum(1, t / 0.008) * np.minimum(1, (dur - t) / 0.05)
    return filt(s * e, "band", [250, 3200])


# ---------------------------------------------------------------- arrangement
D_PENT = [note(n) for n in ["D5", "F5", "G5", "A5", "C6", "D6", "F6", "G6", "A6", "C7"]]

# Intro: inhale -> match timer
add("sfx", reverse_swell(0.5, 2500), 0.0, gain=0.35, send=0.2)
add("sfx", impact(0.8), ft(2), gain=0.55, send=0.35)
add("sfx", tick(3200), ft(8), gain=0.5, send=0.15)
add("sfx", tick(1800), ft(8) + 0.012, gain=0.3)

# Low drone under the whole intro, opening up as data piles in
t0, t1 = ft(2), bt(0)
dr = tarr(t1 - t0)
drone = np.sin(2 * np.pi * note("D2") * dr) * 0.35 + np.sin(2 * np.pi * note("A2") * dr) * 0.12
drone *= np.minimum(1, dr / 0.8) * (1 + 0.15 * np.sin(2 * np.pi * 0.5 * dr))
add("music", drone * 0.32, t0)
dpad = pad([note("D2"), note("A2"), note("D3"), note("F3")], t1 - t0, attack=1.2,
           release=0.3, cutoff=4000)
cut = 250 * (6000 / 250) ** np.clip((dr - (ft(37) - t0)) / (ft(79) - ft(37)), 0, 1)
cut[dr > ft(79) - t0] = 500
dpad = np.vstack([svf(dpad[0], cut, 0.8, "low"), svf(dpad[1], cut, 0.8, "low")])
add("music", dpad * 0.5, t0)

# Arena reveal: lights clunk + air
add("sfx", kick(90, 40, 0.25), ft(13), gain=0.55)
add("sfx", filt(noise(int(0.4 * FS)), "band", [200, 1500]) * np.exp(-tarr(0.4) / 0.08),
    ft(13), gain=0.25, send=0.6)
add("sfx", whoosh(ft(21) - ft(13), 400, 2500), ft(13), gain=0.18)

# Robot: hit + servo whirr, text typing
add("sfx", kick(120, 42, 0.22), ft(21), gain=0.6)
add("sfx", crash(1.0) * 0.4, ft(21), gain=0.25, send=0.3)
st = tarr(0.42)
servo = np.sin(phase_of(380 + 520 * (st / 0.42) + 25 * np.sin(2 * np.pi * 31 * st)))
add("sfx", filt(servo, "band", [300, 3000]) * np.sin(np.pi * st / 0.42) ** 2, ft(22),
    gain=0.08, pan=0.3)
for i, f in enumerate(np.linspace(20, 25, 6)):
    add("sfx", tick(2200 + 150 * i, 0.004), ft(f), gain=0.22, pan=-0.2 + 0.08 * i)

# Scoreboard: hit + counter ticks climbing
add("sfx", impact(0.35), ft(30), gain=0.45, send=0.25)
for i, f in enumerate(range(30, 37)):
    add("sfx", blip(note("D6") * 2 ** (i * 2 / 12), 0.05), ft(f), gain=0.17,
        pan=-0.5 if i % 2 else 0.5)

# Field + data overload: accelerating musical blips, heartbeat, riser
add("sfx", kick(110, 44, 0.2), ft(37), gain=0.5)
t = ft(38)
while t < ft(70):
    prog = np.clip((t - ft(38)) / (ft(68) - ft(38)), 0, 1)
    rate = 6 * (55 / 6) ** prog
    add("sfx", blip(rng.choice(D_PENT), rng.uniform(0.04, 0.09)), t,
        pan=rng.uniform(-0.85, 0.85), gain=rng.uniform(0.35, 1.0) * (0.08 + 0.07 * prog))
    t += rng.uniform(0.6, 1.4) / rate
hb = ft(37) + 0.45
gap = 0.45
while hb < ft(77) - 0.08:
    add("drums", kick(85, 45, 0.12, click=0.1), hb, gain=0.24)
    gap = max(0.11, gap * 0.86)
    hb += gap
add("sfx", noise_sweep(ft(79) - ft(37), 250, 7000, 1.4, 2.6), ft(37), gain=0.28)
add("lead", glide(note("D3"), note("D5"), ft(79) - ft(37), 3000, 2.2), ft(37), gain=0.12)
add("sfx", reverse_swell(0.7, 6000), ft(79) - 0.7, gain=0.5, send=0.3)
for f in (68, 70, 72, 74):          # MAKE / IT / MEAN / SOMETHING.
    add("sfx", tick(2000, 0.005), ft(f), gain=0.2)

# Logo impact (flash frame), wordmark typing, glow hum
add("sfx", impact(1.4), ft(79), gain=0.8, send=0.5)
add("sfx", crash(2.5), ft(79), gain=0.18, send=0.4)
for f in [note("D5"), note("A5"), note("E6")]:
    add("lead", bell(f, 2.5, 1.5), ft(79), gain=0.07, send=0.6, pan=rng.uniform(-.5, .5))
for i, f in enumerate(np.linspace(81, 85, 5)):
    add("sfx", tick(2400 + 200 * i, 0.005), ft(f), gain=0.2, pan=-0.3 + 0.15 * i)

# Push through the mark -> groove
add("sfx", noise_sweep(bt(0) - ft(92), 500, 10000, 1.2, 2.2), ft(92), gain=0.4)
add("sfx", reverse_swell(0.55, 8000), bt(0) - 0.55, gain=0.55)
add("lead", glide(note("D4"), note("D6"), bt(0) - ft(92), 4000, 1.8), ft(92), gain=0.1)

# ------------------------------------------------------------------- groove
CHORDS = {  # beat -> (bass root, pad voicing, arp tones)
    0: ("D2", ["D3", "F3", "A3", "C4", "E4"], ["D4", "F4", "A4", "D5", "F5", "A5"]),
    4: ("Bb1", ["Bb2", "F3", "A3", "D4"], ["Bb3", "D4", "F4", "Bb4", "D5", "F5"]),
    8: ("F2", ["F3", "A3", "C4", "E4"], ["F4", "A4", "C5", "F5", "A5", "C6"]),
    12: ("C2", ["C3", "G3", "D4", "E4"], ["C4", "E4", "G4", "C5", "E5", "G5"]),
    16: ("D2", ["D3", "F3", "A3", "C4", "E4"], ["D4", "F4", "A4", "D5", "F5", "A5"]),
    20: ("Bb1", ["Bb2", "F3", "A3", "D4"], ["Bb3", "D4", "F4", "Bb4", "D5", "F5"]),
    24: ("C2", ["C3", "G3", "C4", "E4", "G4"], ["C4", "E4", "G4", "C5", "E5", "G5"]),
}
GROOVE_BEATS = 25  # b0 .. b24 play; b25 is the pull-back breath


def chord_at(beat):
    return CHORDS[max(k for k in CHORDS if k <= beat)]


kicks = []
for s in range(GROOVE_BEATS * 4):
    beat, st16 = s / 4, s % 16
    tt = bt(0) + s * STEP
    full = beat >= 12
    k = (st16 in (0, 10)) if not full else (st16 in (0, 4, 8, 12))
    if beat >= 20 and st16 == 14:
        k = True
    if s in (4, 28, 44):               # TRACK / IMPROVE / SEE WHAT accents
        k = True
    if k:
        add("drums", kick(), tt, gain=0.75)
        kicks.append(tt)
    sn = (st16 == 8) if beat < 12 else (st16 in (4, 12))
    if beat >= 20 and s % 4 == 0:
        sn = True
    if sn:
        add("drums", clap(), tt, gain=0.5, send=0.35, pan=0.05)
    hv = [1, .35, .65, .35][s % 4] * (0.5 if beat < 8 else 0.8)
    if beat >= 8 or s % 2 == 0:
        add("drums", hat(), tt, gain=0.11 * hv, pan=0.35)
    if full and s % 4 == 2:
        add("drums", hat(True), tt, gain=0.06, pan=-0.35)
    # bass: 8ths on the root
    if s % 2 == 0:
        root = note(chord_at(beat)[0])
        add("bass", bass_note(root, STEP * 1.8), tt, gain=0.5 if s % 4 == 0 else 0.38)
        add("bass", np.sin(2 * np.pi * root / 2 * tarr(STEP * 1.8))
            * np.minimum(1, tarr(STEP * 1.8) / 0.005), tt, gain=0.1)
    # arp from SEE WHAT onward
    if beat >= 11:
        tones = chord_at(beat)[2]
        idx = [0, 2, 4, 3, 1, 3, 5, 2][s % 8]
        prog = np.clip((beat - 11) / 9, 0, 1)
        add("arp", pluck(note(tones[idx]), 0.3, 0.6 + 0.9 * prog), tt,
            gain=0.14 + 0.08 * prog, pan=0.4 if s % 2 else -0.4)

# snare roll into the payoff
for i in range(8):
    add("drums", clap(), bt(18) + i * STEP, gain=0.12 + 0.05 * i, send=0.2)

# pads, one per chord span
spans = sorted(CHORDS) + [GROOVE_BEATS + 1]
for a, b in zip(spans[:-1], spans[1:]):
    voic = [note(n) for n in CHORDS[a][1]]
    add("music", pad(voic, (b - a) * BEAT + 0.3, 0.08, 0.35,
                     1400 if a < 12 else 2400), bt(a), gain=0.42, send=0.25)

# sidechain pump on bass/pad/arp
sc = np.ones(N)
for k_t in kicks:
    i = int(k_t * FS)
    seg = tarr(BEAT)
    j = min(N, i + len(seg))
    sc[i:j] = np.minimum(sc[i:j], 1 - 0.6 * np.exp(-seg[:j - i] / 0.09))
for b in ("bass", "music", "arp"):
    m = np.ones(N)
    m[int(bt(0) * FS):int(bt(25) * FS)] = sc[int(bt(0) * FS):int(bt(25) * FS)]
    bus[b] *= m

# arp ping-pong delay (dotted 8th)
d = int(3 * STEP * FS)
dry = bus["arp"].copy()
for n_tap in range(1, 6):
    src = dry.sum(0) * 0.5 * (0.42 ** n_tap)
    ch = n_tap % 2
    bus["arp"][ch, n_tap * d:] += filt(src, "low", 4000)[:N - n_tap * d]

# b0: the drop
add("sfx", impact(1.0), bt(0), gain=0.7, send=0.4)
add("drums", crash(2.4), bt(0), gain=0.22, send=0.3)
add("lead", stab([note(n) for n in ["D3", "A3", "D4", "F4"]]), bt(0), gain=0.55, send=0.35)

# word accents: TRACK. ANALYZE. IMPROVE.
for b, v in [(1, ["D3", "A3", "D4", "F4"]), (4, ["Bb2", "F3", "D4", "F4", "A4"]),
             (7, ["Bb2", "F3", "D4", "A4", "D5"])]:
    add("lead", stab([note(n) for n in v], 0.6), bt(b), gain=0.5, send=0.45)
    add("sfx", impact(0.25), bt(b), gain=0.3, send=0.2)
    add("sfx", reverse_swell(0.22, 9000), bt(b) - 0.22, gain=0.25)

# UI moves
add("sfx", tick(1900, 0.01), ft(131), gain=0.35)                      # session picked
add("sfx", whoosh(ft(150) - ft(141), 250, 5000), ft(141), gain=0.25)  # zoom into analysis
for f in range(150, 160, 2):
    add("sfx", blip(rng.choice(D_PENT[3:]), 0.05), ft(f), gain=0.06,
        pan=rng.uniform(-.6, .6))
add("sfx", whoosh(ft(192) - ft(181), 300, 3500), ft(181), gain=0.25)  # pan to match view
add("sfx", reverse_swell(0.47, 7000), bt(11) - 0.47, gain=0.35)
add("sfx", impact(0.45), bt(11), gain=0.35, send=0.35)
for f in (190, 191, 193, 194, 196):                                    # SEE WHAT THE ...
    add("sfx", tick(2300, 0.005), ft(f), gain=0.16)
add("sfx", whoosh(ft(212) - ft(202), 300, 4000), ft(202), gain=0.18)   # charts slide in
add("lead", glide(note("A5"), note("A6"), ft(223) - ft(210), 6000, 0.8), ft(210), gain=0.05,
    send=0.5)
for i, f in enumerate(np.linspace(211, 222, 7)):                       # points pop
    add("sfx", blip(D_PENT[i + 1], 0.08, 0.15), ft(f), gain=0.09, send=0.3,
        pan=-0.6 + 0.2 * i)
add("sfx", whoosh(ft(233) - ft(223), 300, 4000), ft(223), gain=0.18)   # comparison
add("sfx", whoosh(ft(258) - ft(249), 300, 4000), ft(249), gain=0.18)   # breakdown
for i, f in enumerate(np.linspace(256, 266, 6)):
    add("sfx", blip(D_PENT[i + 2], 0.06), ft(f), gain=0.06, pan=0.5 - 0.2 * i)
add("sfx", noise_sweep(bt(20) - bt(16), 300, 9000, 1.3, 2.5), bt(16), gain=0.32)
add("lead", glide(note("D4"), note("D6"), bt(20) - bt(16), 3500, 2.4), bt(16), gain=0.1)

# payoff: a hit on every beat, stabs climbing
add("sfx", impact(0.9), bt(20), gain=0.6, send=0.35)
add("drums", crash(2.0), bt(20), gain=0.2, send=0.25)
for b, v in [(20, ["Bb2", "F3", "Bb3", "D4", "D5"]), (21, ["Bb2", "F3", "D4", "F4", "F5"]),
             (23, ["Bb2", "F3", "D4", "F4", "A5"]), (24, ["C3", "G3", "C4", "E4", "G5"])]:
    add("lead", stab([note(n) for n in v], 0.5), bt(b), gain=0.45, send=0.4)
add("sfx", buzzer(), ft(287), gain=0.13, send=0.15)                     # 0:00
for lo, hi in [(270, 276), (279, 284), (286, 291), (300, 305)]:         # counters
    for i, f in enumerate(range(lo, hi + 1)):
        add("sfx", blip(note("D6") * 2 ** (i * 2 / 12), 0.045), ft(f), gain=0.1,
            pan=-0.4 if i % 2 else 0.4)
add("sfx", bell(note("A6"), 1.2, 1.0), ft(296), gain=0.08, send=0.4)   # +2 RP

# pull back -> final hit
add("sfx", reverse_swell(bt(26) - bt(25), 9000), bt(25), gain=0.6, send=0.2)
add("sfx", noise_sweep(bt(26) - bt(25), 800, 9000, 1.0, 2.0), bt(25), gain=0.3)
END = bt(26)
add("sfx", impact(1.8), END, gain=0.9, send=0.55)
add("drums", crash(3.0), END, gain=0.2, send=0.4)
end_len = DUR - END + 0.5
add("music", pad([note(n) for n in ["D2", "A2", "D3", "E3", "A3", "D4", "F#4", "A4"]],
                 end_len, 0.02, 1.2, 2200), END, gain=0.55, send=0.4)
for f in ["D5", "A5", "F#5", "E6"]:
    add("lead", bell(note(f), 3.0, 1.2), END, gain=0.05, send=0.6, pan=rng.uniform(-.6, .6))
add("sfx", whoosh(ft(322) - ft(317), 2000, 9000), ft(317), gain=0.12)  # TEAMTRACK
add("lead", bell(note("A5"), 2.5, 0.8), ft(325), gain=0.06, send=0.6, pan=-0.2)
add("lead", bell(note("E6"), 2.5, 0.8), ft(325) + STEP, gain=0.045, send=0.6, pan=0.25)

# ------------------------------------------------------------------- reverb + master
def make_ir(rt60=2.4, length=3.0):
    t = tarr(length)
    chans = []
    for _ in range(2):
        n = noise(len(t))
        bright = filt(n, "high", 2500) * np.exp(-6.9 * t / (rt60 * 0.45))
        dark = filt(n, "low", 2500) * np.exp(-6.9 * t / rt60)
        ir = (bright + dark) * np.minimum(1, t / 0.02)
        ir = np.concatenate([np.zeros(int(0.018 * FS)), ir])
        chans.append(ir / np.sqrt(np.sum(ir ** 2)))
    return chans


ir = make_ir()
rev_in = np.vstack([filt(bus["rev"][c], "high", 180) for c in range(2)])
rev = np.vstack([sg.fftconvolve(rev_in[c], ir[c])[:N] for c in range(2)])

mix = (bus["drums"] * 1.0 + bus["bass"] * 0.9 + bus["music"] * 0.75 + bus["lead"] * 0.75
       + bus["arp"] * 0.8 + bus["sfx"] * 0.9 + rev * 0.45)
mix = np.vstack([filt(mix[c], "high", 30) for c in range(2)])
low = np.vstack([filt(mix[c], "low", 70) for c in range(2)])
mix = mix - 0.3 * low                                  # ~ -3 dB shelf under 70 Hz
tt = np.arange(N) / FS
mix *= np.clip((DUR - tt) / 0.6, 0, 1) ** 1.5      # fade the tail with the picture
mix *= np.clip(tt / 0.01, 0, 1)


def lufs(x):
    """ITU-R BS.1770 integrated loudness at 48 kHz."""
    y = sg.lfilter([1.53512485958697, -2.69169618940638, 1.19839281085285],
                   [1, -1.69065929318241, 0.73248077421585], x, axis=1)
    y = sg.lfilter([1, -2, 1], [1, -1.99004745483398, 0.99007225036621], y, axis=1)
    blk, hop = int(0.4 * FS), int(0.1 * FS)
    ms = np.array([(y[:, i:i + blk] ** 2).mean(1).sum()
                   for i in range(0, y.shape[1] - blk, hop)])
    ld = -0.691 + 10 * np.log10(ms + 1e-12)
    ms = ms[ld > -70]
    rel = -0.691 + 10 * np.log10(ms.mean()) - 10
    ms = ms[-0.691 + 10 * np.log10(ms) > rel]
    return -0.691 + 10 * np.log10(ms.mean())


def limit(x, ceiling):
    from scipy.ndimage import minimum_filter1d
    peak = np.abs(x).max(0)
    need = np.minimum(1, ceiling / np.maximum(peak, 1e-9))
    la = int(0.005 * FS)
    need = minimum_filter1d(need, 2 * la + 1, origin=0)
    need = np.concatenate([need[la:], np.ones(la)])       # look ahead
    g = np.empty_like(need)
    cur, rel = 1.0, np.exp(-1 / (0.12 * FS))
    for n in range(len(need)):
        cur = need[n] if need[n] < cur else 1 - (1 - cur) * rel
        g[n] = cur
    return np.clip(x * g, -ceiling, ceiling)


CEIL = 10 ** (-1.5 / 20)
TARGET = -14.0
pre = 1.0 / np.max(np.abs(mix))
for _ in range(5):
    out = limit(np.tanh(1.2 * mix * pre) / 1.2, CEIL)
    err = TARGET - lufs(out)
    if abs(err) < 0.1:
        break
    pre *= 10 ** (err / 20)
print(f"loudness {lufs(out):.2f} LUFS, peak {20 * np.log10(np.abs(out).max()):.2f} dBFS")
wavfile.write("soundtrack.wav", FS, out.T.astype(np.float32))
