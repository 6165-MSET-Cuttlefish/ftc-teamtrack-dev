/**
 * Shared TwelveLabs helpers for Method 2: client, create-or-reuse index (with
 * the Pegasus generative model enabled), and upload + index a local clip.
 *
 * Verified against twelvelabs-js@1.2.9 type declarations:
 *   client.indexes.list({ indexName })        -> Page<IndexSchema> (.data[])
 *   client.indexes.create({ indexName, models }) -> { id }
 *   client.tasks.create({ indexId, videoFile })  -> { id, videoId }
 *   client.tasks.waitForDone(id)                 -> { status }
 *   client.analyze({ videoId, prompt, modelName }) -> { data: string }
 */
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { TwelveLabs } from 'twelvelabs-js';
import { config, requireTwelveLabsKey } from './config.ts';
import { log } from './logger.ts';

export function makeTwelveLabsClient(): TwelveLabs {
  return new TwelveLabs({ apiKey: requireTwelveLabsKey() });
}

/**
 * Return an index id with the Pegasus model enabled: an explicit
 * TWELVELABS_INDEX_ID if set, else an existing index matching TWELVELABS_INDEX_NAME,
 * else a freshly created one.
 */
export async function resolveIndexId(client: TwelveLabs): Promise<string> {
  if (config.twelvelabs.indexId) return config.twelvelabs.indexId;

  const indexName = config.twelvelabs.indexName;
  const model = config.twelvelabs.model;
  const page = await client.indexes.list({ indexName, pageLimit: 20 });
  // Only reuse an index that actually has our Pegasus model enabled — otherwise
  // the later analyze() call would fail. Fall through to create if none match.
  const existing = page.data.find(
    (i) => i.indexName === indexName && i.models?.some((m) => m.modelName === model),
  );
  if (existing?.id) {
    log.info(`reusing index "${indexName}" (${existing.id})`);
    return existing.id;
  }

  log.info(`creating index "${indexName}" with ${config.twelvelabs.model}…`);
  const created = await client.indexes.create({
    indexName,
    models: [{ modelName: config.twelvelabs.model, modelOptions: ['visual', 'audio'] }],
  });
  if (!created.id) throw new Error('TwelveLabs did not return an index id.');
  return created.id;
}

/**
 * Upload a local clip into the index and wait for indexing to finish.
 * Returns the videoId used by the analyze call.
 */
export async function uploadAndIndex(client: TwelveLabs, indexId: string, videoPath: string): Promise<string> {
  log.info(`uploading ${path.basename(videoPath)} and indexing (this can take a few minutes)…`);
  const task = await client.tasks.create({
    indexId,
    videoFile: createReadStream(videoPath),
  });
  if (!task.id || !task.videoId) throw new Error('TwelveLabs did not return a task id / video id.');

  const done = await client.tasks.waitForDone(task.id, {
    sleepInterval: 5,
    callback: (t) => log.info(`  indexing status: ${t.status}`),
  });
  if (done.status !== 'ready') {
    throw new Error(`TwelveLabs indexing did not succeed (status: ${done.status}).`);
  }
  log.info('video indexed and ready');
  return task.videoId;
}
