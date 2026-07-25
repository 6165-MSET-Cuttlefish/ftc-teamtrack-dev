/**
 * `build-jsonl` — PLAN.md Phase 3, step 3.
 *
 * Emits train.jsonl / val.jsonl in the Vertex supervised-tuning format, then
 * uploads them next to the clips (the tuning API reads the datasets from GCS
 * too, not just the video).
 *
 * The eval split is written to a separate file and is never included in either
 * dataset — it exists so `evaluate` can score against captions the model has
 * genuinely never seen.
 */
import { readFile, writeFile } from 'node:fs/promises';
import fs from 'node:fs';
import path from 'node:path';
import { Storage } from '@google-cloud/storage';
import { c, log } from '../../src/logger.ts';
import { paths, requireVertex, tuningConfig } from './config.ts';
import { MANIFEST_PATH, type PreparedClip, type PreparedManifest } from './prepare.ts';
import { URI_MAP_PATH, type UriMap } from './upload.ts';
import { SYSTEM_INSTRUCTION, USER_PROMPT } from './prompts.ts';

export const DATASET_PATHS = {
  train: path.join(paths.build, 'train.jsonl'),
  val: path.join(paths.build, 'val.jsonl'),
  evalSet: path.join(paths.build, 'eval.json'),
  uris: path.join(paths.build, 'dataset-uris.json'),
} as const;

/** One line of the tuning dataset. */
function toExample(clip: PreparedClip, uri: string): string {
  return JSON.stringify({
    systemInstruction: {
      role: 'system',
      parts: [{ text: SYSTEM_INSTRUCTION }],
    },
    contents: [
      {
        role: 'user',
        parts: [
          { fileData: { mimeType: 'video/mp4', fileUri: uri } },
          { text: USER_PROMPT },
        ],
      },
      {
        role: 'model',
        parts: [{ text: clip.caption }],
      },
    ],
    // Must be identical on every line of train AND val, or the job is rejected.
    mediaResolution: tuningConfig.mediaResolution,
  });
}

export interface BuiltDatasets {
  trainUri: string;
  valUri: string;
  counts: { train: number; val: number; eval: number };
}

export async function buildJsonl(opts: { upload?: boolean } = {}): Promise<BuiltDatasets> {
  if (!fs.existsSync(MANIFEST_PATH)) throw new Error('No manifest. Run `prepare` first.');
  if (!fs.existsSync(URI_MAP_PATH)) throw new Error('No GCS URIs. Run `upload` first.');

  const manifest = JSON.parse(await readFile(MANIFEST_PATH, 'utf8')) as PreparedManifest;
  const uris = JSON.parse(await readFile(URI_MAP_PATH, 'utf8')) as UriMap;

  const missing = manifest.clips.filter((clip) => !uris[clip.key]);
  if (missing.length) {
    throw new Error(
      `${missing.length} clip(s) have no gs:// URI (e.g. ${missing[0]?.key}). Re-run \`upload\`.`,
    );
  }

  const lines = { train: [] as string[], val: [] as string[] };
  const evalClips: Array<{ key: string; uri: string; caption: string }> = [];

  for (const clip of manifest.clips) {
    const uri = uris[clip.key] as string;
    if (clip.split === 'eval') {
      evalClips.push({ key: clip.key, uri, caption: clip.caption });
    } else {
      lines[clip.split].push(toExample(clip, uri));
    }
  }

  await writeFile(DATASET_PATHS.train, `${lines.train.join('\n')}\n`);
  await writeFile(DATASET_PATHS.val, `${lines.val.join('\n')}\n`);
  await writeFile(DATASET_PATHS.evalSet, `${JSON.stringify(evalClips, null, 2)}\n`);

  log.ok(`train ${lines.train.length}  val ${lines.val.length}  eval ${evalClips.length} (held out)`);

  if (!lines.train.length) throw new Error('Training split is empty — nothing to tune on.');

  const counts = { train: lines.train.length, val: lines.val.length, eval: evalClips.length };

  if (!opts.upload) {
    log.info('skipping dataset upload (--no-upload); URIs below are where they would go');
  }

  const { bucket: bucketName } = requireVertex();
  const base = `${tuningConfig.gcsPrefix}/datasets`;
  const trainUri = `gs://${bucketName}/${base}/train.jsonl`;
  const valUri = `gs://${bucketName}/${base}/val.jsonl`;

  if (opts.upload) {
    const storage = new Storage({
      projectId: tuningConfig.gcp.project || undefined,
      keyFilename: tuningConfig.gcp.credentialsPath || undefined,
    });
    const bucket = storage.bucket(bucketName);
    await bucket.upload(DATASET_PATHS.train, { destination: `${base}/train.jsonl` });
    if (counts.val) await bucket.upload(DATASET_PATHS.val, { destination: `${base}/val.jsonl` });
    log.ok(`uploaded datasets to ${c.dim(`gs://${bucketName}/${base}/`)}`);
  }

  await writeFile(
    DATASET_PATHS.uris,
    `${JSON.stringify({ trainUri, valUri: counts.val ? valUri : null }, null, 2)}\n`,
  );

  return { trainUri, valUri, counts };
}
