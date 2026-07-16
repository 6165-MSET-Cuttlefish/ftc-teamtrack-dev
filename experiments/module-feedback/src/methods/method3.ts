/**
 * Method 3: Gemini Robotics-ER (gemini-robotics-er-1.6-preview).
 *
 * A single multimodal pass. The model is purpose-built for spatial/physical
 * reasoning, so we send it the video (sampled at N FPS) and ask it to reason
 * about geometry and contact directly — no separate tracking layer.
 */
import { config } from '../config.ts';
import { isGcsUri } from '../gcs.ts';
import { generateJson, makeGeminiClient, uploadVideoPart } from '../gemini.ts';
import { ConfigError } from '../config.ts';
import { log } from '../logger.ts';
import { mockMethod3Json } from '../mock/fixtures.ts';
import { normalizeMeasurements, normalizeSuggestions, normalizeSummary } from '../normalize.ts';
import { buildMethod3Prompt } from '../prompts.ts';
import type { AnalysisReport } from '../types.ts';

const METHOD_LABEL = 'Method 3 — Gemini Robotics-ER';

export async function runMethod3(videoRef: string, mock: boolean): Promise<AnalysisReport> {
  if (mock) return mockReport(videoRef);

  if (isGcsUri(videoRef)) {
    throw new ConfigError(
      'Method 3 needs a local video file (it uploads to the Gemini Files API); a gs:// URI is not supported.',
    );
  }

  log.step('Method 3 · Robotics-ER pass');
  const ai = makeGeminiClient();
  const videoPart = await uploadVideoPart(ai, videoRef);

  const { text, parsed } = await generateJson(ai, {
    model: config.gemini.roboticsModel,
    parts: [videoPart, { text: buildMethod3Prompt() }],
    asJson: true,
  });

  const warnings: string[] = [];
  if (!parsed) warnings.push('Could not parse JSON from the model; showing raw text only.');

  return {
    method: 'method3',
    methodLabel: METHOD_LABEL,
    model: config.gemini.roboticsModel,
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

function mockReport(videoRef: string): AnalysisReport {
  return {
    method: 'method3',
    methodLabel: METHOD_LABEL,
    model: `${config.gemini.roboticsModel} (mock)`,
    generatedAtIso: new Date().toISOString(),
    videoRef,
    suggestions: normalizeSuggestions(mockMethod3Json),
    measurements: normalizeMeasurements(mockMethod3Json),
    summary: normalizeSummary(mockMethod3Json),
    rawText: JSON.stringify(mockMethod3Json, null, 2),
    mock: true,
    warnings: [],
  };
}
