#!/usr/bin/env node
/**
 * Boundary tests for the ranking points in client/src/lib/scoring.ts.
 *
 * The repo has no test runner, so this uses Node's own (`node:test`) and
 * loads the TypeScript source through the Vite that is already installed.
 * It touches no data and needs no network.
 *
 *   node scripts/test-ranking-points.mjs
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

/** A match with `leaves` robots leaving and `parks` parks, auto parks first. */
const robots = (leaves, parks, extra = {}) => ({
  matchType: 'Full Game',
  robot1Leave: leaves >= 1,
  robot2Leave: leaves >= 2,
  robot1ParkAuto: parks >= 1,
  robot2ParkAuto: parks >= 2,
  robot1ParkTeleop: parks >= 3,
  robot2ParkTeleop: parks >= 4,
  ...extra,
});

test('thresholds are the BIOBUZZ ones', () => {
  assert.equal(scoring.RANKING_POINTS.SWARM_ROBOT_POINTS, 16);
  assert.deepEqual([...scoring.RANKING_POINTS.POLLINATOR_TIPS], [4, 7]);
});

test('SWARM needs 16 LEAVE + PARK points', () => {
  // 2 leaves (6) + 2 parks (10) = 16
  assert.equal(scoring.rankingPoints(robots(2, 2)).swarm, true);
  // 0 leaves + 3 parks = 15
  assert.equal(scoring.rankingPoints(robots(0, 3)).swarm, false);
  // 1 leave (3) + 2 parks (10) = 13
  assert.equal(scoring.rankingPoints(robots(1, 2)).swarm, false);
  // 2 leaves (6) + 4 parks (20) = 26
  assert.equal(scoring.rankingPoints(robots(2, 4)).swarm, true);
});

test('SWARM only counts the periods the match ran', () => {
  // Teleop only: the stored LEAVE and AUTO PARK flags score nothing (10).
  assert.equal(
    scoring.rankingPoints(robots(2, 4, { matchType: 'Teleop' })).swarm,
    false
  );
  // Autonomous only: 2 leaves + 2 auto parks = 16, end parks ignored.
  assert.equal(
    scoring.rankingPoints(robots(2, 4, { matchType: 'Autonomous' })).swarm,
    true
  );
});

test('POLLINATOR 1 at 4 tips, POLLINATOR 2 at 7', () => {
  const pollinator = tipping => scoring.rankingPoints({ tipping }).pollinator;
  assert.equal(pollinator(0), 0);
  assert.equal(pollinator(3), 0);
  assert.equal(pollinator(4), 1);
  assert.equal(pollinator(6), 1);
  assert.equal(pollinator(7), 2);
  assert.equal(pollinator(30), 2);
});

test('other points never earn a ranking point', () => {
  const rp = scoring.rankingPoints({
    garden: 56,
    flower: 56,
    flowerBonus: 4,
    ballsInHive: 56,
    majorPenalties: 30,
  });
  assert.deepEqual(rp, { swarm: false, pollinator: 0, total: 0 });
});

test('total and names add up', () => {
  const rp = scoring.rankingPoints(robots(2, 2, { tipping: 7 }));
  assert.equal(rp.total, 3);
  assert.deepEqual(scoring.rankingPointNames(rp), [
    'SWARM',
    'POLLINATOR 1',
    'POLLINATOR 2',
  ]);
  assert.deepEqual(
    scoring.rankingPointNames(scoring.rankingPoints({ tipping: 4 })),
    ['POLLINATOR 1']
  );
  assert.deepEqual(scoring.rankingPointNames(scoring.rankingPoints({})), []);
});

test('tally across matches', () => {
  const tally = scoring.rankingPointTally([
    robots(2, 2, { tipping: 7 }), // 3 RP
    robots(0, 3, { tipping: 4 }), // 1 RP
    robots(0, 0, { tipping: 3 }), // 0 RP
  ]);
  assert.deepEqual(tally, {
    swarm: 1,
    pollinator1: 2,
    pollinator2: 1,
    earned: 4,
    possible: 9,
    rate: 44,
  });
});

test('tally scores untyped matches as the session type', () => {
  const untyped = { ...robots(2, 4), matchType: undefined };
  assert.equal(scoring.rankingPointTally([untyped]).swarm, 1);
  assert.equal(scoring.rankingPointTally([untyped], 'Teleop').swarm, 0);
  // A match's own type wins over the session's.
  assert.equal(scoring.rankingPointTally([robots(2, 2)], 'Teleop').swarm, 1);
});

test('tally of no matches has no rate', () => {
  assert.deepEqual(scoring.rankingPointTally([]), {
    swarm: 0,
    pollinator1: 0,
    pollinator2: 0,
    earned: 0,
    possible: 0,
    rate: null,
  });
});
