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
this order:

1. **Backfill the teams** (below). Repeat the dry run until it exits 0: a team
   listed under `NEEDS A HAND FIX` is left unchanged, and the new rules refuse
   every owner change to it.
2. **Deploy the Firestore rules** (and indexes):
   `firebase deploy --only firestore`.
   CI does not do this — `.github/workflows/firebase-hosting-merge.yml`
   deploys Hosting only — so it is a manual step.
3. **Deploy Hosting** straight afterwards (merging to `main` does it).
4. **Backfill the share links** (`backfill-sessions.mjs`, below) as soon as
   the rules are out. Earlier does no harm but isn't enough: until the rules
   refuse it, a tab running the old client can still make a link without a
   `sessionId`.
5. **Run both scripts again once the old client is gone** — about 75 minutes
   after step 3 (see "Old tabs" below), and after anyone who had the app open
   has reloaded. Read the dry runs before applying anything.

Rules first, Hosting second — never the other way round. Hosting before the
rules puts the new client on the old rules, and that breaks more, and worse,
than the reverse: creating, joining, renaming and regenerating a team, removing
a member, the last member leaving, a team owner deleting a member's session,
"Stop sharing" on a teammate's link, and deleting the account of a team's only
owner all fail. Also don't open a pull request from the release branch before
the rules are out: `.github/workflows/firebase-hosting-pull-request.yml` builds
previews against the production project, under its live rules.

Why the order:

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
  together with its invite document, and deleted together with it). Removing
  a member must also change the invite code in the same write, so the removed
  member can't come back in with the code they already have.

### Old tabs after the rules are out

The old client keeps running after step 2: in tabs left open, and for up to an
hour in browsers that cached the old `index.html` (the old Hosting config sent
no `Cache-Control`; this one sends `no-cache` for the page, so the next release
won't have that tail). Measured against the new rules, after the backfill:

| In an old tab                                          | Result                                                                                                                                                                                   |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sign in, save, list, analysis, charts, edit, rename    | work                                                                                                                                                                                     |
| Archive / unarchive, delete a session, delete account  | work                                                                                                                                                                                     |
| Rename a team, change a display name, import to a team | work (a renamed team's invite still shows the old name until the re-run in step 5)                                                                                                       |
| Create a team, join one (link or code)                 | **fail** with an error                                                                                                                                                                   |
| Regenerate the code, remove a member                   | **fail** with an error                                                                                                                                                                   |
| Leave a team as its owner (with members, or last)      | **fail** with an error                                                                                                                                                                   |
| Share a session                                        | **fails silently**: "copied", but the link is an old-style `?data=` URL with nothing stored, which the new app refuses to open                                                           |
| Transfer ownership                                     | **half-applies silently**: the role moves, `ownerId` doesn't, so the new owner can't manage the team and the old one still can. Step 5 lists these teams; settle them as described below |
| Save a session                                         | works, but it is last season's shape: the new app lists it under last season (its CSV export), not this season's sessions                                                                |

Tell users to reload. Then, in step 5:

- `backfill-teams.mjs` lists every team whose `ownerId` and owner role disagree
  under `NEEDS A HAND FIX`. Usually that is a transfer made from an old tab —
  but under the old rules any member could write the role, so check with the
  team before trusting it. For each real transfer, run it again with
  `--apply --owner-from-role <teamId,...>`; otherwise fix the role by hand.
  Never resolve them by restoring the old owner blindly: the script doesn't,
  and a person shouldn't either.
- `backfill-sessions.mjs --apply` tags the sessions old tabs saved and links
  any old-style share link made before the rules were out.

`/assets/*` files are content-hashed, but Hosting still serves them with its
default cache. A year-long `immutable` header would also be sent with the 404
for a missing file (headers match by path), and old tabs ask for the old
build's file names: their browsers would remember those 404s for a year, which
would break the old client if Hosting were ever rolled back to it. Add it in a
release that doesn't need a rollback path to the old client.

## backfill-teams.mjs

For every team it makes sure that `memberIds` exists, that `ownerId` names a
current member (role `owner` → creator if still a member → longest-standing
member), that `teamInvites/{inviteCode}` points at the team, and that no
`joinCode` for an old code is left. Teams sharing one invite code both get a new code, since
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
write; run the script again to pick it up.

Teams it can't fix safely are left exactly as they were, printed with
`WARNING` as they come up, and listed again at the end under
`NEEDS A HAND FIX`, each with what is wrong and how to fix it; the exit code is
then 2 (1 means a read or write failed). **Treat exit code 2 as a stop: fix
each listed team in the console, run the dry run again, and apply only once it
exits 0.** Deploying the rules before then leaves those teams' owners unable to
change anything. The cases:

- `memberIds` and `members[]` disagree (someone in one list but not the other,
  a duplicate, an entry without a `userId`). The rules require them to match,
  and which one is right can't be told from the data: a member missing from
  `memberIds` can't open the team, one missing from `members[]` still can.
- `ownerId` names a member, but another member holds the `owner` role: an
  ownership transfer from an old tab, or a stale role. The script never moves
  ownership on its own. If the role holder should own it, run again with
  `--owner-from-role <teamId>` (comma-separate several); otherwise give the
  role back by hand.
- No owner can be determined.

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

The script matches each old link to its session by match ID and writes the
two fields. The old app's match IDs were timestamps, so two users' sessions
can hold the same one: the link creator's own sessions win, then sessions
filed under a team the creator is in; anyone else's only counts when it holds
every match of the link under the link's name. A link with no matches is
matched by name and notes among its creator's own empty sessions (then by name
among their team's), and only when exactly one fits. A link it can't settle is
printed with `WARNING not linked` and the reason, and kept. It also tags every
session that has no `season` with `biobuzz` or `decode`, by the shape of its
matches (one with no matches is last season's: everything this season's app
saves is tagged). Run it: the client works the season out the same way on
every read, but the "Sessions from last season (DECODE)" export on My Sessions
only finds tagged sessions. Run twice, the second run reports nothing to do.

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

Lines with `orphan` are links no session points back to: no session holds
any of their match IDs, and none has their name. They are still public, and
nobody but whoever made each one can remove it from the app. A session that
was renamed _and_ had its shared matches removed looks the same, so check each
one (open `/shared/preview?id=<id>`) before deleting them with the command
below. `WARNING not linked` lines are never deleted by the script: a session
they may have come from still exists.

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
