/**
 * Minimal local web UI for the module-feedback POC.
 *
 *   npm run ui   →   http://localhost:5178
 *
 * Serves ui/index.html and handles POST /analyze: the browser sends the prompt
 * plus the video (as a data URL); we index the clip on TwelveLabs and run a
 * Pegasus analysis, then return the text. Nothing runs in the browser except
 * the form — the API key stays here, server-side. Local only; the only upload
 * is to TwelveLabs (the API you chose).
 */
import { createServer, type IncomingMessage } from 'node:http';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ConfigError, config, requireGeminiKey, requireTwelveLabsKey } from '../src/config.ts';
import { makeGeminiClient, transientGeminiStatus, uploadVideoFile, withGeminiRetry } from '../src/gemini.ts';
import { makeTwelveLabsClient, resolveIndexId, uploadAndIndex } from '../src/twelvelabs.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.UI_PORT || 5178);
const MAX_UPLOAD = 64 * 1024 * 1024;

const EXT: Record<string, string> = {
  'video/mp4': '.mp4',
  'video/quicktime': '.mov',
  'video/webm': '.webm',
  'video/x-matroska': '.mkv',
  'video/x-msvideo': '.avi',
};

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > MAX_UPLOAD) {
        reject(new ConfigError('Upload too large (64MB limit). Trim the clip.'));
        req.destroy();
      } else {
        chunks.push(c);
      }
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

/** DECODE game-manual context, referenced by every prompt to ground the model. */
async function gameContext(): Promise<string> {
  return readFile(path.join(HERE, 'decode-context.md'), 'utf8').catch(() => '');
}

/**
 * Wrap the user's prompt so the model (a) grounds every point in what it actually
 * sees in THIS clip — not generic advice — and (b) answers in short bullets.
 */
function buildPrompt(ask: string, context: string): string {
  const instructions = [
    "You are a FIRST Tech Challenge mechanical mentor reviewing THIS specific video of one team's robot intake.",
    '',
    'Base every point ONLY on what you actually see in this clip: the specific artifacts (how many, and their color), what the intake physically does to them, and where it succeeds or fails — dropped, batted away, missed, or jammed artifacts; dead zones; slow or inconsistent capture. Do NOT give generic advice that could apply to any robot. If you cannot see it in this video, do not say it.',
    '',
    `Review focus: ${ask}`,
    '',
    'Answer as:',
    '- First, one short line describing what THIS clip actually shows (artifact count/colors, what the intake does).',
    '- Then a short bulleted list. Each bullet states what you SEE, then the specific buildable fix (→). Call out purple vs. green artifacts by color when they behave differently. Keep bullets tight — no long paragraphs.',
  ].join('\n');
  return context
    ? `${instructions}\n\nReference — DECODE game facts (use only to inform the fixes; do not recite them back):\n${context}`
    : instructions;
}

/** Decode the browser's data URL to a temp file; returns a cleanup fn. */
async function toTempFile(dataUrl: string): Promise<{ path: string; cleanup: () => void }> {
  const m = /^data:([^;]+);base64,(.*)$/s.exec(dataUrl);
  if (!m) throw new ConfigError('Could not read the uploaded video.');
  const buf = Buffer.from(m[2]!, 'base64');
  const p = path.join(tmpdir(), `mf-${process.pid}-${Date.now()}${EXT[m[1]!] ?? '.mp4'}`);
  await writeFile(p, buf);
  return { path: p, cleanup: () => void unlink(p).catch(() => {}) };
}

/** Method 2 backend: index the clip on TwelveLabs, analyze with Pegasus. */
async function analyzeTwelveLabs(ask: string, dataUrl: string): Promise<string> {
  requireTwelveLabsKey();
  const file = await toTempFile(dataUrl);
  try {
    const client = makeTwelveLabsClient();
    const indexId = await resolveIndexId(client);
    const videoId = await uploadAndIndex(client, indexId, file.path);
    const res = await client.analyze({
      videoId,
      prompt: buildPrompt(ask, await gameContext()),
      modelName: config.twelvelabs.model as 'pegasus1.2' | 'pegasus1.5',
    });
    return res.data ?? '';
  } finally {
    file.cleanup();
  }
}

/** Clamp a requested FPS into Gemini's valid range (0, 24]; fall back to config. */
function clampFps(n: unknown): number {
  const v = Number(n);
  return Number.isFinite(v) && v > 0 ? Math.min(v, 24) : config.gemini.videoFps;
}

/** Method 1's Gemini pass: upload to the Files API, analyze at the given FPS. */
async function analyzeGemini(ask: string, dataUrl: string, fps: number): Promise<string> {
  requireGeminiKey();
  const file = await toTempFile(dataUrl);
  try {
    const ai = makeGeminiClient();
    const { fileUri, mimeType } = await uploadVideoFile(ai, file.path);
    const promptText = buildPrompt(ask, await gameContext());
    const res = await withGeminiRetry(() =>
      ai.models.generateContent({
        model: config.gemini.analysisModel,
        contents: [
          {
            role: 'user',
            parts: [{ fileData: { fileUri, mimeType }, videoMetadata: { fps } }, { text: promptText }],
          },
        ],
      }),
    );
    return res.text ?? '';
  } finally {
    file.cleanup();
  }
}

function errorMessage(err: unknown): string {
  if (err instanceof ConfigError) return err.message;
  const transient = transientGeminiStatus(err);
  if (transient === 503) {
    return 'Gemini is temporarily overloaded (503) — it stayed busy through several retries. Give it a moment and click Analyze again, lower the FPS, or switch the engine to TwelveLabs.';
  }
  if (transient === 429) {
    return 'Gemini rate limit hit (429). Wait a bit and retry, or set GEMINI_ANALYSIS_MODEL=gemini-2.5-flash in .env for higher free-tier limits.';
  }
  const status = (err as { statusCode?: number }).statusCode;
  if (status === 401 || status === 403) {
    return 'TwelveLabs rejected the API key. Check TWELVELABS_API_KEY in .env (run ./1-set-key.sh).';
  }
  return (err as Error)?.message || 'Something went wrong.';
}

const server = createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && (req.url === '/' || req.url?.startsWith('/index'))) {
      const html = await readFile(path.join(HERE, 'index.html'));
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(html);
      return;
    }
    if (req.method === 'POST' && req.url === '/analyze') {
      const { prompt, video, backend, fps } = JSON.parse(await readBody(req)) as {
        prompt?: string;
        video?: string;
        backend?: string;
        fps?: number;
      };
      if (!video) throw new ConfigError('No video uploaded.');
      const ask = (prompt ?? '').trim() || 'How can we improve this intake?';
      const engine = backend === 'gemini' ? 'gemini' : 'twelvelabs';

      let text: string;
      let model: string;
      let usedFps: number | undefined;
      if (engine === 'gemini') {
        usedFps = clampFps(fps);
        model = config.gemini.analysisModel;
        text = await analyzeGemini(ask, video, usedFps);
      } else {
        model = config.twelvelabs.model;
        text = await analyzeTwelveLabs(ask, video);
      }
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ text, backend: engine, model, fps: usedFps }));
      return;
    }
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('Not found');
  } catch (err) {
    res.writeHead(400, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: errorMessage(err) }));
  }
});

server.listen(PORT, () => {
  console.log(`\n  Module-feedback UI → http://localhost:${PORT}`);
  console.log(`  Uses TWELVELABS_API_KEY from .env. Ctrl+C to stop.\n`);
});
