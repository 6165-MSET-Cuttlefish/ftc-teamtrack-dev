/** Render an AnalysisReport to the console and to output/ (JSON + Markdown). */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { c, log } from './logger.ts';
import type {
  AnalysisReport,
  IntakeAttempt,
  Measurement,
  SegmentationReport,
  Suggestion,
} from './types.ts';

const sevTag = (s?: Suggestion['severity']) => {
  if (s === 'high') return c.red('[high]');
  if (s === 'medium') return c.yellow('[med] ');
  if (s === 'low') return c.dim('[low] ');
  return '      ';
};
const conf = (n?: number) => (typeof n === 'number' ? c.dim(` (${Math.round(n * 100)}%)`) : '');

export function printReport(report: AnalysisReport): void {
  log.blank();
  console.log(c.bold(`━━ ${report.methodLabel} ${report.mock ? c.yellow('(MOCK)') : ''}`));
  console.log(c.dim(`   model: ${report.model}   video: ${report.videoRef}`));
  if (report.summary) {
    log.blank();
    console.log(wrap(report.summary, 2));
  }

  log.blank();
  console.log(c.bold('  Suggestions for Improvement'));
  if (!report.suggestions.length) {
    console.log(c.dim('    (none returned)'));
  }
  report.suggestions.forEach((s, i) => {
    console.log(`  ${c.cyan(`${i + 1}.`)} ${sevTag(s.severity)} ${c.bold('Observation:')}${conf(s.confidence)}`);
    console.log(wrap(s.observation, 6));
    console.log(`     ${c.bold(c.green('→ Fix:'))}`);
    console.log(wrap(s.suggestedModification, 6));
  });

  if (report.measurements.length) {
    log.blank();
    console.log(c.bold('  Measurements'));
    report.measurements.forEach((m) => console.log(`    • ${formatMeasurement(m)}`));
  }

  if (report.tracking) {
    const t = report.tracking;
    const labels = Object.entries(t.labelCounts)
      .map(([k, v]) => `${v}× ${k}`)
      .join(', ');
    log.blank();
    console.log(c.bold('  Object tracking (quantitative layer)'));
    console.log(c.dim(`    ${t.objects.length} tracks: ${labels || 'none'} · ${t.keyMoments.length} key moments`));
  }

  if (report.warnings.length) {
    log.blank();
    report.warnings.forEach((w) => log.warn(w));
  }
  log.blank();
}

export function printComparison(reports: AnalysisReport[]): void {
  console.log(c.bold('\n━━ Comparison: are these methods of any use?'));
  for (const r of reports) {
    const balls = r.measurements.find((m) => /intak|ball|element/i.test(m.label));
    console.log(
      `  ${c.cyan(r.methodLabel)}: ${r.suggestions.length} suggestions` +
        `${balls ? `, ${balls.label.toLowerCase()}=${balls.value}` : ''}`,
    );
  }
  console.log(
    c.dim(
      '\n  First-week verdict is a human call: skim each report above and note which\n' +
        "  suggestions are buildable and whether the counts match what you saw.",
    ),
  );
}

function formatMeasurement(m: Measurement): string {
  const unit = m.unit ? ` ${m.unit}` : '';
  const detail = m.detail ? c.dim(`  (${m.detail})`) : '';
  return `${c.bold(m.label)}: ${m.value}${unit}${conf(m.confidence)}${detail}`;
}

const outcomeTag = (o: IntakeAttempt['outcome']) => {
  if (o === 'captured') return c.green('captured   ');
  if (o === 'dropped') return c.yellow('dropped    ');
  if (o === 'batted_away') return c.red('batted_away');
  return c.dim('missed     ');
};

export function printSegmentation(r: SegmentationReport): void {
  log.blank();
  console.log(c.bold(`━━ Segmentation · Pegasus ${r.mock ? c.yellow('(MOCK)') : ''}`));
  console.log(c.dim(`   model: ${r.model}   video: ${r.videoRef}`));
  if (r.summary) {
    log.blank();
    console.log(`  ${r.summary}`);
  }

  log.blank();
  console.log(c.bold('  Intake attempts (timestamped)'));
  if (!r.attempts.length) console.log(c.dim('    (none returned)'));
  for (const a of r.attempts) {
    const t = `${a.tSec.toFixed(1)}s`.padStart(6);
    console.log(`    ${c.dim(t)}  ${outcomeTag(a.outcome)}  ${a.ballColor.padEnd(8)} ${c.dim(a.note)}`);
  }

  log.blank();
  const cap = r.counts.captured;
  const total = r.attempts.length;
  console.log(
    c.bold('  Tally: ') +
      `${c.green(`${cap} captured`)} / ${total} attempts  ` +
      c.dim(`(dropped ${r.counts.dropped}, missed ${r.counts.missed}, batted ${r.counts.batted_away})`),
  );

  if (r.suggestions.length) {
    log.blank();
    console.log(c.bold('  Suggestions'));
    r.suggestions.forEach((s, i) =>
      console.log(`    ${c.cyan(`${i + 1}.`)} ${s.observation} ${c.green('→')} ${s.suggestedModification}`),
    );
  }
  if (r.warnings.length) {
    log.blank();
    r.warnings.forEach((w) => log.warn(w));
  }
  log.blank();
}

/** Write any object as a pretty JSON file under outDir. Returns the path. */
export async function writeJsonReport(obj: unknown, outDir: string, filename: string): Promise<string> {
  await mkdir(outDir, { recursive: true });
  const p = path.join(outDir, filename);
  await writeFile(p, JSON.stringify(obj, null, 2), 'utf8');
  return p;
}

/** Write the segmentation report as JSON. Returns the path. */
export async function writeSegmentation(r: SegmentationReport, outDir: string): Promise<string> {
  await mkdir(outDir, { recursive: true });
  const stamp = r.generatedAtIso.replace(/[:.]/g, '-');
  const jsonPath = path.join(outDir, `segmentation-${stamp}.json`);
  await writeFile(jsonPath, JSON.stringify(r, null, 2), 'utf8');
  return jsonPath;
}

/** Write JSON + Markdown copies of the report. Returns the written paths. */
export async function writeReport(report: AnalysisReport, outDir: string): Promise<string[]> {
  await mkdir(outDir, { recursive: true });
  const stamp = report.generatedAtIso.replace(/[:.]/g, '-');
  const base = path.join(outDir, `${report.method}-${stamp}`);
  const jsonPath = `${base}.json`;
  const mdPath = `${base}.md`;
  await writeFile(jsonPath, JSON.stringify(report, null, 2), 'utf8');
  await writeFile(mdPath, toMarkdown(report), 'utf8');
  return [jsonPath, mdPath];
}

export function toMarkdown(report: AnalysisReport): string {
  const lines: string[] = [];
  lines.push(`# ${report.methodLabel}${report.mock ? ' (mock)' : ''}`);
  lines.push('');
  lines.push(`- **Model:** \`${report.model}\``);
  lines.push(`- **Video:** \`${report.videoRef}\``);
  lines.push(`- **Generated:** ${report.generatedAtIso}`);
  lines.push('');
  if (report.summary) lines.push(`> ${report.summary}`, '');

  lines.push('## Suggestions for Improvement', '');
  lines.push('| # | Severity | Observation / Issue | Suggested Modification |');
  lines.push('|---|----------|---------------------|------------------------|');
  report.suggestions.forEach((s, i) => {
    lines.push(
      `| ${i + 1} | ${s.severity ?? ''} | ${escapePipes(s.observation)} | ${escapePipes(s.suggestedModification)} |`,
    );
  });
  lines.push('');

  if (report.measurements.length) {
    lines.push('## Measurements', '');
    report.measurements.forEach((m) => {
      const unit = m.unit ? ` ${m.unit}` : '';
      const detail = m.detail ? ` — ${m.detail}` : '';
      lines.push(`- **${m.label}:** ${m.value}${unit}${detail}`);
    });
    lines.push('');
  }

  if (report.warnings.length) {
    lines.push('## Warnings', '');
    report.warnings.forEach((w) => lines.push(`- ${w}`));
    lines.push('');
  }
  return lines.join('\n');
}

const escapePipes = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ');

/** Word-wrap `text` to ~78 cols, indented by `indent` spaces. */
function wrap(text: string, indent: number): string {
  const width = 78 - indent;
  const pad = ' '.repeat(indent);
  const words = text.split(/\s+/);
  const out: string[] = [];
  let line = '';
  for (const w of words) {
    if ((line + ' ' + w).trim().length > width) {
      out.push(pad + line.trim());
      line = w;
    } else {
      line += ' ' + w;
    }
  }
  if (line.trim()) out.push(pad + line.trim());
  return out.join('\n');
}
