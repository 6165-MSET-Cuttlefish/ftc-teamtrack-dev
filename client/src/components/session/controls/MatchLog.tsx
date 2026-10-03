import { useId, useLayoutEffect, useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { matchScore, rankingPoints } from '@/lib';
import type { Match } from '@/types';
import { absorbDoubleTap } from './doubleTap';
import { ConfirmInline } from './ConfirmInline';
import { ignoreHeldEnter } from './ignoreHeldEnter';
import { formatPoints, useLiveControls } from './liveControlsContext';
import { EditMatchActions } from './PrimaryAction';
import { revealInView, scrollUnderHeader } from './scrollUnderHeader';
import { toneText } from './tones';
import { useCompactControls } from './useCompactControls';

/**
 * The page's match controls, where the filled Save / Discard changes pair
 * shows while a match is edited. Both layouts mark them for the walkthrough.
 */
const PRIMARY_CONTROLS = '[data-tutorial="controls"]';
/** The top of the scoring fields: the live counters, with Match Entry below */
const SCORING_FIELDS = '[data-tutorial="live"]';

/** Delete: compact with a mouse, a full 44px target on touch */
const ICON_BUTTON =
  'p-1.5 rounded-lg transition-colors inline-flex items-center justify-center [@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:min-w-11';

/**
 * "6 tips · Flower 6 · Left in Hive 3 · Garden 4 · 2 RP", in the order of the
 * form. Each count stays on one line with its name when the row wraps, and a
 * dot stays at the end of the line it follows rather than starting the next.
 */
const matchSummary = (match: Match): string => {
  const tips = match.tipping ?? 0;
  const rp = rankingPoints(match).total;
  return [
    `${tips} ${tips === 1 ? 'tip' : 'tips'}`,
    `Flower ${match.flower ?? 0}`,
    ...(match.flowerBonus ? [`Flower Bonus ${match.flowerBonus}`] : []),
    `Left in Hive ${match.ballsInHive ?? 0}`,
    `Garden ${match.garden ?? 0}`,
    ...(rp > 0 ? [`${rp} RP`] : []),
  ]
    .map(part => part.replace(/ /g, '\u00A0'))
    .join('\u00A0· ');
};

/**
 * Save / Discard changes for the match open for editing, under the list.
 *
 * Only on the two-column screen, where the log is pinned beside the scoring
 * fields and the filled pair at the top of the page can be scrolled out of
 * sight: without these, tapping a match there would look like it did
 * nothing. They are outlined copies; the filled pair stays the one at the
 * top. The "unsaved changes" warning shows here too, when another match is
 * tapped before this one is saved.
 */
const LogEditor = ({ match }: { match: Match }) => {
  const { isDarkMode, showUnsavedEditWarning } = useLiveControls();

  return (
    <div className="px-4 py-3 space-y-2 bg-yellow-400/10">
      <p
        className={`text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}
      >
        Match {match.matchNumber} is loaded into the scoring fields. Change what
        you need, then save.
      </p>
      <div className="flex flex-wrap gap-2">
        <EditMatchActions quiet />
      </div>
      {showUnsavedEditWarning && (
        <p
          className={`rounded-xl border-2 border-orange-500/60 bg-orange-500/15 px-3 py-2 text-xs font-semibold ${toneText('orange', isDarkMode)}`}
        >
          You have unsaved changes to Match {match.matchNumber}. Save or discard
          them before switching matches.
        </p>
      )}
    </div>
  );
};

/**
 * The list of saved matches, newest first — the match just saved is the one
 * most likely to need a correction. Each row says what was scored in words,
 * in the order of the entry form. Tapping a row opens it for editing.
 *
 * The per-match score summary wraps on narrow screens rather than
 * overflowing, so the row stays readable on a phone.
 */
export const MatchLog = () => {
  const {
    sessionData,
    isDarkMode,
    matchActive,
    editingMatchId,
    deleteConfirmId,
    setDeleteConfirmId,
    startEditingMatch,
    showUnsavedEditWarning,
    setShowUnsavedEditWarning,
    handleDeleteMatch,
  } = useLiveControls();
  /**
   * Whether the log is pinned in a column beside the scoring fields. No
   * layout does that any more (the desktop scoring pad runs the full width,
   * the log under it), so the one-column behavior always applies.
   */
  const isSplit = false;
  const isCompact = useCompactControls();
  const summaryId = useId();
  const listRef = useRef<HTMLDivElement>(null);
  /** The editor under the list (two columns only) */
  const editorRef = useRef<HTMLDivElement>(null);
  /** The row whose delete question is open */
  const confirmRowRef = useRef<HTMLDivElement>(null);
  /** Set by the tap that opens a match, for the effect that follows it */
  const justOpenedRef = useRef(false);
  /** Bumped by each tap on another row mid-edit, to bring the editor back into view */
  const [revealCount, setRevealCount] = useState(0);

  const matches = sessionData.matches || [];
  const matchCount = matches.length;
  const previousMatchCount = useRef(matchCount);

  // A new match goes in at the top of the list. If the list was left
  // scrolled down (to look at or edit an older match), it would be added
  // above the visible rows and never be seen.
  useLayoutEffect(() => {
    if (matchCount > previousMatchCount.current && listRef.current) {
      listRef.current.scrollTop = 0;
    }
    previousMatchCount.current = matchCount;
  }, [matchCount]);

  // Opening a match loads it into the scoring fields, which in one column
  // are a screen or more up the page from the log: go to them, so the tap
  // visibly does something. A phone has Save / Discard changes in its bar
  // wherever the page is scrolled to; a wider one-column page has them in
  // the controls just above the fields, so those lead.
  //
  // In two columns the fields are alongside and nothing needs to move. The
  // editor under the list is only scrolled into view when the filled pair
  // at the top is off screen: with that pair in sight the tap has visibly
  // done something, and scrolling would pull the row out from under the
  // pointer for nothing.
  useLayoutEffect(() => {
    if (!editingMatchId) return;
    const justOpened = justOpenedRef.current;
    justOpenedRef.current = false;

    if (!isSplit) {
      if (!justOpened) return;
      const target = document.querySelector(
        isCompact ? SCORING_FIELDS : PRIMARY_CONTROLS
      );
      if (target) scrollUnderHeader(target);
      return;
    }

    const editor = editorRef.current;
    if (!editor) return;
    const headerBottom =
      document.querySelector('header')?.getBoundingClientRect().bottom ?? 0;
    const primary = document
      .querySelector(PRIMARY_CONTROLS)
      ?.getBoundingClientRect();
    if (
      primary &&
      primary.top >= headerBottom &&
      primary.bottom <= window.innerHeight
    ) {
      return;
    }
    revealInView(editor);
  }, [editingMatchId, isSplit, isCompact, showUnsavedEditWarning, revealCount]);

  // The delete question opens under its row, which can be at the bottom
  // edge of the list's own scroll area, or behind the bar on a phone.
  useLayoutEffect(() => {
    if (deleteConfirmId && confirmRowRef.current) {
      revealInView(confirmRowRef.current);
    }
  }, [deleteConfirmId]);

  if (matchCount === 0) return null;

  const editingMatch = matches.find(match => match.id === editingMatchId);

  const openMatch = (match: Match) => {
    if (match.id === editingMatchId || match.id === deleteConfirmId) return;
    if (editingMatchId) {
      setShowUnsavedEditWarning(true);
      setRevealCount(count => count + 1);
      return;
    }
    // A saved match must not be edited under a live clock: its taps would be
    // stamped with the running match's time.
    if (matchActive) {
      toast.error('Save or discard the running match first', {
        id: 'edit-match-blocked',
      });
      return;
    }
    // The page moves under the pointer: whatever lands there must not take
    // the second tap of a double tap.
    absorbDoubleTap();
    justOpenedRef.current = true;
    startEditingMatch(match);
  };

  return (
    <div
      data-match-log
      className={`rounded-2xl border-2 overflow-hidden ${
        isDarkMode ? 'border-gray-700 bg-team-dark' : 'border-gray-200 bg-white'
      }`}
    >
      <div
        className={`px-4 py-2.5 text-xs font-semibold uppercase tracking-wider ${
          isDarkMode
            ? 'text-gray-400 border-b border-gray-700'
            : 'text-gray-600 border-b border-gray-200'
        }`}
      >
        Match Log
      </div>
      <div
        ref={listRef}
        className={`divide-y overflow-y-auto max-h-[158px] ${isDarkMode ? 'divide-gray-700' : 'divide-gray-200'}`}
      >
        {[...matches].reverse().map(match => {
          const isEditing = editingMatchId === match.id;
          const isConfirmingDelete = deleteConfirmId === match.id;
          const rowSummaryId = `${summaryId}-${match.id}`;
          const score = matchScore(match);
          // The edited row is tinted yellow; its text has to stay readable on the tint.
          const detailText = isEditing
            ? isDarkMode
              ? 'text-gray-200'
              : 'text-gray-800'
            : isDarkMode
              ? 'text-gray-400'
              : 'text-gray-600';
          return (
            <div
              key={match.id}
              ref={isConfirmingDelete ? confirmRowRef : undefined}
            >
              <div
                className={`flex items-center justify-between gap-2 pr-4 transition-colors ${
                  isEditing
                    ? isDarkMode
                      ? 'bg-yellow-400/20'
                      : 'bg-yellow-400/50'
                    : isDarkMode
                      ? 'hover:bg-gray-800'
                      : 'hover:bg-gray-50'
                }`}
              >
                <button
                  type="button"
                  onKeyDown={ignoreHeldEnter}
                  onClick={() => openMatch(match)}
                  aria-label={`Edit match ${match.matchNumber}`}
                  aria-describedby={rowSummaryId}
                  aria-pressed={isEditing}
                  className="flex-1 self-stretch min-w-0 flex items-center gap-x-3 gap-y-1 flex-wrap pl-4 py-3 text-left cursor-pointer focus-visible:outline-offset-[-2px]"
                >
                  <span
                    id={rowSummaryId}
                    className="min-w-0 flex items-baseline gap-x-3 gap-y-0.5 flex-wrap"
                  >
                    <span
                      className={`text-sm font-bold whitespace-nowrap ${
                        isDarkMode ? 'text-white' : 'text-gray-900'
                      }`}
                    >
                      Match {match.matchNumber} · {formatPoints(score)}
                    </span>
                    <span className={`text-xs ${detailText}`}>
                      {matchSummary(match)}
                    </span>
                  </span>
                  {isEditing && (
                    <span className="text-xs font-bold text-yellow-900 bg-yellow-400 px-2.5 py-1 rounded-full">
                      {isSplit ? 'Editing' : 'Editing · fields above'}
                    </span>
                  )}
                </button>
                {!isConfirmingDelete && (
                  <button
                    type="button"
                    onKeyDown={ignoreHeldEnter}
                    onClick={() => setDeleteConfirmId(match.id)}
                    className={`shrink-0 ${ICON_BUTTON} ${detailText} ${
                      isDarkMode
                        ? 'hover:bg-red-500/20 hover:text-red-400'
                        : 'hover:bg-red-50 hover:text-red-600'
                    }`}
                    title="Delete match"
                    aria-label={`Delete match ${match.matchNumber}`}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                )}
              </div>
              {isConfirmingDelete && (
                <ConfirmInline
                  className="px-4 pb-3 pt-1"
                  question={`Delete Match ${match.matchNumber} (${formatPoints(score)})?`}
                  keepLabel="Keep"
                  confirmLabel="Delete"
                  onKeep={() => setDeleteConfirmId(null)}
                  onConfirm={() => handleDeleteMatch(match.id)}
                />
              )}
            </div>
          );
        })}
      </div>
      {/*
        The pinned column keeps the list in its fixed-height box, where an
        editor under the row would not fit — so it goes under the list.
      */}
      {isSplit && editingMatch && (
        <div
          ref={editorRef}
          className={`border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}
        >
          <LogEditor match={editingMatch} />
        </div>
      )}
    </div>
  );
};
