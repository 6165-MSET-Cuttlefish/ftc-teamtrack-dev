import { jwtVerify, createRemoteJWKSet } from 'jose';

export interface Env {
  FIREBASE_PROJECT_ID: string;
  ALLOWED_ORIGIN: string;
  GEMINI_API_KEY: string;
}

interface DetectionBox {
  label: string;
  box_2d: [number, number, number, number];
}

interface TrackingFrame {
  tSec: number;
  boxes: DetectionBox[];
}

interface AnalysisReport {
  summary: string;
  findings: { observation: string; suggestion: string }[];
}

interface RequestFrame {
  tSec: number;
  base64Jpeg: string;
}

const TRACKING_MODEL = 'gemini-robotics-er-1.6-preview';
const ANALYSIS_MODEL = 'gemini-3.5-flash';
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

const jwks = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')
);

/** ALLOWED_ORIGIN may be a comma-separated list (e.g. prod + local dev). */
function resolveOrigin(env: Env, request: Request): string {
  const allowed = env.ALLOWED_ORIGIN.split(',').map((o) => o.trim());
  const requestOrigin = request.headers.get('Origin') ?? '';
  return allowed.includes(requestOrigin) ? requestOrigin : allowed[0];
}

function corsHeaders(origin: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  };
}

function json(data: unknown, status: number, origin: string): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  });
}

async function verifyFirebaseToken(idToken: string, projectId: string): Promise<string> {
  const { payload } = await jwtVerify(idToken, jwks, {
    issuer: `https://securetoken.google.com/${projectId}`,
    audience: projectId,
  });
  if (!payload.sub) throw new Error('Token missing subject');
  return payload.sub;
}

/** Strip markdown code fences and parse the first JSON value found in `text`. */
function extractJson<T>(text: string): T {
  const cleaned = text.replace(/```json\s*|```\s*/g, '').trim();
  return JSON.parse(cleaned) as T;
}

async function callGemini(model: string, body: unknown, env: Env, retries = 1): Promise<string> {
  const response = await fetch(`${GEMINI_BASE}/${model}:generateContent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': env.GEMINI_API_KEY,
    },
    body: JSON.stringify(body),
  });

  if (response.status === 429 && retries > 0) {
    await new Promise((r) => setTimeout(r, 1500));
    return callGemini(model, body, env, retries - 1);
  }

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini ${model} call failed (${response.status}): ${errText.slice(0, 300)}`);
  }

  const data = (await response.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error(`Gemini ${model} returned no text.`);
  return text;
}

async function detectRobots(frame: RequestFrame, env: Env): Promise<TrackingFrame> {
  const prompt =
    'Return bounding boxes for every FTC (FIRST Tech Challenge) competition robot ' +
    'visible in this image, as a JSON array: ' +
    '[{"box_2d": [ymin, xmin, ymax, xmax], "label": "robot_1"}], normalized 0-1000. ' +
    'If multiple robots are visible, label them robot_1, robot_2, etc, consistently by ' +
    'field position (leftmost = robot_1). If no robot is visible, return [].';

  const text = await callGemini(
    TRACKING_MODEL,
    {
      contents: [
        {
          parts: [
            { inlineData: { mimeType: 'image/jpeg', data: frame.base64Jpeg } },
            { text: prompt },
          ],
        },
      ],
      generationConfig: {
        temperature: 1.0,
        thinkingConfig: { thinkingBudget: 0 },
      },
    },
    env
  );

  let boxes: DetectionBox[] = [];
  try {
    boxes = extractJson<DetectionBox[]>(text);
  } catch {
    boxes = [];
  }
  return { tSec: frame.tSec, boxes };
}

async function generateReport(
  tracking: TrackingFrame[],
  representativeFrames: RequestFrame[],
  env: Env
): Promise<AnalysisReport> {
  const prompt =
    'You are an FTC (FIRST Tech Challenge) robotics scouting and build mentor. ' +
    "You're given bounding-box tracking data for a team's robot(s) sampled across a " +
    'short match/practice clip (box_2d is [ymin, xmin, ymax, xmax] normalized 0-1000), ' +
    'plus a few representative frames. Write a concise, concrete improvement report: ' +
    '2-4 specific suggestions tied to what you actually observe (e.g. robot size/shape ' +
    'relative to the field, how much of the frame the robot occupies, movement patterns, ' +
    'apparent mechanism behavior). Avoid generic advice — ground every suggestion in the ' +
    'tracking data or visible frames. Respond with ONLY minified JSON matching: ' +
    '{"summary": string, "findings": [{"observation": string, "suggestion": string}]}.\n\n' +
    `Tracking data:\n${JSON.stringify(tracking)}`;

  const parts: unknown[] = [{ text: prompt }];
  for (const frame of representativeFrames) {
    parts.push({ inlineData: { mimeType: 'image/jpeg', data: frame.base64Jpeg } });
  }

  const text = await callGemini(
    ANALYSIS_MODEL,
    {
      contents: [{ parts }],
      generationConfig: { temperature: 0.4 },
    },
    env
  );

  try {
    return extractJson<AnalysisReport>(text);
  } catch {
    return { summary: text.slice(0, 500), findings: [] };
  }
}

function pickRepresentative(frames: RequestFrame[], count: number): RequestFrame[] {
  if (frames.length <= count) return frames;
  const step = (frames.length - 1) / (count - 1);
  return Array.from({ length: count }, (_, i) => frames[Math.round(i * step)]);
}

async function handleAnalyze(request: Request, env: Env, origin: string): Promise<Response> {
  const body = (await request.json()) as {
    idToken?: string;
    teamId?: string;
    frames?: RequestFrame[];
  };

  if (!body.idToken || !body.teamId || !body.frames?.length) {
    return json({ error: 'Missing idToken, teamId, or frames.' }, 400, origin);
  }
  if (body.frames.length > 20) {
    return json({ error: 'Too many frames.' }, 400, origin);
  }

  try {
    await verifyFirebaseToken(body.idToken, env.FIREBASE_PROJECT_ID);
  } catch {
    return json({ error: 'Invalid or expired auth token.' }, 401, origin);
  }

  try {
    // Stage 1: sequential per-frame robot detection (rate-limit friendly)
    const tracking: TrackingFrame[] = [];
    for (const frame of body.frames) {
      tracking.push(await detectRobots(frame, env));
      await new Promise((r) => setTimeout(r, 300));
    }

    // Stage 2: coaching analysis grounded in the tracking data
    const representative = pickRepresentative(body.frames, 3);
    const report = await generateReport(tracking, representative, env);

    return json({ tracking, report }, 200, origin);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Analysis failed.';
    return json({ error: message }, 502, origin);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = resolveOrigin(env, request);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(origin) });
    }

    const url = new URL(request.url);
    if (url.pathname === '/analyze' && request.method === 'POST') {
      return handleAnalyze(request, env, origin);
    }

    return json({ error: 'Not found' }, 404, origin);
  },
};
