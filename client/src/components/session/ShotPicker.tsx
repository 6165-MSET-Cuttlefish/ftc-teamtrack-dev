import { useEffect, useRef, useState } from 'react';
import { CornerDownLeft, Undo2 } from 'lucide-react';
import { EYEBROW_CLASS } from '@/components/ui/page-header';
import { useSessionCore, useTheme } from '@/contexts';
import { MAX_VOLLEY, formatAccuracy, shotsOf } from '@/lib';
import type { ShotPeriod } from '@/types';
import { requestStartNudge } from './controls/startNudge';
import { useScoringLocks } from './useScoringLocks';

/** The balls of a volley, 1 to 4 */
const BALLS = Array.from({ length: MAX_VOLLEY }, (_, i) => i + 1);

/**
 * Shots, a volley at a time, as last season's keys had it: the number of
 * balls shot, the number that went in, Enter. On a touch screen the first
 * tap on a ball is how many were shot, a tap on one of those is how many
 * went in, and Enter records it. Undo clears a volley being picked, or
 * takes back the last one recorded.
 *
 * Each volley is kept under the period it was shot in (the controller
 * pickup counts as AUTO, as last season). Only one layout mounts this at a
 * time, so its keys are registered once.
 */
export const ShotPicker = () => {
  const { isDarkMode } = useTheme();
  const { sessionData, updateSessionData, matchPhase } = useSessionCore();
  const { editing, entryKey, tippingEnabled, entryLocked, hasAuto, hasTeleop } =
    useScoringLocks();

  /** The volley being picked; it belongs to the match in the fields */
  const [pick, setPick] = useState({ key: entryKey, shot: 0, made: 0 });
  const { shot, made } = pick.key === entryKey ? pick : { shot: 0, made: 0 };
  const setVolley = (next: { shot: number; made: number }) =>
    setPick({ key: entryKey, ...next });

  const period: ShotPeriod = !hasTeleop
    ? 'auto'
    : !hasAuto || editing
      ? 'teleop'
      : matchPhase === 'auton' || matchPhase === 'controller_pickup'
        ? 'auto'
        : 'teleop';

  const volleys = sessionData.shots ?? [];
  const total = shotsOf(sessionData);

  const record = () => {
    if (shot === 0) return;
    updateSessionData({ shots: [...volleys, { period, shot, made }] });
    setVolley({ shot: 0, made: 0 });
  };
  const undo = () => {
    if (shot > 0) setVolley({ shot: 0, made: 0 });
    else if (volleys.length > 0)
      updateSessionData({ shots: volleys.slice(0, -1) });
  };

  const tapBall = (ball: number) => {
    if (!tippingEnabled) {
      if (entryLocked) requestStartNudge();
      return;
    }
    if (shot === 0 || ball > shot) {
      setVolley({ shot: ball, made: Math.min(made, ball) });
    } else {
      // A tap on the last ball in takes it back out
      setVolley({ shot, made: made === ball ? ball - 1 : ball });
    }
  };

  // 1-4 is how many were shot, then 0 to that how many went in, Enter
  // records, Escape clears. Never while something is typed or a dialog is
  // open.
  const keyRef = useRef({ shot, made, record, setVolley });
  useEffect(() => {
    keyRef.current = { shot, made, record, setVolley };
  });
  useEffect(() => {
    if (!tippingEnabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented)
        return;
      const target = e.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.closest('input, textarea, select, [role="dialog"]'))
      ) {
        return;
      }
      if (document.querySelector('[role="dialog"], [role="alertdialog"]'))
        return;
      const now = keyRef.current;
      if (/^[0-9]$/.test(e.key)) {
        const n = Number(e.key);
        if (now.shot === 0) {
          if (n < 1 || n > MAX_VOLLEY) return;
          now.setVolley({ shot: n, made: 0 });
        } else {
          if (n > now.shot) return;
          now.setVolley({ shot: now.shot, made: n });
        }
        e.preventDefault();
      } else if (e.key === 'Enter' && now.shot > 0) {
        e.preventDefault();
        now.record();
      } else if (e.key === 'Escape' && now.shot > 0) {
        e.preventDefault();
        now.setVolley({ shot: 0, made: 0 });
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [tippingEnabled]);

  const muted = isDarkMode ? 'text-team-white-60' : 'text-gray-600';
  const ballClass = (ball: number) =>
    ball <= made
      ? isDarkMode
        ? 'border-team-blue bg-team-blue text-black'
        : 'border-team-blue bg-team-blue text-white'
      : ball <= shot
        ? isDarkMode
          ? 'border-white text-white'
          : 'border-gray-900 text-gray-900'
        : isDarkMode
          ? 'border-dashed border-team-blue-40 text-team-white-60'
          : 'border-dashed border-gray-300 text-gray-500';
  const sideButton = `flex h-11 items-center justify-center rounded-xl border-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
    isDarkMode
      ? 'border-team-blue-40 text-white enabled:hover:bg-team-white-10'
      : 'border-gray-500 text-gray-900 enabled:hover:bg-gray-100'
  }`;

  return (
    <div
      role="group"
      aria-label="Shots"
      data-tutorial="shots"
      className="flex flex-col gap-2"
    >
      <div className="flex min-h-5 items-center justify-between gap-2">
        <h3 className={EYEBROW_CLASS}>Shots</h3>
        <span className={`text-xs font-semibold tabular-nums ${muted}`}>
          {total.made}/{total.made + total.missed}
          {total.accuracy !== null && (
            <span className="ml-2 text-foreground">
              {formatAccuracy(total.accuracy)}
            </span>
          )}
        </span>
      </div>
      <div className="flex items-center gap-2">
        {BALLS.map(ball => (
          <button
            key={ball}
            type="button"
            onClick={() => tapBall(ball)}
            aria-pressed={ball <= shot}
            aria-label={
              shot === 0 || ball > shot ? `${ball} shot` : `${ball} made`
            }
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold tabular-nums select-none touch-manipulation transition-colors ${ballClass(ball)}`}
          >
            {ball}
          </button>
        ))}
        <button
          type="button"
          onClick={record}
          disabled={shot === 0}
          aria-label="Record shot"
          aria-keyshortcuts="Enter"
          className={`min-w-0 flex-1 gap-1.5 ${sideButton}`}
        >
          {shot > 0 && (
            <span className="tabular-nums">
              {made}/{shot}
            </span>
          )}
          <CornerDownLeft aria-hidden className="h-4 w-4 shrink-0" />
        </button>
        <button
          type="button"
          onClick={undo}
          disabled={shot === 0 && volleys.length === 0}
          aria-label={shot > 0 ? 'Clear' : 'Undo last shot'}
          className={`w-11 shrink-0 ${sideButton}`}
        >
          <Undo2 aria-hidden className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
