# TeamTrack Video Analysis Worker

A Cloudflare Worker that proxies Gemini API calls for the Robot Video Analysis
feature. It's the only thing that holds the Gemini API key — the key must
never be shipped to the browser. Runs entirely on Cloudflare's free tier
(no credit card required).

## What it does

`POST /analyze` — verifies the caller's Firebase ID token, then:
1. Calls `gemini-robotics-er-1.6-preview` once per uploaded frame to detect
   FTC robot bounding boxes.
2. Calls `gemini-2.5-flash` with the assembled tracking data + a few frames
   to generate a coaching report.
3. Returns `{ tracking, report }`.

## One-time setup

1. Get a free Gemini API key from [Google AI Studio](https://aistudio.google.com)
   (no billing required).
2. Install dependencies: `cd worker && npm install`.
3. Log in to Cloudflare (free account, no card): `npx wrangler login`.
4. Check `wrangler.toml` — `FIREBASE_PROJECT_ID` should match your Firebase
   project ID, and `ALLOWED_ORIGIN` should match your Firebase Hosting URL
   (or `http://localhost:5173` while testing locally).
5. Deploy: `npx wrangler deploy`. This prints your Worker's URL
   (`https://teamtrack-video-analysis.<your-subdomain>.workers.dev`).
6. Set the Gemini key as a secret (never put it in `wrangler.toml`):
   `npx wrangler secret put GEMINI_API_KEY`
7. Copy the Worker URL into the app's `.env` as `VITE_GEMINI_WORKER_URL`,
   and add it as a GitHub repo secret (`VITE_GEMINI_WORKER_URL`) so
   production builds pick it up.

## Local development

`npm run dev` runs the Worker locally with `wrangler dev`. Point
`VITE_GEMINI_WORKER_URL` in the app's `.env` at the printed local URL
(e.g. `http://localhost:8787`) and set `ALLOWED_ORIGIN` in `wrangler.toml`
to `http://localhost:5173` while testing.
