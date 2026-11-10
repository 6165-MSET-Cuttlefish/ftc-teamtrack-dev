import { useEffect, useRef, useState } from 'react';
import { Undo2 } from 'lucide-react';
import { STORAGE_KEYS } from '@/constants';
import { EYEBROW_CLASS } from '@/components/ui/page-header';
import { useSessionCore, useTheme } from '@/contexts';
import {
  MAX_SHOT_TAPS,
  formatAccuracy,
  hasRobot2Shots,
  isShotTap,
  shotRobotOf,
  shotsOf,
} from '@/lib';
import type { ShotKind, ShotPeriod } from '@/types';
import { requestStartNudge } from './controls/startNudge';
import { useScoringLocks } from './useScoringLocks';

/** A counter: what it counts, what it is called, and its key */
interface Counter {
  kind: ShotKind;
  label: string;
  /** For a phone, where `label` doesn't fit beside three other counters */
  shortLabel?: string;
  /** Read out with the count, e.g. "Pollen made, 3" */
  a11y: string;
  shortcut: string;
}

const COUNTERS: readonly Counter[] = [
  { kind: 'shot', label: 'Shot', a11y: 'Balls shot', shortcut: 'S' },
  { kind: 'pollen', label: 'Pollen', a11y: 'Pollen made', shortcut: 'A' },
  { kind: 'nectar', label: 'Nectar', a11y: 'Nectar made', shortcut: 'N' },
  {
    kind: 'nectarMissed',
    label: 'Nectar miss',
    shortLabel: 'Miss',
    a11y: 'Nectar missed',
    shortcut: 'M',
  },
];

/** Whether this device counts NECTAR misses (off unless turned on) */
const readTrackMisses = (): boolean => {
  try {
    return localStorage.getItem(STORAGE_KEYS.TRACK_NECTAR_MISSES) === 'true';
  } catch {
    return false;
  }
};

const writeTrackMisses = (on: boolean): void => {
  try {
    if (on) localStorage.setItem(STORAGE_KEYS.TRACK_NECTAR_MISSES, 'true');
    else localStorage.removeItem(STORAGE_KEYS.TRACK_NECTAR_MISSES);
  } catch {
    /* storage unavailable: the choice lasts for this visit only */
  }
};

/**
 * Shots as running counters, a tap (or key) at a time: every ball shot,
 * every POLLEN and NECTAR that scored, and, turned on, every NECTAR that
 * missed. Undo takes back the last tap. Accuracy is POLLEN plus NECTAR out
 * of balls shot (see `shotsOf`).
 *
 * Each tap is kept under the period it was in (the controller pickup counts
 * as AUTO, as last season). Only one layout mounts this at a time, so its
 * keys are registered once.
 */
export const ShotCounters = () => {
  const { isDarkMode } = useTheme();
  const { sessionData, updateSessionData, matchPhase } = useSessionCore();
  const { editing, tippingEnabled, entryLocked, hasAuto, hasTeleop } =
    useScoringLocks();
  const [trackMisses, setTrackMisses] = useState(readTrackMisses);

  const period: ShotPeriod = !hasTeleop
    ? 'auto'
    : !hasAuto || editing
      ? 'teleop'
      : matchPhase === 'auton' || matchPhase === 'controller_pickup'
        ? 'auto'
        : 'teleop';

  const entries = sessionData.shots ?? [];
  /**
   * These counters are Robot 1's. Robot 2's taps come in from a teammate
   * scoring it live (see `LiveHostProvider`) and are left alone here.
   */
  const total = shotsOf(sessionData, undefined, 1);
  const robot2Scored = hasRobot2Shots(sessionData);
  /** Taps of each kind, as tapped (before `shotsOf` evens shots up) */
  const tapped = (kind: ShotKind) =>
    entries.filter(e => isShotTap(e) && !e.robot && e.kind === kind).length;
  /** Where Robot 1's last entry is, for Undo */
  let lastOwn = entries.length - 1;
  while (lastOwn >= 0 && shotRobotOf(entries[lastOwn]) !== 1) lastOwn -= 1;

  // A match that already has NECTAR misses shows their counter, so they
  // can still be seen and taken back.
  const showMisses = trackMisses || total.nectarMissed > 0;
  const counters = COUNTERS.filter(
    c => c.kind !== 'nectarMissed' || showMisses
  );

  const add = (kind: ShotKind) => {
    if (!tippingEnabled) {
      if (entryLocked) requestStartNudge();
      return;
    }
    if (tapped(kind) >= MAX_SHOT_TAPS) return;
    updateSessionData({ shots: [...entries, { period, kind }] });
  };
  const undo = () => {
    if (lastOwn >= 0)
      updateSessionData({ shots: entries.filter((_, i) => i !== lastOwn) });
  };
  const toggleMisses = () => {
    const next = !trackMisses;
    setTrackMisses(next);
    writeTrackMisses(next);
  };

  // S, A, N (and M, with misses on) count; never while something is typed
  // or a dialog is open.
  const keyRef = useRef({ add, showMisses });
  useEffect(() => {
    keyRef.current = { add, showMisses };
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
      const counter = COUNTERS.find(c => c.shortcut === e.key.toUpperCase());
      if (!counter) return;
      if (counter.kind === 'nectarMissed' && !now.showMisses) return;
      e.preventDefault();
      now.add(counter.kind);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [tippingEnabled]);

  const muted = isDarkMode ? 'text-team-white-60' : 'text-gray-600';
  const counterClass = (kind: ShotKind) =>
    `flex h-14 min-w-0 flex-1 flex-col items-center justify-center rounded-xl border-2 px-1 select-none touch-manipulation transition-colors ${
      kind === 'shot'
        ? isDarkMode
          ? 'border-white text-white hover:bg-team-white-10'
          : 'border-gray-900 text-gray-900 hover:bg-gray-100'
        : kind === 'nectarMissed'
          ? isDarkMode
            ? 'border-dashed border-team-blue-40 text-team-white-60 hover:bg-team-white-10'
            : 'border-dashed border-gray-400 text-gray-600 hover:bg-gray-100'
          : isDarkMode
            ? 'border-team-blue text-white hover:bg-team-blue-10'
            : 'border-team-blue text-gray-900 hover:bg-team-blue-10'
    }`;
  const undoClass = `flex h-14 w-11 shrink-0 items-center justify-center rounded-xl border-2 transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
    isDarkMode
      ? 'border-team-blue-40 text-white enabled:hover:bg-team-white-10'
      : 'border-gray-500 text-gray-900 enabled:hover:bg-gray-100'
  }`;
  const kbdClass = `hidden rounded border border-current px-1 font-sans text-[10px] font-semibold leading-4 opacity-70 md:inline-block [@media(pointer:coarse)]:hidden`;

  return (
    <div
      role="group"
      aria-label="Shots"
      data-tutorial="shots"
      className="flex flex-col gap-2"
    >
      <div className="flex min-h-5 items-center justify-between gap-2">
        <h3 className={EYEBROW_CLASS}>
          Shots{robot2Scored ? ' · Robot 1' : ''}
        </h3>
        <div className="flex min-w-0 items-center gap-3">
          <span className={`text-xs font-semibold tabular-nums ${muted}`}>
            {total.made}/{total.made + total.missed}
            {total.accuracy !== null && (
              <span className="ml-2 text-foreground">
                {formatAccuracy(total.accuracy)}
              </span>
            )}
          </span>
          <button
            type="button"
            onClick={toggleMisses}
            aria-pressed={trackMisses}
            // Drawn as small as the counts beside it; under a finger the
            // target is still 44px tall (an empty ::after round it)
            className={`relative min-h-0 min-w-0 shrink-0 rounded-full border px-2 py-0.5 text-xs font-semibold transition-colors after:absolute after:-inset-y-3 after:inset-x-0 after:content-[''] ${
              trackMisses
                ? 'border-team-blue bg-team-blue-10 text-foreground'
                : isDarkMode
                  ? 'border-team-blue-40 text-team-white-60 hover:text-white'
                  : 'border-gray-300 text-gray-600 hover:text-gray-900'
            }`}
          >
            Nectar misses
          </button>
        </div>
      </div>
      <div className="flex items-stretch gap-2">
        {counters.map(c => {
          const count = tapped(c.kind);
          return (
            <button
              key={c.kind}
              type="button"
              onClick={() => add(c.kind)}
              aria-label={`${c.a11y}, ${count}. Add one`}
              aria-keyshortcuts={c.shortcut}
              aria-disabled={!tippingEnabled || undefined}
              className={counterClass(c.kind)}
            >
              <span className="text-lg font-bold leading-6 tabular-nums">
                {count}
              </span>
              <span className="flex max-w-full items-center gap-1 text-xs font-semibold leading-4">
                {c.shortLabel ? (
                  <>
                    <span className="truncate sm:hidden">{c.shortLabel}</span>
                    <span className="hidden truncate sm:inline">{c.label}</span>
                  </>
                ) : (
                  <span className="truncate">{c.label}</span>
                )}
                <kbd aria-hidden className={kbdClass}>
                  {c.shortcut}
                </kbd>
              </span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={undo}
          disabled={lastOwn < 0}
          aria-label="Undo last shot tap"
          title="Undo last shot tap"
          className={undoClass}
        >
          <Undo2 aria-hidden className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
