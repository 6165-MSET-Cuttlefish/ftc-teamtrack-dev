#!/usr/bin/env node
/**
 * One-off data backfill for sessions and share links saved before two fields
 * existed. Part 1 is optional — the client copes with untagged sessions.
 * Part 2 is not: run it as part of the release (see scripts/README.md).
 *
 * 1. sessions/{id} without `season`
 *    Tagged 'biobuzz' or 'decode' by the shape of their matches (the same
 *    rule as client/src/lib/sessionNormalize.ts — keep the key lists below in
 *    step with it). Once every session is tagged, the list queries in
 *    client/src/services/firebaseService.ts can filter with
 *    where('season', '==', CURRENT_SEASON) instead of paging past old ones.
 *
 * 2. sharedSessions/{id} without `sessionId`
 *    Given the `sessionId` and `sessionOwnerId` of the session they were made
 *    from, found by match ID (match IDs are unique to a session). That is
 *    what lets the session's owner take the link down, and lets deleting the
 *    session remove it. Until then the app can only find an old link for the
 *    person who made it: anyone else's stays public when its session is
 *    deleted, and once the session is gone it can no longer be matched. So
 *    this has to run before sessions shared before the release are deleted.
 *    Links whose session no longer exists are listed, and deleted only if
 *    --delete-orphan-shares is given.
 *
 * It has no dependencies (Node 18+, plain REST) and changes nothing unless
 * --apply is given.
 *
 * Emulator (uses the emulator's admin bypass, no credentials needed):
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 \
 *     node scripts/backfill-sessions.mjs --project demo-teamtrack [--apply]
 *
 * Live project (project owner only; the token must be allowed to read and
 * write Firestore, e.g. `gcloud auth print-access-token`):
 *   GOOGLE_OAUTH_ACCESS_TOKEN=... \
 *     node scripts/backfill-sessions.mjs --project <project-id> --live [--apply]
 *
 * Always read the dry-run output before adding --apply.
 */

const CURRENT_SEASON = 'biobuzz';
const LEGACY_SEASON = 'decode';

/** Fields only a BIOBUZZ match carries. */
const CURRENT_MATCH_KEYS = ['tipping', 'garden'];

/** Fields only a DECODE match carries. */
const LEGACY_MATCH_KEYS = [
  'autonomousScore',
  'teleopScore',
  'endGameScore',
  'autonClassifiedArtifact',
  'autonOverflowArtifact',
  'autonMotif',
  'autonLeave',
  'autonBallsMissed',
  'teleClassifiedArtifact',
  'teleOverflowArtifact',
  'teleMotif',
  'teleBallsMissed',
  'robot1Park',
  'robot2Park',
  'gateBallCount',
  'motifPattern',
  'cycleTimes',
  'autonShots',
  'teleopShots',
  'gateEnabled',
];

const PAGE_SIZE = 100;

const args = process.argv.slice(2);
const flag = name => args.includes(name);
const option = name => {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
};

const usage = message => {
  if (message) console.error(`Error: ${message}\n`);
  console.error(
    [
      'Usage: node scripts/backfill-sessions.mjs --project <id> [--apply] [--delete-orphan-shares] [--live]',
      '',
      '  --project <id>            Firebase project ID (required)',
      '  --apply                   Write the changes (default: dry run, prints what would change)',
      '  --delete-orphan-shares    With --apply, delete old share links whose session no longer exists',
      '  --live                    Required to run against a real project instead of the emulator',
      '',
      'Emulator: set FIRESTORE_EMULATOR_HOST=host:port.',
      'Live:     set GOOGLE_OAUTH_ACCESS_TOKEN and pass --live.',
    ].join('\n')
  );
  process.exit(message ? 1 : 0);
};

if (flag('--help') || flag('-h')) usage();

const project = option('--project');
if (!project || project.startsWith('--')) usage('--project is required');

const apply = flag('--apply');
const deleteOrphans = flag('--delete-orphan-shares');
const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;
const token = process.env.GOOGLE_OAUTH_ACCESS_TOKEN;

if (!emulatorHost && !flag('--live')) {
  usage(
    'FIRESTORE_EMULATOR_HOST is not set. Pass --live to run against the real project.'
  );
}
if (emulatorHost && flag('--live')) {
  usage('--live and FIRESTORE_EMULATOR_HOST are both set; pick one.');
}
if (!emulatorHost && !token) {
  usage('GOOGLE_OAUTH_ACCESS_TOKEN is required for a live project.');
}

const origin = emulatorHost
  ? `http://${emulatorHost}`
  : 'https://firestore.googleapis.com';
const documentsUrl = `${origin}/v1/projects/${project}/databases/(default)/documents`;
const headers = {
  // "owner" is the emulator's admin token: it bypasses security rules.
  Authorization: `Bearer ${emulatorHost ? 'owner' : token}`,
  'Content-Type': 'application/json',
};

const request = async (url, init = {}) => {
  const response = await fetch(url, { ...init, headers });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `${init.method ?? 'GET'} ${url} -> ${response.status} ${body.slice(0, 300)}`
    );
  }
  return response.status === 204 ? null : response.json();
};

/** Every document in a top-level collection, one page at a time. */
async function* listDocuments(collectionId) {
  let pageToken;
  do {
    const params = new URLSearchParams({ pageSize: String(PAGE_SIZE) });
    if (pageToken) params.set('pageToken', pageToken);
    const page = await request(`${documentsUrl}/${collectionId}?${params}`);
    yield* page.documents ?? [];
    pageToken = page.nextPageToken;
  } while (pageToken);
}

const idOf = document => document.name.split('/').pop();
const stringOf = value => value?.stringValue;
/** The map entries of a stored array field (anything else in it is ignored). */
const mapsOf = value =>
  (value?.arrayValue?.values ?? [])
    .map(entry => entry.mapValue?.fields)
    .filter(Boolean);
const matchIdsOf = fields =>
  mapsOf(fields?.matches)
    .map(match => stringOf(match.id))
    .filter(Boolean);

/** Same rule as isCurrentSeasonSession in client/src/lib/sessionNormalize.ts. */
const seasonByShape = fields =>
  mapsOf(fields?.matches).every(
    match =>
      CURRENT_MATCH_KEYS.some(key => key in match) &&
      !LEGACY_MATCH_KEYS.some(key => key in match)
  )
    ? CURRENT_SEASON
    : LEGACY_SEASON;

/**
 * One write, applied only if the document hasn't changed since it was read
 * (so a session being edited right now is skipped, not clobbered). Sent
 * through `:commit` because that is where a precondition goes in the body.
 */
const commit = (document, write) =>
  request(`${documentsUrl}:commit`, {
    method: 'POST',
    body: JSON.stringify({
      writes: [
        { ...write, currentDocument: { updateTime: document.updateTime } },
      ],
    }),
  });

/** Set string fields on a document, leaving every other field alone. */
const patchStrings = (document, values) =>
  commit(document, {
    update: {
      name: document.name,
      fields: Object.fromEntries(
        Object.entries(values).map(([key, value]) => [
          key,
          { stringValue: value },
        ])
      ),
    },
    updateMask: { fieldPaths: Object.keys(values) },
  });

const deleteDocument = document => commit(document, { delete: document.name });

const main = async () => {
  console.log(
    `${apply ? 'APPLYING to' : 'Dry run against'} ${
      emulatorHost ? `the emulator at ${emulatorHost}` : 'the LIVE project'
    } "${project}"${apply ? '' : ' — nothing will be written (add --apply)'}\n`
  );

  const failures = [];
  const attempt = async (label, write) => {
    if (!apply) return;
    try {
      await write();
    } catch (error) {
      failures.push(`${label}: ${error.message}`);
    }
  };

  // ── 1. Season tags ────────────────────────────────────────────────────
  /** matchId -> the session it belongs to */
  const sessionByMatchId = new Map();
  /** "owner\nname\nnotes" -> sessions with no matches, for links with none */
  const emptySessions = new Map();
  const tagged = { [CURRENT_SEASON]: 0, [LEGACY_SEASON]: 0 };
  let sessionCount = 0;
  let alreadyTagged = 0;

  for await (const document of listDocuments('sessions')) {
    sessionCount++;
    const fields = document.fields ?? {};
    const session = { id: idOf(document), ownerId: stringOf(fields.userId) };

    const matchIds = matchIdsOf(fields);
    for (const matchId of matchIds) sessionByMatchId.set(matchId, session);
    if (mapsOf(fields.matches).length === 0) {
      const key = [
        session.ownerId,
        stringOf(fields.sessionName),
        stringOf(fields.notes) ?? '',
      ].join('\n');
      emptySessions.set(key, [...(emptySessions.get(key) ?? []), session]);
    }

    if (stringOf(fields.season)) {
      alreadyTagged++;
      continue;
    }
    const season = seasonByShape(fields);
    tagged[season]++;
    console.log(`session ${session.id}: season -> ${season}`);
    await attempt(`session ${session.id}`, () =>
      patchStrings(document, { season })
    );
  }

  // ── 2. Share links without a sessionId ────────────────────────────────
  let shareCount = 0;
  let linked = 0;
  const orphans = [];

  for await (const document of listDocuments('sharedSessions')) {
    shareCount++;
    const fields = document.fields ?? {};
    if (stringOf(fields.sessionId)) continue;
    const shareId = idOf(document);

    const matchIds = matchIdsOf(fields);
    let source = matchIds
      .map(matchId => sessionByMatchId.get(matchId))
      .find(Boolean);
    if (!source && matchIds.length === 0) {
      // Nothing but the name and notes to go by: only trust a unique match
      // among the link creator's own sessions.
      const candidates =
        emptySessions.get(
          [
            stringOf(fields.createdBy),
            stringOf(fields.sessionName),
            stringOf(fields.notes) ?? '',
          ].join('\n')
        ) ?? [];
      if (candidates.length === 1) source = candidates[0];
    }

    if (source?.ownerId) {
      linked++;
      console.log(
        `share ${shareId}: sessionId -> ${source.id}, sessionOwnerId -> ${source.ownerId}`
      );
      await attempt(`share ${shareId}`, () =>
        patchStrings(document, {
          sessionId: source.id,
          sessionOwnerId: source.ownerId,
        })
      );
    } else {
      orphans.push(shareId);
      console.log(
        `share ${shareId}: no surviving session${deleteOrphans ? ' -> delete' : ' (left as is)'}`
      );
      if (deleteOrphans) {
        await attempt(`share ${shareId}`, () => deleteDocument(document));
      }
    }
  }

  const verb = apply ? '' : 'would be ';
  console.log(
    [
      '',
      `Sessions: ${sessionCount} read, ${alreadyTagged} already tagged, ` +
        `${tagged[CURRENT_SEASON]} ${verb}tagged '${CURRENT_SEASON}', ` +
        `${tagged[LEGACY_SEASON]} ${verb}tagged '${LEGACY_SEASON}'.`,
      `Share links: ${shareCount} read, ${linked} ${verb}linked to their session, ` +
        `${orphans.length} with no surviving session` +
        (deleteOrphans
          ? ` (${verb}deleted).`
          : ' (pass --delete-orphan-shares to remove them).'),
    ].join('\n')
  );

  if (failures.length > 0) {
    console.error(`\n${failures.length} write(s) failed:`);
    for (const failure of failures) console.error(`  ${failure}`);
    process.exit(1);
  }
};

main().catch(error => {
  console.error(error.message);
  process.exit(1);
});
