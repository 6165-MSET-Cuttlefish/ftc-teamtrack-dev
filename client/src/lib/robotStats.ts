/**
 * One robot's own part of its matches: what can be put down to that robot
 * alone. Its LEAVE, its two PARKs and its shots are its own; Hive Tips,
 * flowers, the hive, the garden and fouls are the alliance's, and are never
 * split between the robots here.
 */

import type { Match } from '@/types';
import { POINTS, includesAuto, includesTeleop, robotsOf, shotsOf } from './scoring';

export type RobotNumber = 1 | 2;

/** Which matches a robot's figures are read from */
export type RobotScope =
  /** Robot 1 in every match, alone or with an alliance */
  | 'robot'
  /** Robot 1 in the matches it played alone */
  | 'solo'
  /** Both robots, in the matches played as an alliance */
  | 'alliance';

/** A match played by one robot alone */
export const isSolo = (m: Match): boolean => robotsOf(m) === 1;

/** A match played by an alliance of two */
export const isAlliance = (m: Match): boolean => robotsOf(m) === 2;

/** The matches a scope reads, with where each one is in `matches` */
export const matchesInScope = (
  matches: Match[],
  scope: RobotScope
): { match: Match; index: number }[] =>
  matches.flatMap((match, index) =>
    scope === 'robot' ||
    (scope === 'solo' && isSolo(match)) ||
    (scope === 'alliance' && isAlliance(match))
      ? [{ match, index }]
      : []
  );

/** One robot in one match */
export interface RobotInMatch {
  /** Null where the match ran no AUTO */
  leave: boolean | null;
  parkAuto: boolean | null;
  /** Null where the match ran no TELEOP */
  parkEnd: boolean | null;
  /** Its LEAVE and PARK points */
  leaveParkPoints: number;
  /** Balls in (Pollen and Nectar) */
  made: number;
  /** Balls shot */
  shot: number;
  pollen: number;
  nectar: number;
  /** Made out of shot (0 to 1); null with no shots counted for it */
  accuracy: number | null;
}

export const robotInMatch = (m: Match, robot: RobotNumber): RobotInMatch => {
  const type = m.matchType || 'Full Game';
  const auto = includesAuto(type);
  const teleop = includesTeleop(type);
  const leave = auto
    ? robot === 1
      ? !!m.robot1Leave
      : !!m.robot2Leave
    : null;
  const parkAuto = auto
    ? robot === 1
      ? !!m.robot1ParkAuto
      : !!m.robot2ParkAuto
    : null;
  const parkEnd = teleop
    ? robot === 1
      ? !!m.robot1ParkTeleop
      : !!m.robot2ParkTeleop
    : null;
  const s = shotsOf(m, undefined, robot);
  const shot = s.made + s.missed;
  return {
    leave,
    parkAuto,
    parkEnd,
    leaveParkPoints:
      (leave ? POINTS.LEAVE : 0) +
      (parkAuto ? POINTS.PARK : 0) +
      (parkEnd ? POINTS.PARK : 0),
    made: s.made,
    shot,
    pollen: s.pollen,
    nectar: s.nectar,
    accuracy: shot > 0 ? s.made / shot : null,
  };
};

/** Done out of the chances to do it */
export interface Rate {
  done: number;
  chances: number;
}

/** A rate as a whole percent, or null with no chances */
export const percentOf = (r: Rate): number | null =>
  r.chances > 0 ? Math.round((r.done / r.chances) * 100) : null;

/** One robot over a set of matches */
export interface RobotTotals {
  matches: number;
  leave: Rate;
  parkAuto: Rate;
  parkEnd: Rate;
  /** Both PARKs together */
  park: Rate;
  /** Average LEAVE + PARK points per match */
  avgLeaveParkPoints: number | null;
  made: number;
  shot: number;
  pollen: number;
  nectar: number;
  /** Made out of shot (0 to 1); null with none counted */
  accuracy: number | null;
  /** Matches with shots counted for this robot */
  shotMatches: number;
  /** Balls in per match, over the matches with shots counted */
  madePerMatch: number | null;
}

const add = (r: Rate, v: boolean | null): Rate =>
  v === null ? r : { done: r.done + (v ? 1 : 0), chances: r.chances + 1 };

export const robotTotals = (
  matches: Match[],
  robot: RobotNumber
): RobotTotals => {
  let leave: Rate = { done: 0, chances: 0 };
  let parkAuto: Rate = { done: 0, chances: 0 };
  let parkEnd: Rate = { done: 0, chances: 0 };
  let points = 0;
  let made = 0;
  let shot = 0;
  let pollen = 0;
  let nectar = 0;
  let shotMatches = 0;
  for (const m of matches) {
    const r = robotInMatch(m, robot);
    leave = add(leave, r.leave);
    parkAuto = add(parkAuto, r.parkAuto);
    parkEnd = add(parkEnd, r.parkEnd);
    points += r.leaveParkPoints;
    made += r.made;
    shot += r.shot;
    pollen += r.pollen;
    nectar += r.nectar;
    if (r.shot > 0) shotMatches += 1;
  }
  const round1 = (n: number) => Math.round(n * 10) / 10;
  return {
    matches: matches.length,
    leave,
    parkAuto,
    parkEnd,
    park: {
      done: parkAuto.done + parkEnd.done,
      chances: parkAuto.chances + parkEnd.chances,
    },
    avgLeaveParkPoints: matches.length ? round1(points / matches.length) : null,
    made,
    shot,
    pollen,
    nectar,
    accuracy: shot > 0 ? made / shot : null,
    shotMatches,
    madePerMatch: shotMatches ? round1(made / shotMatches) : null,
  };
};
