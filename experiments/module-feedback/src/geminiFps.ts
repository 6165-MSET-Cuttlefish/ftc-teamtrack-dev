/**
 * Gemini FPS sweep — tests the planning doc's core hypothesis: that the app's
 * results were "so off … because it's running at 1 FPS" and that sending more
 * frames to Gemini fixes it. Needs ONLY a Gemini API key (no Google Cloud Video
 * Intelligence, no GCS).
 *
 * It uploads one clip once, then asks the same model to count the game elements
 * the robot intakes at several frame rates, recording both the answer and the
 * exact token usage (Gemini bills video by tokens, which scale with FPS). So you
 * see the quality-vs-cost tradeoff directly, on your own footage.
 */
import { config, ConfigError } from './config.ts';
import { isGcsUri } from './gcs.ts';
import { extractJson, makeGeminiClient, uploadVideoFile, withGeminiRetry } from './gemini.ts';
import { c, log } from './logger.ts';

/** Verified current input/output $ per 1M tokens. Edit if you switch models. */
const PRICES: Record<string, { in: number; out: number }> = {
  'gemini-3.5-flash': { in: 1.5, out: 9.0 },
  'gemini-2.5-flash': { in: 0.3, out: 2.5 },
};
const FALLBACK_PRICE = PRICES['gemini-3.5-flash']!;

const PROMPT = `You are reviewing a video of an FTC robot's intake. Count how many game elements (balls / artifacts) the robot SUCCESSFULLY intakes — pulls fully into the robot — across the whole clip. Then add one short sentence on what you observed. Respond ONLY as JSON: {"elementsIntaked": <integer>, "note": "<one short sentence>"}`;

export interface FpsRun {
  fps: number;
  elementsIntaked: number | null;
  note: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  rawText: string;
  error?: string;
}

export interface FpsSweepReport {
  model: string;
  videoRef: string;
  generatedAtIso: string;
  priceKnown: boolean;
  runs: FpsRun[];
  mock: boolean;
}

export async function runGeminiFpsSweep(
  videoPath: string,
  fpsList: number[],
  mock: boolean,
): Promise<FpsSweepReport> {
  const model = config.gemini.analysisModel;
  if (mock) return mockReport(videoPath, model, fpsList);

  if (isGcsUri(videoPath)) {
    throw new ConfigError('Provide a local video file (the sweep uploads it to the Gemini Files API).');
  }

  const price = PRICES[model] ?? FALLBACK_PRICE;
  const ai = makeGeminiClient();
  log.step(`Gemini FPS sweep · ${model}`);
  log.info('uploading the clip once (reused across every FPS setting)…');
  const { fileUri, mimeType } = await uploadVideoFile(ai, videoPath);

  const runs: FpsRun[] = [];
  for (const fps of fpsList) {
    log.info(`analyzing at ${c.bold(`${fps} FPS`)}…`);
    try {
      const res = await withGeminiRetry(() =>
        ai.models.generateContent({
          model,
          contents: [
            { role: 'user', parts: [{ fileData: { fileUri, mimeType }, videoMetadata: { fps } }, { text: PROMPT }] },
          ],
          config: { responseMimeType: 'application/json' },
        }),
      );
      const text = res.text ?? '';
      const parsed = extractJson(text) as { elementsIntaked?: unknown; note?: unknown } | null;
      const inTok = res.usageMetadata?.promptTokenCount ?? 0;
      const outTok = res.usageMetadata?.candidatesTokenCount ?? 0;
      const n = Number(parsed?.elementsIntaked);
      runs.push({
        fps,
        elementsIntaked: Number.isFinite(n) ? n : null,
        note: parsed?.note ? String(parsed.note) : '',
        inputTokens: inTok,
        outputTokens: outTok,
        costUsd: (inTok / 1e6) * price.in + (outTok / 1e6) * price.out,
        rawText: text,
      });
    } catch (err) {
      runs.push({
        fps,
        elementsIntaked: null,
        note: '',
        inputTokens: 0,
        outputTokens: 0,
        costUsd: 0,
        rawText: '',
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return {
    model,
    videoRef: videoPath,
    generatedAtIso: new Date().toISOString(),
    priceKnown: model in PRICES,
    runs,
    mock: false,
  };
}

export function printFpsSweep(r: FpsSweepReport): void {
  log.blank();
  console.log(c.bold(`━━ Gemini FPS sweep ${r.mock ? c.yellow('(MOCK)') : ''}`));
  console.log(c.dim(`   model: ${r.model}   video: ${r.videoRef}`));
  log.blank();

  const rows = [['FPS', 'elements', 'in-tok', 'out-tok', '~cost']];
  for (const run of r.runs) {
    rows.push(
      run.error
        ? [String(run.fps), c.red('error'), '—', '—', '—']
        : [
            String(run.fps),
            run.elementsIntaked === null ? '?' : String(run.elementsIntaked),
            run.inputTokens.toLocaleString(),
            String(run.outputTokens),
            `$${run.costUsd.toFixed(5)}`,
          ],
    );
  }
  const widths = rows[0]!.map((_, i) => Math.max(...rows.map((row) => stripAnsi(row[i]!).length)));
  rows.forEach((row, ri) => {
    const line = row.map((cell, i) => pad(cell, widths[i]!)).join('  ');
    console.log(ri === 0 ? c.dim('  ' + line) : '  ' + line);
  });

  log.blank();
  for (const run of r.runs) {
    if (run.error) console.log(`  ${c.dim(`${run.fps} FPS:`)} ${c.red(run.error)}`);
    else if (run.note) console.log(`  ${c.dim(`${run.fps} FPS:`)} ${run.note}`);
  }

  log.blank();
  console.log(
    c.dim(
      `  Cost is at ${r.priceKnown ? r.model : 'gemini-3.5-flash'} rates` +
        `${r.priceKnown ? '' : ' (your model isn’t in the price table — estimate)'}.`,
    ),
  );
  console.log(
    c.dim('  Read it yourself: does the element count get closer to the truth as FPS rises,\n' +
      '  and is the extra token cost worth it? That answers the doc’s 1-FPS question.'),
  );
  log.blank();
}

function mockReport(videoPath: string, model: string, fpsList: number[]): FpsSweepReport {
  // Illustrative shape only: counts converge toward truth (4) and tokens scale with FPS.
  const truth = 4;
  const runs: FpsRun[] = fpsList.map((fps) => {
    const inTok = Math.round(1300 * fps + 400);
    const guess = Math.min(truth, Math.max(1, Math.round(truth * Math.min(1, fps / 15))));
    return {
      fps,
      elementsIntaked: guess,
      note: `at ${fps} FPS the model ${guess === truth ? 'counted all intakes' : 'undercounted fast intakes'}`,
      inputTokens: inTok,
      outputTokens: 30,
      costUsd: (inTok / 1e6) * FALLBACK_PRICE.in + (30 / 1e6) * FALLBACK_PRICE.out,
      rawText: `{"elementsIntaked": ${guess}, "note": "mock"}`,
    };
  });
  return { model: `${model} (mock)`, videoRef: videoPath, generatedAtIso: new Date().toISOString(), priceKnown: model in PRICES, runs, mock: true };
}

const pad = (s: string, w: number) => s + ' '.repeat(Math.max(0, w - stripAnsi(s).length));
// eslint-disable-next-line no-control-regex
const stripAnsi = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, '');
