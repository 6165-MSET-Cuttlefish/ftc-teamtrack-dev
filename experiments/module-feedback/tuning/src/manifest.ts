/**
 * Builds the dataset manifest: merge every caption source, pair each caption
 * with a real file on disk, and assign a deterministic train/val/eval split.
 *
 * Determinism matters — a random split would reshuffle the eval set on every
 * run, which quietly invalidates the Phase 2 baseline numbers.
 */
import { readFile } from 'node:fs/promises';
import fs from 'node:fs';
import path from 'node:path';
import { LIMITS, paths, tuningConfig } from './config.ts';

export type Split = 'train' | 'val' | 'eval';

export interface ClipEntry {
  /** Caption key, i.e. the original filename. */
  key: string;
  /** Absolute path to the source video. */
  source: string;
  /** The target output text the model learns to produce. */
  caption: string;
  /** Which caption file it came from, for error messages. */
  origin: string;
  split: Split;
}

export interface ManifestProblem {
  kind: 'missing-file' | 'missing-caption' | 'empty-caption' | 'duplicate';
  key: string;
  detail: string;
}

const VIDEO_EXT = new Set(['.mp4', '.mov', '.webm', '.mkv', '.avi', '.m4v']);

interface Source {
  dir: string;
  label: string;
}

const SOURCES: Source[] = [
  { dir: paths.devVideos, label: 'dev-videos' },
  { dir: paths.inbox, label: 'inbox' },
];

async function readCaptions(dir: string): Promise<Record<string, string>> {
  const file = path.join(dir, 'captions.json');
  if (!fs.existsSync(file)) return {};
  const parsed: unknown = JSON.parse(await readFile(file, 'utf8'));
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${file} must be a JSON object of { "filename": "caption" }.`);
  }
  return parsed as Record<string, string>;
}

function listVideos(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => VIDEO_EXT.has(path.extname(f).toLowerCase()));
}

/**
 * Stable 0..99 bucket from the filename. Same clip always lands in the same
 * split, and adding new clips never moves the existing ones.
 */
function bucketOf(key: string): number {
  let h = 5381;
  for (let i = 0; i < key.length; i += 1) h = ((h << 5) + h + key.charCodeAt(i)) >>> 0;
  return h % 100;
}

function splitFor(key: string): Split {
  const b = bucketOf(key);
  const evalCut = Math.round(tuningConfig.evalFraction * 100);
  if (b < evalCut) return 'eval';
  const valCut = evalCut + Math.round((100 - evalCut) * tuningConfig.valFraction);
  if (b < valCut) return 'val';
  return 'train';
}

export interface Manifest {
  clips: ClipEntry[];
  problems: ManifestProblem[];
}

/** Merge all sources into one manifest. Later sources win on key collision. */
export async function buildManifest(): Promise<Manifest> {
  const clips = new Map<string, ClipEntry>();
  const problems: ManifestProblem[] = [];

  for (const source of SOURCES) {
    const captions = await readCaptions(source.dir);
    const files = new Set(listVideos(source.dir));

    for (const [key, caption] of Object.entries(captions)) {
      if (!files.has(key)) {
        problems.push({
          kind: 'missing-file',
          key,
          detail: `captioned in ${source.label}/captions.json but no such file in ${source.label}/`,
        });
        continue;
      }
      if (!caption || !caption.trim()) {
        problems.push({ kind: 'empty-caption', key, detail: `empty caption in ${source.label}` });
        continue;
      }
      if (clips.has(key)) {
        problems.push({
          kind: 'duplicate',
          key,
          detail: `also present in ${clips.get(key)?.origin} — ${source.label} wins`,
        });
      }
      clips.set(key, {
        key,
        source: path.join(source.dir, key),
        caption: caption.trim(),
        origin: source.label,
        split: splitFor(key),
      });
    }

    for (const file of files) {
      if (!(file in captions)) {
        problems.push({
          kind: 'missing-caption',
          key: file,
          detail: `${source.label}/${file} has no entry in ${source.label}/captions.json`,
        });
      }
    }
  }

  return { clips: [...clips.values()].sort((a, b) => a.key.localeCompare(b.key)), problems };
}

export function countBySplit(clips: ClipEntry[]): Record<Split, number> {
  const counts: Record<Split, number> = { train: 0, val: 0, eval: 0 };
  for (const clip of clips) counts[clip.split] += 1;
  return counts;
}

/** True when we have enough data for a tuning job to be worth paying for. */
export function hasEnoughData(clips: ClipEntry[]): boolean {
  return clips.length >= LIMITS.recommendedExamples;
}
