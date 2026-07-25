/**
 * `evaluate` — PLAN.md Phase 2 (baseline) and Phase 5 (verdict).
 *
 * Runs up to three conditions over the held-out eval clips and writes a
 * side-by-side sheet for hand-grading:
 *
 *   plain    — the untuned model, bare prompt
 *   fewshot  — the untuned model with training captions as examples  ← the control that matters
 *   tuned    — the tuned model, same scaffolding it was trained under
 *
 * The tuned model only earns its keep if it beats `fewshot`. Beating `plain` is
 * not a result; that comparison flatters tuning by ~everything few-shot buys.
 *
 * Note the models differ by design: the baselines run whatever
 * GEMINI_ANALYSIS_MODEL is (gemini-3.5-flash today) because that is what the
 * product would ship without tuning, while the tuned model is necessarily a
 * 2.5-flash — only 2.5 is publicly tunable. That handicap is the real question:
 * does a tuned smaller model beat a prompted bigger one on our vocabulary?
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import fs from 'node:fs';
import path from 'node:path';
import { GoogleGenAI } from '@google/genai';
import { config } from '../../src/config.ts';
import { makeGeminiClient, uploadVideoPart, withGeminiRetry } from '../../src/gemini.ts';
import { c, log } from '../../src/logger.ts';
import { paths, tuningConfig, requireVertex } from './config.ts';
import { MANIFEST_PATH, type PreparedManifest } from './prepare.ts';
import { DATASET_PATHS } from './buildJsonl.ts';
import { SYSTEM_INSTRUCTION, USER_PROMPT, buildFewShotPrompt } from './prompts.ts';

export type Condition = 'plain' | 'fewshot' | 'tuned';

interface EvalRow {
  key: string;
  human: string;
  outputs: Partial<Record<Condition, string>>;
}

const RESULTS_DIR = path.join(paths.build, 'eval');
const FEWSHOT_COUNT = 8;

/** Text-only generate against the tuned model on Vertex. */
async function runTuned(uri: string): Promise<string> {
  const { project, location } = requireVertex();
  if (!tuningConfig.tunedEndpoint) {
    throw new Error('TUNED_MODEL_ENDPOINT is not set — run `yarn tuning status` after the job finishes.');
  }
  const ai = new GoogleGenAI({ vertexai: true, project, location });
  const response = await ai.models.generateContent({
    model: tuningConfig.tunedEndpoint,
    contents: [
      {
        role: 'user',
        parts: [
          { fileData: { mimeType: 'video/mp4', fileUri: uri } },
          { text: USER_PROMPT },
        ],
      },
    ],
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      // Documented recommendation for tuned 2.5 thinking models; also cheaper.
      thinkingConfig: { thinkingBudget: 0 },
    } as never,
  });
  return response.text ?? '';
}

/** Untuned baseline through the Gemini API, using the local prepared mp4. */
async function runBaseline(
  ai: GoogleGenAI,
  localPath: string,
  prompt: string,
): Promise<string> {
  const part = await uploadVideoPart(ai, localPath);
  const response = await withGeminiRetry(() =>
    ai.models.generateContent({
      model: config.gemini.analysisModel,
      contents: [{ role: 'user', parts: [part, { text: prompt }] as never }],
    }),
  );
  return response.text ?? '';
}

export async function evaluate(opts: { conditions?: Condition[] } = {}): Promise<EvalRow[]> {
  const conditions = opts.conditions ?? ['plain', 'fewshot'];

  if (!fs.existsSync(DATASET_PATHS.evalSet)) {
    throw new Error('No eval split. Run `prepare` then `build-jsonl` first.');
  }
  const evalClips = JSON.parse(await readFile(DATASET_PATHS.evalSet, 'utf8')) as Array<{
    key: string;
    uri: string;
    caption: string;
  }>;
  if (!evalClips.length) throw new Error('Eval split is empty — nothing to grade.');

  const manifest = JSON.parse(await readFile(MANIFEST_PATH, 'utf8')) as PreparedManifest;
  const localByKey = new Map(manifest.clips.map((x) => [x.key, x.prepared]));

  // Few-shot examples come from TRAINING captions only. Drawing them from the
  // eval split would leak the answers and make the baseline look artificially good.
  const trainCaptions = manifest.clips
    .filter((x) => x.split === 'train')
    .slice(0, FEWSHOT_COUNT)
    .map((x) => ({ caption: x.caption }));
  const fewShotPrompt = buildFewShotPrompt(trainCaptions);

  const needsBaseline = conditions.includes('plain') || conditions.includes('fewshot');
  const ai = needsBaseline ? makeGeminiClient() : null;

  const rows: EvalRow[] = [];
  for (const clip of evalClips) {
    log.step(clip.key);
    const row: EvalRow = { key: clip.key, human: clip.caption, outputs: {} };
    const local = localByKey.get(clip.key);

    for (const condition of conditions) {
      try {
        if (condition === 'tuned') {
          row.outputs.tuned = await runTuned(clip.uri);
        } else {
          if (!ai || !local) throw new Error('no local mp4 for the baseline pass');
          const prompt = condition === 'plain' ? `${SYSTEM_INSTRUCTION}\n\n${USER_PROMPT}` : fewShotPrompt;
          row.outputs[condition] = await runBaseline(ai, local, prompt);
        }
        log.info(`${condition.padEnd(8)} ${c.dim((row.outputs[condition] ?? '').slice(0, 90))}`);
      } catch (err) {
        log.warn(`${condition} skipped: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    rows.push(row);
  }

  await mkdir(RESULTS_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const jsonPath = path.join(RESULTS_DIR, `results-${stamp}.json`);
  const sheetPath = path.join(RESULTS_DIR, `grading-${stamp}.md`);

  await writeFile(jsonPath, `${JSON.stringify({ conditions, rows }, null, 2)}\n`);
  await writeFile(sheetPath, gradingSheet(rows, conditions));

  log.blank();
  log.ok(`wrote ${c.dim(path.relative(process.cwd(), sheetPath))}`);
  log.info('grade it by hand — 0-2 per criterion, per PLAN.md Phase 2.');
  return rows;
}

/** A markdown sheet you fill in by hand. Deliberately not auto-scored. */
function gradingSheet(rows: EvalRow[], conditions: Condition[]): string {
  const criteria = [
    'FTC vocabulary (full-width, wedges, compliant/vector, hinged)',
    'Mechanism facts correct (roller type, width, wedge shape)',
    'Performance judged correctly (intakes from middle vs. edges)',
    'No hallucinated parts',
  ];

  const out: string[] = [
    '# Eval grading sheet',
    '',
    `Generated ${new Date().toISOString()}. Conditions: ${conditions.join(', ')}.`,
    '',
    'Score each criterion 0-2 (0 = wrong, 1 = partial, 2 = matches the human caption).',
    'Ship the tuned model only if it beats **fewshot** — not just **plain**.',
    '',
  ];

  for (const row of rows) {
    out.push(`## ${row.key}`, '', `**Human caption (ground truth):**`, '', `> ${row.human}`, '');
    for (const condition of conditions) {
      const text = row.outputs[condition];
      out.push(`**${condition}:**`, '', text ? `> ${text.replace(/\n/g, '\n> ')}` : '_(skipped)_', '');
    }
    out.push('| Criterion | ' + conditions.join(' | ') + ' |');
    out.push('| --- | ' + conditions.map(() => '---').join(' | ') + ' |');
    for (const criterion of criteria) {
      out.push(`| ${criterion} | ${conditions.map(() => ' ').join(' | ')} |`);
    }
    out.push('', '---', '');
  }

  out.push('## Totals', '', '| Condition | Score /' + rows.length * criteria.length * 2 + ' |');
  out.push('| --- | --- |');
  for (const condition of conditions) out.push(`| ${condition} |  |`);
  out.push('');
  return out.join('\n');
}
