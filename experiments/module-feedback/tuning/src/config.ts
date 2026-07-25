/**
 * Tuning-track config. Extends the POC's shared `src/config.ts` with the
 * Vertex-specific knobs the tuning job needs (Vertex is a different surface
 * from the Gemini API key the other methods use — see PLAN.md Phase 4).
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ConfigError, config as base } from '../../src/config.ts';

const str = (key: string, fallback = ''): string => process.env[key]?.trim() || fallback;
const num = (key: string, fallback: number): number => {
  const raw = process.env[key]?.trim();
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
};

const here = path.dirname(fileURLToPath(import.meta.url));

/** tuning/ */
export const TUNING_ROOT = path.resolve(here, '..');
/** Repo root, for reaching dev-videos/. */
export const REPO_ROOT = path.resolve(TUNING_ROOT, '../../..');

export const paths = {
  /** Where you drop new clips + captions. */
  inbox: path.join(TUNING_ROOT, 'data/inbox'),
  /** The 30 already-labeled clips that predate this folder. */
  devVideos: path.join(REPO_ROOT, 'dev-videos'),
  /** Normalized mp4s produced by `prepare`. */
  prepared: path.join(TUNING_ROOT, 'data/prepared'),
  /** Generated artifacts: manifest, uri map, jsonl, eval results. */
  build: path.join(TUNING_ROOT, 'data/build'),
} as const;

export const tuningConfig = {
  gcp: base.gcp,
  /** Vertex tuning runs in a region; us-central1 has the widest model coverage. */
  location: str('VERTEX_LOCATION', 'us-central1'),
  /**
   * Only Gemini 2.5 (pro / flash / flash-lite) is publicly tunable. Note this
   * is a step DOWN from the gemini-3.5-flash the other methods use — which is
   * exactly why `evaluate` compares against a 3.5-flash few-shot baseline.
   */
  baseModel: str('TUNING_BASE_MODEL', 'gemini-2.5-flash'),
  /**
   * 64 tokens/frame. Must be identical on every line of train + validation.
   * MEDIA_RESOLUTION_MEDIUM (256/frame) caps clips at 5 min instead of 20.
   */
  mediaResolution: str('TUNING_MEDIA_RESOLUTION', 'MEDIA_RESOLUTION_LOW'),
  bucket: str('TUNING_BUCKET', base.gcp.bucket),
  gcsPrefix: str('TUNING_GCS_PREFIX', 'module-feedback/tuning'),
  /** Fraction of clips held out from training entirely, for human grading. */
  evalFraction: num('TUNING_EVAL_FRACTION', 0.2),
  /** Fraction of the REMAINING clips used as the Vertex validation set. */
  valFraction: num('TUNING_VAL_FRACTION', 0.15),
  /** Set after a tuning job finishes; `evaluate` calls this to score the model. */
  tunedEndpoint: str('TUNED_MODEL_ENDPOINT'),
  displayName: str('TUNING_DISPLAY_NAME', 'ftc-module-feedback'),
} as const;

/** Vertex limits, from the docs. Enforced in `prepare` so nothing is silently dropped. */
export const LIMITS = {
  maxBytes: 100 * 1024 * 1024,
  /** Seconds. 20 min at LOW, 5 min at MEDIUM. */
  maxSeconds: (mediaResolution: string): number =>
    mediaResolution === 'MEDIA_RESOLUTION_MEDIUM' ? 5 * 60 : 20 * 60,
  /** Vertex accepts exactly one video per training example. */
  videosPerExample: 1,
  /** Google's guidance: start around 100 examples. */
  recommendedExamples: 100,
} as const;

export function requireVertex(): { project: string; bucket: string; location: string } {
  const missing: string[] = [];
  if (!tuningConfig.gcp.project) missing.push('GOOGLE_CLOUD_PROJECT');
  if (!tuningConfig.bucket) missing.push('TUNING_BUCKET (or GCS_BUCKET)');
  if (missing.length) {
    throw new ConfigError(
      `Missing ${missing.join(', ')}. Video tuning is Vertex-only and needs a GCP ` +
        'project with billing enabled — a Gemini API key is not enough. See PLAN.md Phase 4.',
    );
  }
  return {
    project: tuningConfig.gcp.project,
    bucket: tuningConfig.bucket,
    location: tuningConfig.location,
  };
}

export { ConfigError };
