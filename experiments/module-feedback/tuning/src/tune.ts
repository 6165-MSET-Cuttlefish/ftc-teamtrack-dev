/**
 * `tune` — PLAN.md Phase 4. Submits the Vertex supervised-tuning job.
 *
 * Uses the REST API directly rather than an SDK wrapper: the tuningJobs surface
 * is small, and going straight at it means the request body matches the docs
 * line for line when something needs debugging.
 */
import { readFile, writeFile } from 'node:fs/promises';
import fs from 'node:fs';
import path from 'node:path';
import { GoogleAuth } from 'google-auth-library';
import { c, log } from '../../src/logger.ts';
import { paths, requireVertex, tuningConfig } from './config.ts';
import { DATASET_PATHS } from './buildJsonl.ts';

const JOB_PATH = path.join(paths.build, 'tuning-job.json');

interface TuningJob {
  name?: string;
  state?: string;
  error?: { message?: string };
  tunedModel?: { model?: string; endpoint?: string };
  experiment?: string;
  createTime?: string;
}

async function authedFetch(url: string, init: RequestInit = {}): Promise<unknown> {
  const auth = new GoogleAuth({
    scopes: 'https://www.googleapis.com/auth/cloud-platform',
    keyFilename: tuningConfig.gcp.credentialsPath || undefined,
  });
  const token = await auth.getAccessToken();
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  const body = (await res.json()) as unknown;
  if (!res.ok) {
    const message =
      (body as { error?: { message?: string } })?.error?.message ?? JSON.stringify(body);
    throw new Error(`Vertex API ${res.status}: ${message}`);
  }
  return body;
}

function apiBase(project: string, location: string): string {
  return `https://${location}-aiplatform.googleapis.com/v1/projects/${project}/locations/${location}`;
}

export interface TuneOpts {
  epochs?: number;
  learningRateMultiplier?: number;
  adapterSize?: string;
  wait?: boolean;
}

export async function tune(opts: TuneOpts = {}): Promise<TuningJob> {
  const { project, location } = requireVertex();

  if (!fs.existsSync(DATASET_PATHS.uris)) {
    throw new Error('No dataset URIs. Run `build-jsonl` first.');
  }
  const { trainUri, valUri } = JSON.parse(await readFile(DATASET_PATHS.uris, 'utf8')) as {
    trainUri: string;
    valUri: string | null;
  };

  // Hyperparameters are omitted unless explicitly set — Vertex auto-tunes the
  // epoch count to dataset size, which is the right default for ~100 examples.
  const hyperParameters: Record<string, unknown> = {};
  if (opts.epochs) hyperParameters.epochCount = String(opts.epochs);
  if (opts.learningRateMultiplier) {
    hyperParameters.learningRateMultiplier = opts.learningRateMultiplier;
  }
  if (opts.adapterSize) hyperParameters.adapterSize = opts.adapterSize;

  const body = {
    baseModel: tuningConfig.baseModel,
    tunedModelDisplayName: `${tuningConfig.displayName}-${new Date().toISOString().slice(0, 10)}`,
    supervisedTuningSpec: {
      trainingDatasetUri: trainUri,
      ...(valUri ? { validationDatasetUri: valUri } : {}),
      ...(Object.keys(hyperParameters).length ? { hyperParameters } : {}),
    },
  };

  log.step(`submitting tuning job (${c.bold(tuningConfig.baseModel)} in ${location})`);
  log.info(`train ${trainUri}`);
  if (valUri) log.info(`val   ${valUri}`);
  else log.warn('no validation set — you will not get a validation-loss curve');

  const job = (await authedFetch(`${apiBase(project, location)}/tuningJobs`, {
    method: 'POST',
    body: JSON.stringify(body),
  })) as TuningJob;

  await writeFile(JOB_PATH, `${JSON.stringify(job, null, 2)}\n`);
  log.ok(`job created: ${c.bold(job.name ?? '(no name)')}`);
  log.info(`state: ${job.state ?? 'unknown'}`);
  log.info(`saved to ${c.dim(path.relative(process.cwd(), JOB_PATH))}`);

  if (opts.wait) return waitForJob(job.name ?? '');
  log.blank();
  log.info('poll with: yarn tuning status');
  return job;
}

/** Fetch the current state of the last submitted job (or an explicit name). */
export async function status(name?: string): Promise<TuningJob> {
  const { project, location } = requireVertex();
  let jobName = name;
  if (!jobName) {
    if (!fs.existsSync(JOB_PATH)) throw new Error('No saved job. Run `tune` first, or pass --name.');
    jobName = (JSON.parse(await readFile(JOB_PATH, 'utf8')) as TuningJob).name;
  }
  if (!jobName) throw new Error('Saved job has no name.');

  // `name` is already a fully-qualified resource path.
  const url = `https://${location}-aiplatform.googleapis.com/v1/${jobName}`;
  void project;
  const job = (await authedFetch(url)) as TuningJob;

  log.step(`job ${c.dim(jobName)}`);
  log.info(`state: ${c.bold(job.state ?? 'unknown')}`);
  if (job.error?.message) log.error(job.error.message);

  const endpoint = job.tunedModel?.endpoint;
  if (endpoint) {
    log.ok('tuned model ready');
    log.blank();
    log.info('add this to your .env, then run `yarn tuning evaluate`:');
    console.log(`\nTUNED_MODEL_ENDPOINT=${endpoint}\n`);
  }
  if (job.experiment) {
    log.info(`loss curves: ${job.experiment}`);
    log.info('check for validation loss RISING while training loss falls — that is overfitting.');
  }
  return job;
}

async function waitForJob(name: string): Promise<TuningJob> {
  const terminal = new Set(['JOB_STATE_SUCCEEDED', 'JOB_STATE_FAILED', 'JOB_STATE_CANCELLED']);
  for (;;) {
    const job = await status(name);
    if (terminal.has(job.state ?? '')) return job;
    await new Promise((r) => setTimeout(r, 60_000));
  }
}
