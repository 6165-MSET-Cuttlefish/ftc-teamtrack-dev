# Ingest handoff — developer-1

**To developer-1's Claude.** You are downloading and captioning one slice of an
FTC YouTube playlist, to build training data for a model that describes robot
mechanisms. Other developers have their own slices; **only do the videos listed
at the bottom of this file.**

Read [`PLAN-youtube-ingest.md`](../PLAN-youtube-ingest.md) for the reasoning, and
[`../../../HANDOFF.md`](../../../HANDOFF.md) for the state of the tuning work
overall. Everything below was generated — **verify it rather than trusting it**,
and raise anything that looks wrong instead of working around it.

## Your slice

- **161 videos**, ~8.9 GB
- 101 short (≤3 min) — one mechanism, caption directly
- 60 long (>3 min) — multi-mechanism, **must be segmented first**

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
| `DHJNzojpPEg` | 58.3m | top25 | FTC Top 25 \| DECODE \| February - Presented by Studica Robotics |
| `XVzCgsgozmg` | 47.5m | top25 | FTC Top 25 \| DECODE \| January - Presented by Studica Robotics |
| `c2w7u7a0qM0` | 43.4m | override | Day 1 Recap \| 9 FTC DECODE Robots \| Robot in 30 Hours \| #firsttechchallenge |
| `PaQhs7qaMBA` | 23.1m | behind-the-bot | 21171 ITKAN Lunar \| Behind the Bot \| FTC DECODE Robot |
| `K_leotla7co` | 22.3m | open-alliance | Innovative Turret Options for DECODE \| 3188 Squiggle Splat Bang \| FTC Open Alliance Show |
| `LoU7EZCF1cM` | 21.8m | open-alliance | DECODE Coaxial Swerve and Impressive Transfer Process \| 23511 Seattle Solvers \| FTC OA Show |
| `phrrq8zaOAU` | 21.3m | open-alliance | PID Shooter Tuning & Custom Planetary Gearbox \| 19075 Clockworks \| FTC OA Show #firsttechchallenge |
| `xusN9ZAENZw` | 20.3m | behind-the-bot | 19745 Turtle Walkers \| Behind the Bot \| DECODE Robot |
| `wlRhoOZ8ZR0` | 19.2m | behind-the-bot | 11260 Up-A-Creek Robotics \| Behind the Bot \| FTC DECODE Robot |
| `nqk4ng-xfbg` | 19.1m | open-alliance | Vision Tracking \| 2 Robot Park Prototype \| 12736 Electric Mayhem Green \| FTC Open Alliance |
| `O2zHFFIedcI` | 18.1m | behind-the-bot | 26000 Theseus \| Behind the Bot \| FTC DECODE Robot |
| `vPw_y3XOVXU` | 17.8m | open-alliance | Custom Spindexer \| Turret & Intake Assembly \| 14596 XLR8 FTC OA Show #firsttechchallenge |
| `lo8UIfuKYCM` | 17.4m | behind-the-bot | 11444 Garnet Squadron \| Behind the Bot \| FTC DECODE Robot |
| `jD7gIYiTWSQ` | 17.3m | behind-the-bot | 18270 RoboPlayers \| Behind the Bot \| FTC DECODE Robot |
| `OcMV_pZJmvA` | 17.1m | behind-the-bot | 15996 BrickBot \| Behind the Bot \| DECODE Robot |
| `7IuDxVvBye0` | 16.5m | behind-the-bot | 23641 Cuberobot \| Behind the Bot \| FTC DECODE Robot |
| `TD1ywruOkbg` | 16.1m | behind-the-bot | 21229 Quality Control \| Behind the Bot \| DECODE Robot |
| `DiWEMH436hY` | 15.9m | behind-the-bot | 14270 Quantum Robotics \| Behind the Bot \| FTC Decode Robot |
| `YLt-6QYljFA` | 15.5m | behind-the-bot | 19564 ITKAN Solar \| Behind the Bot \| FTC DECODE Robot |
| `H-uZWlvg51U` | 15.1m | behind-the-bot | 23203 Light Bulb Robotics \| Behind the Bot \| FTC DECODE Robot |
| `YHMd6lpBCGQ` | 15.0m | behind-the-bot | 21087 Velocity \| Behind the Bot \| FTC DECODE Robot |
| `GoBkywvcwV8` | 14.3m | behind-the-bot | 17861 CSH \| Behind the Bot \| FTC DECODE Robot |
| `aBTY3Rc27O8` | 14.2m | behind-the-bot | 22437 Demon Dogs \| Behind the Bot \| DECODE Robot |
| `Vzbz1s5H9wc` | 13.8m | behind-the-bot | 19066 AiCitizens \| Behind the Bot \| FTC Decode Robot |
| `GFXoEtIMY48` | 13.5m | behind-the-bot | 23511 Seattle Solvers \| Behind the Bot \| FTC DECODE Robot |
| `rxDWmjOMJf8` | 13.2m | open-alliance | Intake, Shooter Progression & 3D Printing \| 13598 MOBots & 15357 MOreBots \| FTC Open Alliance Show |
| `n7z21Dw_YN4` | 12.9m | behind-the-bot | 30355 Black Box \| Behind the Bot \| FTC DECODE Robot |
| `26ytEhG80K8` | 12.8m | behind-the-bot | 11146 Barker Redbacks \| Behind the Bot \| DECODE Robot |
| `fZeT4VeyaVY` | 12.5m | behind-the-bot | DECODE $1000 BaseBot+ \| Behind the Bot  #firsttechchallenge |
| `H6qOsrN_1yI` | 11.5m | behind-the-bot | 18221 Meta^Infinity \| Behind the Bot \| FTC DECODE Robot |
| `aQj4Ps160AQ` | 11.1m | behind-the-bot | 25751 Dread Pirate Robotics \| Behind the Bot \| DECODE Robot |
| `TPqli98KcnM` | 10.9m | behind-the-bot | 23361 Cosmobotics \| Behind the Bot \| FTC DECODE Robot |
| `YnfeU8vTXnw` | 10.9m | behind-the-bot | 19256 CyberMoon \| Behind the Bot \| EU Premiere WAC |
| `a4HCmTSc78w` | 10.0m | behind-the-bot | 23286 Lazer Robotics \| Behind the Bot \| FTC DECODE Robot |
| `ZTWlN25KUQg` | 10.0m | behind-the-bot | 10809 Crow Force \| Behind the Bot \| FTC DECODE Robot |
| `pNP6fObvN9M` | 9.7m | behind-the-bot | 15104 Static Eagles \| Behind the Bot \| DECODE Robot |
| `NaK2Oimd_Q0` | 9.7m | behind-the-bot | 19116 VV Robots \| Behind the Bot \| FTC DECODE Robot |
| `cztugXsD7Zw` | 9.7m | behind-the-bot | 11148 Barker Greybacks \| Behind the Bot \| DECODE Robot |
| `7Pf5MIiNa80` | 9.4m | behind-the-bot | 14906 Leviathan Robotics \| Behind the Bot \| FTC DECODE Robot |
| `OIGn71kIfvo` | 9.3m | behind-the-bot | 21050 MasterMinds \| Behind the Bot \| FTC DECODE Robot |
| `Y-Z5lVKryAo` | 9.2m | behind-the-bot | 10644 CyBugs \| Behind the Bot \| DECODE Robot |
| `YEhCZJgFCcE` | 9.1m | unclassified-short | DECODE Essential Resources for FTC Teams \| #firsttechchallenge |
| `DldlG1MBKKo` | 8.8m | behind-the-bot | 21058 Panheya (ᵔ ᵔ) \| Behind the Bot \| FTC DECODE Robot |
| `PK4CWQifoDI` | 8.8m | behind-the-bot | 19668 HiveMind \| Behind the Bot \| FTC DECODE Robot |
| `hmNTCFHNYKY` | 8.6m | behind-the-bot | 26073 BeaverBots \| Behind the Bot \| FTC DECODE Robot |
| `sw7XmXNju-c` | 8.5m | behind-the-bot | 14503 Robo Sapiens \| Behind the Bot \| FTC DECODE Robot |
| `l6_ZdDAqZD0` | 8.2m | behind-the-bot | 23636 Pymble Bees \| Behind the Bot \| DECODE Robot |
| `TDLQgQZrlh4` | 7.8m | behind-the-bot | 16166 Watt'S Up \| Behind the Bot \| FTC DECODE Robot |
| `inHrpEtWU_M` | 6.8m | unclassified-short | Sweeper Intake Options for DECODE \| #firsttechchallenge |
| `42wKWXjsYD8` | 6.8m | unclassified-short | Awesome Double Park Lift \| Cool Robots of DECODE Episode 5 |
| `UZ1NYPPN1lg` | 5.6m | unclassified-short | Intake & Outtake Improvements by 16460 GEarheads \| #firsttechchallenge |
| `hYe_oHoNsCs` | 5.3m | behind-the-bot | 25538 ARRA \| Behind the Bot \| DECODE Robot |
| `F-9oHaB-dKY` | 4.7m | unclassified-short | DECODE Hopper and Transfer Prototypes \| #firsttechchallenge |
| `sJ4_bGeKjc8` | 4.2m | unclassified-short | Cool Robots of DECODE \| Episode 2 |
| `oPVnVJPBVG0` | 3.7m | unclassified-short | Match 11 \| DECODE \| Robot in 30 Hours |
| `FDMmdLyQPCw` | 3.7m | unclassified-short | Match 8 \| DECODE \| Robot in 30 Hours |
| `5oRvq8K9SQc` | 3.6m | unclassified-short | Match 10 \| DECODE \| Robot in 30 Hours |
| `EHPdzeXqAUk` | 3.5m | unclassified-short | Match 3 \| DECODE \| Robot in 30 Hours |
| `guDS8nkkKmE` | 3.5m | unclassified-short | Match 4 \| DECODE \| Robot in 30 Hours |
| `NAj7ThVw4aU` | 3.4m | unclassified-short | Match 6 \| DECODE \| Robot in 30 Hours |
| `qqovSjvvPsU` | 3.0m | snapshot | Lifting PTO Robot Overview \| 19660 Sigma \| FTC DECODE Snapshot |
| `zVcva35oa3Y` | 2.1m | snapshot | Swingarm and Grabdexer \| 19376 Thermal Equilibrium \| FTC DECODE Snapshot |
| `kf2hkcsByFE` | 1.9m | snapshot | Locking Mecanum Wheel System \| 19082 RoboAS \| FTC DECODE Snapshot |
| `9pjv1uvyWvU` | 1.9m | snapshot | Triangle Spindexer \| 22105 Runtime Terror \| FTC DECODE Snapshot |
| `QqBVVHkXy14` | 1.7m | snapshot | Shooter Motion Library \| 8721 Mighty Mechanics \| FTC DECODE Snapshot |
| `coU8EhQjzys` | 1.7m | snapshot | No Counter Rollers and Shooter Autopathing \| 23305 Creative Minds \| FTC DECODE Snapshot |
| `t8XeBKfgpkM` | 1.5m | snapshot | Super Modular Robot \| 25609 LOAD Robotics \| FTC DECODE Snapshot |
| `TGv-1Z8FLFY` | 1.5m | unclassified-short | DECODE is Here \| FTC in 90 #firsttechchallenge |
| `9iedPayPGjg` | 1.5m | snapshot | Vertically Transferring Intake \| 25068 Raptoria \| FTC Snapshot |
| `4Gmfqk-p6yY` | 1.5m | unclassified-short | Robot in 30 Hours \| Studica Parts Unboxing \| #firsttechchallenge |
| `p0t4EifPxpg` | 1.4m | unclassified-short | Team Updates and the FTC Everybot \| FTC in 90 #firsttechchallenge |
| `fXd2FdsH9EA` | 1.4m | snapshot | Double Sided Intake and Unique Features \| 19013 G-Force \| FTC DECODE Snapshot |
| `P69GnVtQ-j8` | 1.4m | snapshot | Revolving Vertical Spindexer \| 17860 Helix \| FTC Snapshot |
| `1iJI4r8ROiw` | 1.4m | snapshot | Efficient Intake + Shooter 19163 MLP \| FTC Snapshot |
| `w3wsWzTmRp0` | 1.4m | snapshot | Articulating Ramp and LED Indicators \| 23786 MakEMinds \| FTC Snapshot |
| `CrJdn1BjDkA` | 1.4m | snapshot | Carousel Mechanism \| 19502 The Moment Makers \| FTC DECODE Snapshot |
| `t8FTm0Gbc4E` | 1.3m | snapshot | Shooter Engineering Process \| 23644 Skeleton Army \| FTC DECODE Snapshot |
| `1QVC86mq2mE` | 1.3m | snapshot | Ratcheting Kickstand Mechanism \| 11444 Garnet Squadron \| FTC Snapshot |
| `McdWqsZS-jo` | 1.3m | snapshot | 'Macaroni' Mat & Intake System \| 11618 Chelsea Gremlins \| FTC Snapshot |
| `msqNySX0hiI` | 1.3m | snapshot | Custom Bumpers & TPU Star Intake \| 30529 Curiosity Robotics \| FTC Snapshot |
| `nDCPArnD_hY` | 1.3m | snapshot | Robot Bumpers and Autonomous Localization \| 10653 Dragatrons \| FTC Snapshot |
| `kdf1kv31NdI` | 1.3m | snapshot | Passive Spindexer Sorting System \| 12808 RevAmped Robotics \| FTC DECODE Snapshot |
| `8ek7cVmwnKE` | 1.3m | snapshot | Intake Flap and PedroPathing \| 23345 The Sterling Stormers \| FTC Snapshot |
| `0rBDQdHz-eU` | 1.3m | snapshot | 🚀 FTC 18228 Red Botbuilders \| Snapshot |
| `KqeF4Tt8FIg` | 1.2m | snapshot | Spindexer and Passive Transfer \| 24033 Alphatronic \| FTC DECODE Snapshot |
| `ezYOwPQHhSY` | 1.2m | snapshot | Gate Opener and Tilt Parking Mech \| 25916 EngiNeerds NextGen \| FTC Snapshot |
| `issMDjEgpCA` | 1.2m | snapshot | Kickstand Parking Mech \| 21455 RoSophia \| FTC Snapshot |
| `F6fRFgq2Rv0` | 1.2m | snapshot | Wood and Metal Chassis Construction \| 27072 Tech Outlaws \| FTC Snapshot |
| `dH7UK_JyMrg` | 1.2m | snapshot | Mechanical Integrations with Control Systems \| 9879 Root Negative One \| FTC DECODE Snapshot |
| `swduQEnQL1Y` | 1.1m | snapshot | Counter Roller Shooter \| 25779 Action Robotix \| FTC DECODE Snapshot |
| `ZzzLtBSx-kI` | 1.1m | snapshot | Auto Tracking System \| 19062 Phantom Robotics \| FTC Snapshot |
| `453CdPtpRPs` | 1.1m | snapshot | Double Stage Flexible Intake and Vision \| 21058 Panheya (ᵔ ᵕ ᵔ) \| FTC Snapshot |
| `rp2ip8PFFho` | 1.1m | snapshot | Mecanum Flywheels \| 25528 Nomadic.Dragons.FTC \| FTC Snapshot |
| `G0jAlOgIxMA` | 1.1m | snapshot | Motor Gearbox on a Servo \| 26949 Royal Society of Robotics \| FTC Snapshot |
| `kunUgsxzkc4` | 1.1m | snapshot | Simple Automated Control \| 33422 Sirius \| FTC Snapshot |
| `c4klP97IJvw` | 1.1m | snapshot | Vertical Magazine Spindexer \| 16714 Dread Bolts \| FTC Snapshot |
| `ZtSqeeeNPXE` | 1.0m | snapshot | Insanely Fast Turret \| 5189 Wolves Robotics \| DECODE Snapshot |
| `JdELefRFDDw` | 57s | snapshot | 3 Axon Turret \| 25943 HIVE Robotics \| FTC Snapshot |
| `DP3dIHbJHV4` | 55s | snapshot | Everybot Inspired DECODE Robot \| 30326 FUTURE VORTEX \| FTC Snapshot |
| `1Hyc2Tk0RDs` | 54s | snapshot | DECODE Prototype Shooter \| 25538 ARRA \| FTC Snapshot #firsttechchallenge |
| `f0dZ3te9LTM` | 53s | snapshot | Reverse Shooter Human Player Intake \| 5553 RoboComets \| FTC Snapshot |
| `ZhblpuVFang` | 52s | unclassified-short | Studica Intake Hub Kit \| Robot in 30 Hours \| #firsttechchallenge |
| `SQkQYoECGEw` | 50s | snapshot | PTO Boxtube Lift \| 25620 Hexadecimal Nibble \| FTC DECODE Snapshot |
| `aDY7wthjMog` | 49s | snapshot | Sick Artifact Spindexer \| 26085 Binary Builders \| FTC Snapshot |
| `YgWjVzkufr0` | 47s | snapshot | Steel Bumpers \| 30303 Rebel Automaton \| DECODE Snapshot |
| `llqfSMo64kc` | 43s | snapshot | Powered Compression Arm \| 24909 StarLight \| FTC DECODE Snapshot |
| `hqrj-tnYsOA` | 32s | unclassified-short | FTC DECODE Shooting and Intake Prototypes \| #firsttechchallenge |
| `eLswY-s2nDo` | 31s | unclassified-short | DECODE Robot in 30 Hours Day 2 \| #firsttechchallenge |
| `-G97dvQ97dg` | 18s | unclassified-short | DECODE Artifact Strange Interaction \| #firsttechchallenge |
| `-oHyDRBEQ_8` | 16s | reveal | DECODE Reveal Night Teaser \| FTC Championship Hype |
| `pVxMvbOczyQ` | 15s | unclassified-short | Can you guess this FTC Robot? 7/28/26 |
| `Zf10LHM7IAA` | 15s | unclassified-short | Can you guess this FTC Robot? 7/25/26 |
| `wjwThQGSXG4` | 15s | unclassified-short | Intake Sensor by 11329 I.C.E. Robotics |
| `GXIb5Q4DJfw` | 15s | unclassified-short | Can you guess this FTC Robot? 7/18/26 |
| `Zs8L8N-LM_g` | 15s | unclassified-short | Can you guess this FTC Robot? 7/12/26 |
| `uYaim4vYeTo` | 15s | unclassified-short | Can you guess this FTC Robot? 7/7/26 |
| `lszHlhnzNak` | 15s | unclassified-short | Can you guess this FTC Robot? 7/5/26 |
| `Ll-wUHuNnvU` | 15s | unclassified-short | Can you guess this FTC Robot? 6/29/26 |
| `URXSqOzmrDg` | 15s | unclassified-short | Can you guess this FTC Robot? 6/22/26 |
| `dDcOZbnExbI` | 15s | unclassified-short | Can you guess this FTC Robot? 6/16/26 |
| `xiK-f7bsIOc` | 15s | unclassified-short | Can you guess this FTC Robot? 6/10/26 |
| `vohuqAG7jAQ` | 15s | unclassified-short | Quiz: Can you guess this FTC Robot? 6/2/26 |
| `AzptiubjJdg` | 15s | unclassified-short | Driver Communication Trick by 10084 Team Calamari |
| `odlBnjTNBLw` | 15s | unclassified-short | LED Indicator Screen by 4410 ARC Lightning |
| `sLtFNDWQA-A` | 15s | unclassified-short | 3 Wheel Swerve Drive by 25538 ARRA |
| `BwYOI7K1ZIo` | 15s | unclassified-short | Linear Artifact Indexer Mech by 22437 Demon Dogs |
| `j0oj2ZLH_2I` | 15s | unclassified-short | Vectorized Anti-Jam Intake Geometry by 15996 BrickBot |
| `gIuiRAKTk60` | 15s | unclassified-short | Double Carriage Ball Sorter by 24478 EngiNeerds |
| `41bTB8-1uXA` | 15s | unclassified-short | Spindexer Demo by 11148 Barker Greybacks |
| `WVCewteIt3c` | 15s | unclassified-short | Removable Intake by 14906 Leviathan Robotics |
| `f6rPhIk5MIU` | 15s | unclassified-short | DECODE Sweeper Intake Prototype \| #firsttechchallenge |
| `Hll8TunF9PA` | 14s | unclassified-short | Breaking System by 23286 Lazer Robotics |
| `h61zoiO8Wos` | 14s | unclassified-short | 30 to 50 Degree Angled Hood by 22045 Power Breakers |
| `CCOY_m0eFNo` | 14s | unclassified-short | Retractable Traction Wheels by 19434 Redstone |
| `xtWWWjAfWcY` | 14s | unclassified-short | Lift Magnet by 19234 ByteForce |
| `giPR6kiesC4` | 14s | unclassified-short | Governors Cup is MASSIVE \| FTC DECODE |
| `6wefbe7WZas` | 14s | unclassified-short | Transfer to Flywheel Momentum by 21050 MasterMinds |
| `B5MoIHP4294` | 14s | unclassified-short | Triple Artifact Flicker by 10538 Team KILTS |
| `RUdkdoj0-U8` | 14s | unclassified-short | Anti Defense Brakes by 29999 Weeping Angels |
| `ZIUDty5Tr0Q` | 14s | unclassified-short | Overlake Robotics Path Planner by 16965 SUPERCRITICAL |
| `vPYn3Q5Akho` | 14s | unclassified-short | Intake Demo by 11146 Barker Redbacks |
| `0FJ5K97WBbw` | 14s | unclassified-short | Shooter Hood Positions by 23636 Pymble Bees |
| `mctH_4te76Y` | 14s | unclassified-short | Clever Robot-Lifting Mechanism by 19053 Homosapiens |
| `0o9srDn4Tkc` | 14s | unclassified-short | Triple Indexing Flicker by 14380 Blue BotBuilders |
| `duKlveURqwU` | 13s | unclassified-short | In-Robot Sorting System by 14270 Quantum Robotics |
| `O5roLQ3AqYE` | 12s | unclassified-short | Automatic Shooter Sequence by 11444 Garnet Squadron |
| `AVxZEu3JR-s` | 12s | unclassified-short | Vectored Intake by 23361 Cosmobotics |
| `k42GwXrWB70` | 12s | unclassified-short | 2 Rotation Turret Cable Management by 30030 Exodus |
| `uqJ0vg_Cs7s` | 12s | unclassified-short | Easy to Install Turret by 772 Golden Dragons |
| `1im3sYznKms` | 12s | unclassified-short | Hybrid Transfer by 20265 Heart of RoBots |
| `ZGE86bB2_JM` | 12s | unclassified-short | Artifact Recycler by 23849 Droid Force |
| `r0yWxSi0Wx0` | 12s | unclassified-short | Transfer Color Sensors by 11525 Minerva's Mechanics |
| `Wy1hhmanaeQ` | 12s | unclassified-short | Shooter Counter Rollers by 23641 Cuberobot |
| `Ry1FMwCeCSc` | 12s | unclassified-short | Mecanum Intake Wheels by 23435 Gyrobotic Droids |
| `lxC0Gj44K24` | 12s | unclassified-short | $1000 BaseBot+ Intake by 23070 Royal Turtles #firsttechchallenge |
| `7mMWBV4anBw` | 11s | unclassified-short | Transfer RPMs by 10809 Crow Force |
| `l1MtBwHrxm4` | 11s | unclassified-short | Foam Bar as a Counter Roller by 24909 StarLight |
| `Ffo0ZongYso` | 10s | unclassified-short | Corkscrew Intake Wheel by 11260 Up-A-Creek Robotics |
| `ucvBRFGXeWk` | 9s | unclassified-short | 3 Ball Intake Limit by 17861 CSH |
| `j4_Hwfb3HpM` | 9s | unclassified-short | Shooting on the Move by 19745 Turtle Walkers |
| `1fnKFT0cgyg` | 9s | unclassified-short | Spindexer Demo by 18270 RoboPlayers #firsttechchallenge |
