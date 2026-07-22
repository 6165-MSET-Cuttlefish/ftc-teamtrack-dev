# Dev Videos

Drop video files (`.mp4`, `.mov`, `.webm`, `.m4v`, `.ogg`) directly into this
folder. They will automatically show up in the dev-only captioning UI at:

    http://localhost:8080/dev/videos

(run `yarn dev` first — the page only exists in the dev build.)

## How captions are stored

Each video's caption is written to `captions.json` in this same folder, keyed
by filename:

```json
{
  "match-1-auton.mp4": "Robot scores 3 samples then parks",
  "match-2-teleop.mov": "Intake jams at 0:45"
}
```

This file is written by a dev-only Vite middleware whenever you save a caption,
so labels persist across reloads and can be committed to the repo. No database
or auth required.

You can also **Discard** a video from the UI, which deletes the file from this
folder and removes its caption from `captions.json`.

## Why this folder is at the repo root

⚠️ **Do not move this folder into `client/public/`.** Anything in Vite's public
dir is copied verbatim into `dist/` on build, and `firebase.json` deploys
`dist/spa` — so every clip dropped in here would be published to the public
TeamTrack site (the repo being private does not protect Firebase Hosting).

Living at the repo root keeps the videos out of the production build entirely.
In dev they're served by the `dev-videos` middleware in `vite.config.ts`, which
supports HTTP range requests so seeking still works.

## What gets committed

Only `captions.json`, this README, and `.gitignore` are tracked — the videos
themselves are gitignored (see `.gitignore` here). The captions are the valuable
artifact; share the raw footage out-of-band rather than committing it.
