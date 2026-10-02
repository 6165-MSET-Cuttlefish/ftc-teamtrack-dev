import { useId, useLayoutEffect, useRef, useState } from 'react';
import { Check, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';

import { SPLIT_QUERY } from '@/constants';
import { useMediaQuery } from '@/hooks';
import { matchScore } from '@/lib';
import type { Match } from '@/types';
import { absorbDoubleTap } from './doubleTap';
import { ignoreHeldEnter } from './ignoreHeldEnter';
import { useLiveControls } from './liveControlsContext';
import { EditMatchActions } from './PrimaryAction';
import { toneText } from './tones';

/**
 * The page's match controls, where the primary Save / Cancel pair shows
 * while a match is edited. Both layouts mark them for the walkthrough.
 */
const PRIMARY_CONTROLS = '[data-tutorial="controls"]';

/** Delete / confirm / cancel: compact with a mouse, a full 44px target on touch */
const ICON_BUTTON =
  'p-1.5 rounded-lg transition-colors inline-flex items-center justify-center [@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:min-w-11';

/**
 * Save / Cancel for the match open for editing, shown in the log itself.
 *
 * The primary Save/Cancel pair is at the top of the page — a screen or more
 * away from the log on anything narrower than the two-column layout, and
 * scrolled out of view on a wide screen once the page is scrolled. Without
 * these, tapping a match would look like it did nothing. The "unsaved
 * changes" warning shows here too, when another match is tapped before this
 * one is saved.
 */
const LogEditor = ({
  match,
  fieldsAbove,
}: {
  match: Match;
  /** One-column page: the scoring fields are further up, not alongside */
  fieldsAbove: boolean;
}) => {
  const { isDarkMode, showUnsavedEditWarning } = useLiveControls();

  return (
    <div className="px-4 py-3 space-y-2 bg-yellow-400/10">
      <p
        className={`text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}
      >
        Match {match.matchNumber} is loaded into the scoring fields
        {fieldsAbove ? ' above' : ''}. Change what you need, then save.
      </p>
      <div className="flex gap-2">
        <EditMatchActions />
      </div>
      {showUnsavedEditWarning && (
        <p
          className={`rounded-xl border-2 border-orange-500/60 bg-orange-500/15 px-3 py-2 text-xs font-semibold ${toneText('orange', isDarkMode)}`}
        >
          You have unsaved changes to Match {match.matchNumber}. Save or cancel
          before switching matches.
        </p>
      )}
    </div>
  );
};

/**
 * The list of saved matches, newest first — the match just saved is the one
 * most likely to need a correction. Tapping a row opens it for editing.
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
  /** Two columns: the log is pinned beside the scoring fields */
  const isSplit = useMediaQuery(SPLIT_QUERY);
  const summaryId = useId();
  const listRef = useRef<HTMLDivElement>(null);
  /**
   * What has to be on screen during an edit. In one column, the row being
   * edited with its editor under it; in two, the editor under the list.
   */
  const revealRef = useRef<HTMLDivElement>(null);
  /** Where on screen the row was when it was tapped, so it can stay there */
  const tappedTopRef = useRef<number | null>(null);
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

  // In one column, opening a match changes the list's height (it stops
  // scrolling internally), which moves the tapped row — often off-screen.
  // Before the browser paints, put the row back under the finger and make
  // sure the Save/Cancel pair or warning under it is on screen too.
  //
  // In two columns the list keeps its size and nothing moves. The editor
  // under it is only scrolled into view when the primary Save/Cancel pair is
  // off screen: with that pair in sight the tap has visibly done something,
  // and scrolling would pull the row out from under the pointer for nothing.
  useLayoutEffect(() => {
    const target = revealRef.current;
    if (!editingMatchId || !target) return;
    const tappedTop = tappedTopRef.current;
    tappedTopRef.current = null;
    const headerBottom =
      document.querySelector('header')?.getBoundingClientRect().bottom ?? 0;
    if (isSplit) {
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
    } else if (tappedTop !== null) {
      window.scrollBy({
        top: target.getBoundingClientRect().top - tappedTop,
        behavior: 'instant',
      });
    }
    target.scrollIntoView({ block: 'nearest', behavior: 'instant' });
    // "Nearest" can be underneath the sticky site header.
    const covered = headerBottom + 8 - target.getBoundingClientRect().top;
    if (covered > 0) window.scrollBy({ top: -covered, behavior: 'instant' });
  }, [editingMatchId, isSplit, showUnsavedEditWarning, revealCount]);

  if (matchCount === 0) return null;

  const editingMatch = matches.find(match => match.id === editingMatchId);

  const openMatch = (match: Match, row: HTMLElement) => {
    if (match.id === editingMatchId || match.id === deleteConfirmId) return;
    if (editingMatchId) {
      setShowUnsavedEditWarning(true);
      setRevealCount(count => count + 1);
      return;
    }
    // A saved match must not be edited under a live clock: its taps would be
    // stamped with the running match's time.
    if (matchActive) {
      toast.error('Save or discard the running match first');
      return;
    }
    tappedTopRef.current = row.getBoundingClientRect().top;
    // Fitting the editor in can scroll its Save or Cancel to where the row
    // was, and a double tap would close the match again.
    absorbDoubleTap();
    startEditingMatch(match);
  };

  return (
    <div
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
        className={`divide-y overflow-y-auto ${!isSplit && editingMatchId ? '' : 'max-h-[158px]'} ${isDarkMode ? 'divide-gray-700' : 'divide-gray-200'}`}
      >
        {[...matches].reverse().map(match => {
          const isEditing = editingMatchId === match.id;
          const isConfirmingDelete = deleteConfirmId === match.id;
          const rowSummaryId = `${summaryId}-${match.id}`;
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
              ref={isEditing && !isSplit ? revealRef : undefined}
              className="scroll-mb-4"
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
                  onClick={e => openMatch(match, e.currentTarget)}
                  aria-label={`Edit match ${match.matchNumber}`}
                  aria-describedby={rowSummaryId}
                  aria-pressed={isEditing}
                  className="flex-1 self-stretch min-w-0 flex items-center gap-x-3 gap-y-1 flex-wrap pl-4 py-3 text-left cursor-pointer focus-visible:outline-offset-[-2px]"
                >
                  <span
                    className={`text-sm font-bold ${
                      isDarkMode ? 'text-white' : 'text-gray-900'
                    }`}
                  >
                    Match {match.matchNumber}
                  </span>
                  <span
                    id={rowSummaryId}
                    className="flex items-center gap-x-3 gap-y-1 flex-wrap"
                  >
                    <span className={`text-xs ${detailText}`}>
                      Score: {matchScore(match)}
                    </span>
                    <span className={`text-xs ${detailText}`}>
                      G:{match.garden ?? 0} T:{match.tipping ?? 0} F:
                      {match.flower ?? 0} H:{match.ballsInHive ?? 0}
                    </span>
                  </span>
                  {isEditing && (
                    <span className="text-sm font-bold text-yellow-900 bg-yellow-400 px-3 py-1 rounded-full shadow-lg">
                      Editing
                    </span>
                  )}
                </button>
                <div className="flex items-center gap-2 shrink-0">
                  {!isConfirmingDelete ? (
                    <button
                      type="button"
                      onKeyDown={ignoreHeldEnter}
                      onClick={() => setDeleteConfirmId(match.id)}
                      className={`${ICON_BUTTON} ${
                        isDarkMode
                          ? 'hover:bg-red-500/20 text-gray-400 hover:text-red-400'
                          : 'hover:bg-red-50 text-gray-600 hover:text-red-600'
                      }`}
                      title="Delete match"
                      aria-label={`Delete match ${match.matchNumber}`}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onKeyDown={ignoreHeldEnter}
                        onClick={() => handleDeleteMatch(match.id)}
                        className={`${ICON_BUTTON} bg-red-600 hover:bg-red-700 text-white`}
                        title="Confirm delete"
                        aria-label={`Confirm delete match ${match.matchNumber}`}
                      >
                        <Check className="h-4 w-4" aria-hidden />
                      </button>
                      <button
                        type="button"
                        onKeyDown={ignoreHeldEnter}
                        onClick={() => setDeleteConfirmId(null)}
                        className={`${ICON_BUTTON} ${
                          isDarkMode
                            ? 'bg-gray-700 hover:bg-gray-600 text-white'
                            : 'bg-gray-200 hover:bg-gray-300 text-black'
                        }`}
                        title="Cancel delete"
                        aria-label={`Cancel delete match ${match.matchNumber}`}
                      >
                        <X className="h-4 w-4" aria-hidden />
                      </button>
                    </>
                  )}
                </div>
              </div>
              {isEditing && !isSplit && <LogEditor match={match} fieldsAbove />}
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
          ref={revealRef}
          className={`scroll-mb-4 border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}
        >
          <LogEditor match={editingMatch} fieldsAbove={false} />
        </div>
      )}
    </div>
  );
};
