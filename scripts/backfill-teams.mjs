#!/usr/bin/env node
/**
 * One-off data backfill for teams saved before the current team model. Run it
 * BEFORE deploying firestore.rules: the rules assume every team has these
 * fields, and a team without them is unusable (or badly owned) until fixed.
 *
 * For every teams/{id} it makes sure that:
 *
 * 1. `memberIds` exists — the flat list of members[].userId. Members find
 *    their team with an array-contains query on it, and the rules use it for
 *    every membership check, so a team without it loads for nobody.
 *
 * 2. `ownerId` exists and names a current member. Old clients recorded
 *    ownership only as members[].role, and left `createdBy` stale when
 *    ownership was transferred or the creator left. The owner is, in order:
 *    the member whose role is 'owner'; else the creator, if still a member;
 *    else the longest-standing member. members[].role is brought in line.
 *
 * 3. teamInvites/{inviteCode} -> { teamId, teamName } exists, so the team's
 *    invite link resolves. If two teams claim the same code (a collision, or
 *    one team having taken over another's link) both get a fresh code and
 *    the contested code is retired — the script cannot tell whose it was.
 *    Invites no team uses any more are retired too: marked `revoked: true`
 *    and kept, never deleted. A deleted invite frees its code, and anyone
 *    who remembers it could claim it and take over every copy of the old
 *    link; the rules refuse a code that has a retired invite.
 *
 * 4. A leftover `joinCode` (proof written by an earlier join) is removed.
 *
 * It has no dependencies (Node 18+, plain REST) and changes nothing unless
 * --apply is given. Running it again after --apply reports nothing to do.
 *
 * Emulator (uses the emulator's admin bypass, no credentials needed):
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 \
 *     node scripts/backfill-teams.mjs --project demo-teamtrack [--apply]
 *
 * Live project (project owner only; the token must be allowed to read and
 * write Firestore, e.g. `gcloud auth print-access-token`):
 *   GOOGLE_OAUTH_ACCESS_TOKEN=... \
 *     node scripts/backfill-teams.mjs --project <project-id> --live [--apply]
 *
 * Always read the dry-run output before adding --apply.
 */

import { randomInt } from 'node:crypto';

const PAGE_SIZE = 100;
/** Same alphabet and length as generateInviteCode in teamService.ts. */
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 8;

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
      'Usage: node scripts/backfill-teams.mjs --project <id> [--apply] [--live]',
      '',
      '  --project <id>   Firebase project ID (required)',
      '  --apply          Write the changes (default: dry run, prints what would change)',
      '  --live           Required to run against a real project instead of the emulator',
      '',
      'Emulator: set FIRESTORE_EMULATOR_HOST=host:port.',
      'Live:     set GOOGLE_OAUTH_ACCESS_TOKEN (or ACCESS_TOKEN) and pass --live.',
    ].join('\n')
  );
  process.exit(message ? 1 : 0);
};

if (flag('--help') || flag('-h')) usage();

const project = option('--project');
if (!project || project.startsWith('--')) usage('--project is required');

const apply = flag('--apply');
const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;
const token = process.env.GOOGLE_OAUTH_ACCESS_TOKEN || process.env.ACCESS_TOKEN;

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
const stringValue = value => ({ stringValue: value });
/** The string entries of a stored array field. */
const stringsOf = value =>
  (value?.arrayValue?.values ?? []).map(stringOf).filter(Boolean);
/** The map entries of a stored array field, as raw Firestore values. */
const mapValuesOf = value =>
  (value?.arrayValue?.values ?? []).filter(entry => entry.mapValue);
const unique = values => [...new Set(values)];
const sameSet = (a, b) =>
  a.length === b.length && a.every(value => b.includes(value));

/** When a member joined, in ms; entries without a date sort last. */
const joinedAtOf = member => {
  const joinedAt = member.mapValue.fields?.joinedAt;
  const time = joinedAt?.timestampValue
    ? Date.parse(joinedAt.timestampValue)
    : NaN;
  return Number.isNaN(time) ? Infinity : time;
};

const generateCode = taken => {
  for (;;) {
    let code = '';
    for (let i = 0; i < CODE_LENGTH; i++) {
      code += CODE_CHARS[randomInt(CODE_CHARS.length)];
    }
    if (!taken.has(code)) {
      taken.add(code);
      return code;
    }
  }
};

const documentName = (collectionId, id) =>
  `projects/${project}/databases/(default)/documents/${collectionId}/${id}`;

/**
 * Apply writes as one atomic commit: all of them happen or none do. (The
 * commit endpoint is also the one place a precondition is honoured by both
 * the emulator and the live API.)
 */
const commit = writes =>
  request(`${documentsUrl}:commit`, {
    method: 'POST',
    body: JSON.stringify({ writes }),
  });

/**
 * Set the given fields on a team, only if it hasn't changed since it was
 * read (so a team being edited right now is skipped, not clobbered).
 * A field whose value is undefined is deleted.
 */
const teamWrite = (document, values) => ({
  update: {
    name: document.name,
    fields: Object.fromEntries(
      Object.entries(values).filter(([, value]) => value !== undefined)
    ),
  },
  updateMask: { fieldPaths: Object.keys(values) },
  currentDocument: { updateTime: document.updateTime },
});

/** Create or replace teamInvites/{code}. */
const inviteWrite = (code, teamId, teamName) => ({
  update: {
    name: documentName('teamInvites', code),
    fields: {
      teamId: stringValue(teamId),
      teamName: stringValue(teamName),
    },
  },
});

/**
 * Retire teamInvites/{code}: mark it revoked and leave the rest as it is.
 * A code with no invite document gets one, naming `teamId`.
 */
const inviteRetire = (code, teamId) => ({
  update: {
    name: documentName('teamInvites', code),
    fields: {
      revoked: { booleanValue: true },
      ...(teamId
        ? { teamId: stringValue(teamId), teamName: stringValue('') }
        : {}),
    },
  },
  updateMask: {
    fieldPaths: teamId ? ['revoked', 'teamId', 'teamName'] : ['revoked'],
  },
});

/**
 * Who owns a team that has no usable `ownerId`, and why.
 * `members` are raw map values; `memberIds` the ids that will be stored.
 */
const deriveOwner = (members, memberIds, createdBy) => {
  const isMember = userId => Boolean(userId) && memberIds.includes(userId);
  const crowned = members
    .filter(member => stringOf(member.mapValue.fields?.role) === 'owner')
    .map(member => stringOf(member.mapValue.fields?.userId))
    .find(isMember);
  if (crowned) return { ownerId: crowned, reason: "member with role 'owner'" };
  if (isMember(createdBy)) {
    return { ownerId: createdBy, reason: 'creator, still a member' };
  }
  const oldest = [...members]
    .filter(member => isMember(stringOf(member.mapValue.fields?.userId)))
    .sort((a, b) => joinedAtOf(a) - joinedAtOf(b))[0];
  if (oldest) {
    return {
      ownerId: stringOf(oldest.mapValue.fields.userId),
      reason: 'longest-standing member (no owner role, creator has left)',
    };
  }
  return { ownerId: undefined, reason: 'no members' };
};

/** members[] with role 'owner' on the owner's entry and 'member' elsewhere. */
const withRoles = (members, ownerId) =>
  members.map(member => {
    const fields = member.mapValue.fields ?? {};
    const role = stringOf(fields.userId) === ownerId ? 'owner' : 'member';
    return stringOf(fields.role) === role
      ? member
      : { mapValue: { fields: { ...fields, role: stringValue(role) } } };
  });

const main = async () => {
  console.log(
    `${apply ? 'APPLYING to' : 'Dry run against'} ${
      emulatorHost ? `the emulator at ${emulatorHost}` : 'the LIVE project'
    } "${project}"${apply ? '' : ' — nothing will be written (add --apply)'}\n`
  );

  const failures = [];
  /** Run a write when applying. Resolves to whether the change is in place. */
  const attempt = async (label, write) => {
    if (!apply) return true;
    try {
      await write();
      return true;
    } catch (error) {
      failures.push(`${label}: ${error.message}`);
      return false;
    }
  };

  // ── Read everything first ─────────────────────────────────────────────
  const teams = [];
  for await (const document of listDocuments('teams')) teams.push(document);
  /** code -> what the invite currently says */
  const invites = new Map();
  for await (const document of listDocuments('teamInvites')) {
    invites.set(idOf(document), {
      teamId: stringOf(document.fields?.teamId),
      teamName: stringOf(document.fields?.teamName),
      revoked: document.fields?.revoked?.booleanValue === true,
    });
  }

  /** Codes in use anywhere, so a generated one never collides. */
  const takenCodes = new Set(invites.keys());
  /** code -> ids of the teams whose inviteCode it is */
  const claims = new Map();
  for (const document of teams) {
    const code = stringOf(document.fields?.inviteCode);
    if (!code) continue;
    takenCodes.add(code);
    claims.set(code, [...(claims.get(code) ?? []), idOf(document)]);
  }

  const counts = {
    memberIds: 0,
    ownerId: 0,
    roles: 0,
    joinCode: 0,
    newCode: 0,
    inviteWritten: 0,
    inviteRetired: 0,
    unchanged: 0,
    skipped: 0,
  };
  /** Codes that end up belonging to a team, after this run. */
  const liveCodes = new Set();
  /** Contested codes: retired, so neither team's old link leads anywhere. */
  const contested = new Set();

  // ── Teams ─────────────────────────────────────────────────────────────
  for (const document of teams) {
    const teamId = idOf(document);
    const fields = document.fields ?? {};
    const name = stringOf(fields.name) ?? '';
    const label = `team ${teamId} (${JSON.stringify(name)})`;
    const members = mapValuesOf(fields.members);
    const memberUserIds = unique(
      members
        .map(member => stringOf(member.mapValue.fields?.userId))
        .filter(Boolean)
    );
    const patch = {};
    const notes = [];
    const currentCode = stringOf(fields.inviteCode);

    // 1. memberIds
    let memberIds = stringsOf(fields.memberIds);
    if (memberIds.length === 0) {
      if (memberUserIds.length === 0) {
        console.log(
          `${label}: has no members — left as is (delete it by hand if unwanted)`
        );
        counts.skipped++;
        if (currentCode) liveCodes.add(currentCode);
        continue;
      }
      memberIds = memberUserIds;
      patch.memberIds = { arrayValue: { values: memberIds.map(stringValue) } };
      notes.push(`memberIds -> [${memberIds.join(', ')}]`);
      counts.memberIds++;
    } else if (!sameSet(unique(memberIds), memberUserIds)) {
      console.log(
        `${label}: WARNING memberIds [${memberIds.join(', ')}] and members[] [${memberUserIds.join(', ')}] disagree — not changed, check by hand`
      );
    }

    // 2. ownerId (+ roles that mirror it)
    const currentOwner = stringOf(fields.ownerId);
    let ownerId = currentOwner;
    if (!currentOwner || !memberIds.includes(currentOwner)) {
      const derived = deriveOwner(
        members,
        memberIds,
        stringOf(fields.createdBy)
      );
      ownerId = derived.ownerId;
      if (ownerId) {
        patch.ownerId = stringValue(ownerId);
        notes.push(
          `ownerId ${currentOwner ? `${currentOwner} (not a member)` : '(none)'} -> ${ownerId} [${derived.reason}]`
        );
        counts.ownerId++;
      } else {
        console.log(
          `${label}: WARNING no owner could be determined (${derived.reason})`
        );
      }
    }
    if (ownerId) {
      const roles = withRoles(members, ownerId);
      if (roles.some((member, index) => member !== members[index])) {
        patch.members = { arrayValue: { values: roles } };
        notes.push(`members[].role -> 'owner' for ${ownerId} only`);
        counts.roles++;
      }
    }

    // 3. invite code
    let code = currentCode;
    const contestedCode = code && (claims.get(code) ?? []).length > 1;
    const retiredCode = code && invites.get(code)?.revoked;
    if (!code || contestedCode || retiredCode) {
      if (retiredCode) {
        // A retired code is never live again, for any team.
        notes.push(`inviteCode ${code} has been retired -> new code`);
      } else if (contestedCode) {
        contested.add(code);
        notes.push(
          `inviteCode ${code} is also claimed by ${claims
            .get(code)
            .filter(id => id !== teamId)
            .join(', ')} -> new code (share the new link)`
        );
      } else {
        notes.push('inviteCode missing -> new code');
      }
      code = generateCode(takenCodes);
      patch.inviteCode = stringValue(code);
      counts.newCode++;
    }

    // 4. stale join proof
    if ('joinCode' in fields) {
      patch.joinCode = undefined;
      notes.push('joinCode removed');
      counts.joinCode++;
    }

    // The team and its invite are written together: a team never ends up
    // with a code that doesn't resolve.
    const writes = [];
    if (Object.keys(patch).length > 0) {
      console.log(`${label}:\n  ${notes.join('\n  ')}`);
      writes.push(teamWrite(document, patch));
    }
    const invite = invites.get(code);
    if (invite?.teamId !== teamId || invite.teamName !== name) {
      console.log(`${label}: teamInvites/${code} -> this team`);
      counts.inviteWritten++;
      writes.push(inviteWrite(code, teamId, name));
    }

    if (writes.length === 0) {
      counts.unchanged++;
      liveCodes.add(code);
    } else if (await attempt(label, () => commit(writes))) {
      liveCodes.add(code);
    } else if (currentCode) {
      // A team that could not be updated keeps whatever invite it has.
      liveCodes.add(currentCode);
    }
  }

  // ── Codes nothing uses ────────────────────────────────────────────────
  // Retired, not deleted, so nobody else can claim them.
  for (const [code, invite] of invites) {
    if (liveCodes.has(code) || invite.revoked) continue;
    console.log(
      `invite ${code} (-> team ${invite.teamId ?? '?'}): ${
        contested.has(code)
          ? 'claimed by more than one team'
          : "not any team's current code"
      } -> retire`
    );
    counts.inviteRetired++;
    await attempt(`invite ${code}`, () => commit([inviteRetire(code)]));
  }
  // A contested code that never had an invite document gets a retired one.
  for (const code of contested) {
    if (liveCodes.has(code) || invites.has(code)) continue;
    console.log(
      `code ${code}: claimed by more than one team, no invite -> retire`
    );
    counts.inviteRetired++;
    await attempt(`code ${code}`, () =>
      commit([inviteRetire(code, claims.get(code)[0])])
    );
  }

  const verb = apply ? '' : 'would be ';
  console.log(
    [
      '',
      `Teams: ${teams.length} read, ${counts.unchanged} already up to date, ${counts.skipped} without members (left alone).`,
      `  memberIds ${verb}added to ${counts.memberIds}`,
      `  ownerId ${verb}set on ${counts.ownerId}`,
      `  member roles ${verb}corrected on ${counts.roles}`,
      `  new invite code ${verb}given to ${counts.newCode}`,
      `  stale joinCode ${verb}removed from ${counts.joinCode}`,
      `Invites: ${invites.size} read, ${counts.inviteWritten} ${verb}written, ${counts.inviteRetired} ${verb}retired.`,
    ].join('\n')
  );

  if (failures.length > 0) {
    console.error(
      `\n${failures.length} write(s) failed (a document that changed while the script ran is skipped — run it again):`
    );
    for (const failure of failures) console.error(`  ${failure}`);
    process.exit(1);
  }
};

main().catch(error => {
  console.error(error.message);
  process.exit(1);
});
