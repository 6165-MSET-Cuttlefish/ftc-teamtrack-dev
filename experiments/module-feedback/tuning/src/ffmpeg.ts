/**
 * Video normalization. Every clip becomes a modest 720p H.264 mp4 before it
 * goes to GCS: Vertex wants `video/mp4` (`.mov` is not a safe mimeType), the
 * per-file cap is 100 MB, and at MEDIA_RESOLUTION_LOW (64 tokens/frame) there
 * is nothing to gain from shipping a 69 MB original.
 *
 * ffmpeg comes from `ffmpeg-static` (already used by the dev-videos Vite
 * plugin) with a fallback to whatever `ffmpeg` is on PATH.
 */
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { createRequire } from 'node:module';

const exec = promisify(execFile);
const require = createRequire(import.meta.url);

let cachedBin: string | null | undefined;

/** Resolve an ffmpeg binary, or null if none is available. */
export function ffmpegBin(): string | null {
  if (cachedBin !== undefined) return cachedBin;
  try {
    const mod = require('ffmpeg-static') as string | { default?: string };
    const bin = typeof mod === 'string' ? mod : mod.default;
    if (bin && fs.existsSync(bin)) {
      cachedBin = bin;
      return bin;
    }
  } catch {
    // ffmpeg-static not installed here — fall through to PATH.
  }
  cachedBin = null;
  for (const dir of (process.env.PATH ?? '').split(path.delimiter)) {
    const candidate = path.join(dir, 'ffmpeg');
    if (fs.existsSync(candidate)) {
      cachedBin = candidate;
      break;
    }
  }
  return cachedBin;
}

function requireFfmpeg(): string {
  const bin = ffmpegBin();
  if (!bin) {
    throw new Error(
      'No ffmpeg found. Install deps in experiments/module-feedback (ffmpeg-static is a ' +
        'dependency), or put ffmpeg on your PATH.',
    );
  }
  return bin;
}

/** ffmpeg writes `Duration: HH:MM:SS.ss` to stderr even when it does no work. */
function parseDuration(stderr: string): number | null {
  const m = /Duration:\s*(\d+):(\d\d):(\d\d(?:\.\d+)?)/.exec(stderr);
  if (!m) return null;
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

/** Probe a video's duration in seconds without transcoding it. */
export async function probeDuration(file: string): Promise<number | null> {
  const bin = requireFfmpeg();
  try {
    await exec(bin, ['-i', file, '-f', 'null', '-']);
    return null;
  } catch (err) {
    // ffmpeg exits non-zero with no output file; the info we want is on stderr.
    const stderr = (err as { stderr?: string }).stderr ?? '';
    return parseDuration(stderr);
  }
}

export interface TranscodeResult {
  output: string;
  bytes: number;
  seconds: number | null;
  cached: boolean;
}

/**
 * Normalize one clip into `outDir`. Skips work when an up-to-date output
 * already exists (compared against the source mtime), so re-running `prepare`
 * on 100 clips is cheap.
 */
export async function normalize(source: string, outDir: string): Promise<TranscodeResult> {
  const bin = requireFfmpeg();
  fs.mkdirSync(outDir, { recursive: true });

  const base = path.basename(source, path.extname(source));
  const output = path.join(outDir, `${base}.mp4`);

  const srcStat = fs.statSync(source);
  if (fs.existsSync(output)) {
    const outStat = fs.statSync(output);
    if (outStat.mtimeMs >= srcStat.mtimeMs && outStat.size > 0) {
      return {
        output,
        bytes: outStat.size,
        seconds: await probeDuration(output),
        cached: true,
      };
    }
  }

  const tmp = `${output}.tmp-${process.pid}.mp4`;
  let seconds: number | null = null;
  try {
    const { stderr } = await exec(
      bin,
      [
        '-y',
        '-i', source,
        '-c:v', 'libx264',
        '-preset', 'veryfast',
        '-crf', '28',
        // Cap the long edge at 1280 and keep dimensions even for yuv420p.
        '-vf', "scale='min(1280,iw)':-2",
        '-pix_fmt', 'yuv420p',
        '-c:a', 'aac',
        '-b:a', '64k',
        '-movflags', '+faststart',
        tmp,
      ],
      { maxBuffer: 32 * 1024 * 1024 },
    );
    seconds = parseDuration(stderr);
    fs.renameSync(tmp, output);
  } catch (err) {
    if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
    throw new Error(
      `ffmpeg failed on ${path.basename(source)}: ${(err as Error).message.split('\n')[0]}`,
    );
  }

  return { output, bytes: fs.statSync(output).size, seconds, cached: false };
}
