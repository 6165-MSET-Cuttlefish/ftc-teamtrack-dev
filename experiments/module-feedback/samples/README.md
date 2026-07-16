# samples/

Drop robot clips here to analyze, e.g. `intake.mp4`, then:

```bash
tsx src/cli.ts compare --video ./samples/intake.mp4
```

**Video files in this folder are gitignored** (they're large and often
team-private) — only this README is tracked. Tips for good clips:

- Steady, side-on view of the one mechanism you want feedback on.
- A few successful and a few failed cycles in the same clip is ideal.
- Shoot at a high frame rate (phone slow-mo is fine); the tools sample frames,
  they don't need the raw 240 FPS.

No clip handy? Run the offline demo instead: `yarn demo`.
