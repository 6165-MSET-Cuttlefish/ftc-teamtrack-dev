import { useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  CornerDownLeft,
  Minus,
  Pencil,
  Trash2,
  Undo2,
  X,
} from 'lucide-react';
import { EYEBROW_CLASS } from '@/components/ui/page-header';
import { useTheme } from '@/contexts';
import { MAX_VOLLEY, formatAccuracy, type Shots } from '@/lib';
import type { ShotVolley } from '@/types';

/** A volley as it is picked: balls shot, and the POLLEN and NECTAR that went in */
export interface PickedVolley {
  shot: number;
  pollen: number;
  nectar: number;
}

/** A recorded volley, as the shot log lists it */
export type LoggedVolley = Omit<ShotVolley, 'robot'>;

const EMPTY: PickedVolley = { shot: 0, pollen: 0, nectar: 0 };

/** The balls of a volley, 1 to 4 */
const BALLS = Array.from({ length: MAX_VOLLEY }, (_, i) => i + 1);

/** The two kinds a ball can score as, with their keys */
const KINDS = [
  { kind: 'pollen', label: 'Pollen', shortcut: 'A' },
  { kind: 'nectar', label: 'Nectar', shortcut: 'N' },
] as const;
type Kind = (typeof KINDS)[number]['kind'];

/** How long a first tap on Delete waits for the second */
const DELETE_CONFIRM_MS = 3000;

/** Whether a logged volley says what went in as POLLEN and NECTAR */
const hasSplit = (v: LoggedVolley) =>
  v.pollen !== undefined || v.nectar !== undefined;

/**
 * Shots a volley at a time, as robots shoot them: a spurt of 1 to 4 balls.
 * Pick how many were shot (1-4), count the POLLEN and NECTAR that went in
 * (A, N), and Record (Enter) keeps the volley and starts the next one.
 * Undo clears a volley being picked, or takes back the last one recorded.
 *
 * Counting a ball in raises the balls shot to match, since every ball that
 * went in was shot; lowering the balls shot takes NECTAR, then POLLEN, out.
 *
 * The shot log under it lists the volleys recorded. Edit puts one back in
 * the picker, where Record saves it in place (it keeps its period) and
 * Undo or Escape leaves it as it was; Delete takes two taps.
 *
 * Used for Robot 1 on the scoring page and for Robot 2 on a teammate's live
 * page. Only one is mounted per page, so its keys are registered once.
 */
export const VolleyPicker = ({
  heading,
  total,
  enabled,
  onBlocked,
  resetKey,
  log,
  onRecord,
  onEdit,
  onDelete,
  robotLabel,
}: {
  heading: string;
  /** Made and shot so far, for the readout beside the heading */
  total: Shots;
  /** Whether a press counts; otherwise it goes to `onBlocked` */
  enabled: boolean;
  onBlocked?: () => void;
  /** Names the match being scored: a half-picked volley belongs to it */
  resetKey: string;
  /** This robot's volleys in the match, in the order they were recorded */
  log: readonly LoggedVolley[];
  onRecord: (volley: PickedVolley) => void;
  /** Replace the volley at `position` in `log` */
  onEdit: (position: number, volley: PickedVolley) => void;
  /** Remove the volley at `position` in `log` */
  onDelete: (position: number) => void;
  /** "Robot 2 ", read out before each control where two robots are scored */
  robotLabel?: string;
}) => {
  const { isDarkMode } = useTheme();
  const [pick, setPick] = useState<
    PickedVolley & { key: string; editing: number | null }
  >({ key: resetKey, ...EMPTY, editing: null });
  const current = pick.key === resetKey ? pick : null;
  const volley: PickedVolley = current ?? EMPTY;
  /** The logged volley being edited, while it is still there */
  const editing =
    current?.editing !== null &&
    current?.editing !== undefined &&
    current.editing < log.length
      ? current.editing
      : null;
  const { shot, pollen, nectar } = volley;
  const made = pollen + nectar;
  const set = (next: PickedVolley, edit: number | null = editing) =>
    setPick({ key: resetKey, ...next, editing: edit });
  const reset = () => set(EMPTY, null);
  const r = robotLabel ?? '';

  const [logOpen, setLogOpen] = useState(false);
  /** The volley whose Delete was tapped once */
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  useEffect(() => {
    if (confirmDelete === null) return;
    const timer = setTimeout(() => setConfirmDelete(null), DELETE_CONFIRM_MS);
    return () => clearTimeout(timer);
  }, [confirmDelete]);

  /** Runs `act` if presses count now, else says why not */
  const guarded =
    <A extends unknown[]>(act: (...args: A) => void) =>
    (...args: A) => {
      if (!enabled) {
        onBlocked?.();
        return;
      }
      act(...args);
    };

  const pickShot = guarded((n: number) => {
    // Too few shot for what went in: NECTAR comes out first, then POLLEN
    const keepPollen = Math.min(pollen, n);
    set({
      shot: n,
      pollen: keepPollen,
      nectar: Math.min(nectar, n - keepPollen),
    });
  });
  const addIn = guarded((kind: Kind) => {
    if (made >= MAX_VOLLEY) return;
    set({
      ...volley,
      [kind]: volley[kind] + 1,
      shot: Math.max(shot, made + 1),
    });
  });
  const takeOut = guarded((kind: Kind) => {
    if (volley[kind] > 0) set({ ...volley, [kind]: volley[kind] - 1 });
  });
  const record = guarded(() => {
    if (shot < 1) return;
    if (editing !== null) onEdit(editing, volley);
    else onRecord(volley);
    reset();
  });
  const undo = () => {
    if (editing !== null || shot > 0) reset();
    else if (log.length > 0) onDelete(log.length - 1);
  };
  const startEdit = guarded((position: number) => {
    const v = log[position];
    if (!v || !hasSplit(v)) return;
    setConfirmDelete(null);
    set(
      { shot: v.shot, pollen: v.pollen ?? 0, nectar: v.nectar ?? 0 },
      position
    );
  });
  const remove = guarded((position: number) => {
    if (confirmDelete !== position) {
      setConfirmDelete(position);
      return;
    }
    setConfirmDelete(null);
    onDelete(position);
  });

  // 1-4 balls shot, A and N for what went in, Enter records and Escape
  // clears; never while something is typed or a dialog is open.
  const keyRef = useRef({ pickShot, addIn, record, reset, shot, editing });
  useEffect(() => {
    keyRef.current = { pickShot, addIn, record, reset, shot, editing };
  });
  useEffect(() => {
    if (!enabled) return;
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
      const key = e.key.toUpperCase();
      const n = Number(e.key);
      if (/^[0-9]$/.test(e.key) && n >= 1 && n <= MAX_VOLLEY) {
        now.pickShot(n);
      } else if (KINDS.some(k => k.shortcut === key)) {
        now.addIn(KINDS.find(k => k.shortcut === key)!.kind);
      } else if (e.key === 'Enter' && now.shot > 0) {
        // Kept from a focused button too, which would take it as a click
        now.record();
      } else if (e.key === 'Escape' && (now.shot > 0 || now.editing !== null)) {
        now.reset();
      } else {
        return;
      }
      e.preventDefault();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [enabled]);

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
          ? 'border-dashed border-team-blue-40 text-team-white-60 hover:bg-team-white-10'
          : 'border-dashed border-gray-300 text-gray-500 hover:bg-gray-100';
  const outline = `border-2 transition-colors select-none touch-manipulation disabled:cursor-not-allowed disabled:opacity-40 ${
    isDarkMode
      ? 'border-team-blue-40 text-white enabled:hover:bg-team-white-10'
      : 'border-gray-500 text-gray-900 enabled:hover:bg-gray-100'
  }`;
  const inClass = `border-2 transition-colors select-none touch-manipulation ${
    isDarkMode
      ? 'border-team-blue text-white hover:bg-team-blue-10'
      : 'border-team-blue text-gray-900 hover:bg-team-blue-10'
  }`;
  const iconButton = `flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
    isDarkMode
      ? 'text-team-white-60 enabled:hover:bg-team-white-10 enabled:hover:text-white'
      : 'text-gray-600 enabled:hover:bg-gray-100 enabled:hover:text-gray-900'
  }`;
  const kbdClass =
    'hidden rounded border border-current px-1 font-sans text-[10px] font-semibold leading-4 opacity-70 md:inline-block [@media(pointer:coarse)]:hidden';
  const blocked = !enabled || undefined;
  const periodName = (v: LoggedVolley) =>
    v.period === 'auto' ? 'Auto' : 'Teleop';
  /** "2/3 in · 1 Pollen · 1 Nectar", or for an old volley "2/3 in" */
  const describe = (v: LoggedVolley) =>
    hasSplit(v)
      ? `${v.made}/${v.shot} in · ${v.pollen ?? 0} Pollen · ${v.nectar ?? 0} Nectar`
      : `${v.made}/${v.shot} in`;

  return (
    <div
      role="group"
      aria-label={`${r}Shots`}
      data-tutorial="shots"
      className="flex flex-col gap-2"
    >
      <div className="flex min-h-5 items-center justify-between gap-2">
        <h3 className={EYEBROW_CLASS}>{heading}</h3>
        <span className={`text-xs font-semibold tabular-nums ${muted}`}>
          {total.made}/{total.made + total.missed}
          {total.accuracy !== null && (
            <span className="ml-2 text-foreground">
              {formatAccuracy(total.accuracy)}
            </span>
          )}
        </span>
      </div>

      {editing !== null && (
        <p className="text-xs font-semibold text-team-blue" aria-live="polite">
          Editing volley #{editing + 1} ({periodName(log[editing])}). Record
          saves it; Undo leaves it as it was.
        </p>
      )}

      {/* Balls shot, then Record and Undo */}
      <div className="flex items-center gap-2">
        {BALLS.map(ball => (
          <button
            key={ball}
            type="button"
            onClick={() => pickShot(ball)}
            aria-pressed={ball === shot}
            aria-disabled={blocked}
            aria-label={`${r}${ball} ${ball === 1 ? 'ball' : 'balls'} shot`}
            aria-keyshortcuts={String(ball)}
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold tabular-nums select-none touch-manipulation transition-colors ${ballClass(ball)}`}
          >
            {ball}
          </button>
        ))}
        <button
          type="button"
          onClick={record}
          disabled={shot === 0}
          aria-label={
            editing !== null
              ? `${r}Save volley ${editing + 1}, ${made} of ${shot} in`
              : shot === 0
                ? `${r}Record volley`
                : `${r}Record volley, ${made} of ${shot} in`
          }
          aria-keyshortcuts="Enter"
          className={`flex h-11 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl text-sm font-semibold ${outline} ${editing !== null ? '!border-team-blue' : ''}`}
        >
          {editing !== null && <span className="truncate">Save</span>}
          {shot > 0 ? (
            <span className="tabular-nums">
              {made}/{shot}
            </span>
          ) : (
            <span className="truncate">Record</span>
          )}
          <CornerDownLeft aria-hidden className="h-4 w-4 shrink-0" />
        </button>
        <button
          type="button"
          onClick={undo}
          disabled={shot === 0 && editing === null && log.length === 0}
          aria-label={
            editing !== null
              ? `${r}Cancel edit`
              : shot > 0
                ? `${r}Clear volley`
                : `${r}Undo last volley`
          }
          title={
            editing !== null
              ? 'Cancel edit'
              : shot > 0
                ? 'Clear this volley'
                : 'Undo last volley'
          }
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${outline}`}
        >
          {editing !== null ? (
            <X aria-hidden className="h-4 w-4" />
          ) : (
            <Undo2 aria-hidden className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* What went in */}
      <div className="flex items-stretch gap-2">
        {KINDS.map(({ kind, label, shortcut }) => (
          <div key={kind} className="flex min-w-0 flex-1 gap-1.5">
            <button
              type="button"
              onClick={() => takeOut(kind)}
              disabled={enabled && volley[kind] === 0}
              aria-disabled={blocked}
              aria-label={`${r}${label} in, take one out`}
              className={`flex h-11 w-10 shrink-0 items-center justify-center rounded-xl ${outline}`}
            >
              <Minus aria-hidden className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => addIn(kind)}
              aria-disabled={blocked}
              aria-label={`${r}${label} in, ${volley[kind]}. Add one`}
              aria-keyshortcuts={shortcut}
              className={`flex h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl px-2 ${inClass}`}
            >
              <span className="truncate text-sm font-semibold">{label}</span>
              <span className="text-lg font-bold tabular-nums">
                {volley[kind]}
              </span>
              <kbd aria-hidden className={kbdClass}>
                {shortcut}
              </kbd>
            </button>
          </div>
        ))}
      </div>

      {/* The shot log: newest first, numbered in the order recorded */}
      {log.length > 0 && (
        <div className="flex flex-col">
          <button
            type="button"
            onClick={() => setLogOpen(o => !o)}
            aria-expanded={logOpen || editing !== null}
            className={`flex min-h-10 items-center gap-1.5 self-start rounded-lg text-xs font-semibold ${muted} hover:text-foreground`}
          >
            <ChevronDown
              aria-hidden
              className={`h-4 w-4 transition-transform ${logOpen || editing !== null ? 'rotate-180' : ''}`}
            />
            {r}Shot log · {log.length} {log.length === 1 ? 'volley' : 'volleys'}
          </button>
          {(logOpen || editing !== null) && (
            <ol
              aria-label={`${r}Shot log`}
              className={`flex flex-col divide-y rounded-xl border ${isDarkMode ? 'divide-team-blue-40/40 border-team-blue-40' : 'divide-gray-200 border-gray-300'}`}
            >
              {log
                .map((v, position) => ({ v, position }))
                .reverse()
                .map(({ v, position }) => {
                  const isEditing = editing === position;
                  const confirming = confirmDelete === position;
                  return (
                    <li
                      key={position}
                      className={`flex items-center gap-2 py-1 pl-3 pr-1 text-sm ${isEditing ? 'bg-team-blue-10' : ''}`}
                    >
                      <span
                        className={`w-7 shrink-0 text-xs font-semibold tabular-nums ${muted}`}
                      >
                        #{position + 1}
                      </span>
                      <span
                        className={`w-12 shrink-0 text-xs font-semibold ${muted}`}
                      >
                        {periodName(v)}
                      </span>
                      <span className="min-w-0 flex-1 truncate tabular-nums">
                        {describe(v)}
                      </span>
                      <button
                        type="button"
                        onClick={() => startEdit(position)}
                        disabled={!hasSplit(v) || isEditing}
                        aria-disabled={blocked}
                        aria-label={`${r}Edit volley ${position + 1}, ${describe(v)}`}
                        title={
                          hasSplit(v)
                            ? 'Edit this volley'
                            : 'Saved before Pollen and Nectar were split: delete and record it again to change it'
                        }
                        className={iconButton}
                      >
                        <Pencil aria-hidden className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(position)}
                        // Positions after it would move under the edit
                        disabled={editing !== null}
                        aria-disabled={blocked}
                        aria-label={
                          confirming
                            ? `${r}Confirm delete volley ${position + 1}`
                            : `${r}Delete volley ${position + 1}`
                        }
                        className={
                          confirming
                            ? 'flex h-10 shrink-0 items-center rounded-lg bg-red-600 px-2.5 text-xs font-semibold text-white'
                            : iconButton
                        }
                      >
                        {confirming ? (
                          'Delete?'
                        ) : (
                          <Trash2 aria-hidden className="h-4 w-4" />
                        )}
                      </button>
                    </li>
                  );
                })}
            </ol>
          )}
        </div>
      )}
    </div>
  );
};
