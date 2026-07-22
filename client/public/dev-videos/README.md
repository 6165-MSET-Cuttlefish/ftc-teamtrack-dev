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

> Note: files here are served statically by Vite in dev. Avoid committing large
> videos you don't want in the repo — see `.gitignore` in this folder.
