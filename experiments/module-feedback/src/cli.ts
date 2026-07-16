#!/usr/bin/env -S npx tsx
/**
 * module-feedback CLI — POC for the AI robot-mechanism feedback system.
 *
 *   tsx src/cli.ts compare --mock              # offline demo, no keys needed
 *   tsx src/cli.ts method1 --video clip.mp4    # Video Intelligence + Gemini
 *   tsx src/cli.ts method3 --video clip.mp4    # Gemini Robotics-ER
 *
 * This is a standalone experiment. It does NOT touch the TeamTrack website.
 */
import { Command } from 'commander';
import { ConfigError, config } from './config.ts';
import { c, log } from './logger.ts';
import { runMethod1 } from './methods/method1.ts';
import { runMethod2 } from './methods/method2.ts';
import { runMethod3 } from './methods/method3.ts';
import { runSegment } from './methods/segment.ts';
import { printFpsSweep, runGeminiFpsSweep } from './geminiFps.ts';
import {
  printComparison,
  printReport,
  printSegmentation,
  writeJsonReport,
  writeReport,
  writeSegmentation,
} from './report.ts';
import type { AnalysisReport, Method } from './types.ts';

const MOCK_PLACEHOLDER = 'samples/demo-clip.mp4 (mock)';

interface RunOpts {
  video?: string;
  mock?: boolean;
  out: string;
  write: boolean;
}

const runners: Record<Method, (video: string, mock: boolean) => Promise<AnalysisReport>> = {
  method1: runMethod1,
  method2: runMethod2,
  method3: runMethod3,
};

/**
 * Run one or more methods. When `tolerant` (i.e. `compare`), a method that fails
 * — usually missing credentials — is skipped with a warning so the others still
 * run. A single-method command lets the error propagate to the friendly handler.
 */
async function runMethods(methods: Method[], opts: RunOpts, tolerant = false): Promise<void> {
  const mock = Boolean(opts.mock);
  const video = opts.video ?? (mock ? MOCK_PLACEHOLDER : undefined);
  if (!video) {
    throw new ConfigError('Provide a video with --video <path|gs://uri>, or use --mock.');
  }
  if (mock) log.info(c.yellow('running in --mock mode (offline fixtures, no API calls)'));

  const reports: AnalysisReport[] = [];
  for (const method of methods) {
    let report: AnalysisReport;
    try {
      report = await runners[method](video, mock);
    } catch (err) {
      if (!tolerant) throw err;
      log.warn(`${method} skipped: ${err instanceof Error ? err.message : String(err)}`);
      continue;
    }
    printReport(report);
    if (opts.write) {
      const paths = await writeReport(report, opts.out);
      log.ok(`wrote ${paths.map((p) => c.dim(p)).join('  ')}`);
    }
    reports.push(report);
  }
  if (reports.length > 1) printComparison(reports);
}

function withRunOptions(cmd: Command): Command {
  return cmd
    .option('-v, --video <ref>', 'local video path or gs:// URI')
    .option('--mock', 'run offline against fixtures (no keys/network)')
    .option('-o, --out <dir>', 'directory for JSON/Markdown reports', 'output')
    .option('--no-write', 'do not write report files');
}

const program = new Command();
program
  .name('module-feedback')
  .description('POC: analyze FTC robot video → mechanism-improvement suggestions')
  .showHelpAfterError();

withRunOptions(program.command('method1'))
  .description('Method 1: Google Cloud Video Intelligence (object tracking) + Gemini analysis')
  .action((o) => runMethods(['method1'], o));

withRunOptions(program.command('method2'))
  .description('Method 2: TwelveLabs Pegasus (video-native; no Gemini needed, free plan)')
  .action((o) => runMethods(['method2'], o));

withRunOptions(program.command('method3'))
  .description('Method 3: Gemini Robotics-ER (spatial/physical reasoning)')
  .action((o) => runMethods(['method3'], o));

withRunOptions(program.command('compare'))
  .description('Run all methods and compare — "are these of any use?" (skips ones missing keys)')
  .action((o) => runMethods(['method1', 'method2', 'method3'], o, true));

withRunOptions(program.command('segment'))
  .description('Pegasus 1.5 structured segmentation → timestamped per-attempt ball counts')
  .action(async (o: RunOpts) => {
    const mock = Boolean(o.mock);
    const video = o.video ?? (mock ? MOCK_PLACEHOLDER : undefined);
    if (!video) throw new ConfigError('Provide a video with --video <path>, or use --mock.');
    if (mock) log.info(c.yellow('running in --mock mode (offline fixtures, no API calls)'));
    const report = await runSegment(video, mock);
    printSegmentation(report);
    if (o.write) {
      const p = await writeSegmentation(report, o.out);
      log.ok(`wrote ${c.dim(p)}`);
    }
  });

program
  .command('gemini-fps')
  .description('Gemini-only FPS sweep: same clip at several frame rates → quality vs token cost')
  .option('-v, --video <path>', 'local video path')
  .option('--fps <list>', 'comma-separated frame rates to test (Gemini caps at 24)', '1,5,15,24')
  .option('--mock', 'run offline against fixtures (no key/network)')
  .option('-o, --out <dir>', 'directory for the JSON report', 'output')
  .option('--no-write', 'do not write the report file')
  .action(async (o: RunOpts & { fps: string }) => {
    const mock = Boolean(o.mock);
    const video = o.video ?? (mock ? MOCK_PLACEHOLDER : undefined);
    if (!video) throw new ConfigError('Provide a video with --video <path>, or use --mock.');
    const requested = String(o.fps)
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n) && n > 0);
    if (!requested.length) {
      throw new ConfigError('--fps must be a comma-separated list of positive numbers, e.g. 1,5,15,24');
    }
    // Gemini caps video sampling at 24.0 FPS (VideoMetadata.fps valid range is (0, 24]).
    const over = [...new Set(requested.filter((n) => n > 24))];
    if (over.length) log.warn(`Gemini caps video FPS at 24 — clamped ${over.join(', ')} to 24.`);
    const fpsList = [...new Set(requested.map((n) => Math.min(n, 24)))].sort((a, b) => a - b);
    if (mock) log.info(c.yellow('running in --mock mode (offline, no API calls)'));
    const report = await runGeminiFpsSweep(video, fpsList, mock);
    printFpsSweep(report);
    if (o.write) {
      const stamp = report.generatedAtIso.replace(/[:.]/g, '-');
      const p = await writeJsonReport(report, o.out, `gemini-fps-${stamp}.json`);
      log.ok(`wrote ${c.dim(p)}`);
    }
  });

program
  .command('config')
  .description('Print the resolved configuration (no secrets)')
  .action(() => {
    console.log(
      JSON.stringify(
        {
          analysisModel: config.gemini.analysisModel,
          roboticsModel: config.gemini.roboticsModel,
          videoFps: config.gemini.videoFps,
          gcpProject: config.gcp.project || '(unset)',
          gcsBucket: config.gcp.bucket || '(unset)',
          geminiKey: config.gemini.apiKey ? '(set)' : '(unset)',
          twelvelabsModel: config.twelvelabs.model,
          twelvelabsIndex: config.twelvelabs.indexId || config.twelvelabs.indexName,
          twelvelabsKey: config.twelvelabs.apiKey ? '(set)' : '(unset)',
        },
        null,
        2,
      ),
    );
  });

program.parseAsync(process.argv).catch((err: unknown) => {
  if (err instanceof ConfigError) {
    log.error(err.message);
  } else {
    log.error('Unexpected error:');
    console.error(err);
  }
  process.exitCode = 1;
});
