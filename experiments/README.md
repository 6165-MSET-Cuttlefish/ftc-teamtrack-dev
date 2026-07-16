# experiments/

Side projects and proofs-of-concept that live in this repo but are **not part
of the deployed TeamTrack website**. Nothing here is built or served by the web
app (Vite builds only `client/` → `dist/spa`; Firebase Hosting serves only
`dist/spa`). Each experiment is self-contained with its own `package.json`.

Keeping these in-repo — rather than a separate repo — means the planning docs,
issues, and history stay in one place while an idea is still a POC. If one
graduates into the product, it moves into `client/` at that point.

## Current experiments

- **[`module-feedback/`](./module-feedback/)** — TeamTrack v2 "BioBuzz": an AI
  system that analyzes FTC robot video and returns mechanism-improvement
  suggestions. Proof-of-concept CLI; see its README for status.
