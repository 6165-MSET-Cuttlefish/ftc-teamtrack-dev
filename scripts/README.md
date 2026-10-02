# Scripts

One-off maintenance scripts for the Firestore data. They have no dependencies
(Node 18+, plain REST calls), change nothing unless `--apply` is given, and
talk to the emulator unless `--live` is passed. Each script's header comment
describes exactly what it reads and writes.

| Script                  | What it fixes                                                                                                                                                         |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `backfill-teams.mjs`    | Teams saved before `memberIds`, `ownerId` and `teamInvites` existed. **Required before deploying `firestore.rules`.**                                                 |
| `backfill-sessions.mjs` | Share links without a `sessionId`, and sessions without a `season` tag. **Required as part of the release**: until it has run, old share links outlive their session. |

## Releasing the team rules: the order matters

`firestore.rules`, the client and the data have to change together. Do it in
this order, in one sitting:

1. **Backfill the teams** (below).
2. **Deploy the Firestore rules** (and indexes, if `firebase.json` lists any):
   `firebase deploy --only firestore`.
   CI does not do this — `.github/workflows/firebase-hosting-merge.yml`
   deploys Hosting only — so it is a manual step.
3. **Deploy Hosting** straight afterwards (merging to `main` does it).
4. **Backfill the share links** (`backfill-sessions.mjs`, below) as soon as
   the rules are out. Earlier does no harm but isn't enough: until the rules
   refuse it, a tab running the old client can still make a link without a
   `sessionId`, and the script has to be run again to pick it up.

Why:

- The rules take a team's owner from `ownerId` and its members from
  `memberIds`. A team without `memberIds` loads for none of its members. A
  team without `ownerId` falls back to the member whose role is `owner`, which
  the rules can only look for in the first ten member slots — the backfill
  removes the need for that fallback.
- The rules only let an invite link be written by the owner of the team that
  uses the code, and never re-pointed or deleted: a code a team stops using
  keeps its `teamInvites` document, marked `revoked`. A team with no
  `teamInvites` document has a dead invite link until its owner next opens the
  app; the backfill writes it for everyone at once, and untangles any code two
  teams both claim.
- The new client and the new rules use a different join handshake from the old
  ones (`joinCode` is now `<invite code>:<uid>`, and a team is written
  together with its invite document, and deleted together with it). Between
  steps 2 and 3 — and in any tab still running the old client afterwards —
  creating a team, joining one, regenerating an invite code and leaving a
  team as its last member fail until the page is reloaded. They fail whole:
  the rules refuse a team deleted without retiring its invite, so an old tab
  cannot leave a live link behind. Keep the gap short.

## backfill-teams.mjs

For every team it makes sure that `memberIds` exists, that `ownerId` names a
current member (role `owner` → creator if still a member → longest-standing
member), that `teamInvites/{inviteCode}` points at the team, and that no stale
`joinCode` is left. Teams sharing one invite code both get a new code, since
the script cannot tell whose it was; their owners need to share the new link.
Invite codes no team uses are retired (`revoked: true`), not deleted, so that
nobody else can claim a code whose link is still in an old chat. Run twice,
the second run reports nothing to do.

Try it on the emulator first:

```sh
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 \
  node scripts/backfill-teams.mjs --project demo-teamtrack
```

Against the real project (the ID is in `.firebaserc`). The token must belong
to someone allowed to read and write Firestore for the project:

```sh
# 1. Dry run. Read every line it prints.
GOOGLE_OAUTH_ACCESS_TOKEN="$(gcloud auth print-access-token)" \
  node scripts/backfill-teams.mjs --project <project-id> --live

# 2. Only then:
GOOGLE_OAUTH_ACCESS_TOKEN="$(gcloud auth print-access-token)" \
  node scripts/backfill-teams.mjs --project <project-id> --live --apply
```

A team that changes while the script runs is skipped and listed as a failed
write; run the script again to pick it up. Lines starting `WARNING` (a roster
whose `memberIds` and `members` disagree, a team nobody can own) are left for
a human to look at.

## backfill-sessions.mjs

Every share link that exists before this release was saved without the
`sessionId` and `sessionOwnerId` of the session it was made from. The app
finds a session's links by those two fields, so until the script has filled
them in:

- **Deleting a session leaves other people's links to it open.** A link a
  teammate made stays public, notes included, after the session's author
  deletes the session; so does the author's own link when the team's owner
  deletes it.
- The author's "Stop sharing" reports no share links while a teammate's old
  link still opens.

The app can only take down the old links its own user made (Profile → Share
Links lists them, and "Stop sharing" on the session finds them by match ID).
Nobody else's — the rules let a user list links by `createdBy` or
`sessionOwnerId`, and an old link has only the first. So **run this before
anyone deletes a session that was shared before the release**: once the
session is gone the script has nothing to match the link to, and can only
report it.

The script matches each old link to its session by match ID (match IDs are
unique to a session; a link with no matches is matched by name and notes
among its creator's own empty sessions, and only when exactly one fits) and
writes the two fields. It also tags every session that has no `season` with
`biobuzz` or `decode`, by the shape of its matches; that part is optional —
the client works the season out the same way on every read. Run twice, the
second run reports nothing to do.

```sh
# Emulator
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 \
  node scripts/backfill-sessions.mjs --project demo-teamtrack

# 1. Dry run against the real project. Read every line it prints.
GOOGLE_OAUTH_ACCESS_TOKEN="$(gcloud auth print-access-token)" \
  node scripts/backfill-sessions.mjs --project <project-id> --live

# 2. Only then:
GOOGLE_OAUTH_ACCESS_TOKEN="$(gcloud auth print-access-token)" \
  node scripts/backfill-sessions.mjs --project <project-id> --live --apply
```

Lines ending `no surviving session (left as is)` are links whose session was
already deleted. They are still public, and nobody but whoever made each one
can remove it from the app. Read the list, then delete them with:

```sh
GOOGLE_OAUTH_ACCESS_TOKEN="$(gcloud auth print-access-token)" \
  node scripts/backfill-sessions.mjs --project <project-id> --live --apply \
  --delete-orphan-shares
```

A document that changes while the script runs is skipped and listed as a
failed write; run the script again to pick it up.

## test-ranking-points.mjs

Not a data script: boundary tests for the ranking points in
`client/src/lib/scoring.ts` (SWARM at 16 LEAVE + PARK points, POLLINATOR 1 and
2 at 4 and 7 HIVE TIPS). The repo has no test runner, so it uses Node's own
and loads the source through the installed Vite. It reads and writes no data:

```sh
node scripts/test-ranking-points.mjs
```
