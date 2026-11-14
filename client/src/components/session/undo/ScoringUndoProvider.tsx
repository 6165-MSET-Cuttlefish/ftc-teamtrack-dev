import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { toast } from 'sonner';
import { useSessionCore } from '@/contexts';
import { ELEMENT_LABELS, pickScoringFields } from '@/lib';
import { shotRobotOf } from '@/lib/scoring';
import type { MatchScoringFields, ShotEntry } from '@/types';
import { useLiveHost } from '../live/liveHostContext';
import { ScoringUndoContext, type ScoringUndo } from './scoringUndoContext';

/** How far back one match can be stepped */
const MAX_STEPS = 200;

/** One toast for every undo, so a run of them doesn't stack up */
const TOAST_ID = 'scoring-undo';

type Fields = MatchScoringFields;

/** What each field is called when it is put back */
const LABELS: Partial<Record<keyof Fields, string>> = {
  tipping: ELEMENT_LABELS.tipping,
  garden: ELEMENT_LABELS.garden,
  flower: ELEMENT_LABELS.flower,
  flowerBonus: ELEMENT_LABELS.flowerBonus,
  ballsInHive: ELEMENT_LABELS.hive,
  robot1Leave: `Robot 1 ${ELEMENT_LABELS.leave}`,
  robot2Leave: `Robot 2 ${ELEMENT_LABELS.leave}`,
  robot1ParkAuto: `Robot 1 ${ELEMENT_LABELS.parkAuto}`,
  robot2ParkAuto: `Robot 2 ${ELEMENT_LABELS.parkAuto}`,
  robot1ParkTeleop: `Robot 1 ${ELEMENT_LABELS.parkEnd}`,
  robot2ParkTeleop: `Robot 2 ${ELEMENT_LABELS.parkEnd}`,
  minorPenalties: ELEMENT_LABELS.minor,
  majorPenalties: ELEMENT_LABELS.major,
  shots: 'Shots',
  tournament: 'Match details',
};

/** Robot 2's own parts, which its live scorer owns while they score it */
const ROBOT2_KEYS = [
  'robot2Leave',
  'robot2ParkAuto',
  'robot2ParkTeleop',
] as const;

/**
 * The fields this device scores: all of them, or while a teammate scores
 * Robot 2 live, everything but Robot 2's toggles and shots (theirs arrive
 * from the live session, and an undo here must not take them back).
 */
const ownFields = (source: Partial<Fields>, robot2Remote: boolean): Fields => {
  const fields = pickScoringFields(source);
  if (!robot2Remote) return fields;
  const own = { ...fields, shots: fields.shots?.filter(isRobot1) ?? [] };
  for (const key of ROBOT2_KEYS) delete (own as Partial<Fields>)[key];
  return own;
};

const isRobot1 = (e: ShotEntry) => shotRobotOf(e) === 1;

/** The first field that differs between two snapshots, by name */
const changedLabel = (a: Fields, b: Fields): string | null => {
  for (const key of Object.keys(LABELS) as (keyof Fields)[]) {
    if (JSON.stringify(a[key]) !== JSON.stringify(b[key])) {
      return LABELS[key] ?? null;
    }
  }
  return null;
};

/** The newest toast's Undo button, when one is showing */
const toastUndoButton = (): HTMLButtonElement | null => {
  const toasts = Array.from(
    document.querySelectorAll<HTMLElement>('[data-sonner-toast]')
  ).sort((a, b) => Number(a.dataset.index ?? 0) - Number(b.dataset.index ?? 0));
  for (const t of toasts) {
    const button = t.querySelector<HTMLButtonElement>('button[data-action]');
    if (button && /undo/i.test(button.textContent ?? '')) return button;
  }
  return null;
};

/**
 * Undo for the scoring page: every change to the match in the fields is
 * kept, a step at a time, so Ctrl+Z (⌘Z on a Mac) or "Undo last change" in
 * the session menu puts the last one back. A toast that offers its own Undo
 * (a match saved, discarded or deleted) is answered first.
 *
 * The steps belong to one match: saving it, opening a saved one, or
 * changing what the session is played as starts afresh.
 */
export const ScoringUndoProvider = ({ children }: { children: ReactNode }) => {
  const {
    sessionData,
    updateSessionData,
    editingMatchId,
    sessionEpoch,
    isTutorialActive,
  } = useSessionCore();
  const { robot2Scorer } = useLiveHost();
  const robot2Remote = robot2Scorer !== null && editingMatchId === null;

  const matchKey = [
    sessionEpoch,
    editingMatchId ?? `live-${sessionData.matches?.length ?? 0}`,
    sessionData.robotCount ?? '',
    sessionData.sessionType,
    sessionData.matchType,
    robot2Remote ? 'r2' : '',
  ].join('|');

  const current = useMemo(
    () => ownFields(sessionData, robot2Remote),
    [sessionData, robot2Remote]
  );
  const currentJson = JSON.stringify(current);

  const stepsRef = useRef<Fields[]>([]);
  const lastRef = useRef<{ key: string; json: string; fields: Fields }>({
    key: matchKey,
    json: currentJson,
    fields: current,
  });
  /** The snapshot an undo is putting back, which isn't a change to keep */
  const restoringRef = useRef<string | null>(null);
  const [depth, setDepth] = useState(0);

  useEffect(() => {
    const last = lastRef.current;
    if (last.key !== matchKey) {
      stepsRef.current = [];
      setDepth(0);
    } else if (last.json !== currentJson) {
      if (restoringRef.current === currentJson) {
        restoringRef.current = null;
      } else {
        stepsRef.current = [...stepsRef.current, last.fields].slice(-MAX_STEPS);
        setDepth(stepsRef.current.length);
      }
    }
    lastRef.current = { key: matchKey, json: currentJson, fields: current };
  }, [matchKey, currentJson, current]);

  const undo = useCallback((): boolean => {
    const steps = stepsRef.current;
    const previous = steps[steps.length - 1];
    if (!previous) return false;
    stepsRef.current = steps.slice(0, -1);
    setDepth(stepsRef.current.length);
    const label = changedLabel(previous, lastRef.current.fields);
    restoringRef.current = JSON.stringify(previous);
    if (robot2Remote) {
      // Robot 2's shots stay as its scorer has them
      const theirs = (sessionData.shots ?? []).filter(e => !isRobot1(e));
      updateSessionData({
        ...previous,
        shots: [...(previous.shots ?? []), ...theirs],
      });
    } else {
      updateSessionData(previous);
    }
    toast(label ? `Undid ${label}` : 'Undid last change', {
      id: TOAST_ID,
      duration: 2000,
    });
    return true;
  }, [robot2Remote, sessionData.shots, updateSessionData]);

  // Ctrl+Z / ⌘Z, never while something is being typed (the field's own
  // undo) or a dialog is asking a question
  const undoRef = useRef(undo);
  undoRef.current = undo;
  useEffect(() => {
    if (isTutorialActive) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'z' || !(e.ctrlKey || e.metaKey)) return;
      if (e.shiftKey || e.altKey || e.repeat || e.defaultPrevented) return;
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
      e.preventDefault();
      const fromToast = toastUndoButton();
      if (fromToast) {
        fromToast.click();
        return;
      }
      if (!undoRef.current()) {
        toast('Nothing to undo in this match', {
          id: TOAST_ID,
          duration: 1500,
        });
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isTutorialActive]);

  const top = depth > 0 ? stepsRef.current[depth - 1] : undefined;
  const nextLabel = top ? changedLabel(top, current) : null;

  const value = useMemo<ScoringUndo>(
    () => ({ canUndo: depth > 0, nextLabel, undo }),
    [depth, nextLabel, undo]
  );

  return (
    <ScoringUndoContext.Provider value={value}>
      {children}
    </ScoringUndoContext.Provider>
  );
};
