/**
 * Structured segmentation with TwelveLabs Pegasus 1.5.
 *
 * Instead of asking for free-text (which counted balls unreliably), we send the
 * video inline (base64, no indexing needed) and force a JSON-schema response:
 * an array of intake ATTEMPTS, each with a timestamp, ball color, and outcome.
 * That gives reliable per-attempt counts and the timing data the timeline needs.
 *
 * Requires Pegasus 1.5 (the `timestamp` schema type is 1.5-only). Verified
 * against twelvelabs-js@1.2.9: client.analyze({ modelName, video, prompt,
 * responseFormat: { type:'json_schema', jsonSchema } }) -> { data: string }.
 */
import { readFile } from 'node:fs/promises';
import { ConfigError, config } from '../config.ts';
import { extractJson, mimeTypeForVideo } from '../gemini.ts';
import { log } from '../logger.ts';
import { makeTwelveLabsClient } from '../twelvelabs.ts';
import type { AttemptOutcome, IntakeAttempt, SegmentationReport, Suggestion } from '../types.ts';

const OUTCOMES: AttemptOutcome[] = ['captured', 'dropped', 'missed', 'batted_away'];
const MAX_INLINE_BYTES = 30 * 1024 * 1024; // TwelveLabs base64 limit

/** JSON schema the model must fill (respects TwelveLabs' schema constraints). */
const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    attempts: {
      type: 'array',
      minItems: 0,
      items: {
        type: 'object',
        properties: {
          // `timestamp` type (Pegasus 1.5) returns a number in seconds.
          t: { type: 'timestamp', format: 'seconds' },
          ballColor: { type: 'string' },
          outcome: { type: 'string', enum: OUTCOMES },
          note: { type: 'string' },
        },
        required: ['t', 'ballColor', 'outcome', 'note'],
      },
    },
    suggestions: {
      type: 'array',
      minItems: 0,
      items: {
        type: 'object',
        properties: {
          observation: { type: 'string' },
          suggestedModification: { type: 'string' },
          severity: { type: 'string', enum: ['low', 'medium', 'high'] },
        },
        required: ['observation', 'suggestedModification', 'severity'],
      },
    },
  },
  required: ['summary', 'attempts', 'suggestions'],
};

const PROMPT = `You are a veteran FTC mechanical mentor reviewing video of a robot's ball intake. Watch the whole clip (which may be several short clips joined together) and log EVERY distinct intake attempt you see, in time order.

For each attempt, record:
- t: the time in seconds when the robot first contacts that ball
- ballColor: the ball's color (e.g. "purple", "green")
- outcome: exactly one of "captured" (pulled fully into the robot), "dropped" (grabbed then lost), "missed" (never engaged), "batted_away" (knocked away by the roller)
- note: one short phrase on what happened

Count each physical ball once. Then give a few concrete, buildable mechanical suggestions (roller material/durometer, spacing, geometry, compliance) in the suggestions array.`;

export async function runSegment(videoPath: string, mock: boolean): Promise<SegmentationReport> {
  if (mock) return mockReport(videoPath);

  const bytes = await readFile(videoPath);
  if (bytes.byteLength > MAX_INLINE_BYTES) {
    throw new ConfigError(
      `Clip is ${(bytes.byteLength / 1e6).toFixed(1)}MB; the inline segmentation limit is 30MB. ` +
        'Trim or downscale the clip.',
    );
  }

  const client = makeTwelveLabsClient();
  log.step(`Segmentation · Pegasus ${segmentModel()} (structured)`);
  log.info(`sending ${(bytes.byteLength / 1e6).toFixed(1)}MB inline…`);

  let text: string;
  try {
    const res = await client.analyze({
      modelName: segmentModel() as 'pegasus1.2' | 'pegasus1.5',
      // Send as a data URI so TwelveLabs gets the MIME type explicitly (raw
      // base64 gets sniffed as octet-stream and rejected for e.g. .mov).
      video: {
        type: 'base64_string',
        base64String: `data:${mimeTypeForVideo(videoPath)};base64,${bytes.toString('base64')}`,
      },
      prompt: PROMPT,
      responseFormat: { type: 'json_schema', jsonSchema: RESPONSE_SCHEMA },
      maxTokens: 4096,
    });
    text = res.data ?? '';
  } catch (err) {
    throw mapAuthError(err);
  }

  const parsed = extractJson(text);
  const warnings: string[] = [];
  if (!parsed) warnings.push('Could not parse JSON from Pegasus; showing raw text only.');

  const attempts = normalizeAttempts(parsed);
  return {
    model: segmentModel(),
    generatedAtIso: new Date().toISOString(),
    videoRef: videoPath,
    summary: pickString(parsed, 'summary'),
    attempts,
    counts: tally(attempts),
    suggestions: normalizeSuggestions(parsed),
    mock: false,
    warnings,
  };
}

function segmentModel(): string {
  return config.twelvelabs.segmentModel;
}

// ── normalization ───────────────────────────────────────────────────────────

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null;
const asStr = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v));
const asNum = (v: unknown) => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

function normalizeAttempts(parsed: unknown): IntakeAttempt[] {
  const raw = isObj(parsed) && Array.isArray(parsed.attempts) ? parsed.attempts : [];
  return raw.filter(isObj).map((a): IntakeAttempt => {
    const outcome = asStr(a.outcome).toLowerCase().replace(/\s+/g, '_');
    return {
      tSec: Math.max(0, asNum(a.t ?? a.tSec ?? a.time)),
      ballColor: asStr(a.ballColor ?? a.color) || 'unknown',
      outcome: (OUTCOMES as string[]).includes(outcome) ? (outcome as AttemptOutcome) : 'missed',
      note: asStr(a.note),
    };
  });
}

function normalizeSuggestions(parsed: unknown): Suggestion[] {
  const raw = isObj(parsed) && Array.isArray(parsed.suggestions) ? parsed.suggestions : [];
  return raw
    .filter(isObj)
    .map((s): Suggestion => ({
      observation: asStr(s.observation),
      suggestedModification: asStr(s.suggestedModification ?? s.fix),
      severity:
        s.severity === 'low' || s.severity === 'medium' || s.severity === 'high'
          ? s.severity
          : undefined,
    }))
    .filter((s) => s.observation || s.suggestedModification);
}

function tally(attempts: IntakeAttempt[]): Record<AttemptOutcome, number> {
  const counts: Record<AttemptOutcome, number> = {
    captured: 0,
    dropped: 0,
    missed: 0,
    batted_away: 0,
  };
  for (const a of attempts) counts[a.outcome]++;
  return counts;
}

function pickString(parsed: unknown, key: string): string | undefined {
  return isObj(parsed) && parsed[key] ? asStr(parsed[key]) : undefined;
}

function mapAuthError(err: unknown): unknown {
  const status = (err as { statusCode?: number }).statusCode;
  if (status === 401 || status === 403) {
    return new ConfigError(
      'TwelveLabs rejected the API key. Check TWELVELABS_API_KEY in .env (re-run ./1-set-key.sh).',
    );
  }
  return err;
}

function mockReport(videoPath: string): SegmentationReport {
  const attempts: IntakeAttempt[] = [
    { tSec: 1.2, ballColor: 'purple', outcome: 'captured', note: 'clean center feed' },
    { tSec: 3.4, ballColor: 'purple', outcome: 'batted_away', note: 'roller contact too low' },
    { tSec: 6.1, ballColor: 'green', outcome: 'missed', note: 'rolled off the edge' },
    { tSec: 9.0, ballColor: 'purple', outcome: 'captured', note: 'good grip' },
    { tSec: 12.5, ballColor: 'green', outcome: 'dropped', note: 'slipped on flap hand-off' },
  ];
  return {
    model: `${config.twelvelabs.segmentModel} (mock)`,
    generatedAtIso: new Date().toISOString(),
    videoRef: videoPath,
    summary: 'Purple balls captured reliably; green balls missed or dropped at the edges.',
    attempts,
    counts: tally(attempts),
    suggestions: [
      {
        observation: 'Green balls slip off the edges',
        suggestedModification: 'Add compliant edge wheels + reduce roller gap ~3mm to funnel them center.',
        severity: 'high',
      },
    ],
    mock: true,
    warnings: [],
  };
}
