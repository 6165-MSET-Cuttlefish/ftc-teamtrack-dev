/**
 * `prepare` — PLAN.md Phase 3, step 1.
 *
 * Merge caption sources, validate the pairing, normalize every clip to mp4, and
 * enforce the Vertex limits locally. Enforcing them here matters: Vertex
 * silently DROPS over-length examples from the dataset, so a job can "succeed"
 * having trained on half your data without ever saying so.
 */
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { c, log } from '../../src/logger.ts';
import { LIMITS, paths, tuningConfig } from './config.ts';
import { buildManifest, countBySplit, hasEnoughData, type ClipEntry, type Split } from './manifest.ts';
import { normalize } from './ffmpeg.ts';

export interface PreparedClip extends ClipEntry {
  /** Absolute path to the normalized mp4. */
  prepared: string;
  bytes: number;
  seconds: number | null;
}

export interface PreparedManifest {
  createdAt: string;
  mediaResolution: string;
  clips: PreparedClip[];
}

export const MANIFEST_PATH = path.join(paths.build, 'manifest.json');

export async function prepare(opts: { strict?: boolean } = {}): Promise<PreparedManifest> {
  log.step('building dataset manifest');
  const { clips, problems } = await buildManifest();

  if (problems.length) {
    for (const p of problems) log.warn(`${c.bold(p.key)} — ${p.detail}`);
    if (opts.strict) {
      throw new Error(`${problems.length} manifest problem(s); fix them or drop --strict.`);
    }
  }

  if (!clips.length) {
    throw new Error(
      `No captioned clips found. Add clips + captions.json to ${path.relative(process.cwd(), paths.inbox)}.`,
    );
  }

  log.ok(`${clips.length} captioned clip(s) from ${new Set(clips.map((x) => x.origin)).size} source(s)`);

  const maxSeconds = LIMITS.maxSeconds(tuningConfig.mediaResolution);
  const prepared: PreparedClip[] = [];
  const rejected: string[] = [];

  log.step(`normalizing to mp4 (${path.relative(process.cwd(), paths.prepared)})`);
  for (const clip of clips) {
    const result = await normalize(clip.source, paths.prepared);

    if (result.seconds !== null && result.seconds > maxSeconds) {
      rejected.push(
        `${clip.key} — ${Math.round(result.seconds)}s exceeds the ${maxSeconds}s cap for ${tuningConfig.mediaResolution}`,
      );
      continue;
    }
    if (result.bytes > LIMITS.maxBytes) {
      rejected.push(
        `${clip.key} — ${(result.bytes / 1024 / 1024).toFixed(1)} MB exceeds the 100 MB cap even after transcode`,
      );
      continue;
    }

    prepared.push({ ...clip, prepared: result.output, bytes: result.bytes, seconds: result.seconds });
    log.info(
      `${result.cached ? 'cached ' : 'encoded'} ${clip.key} → ${(result.bytes / 1024 / 1024).toFixed(1)} MB` +
        (result.seconds ? ` / ${Math.round(result.seconds)}s` : ''),
    );
  }

  for (const r of rejected) log.error(`dropped: ${r}`);

  const manifest: PreparedManifest = {
    createdAt: new Date().toISOString(),
    mediaResolution: tuningConfig.mediaResolution,
    clips: prepared,
  };
  await mkdir(paths.build, { recursive: true });
  await writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);

  summarize(prepared);
  log.ok(`wrote ${c.dim(path.relative(process.cwd(), MANIFEST_PATH))}`);
  return manifest;
}

function summarize(clips: PreparedClip[]): void {
  const counts = countBySplit(clips);
  const order: Split[] = ['train', 'val', 'eval'];
  log.blank();
  log.step('dataset');
  for (const split of order) log.info(`${split.padEnd(6)} ${counts[split]}`);
  const totalMb = clips.reduce((sum, x) => sum + x.bytes, 0) / 1024 / 1024;
  log.info(`total  ${clips.length} clips, ${totalMb.toFixed(0)} MB`);

  if (!hasEnoughData(clips)) {
    log.blank();
    log.warn(
      `${clips.length} examples is below the ~${LIMITS.recommendedExamples} Google recommends. ` +
        'A job will run, but expect it to overfit rather than learn a style.',
    );
    log.warn('PLAN.md Phase 2: prove few-shot prompting is insufficient before paying for a job.');
  }
  if (counts.train === 0 || counts.eval === 0) {
    log.warn('A split is empty — add clips, or adjust TUNING_EVAL_FRACTION / TUNING_VAL_FRACTION.');
  }
}
