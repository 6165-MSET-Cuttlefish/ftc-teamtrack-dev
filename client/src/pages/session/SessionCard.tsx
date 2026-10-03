import { useEffect, useId, useRef, useState } from 'react';
import type { MouseEvent, ReactNode, RefObject } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTheme } from '@/contexts';
import { useEscapeKey } from '@/hooks';
import { formatDate, isArchived, rankingPointTally, toDate } from '@/lib';
import { ROUTES, SESSION_LIMITS } from '@/constants';
import type { Session } from '@/types';
import { ignoreHeldEnter } from '@/components/session/controls/ignoreHeldEnter';
import { useArmed } from '@/components/session/controls/useArmed';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Archive,
  ArchiveRestore,
  Award,
  Calendar,
  Clock,
  Gauge,
  Hash,
  Lock,
  MoreVertical,
  Pencil,
  Share2,
  Trash2,
  Trophy,
  User,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { toast } from 'sonner';
import {
  matchTypeLabel,
  plural,
  scoresOf,
  sessionDateLabel,
} from './sessionList';

/** How long after its menu closes a card ignores presses on itself */
const MENU_SETTLE_MS = 500;

/** A row in the card's menu: big enough for a thumb, icon then text. */
const MENU_ITEM =
  'flex items-center gap-2 cursor-pointer [@media(pointer:coarse)]:min-h-11';

const stop = (e: MouseEvent) => e.stopPropagation();

interface DeleteConfirmProps {
  name: string;
  matchCount: number;
  keepRef: RefObject<HTMLButtonElement | null>;
  onKeep: () => void;
  onConfirm: () => void;
}

/**
 * The question a card asks before its session goes: worded, naming the
 * session and what goes with it, with the safe answer first. Delete ignores
 * presses for a moment after the question appears, so a double tap on the
 * menu can never answer it.
 */
const DeleteConfirm = ({
  name,
  matchCount,
  keepRef,
  onKeep,
  onConfirm,
}: DeleteConfirmProps) => {
  const { isDarkMode } = useTheme();
  const questionId = useId();
  const armed = useArmed();

  return (
    <div
      role="group"
      aria-labelledby={questionId}
      onClick={stop}
      className={`flex flex-wrap items-center gap-x-3 gap-y-2 border-t pt-3 cursor-default ${
        isDarkMode ? 'border-team-blue-40' : 'border-gray-200'
      }`}
    >
      <p
        id={questionId}
        className={`flex-1 basis-40 min-w-0 text-sm leading-snug break-words ${
          isDarkMode ? 'text-gray-100' : 'text-gray-900'
        }`}
      >
        Delete <span className="font-bold">{name}</span>
        {matchCount > 0 && ` and its ${plural(matchCount, 'match', 'matches')}`}
        ?
      </p>
      <div className="flex gap-2 ml-auto">
        <Button
          ref={keepRef}
          type="button"
          variant="neutral"
          size="touch"
          onKeyDown={ignoreHeldEnter}
          onClick={onKeep}
        >
          Keep
        </Button>
        <button
          type="button"
          onKeyDown={ignoreHeldEnter}
          onClick={() => {
            if (armed) onConfirm();
          }}
          className="h-11 px-4 rounded-lg border-2 border-red-600 bg-red-600 hover:bg-red-700 text-white text-sm font-bold transition-colors"
        >
          Delete
        </button>
      </div>
    </div>
  );
};

interface StatProps {
  icon: LucideIcon;
  /** Label on a wide card, where it sits above the value */
  label: string;
  /**
   * How the stat reads in the phone's one line of text: the value then a
   * word ("6 matches"), a word then the value ("avg 131"), or the value
   * alone ("48:12", still labelled for a screen reader).
   */
  phone: { before: string } | { after: string } | 'value';
  children: ReactNode;
  /** Phone only: a dot between this stat and the one before it */
  separated?: boolean;
  /** Leave the stat out of the phone's line (it has nothing to say there) */
  wideOnly?: boolean;
  className?: string;
}

/**
 * One number about a session. On a phone the stats run together as a line
 * of text ("6 matches · avg 131 · 48:12"), each one kept whole when the
 * line wraps; from 640px each sits in its own cell with an icon and its
 * label above it.
 */
const Stat = ({
  icon: Icon,
  label,
  phone,
  children,
  separated = false,
  wideOnly = false,
  className = '',
}: StatProps) => {
  const { isDarkMode } = useTheme();
  const faint = isDarkMode ? 'text-gray-400' : 'text-gray-500';
  const word =
    phone === 'value' ? null : 'before' in phone ? phone.before : phone.after;
  const valueFirst = phone !== 'value' && 'after' in phone;

  const labelNode = (
    <span
      className={`sm:text-xs ${word === null ? 'sr-only sm:not-sr-only' : ''} ${
        isDarkMode
          ? 'text-gray-300 sm:text-gray-400'
          : 'text-gray-600 sm:text-gray-500'
      }`}
    >
      {word !== null && <span className="sm:hidden">{word}</span>}
      <span className={word === null ? '' : 'hidden sm:inline'}>{label}</span>
    </span>
  );
  const valueNode = (
    <span
      className={`font-medium tabular-nums ${isDarkMode ? 'text-white' : 'text-team-blue'}`}
    >
      {children}
    </span>
  );

  return (
    <div
      className={`${wideOnly ? 'hidden' : 'inline'} whitespace-nowrap sm:flex sm:items-center sm:gap-2 sm:whitespace-normal ${className}`}
    >
      {separated && (
        <span aria-hidden="true" className={`sm:hidden ${faint}`}>
          ·{' '}
        </span>
      )}
      <Icon
        aria-hidden="true"
        className={`hidden sm:block h-4 w-4 shrink-0 ${faint}`}
      />
      {/* Stacked on a wide card, label on top whichever comes first here */}
      <span
        className={`sm:flex ${valueFirst ? 'sm:flex-col-reverse' : 'sm:flex-col'}`}
      >
        {valueFirst ? valueNode : labelNode}{' '}
        {valueFirst ? labelNode : valueNode}
      </span>
    </div>
  );
};

interface SessionCardProps {
  session: Session;
  /** Where the card leads: the session's analysis page */
  href: string;
  /** Rename the session. Left out when the viewer can't change it. */
  onNameChange?: (newName: string) => void | Promise<void>;
  /** Delete the session. Left out when the viewer can't delete it. */
  onDelete?: () => void;
  /**
   * Archive the session, or bring an archived one back. Left out when the
   * viewer can't change it.
   */
  onToggleArchive?: () => void;
  /** Copy a share link. Left out for a guest, who is told what sharing needs. */
  onShare?: () => void;
  ownerName?: string;
  /** Name of the viewer's team when this session isn't filed under it */
  notSharedWith?: string;
}

export const SessionCard = ({
  session,
  href,
  onNameChange,
  onDelete,
  onToggleArchive,
  onShare,
  ownerName,
  notSharedWith,
}: SessionCardProps) => {
  const { isDarkMode } = useTheme();
  const navigate = useNavigate();
  const name = session.sessionName || 'Untitled Session';
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(session.sessionName || '');
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [shareNote, setShareNote] = useState(false);
  const [isSavingName, setIsSavingName] = useState(false);
  const [isTitleTruncated, setIsTitleTruncated] = useState(false);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const keepRef = useRef<HTMLButtonElement>(null);
  const signUpRef = useRef<HTMLAnchorElement>(null);
  /** What a menu item opened, which gets the focus the closing menu would take back */
  const focusAfterMenu = useRef<RefObject<HTMLElement | null> | null>(null);
  const menuClosedAt = useRef(0);
  const savingName = useRef(false);

  useEffect(() => {
    if (titleRef.current && !isEditing) {
      const isTruncated =
        titleRef.current.scrollHeight > titleRef.current.clientHeight;
      setIsTitleTruncated(isTruncated);
    } else {
      setIsTitleTruncated(false);
    }
  }, [session.sessionName, isEditing]);

  useEscapeKey(deleteConfirm, () => setDeleteConfirm(false));
  useEscapeKey(shareNote, () => setShareNote(false));

  const handleSaveName = async () => {
    // Enter saves, and so does the blur that follows it: once is enough.
    if (savingName.current) return;
    const trimmed = editedName.trim();
    if (!trimmed) {
      toast.error('Session name cannot be empty');
      setEditedName(session.sessionName || '');
      setIsEditing(false);
      return;
    }
    // Nothing to save, and nothing to announce.
    if (trimmed === session.sessionName) {
      setIsEditing(false);
      return;
    }
    savingName.current = true;
    setIsSavingName(true);
    try {
      await onNameChange?.(trimmed);
    } finally {
      savingName.current = false;
      setIsSavingName(false);
      setIsEditing(false);
    }
  };

  const handleCancelEdit = () => {
    setEditedName(session.sessionName || '');
    setIsEditing(false);
  };

  const startRename = () => {
    setDeleteConfirm(false);
    setShareNote(false);
    setEditedName(session.sessionName || '');
    setIsEditing(true);
    focusAfterMenu.current = nameInputRef;
  };

  const askDelete = () => {
    setShareNote(false);
    setDeleteConfirm(true);
    focusAfterMenu.current = keepRef;
  };

  const handleShare = () => {
    if (onShare) {
      onShare();
      return;
    }
    setDeleteConfirm(false);
    setShareNote(true);
    focusAfterMenu.current = signUpRef;
  };

  const scores = scoresOf(session);
  const matchCount = (session.matches || []).length;
  const highestScore = scores.length > 0 ? Math.max(...scores) : null;
  const averageScore =
    scores.length > 0
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : null;
  const rp = rankingPointTally(session.matches || [], session.matchType);
  const dateLabel = sessionDateLabel(session.createdAt);
  const archived = isArchived(session);

  const muted = isDarkMode ? 'text-gray-300' : 'text-gray-600';
  const chip = `inline-flex items-center gap-1 max-w-full rounded-full border px-2 py-0.5 text-xs font-medium ${
    isDarkMode
      ? 'border-team-blue-40 text-team-white-60'
      : 'border-gray-300 text-gray-600'
  }`;

  const title = (
    <CardTitle
      ref={titleRef}
      className={`text-lg font-semibold leading-snug tracking-normal line-clamp-2 break-words ${isDarkMode ? 'text-white' : 'text-team-blue'}`}
    >
      {/* The card opens on a click anywhere; the name is what a keyboard reaches */}
      <Link to={href} onClick={stop} className="rounded-sm hover:underline">
        {name}
      </Link>
    </CardTitle>
  );

  return (
    <Card
      className={`transition-colors duration-300 cursor-pointer group ${
        isDarkMode
          ? 'border-team-blue-40 bg-team-dark hover:border-team-blue'
          : 'border-gray-200 bg-white hover:border-team-blue'
      }`}
      onClick={() => {
        // The second half of a double tap on a menu item lands here.
        if (Date.now() - menuClosedAt.current < MENU_SETTLE_MS) return;
        navigate(href);
      }}
    >
      <div className="flex flex-col gap-2 p-4 sm:gap-3 sm:p-5">
        {/* The name has the first row to itself, at any width */}
        {isEditing ? (
          <div onClick={stop}>
            <Input
              ref={nameInputRef}
              value={editedName}
              onChange={e => setEditedName(e.target.value)}
              maxLength={SESSION_LIMITS.MAX_SESSION_NAME_LENGTH}
              aria-label="Session name"
              className={`h-11 text-lg font-semibold md:text-lg ${
                isDarkMode
                  ? 'bg-team-dark-20 border-team-blue-40 text-white placeholder-team-white-40'
                  : 'bg-gray-50 border-team-blue/60 text-team-blue placeholder-gray-500'
              }`}
              autoFocus
              onFocus={e => e.currentTarget.select()}
              onBlur={handleSaveName}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  handleSaveName();
                } else if (e.key === 'Escape') {
                  handleCancelEdit();
                }
              }}
            />
          </div>
        ) : isTitleTruncated ? (
          <Tooltip>
            <TooltipTrigger asChild>{title}</TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs break-words">
              {name}
            </TooltipContent>
          </Tooltip>
        ) : (
          title
        )}

        {/* When and what kind on the left; best score and the actions on the right */}
        <div className="flex items-center gap-2">
          <div
            className={`flex-1 min-w-0 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm ${muted}`}
          >
            <span className="basis-full inline-flex items-center gap-1.5">
              <Calendar aria-hidden="true" className="h-4 w-4 shrink-0" />
              {dateLabel ? (
                <time
                  dateTime={toDate(session.createdAt).toISOString()}
                  title={formatDate(session.createdAt)}
                >
                  {dateLabel}
                </time>
              ) : (
                <span>No date</span>
              )}
            </span>
            <span className={chip} data-testid="session-type">
              {session.sessionType || 'Practice'}
            </span>
            <span className={chip} data-testid="session-match-type">
              {matchTypeLabel(session)}
            </span>
            {ownerName && (
              <span className={`${chip} min-w-0`}>
                <User aria-hidden="true" className="h-3 w-3 shrink-0" />
                <span className="truncate">{ownerName}</span>
              </span>
            )}
            {notSharedWith && (
              <span
                className={chip}
                title={
                  // Leaving a team doesn't take a session out of it.
                  session.teamId
                    ? `Still filed under another team, whose members can see it. It isn't shared with ${notSharedWith}.`
                    : `Only you can see this session. It isn't shared with ${notSharedWith}.`
                }
              >
                {session.teamId ? 'Other team' : 'Not shared'}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <span
              role="img"
              aria-label={
                highestScore === null
                  ? 'No matches scored'
                  : `Best match score ${highestScore}`
              }
              className="inline-flex items-center gap-1.5 rounded-xl bg-team-blue/15 px-2.5 py-1.5 text-team-blue"
            >
              <Trophy className="h-4 w-4 shrink-0" />
              {/* The small word needs more contrast on the tint than the accent gives in the light theme */}
              <span
                className={`text-xs font-semibold whitespace-nowrap ${isDarkMode ? '' : 'text-gray-700'}`}
              >
                Best{' '}
                <span className="text-lg font-bold leading-none tabular-nums text-team-blue">
                  {highestScore ?? '–'}
                </span>
              </span>
            </span>

            {isSavingName ? (
              <div
                role="status"
                aria-label="Saving name"
                className="mx-2 h-4 w-4 border-2 border-team-blue border-t-transparent rounded-full animate-spin"
              />
            ) : (
              <DropdownMenu
                onOpenChange={open => {
                  if (!open) menuClosedAt.current = Date.now();
                }}
              >
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label={`More actions for ${name}`}
                    onClick={stop}
                    className={`-mr-2 inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-team-blue/20 hover:text-team-blue [@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:min-w-11 ${
                      isDarkMode ? 'text-team-white-60' : 'text-gray-500'
                    }`}
                  >
                    <MoreVertical className="h-5 w-5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="min-w-[160px]"
                  // A portal still bubbles through React to the card.
                  onClick={stop}
                  onCloseAutoFocus={e => {
                    const target = focusAfterMenu.current?.current;
                    focusAfterMenu.current = null;
                    if (!target) return;
                    // Rename, Delete and a guest's Share carry on in the card.
                    e.preventDefault();
                    if (document.activeElement !== target) target.focus();
                  }}
                >
                  <DropdownMenuItem onSelect={handleShare} className={MENU_ITEM}>
                    {onShare ? (
                      <Share2 className="h-4 w-4" />
                    ) : (
                      <Lock className="h-4 w-4" />
                    )}
                    <span>Share link</span>
                  </DropdownMenuItem>
                  {onNameChange && (
                    <DropdownMenuItem
                      onSelect={startRename}
                      className={MENU_ITEM}
                    >
                      <Pencil className="h-4 w-4" />
                      <span>Rename</span>
                    </DropdownMenuItem>
                  )}
                  {onToggleArchive && (
                    <DropdownMenuItem
                      onSelect={onToggleArchive}
                      className={MENU_ITEM}
                    >
                      {archived ? (
                        <ArchiveRestore className="h-4 w-4" />
                      ) : (
                        <Archive className="h-4 w-4" />
                      )}
                      <span>{archived ? 'Unarchive' : 'Archive'}</span>
                    </DropdownMenuItem>
                  )}
                  {onDelete && (
                    <DropdownMenuItem
                      onSelect={askDelete}
                      className={`${MENU_ITEM} text-red-600 focus:text-red-600 dark:text-red-400 dark:focus:text-red-400`}
                    >
                      <Trash2 className="h-4 w-4" />
                      <span>Delete</span>
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        <div className="text-sm sm:grid sm:grid-cols-3 sm:items-start sm:gap-x-3 sm:gap-y-3">
          <Stat
            icon={Hash}
            label="Matches"
            phone={{ after: matchCount === 1 ? 'match' : 'matches' }}
          >
            {matchCount}
          </Stat>{' '}
          <Stat
            icon={Gauge}
            label="Avg Score"
            phone={{ before: 'avg' }}
            separated
            // An empty session has no average to put in the phone's line.
            wideOnly={averageScore === null}
          >
            {averageScore ?? '–'}
            {averageScore !== null && (
              <span className="hidden sm:inline"> pts</span>
            )}
          </Stat>{' '}
          <Stat
            icon={Clock}
            label="Duration"
            phone="value"
            separated
            wideOnly={!session.sessionDuration}
          >
            {session.sessionDuration || 'N/A'}
          </Stat>{' '}
          {/* SWARM and POLLINATOR only: a win or tie needs the opponent's score */}
          <Stat
            icon={Award}
            label="Ranking Points"
            phone="value"
            separated
            wideOnly={rp.rate === null}
            className="sm:col-span-3"
          >
            <span data-testid="session-ranking-points">
              {rp.rate === null
                ? 'N/A'
                : `${rp.earned} of ${rp.possible} RP (${rp.rate}%)`}
            </span>
          </Stat>
        </div>

        {shareNote && (
          <div
            role="status"
            onClick={stop}
            className={`flex items-center gap-2 border-t pt-3 text-sm cursor-default ${
              isDarkMode
                ? 'border-team-blue-40 text-gray-100'
                : 'border-gray-200 text-gray-900'
            }`}
          >
            <Lock aria-hidden="true" className="h-4 w-4 shrink-0" />
            <p className="flex-1 min-w-0">
              Sharing needs a free account ·{' '}
              <Link
                ref={signUpRef}
                to={ROUTES.SIGNUP}
                className="inline-flex items-center font-semibold text-team-blue underline underline-offset-2 whitespace-nowrap [@media(pointer:coarse)]:min-h-11"
              >
                Sign up
              </Link>
            </p>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => setShareNote(false)}
              className={`-my-2 -mr-2 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-team-blue/20 [@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:min-w-11 ${
                isDarkMode ? 'text-team-white-60' : 'text-gray-500'
              }`}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {deleteConfirm && (
          <DeleteConfirm
            name={name}
            matchCount={matchCount}
            keepRef={keepRef}
            onKeep={() => setDeleteConfirm(false)}
            onConfirm={() => {
              setDeleteConfirm(false);
              onDelete?.();
            }}
          />
        )}
      </div>
    </Card>
  );
};
