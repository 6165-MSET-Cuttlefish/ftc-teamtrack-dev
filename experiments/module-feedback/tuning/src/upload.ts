/**
 * `upload` — PLAN.md Phase 3, step 2.
 *
 * Vertex tuning reads training video by gs:// URI only, so every prepared clip
 * has to live in a bucket first. Uploads are skipped when an object of the same
 * size is already there, so re-running is cheap.
 */
import { readFile, writeFile } from 'node:fs/promises';
import fs from 'node:fs';
import path from 'node:path';
import { Storage } from '@google-cloud/storage';
import { c, log } from '../../src/logger.ts';
import { paths, requireVertex, tuningConfig } from './config.ts';
import { MANIFEST_PATH, type PreparedManifest } from './prepare.ts';

export const URI_MAP_PATH = path.join(paths.build, 'uris.json');

/** caption key → gs:// URI */
export type UriMap = Record<string, string>;

export async function upload(): Promise<UriMap> {
  const { bucket: bucketName } = requireVertex();

  if (!fs.existsSync(MANIFEST_PATH)) {
    throw new Error('No manifest. Run `yarn tuning prepare` first.');
  }
  const manifest = JSON.parse(await readFile(MANIFEST_PATH, 'utf8')) as PreparedManifest;

  const storage = new Storage({
    projectId: tuningConfig.gcp.project || undefined,
    keyFilename: tuningConfig.gcp.credentialsPath || undefined,
  });
  const bucket = storage.bucket(bucketName);

  log.step(`uploading ${manifest.clips.length} clip(s) to gs://${bucketName}/${tuningConfig.gcsPrefix}/`);
  const uris: UriMap = {};

  for (const clip of manifest.clips) {
    const destination = `${tuningConfig.gcsPrefix}/clips/${path.basename(clip.prepared)}`;
    const object = bucket.file(destination);

    let skip = false;
    const [exists] = await object.exists();
    if (exists) {
      const [meta] = await object.getMetadata();
      skip = Number(meta.size) === clip.bytes;
    }

    if (skip) {
      log.info(`${c.dim('exists')} ${clip.key}`);
    } else {
      await bucket.upload(clip.prepared, { destination, contentType: 'video/mp4' });
      log.info(`${c.green('sent')}   ${clip.key}`);
    }
    uris[clip.key] = `gs://${bucketName}/${destination}`;
  }

  await writeFile(URI_MAP_PATH, `${JSON.stringify(uris, null, 2)}\n`);
  log.ok(`wrote ${c.dim(path.relative(process.cwd(), URI_MAP_PATH))}`);
  return uris;
}
