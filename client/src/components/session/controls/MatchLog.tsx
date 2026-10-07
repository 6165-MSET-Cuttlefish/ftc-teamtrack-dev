import { useId, useLayoutEffect, useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { EYEBROW_CLASS } from '@/components/ui/page-header';
import { CHIP_BASE, CHIP_SIZES, chipTone } from '@/components/ui/tokens';
import {
  calculateScore,
  FLOWERS_LABEL,
  ELEMENT_LABELS,
  matchScore,
  pickScoringFields,
  rankingPoints,
} from '@/lib';
import type { Match, MatchScoringFields } from '@/types';
import { absorbDoubleTap } from './doubleTap';
import { ConfirmInline } from './ConfirmInline';
import { ignoreHeldEnter } from './ignoreHeldEnter';
import { formatPoints, useLiveControls } from './liveControlsContext';
import { revealInView, scrollUnderHeader } from './scrollUnderHeader';
import { useCompactControls } from './useCompactControls';

/**
 * The page's match controls, where the filled Save / Discard changes pair
 * shows while a match is edited.
 */
const PRIMARY_CONTROLS = '[data-tutorial="controls"]';
/** The top of the scoring fields: the live counters, with Match Entry below */
const SCORING_FIELDS = '[data-tutorial="live"]';

/**
 * How tall a phone's list of matches is, in px, before it scrolls: two rows
 * and the top of a third, which says there are more.
 */
const PHONE_LIST_HEIGHT = 158;
/**
 * What opens under a row: the unsaved-changes note, the delete question.
 * Each sits straight inside its row.
 */
const ROW_INSERT = '[data-row-insert]';
/** The open match's row, with its Editing chip */
const EDITING_ROW = '[data-editing-row]';

/** Delete: compact with a mouse, a full 44px target on touch */
const ICON_BUTTON =
  'p-1.5 rounded-lg transition-colors inline-flex items-center justify-center [@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:min-w-11';

const plural = (count: number, one: string, many = `${one}s`) =>
  `${count} ${count === 1 ? one : many}`;

/**
 * "3 tips · Leave + Park 16 pts · Flowers 6 + 1 bonus · Left in Hive 3 ·
 * Garden 4 · 2 RP", in the order of the form and in the breakdown's words.
 * Only what was scored is listed; a match with nothing at all reads
 * "0 tips". Each part stays on one line with its name when the row wraps,
 * and a dot stays at the end of the line it follows rather than starting
 * the next.
 */
const matchSummary = (match: Match): string => {
  const tips = match.tipping ?? 0;
  const flower = match.flower ?? 0;
  const bonus = match.flowerBonus ?? 0;
  const hive = match.ballsInHive ?? 0;
  const garden = match.garden ?? 0;
  const penalties = (match.minorPenalties ?? 0) + (match.majorPenalties ?? 0);
  const score = calculateScore(match);
  const robots = score.leave + score.park;
  const rp = rankingPoints(match).total;
  const parts = [
    ...(tips > 0 ? [plural(tips, 'tip')] : []),
    ...(robots > 0 ? [`${ELEMENT_LABELS.robots} ${formatPoints(robots)}`] : []),
    ...(flower > 0 || bonus > 0
      ? [
          `${FLOWERS_LABEL} ${[
            ...(flower > 0 ? [String(flower)] : []),
            ...(bonus > 0 ? [`${bonus} bonus`] : []),
          ].join(' + ')}`,
        ]
      : []),
    ...(hive > 0 ? [`${ELEMENT_LABELS.hive} ${hive}`] : []),
    ...(garden > 0 ? [`${ELEMENT_LABELS.garden} ${garden}`] : []),
    ...(penalties > 0 ? [plural(penalties, 'foul', 'fouls')] : []),
    ...(rp > 0 ? [`${rp} RP`] : []),
  ];
  return (parts.length > 0 ? parts : ['0 tips'])
    .map(part => part.replace(/ /g, ' '))
    .join(' · ');
};

/** The scoring fields as one comparable string */
const scoringKey = (fields: Partial<MatchScoringFields>) =>
  JSON.stringify(pickScoringFields(fields));

/**
 * The list of saved matches, newest first — the match just saved is the one
 * most likely to need a correction. Each row says what was scored in words,
 * in the order of the entry form. Tapping a row opens it for editing; with
 * another match open, it goes straight over to the tapped one unless the
 * open one has changes, which are asked about under the tapped row.
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
    editingMatchNumber,
    deleteConfirmId,
    setDeleteConfirmId,
    startEditingMatch,
    showUnsavedEditWarning,
    setShowUnsavedEditWarning,
    handleDeleteMatch,
  } = useLiveControls();
  const isCompact = useCompactControls();
  const summaryId = useId();
  const listRef = useRef<HTMLDivElement>(null);
  /** The row whose delete question is open */
  const confirmRowRef = useRef<HTMLDivElement>(null);
  /** The "unsaved changes" note under the row that was tapped */
  const warningRef = useRef<HTMLParagraphElement>(null);
  /** Set by the tap that opens a match, for the effect that follows it */
  const justOpenedRef = useRef(false);
  /** The row tapped while the open match had changes */
  const [blockedRowId, setBlockedRowId] = useState<string | null>(null);
  /** Bumped by each such tap, to bring the note back into view */
  const [blockedTaps, setBlockedTaps] = useState(0);

  const matches = sessionData.matches || [];
  const matchCount = matches.length;
  const previousMatchCount = useRef(matchCount);

  // A new match goes in at the top of the list. If the phone's list was
  // left scrolled down (to look at or edit an older match), it would be
  // added above the visible rows and never be seen.
  useLayoutEffect(() => {
    if (matchCount > previousMatchCount.current && listRef.current) {
      listRef.current.scrollTop = 0;
    }
    previousMatchCount.current = matchCount;
  }, [matchCount]);

  // On a phone the rows scroll in a short window of their own. Whatever
  // opens under a row makes the window that much taller, instead of pushing
  // the rows below it out of sight: the open match keeps its row, and its
  // Editing chip, in view while the note under the tapped row says why the
  // tap didn't open that one. Set here rather than rendered, so the reveals
  // below already measure the taller window.
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    if (!isCompact) {
      list.style.maxHeight = '';
      return;
    }
    const inserts = [...list.querySelectorAll<HTMLElement>(ROW_INSERT)];
    // While something is open under a row, that row and the open match's
    // are kept whole
    const wholeRows =
      inserts.length === 0
        ? []
        : [
            ...inserts.map(insert => insert.parentElement),
            list.querySelector<HTMLElement>(EDITING_ROW),
          ].filter(row => row !== null);
    const fit = () => {
      const extra = inserts.reduce((sum, insert) => {
        const { marginTop, marginBottom } = getComputedStyle(insert);
        return (
          sum +
          insert.offsetHeight +
          parseFloat(marginTop) +
          parseFloat(marginBottom)
        );
      }, 0);
      const height = PHONE_LIST_HEIGHT + extra;
      // Rows run taller than that allows for (a summary on three lines, the
      // Editing chip on a line of its own): the window goes down to the end
      // of each such row that shows in it, rather than cutting it at the
      // card's edge. Only down: the rows stay where they were on screen.
      const top = list.getBoundingClientRect().top;
      const ends = wholeRows
        .map(row => row.getBoundingClientRect())
        // More of it than the 1px divider
        .filter(box => box.top - top < height - 1 && box.bottom - top > 1)
        .map(box => Math.ceil(box.bottom - top));
      list.style.maxHeight = `${Math.max(height, ...ends)}px`;
    };
    fit();
    if (inserts.length === 0) return;
    // A note or a row that wraps differently once the screen turns
    const observer = new ResizeObserver(fit);
    [...inserts, ...wholeRows].forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, [
    isCompact,
    matchCount,
    editingMatchId,
    deleteConfirmId,
    showUnsavedEditWarning,
    blockedRowId,
    blockedTaps,
  ]);

  // Opening a match loads it into the scoring fields, which are a screen or
  // more up the page from the log: go to them, so the tap visibly does
  // something. A phone has Save / Discard changes in its bar wherever the
  // page is scrolled to; a wider page has them in the controls just above
  // the fields, so those lead.
  useLayoutEffect(() => {
    if (!editingMatchId || !justOpenedRef.current) return;
    justOpenedRef.current = false;
    const target = document.querySelector(
      isCompact ? SCORING_FIELDS : PRIMARY_CONTROLS
    );
    if (target) scrollUnderHeader(target);
  }, [editingMatchId, isCompact]);

  // The delete question opens under its row, which can be at the bottom
  // edge of the list's own scroll area, or behind the bar on a phone.
  useLayoutEffect(() => {
    if (deleteConfirmId && confirmRowRef.current) {
      revealInView(confirmRowRef.current);
    }
  }, [deleteConfirmId]);

  // The note about unsaved changes opens under the row that was tapped.
  useLayoutEffect(() => {
    if (showUnsavedEditWarning && warningRef.current) {
      revealInView(warningRef.current);
    }
  }, [showUnsavedEditWarning, blockedRowId, blockedTaps]);

  if (matchCount === 0) return null;

  const openMatch = (match: Match) => {
    if (match.id === editingMatchId || match.id === deleteConfirmId) return;
    if (editingMatchId) {
      // While a match is open the fields hold its values: unchanged, they
      // are the same as its saved copy, and there is nothing to lose.
      const open = matches.find(m => m.id === editingMatchId);
      if (!open || scoringKey(open) !== scoringKey(sessionData)) {
        setBlockedRowId(match.id);
        setBlockedTaps(count => count + 1);
        setShowUnsavedEditWarning(true);
        return;
      }
    } else if (matchActive) {
      // A saved match must not be edited under a live clock: its taps would
      // be stamped with the running match's time.
      toast.error('Save or discard the running match first', {
        id: 'edit-match-blocked',
      });
      return;
    }
    // The page moves under the pointer: whatever lands there must not take
    // the second tap of a double tap.
    absorbDoubleTap();
    justOpenedRef.current = true;
    setBlockedRowId(null);
    startEditingMatch(match);
  };

  return (
    <div
      data-match-log
      className={`rounded-2xl border-2 overflow-hidden ${
        isDarkMode ? 'border-gray-700 bg-team-dark' : 'border-gray-200 bg-white'
      }`}
    >
      {/*
        Between matches it says how to fix one: tapping a row opens it. The
        pointer is always laid out, only hidden while it doesn't apply, so
        the rows under it never move; in a column too narrow for both (a
        200% zoom) it goes whole onto a line of its own.
      */}
      <div
        className={`flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 px-4 py-2.5 border-b ${
          isDarkMode ? 'border-gray-700' : 'border-gray-200'
        }`}
      >
        <h2 className={`${EYEBROW_CLASS} whitespace-nowrap`}>Match Log</h2>
        <p
          aria-hidden={matchActive || !!editingMatchId || undefined}
          className={`text-xs ${
            isDarkMode ? 'text-gray-400' : 'text-gray-600'
          } ${matchActive || editingMatchId ? 'invisible' : ''}`}
        >
          Tap a match to fix it
        </p>
      </div>
      <div
        ref={listRef}
        // Its own short scroll area on a phone only (its height is set
        // above), where the page is long already; elsewhere the page scrolls
        // and every row shows.
        className={`divide-y ${isCompact ? 'overflow-y-auto' : ''} ${
          isDarkMode ? 'divide-gray-700' : 'divide-gray-200'
        }`}
      >
        {[...matches].reverse().map(match => {
          const isEditing = editingMatchId === match.id;
          const isConfirmingDelete = deleteConfirmId === match.id;
          const isBlocked =
            showUnsavedEditWarning &&
            editingMatchId !== null &&
            blockedRowId === match.id;
          const rowSummaryId = `${summaryId}-${match.id}`;
          const score = matchScore(match);
          const detailText = isDarkMode ? 'text-gray-400' : 'text-gray-600';
          return (
            <div
              key={match.id}
              ref={isConfirmingDelete ? confirmRowRef : undefined}
              data-editing-row={isEditing || undefined}
            >
              {/*
                One amber for editing, as in the header: a soft tint and a
                bar down the left edge. Every row carries the bar's width, so
                opening one moves nothing.
              */}
              <div
                className={`flex items-center justify-between gap-2 pr-4 border-l-4 transition-colors ${
                  isEditing
                    ? isDarkMode
                      ? 'border-amber-400 bg-amber-400/10'
                      : 'border-amber-700 bg-amber-50'
                    : isDarkMode
                      ? 'border-transparent hover:bg-gray-800'
                      : 'border-transparent hover:bg-gray-50'
                }`}
              >
                <button
                  type="button"
                  onKeyDown={ignoreHeldEnter}
                  onClick={() => openMatch(match)}
                  aria-label={`Edit match ${match.matchNumber}`}
                  aria-describedby={rowSummaryId}
                  aria-pressed={isEditing}
                  className="flex-1 self-stretch min-w-0 flex items-center gap-x-3 gap-y-1 flex-wrap pl-3 py-3 text-left cursor-pointer focus-visible:outline-offset-[-2px]"
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
                    <span
                      className={`${CHIP_BASE} ${CHIP_SIZES.sm} ${chipTone('amber', isDarkMode)}`}
                    >
                      Editing · fields above
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
                    title="Delete Match"
                    aria-label={`Delete Match ${match.matchNumber}`}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                )}
              </div>
              {isBlocked && (
                <p
                  ref={warningRef}
                  data-row-insert
                  role="alert"
                  className={`mx-4 mb-3 rounded-xl border px-3 py-2 text-xs font-semibold text-balance ${
                    isDarkMode
                      ? 'border-amber-400/35 bg-amber-400/10 text-amber-200'
                      : 'border-amber-300 bg-amber-50 text-amber-900'
                  }`}
                >
                  Match {editingMatchNumber} has unsaved changes. Save or
                  discard them, then open Match {match.matchNumber}.
                </p>
              )}
              {isConfirmingDelete && (
                <div data-row-insert>
                  <ConfirmInline
                    className="px-4 pb-3 pt-1"
                    question={`Delete Match ${match.matchNumber} (${formatPoints(score)})?`}
                    keepLabel="Keep"
                    confirmLabel="Delete"
                    onKeep={() => setDeleteConfirmId(null)}
                    onConfirm={() => handleDeleteMatch(match.id)}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
