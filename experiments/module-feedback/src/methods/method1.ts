/**
 * Method 1: Google Cloud Video Intelligence (OBJECT_TRACKING) + Gemini analysis.
 *
 * Flow (from the planning doc):
 *   1. Ensure the clip is in GCS (upload the local file if needed).
 *   2. Object-tracking pass → compact TrackingSummary (the measurement layer).
 *   3. Gemini pass: the video (sampled at N FPS) + the tracking JSON + a prompt
 *      → qualitative "what / why" suggestions (the interpretation layer).
 *   4. Return a normalized AnalysisReport combining both.
 */
import { ConfigError, config, requireGcp, requireGeminiKey } from '../config.ts';
import { ensureGcsUri, isGcsUri } from '../gcs.ts';
import { generateJson, makeGeminiClient, uploadVideoPart } from '../gemini.ts';
import { log } from '../logger.ts';
import { mockMethod1Json, mockTrackingSummary } from '../mock/fixtures.ts';
import { normalizeMeasurements, normalizeSuggestions, normalizeSummary } from '../normalize.ts';
import { buildMethod1Prompt } from '../prompts.ts';
import type { AnalysisReport } from '../types.ts';
import { runObjectTracking } from './videoIntelligence.ts';

const METHOD_LABEL = 'Method 1 — Video Intelligence + Gemini';

export async function runMethod1(videoRef: string, mock: boolean): Promise<AnalysisReport> {
  if (mock) return mockReport(videoRef);

  const warnings: string[] = [];

  // Fail fast with friendly guidance before doing any slow/paid work.
  requireGeminiKey();
  if (isGcsUri(videoRef)) {
    if (!config.gcp.project) {
      throw new ConfigError('GOOGLE_CLOUD_PROJECT is not set (needed for the tracking pass).');
    }
  } else {
    requireGcp(); // local file → need a project + bucket to upload into
  }

  // 1 + 2: get a gs:// URI and run the object-tracking pass.
  log.step('Method 1 · object-tracking pass');
  const gcsUri = await ensureGcsUri(videoRef);
  const tracking = await runObjectTracking(gcsUri);

  // 3: Gemini analysis over the video + tracking JSON.
  log.step('Method 1 · Gemini analysis pass');
  const ai = makeGeminiClient();
  const parts: unknown[] = [];

  if (isGcsUri(videoRef)) {
    // Gemini's Files API needs a local upload; a raw gs:// URI can't be attached
    // with an API key, so we fall back to reasoning over the tracking JSON alone.
    warnings.push(
      'Input was a gs:// URI, so Gemini analyzed the tracking JSON only (no frames). Pass a local file for full video analysis.',
    );
  } else {
    parts.push(await uploadVideoPart(ai, videoRef));
  }
  parts.push({ text: buildMethod1Prompt(tracking) });

  const { text, parsed } = await generateJson(ai, {
    model: config.gemini.analysisModel,
    parts,
    asJson: true,
  });
  if (!parsed) warnings.push('Could not parse JSON from the model; showing raw text only.');

  return {
    method: 'method1',
    methodLabel: METHOD_LABEL,
    model: config.gemini.analysisModel,
    generatedAtIso: new Date().toISOString(),
    videoRef,
    suggestions: normalizeSuggestions(parsed),
    measurements: normalizeMeasurements(parsed),
    summary: normalizeSummary(parsed),
    rawText: text,
    tracking,
    mock: false,
    warnings,
  };
}

function mockReport(videoRef: string): AnalysisReport {
  return {
    method: 'method1',
    methodLabel: METHOD_LABEL,
    model: `${config.gemini.analysisModel} (mock)`,
    generatedAtIso: new Date().toISOString(),
    videoRef,
    suggestions: normalizeSuggestions(mockMethod1Json),
    measurements: normalizeMeasurements(mockMethod1Json),
    summary: normalizeSummary(mockMethod1Json),
    rawText: JSON.stringify(mockMethod1Json, null, 2),
    tracking: mockTrackingSummary,
    mock: true,
    warnings: [],
  };
}
