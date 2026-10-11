#!/usr/bin/env node
/**
 * Tests for the robot count and the cycle times in
 * client/src/lib/scoring.ts: leave and park rates out of the robots a match
 * was played with, SWARM only where it can be earned, and a tip taken back
 * with -1 leaving no cycle behind.
 *
 * The repo has no test runner, so this uses Node's own (`node:test`) and
 * loads the TypeScript source through the Vite that is already installed.
 * It touches no data and needs no network.
 *
 *   node scripts/test-robots-and-cycles.mjs
 */

import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

let vite;
/** @type {typeof import('../client/src/lib/scoring')} */
let scoring;

before(async () => {
  vite = await createServer({
    configFile: resolve(root, 'vite.config.ts'),
    root: resolve(root, 'client'),
    logLevel: 'error',
    server: { middlewareMode: true, hmr: false, watch: null },
    optimizeDeps: { noDiscovery: true },
  });
  scoring = await vite.ssrLoadModule('/src/lib/scoring.ts');
});

after(() => vite?.close());

/** Robot 1 left, parked in AUTO and at the end; Robot 2 did nothing */
const solo = (extra = {}) => ({
  matchType: 'Full Game',
  robot1Leave: true,
  robot1ParkAuto: true,
  robot1ParkTeleop: true,
  ...extra,
});

/** A tip event, timed `cycleTime` seconds after the one before (if given) */
const tip = (value, cycleTime) => ({
  field: 'tipping',
  value,
  phase: 'teleop',
  timeRemaining: 60,
  ...(cycleTime !== undefined ? { cycleTime } : {}),
});

test('a match saved before the robot count had two robots', () => {
  assert.equal(scoring.robotCountOf({}), 2);
  assert.equal(scoring.robotCountOf({ robotCount: 1 }), 1);
  assert.equal(scoring.robotCountOf({ robotCount: 2 }), 2);
  // Anything else stored there reads as the old two
  assert.equal(scoring.robotCountOf({ robotCount: '1' }), 2);
});

test('Robot 2 marked keeps its row and chances, whatever the count says', () => {
  assert.equal(scoring.robotsOf({ robotCount: 1 }), 1);
  assert.equal(scoring.robotsOf({ robotCount: 1, robot2ParkAuto: true }), 2);
});

test('one robot that always left and parked has 100% rates', () => {
  const matches = [1, 2, 3].map(() => solo({ robotCount: 1 }));
  assert.deepEqual(scoring.robotRates(matches), {
    leaveRate: 100,
    parkRate: 100,
  });
  assert.deepEqual(scoring.robotTallies(matches), {
    leaves: { made: 3, chances: 3 },
    parks: { made: 6, chances: 6 },
  });
});

test('old matches still count two robots', () => {
  assert.deepEqual(scoring.robotRates([solo()]), {
    leaveRate: 50,
    parkRate: 50,
  });
});

test('SWARM is only counted where it can be earned', () => {
  const tally = scoring.rankingPointTally([
    solo({ robotCount: 1, tipping: 4 }),
    solo({ robotCount: 2, robot2Leave: true, robot2ParkAuto: true }),
    solo({ matchType: 'Teleop', robotCount: 2 }),
  ]);
  // One robot: 13 leave + park points at most; Teleop: 10 at most
  assert.equal(tally.swarmChances, 1);
  assert.equal(tally.swarm, 1);
  assert.equal(tally.possible, 1 + 3 * 2);
  assert.equal(tally.earned, 2);
  assert.equal(scoring.swarmReachable(solo({ robotCount: 1 })), false);
});

test('cycle times: three tips are two cycles', () => {
  assert.deepEqual(
    scoring.cycleTimesOf({ phaseLog: [tip(1), tip(2, 10), tip(3, 12)] }),
    [10, 12]
  );
});

test('a double tap fixed with -1 leaves no cycle behind', () => {
  // +1, +1, +1 by mistake 0.2 s later, -1, then the real third tip
  const phaseLog = [tip(1), tip(2, 10.65), tip(3, 0.2), tip(2), tip(3, 10.9)];
  assert.deepEqual(scoring.cycleTimesOf({ phaseLog }), [10.65, 11.1]);
});

test('a wrong tip taken back joins the two gaps around it', () => {
  // A tip at 10 s, a mistaken one at 20 s, -1, the next tip at 35 s
  const phaseLog = [tip(1), tip(2, 10), tip(3, 10), tip(2), tip(3, 15)];
  assert.deepEqual(scoring.cycleTimesOf({ phaseLog }), [10, 25]);
});

test('taking back two tips runs both gaps on into the next', () => {
  const phaseLog = [
    tip(1),
    tip(2, 10),
    tip(3, 0.2),
    tip(4, 0.3),
    tip(3),
    tip(2),
    tip(3, 10),
  ];
  assert.deepEqual(scoring.cycleTimesOf({ phaseLog }), [10, 10.5]);
});

test('taking back the only tip leaves nothing to time from', () => {
  const phaseLog = [tip(1), tip(0), tip(1, 5), tip(2, 8)];
  assert.deepEqual(scoring.cycleTimesOf({ phaseLog }), [8]);
});
