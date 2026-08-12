/**
 * split-work.mjs — divide the keeper list between developers and write a
 * handoff document for each of their Claudes.
 *
 *   node tuning/ingest/split-work.mjs alice bob carol dave
 *
 * Reads  tuning/data/ingest/videos.json
 * Writes tuning/data/ingest/assignments.json
 *        tuning/ingest/HANDOFF-<name>.md   (one per developer)
 *
 * Balancing is by estimated MEGABYTES, not video count — the sizes span 0.4 MB
 * to ~500 MB, so an even count would be a wildly uneven download. Videos are
 * also spread across kinds so nobody gets only long segment-heavy episodes.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(HERE, '..', 'data', 'ingest');

const names = process.argv.slice(2);
if (names.length < 1) {
  console.error('usage: node tuning/ingest/split-work.mjs <name> [name ...]');
  process.exit(1);
}

const { videos } = JSON.parse(fs.readFileSync(path.join(DATA, 'videos.json'), 'utf8'));

// Greedy bin-packing: biggest first into whoever currently has the least.
const bins = names.map((name) => ({ name, mb: 0, videos: [] }));
for (const v of [...videos].sort((a, b) => (b.estMb || 0) - (a.estMb || 0))) {
  const bin = bins.reduce((min, b) => (b.mb < min.mb ? b : min), bins[0]);
  bin.videos.push(v);
  bin.mb += v.estMb || 0;
}
for (const b of bins) b.videos.sort((a, b2) => (b2.durationSec || 0) - (a.durationSec || 0));

fs.writeFileSync(
  path.join(DATA, 'assignments.json'),
  `${JSON.stringify(
    {
      generated: 'run split-work.mjs to regenerate',
      developers: bins.map((b) => ({
        name: b.name,
        videoCount: b.videos.length,
        estMb: b.mb,
        videos: b.videos.map((v) => ({
          videoId: v.videoId,
          title: v.title,
          durationSec: v.durationSec,
          kind: v.kind,
          status: 'todo',
        })),
      })),
    },
    null,
    1,
  )}\n`,
);

const fmtDur = (d) => (d >= 60 ? `${(d / 60).toFixed(1)}m` : `${Math.round(d)}s`);

for (const bin of bins) {
  const long = bin.videos.filter((v) => v.durationSec > 180);
  const short = bin.videos.filter((v) => v.durationSec <= 180);
  const table = bin.videos
    .map((v) => `| \`${v.videoId}\` | ${fmtDur(v.durationSec)} | ${v.kind} | ${v.title.replace(/\|/g, '\\|')} |`)
    .join('\n');

  fs.writeFileSync(
    path.join(HERE, `HANDOFF-${bin.name}.md`),
    `# Ingest handoff — ${bin.name}

**To ${bin.name}'s Claude.** You are downloading and captioning one slice of an
FTC YouTube playlist, to build training data for a model that describes robot
mechanisms. Other developers have their own slices; **only do the videos listed
at the bottom of this file.**

Read [\`PLAN-youtube-ingest.md\`](../PLAN-youtube-ingest.md) for the reasoning, and
[\`../../../HANDOFF.md\`](../../../HANDOFF.md) for the state of the tuning work
overall. Everything below was generated — **verify it rather than trusting it**,
and raise anything that looks wrong instead of working around it.

## Your slice

- **${bin.videos.length} videos**, ~${(bin.mb / 1024).toFixed(1)} GB
- ${short.length} short (≤3 min) — one mechanism, caption directly
- ${long.length} long (>3 min) — multi-mechanism, **must be segmented first**

## Setup

\`\`\`bash
git clone <repo> && cd ftc-teamtrack-dev
git checkout experiment/module-feedback-poc
cd experiments/module-feedback && npm install
brew install yt-dlp        # or: pipx install yt-dlp
\`\`\`

## Download

Videos go to \`dev-videos/\` (gitignored — **never commit video files**).
Filenames are the YouTube ID so everyone's names match.

\`\`\`bash
yt-dlp --no-playlist --restrict-filenames \\
  -f "bv*[height<=1080][ext=mp4]+ba[ext=m4a]/b[height<=1080][ext=mp4]/bv*+ba/b" \\
  --merge-output-format mp4 \\
  -o "dev-videos/%(id)s.%(ext)s" \\
  --write-subs --write-auto-subs --sub-langs "en.*" --sub-format vtt \\
  "https://www.youtube.com/watch?v=<ID>"
\`\`\`

\`--no-playlist\` matters — these IDs belong to a 368-video playlist and without
it yt-dlp will pull the whole thing.

**Keep the \`.vtt\` timestamps.** The cue times are how long videos get segmented.
Do not flatten subtitles to prose.

## Captions

**One file per video** — \`tuning/data/captions/<videoId>.json\`. Do **not** add to
the shared \`captions.json\`: it has caused three git conflicts and silently
deleted 14 captions once. Per-file removes the failure mode entirely.

\`\`\`json
{ "videoId": "abc123", "clip": "abc123.mp4",
  "caption": "hinged intake, full-width, vector wheels on ends, compliant wheels in middle, intakes 3 balls from center",
  "source": "human", "reviewed": true }
\`\`\`

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

1. Read the \`.vtt\` **with timestamps** and find where the speaker moves between
   mechanisms ("moving on to our shooter…").
2. Cut with ffmpeg: \`ffmpeg -ss <start> -to <end> -i <id>.mp4 -c copy <id>_<mech>.mp4\`
3. Caption each segment separately.

A 20-minute "Behind the Bot" episode should yield roughly 5–10 clips.

## Reviewing

\`\`\`bash
yarn ui        # or: yarn dev  → http://localhost:8080/dev/videos
\`\`\`

Both show the clip next to its caption. Uncaptioned items sort to the top.

## Rules

1. **Never commit video files.** They're gitignored; keep it that way.
2. **Put the videos in shared storage** (ask where) as well as locally. Captions
   sync through git but videos don't — that's exactly why the project currently
   has 100 captions and only 55 usable pairs.
3. **\`git pull\` before you start and before you push.**
4. **Don't spend money.** Vertex billing is deliberately unlinked. Downloading
   and captioning cost nothing; tuning does, and that needs the project owner.
5. **Ask rather than guess** if a video doesn't match its assignment, a caption
   is ambiguous, or a mechanism is unfamiliar.

## Your videos

| ID | Length | Kind | Title |
| --- | --- | --- | --- |
${table}
`,
  );
}

console.log(`  split ${videos.length} videos across ${bins.length} developer(s):\n`);
for (const b of bins) {
  const long = b.videos.filter((v) => v.durationSec > 180).length;
  console.log(
    `    ${b.name.padEnd(12)} ${String(b.videos.length).padStart(4)} videos  ` +
      `~${(b.mb / 1024).toFixed(1)} GB  (${long} need segmenting)`,
  );
}
console.log(`\n  wrote assignments.json + ${bins.length} HANDOFF-*.md`);
