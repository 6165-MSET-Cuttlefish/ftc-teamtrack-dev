/**
 * Method 2: TwelveLabs (Pegasus) — the plan's alternative to Google's Video
 * Intelligence API. Pegasus is a video-native generative model, so a single
 * pass both understands the clip and writes the suggestions. No Gemini needed,
 * and TwelveLabs has a free plan (600 min shared), so this path can run at $0.
 *
 * Flow: resolve/create an index (Pegasus enabled) → upload + index the clip →
 * analyze with a prompt → normalize the JSON into an AnalysisReport.
 */
import { ConfigError, config } from '../config.ts';
import { isGcsUri } from '../gcs.ts';
import { extractJson } from '../gemini.ts';
import { log } from '../logger.ts';
import { mockMethod2Json } from '../mock/fixtures.ts';
import { normalizeMeasurements, normalizeSuggestions, normalizeSummary } from '../normalize.ts';
import { buildMethod2Prompt } from '../prompts.ts';
import { makeTwelveLabsClient, resolveIndexId, uploadAndIndex } from '../twelvelabs.ts';
import type { AnalysisReport } from '../types.ts';

const METHOD_LABEL = 'Method 2 — TwelveLabs (Pegasus)';

export async function runMethod2(videoRef: string, mock: boolean): Promise<AnalysisReport> {
  if (mock) return mockReport(videoRef);

  if (isGcsUri(videoRef)) {
    throw new ConfigError(
      'Method 2 needs a local video file (it uploads to TwelveLabs); a gs:// URI is not supported.',
    );
  }

  const client = makeTwelveLabsClient();

  let text: string;
  try {
    log.step('Method 2 · index + upload');
    const indexId = await resolveIndexId(client);
    const videoId = await uploadAndIndex(client, indexId, videoRef);

    log.step('Method 2 · Pegasus analysis');
    const res = await client.analyze({
      videoId,
      prompt: buildMethod2Prompt(),
      modelName: config.twelvelabs.model as 'pegasus1.2' | 'pegasus1.5',
    });
    text = res.data ?? '';
  } catch (err) {
    throw mapTwelveLabsError(err);
  }
  const parsed = extractJson(text);
  const warnings: string[] = [];
  if (!parsed) warnings.push('Could not parse JSON from Pegasus; showing raw text only.');

  return {
    method: 'method2',
    methodLabel: METHOD_LABEL,
    model: config.twelvelabs.model,
    generatedAtIso: new Date().toISOString(),
    videoRef,
    suggestions: normalizeSuggestions(parsed),
    measurements: normalizeMeasurements(parsed),
    summary: normalizeSummary(parsed),
    rawText: text,
    mock: false,
    warnings,
  };
}

/** Turn TwelveLabs auth failures into a friendly ConfigError; pass others through. */
function mapTwelveLabsError(err: unknown): unknown {
  const status = (err as { statusCode?: number }).statusCode;
  if (status === 401 || status === 403) {
    return new ConfigError(
      'TwelveLabs rejected the API key. Check TWELVELABS_API_KEY in .env, or generate a new one ' +
        'at https://playground.twelvelabs.io/dashboard/api-keys (then re-run ./1-set-key.sh).',
    );
  }
  return err;
}

function mockReport(videoRef: string): AnalysisReport {
  return {
    method: 'method2',
    methodLabel: METHOD_LABEL,
    model: `${config.twelvelabs.model} (mock)`,
    generatedAtIso: new Date().toISOString(),
    videoRef,
    suggestions: normalizeSuggestions(mockMethod2Json),
    measurements: normalizeMeasurements(mockMethod2Json),
    summary: normalizeSummary(mockMethod2Json),
    rawText: JSON.stringify(mockMethod2Json, null, 2),
    mock: true,
    warnings: [],
  };
}
