/**
 * Upload a local clip to Google Cloud Storage so the Video Intelligence API can
 * read it (that API only ingests gs:// URIs or raw bytes; we use the bucket
 * path, matching the flow in the planning doc).
 */
import path from 'node:path';
import { Storage } from '@google-cloud/storage';
import { config } from './config.ts';
import { log } from './logger.ts';

export function isGcsUri(ref: string): boolean {
  return ref.startsWith('gs://');
}

/**
 * Ensure we have a gs:// URI for `videoRef`. If it's already a gs:// URI, pass
 * it through. Otherwise upload the local file into `GCS_BUCKET` and return the
 * resulting URI.
 */
export async function ensureGcsUri(videoRef: string): Promise<string> {
  if (isGcsUri(videoRef)) return videoRef;

  const storage = new Storage({
    projectId: config.gcp.project || undefined,
    keyFilename: config.gcp.credentialsPath || undefined,
  });

  const bucket = config.gcp.bucket;
  const destination = `module-feedback/${path.basename(videoRef)}`;
  log.info(`uploading ${path.basename(videoRef)} to gs://${bucket}/${destination}…`);
  await storage.bucket(bucket).upload(videoRef, { destination });

  return `gs://${bucket}/${destination}`;
}
