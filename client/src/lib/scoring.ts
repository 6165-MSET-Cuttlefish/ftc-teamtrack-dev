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
import { GAME_TIMING } from '@/constants';

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
  /**
   * This alliance's fouls. Each one is credited to the OPPONENT's score and
   * never taken off this alliance's own.
   */
  MINOR_PENALTY: 5,
  MAJOR_PENALTY: 20,
} as const;

/** Scoring inputs plus the match type that says which periods were run. */
export type ScoringInput = Partial<MatchScoringFields> & { matchType?: string };

/** Whether a match of this type runs an autonomous period. */
export const includesAuto = (matchType?: string): boolean =>
  matchType !== 'Teleop';

/** Whether a match of this type runs a teleop period. */
export const includesTeleop = (matchType?: string): boolean =>
  matchType !== 'Autonomous';

/**
 * The same fields with the flags of periods that were not run cleared: a
 * Teleop-only match has no LEAVE or end-of-AUTO PARK, and an Autonomous-only
 * match has no end-of-match PARK. Everything else is returned untouched.
 */
export const normalizeForMatchType = <T extends Partial<MatchScoringFields>>(
  fields: T,
  matchType?: string
): T => {
  const auto = includesAuto(matchType);
  const teleop = includesTeleop(matchType);
  if (auto && teleop) return fields;
  return {
    ...fields,
    ...(auto
      ? {}
      : {
          robot1Leave: false,
          robot2Leave: false,
          robot1ParkAuto: false,
          robot2ParkAuto: false,
        }),
    ...(teleop ? {} : { robot1ParkTeleop: false, robot2ParkTeleop: false }),
  };
};

/**
 * A stored count as a usable number. Anything that isn't a finite, positive
 * number counts as zero, so one bad field can't turn a score into NaN.
 */
const countOf = (value: unknown): number => {
  const n = typeof value === 'number' ? value : Number(value ?? 0);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/** Robots that left, and parks earned, in the periods this match ran. */
const robotCounts = (f: ScoringInput): { leaves: number; parks: number } => {
  const n = normalizeForMatchType(f, f.matchType);
  return {
    leaves: (n.robot1Leave ? 1 : 0) + (n.robot2Leave ? 1 : 0),
    parks:
      (n.robot1ParkAuto ? 1 : 0) +
      (n.robot1ParkTeleop ? 1 : 0) +
      (n.robot2ParkAuto ? 1 : 0) +
      (n.robot2ParkTeleop ? 1 : 0),
  };
};

/**
 * Compute every score component for a single match.
 *
 * `total` is the match score: everything this alliance earned. Fouls are not
 * part of it — `penalties` is the number of points this alliance's fouls
 * handed to the opponent, reported alongside the score and never subtracted
 * from it.
 *
 * Periods the match type did not run score nothing, whatever the stored
 * flags say: a Teleop match has no LEAVE or end-of-AUTO PARK, an Autonomous
 * match has no end-of-match PARK.
 */
export const calculateScore = (f: ScoringInput): ScoreBreakdown => {
  const tipping = countOf(f.tipping) * POINTS.HIVE_TIP;
  const garden = countOf(f.garden) * POINTS.GARDEN;
  const flower = countOf(f.flower) * POINTS.FLOWER_ELEMENT;
  const flowerBonus = countOf(f.flowerBonus) * POINTS.FLOWER_BONUS;
  const hive = countOf(f.ballsInHive) * POINTS.CELL_REMAINING;

  const { leaves, parks } = robotCounts(f);
  const leave = leaves * POINTS.LEAVE;
  const park = parks * POINTS.PARK;

  const penalties =
    countOf(f.minorPenalties) * POINTS.MINOR_PENALTY +
    countOf(f.majorPenalties) * POINTS.MAJOR_PENALTY;

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
    total: earned,
  };
};

/** Convenience wrapper when only the final number is needed. */
export const calculateTotal = (f: ScoringInput): number =>
  calculateScore(f).total;

/**
 * The score of a stored match, always recomputed from its fields.
 *
 * `finalScore` is only a cache and can be stale (matches saved while fouls
 * were still subtracted, or before the match type decided which periods
 * count), so every screen reads the score through here instead.
 * `fallbackMatchType` is the session's type, for matches saved without one.
 */
export const matchScore = (
  m: ScoringInput,
  fallbackMatchType?: string
): number =>
  calculateScore(
    m.matchType || !fallbackMatchType
      ? m
      : { ...m, matchType: fallbackMatchType }
  ).total;

/** One line of a score breakdown. */
export interface ScoreRow {
  key: keyof ScoreBreakdown;
  label: string;
  count: number;
  points: number;
  /**
   * Shown for information only and not part of the match total — the points
   * this alliance's fouls gave the opponent.
   */
  informational?: boolean;
}

/**
 * Labelled rows for breakdown tables and charts, in field order. Every row
 * adds up to the total except the last, informational one.
 */
export const scoreRows = (f: ScoringInput): ScoreRow[] => {
  const b = calculateScore(f);
  const { leaves, parks } = robotCounts(f);
  return [
    {
      key: 'tipping',
      label: 'Tips',
      count: countOf(f.tipping),
      points: b.tipping,
    },
    {
      key: 'garden',
      label: 'Garden',
      count: countOf(f.garden),
      points: b.garden,
    },
    {
      key: 'flower',
      label: 'Flower',
      count: countOf(f.flower),
      points: b.flower,
    },
    {
      key: 'flowerBonus',
      label: 'Bonus',
      count: countOf(f.flowerBonus),
      points: b.flowerBonus,
    },
    {
      key: 'hive',
      label: 'Hive',
      count: countOf(f.ballsInHive),
      points: b.hive,
    },
    { key: 'leave', label: 'Leave', count: leaves, points: b.leave },
    { key: 'park', label: 'Park', count: parks, points: b.park },
    {
      key: 'penalties',
      label: 'Given to opponent',
      count: countOf(f.minorPenalties) + countOf(f.majorPenalties),
      points: b.penalties,
      informational: true,
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

/** Ranking points one match earns from its own scoring. */
export interface RankingPoints {
  /** SWARM RP — LEAVE + PARK points reached the threshold */
  swarm: boolean;
  /** POLLINATOR RPs — one per HIVE TIP threshold reached */
  pollinator: 0 | 1 | 2;
  total: number;
}

/**
 * Ranking points earned by a match. LEAVE and PARK are counted the same way
 * `calculateScore` counts them, so a period that was not run can't earn
 * SWARM.
 */
export const rankingPoints = (f: ScoringInput): RankingPoints => {
  const b = calculateScore(f);
  const swarm = b.leave + b.park >= RANKING_POINTS.SWARM_ROBOT_POINTS;
  const tips = countOf(f.tipping);
  const pollinator = RANKING_POINTS.POLLINATOR_TIPS.filter(
    threshold => tips >= threshold
  ).length as 0 | 1 | 2;
  return { swarm, pollinator, total: (swarm ? 1 : 0) + pollinator };
};

/** Names of the ranking points a match earned, in the order they are listed. */
export const rankingPointNames = (rp: RankingPoints): string[] => [
  ...(rp.swarm ? ['SWARM'] : []),
  ...RANKING_POINTS.POLLINATOR_TIPS.slice(0, rp.pollinator).map(
    (_, i) => `POLLINATOR ${i + 1}`
  ),
];

/** Ranking points a set of matches earned between them. */
export interface RankingPointTally {
  /** Matches that earned each one */
  swarm: number;
  pollinator1: number;
  pollinator2: number;
  earned: number;
  /** Three per match */
  possible: number;
  /** Percentage of the possible ranking points earned; null with no matches */
  rate: number | null;
}

/**
 * Ranking points across matches. `fallbackMatchType` is the session's type,
 * for matches saved without one.
 */
export const rankingPointTally = (
  matches: ReadonlyArray<ScoringInput>,
  fallbackMatchType?: string
): RankingPointTally => {
  const rps = matches.map(m =>
    rankingPoints(
      m.matchType || !fallbackMatchType
        ? m
        : { ...m, matchType: fallbackMatchType }
    )
  );
  const earned = rps.reduce((sum, rp) => sum + rp.total, 0);
  const possible = matches.length * (1 + RANKING_POINTS.POLLINATOR_TIPS.length);
  return {
    swarm: rps.filter(rp => rp.swarm).length,
    pollinator1: rps.filter(rp => rp.pollinator >= 1).length,
    pollinator2: rps.filter(rp => rp.pollinator >= 2).length,
    earned,
    possible,
    rate: possible > 0 ? Math.round((earned / possible) * 100) : null,
  };
};

/**
 * The most each counter can sensibly hold. 56 is every scoring element on
 * the field: 40 POLLEN plus 8 NECTAR per alliance.
 */
export const FIELD_LIMITS = {
  tipping: 30,
  garden: 56,
  flower: 56,
  flowerBonus: 4,
  ballsInHive: 56,
  minorPenalties: 30,
  majorPenalties: 30,
} as const;

/** What each counter counts, as shown beside its input. */
export const FIELD_HINTS = {
  tipping: `Each HIVE TIP, in AUTO or TELEOP (${POINTS.HIVE_TIP} pts)`,
  garden: `Everything in your GARDEN at match end, including the 4 pre-staged POLLEN (${POINTS.GARDEN} pt each)`,
  flower: `All POLLEN/NECTAR in FLOWERS with your NECTAR on top, including opponent and pre-staged pieces (${POINTS.FLOWER_ELEMENT} pts each)`,
  flowerBonus: `FLOWERS with your NECTAR at the bottom, max ${FIELD_LIMITS.flowerBonus} (${POINTS.FLOWER_BONUS} pts each)`,
  ballsInHive: `Upward-facing CELL only. The 3 staged NECTAR count until a TIP flips it (${POINTS.CELL_REMAINING} pts each)`,
  minorPenalties: `+${POINTS.MINOR_PENALTY} to the opponent each. Your score is not reduced`,
  majorPenalties: `+${POINTS.MAJOR_PENALTY} to the opponent each. Your score is not reduced`,
} as const;

/** Label for a session whose matches were not all run as the same type. */
export const MIXED_MATCH_TYPE = 'Mixed';

/**
 * The match type of a whole session: the type its matches share, or 'Mixed'
 * when they differ. `fallback` (the type stored on the session) stands in
 * for matches saved without one, and for a session with no matches.
 */
export const sessionMatchType = (
  matches: ReadonlyArray<{ matchType?: string }> | undefined,
  fallback?: string
): string => {
  const types = new Set(
    (matches ?? []).map(m => m.matchType || fallback || 'Full Game')
  );
  if (types.size === 0) return fallback || 'Full Game';
  return types.size === 1 ? [...types][0] : MIXED_MATCH_TYPE;
};

/**
 * The match type the fields on the live page are scored as. A saved match
 * open for editing keeps the type it was run as, whatever type the session
 * has selected now; otherwise it is the selected type.
 */
export const liveMatchType = <T extends string | undefined>(
  session: {
    matchType: T;
    matches?: ReadonlyArray<{ id: string; matchType?: string }>;
  },
  editingMatchId: string | null
): string | T => {
  const edited = editingMatchId
    ? session.matches?.find(m => m.id === editingMatchId)
    : undefined;
  return edited?.matchType ?? session.matchType;
};

/**
 * Leave and park conversion across matches, as whole percentages.
 *
 * Only periods that were actually run count as opportunities: a teleop-only
 * match has no LEAVE or AUTO PARK to miss, and an auto-only match has no
 * end-of-match PARK. A rate is `null` when there were no opportunities.
 */
export const robotRates = (
  matches: ScoringInput[],
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
  return {
    leaveRate: pct(leaves, leaveSlots),
    parkRate: pct(parks, parkSlots),
  };
};

/** A gap longer than a whole match's playing time is not a cycle. */
const MAX_CYCLE_SECONDS =
  GAME_TIMING.AUTONOMOUS_DURATION_SECONDS + GAME_TIMING.TELEOP_DURATION_SECONDS;

/**
 * Cycle times recorded in a match: the time between Hive Tips, in seconds.
 *
 * Only tip-to-tip gaps count. Sessions recorded while Garden was also tapped
 * live have Garden events in their log, each timed from whatever action came
 * before it; those are never cycles themselves, and their time is added back
 * into the gap between the tips either side. A tip with no earlier tip in
 * the same match has nothing to be measured from. Gaps that are not positive
 * or are longer than a match are dropped.
 */
export const cycleTimesOf = (f: Partial<MatchScoringFields>): number[] => {
  const times: number[] = [];
  /** Seconds logged since the last tip; null until the first one */
  let sinceTip: number | null = null;

  for (const event of f.phaseLog ?? []) {
    if (!event || typeof event !== 'object') continue;
    const gap = Number.isFinite(event.cycleTime) ? event.cycleTime : undefined;
    if (event.field !== 'tipping') {
      if (sinceTip !== null && gap !== undefined) sinceTip += gap;
      continue;
    }
    if (sinceTip !== null && gap !== undefined) {
      const cycle = Math.round((sinceTip + gap) * 100) / 100;
      if (cycle > 0 && cycle <= MAX_CYCLE_SECONDS) times.push(cycle);
    }
    sinceTip = 0;
  }

  return times;
};
