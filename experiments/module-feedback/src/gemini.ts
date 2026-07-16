/**
 * Shared Gemini helpers used by both Method 1 (analysis pass) and Method 3
 * (robotics model). Wraps @google/genai: client, Files-API video upload with
 * polling, FPS-aware video parts, and defensive JSON parsing.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { GoogleGenAI } from '@google/genai';
import { config, requireGeminiKey } from './config.ts';
import { log } from './logger.ts';

const MIME_BY_EXT: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',
  '.mkv': 'video/x-matroska',
  '.avi': 'video/x-msvideo',
};

export function mimeTypeForVideo(filePath: string): string {
  return MIME_BY_EXT[path.extname(filePath).toLowerCase()] ?? 'video/mp4';
}

export function makeGeminiClient(): GoogleGenAI {
  return new GoogleGenAI({ apiKey: requireGeminiKey() });
}

/** A part the SDK understands, plus the fps sampling hint for video. */
export interface VideoPart {
  fileData: { fileUri: string; mimeType: string };
  videoMetadata?: { fps?: number; startOffset?: string; endOffset?: string };
}

/**
 * Upload a local video through the Files API and wait until it's ACTIVE.
 * Returns a video Part carrying the fps sampling rate from config, so the model
 * samples faster than the default 1 FPS (the core lever the plan calls out).
 */
/**
 * Upload a local video via the Files API and wait until it's ACTIVE. Returns the
 * file URI so callers can reference it in one or many generateContent calls
 * (e.g. an FPS sweep uploads once and reuses this across every FPS setting).
 */
export async function uploadVideoFile(
  ai: GoogleGenAI,
  filePath: string,
): Promise<{ fileUri: string; mimeType: string }> {
  const mimeType = mimeTypeForVideo(filePath);
  log.info(`uploading ${path.basename(filePath)} to the Gemini Files API…`);
  const uploaded = await ai.files.upload({ file: filePath, config: { mimeType } });

  const name = uploaded.name;
  if (!name) throw new Error('Files API upload did not return a file name.');

  // Poll until the file finishes processing.
  let file = uploaded;
  while (file.state === 'PROCESSING') {
    await sleep(3000);
    file = await ai.files.get({ name });
  }
  if (file.state === 'FAILED') {
    throw new Error(`Gemini failed to process the video (${name}).`);
  }

  const fileUri = file.uri;
  if (!fileUri) throw new Error('Files API did not return a usable file URI.');
  return { fileUri, mimeType: file.mimeType ?? mimeType };
}

export async function uploadVideoPart(ai: GoogleGenAI, filePath: string): Promise<VideoPart> {
  const { fileUri, mimeType } = await uploadVideoFile(ai, filePath);
  log.info(`video ready (sampling at ${config.gemini.videoFps} FPS)`);
  return {
    fileData: { fileUri, mimeType },
    videoMetadata: { fps: config.gemini.videoFps },
  };
}

/** Small (<~20MB) clips can skip the Files API and go inline as base64. */
export async function inlineVideoPart(filePath: string) {
  const data = await readFile(filePath);
  return {
    inlineData: { data: data.toString('base64'), mimeType: mimeTypeForVideo(filePath) },
    videoMetadata: { fps: config.gemini.videoFps },
  };
}

/**
 * Classify a Gemini error as transient (worth retrying): 503 model overload or
 * 429 rate limit. Returns the status code, or null if it's not transient.
 */
export function transientGeminiStatus(err: unknown): 503 | 429 | null {
  const e = err as { status?: unknown; code?: unknown; message?: unknown };
  const num = Number(e?.status ?? e?.code);
  // The SDK may put the detail in the message (a JSON string) or a string status.
  const text = `${String(e?.status ?? '')} ${String(e?.message ?? '')}`;
  if (num === 503 || /\b503\b|UNAVAILABLE|overloaded|high demand/i.test(text)) return 503;
  if (num === 429 || /\b429\b|RESOURCE_EXHAUSTED|rate limit/i.test(text)) return 429;
  return null;
}

/** Retry a Gemini call on transient 503/429 with exponential backoff (2s, 4s, 8s). */
export async function withGeminiRetry<T>(fn: () => Promise<T>, retries = 3, baseMs = 2000): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const status = transientGeminiStatus(err);
      if (status === null || attempt >= retries) throw err;
      const wait = baseMs * 2 ** attempt;
      log.warn(`Gemini ${status} (transient) — retrying in ${wait / 1000}s (attempt ${attempt + 1}/${retries})…`);
      await sleep(wait);
    }
  }
}

/**
 * Run a generateContent call that should return JSON, and parse it defensively.
 * `asJson` requests application/json where the model supports it.
 */
export async function generateJson(
  ai: GoogleGenAI,
  opts: { model: string; parts: unknown[]; asJson?: boolean },
): Promise<{ text: string; parsed: unknown | null }> {
  const response = await withGeminiRetry(() =>
    ai.models.generateContent({
      model: opts.model,
      contents: [{ role: 'user', parts: opts.parts as never }],
      config: opts.asJson ? { responseMimeType: 'application/json' } : {},
    }),
  );

  const text = response.text ?? '';
  return { text, parsed: extractJson(text) };
}

/**
 * Pull a JSON value out of model text. Handles clean JSON, ```json fences, and
 * JSON embedded in prose. Returns null if nothing parses (caller keeps rawText).
 */
export function extractJson(text: string): unknown | null {
  if (!text) return null;

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidates: string[] = [];
  if (fenced?.[1]) candidates.push(fenced[1]);
  candidates.push(text);

  // Also try the first {...} or [...] span in the raw text.
  const span = sliceFirstJsonSpan(text);
  if (span) candidates.push(span);

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate.trim());
    } catch {
      /* try the next candidate */
    }
  }
  return null;
}

function sliceFirstJsonSpan(text: string): string | null {
  const firstObj = text.indexOf('{');
  const firstArr = text.indexOf('[');
  const starts = [firstObj, firstArr].filter((i) => i >= 0);
  if (!starts.length) return null;
  const start = Math.min(...starts);
  const open = text[start];
  const close = open === '{' ? '}' : ']';
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === open) depth++;
    else if (text[i] === close && --depth === 0) return text.slice(start, i + 1);
  }
  return null;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
