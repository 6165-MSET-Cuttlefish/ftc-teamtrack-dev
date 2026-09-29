/**
 * BIOBUZZ scoring — single source of truth.
 *
 * Every screen (Active, Analysis, Charts, Compare, EditSession, MatchForm)
 * derives scores from `calculateScore` here. Changing a rule means editing
 * this file and nothing else.
 *
 * Point values are transcribed from the official 2026-2027 BIOBUZZ
 * Competition Manual V1, Table 10-2 (Section 10.5.5 Point Values) and
 * Table 10-4 (Section 10.6 Violations).
 */

import type { MatchScoringFields, ScoreBreakdown } from '@/types';
import { CURRENT_SEASON } from '@/constants';

export const POINTS = {
  /** HIVE TIP — scored live, worth the same in auton or teleop */
  HIVE_TIP: 20,
  /** GARDEN — POLLEN and/or NECTAR in the GARDEN, assessed at end of match */
  GARDEN: 1,
  /** FLOWER — POLLEN and/or NECTAR in a FLOWER your alliance owns */
  FLOWER_ELEMENT: 2,
  /** FLOWER — Bottom NECTAR Bonus, up to once per FLOWER (4 FLOWERs on the field) */
  FLOWER_BONUS: 5,
  /** HIVE — POLLEN and/or NECTAR remaining in an upward-facing CELL at match end */
  CELL_REMAINING: 2,
  /** LEAVE, per robot (autonomous) */
  LEAVE: 3,
  /** PARK, per robot — awarded once for parking during AUTO and once for TELEOP */
  PARK: 5,
  /** Penalties are credited to the opponent's score */
  MINOR_PENALTY: 5,
  MAJOR_PENALTY: 20,
} as const;

/**
 * Compute every score component for a single match.
 *
 * `total` is the number shown as the match score; it is clamped at zero so a
 * penalty-heavy match never reports a negative result.
 */
export const calculateScore = (f: Partial<MatchScoringFields>): ScoreBreakdown => {
  const tipping = (f.tipping ?? 0) * POINTS.HIVE_TIP;
  const garden = (f.garden ?? 0) * POINTS.GARDEN;
  const flower = (f.flower ?? 0) * POINTS.FLOWER_ELEMENT;
  const flowerBonus = (f.flowerBonus ?? 0) * POINTS.FLOWER_BONUS;
  const hive = (f.ballsInHive ?? 0) * POINTS.CELL_REMAINING;

  const leave =
    ((f.robot1Leave ? 1 : 0) + (f.robot2Leave ? 1 : 0)) * POINTS.LEAVE;
  const parkCount =
    (f.robot1ParkAuto ? 1 : 0) +
    (f.robot1ParkTeleop ? 1 : 0) +
    (f.robot2ParkAuto ? 1 : 0) +
    (f.robot2ParkTeleop ? 1 : 0);
  const park = parkCount * POINTS.PARK;

  const penalties =
    (f.minorPenalties ?? 0) * POINTS.MINOR_PENALTY +
    (f.majorPenalties ?? 0) * POINTS.MAJOR_PENALTY;

  const earned = tipping + garden + flower + flowerBonus + hive + leave + park;

  return {
    tipping,
    garden,
    flower,
    flowerBonus,
    hive,
    leave,
    park,
    penalties,
    earned,
    total: Math.max(0, earned - penalties),
  };
};

/** Convenience wrapper when only the final number is needed. */
export const calculateTotal = (f: Partial<MatchScoringFields>): number =>
  calculateScore(f).total;

/** Labelled rows for breakdown tables and charts, in field order. */
export const scoreRows = (
  f: Partial<MatchScoringFields>
): Array<{ key: keyof ScoreBreakdown; label: string; count: number; points: number }> => {
  const b = calculateScore(f);
  return [
    { key: 'tipping', label: 'Hive Tips', count: f.tipping ?? 0, points: b.tipping },
    { key: 'garden', label: 'Garden', count: f.garden ?? 0, points: b.garden },
    { key: 'flower', label: 'Flower', count: f.flower ?? 0, points: b.flower },
    {
      key: 'flowerBonus',
      label: 'Flower Bonus',
      count: f.flowerBonus ?? 0,
      points: b.flowerBonus,
    },
    { key: 'hive', label: 'Left in Hive', count: f.ballsInHive ?? 0, points: b.hive },
    {
      key: 'leave',
      label: 'Leave',
      count: (f.robot1Leave ? 1 : 0) + (f.robot2Leave ? 1 : 0),
      points: b.leave,
    },
    {
      key: 'park',
      label: 'Park',
      count:
        (f.robot1ParkAuto ? 1 : 0) +
        (f.robot1ParkTeleop ? 1 : 0) +
        (f.robot2ParkAuto ? 1 : 0) +
        (f.robot2ParkTeleop ? 1 : 0),
      points: b.park,
    },
    {
      key: 'penalties',
      label: 'Penalties',
      count: (f.minorPenalties ?? 0) + (f.majorPenalties ?? 0),
      points: -b.penalties,
    },
  ];
};

/** A match with nothing scored yet. */
export const emptyScoringFields = (): MatchScoringFields => ({
  tipping: 0,
  garden: 0,
  flower: 0,
  flowerBonus: 0,
  ballsInHive: 0,
  robot1Leave: false,
  robot2Leave: false,
  robot1ParkAuto: false,
  robot1ParkTeleop: false,
  robot2ParkAuto: false,
  robot2ParkTeleop: false,
  minorPenalties: 0,
  majorPenalties: 0,
  phaseLog: [],
});

/** Extract just the scoring fields from any object that carries them. */
export const pickScoringFields = (
  source: Partial<MatchScoringFields>
): MatchScoringFields => {
  const empty = emptyScoringFields();
  return {
    tipping: source.tipping ?? empty.tipping,
    garden: source.garden ?? empty.garden,
    flower: source.flower ?? empty.flower,
    flowerBonus: source.flowerBonus ?? empty.flowerBonus,
    ballsInHive: source.ballsInHive ?? empty.ballsInHive,
    robot1Leave: source.robot1Leave ?? empty.robot1Leave,
    robot2Leave: source.robot2Leave ?? empty.robot2Leave,
    robot1ParkAuto: source.robot1ParkAuto ?? empty.robot1ParkAuto,
    robot1ParkTeleop: source.robot1ParkTeleop ?? empty.robot1ParkTeleop,
    robot2ParkAuto: source.robot2ParkAuto ?? empty.robot2ParkAuto,
    robot2ParkTeleop: source.robot2ParkTeleop ?? empty.robot2ParkTeleop,
    minorPenalties: source.minorPenalties ?? empty.minorPenalties,
    majorPenalties: source.majorPenalties ?? empty.majorPenalties,
    phaseLog: source.phaseLog ? [...source.phaseLog] : [],
  };
};

/**
 * BIOBUZZ ranking point thresholds, per match.
 *
 * SWARM is earned on LEAVE + PARK points; POLLINATOR is earned once at each
 * HIVE TIP threshold.
 */
export const RANKING_POINTS = {
  SWARM_ROBOT_POINTS: 16,
  POLLINATOR_TIPS: [4, 7],
} as const;

/** Whether a match of this type runs an autonomous period. */
export const includesAuto = (matchType?: string): boolean =>
  matchType !== 'Teleop';

/** Whether a match of this type runs a teleop period. */
export const includesTeleop = (matchType?: string): boolean =>
  matchType !== 'Autonomous';

/**
 * Leave and park conversion across matches, as whole percentages.
 *
 * Only periods that were actually run count as opportunities: a teleop-only
 * match has no LEAVE or AUTO PARK to miss, and an auto-only match has no
 * end-of-match PARK. A rate is `null` when there were no opportunities.
 */
export const robotRates = (
  matches: Array<Partial<MatchScoringFields> & { matchType?: string }>,
  fallbackMatchType?: string
): { leaveRate: number | null; parkRate: number | null } => {
  let leaveSlots = 0;
  let leaves = 0;
  let parkSlots = 0;
  let parks = 0;

  for (const m of matches) {
    const type = m.matchType ?? fallbackMatchType;
    if (includesAuto(type)) {
      leaveSlots += 2;
      leaves += (m.robot1Leave ? 1 : 0) + (m.robot2Leave ? 1 : 0);
      parkSlots += 2;
      parks += (m.robot1ParkAuto ? 1 : 0) + (m.robot2ParkAuto ? 1 : 0);
    }
    if (includesTeleop(type)) {
      parkSlots += 2;
      parks += (m.robot1ParkTeleop ? 1 : 0) + (m.robot2ParkTeleop ? 1 : 0);
    }
  }

  const pct = (n: number, d: number) =>
    d > 0 ? Math.round((n / d) * 100) : null;
  return { leaveRate: pct(leaves, leaveSlots), parkRate: pct(parks, parkSlots) };
};

/**
 * Whether a stored session belongs to the current season.
 *
 * Sessions saved before the season tag existed are classified by shape:
 * DECODE matches carry none of the BIOBUZZ scoring fields.
 */
export const isCurrentSeasonSession = (session: {
  season?: string;
  matches?: ReadonlyArray<object>;
}): boolean => {
  if (session.season) return session.season === CURRENT_SEASON;
  const matches = session.matches ?? [];
  if (matches.length === 0) return true;
  return matches.some(m => 'garden' in m || 'tipping' in m);
};

/** Cycle times (seconds between live scoring actions) recorded in a match. */
export const cycleTimesOf = (f: Partial<MatchScoringFields>): number[] =>
  (f.phaseLog ?? [])
    .map(e => e.cycleTime)
    .filter((t): t is number => t !== undefined);
