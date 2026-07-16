/** Central env/config for the POC. Loads `.env` once, exposes typed getters. */
import 'dotenv/config';

const str = (key: string, fallback = ''): string => process.env[key]?.trim() || fallback;
const num = (key: string, fallback: number): number => {
  const raw = process.env[key]?.trim();
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
};

export const config = {
  gemini: {
    apiKey: str('GEMINI_API_KEY'),
    analysisModel: str('GEMINI_ANALYSIS_MODEL', 'gemini-3.5-flash'),
    roboticsModel: str('GEMINI_ROBOTICS_MODEL', 'gemini-robotics-er-1.6-preview'),
    /** Frames/sec Gemini samples the video at. Default 1; the plan wants more. */
    videoFps: num('GEMINI_VIDEO_FPS', 5),
  },
  gcp: {
    project: str('GOOGLE_CLOUD_PROJECT'),
    bucket: str('GCS_BUCKET'),
    credentialsPath: str('GOOGLE_APPLICATION_CREDENTIALS'),
    videoIntelligenceLocation: str('VIDEO_INTELLIGENCE_LOCATION', 'us-east1'),
  },
  twelvelabs: {
    apiKey: str('TWELVELABS_API_KEY'),
    /** Pegasus is the generative model that produces the analysis text. */
    model: str('TWELVELABS_MODEL', 'pegasus1.2'),
    /** Segmentation needs Pegasus 1.5 (structured `timestamp` schema type). */
    segmentModel: str('TWELVELABS_SEGMENT_MODEL', 'pegasus1.5'),
    /** Index reused across runs. Set an explicit id to skip the name lookup. */
    indexId: str('TWELVELABS_INDEX_ID'),
    indexName: str('TWELVELABS_INDEX_NAME', 'ftc-module-feedback'),
  },
} as const;

/** Throws a friendly error if the Gemini key is missing (unless mocking). */
export function requireGeminiKey(): string {
  if (!config.gemini.apiKey) {
    throw new ConfigError(
      'GEMINI_API_KEY is not set. Copy .env.example to .env and add a key from ' +
        'https://aistudio.google.com/apikey — or pass --mock to run offline.',
    );
  }
  return config.gemini.apiKey;
}

/** Throws a friendly error if the TwelveLabs key is missing (unless mocking). */
export function requireTwelveLabsKey(): string {
  if (!config.twelvelabs.apiKey) {
    throw new ConfigError(
      'TWELVELABS_API_KEY is not set. Create a free key at ' +
        'https://playground.twelvelabs.io/dashboard/api-keys (Free plan, no credit card) — ' +
        'or pass --mock to run offline.',
    );
  }
  return config.twelvelabs.apiKey;
}

/** Throws if the GCP bits Method 1's tracking pass needs are missing. */
export function requireGcp(): { project: string; bucket: string } {
  const missing: string[] = [];
  if (!config.gcp.project) missing.push('GOOGLE_CLOUD_PROJECT');
  if (!config.gcp.bucket) missing.push('GCS_BUCKET');
  if (missing.length) {
    throw new ConfigError(
      `Missing ${missing.join(', ')} for the Video Intelligence pass. See .env.example, ` +
        'or pass --mock to run offline.',
    );
  }
  return { project: config.gcp.project, bucket: config.gcp.bucket };
}

/** A configuration/usage error we can print cleanly instead of a stack trace. */
export class ConfigError extends Error {}
