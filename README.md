# TeamTrack

TeamTrack is a scouting and performance tracking app for FTC (FIRST Tech Challenge) teams. You can record scores during practice matches, review trends across sessions, and share results with your team.

## What it does

- Score matches live with a timer-based UI that mirrors the autonomous/teleop split
- Save and review past sessions, edit them after the fact
- Charts and comparison views across multiple sessions
- Team accounts with invite codes so multiple members can access the same data
- Generate a shareable link for any session (no login required to view)
- Guest mode for trying it out without an account — data is saved locally

## Stack

React 19, TypeScript, Vite, Tailwind CSS, shadcn/ui, Firebase (Auth + Firestore + Hosting), Recharts.

## Setup

You'll need Node.js 18+, Yarn, and a Firebase project with Email/Password auth and Firestore enabled.

```bash
git clone https://github.com/6165-MSET-Cuttlefish/ftc-teamtrack.git
cd ftc-teamtrack
yarn install
```

Create a `.env` file from the example and fill in your Firebase project config (found in the Firebase console under Project Settings → Your apps):

```bash
cp .env.example .env
```

```env
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=000000000000
VITE_FIREBASE_APP_ID=1:000000000000:web:xxxxxxxxxxxx
VITE_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX
```

Deploy the Firestore security rules and indexes, then start the dev server:

```bash
firebase deploy --only firestore
yarn dev
```

The session lists query by owner or team and sort by date, which needs the composite indexes in `firestore.indexes.json`. Without them those queries fail and the lists come back empty.

The app runs at [http://localhost:8080](http://localhost:8080).

## Testing on a phone

`vite.config.ts` binds the dev server to `localhost` only, so by default nothing outside your machine can reach it. To test on a real phone on the same Wi-Fi:

```bash
yarn vite --host 0.0.0.0
```

(`--host` on the CLI overrides the `localhost` in the config. Don't run this alongside a plain `yarn dev` — both bind the same HMR websocket port, `24678`, and the second one will fail to start.)

Vite prints a `Network:` URL once it's up:

```
➜  Local:   http://localhost:8080/
➜  Network: http://192.168.1.23:8080/
```

Open that `Network` address in your phone's browser. If it doesn't load, your computer's firewall is likely blocking the inbound connection on first run — allow it and retry.

You don't need Firebase configured to test the UI: on the login screen, tap **Continue as Guest**. Guest sessions are saved to the browser's local storage instead of Firestore, so this works without a `.env` file at all.

## Scripts

```
yarn dev          start the dev server
yarn build        production build
yarn preview      preview the production build locally
yarn lint         run ESLint
yarn lint:fix     auto-fix lint issues
yarn format       check formatting
yarn format:fix   auto-fix formatting
yarn typecheck    run tsc
yarn clean        lint:fix + format:fix + typecheck
```

## Deployment

Yarn is the only package manager: `yarn.lock` is the lockfile CI installs from (`yarn install --frozen-lockfile`), and `package-lock.json` is git-ignored.

A release has up to three parts, and the order matters:

1. **Backfill the data**, when the release changes what the Firestore rules expect. See [scripts/README.md](scripts/README.md) for which script is required and how to dry-run it. The share-link backfill listed there is the exception to the order: it runs straight after step 2.
2. **Deploy the Firestore rules and indexes**:

   ```bash
   firebase deploy --only firestore
   ```

3. **Deploy Hosting**:

   ```bash
   yarn build
   firebase deploy --only hosting
   ```

CI (GitHub Actions, see `.github/workflows/`) only does step 3: merging to `main` builds and deploys Hosting. Steps 1 and 2 are manual, so run them before merging a change that touches `firestore.rules`, `firestore.indexes.json` or the shape of the stored data.

`firebase.json` serves the app shell (`index.html`, at every route) with `Cache-Control: no-cache`, so a new deploy is picked up on the next load, and returns a real 404 for a missing file under `/assets` instead of the app shell. A tab left open across a deploy reloads itself once when it asks for a page that no longer exists.

## Project structure

```
client/src/
  components/
    auth/       auth guards and prompts
    layout/     header, error boundary
    session/    match scoring and tracking UI
    ui/         shadcn/ui base components
  constants/    app config and game constants
  contexts/     React contexts (Auth, Session, Team, Theme)
  hooks/
  lib/          Firebase init, storage utilities, logging
  pages/
  services/     Firestore read/write layer
  types/
client/public/   files copied to the build as-is (404 page, match audio)
scripts/         one-off Firestore maintenance scripts
firestore.rules
firestore.indexes.json
firebase.json
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE).
