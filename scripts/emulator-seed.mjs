#!/usr/bin/env node
/**
 * Seeds the LOCAL Firebase emulators (never a real project) with two test
 * accounts in one team, for trying live sessions with two browsers:
 *
 *   npx firebase-tools emulators:start --only auth,firestore --project demo-teamtrack
 *   node scripts/emulator-seed.mjs
 *   npx vite --mode emulator
 *
 * Sign in as the host in one browser and the teammate in another.
 * Running it again leaves existing accounts as they are.
 */

const PROJECT = 'demo-teamtrack';
const AUTH = 'http://127.0.0.1:9099';
const FIRESTORE = 'http://127.0.0.1:8085';

/** Test-only accounts that exist in the local emulator alone */
export const TEST_ACCOUNTS = [
  {
    email: 'host@teamtrack.test',
    password: 'emulator-only-1',
    name: 'Host Tester',
  },
  {
    email: 'mate@teamtrack.test',
    password: 'emulator-only-2',
    name: 'Mate Tester',
  },
];
const TEAM_ID = 'emulator-team';
const INVITE = 'EMUTEAM1';

const post = async (url, body, headers = {}) => {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  return { ok: res.ok, json: await res.json() };
};

const account = async ({ email, password, name }) => {
  const key = 'demo-key';
  let r = await post(
    `${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=${key}`,
    {
      email,
      password,
      displayName: name,
      returnSecureToken: true,
    }
  );
  if (!r.ok) {
    r = await post(
      `${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${key}`,
      { email, password, returnSecureToken: true }
    );
  }
  if (!r.ok) throw new Error(`Account ${email}: ${JSON.stringify(r.json)}`);
  return { uid: r.json.localId, email, name };
};

const str = v => ({ stringValue: v });
const time = () => ({ timestampValue: new Date().toISOString() });

/** Writes a document as the emulator's owner, past the rules */
const put = async (path, fields) => {
  const res = await fetch(
    `${FIRESTORE}/v1/projects/${PROJECT}/databases/(default)/documents/${path}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer owner',
      },
      body: JSON.stringify({ fields }),
    }
  );
  if (!res.ok) throw new Error(`${path}: ${await res.text()}`);
};

const [host, mate] = await Promise.all(TEST_ACCOUNTS.map(account));
const member = (u, role) => ({
  mapValue: {
    fields: {
      userId: str(u.uid),
      email: str(u.email),
      displayName: str(u.name),
      joinedAt: time(),
      role: str(role),
    },
  },
});
await put(`teams/${TEAM_ID}`, {
  name: str('Emulator Team'),
  createdBy: str(host.uid),
  ownerId: str(host.uid),
  createdAt: time(),
  inviteCode: str(INVITE),
  memberIds: { arrayValue: { values: [str(host.uid), str(mate.uid)] } },
  members: {
    arrayValue: { values: [member(host, 'owner'), member(mate, 'member')] },
  },
});
await put(`teamInvites/${INVITE}`, {
  teamId: str(TEAM_ID),
  teamName: str('Emulator Team'),
});
console.log(
  `Seeded "Emulator Team" with ${host.email} (owner) and ${mate.email}.`
);
