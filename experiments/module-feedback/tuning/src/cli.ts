#!/usr/bin/env -S npx tsx
/**
 * tuning CLI — fine-tune Gemini on our FTC clips. See ../PLAN.md.
 *
 *   yarn tuning prepare              # merge + validate + normalize clips
 *   yarn tuning evaluate             # Phase 2 baseline (no GCP needed)
 *   yarn tuning upload               # clips → GCS
 *   yarn tuning build-jsonl          # → train.jsonl / val.jsonl
 *   yarn tuning tune                 # submit the Vertex job
 *   yarn tuning status               # poll it
 *   yarn tuning evaluate -c tuned    # Phase 5 verdict
 */
import { Command } from 'commander';
import { ConfigError } from '../../src/config.ts';
import { c, log } from '../../src/logger.ts';
import { prepare } from './prepare.ts';
import { upload } from './upload.ts';
import { buildJsonl } from './buildJsonl.ts';
import { tune, status } from './tune.ts';
import { evaluate, type Condition } from './evaluate.ts';

const program = new Command();
program
  .name('tuning')
  .description('Fine-tune Gemini for FTC module feedback (see tuning/PLAN.md)');

program
  .command('prepare')
  .description('merge caption sources, validate pairing, normalize clips to mp4')
  .option('--strict', 'fail on any manifest problem instead of warning')
  .action(async (opts: { strict?: boolean }) => {
    await prepare({ strict: opts.strict });
  });

program
  .command('upload')
  .description('upload prepared clips to GCS (needs a billed GCP project)')
  .action(async () => {
    await upload();
  });

program
  .command('build-jsonl')
  .description('emit train/val JSONL in the Vertex tuning format')
  .option('--no-upload', 'write the files locally without sending them to GCS')
  .action(async (opts: { upload?: boolean }) => {
    await buildJsonl({ upload: opts.upload !== false });
  });

program
  .command('tune')
  .description('submit the Vertex supervised-tuning job')
  .option('--epochs <n>', 'override the auto-selected epoch count', Number)
  .option('--lr-multiplier <n>', 'learning-rate multiplier', Number)
  .option('--adapter-size <size>', 'ADAPTER_SIZE_ONE | FOUR | EIGHT | SIXTEEN')
  .option('--wait', 'poll until the job reaches a terminal state')
  .action(async (opts: { epochs?: number; lrMultiplier?: number; adapterSize?: string; wait?: boolean }) => {
    await tune({
      epochs: opts.epochs,
      learningRateMultiplier: opts.lrMultiplier,
      adapterSize: opts.adapterSize,
      wait: opts.wait,
    });
  });

program
  .command('status')
  .description('check the tuning job state and print the tuned endpoint')
  .option('--name <resource>', 'explicit tuningJobs resource name')
  .action(async (opts: { name?: string }) => {
    await status(opts.name);
  });

program
  .command('evaluate')
  .description('run the eval clips through plain / fewshot / tuned and write a grading sheet')
  .option(
    '-c, --conditions <list>',
    'comma-separated: plain,fewshot,tuned',
    (v: string) => v.split(',').map((s) => s.trim()) as Condition[],
  )
  .action(async (opts: { conditions?: Condition[] }) => {
    await evaluate({ conditions: opts.conditions });
  });

program.parseAsync(process.argv).catch((err: unknown) => {
  log.blank();
  if (err instanceof ConfigError) {
    log.error(err.message);
  } else {
    log.error(err instanceof Error ? err.message : String(err));
    if (process.env.DEBUG) console.error(c.dim(String((err as Error)?.stack ?? '')));
  }
  process.exitCode = 1;
});
