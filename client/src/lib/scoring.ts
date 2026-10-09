/**
 * BIOBUZZ scoring — single source of truth.
 *
 * Every screen (Active, Analysis, Charts, Compare, MatchForm)
 * derives scores from `calculateScore` here. Changing a rule means editing
 * this file and nothing else.
 *
 * Point values are transcribed from the official 2026-2027 BIOBUZZ
 * Competition Manual V1, Table 10-2 (Section 10.5.5 Point Values) and
 * Table 10-4 (Section 10.6 Violations).
 */

import type { MatchScoringFields, RobotCount, ScoreBreakdown } from '@/types';
import { GAME_TIMING } from '@/constants';
import { ELEMENT_LABELS } from './scoringLabels';

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

/** Robots a new session starts with: most practice is one team alone */
export const DEFAULT_ROBOT_COUNT: RobotCount = 1;

/**
 * Robots on the field for a match or a session's fields. Saved before the
 * setting existed, it had two robot rows, so it counts as 2 (as does
 * anything stored there that isn't a 1).
 */
export const robotCountOf = (fields: {
  robotCount?: RobotCount;
}): RobotCount => (fields.robotCount === 1 ? 1 : 2);

/**
 * The robots a match's fields are shown and counted with: its robot count,
 * or both whenever Robot 2 has something marked anyway (the count was
 * changed with Robot 2 already scored), so nothing scored is ever hidden,
 * or counted out of fewer chances than were used.
 */
export const robotsOf = (
  fields: Partial<MatchScoringFields> & { robotCount?: RobotCount }
): RobotCount =>
  robotCountOf(fields) === 2 ||
  fields.robot2Leave ||
  fields.robot2ParkAuto ||
  fields.robot2ParkTeleop
    ? 2
    : 1;

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
 * The scoring elements in the order the scoring page asks for them: Hive
 * Tips, the robots (Leave, Park), then the end of match (Flower, Flower
 * Bonus, Left in Hive, Garden). Every list of elements follows it — the
 * breakdowns (`scoreRows`), chart series and pills, CSV columns — so they
 * all read the way the match was scored.
 */
export const ELEMENT_ORDER = [
  'tipping',
  'leave',
  'park',
  'flower',
  'flowerBonus',
  'hive',
  'garden',
] as const satisfies ReadonlyArray<keyof ScoreBreakdown>;

/**
 * `ELEMENT_ORDER` where Leave and Park are one element, "Leave + Park"
 * (`ELEMENT_LABELS.robots`): the charts and Compare draw them together.
 */
export const GROUPED_ELEMENT_ORDER = [
  'tipping',
  'robots',
  'flower',
  'flowerBonus',
  'hive',
  'garden',
] as const;

/**
 * Labelled rows for breakdown tables and charts, in `ELEMENT_ORDER`. Every
 * row adds up to the total except the last, informational one.
 */
export const scoreRows = (f: ScoringInput): ScoreRow[] => {
  const b = calculateScore(f);
  const { leaves, parks } = robotCounts(f);
  const counts: Record<(typeof ELEMENT_ORDER)[number], number> = {
    tipping: countOf(f.tipping),
    leave: leaves,
    park: parks,
    flower: countOf(f.flower),
    flowerBonus: countOf(f.flowerBonus),
    hive: countOf(f.ballsInHive),
    garden: countOf(f.garden),
  };
  return [
    ...ELEMENT_ORDER.map(key => ({
      key,
      label: ELEMENT_LABELS[key],
      count: counts[key],
      points: b[key],
    })),
    {
      key: 'penalties',
      label: ELEMENT_LABELS.penalties,
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
 * Whether a match can earn SWARM at all. One robot tops out at 13 LEAVE +
 * PARK points (3 + 5 + 5), and a match with no AUTO at 10 (two end parks):
 * both are short of the 16 it takes.
 */
export const swarmReachable = (f: ScoringInput): boolean =>
  includesAuto(f.matchType) && robotsOf(f) === 2;

/**
 * What matches none of which could earn SWARM were missing, said in place
 * of its figure (Analysis, Charts and Compare word it alike): a second
 * robot, or with no AUTO run in any of them, an Auto period.
 * `fallbackMatchType` is the session's type, for matches saved without one.
 */
export const swarmMissing = (
  matches: ReadonlyArray<{ matchType?: string }>,
  fallbackMatchType?: string
): string =>
  matches.some(m => includesAuto(m.matchType ?? fallbackMatchType))
    ? 'needs 2 robots'
    : 'needs an Auto period';

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
  /** Matches that could earn SWARM (see `swarmReachable`) */
  swarmChances: number;
  earned: number;
  /**
   * The two POLLINATORs per match, and SWARM in each match that could earn
   * it
   */
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
  const typed = matches.map(m =>
    m.matchType || !fallbackMatchType
      ? m
      : { ...m, matchType: fallbackMatchType }
  );
  const rps = typed.map(rankingPoints);
  const earned = rps.reduce((sum, rp) => sum + rp.total, 0);
  const swarmChances = typed.filter(swarmReachable).length;
  const possible =
    swarmChances + matches.length * RANKING_POINTS.POLLINATOR_TIPS.length;
  return {
    swarm: rps.filter(rp => rp.swarm).length,
    pollinator1: rps.filter(rp => rp.pollinator >= 1).length,
    pollinator2: rps.filter(rp => rp.pollinator >= 2).length,
    swarmChances,
    earned,
    possible,
    rate: possible > 0 ? Math.round((earned / possible) * 100) : null,
  };
};

/**
 * The most each counter can sensibly hold. 56 is every scoring element on
 * the field: 40 POLLEN plus 8 NECTAR per alliance. Hive Tips have no real
 * cap; 999 only stops a mistyped number.
 */
export const FIELD_LIMITS = {
  tipping: 999,
  garden: 56,
  flower: 56,
  flowerBonus: 4,
  ballsInHive: 56,
  minorPenalties: 30,
  majorPenalties: 30,
} as const;

/**
 * The rule behind a counter's (i): what its short visible lines (the name,
 * COUNT_LABELS and EACH_LABELS) leave out, in full, as a note with no
 * closing period.
 */
export const FIELD_HINTS = {
  tipping: `Every Hive Tip counts, in Auto or Teleop: ${POINTS.HIVE_TIP} pts each`,
  flower:
    'Every piece in a flower with your nectar on top, opponent and pre-staged pieces too',
  flowerBonus: 'One per flower with your nectar in its bottom slot',
  garden: 'Every piece in your garden, including the 4 pollen that start there',
  ballsInHive:
    "Pieces in the hive's upward-facing cell, including the 3 starting nectar unless a Hive Tip turned that cell away",
  minorPenalties: `+${POINTS.MINOR_PENALTY} to the opponent each. They never lower your score`,
  majorPenalties: `+${POINTS.MAJOR_PENALTY} to the opponent each. They never lower your score`,
} as const;

/**
 * The rule behind the scoring page's FOULS (i), in the manual's words for
 * them: what each one gives the opponent, and that none comes off this
 * alliance's own score. A no-break space keeps each value with its name.
 */
export const FOULS_RULE = `Fouls go to the opponent (Minor\u00a0+${POINTS.MINOR_PENALTY}, Major\u00a0+${POINTS.MAJOR_PENALTY}). They never lower your score`;

/**
 * The name over each end-of-match counter on the scoring page and in the
 * Add/Edit Match dialog, with its full rule (FIELD_HINTS) behind an (i): its
 * ELEMENT_LABELS name, the one Analysis, Charts, Compare and the CSV use. The
 * two flower counters say "flower" in their own names, so they need no group
 * heading over them.
 */
export const COUNT_LABELS = {
  flower: ELEMENT_LABELS.flower,
  flowerBonus: ELEMENT_LABELS.flowerBonus,
  ballsInHive: ELEMENT_LABELS.hive,
  garden: ELEMENT_LABELS.garden,
} as const;

/** What one of each end-of-match counter is worth, beside its count */
export const EACH_LABELS = {
  flower: `${POINTS.FLOWER_ELEMENT} pts each`,
  // No break inside "max 4" when the line has to wrap
  flowerBonus: `${POINTS.FLOWER_BONUS} pts, max\u00a0${FIELD_LIMITS.flowerBonus}`,
  ballsInHive: `${POINTS.CELL_REMAINING} pts each`,
  garden: `${POINTS.GARDEN} pt each`,
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

/** How many of something were made, out of the chances there were */
export interface Tally {
  made: number;
  chances: number;
}

/**
 * Leaves and parks made across matches, out of the chances they gave.
 *
 * Only periods that were actually run count as chances: a teleop-only match
 * has no LEAVE or AUTO PARK to miss, and an auto-only match has no
 * end-of-match PARK. Each match gives one chance per robot it was played
 * with (`robotsOf`): one when a team practices alone, two for an alliance,
 * and two for a match saved before the robot count existed.
 */
export const robotTallies = (
  matches: ReadonlyArray<ScoringInput>,
  fallbackMatchType?: string
): { leaves: Tally; parks: Tally } => {
  const leaves: Tally = { made: 0, chances: 0 };
  const parks: Tally = { made: 0, chances: 0 };

  for (const m of matches) {
    const type = m.matchType ?? fallbackMatchType;
    const robots = robotsOf(m);
    const second = robots === 2;
    if (includesAuto(type)) {
      leaves.chances += robots;
      leaves.made +=
        (m.robot1Leave ? 1 : 0) + (second && m.robot2Leave ? 1 : 0);
      parks.chances += robots;
      parks.made +=
        (m.robot1ParkAuto ? 1 : 0) + (second && m.robot2ParkAuto ? 1 : 0);
    }
    if (includesTeleop(type)) {
      parks.chances += robots;
      parks.made +=
        (m.robot1ParkTeleop ? 1 : 0) + (second && m.robot2ParkTeleop ? 1 : 0);
    }
  }

  return { leaves, parks };
};

/**
 * Leave and park conversion across matches, as whole percentages of the
 * chances `robotTallies` counts. A rate is `null` when there were none.
 */
export const robotRates = (
  matches: ReadonlyArray<ScoringInput>,
  fallbackMatchType?: string
): { leaveRate: number | null; parkRate: number | null } => {
  const { leaves, parks } = robotTallies(matches, fallbackMatchType);
  const pct = ({ made, chances }: Tally) =>
    chances > 0 ? Math.round((made / chances) * 100) : null;
  return { leaveRate: pct(leaves), parkRate: pct(parks) };
};

/** A gap longer than a whole match's playing time is not a cycle. */
const MAX_CYCLE_SECONDS =
  GAME_TIMING.AUTONOMOUS_DURATION_SECONDS + GAME_TIMING.TELEOP_DURATION_SECONDS;

/** A tip read back from a match's log */
interface LoggedTip {
  /** Seconds since the tip it was timed from, or null if not timed */
  gap: number | null;
  /** Index of the tip it was timed from, or null if not timed */
  from: number | null;
  /** Whether that gap was kept as a cycle */
  cycle: boolean;
}

/**
 * A match's log read as the tips it counts and the cycles between them
 * (see `cycleTimesOf` for which gaps are cycles).
 */
const readTips = (
  f: Partial<MatchScoringFields>
): { times: number[]; tips: LoggedTip[] } => {
  const times: number[] = [];
  /** Seconds logged since the tip at `anchor`; null when there is none */
  let sinceTip: number | null = null;
  let anchor: number | null = null;
  /** The tips counted so far, last one last */
  const tips: LoggedTip[] = [];
  /** The count the last tip event left; a lower one takes tips back */
  let count: number | null = null;

  for (const event of f.phaseLog ?? []) {
    if (!event || typeof event !== 'object') continue;
    const gap = Number.isFinite(event.cycleTime) ? event.cycleTime : undefined;
    if (event.field !== 'tipping') {
      if (sinceTip !== null && gap !== undefined) sinceTip += gap;
      continue;
    }
    const value = Number.isFinite(event.value) ? event.value : null;
    if (count !== null && value !== null && value < count) {
      for (let n = count - value; n > 0; n--) {
        const undone = tips.pop();
        if (undone?.cycle) times.pop();
        if (undone && undone.gap !== null && sinceTip !== null) {
          sinceTip = undone.gap + sinceTip;
          anchor = undone.from;
        } else {
          sinceTip = null;
          anchor = null;
        }
      }
      count = value;
      continue;
    }
    // A typed count can add several at once, none of them timed
    for (let n = (count ?? 0) + 1; value !== null && n < value; n++) {
      tips.push({ gap: null, from: null, cycle: false });
    }
    count = value;
    const timed =
      sinceTip !== null && gap !== undefined ? sinceTip + gap : null;
    const cycle = timed === null ? null : Math.round(timed * 100) / 100;
    const kept = cycle !== null && cycle > 0 && cycle <= MAX_CYCLE_SECONDS;
    if (kept) times.push(cycle);
    tips.push({
      gap: timed,
      from: timed === null ? null : anchor,
      cycle: kept,
    });
    sinceTip = 0;
    anchor = tips.length - 1;
  }

  return { times, tips };
};

/**
 * Cycle times recorded in a match: the time between Hive Tips, in seconds.
 *
 * Only tip-to-tip gaps count. Sessions recorded while Garden was also tapped
 * live have Garden events in their log, each timed from whatever action came
 * before it; those are never cycles themselves, and their time is added back
 * into the gap between the tips either side. A tip with no earlier tip in
 * the same match has nothing to be measured from. Gaps that are not positive
 * or are longer than a match are dropped.
 *
 * A tip taken back (the count goes down, as −1 after a double tap does) was
 * never a tip: the cycle it ended is dropped, and the time it was timed
 * from the tip before runs on into the next tip's gap. Three tips with a
 * mis-tap fixed in between are two cycles, as long as the real ones.
 */
export const cycleTimesOf = (f: Partial<MatchScoringFields>): number[] =>
  readTips(f).times;

/**
 * How many tips a match's cycle times run between: every tip that ends a
 * cycle or starts one. That is not always one more than the cycles: the
 * clock stops between AUTO and TELEOP, so the first tip after the break is
 * not timed from the last one before it, and two runs of tips have one gap
 * fewer between them than tips. Never more than the match's Hive Tips,
 * which an edit can lower without touching the log.
 */
export const timedTipsOf = (f: Partial<MatchScoringFields>): number => {
  const timed = new Set<number>();
  readTips(f).tips.forEach((tip, index) => {
    if (!tip.cycle) return;
    timed.add(index);
    if (tip.from !== null) timed.add(tip.from);
  });
  return Math.min(timed.size, countOf(f.tipping));
};
