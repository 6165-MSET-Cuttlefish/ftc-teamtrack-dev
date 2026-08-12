/**
 * filter.mjs — decide which playlist videos are worth downloading.
 *
 *   node tuning/ingest/filter.mjs
 *
 * Reads  tuning/data/ingest/playlist-raw.json   (from `yt-dlp --flat-playlist`)
 * Writes tuning/data/ingest/videos.json         (keepers, with reasons)
 *        tuning/data/ingest/rejected.json       (drops, with reasons)
 *
 * Classification is by SERIES NAME, not topic keywords. Topic keywords proved
 * unreliable — they buried "Behind the Bot" inside a "tutorial" bucket and
 * flagged an Open Alliance episode as a strategy talk. The format of a series is
 * a far better predictor of whether a video contains robot-mechanism footage
 * than what the title happens to be about.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(HERE, '..', 'data', 'ingest');

/** Series that reliably show robots. Checked BEFORE the reject rules. */
const KEEP_SERIES = [
  { re: /behind the bot/i, kind: 'behind-the-bot' },
  { re: /\bsnapshot\b/i, kind: 'snapshot' },
  { re: /open alliance|\boa show\b/i, kind: 'open-alliance' },
  { re: /top 25|top 15/i, kind: 'top25' },
  { re: /reveal/i, kind: 'reveal' },
];

/** Series that are reliably people talking. */
const TALK_SERIES = [
  // "FUNaylsis" is a real typo in one source title — match both spellings.
  { re: /funalysis|funaylsis/i, why: 'FUNalysis (match commentary)' },
  { re: /game ?play analysis/i, why: 'gameplay analysis' },
  { re: /ftc live/i, why: 'FTC Live (studio panel)' },
  { re: /rewind episode|history of/i, why: 'archival/history' },
  { re: /q&a|head referee/i, why: 'rules Q&A' },
  { re: /\binterview\b/i, why: 'interview' },
  { re: /schedule release|predictions/i, why: 'schedule/predictions' },
  { re: /strategy and design discussion/i, why: 'discussion format' },
];

/**
 * Explicit overrides, with reasons. Kept visible rather than buried in regex so
 * a human can audit and argue with them.
 */
const FORCE_KEEP = new Map([
  // FUNalysis by series, but the whole subject is intake design — expect
  // close-ups of multiple teams' intakes with narration naming the parts.
  ['Double Sided Intakes are DOMINATING DECODE', 'on-topic: intake design'],
  // Named team + named mechanisms; a robot walkthrough that matches no series.
  ['DECODE Adjustable Shooter', 'on-topic: named team mechanism'],
  // Multi-robot showcase (9 robots) — same shape as Top 25, needs segmenting.
  ['Day 1 Recap', 'multi-robot showcase'],
]);

const MAX_SECONDS = 3600; // >=1h are streams/marathons: poor label density
const MIN_SECONDS = 8; // too short to show a mechanism cycle

/** MB per minute, measured from 12 sampled downloads spanning 5s–11.9h. */
const mbPerMin = (d) => (d <= 180 ? 5.5 : d <= 600 ? 13.0 : d < 3600 ? 10.0 : 21.6);
const estMb = (d) => (d / 60) * mbPerMin(d);

const normalize = (t) =>
  t
    .replace(/\(?\s*ad[-\s]?free\s*\)?/gi, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

function classify(v, seenTitles) {
  const { title: t, durationSec: d } = v;
  if (d == null) return { keep: false, reason: 'no duration reported' };
  if (d >= MAX_SECONDS) return { keep: false, reason: `>=1h stream (${(d / 3600).toFixed(1)}h)` };
  if (d < MIN_SECONDS) return { keep: false, reason: `ultra-short (${d}s)` };
  if (/\(?\s*ad[-\s]?free\s*\)?/i.test(t)) return { keep: false, reason: 'duplicate (Ad Free) re-upload' };

  const key = normalize(t);
  if (seenTitles.has(key)) return { keep: false, reason: `duplicate title of ${seenTitles.get(key)}` };

  for (const [frag, why] of FORCE_KEEP) {
    if (t.includes(frag)) return { keep: true, kind: 'override', reason: why };
  }
  const keeper = KEEP_SERIES.find((s) => s.re.test(t));
  if (keeper) return { keep: true, kind: keeper.kind, reason: `series: ${keeper.kind}` };

  const talk = TALK_SERIES.find((s) => s.re.test(t));
  if (talk) return { keep: false, reason: talk.why };

  // Unrecognised series: keep short ones (cheap, usually single-mechanism
  // clips), drop long ones (expensive, unknown content — review by hand).
  if (d <= 600) return { keep: true, kind: 'unclassified-short', reason: 'short & unclassified' };
  return { keep: false, reason: 'long & unclassified — review by hand' };
}

const raw = JSON.parse(fs.readFileSync(path.join(DATA, 'playlist-raw.json'), 'utf8'));
const seenTitles = new Map();
const keep = [];
const rejected = [];

for (const v of raw.videos) {
  const verdict = classify(v, seenTitles);
  const row = { ...v, estMb: v.durationSec ? Math.round(estMb(v.durationSec)) : null, ...verdict };
  if (verdict.keep) {
    seenTitles.set(normalize(v.title), v.videoId);
    keep.push(row);
  } else {
    rejected.push(row);
  }
}

const sum = (rows) => rows.reduce((a, r) => a + (r.estMb || 0), 0);
const hours = (rows) => rows.reduce((a, r) => a + (r.durationSec || 0), 0) / 3600;

fs.writeFileSync(path.join(DATA, 'videos.json'), `${JSON.stringify({ count: keep.length, videos: keep }, null, 1)}\n`);
fs.writeFileSync(path.join(DATA, 'rejected.json'), `${JSON.stringify({ count: rejected.length, videos: rejected }, null, 1)}\n`);

console.log(`  KEEP     ${String(keep.length).padStart(4)}  ${hours(keep).toFixed(1)}h  ~${(sum(keep) / 1024).toFixed(1)} GB`);
console.log(`  REJECT   ${String(rejected.length).padStart(4)}  ${hours(rejected).toFixed(1)}h  ~${(sum(rejected) / 1024).toFixed(1)} GB`);
const byKind = {};
for (const r of keep) byKind[r.kind] = (byKind[r.kind] || 0) + 1;
console.log('\n  keepers by kind:');
for (const [k, n] of Object.entries(byKind).sort((a, b) => b[1] - a[1])) console.log(`    ${String(n).padStart(4)}  ${k}`);
const byReason = {};
for (const r of rejected) byReason[r.reason.replace(/\(.*?\)/, '').trim()] = (byReason[r.reason.replace(/\(.*?\)/, '').trim()] || 0) + 1;
console.log('\n  rejected by reason:');
for (const [k, n] of Object.entries(byReason).sort((a, b) => b[1] - a[1])) console.log(`    ${String(n).padStart(4)}  ${k}`);
