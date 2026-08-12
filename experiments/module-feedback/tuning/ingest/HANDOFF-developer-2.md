# Ingest handoff — developer-2

**To developer-2's Claude.** You are downloading and captioning one slice of an
FTC YouTube playlist, to build training data for a model that describes robot
mechanisms. Other developers have their own slices; **only do the videos listed
at the bottom of this file.**

Read [`PLAN-youtube-ingest.md`](../PLAN-youtube-ingest.md) for the reasoning, and
[`../../../HANDOFF.md`](../../../HANDOFF.md) for the state of the tuning work
overall. Everything below was generated — **verify it rather than trusting it**,
and raise anything that looks wrong instead of working around it.

## Your slice

- **162 videos**, ~8.9 GB
- 101 short (≤3 min) — one mechanism, caption directly
- 61 long (>3 min) — multi-mechanism, **must be segmented first**

## Setup

```bash
git clone <repo> && cd ftc-teamtrack-dev
git checkout experiment/module-feedback-poc
cd experiments/module-feedback && npm install
brew install yt-dlp        # or: pipx install yt-dlp
```

## Download

Videos go to `dev-videos/` (gitignored — **never commit video files**).
Filenames are the YouTube ID so everyone's names match.

```bash
yt-dlp --no-playlist --restrict-filenames \
  -f "bv*[height<=1080][ext=mp4]+ba[ext=m4a]/b[height<=1080][ext=mp4]/bv*+ba/b" \
  --merge-output-format mp4 \
  -o "dev-videos/%(id)s.%(ext)s" \
  --write-subs --write-auto-subs --sub-langs "en.*" --sub-format vtt \
  "https://www.youtube.com/watch?v=<ID>"
```

`--no-playlist` matters — these IDs belong to a 368-video playlist and without
it yt-dlp will pull the whole thing.

**Keep the `.vtt` timestamps.** The cue times are how long videos get segmented.
Do not flatten subtitles to prose.

## Captions

**One file per video** — `tuning/data/captions/<videoId>.json`. Do **not** add to
the shared `captions.json`: it has caused three git conflicts and silently
deleted 14 captions once. Per-file removes the failure mode entirely.

```json
{ "videoId": "abc123", "clip": "abc123.mp4",
  "caption": "hinged intake, full-width, vector wheels on ends, compliant wheels in middle, intakes 3 balls from center",
  "source": "human", "reviewed": true }
```

### Style — match this or the dataset goes mushy

- **Describe what you SEE**, not what the speaker says. Teams narrate parts that
  are never on screen; ignore those.
- **Start with the mechanism type**: intake / shooter / transfer / spindexer /
  turret / hanger / drivetrain.
- **~100–150 characters.** Existing captions average ~118. Transcript-length
  paragraphs (600+ chars) are the single worst thing you can add.
- **Name the hardware**: vector wheels, compliant wheels, surgical tubing, gecko
  wheels, flywheel, hex motor, servo. The transcript is useful *here* — it gives
  you correct part names. Use it as a glossary, not as the caption.
- **Include failures.** Jams, drops, misses. A dataset of only successes teaches
  the model everything works.
- One mechanism per caption. If the clip shows three, it needs segmenting.

### Long videos (>3 min)

One caption per video is useless — the model can only be told one answer per
clip. Split into per-mechanism segments:

1. Read the `.vtt` **with timestamps** and find where the speaker moves between
   mechanisms ("moving on to our shooter…").
2. Cut with ffmpeg: `ffmpeg -ss <start> -to <end> -i <id>.mp4 -c copy <id>_<mech>.mp4`
3. Caption each segment separately.

A 20-minute "Behind the Bot" episode should yield roughly 5–10 clips.

## Reviewing

```bash
yarn ui        # or: yarn dev  → http://localhost:8080/dev/videos
```

Both show the clip next to its caption. Uncaptioned items sort to the top.

## Rules

1. **Never commit video files.** They're gitignored; keep it that way.
2. **Put the videos in shared storage** (ask where) as well as locally. Captions
   sync through git but videos don't — that's exactly why the project currently
   has 100 captions and only 55 usable pairs.
3. **`git pull` before you start and before you push.**
4. **Don't spend money.** Vertex billing is deliberately unlinked. Downloading
   and captioning cost nothing; tuning does, and that needs the project owner.
5. **Ask rather than guess** if a video doesn't match its assignment, a caption
   is ambiguous, or a mechanism is unfamiliar.

## Your videos

| ID | Length | Kind | Title |
| --- | --- | --- | --- |
| `QBFtU3RVTHs` | 57.5m | top25 | FTC Top 25 \| DECODE \| December - Presented by Studica Robotics |
| `nngF98R1f38` | 48.3m | top25 | FTC Top 25 \| DECODE \| November - Presented by Studica Robotics |
| `L4EoRAgW898` | 25.1m | open-alliance | DECODE Late Season Strategy and Design Discussion \| FTC Open Alliance |
| `1dBZRrK4dF0` | 24.4m | behind-the-bot | 11329 I.C.E. Robotics \| Behind the Bot \| FTC DECODE Robot |
| `on4jUaoD5UA` | 22.3m | behind-the-bot | 20265 Heart of RoBots \| Behind the Bot \| FTC DECODE Robot |
| `9XC1RkjNGdw` | 21.9m | open-alliance | DECODE Custom Swerve \| Dual Intake \| 23513 I.N.T. Robotics \| FTC Open Alliance #firsttechchallenge |
| `bPrqckPORgY` | 21.4m | top25 | DECODE Top 15 Ri30H/Ri3D Robots \| #firsttechchallenge |
| `mTXRrHnDBZs` | 20.8m | behind-the-bot | 23224 Cheesy Bytes \| Behind the Bot \| FTC DECODE Robot |
| `INXUHdYV3Xk` | 19.5m | behind-the-bot | 23435 Gyrobotic Droids \| Behind the Bot \| FTC Decode Robot |
| `ls5TUlhLtCA` | 19.1m | behind-the-bot | 16917 Gear Wizards \| Behind the Bot \| DECODE Robot |
| `gaTss6W49CQ` | 18.7m | behind-the-bot | 30030 Exodus \| Behind the Bot \| FTC DECODE Robot |
| `QSaImCYylos` | 18.0m | behind-the-bot | 23849 Droid Force \| Behind the Bot \| FTC DECODE Robot |
| `SFV69qfcLMo` | 17.4m | open-alliance | Block Coding and Auto Strategies \| 23509 RoboRibbits \| FTA OA Show |
| `0SpmGbFcoFc` | 17.4m | behind-the-bot | 12808 RevAmped Robotics \| Behind the Bot \| MTI Winners |
| `ziji2vEfDYM` | 17.3m | behind-the-bot | 🚀 FTC 23849 Droid Force \| Behind the Bot – DECODE |
| `7XNUmv3oTk0` | 16.9m | override | DECODE Adjustable Shooter \| Vision Estimation \| 12737 Electric Mayhem White \| #firsttechchallenge |
| `dn8hlr_S6dc` | 16.5m | behind-the-bot | 13072 Fellowship of the Robot \| Behind the Bot \| FTC DECODE Robot |
| `W7Dj0a3H8qI` | 16.0m | behind-the-bot | 20153 Silver Wolves \| Behind the Bot \| FTC DECODE Robot |
| `6p3KPNP_Vk0` | 15.8m | behind-the-bot | 16010 Astra Machina \| Behind the Bot \| FTC DECODE Robot |
| `DO_12ErJRqQ` | 15.5m | behind-the-bot | 23521 DeSoto Technix \| Behind the Bot \| FTC DECODE Robot |
| `XV9jSupG1bs` | 15.1m | behind-the-bot | 6962 Pokébolts \| Behind the Bot \| FTC DECODE Robot |
| `277rmvv6BQg` | 14.7m | behind-the-bot | 10084 Team Calamari \| Behind the Bot \| FTC DECODE Robot |
| `zmbXCLjpUag` | 14.3m | override | Double Sided Intakes are DOMINATING DECODE \| FTC FUNalysis |
| `ksdJT6S4EVw` | 13.9m | behind-the-bot | 11525 Minerva's Mechanics \| Behind the Bot \| FTC DECODE Robot |
| `J1LTsyiCLh0` | 13.7m | behind-the-bot | 🤖 FTC 14380 Blue BotBuilders \| Behind the Bot – DECODE |
| `W-PCmLj3Hos` | 13.4m | behind-the-bot | 19434 Redstone \| Behind the Bot \| FTC DECODE Robot |
| `m_5JtN_YlPo` | 13.0m | behind-the-bot | 19141 BraveBots \| Behind the Bot \| FTC DECODE Robot |
| `R6d9MqGzyz4` | 12.9m | behind-the-bot | 772 Golden Dragons \| Behind the Bot \| FTC DECODE Robot |
| `iOMBicgn2JU` | 12.7m | behind-the-bot | 3565 Ghost Robotics \| Behind the Bot \| FTC DECODE Robot |
| `yfVIuF9O-y0` | 12.6m | behind-the-bot | 11228 OverClucked Bots \| Behind the Bot \| DECODE Robot |
| `M72oQuVfxDM` | 11.9m | behind-the-bot | 15083 Overclock \| Behind the Bot \| FTC DECODE Robot |
| `LMi-VYRM5zY` | 11.7m | behind-the-bot | 16965 SUPERCRITICAL \| Behind the Bot \| DECODE Robot |
| `2p25AhpJHW4` | 11.2m | behind-the-bot | 4410 ARC Lightning \| Behind the Bot \| FTC DECODE Robot |
| `1-1cF-6lPxI` | 11.1m | behind-the-bot | 10538 Team KILTS \| Behind the Bot \| DECODE Robot |
| `Ju0pQT1S9lU` | 10.8m | behind-the-bot | 32896 Droid Squad \| Behind the Bot \| FTC DECODE Robot |
| `PpNfFZMulKU` | 10.8m | behind-the-bot | 29999 Weeping Angels \| Behind the Bot \| DECODE Robot |
| `LHPKW3UiLIM` | 10.6m | behind-the-bot | 22045 Power Breakers \| Behind the Bot \| FTC DECODE Robot |
| `uTG6JavIoxI` | 10.3m | behind-the-bot | 15972 TehnoZ \| Behind the Bot \| FTC DECODE Robot |
| `GG1kAISoWbY` | 9.8m | behind-the-bot | 31537 Non-Applicable \| Behind the Bot \| FTC DECODE Robot |
| `fIs96OXbMBk` | 9.8m | behind-the-bot | 24909 StarLight \| Behind the Bot \| FTC DECODE Robot |
| `7v8uT93n96I` | 9.6m | behind-the-bot | 24478 EngiNeerds \| Behind the Bot \| FTC Decode Robot |
| `9k1ym0IUn4E` | 9.5m | behind-the-bot | 19053 Homosapiens \| Behind the Bot \| FTC DECODE Robot |
| `nwmy-Bl6kGQ` | 9.3m | behind-the-bot | 23944 Robolobos Fenrir \| Behind the Bot \| FTC DECODE Robot |
| `6n98Birxhg4` | 9.1m | behind-the-bot | 12611 TechNova \| Behind the Bot \| DECODE Robot |
| `tHgaA30R_q0` | 9.0m | behind-the-bot | 19234 ByteForce \| Behind the Bot \| FTC DECODE Robot |
| `qS9vA0yD_SY` | 8.9m | behind-the-bot | 15993 infO(1)Robotics \| Behind the Bot \| FTC DECODE Robot |
| `JhGftT1k2g0` | 8.8m | unclassified-short | DECODE Artifact Game Piece Scoring Behavior \| #firsttechchallenge |
| `xvjDm1_hIBI` | 8.4m | behind-the-bot | 19088 BROBOTS \| Behind the Bot \| FTC DECODE Robot |
| `OcYtVLsyUpI` | 7.6m | behind-the-bot | 10255 RoboDux \| Behind the Bot \| DECODE Robot |
| `eOU4N3qMV9Y` | 6.9m | behind-the-bot | 21028 The Eagles RO143 \| Behind the Bot \| DECODE Robot |
| `jBoEaaqxXjc` | 6.5m | unclassified-short | Cool Robots of DECODE \| Episode 4 #firsttechchallenge |
| `E784vkpJK-g` | 6.5m | unclassified-short | DECODE Shooting and Intake Prototypes \| #firsttechchallenge |
| `PUZwxe15n6M` | 5.3m | unclassified-short | Cool Robots of DECODE \| Episode 3 |
| `BBFWpYKiKVo` | 4.4m | unclassified-short | Intake and Hopper Prototype from 16460 GEarheads |
| `eAkxvWukRr0` | 4.2m | unclassified-short | Cool Robots of FTC DECODE \| Episode 1 \| #firsttechchallenge |
| `teJucHZgM90` | 3.7m | unclassified-short | Match 9 \| DECODE \| Robot in 30 Hours |
| `aQHZQzB4Lns` | 3.7m | unclassified-short | Match 7 \| DECODE \| Robot in 30 Hours |
| `IzySlgquUfE` | 3.6m | unclassified-short | Match 1 \| DECODE \| Robot in 30 Hours |
| `Rhmif2evY9M` | 3.5m | unclassified-short | Match 5 \| DECODE \| Robot in 30 Hours |
| `BdfNdEqDqeM` | 3.5m | unclassified-short | Match 2 \| DECODE \| Robot in 30 Hours |
| `h2Co7TYitY8` | 3.3m | unclassified-short | MTI 2026 Team Preview \| Multinational Tech Invitational |
| `pSSvMaqaJRs` | 2.2m | snapshot | Double Sided Intake \| 19862 Mecha Mantises \| FTC DECODE Snapshot |
| `sL_SMsF0ehQ` | 2.2m | snapshot | PTO and 2 Joystick Teleop \| 22489 GNCE Diamond \| FTC DECODE Snapshot |
| `jualsM2faqY` | 1.9m | unclassified-short | Robot Overview \| 10355 Project Peacock \| DECODE Pit Stop |
| `Z4BaXnXEFQw` | 1.9m | snapshot | Triple Turret and Targeting \| 15991 Gamma \| FTC DECODE Snapshot |
| `co7io5WqrpI` | 1.8m | snapshot | Durability and Software \| 24180 Blue Bananas \| FTC DECODE Snapshot |
| `B-Np-N-VPG0` | 1.7m | snapshot | Turret Wiring and Robot Programming \| 5477 Innovo \| FTC DECODE Snapshot |
| `Ybx6bWAUr_k` | 1.5m | snapshot | Aerospace Cables for Turret \| 24006 LeXT--Watermelon Why? \| DECODE Snapshot |
| `84jhgqOlPHE` | 1.5m | snapshot | Artifact Arm Stress Relief \| 23161 CyberLIS76 \| FTC Snapshot |
| `pA6zsCNgX8s` | 1.5m | snapshot | Cardboard Hopper Prototype \| 4116 Volta Robotics \| FTC Snapshot #firsttechchallenge |
| `-rvcqYkKpKE` | 1.5m | snapshot | 13201 Team Hazmat \| Ri30H DECODE Robot Snapshot \| #firsttechchallenge |
| `1XRmvpAdQrM` | 1.5m | unclassified-short | FTC DECODE Reactions \| Ri30H \| #firsttechchallenge |
| `a3vcLDE9rLg` | 1.5m | snapshot | Awesome 2 Stage Lift System \| 10273 The Cat in The Hat Comes Back \| FTC Snapshot |
| `-ao-ZQBQm2s` | 1.4m | snapshot | 9 1/2 Inch Robot \| 5962 Nordic Storm \| FTC Snapshot |
| `Gs1Zl4FkmdY` | 1.4m | snapshot | Quick Spin-Up Shooter \| 21239 All Systems Go \| FTC DECODE Snapshot |
| `iZT_aNIQRX0` | 1.4m | snapshot | Drop Down Intake \| 6962 Pokébolts \| FTC DECODE Snapshot |
| `hxjfJdXQECM` | 1.4m | snapshot | Penny Flywheel Weights \| 4017 RoboPandas \| FTC DECODE Snapshot |
| `3keWc2hBhuI` | 1.4m | snapshot | Double Park Lift & Overview \| 21830 Renaissance Raptors \| FTC Snapshot |
| `BBEePFof15U` | 1.4m | snapshot | Intake and Sorting Mechanism \| 24345 SPARKTECH \| FTC DECODE Snapshot |
| `hVrhK_j3m6A` | 1.4m | snapshot | Adjustable Hood and Color Sensor Setup \| 5385 Enigma Riddlers \| FTC Snapshot |
| `9c2Jm0gHI04` | 1.3m | snapshot | Triple Launcher Robot \| 19429 Infrared \| FTC Snapshot |
| `XJ1-DruQBMI` | 1.3m | snapshot | Unique Robot Packaging \| 24697 SANA \| FTC Snapshot |
| `QHBDqUDKjqE` | 1.3m | snapshot | Pivoting Intake & Shooter Combo \| 26691 THUNDER Heads \| FTC Snapshot #firsttechchallenge |
| `eai8TLdFOuU` | 1.3m | snapshot | Custom Wheel Intake and Transfer \| 24697 SANA \| FTC DECODE Snapshot |
| `3wjK0d26TW8` | 1.3m | snapshot | Effective Vectored Intake and Robot Overview \| 33611 OVERTIME \| FTC Snapshot |
| `axYTENDMLmY` | 1.3m | snapshot | Custom Silicon Molded Intake Wheels \| FTC 30405 Clockwork \| Snapshot |
| `xOg39dqqjjk` | 1.2m | snapshot | Two Sided Intake Differential \| 12560 Soft Hoarders \| FTC Snapshot |
| `-XPVexb6CLk` | 1.2m | snapshot | Triple Shooter on a Turret \| 6417 Blu Cru \| DECODE Snapshot |
| `Uw3ujGunZM8` | 1.2m | snapshot | Powerful and Fast Shooter and Hood \| 26075 Vampire Robotics \| FTC Snapshot |
| `ex9anz-_BCs` | 1.2m | snapshot | Quickest Intake in DECODE? \| 3565 Ghost Robotics \| FTC Snapshot |
| `bArAekr6nO4` | 1.2m | snapshot | Shooter Design Breakdown \| 15996 BrickBot \| FTC Snapshot |
| `SUJQsHH_T5s` | 1.1m | snapshot | Two Ways of Intaking \| 25718 Ctrl+Z \| DECODE Snapshot |
| `bHjMcaYzd-8` | 1.1m | snapshot | Auto Tracking Turret and RGB Indicator \| 33444 UlyDala \| FTC Snapshot |
| `ghI6mCjFHXs` | 1.1m | snapshot | Side Shooting Spindexer \| 22017 Eu codez \| FTC Snapshot |
| `dliML1R-1Oc` | 1.1m | snapshot | Floating Rubber Band Intake \| 3650 Limited Liability \| FTC Snapshot |
| `8vBk4FyaO5c` | 1.1m | snapshot | Multi-Functional Lifting Ramp \| 18535 Frozen Code \| FTC Snapshot |
| `EyMp2OKFmDQ` | 1.1m | snapshot | Turret E-Chain \| 12682 The Golden Ratio \| FTC DECODE Snapshot |
| `OxoSCQShwQY` | 1.0m | snapshot | Simple Intake and Shooter Prototype \| 4115 Men in Kilts \| FTC Snapshot #firsttechchallenge |
| `eAAaCHBenNU` | 58s | snapshot | ⚙️ Dual-Sided Intake to Spindexer \| FTC 23213 Snapshot |
| `9El5UcekiR0` | 56s | snapshot | Reliable Shooter With Servo Launcher \| 24909 StarLight \| FTC Snapshot #firsttechchallenge |
| `QXjErjwESdo` | 55s | snapshot | Shooter Gear Ratios and Hopper Servo Gate \| 24345 SPARKTECH \| FTC Snapshot #firsttechchallenge |
| `QiR28E8Br6w` | 54s | snapshot | Double Park Lift Mechanism \| 7 Tactical Sheep \| FTC Snapshot |
| `ktBrOHUxBPc` | 51s | snapshot | Intake and Shooter \| 23400 UFORCE \| FTC DECODE Snapshot |
| `4-04YlSu3uc` | 50s | snapshot | Passive Spindexer Transfer \| 18365 Dapper RoboNoodles \| FTC Snapshot |
| `RY__1DG_ivU` | 48s | snapshot | Expanding Intake \| 365 MOE \| FTC DECODE Snapshot |
| `g8iCaRtVW4k` | 46s | snapshot | Ultra-Wide Intake \| 26115 Alphabots \| FTC Snapshot |
| `mN_nRqa7xY0` | 34s | unclassified-short | Studica Flex Wheel Demo \| Robot in 30 Hours \| #firsttechchallenge |
| `rlCDMVpKP1Y` | 29s | unclassified-short | Intake & Outtake Improvements by 16460 \| #firsttechchallenge |
| `_PA_C0U-QC8` | 29s | unclassified-short | Claw intake for DECODE \| #firsttechchallenge |
| `ANZE5L2qZYQ` | 17s | unclassified-short | DECODE Hopper and Transfer Mech \| #firsttechchallenge |
| `c3lWpihQpv8` | 16s | unclassified-short | Presorted Artifact Flickers by 15972 TehnoZ |
| `T8bplAemc44` | 15s | unclassified-short | Can you guess this FTC Robot? 7/27/26 |
| `E4N2LFZl1O0` | 15s | unclassified-short | Can you guess this FTC Robot? 7/23/26 |
| `tkiPr-K7IjU` | 15s | unclassified-short | Can you guess this FTC Robot? 7/20/26 |
| `dYr-uBjooPE` | 15s | unclassified-short | Can you guess this FTC Robot? 7/14/26 |
| `l6nLhULefnY` | 15s | unclassified-short | 3 Wide Intaking by 32896 Droid Squad |
| `BmnCgrDiqdc` | 15s | unclassified-short | Can you guess this FTC Robot? 7/1/26 |
| `FO3yN0_u5WQ` | 15s | unclassified-short | Can you guess this FTC Robot? 6/26/26 |
| `RewVqT5ds6Y` | 15s | unclassified-short | Can you guess this FTC Robot? 6/19/26 |
| `23mJwPKmTh4` | 15s | unclassified-short | Can you guess this FTC Robot? 6/13/26 |
| `a8WGYGa6uRo` | 15s | unclassified-short | Quiz: Can you guess this FTC Robot? 6/7/26 |
| `njySRj_NonA` | 15s | unclassified-short | Adjustable Back Roller by 21058 Panheya (ᵔ ᵔ) |
| `3vaPwFzxaCo` | 15s | unclassified-short | Transfer Linkage Arm by 15083 Overclock |
| `3bbrrSYdsPE` | 15s | unclassified-short | Vertical Spindexer by 23944 Robolobos Fenrir |
| `QmcBhxAlPaM` | 15s | unclassified-short | Kicker-Roller Wheel for Spindex Transfer by 14503 Robo Sapiens |
| `QxIdw-UV39k` | 15s | unclassified-short | Double Sided Intake and Transfer by 23203 Light Bulb Robotics |
| `uHX_VqEGfl4` | 15s | unclassified-short | Custom Vectored Intake Wheels by 26073 BeaverBots |
| `_P9IVqvlG90` | 15s | unclassified-short | Indexing French Fries by 19668 HiveMind |
| `cCtVzMcioH8` | 15s | unclassified-short | Clutch Mechanism for Artifact Transfer by 19161 BraveBots |
| `UdjpgraSGhA` | 15s | unclassified-short | Transfer Flap by 16166 Watt'S Up |
| `ZnArSzDBd6s` | 15s | unclassified-short | 3D Printed Gears on Bare Motors by 21028 The Eagles RO143 |
| `KbZfXcY0_2c` | 15s | unclassified-short | Intaking into a Spindexer by 12611 TechNova |
| `45eCr9DCwbs` | 15s | unclassified-short | Floating Intake by 10644 CyBugs |
| `VtQN2eLXO1s` | 15s | unclassified-short | Easy-Access Hinged Turret by 11228 OverClucked Bots |
| `xurehBdnrdg` | 15s | unclassified-short | Insane Parking Flipper by 10255 RoboDux |
| `Fo-U0qzeyMA` | 15s | unclassified-short | This Impressive 360 Turret with Cable Chain by 26000 Theseus lead to a WAC at AUS Nationals! |
| `O2ATrRc3aWc` | 15s | unclassified-short | Rubber Band Transfer by 15972 TehnoZ |
| `rC4jJrwn-NI` | 14s | unclassified-short | One Way Bearing by 26000 Theseus |
| `UkhK9FdK_oo` | 14s | unclassified-short | Hood Gearing by 3565 Ghost Robotics |
| `jSYdIQS-QhE` | 14s | unclassified-short | Over Center Hood Adjuster by 23224 Cheesy Bytes |
| `r6YpztC2dpE` | 14s | unclassified-short | Hood Adjusting Linkage by 21087 Velocity |
| `OldDrHSwoLc` | 14s | unclassified-short | Launcher Hard Stop by 31537 Non- Applicable |
| `9AWKvpPu9o0` | 14s | unclassified-short | Intake Bumper by 15993 infO(1)Robotics |
| `_p7OF_GeYH8` | 14s | unclassified-short | Custom Intake Wheels by 30355 Black Box |
| `RIymQYiBOVc` | 14s | unclassified-short | Double Barrel Sorter by 13072 Fellowship of the Robot |
| `URjWAxjt4ws` | 14s | unclassified-short | Left-Right Artifact Sorter by 21229 Quality Control |
| `FYE7VLnBNd4` | 14s | unclassified-short | Custom Adjustable Shooter Hood by 19088 BROBOTS |
| `Yn3HeU5-CXA` | 13s | unclassified-short | Dead Axle Intake by 18221 Meta^Infinity |
| `JAdPWYbCWjs` | 13s | unclassified-short | Carbon Fiber Rod Turret Supports by 23511 Seattle Solvers |
| `qrNBkL6PzwE` | 13s | unclassified-short | Link and Lever Mechanism for Elevator by 15104 Static Eagles |
| `-qgnsHLOgJM` | 12s | unclassified-short | Flipping Double Park by 19256 CyberMoon |
| `wsQqyf4d1ew` | 12s | unclassified-short | Purposeful Motor Backlash by 19066 AiCitizens |
| `lTfMQlcEH50` | 12s | unclassified-short | Cut Flex Wheel Intake Demo by 21171 ITKAN Lunar |
| `6HzkStmCMWQ` | 11s | unclassified-short | Turret Cable Management by 23521 DeSoto Technix |
| `g6pgyY5p384` | 11s | unclassified-short | 2-Servo Robot Lift by 16917 Gear Wizards |
| `rHTkfsp_0OQ` | 11s | unclassified-short | Scoring Cycle Demo by 16010 Astra Machina |
| `PrpxeyfXM9k` | 10s | unclassified-short | Lightning Fast Diverter Demo by 19564 ITKAN Solar |
| `3ViPbFq1eDM` | 10s | unclassified-short | String and Bungee Artifact Blocker Mech by 12808 RevAmped Robotics |
| `9GElbMhJ5I8` | 10s | unclassified-short | Ultra Fast Spindexer by 19116 VV Robots |
| `fnZ_41ZeTPc` | 10s | unclassified-short | Dual Flipper Design by 25751 Dread Pirate Robotics |
| `yKGi1JEzrO8` | 9s | unclassified-short | Speedy Vectored Intake by 6962 Pokébolts #firsttechchallenge |
| `H9N1Fr2AFpo` | 9s | unclassified-short | 3 Piece Auto by 16460 GEarheads  \| #firsttechchallenge |
