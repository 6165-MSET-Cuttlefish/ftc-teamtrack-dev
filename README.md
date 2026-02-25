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

Deploy the Firestore security rules, then start the dev server:

```bash
firebase deploy --only firestore:rules
yarn dev
```

The app runs at [http://localhost:8080](http://localhost:8080).

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

The project deploys to Firebase Hosting:

```bash
yarn build
firebase deploy --only hosting
```

CI is set up via GitHub Actions — see `.github/workflows/`.

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
firestore.rules
firebase.json
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE).
