import { useSessionCore } from '@/contexts';
import { hasRobot2Shots, isShotTap, shotRobotOf, shotsOf } from '@/lib';
import type { ShotEntry, ShotPeriod, ShotVolley } from '@/types';
import { requestStartNudge } from './controls/startNudge';
import { useScoringLocks } from './useScoringLocks';
import { VolleyPicker, type PickedVolley } from './VolleyPicker';

/** A picked volley as it is kept in the match */
const toEntry = (
  period: ShotPeriod,
  { shot, pollen, nectar }: PickedVolley
): ShotVolley => ({ period, shot, made: pollen + nectar, pollen, nectar });

/**
 * Robot 1's shots, a volley at a time, with their log (see `VolleyPicker`).
 * Each volley is kept under the period it was shot in (the controller
 * pickup counts as AUTO, as last season); an edited one keeps its own.
 *
 * Robot 2's volleys come in from a teammate scoring it live (see
 * `LiveHostProvider`) and are left alone here: the readout, the log and
 * Undo are Robot 1's. So are taps from the old per-ball counters, which
 * count in the readout but have no volley to edit.
 */
export const ShotPicker = () => {
  const { sessionData, updateSessionData, matchPhase } = useSessionCore();
  const { editing, entryKey, tippingEnabled, entryLocked, hasAuto, hasTeleop } =
    useScoringLocks();

  const period: ShotPeriod = !hasTeleop
    ? 'auto'
    : !hasAuto || editing
      ? 'teleop'
      : matchPhase === 'auton' || matchPhase === 'controller_pickup'
        ? 'auto'
        : 'teleop';

  const entries = sessionData.shots ?? [];
  /** Robot 1's volleys, with where each one is in `entries` */
  const own = entries.flatMap((entry, index) =>
    !isShotTap(entry) && shotRobotOf(entry) === 1 ? [{ entry, index }] : []
  );
  const save = (shots: ShotEntry[]) => updateSessionData({ shots });

  return (
    <VolleyPicker
      heading={hasRobot2Shots(sessionData) ? 'Shots · Robot 1' : 'Shots'}
      total={shotsOf(sessionData, undefined, 1)}
      enabled={tippingEnabled}
      // Before Start a press asks for Start; in the 3-2-1 it waits
      onBlocked={entryLocked ? requestStartNudge : undefined}
      resetKey={entryKey}
      log={own.map(o => o.entry)}
      onRecord={v => save([...entries, toEntry(period, v)])}
      onEdit={(position, v) => {
        const at = own[position];
        if (!at) return;
        save(
          entries.map((e, i) => (i === at.index ? toEntry(e.period, v) : e))
        );
      }}
      onDelete={position => {
        const at = own[position];
        if (at) save(entries.filter((_, i) => i !== at.index));
      }}
    />
  );
};
