import { useEffect, useRef, useState } from 'react';
import type { MouseEvent, ReactNode, RefObject } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTheme } from '@/contexts';
import { useEscapeKey } from '@/hooks';
import {
  formatDate,
  includesAuto,
  isArchived,
  matchScore,
  rankingPointTally,
  swarmMissing,
  toDate,
} from '@/lib';
import { headlineMatches } from '@/lib/headlineMatches';
import { SESSION_LIMITS } from '@/constants';
import type { Session } from '@/types';
import { viewOnlyNote } from '@/lib/sessionAccess';
import { Card, CardTitle } from '@/components/ui/card';
import { SECTION_TITLE_CLASS } from '@/components/ui/page-header';
import {
  CHIP_BASE,
  CHIP_SIZES,
  DATA_CLASS,
  chipTone,
} from '@/components/ui/tokens';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
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
import { matchTypeLabel, sessionDateLabel } from './sessionList';
import { SignUpToShare } from './SignUpToShare';

/**
 * How long after a card's menu closes every card ignores presses. Archive
 * and Delete take the card away at once, so the second half of a double
 * tap on one lands on whichever card moves into its place.
 */
const MENU_SETTLE_MS = 500;

/** When any card's menu last closed, or one of its items was chosen */
let menuClosedAt = 0;

/**
 * A press that is the second half of a double tap on a menu item. The item
 * may have taken its card away (Archive, Delete) before its menu could say
 * it closed, so choosing one counts too (see `settled`).
 */
const settling = () => Date.now() - menuClosedAt < MENU_SETTLE_MS;

/** A menu item's action, after which presses settle for a moment */
const settled = (action?: () => void) => () => {
  menuClosedAt = Date.now();
  action?.();
};

/**
 * A match type's name in a stat's label, where a cell can be under 60px
 * across: "Auto", as Analysis's "Best Auto" chip says it.
 */
const TYPE_SHORT: Record<string, string> = { Autonomous: 'Auto' };

/** A row in the card's menu: big enough for a thumb, icon then text. */
const MENU_ITEM =
  'flex items-center gap-2 cursor-pointer [@media(pointer:coarse)]:min-h-11';

const stop = (e: MouseEvent) => e.stopPropagation();

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
  /** Leave the stat out of the phone's line (it has nothing to say there) */
  wideOnly?: boolean;
  /**
   * A short line about the value: under it on a wide card, and after it in
   * the phone's line
   */
  note?: string | null;
  /** A bolder value: the number the line leads with */
  strong?: boolean;
  className?: string;
}

/**
 * One number about a session. On a phone the stats run together as a line
 * of text ("Best 142   6 matches   avg 131   48:12"), set apart by space
 * alone and each one kept whole when the line wraps (below 240px, as at
 * 200% zoom, one wider than the line wraps rather than being cut off);
 * from 640px each sits in its own cell with an icon and its label above it.
 */
const Stat = ({
  icon: Icon,
  label,
  phone,
  children,
  wideOnly = false,
  strong = false,
  className = '',
  note,
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
    <span className={`${strong ? 'font-bold' : 'font-medium'} ${DATA_CLASS}`}>
      {children}
    </span>
  );

  return (
    <>
      <div
        className={`${wideOnly ? 'hidden' : ''} whitespace-nowrap [@media(max-width:239px)]:whitespace-normal sm:flex sm:items-center sm:gap-2 sm:whitespace-normal ${className}`}
      >
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
          {note && (
            <span className={`hidden sm:block text-xs ${faint}`}>{note}</span>
          )}
        </span>
      </div>
      {/* In the phone's line it is one more item, which can wrap on its own */}
      {note && !wideOnly && (
        <span className={`sm:hidden ${faint}`}>{note}</span>
      )}
    </>
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
  /** Name of the viewer's team when this session is in no team */
  notSharedWith?: string;
  /**
   * The session stays with a team the viewer is no longer in, so it is
   * view-only for them: that team's name (`name`), when this browser knows
   * it.
   */
  filedUnder?: { name?: string };
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
  filedUnder,
}: SessionCardProps) => {
  const { isDarkMode } = useTheme();
  const navigate = useNavigate();
  const name = session.sessionName || 'Untitled Session';
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(session.sessionName || '');
  const [shareNote, setShareNote] = useState(false);
  const [isSavingName, setIsSavingName] = useState(false);
  const [isTitleTruncated, setIsTitleTruncated] = useState(false);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const signUpRef = useRef<HTMLAnchorElement>(null);
  /** What a menu item opened, which gets the focus the closing menu would take back */
  const focusAfterMenu = useRef<RefObject<HTMLElement | null> | null>(null);
  const savingName = useRef(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  /**
   * Set when the name field still has the focus as the rename ends (Enter
   * or Escape): the field goes, so the focus goes back to the card's menu
   * rather than to the page. A rename ended by clicking elsewhere leaves
   * the focus where the click put it.
   */
  const refocusMenu = useRef(false);

  useEffect(() => {
    if (isEditing || isSavingName || !refocusMenu.current) return;
    refocusMenu.current = false;
    menuButtonRef.current?.focus();
  }, [isEditing, isSavingName]);

  useEffect(() => {
    if (titleRef.current && !isEditing) {
      const isTruncated =
        titleRef.current.scrollHeight > titleRef.current.clientHeight;
      setIsTitleTruncated(isTruncated);
    } else {
      setIsTitleTruncated(false);
    }
  }, [session.sessionName, isEditing]);

  useEscapeKey(shareNote, () => setShareNote(false));

  const handleSaveName = async () => {
    // Enter saves, and so does the blur that follows it: once is enough.
    if (savingName.current) return;
    if (document.activeElement === nameInputRef.current) {
      refocusMenu.current = true;
    }
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
    if (document.activeElement === nameInputRef.current) {
      refocusMenu.current = true;
    }
    setEditedName(session.sessionName || '');
    setIsEditing(false);
  };

  /**
   * Archive and Delete take the card away, its menu button with it: the
   * focus goes on to the next card's menu (the one before, for the last
   * card), or to the list's heading once no card is left.
   */
  const passFocusOn = () => {
    const menus = [
      ...document.querySelectorAll<HTMLElement>('[data-session-menu]'),
    ];
    const at = menuButtonRef.current
      ? menus.indexOf(menuButtonRef.current)
      : -1;
    const next =
      (at === -1 ? undefined : (menus[at + 1] ?? menus[at - 1])) ??
      document.querySelector<HTMLElement>('[data-session-list-heading]');
    focusAfterMenu.current = { current: next };
  };

  const startRename = () => {
    setShareNote(false);
    setEditedName(session.sessionName || '');
    setIsEditing(true);
    focusAfterMenu.current = nameInputRef;
  };

  const handleShare = () => {
    if (onShare) {
      onShare();
      return;
    }
    setShareNote(true);
    focusAfterMenu.current = signUpRef;
  };

  const matchCount = (session.matches || []).length;
  // Best, average and ranking points are of one match type in a Mixed
  // session, as on its Analysis page, and say which
  const headline = headlineMatches(session.matches || [], session.matchType);
  const ofType = headline.mixed
    ? (TYPE_SHORT[headline.type] ?? headline.type)
    : null;
  const scores = headline.matches.map(match =>
    matchScore(match, session.matchType)
  );
  const highestScore = scores.length > 0 ? Math.max(...scores) : null;
  const averageScore =
    scores.length > 0
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : null;
  const rp = rankingPointTally(headline.matches, session.matchType);
  // Without an Auto period no match could earn SWARM, so it isn't counted:
  // said as Analysis, Charts and Compare say it
  const swarmNote =
    headline.matches.length > 0 &&
    !headline.matches.some(m => includesAuto(m.matchType || session.matchType))
      ? `SWARM ${swarmMissing(headline.matches, session.matchType)}`
      : null;
  const dateLabel = sessionDateLabel(session.createdAt);
  const archived = isArchived(session);

  const muted = isDarkMode ? 'text-gray-300' : 'text-gray-600';
  const chip = `${CHIP_BASE} ${CHIP_SIZES.sm} ${chipTone('neutral', isDarkMode)}`;
  /** The kind of session and of its matches, only when not the usual one */
  const sessionType = session.sessionType || 'Practice';
  const matchType = matchTypeLabel(session);

  const title = (
    <CardTitle
      ref={titleRef}
      // A section of the page: under the h1, beside the sr-only Quick Stats h2
      as="h2"
      className={`${SECTION_TITLE_CLASS} leading-snug tracking-normal line-clamp-2 break-words`}
    >
      {/* The card opens on a click anywhere; the name is what a keyboard reaches */}
      <Link
        to={href}
        onClick={e => {
          stop(e);
          if (settling()) e.preventDefault();
        }}
        className="rounded-sm hover:underline"
      >
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
        if (settling()) return;
        navigate(href);
      }}
    >
      <div className="flex flex-col gap-2 p-4 sm:gap-3 sm:p-5">
        {/* The name and the card's menu; nothing else squeezes the name */}
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
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
                      : 'bg-gray-50 border-team-blue/60 text-gray-900 placeholder-gray-500'
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
          </div>

          {isSavingName ? (
            <div
              role="status"
              aria-label="Saving name"
              className="mx-2 mt-1 h-4 w-4 shrink-0 border-2 border-team-blue border-t-transparent rounded-full animate-spin"
            />
          ) : (
            <DropdownMenu
              onOpenChange={open => {
                if (!open) menuClosedAt = Date.now();
              }}
            >
              <DropdownMenuTrigger asChild>
                {/* Centred on the name's first line, taking no more height than it */}
                <button
                  ref={menuButtonRef}
                  type="button"
                  aria-label={`More actions for ${name}`}
                  data-session-menu
                  onClick={stop}
                  className={`-mr-2 -my-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-team-blue/20 hover:text-team-blue [@media(pointer:coarse)]:-my-2.5 [@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:min-w-11 ${
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
                  // Rename and a guest's Share carry on in the card.
                  e.preventDefault();
                  if (document.activeElement !== target) target.focus();
                }}
              >
                {/* Why Rename and Archive aren't here: read on a touch
                    screen too, where the chip's tooltip never shows */}
                {filedUnder && (
                  <>
                    <DropdownMenuLabel
                      className={`max-w-64 text-xs font-normal leading-snug ${muted}`}
                    >
                      {viewOnlyNote(filedUnder.name)}
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem
                  onSelect={settled(handleShare)}
                  className={MENU_ITEM}
                >
                  {onShare ? (
                    <Share2 className="h-4 w-4" />
                  ) : (
                    <Lock className="h-4 w-4" />
                  )}
                  <span>Share link</span>
                </DropdownMenuItem>
                {onNameChange && (
                  <DropdownMenuItem
                    onSelect={settled(startRename)}
                    className={MENU_ITEM}
                  >
                    <Pencil className="h-4 w-4" />
                    <span>Rename</span>
                  </DropdownMenuItem>
                )}
                {onToggleArchive && (
                  <DropdownMenuItem
                    onSelect={settled(() => {
                      passFocusOn();
                      onToggleArchive();
                    })}
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
                {/* Deleted at once: the toast's Undo brings it back */}
                {onDelete && (
                  <DropdownMenuItem
                    onSelect={settled(() => {
                      passFocusOn();
                      onDelete();
                    })}
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

        {/* When, then a chip for anything that isn't the usual: a Scrim, a
            match type other than Full Game, whose it is, who can't see it */}
        <div
          className={`flex flex-wrap items-center gap-x-2 gap-y-1.5 text-sm ${muted}`}
        >
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
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
          {sessionType !== 'Practice' && (
            <span className={chip} data-testid="session-type">
              {sessionType}
            </span>
          )}
          {matchType !== 'Full Game' && (
            <span className={chip} data-testid="session-match-type">
              {matchType}
            </span>
          )}
          {ownerName && (
            <span className={`${chip} min-w-0 max-w-full gap-1`}>
              <User aria-hidden="true" className="h-3 w-3 shrink-0" />
              <span className="truncate">{ownerName}</span>
            </span>
          )}
          {notSharedWith && (
            <span
              className={chip}
              title={`Only you can see this session. It isn't shared with ${notSharedWith}.`}
            >
              Not shared
            </span>
          )}
          {/* Leaving a team doesn't take a session out of it: it stays,
              view-only for its author (the menu says why) */}
          {filedUnder && (
            <span
              className={`${chip} min-w-0 max-w-full gap-1`}
              title={viewOnlyNote(filedUnder.name)}
            >
              <Lock aria-hidden="true" className="h-3 w-3 shrink-0" />
              <span className="truncate">
                {filedUnder.name
                  ? `Filed under ${filedUnder.name}`
                  : 'Old team'}
              </span>
            </span>
          )}
        </div>

        <div className="overflow-hidden">
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-sm sm:grid sm:grid-cols-3 sm:items-start sm:gap-y-3">
            <Stat
              icon={Trophy}
              label={ofType ? `Best ${ofType}` : 'Best'}
              phone={{ before: ofType ? `Best ${ofType}` : 'Best' }}
              strong
              // Nothing scored, nothing to lead the phone's line with.
              wideOnly={highestScore === null}
            >
              {highestScore ?? 'None'}
              {highestScore !== null && (
                <span className="hidden sm:inline"> pts</span>
              )}
            </Stat>
            <Stat
              icon={Hash}
              label="Matches"
              phone={{ after: matchCount === 1 ? 'match' : 'matches' }}
            >
              {matchCount}
            </Stat>
            <Stat
              icon={Gauge}
              label={ofType ? `Avg ${ofType}` : 'Avg Score'}
              phone={{ before: ofType ? `avg ${ofType}` : 'avg' }}
              // An empty session has no average to put in the phone's line.
              wideOnly={averageScore === null}
            >
              {averageScore ?? 'None'}
              {averageScore !== null && (
                <span className="hidden sm:inline"> pts</span>
              )}
            </Stat>
            <Stat
              icon={Clock}
              label="Duration"
              phone="value"
              wideOnly={!session.sessionDuration}
            >
              {session.sessionDuration || 'N/A'}
            </Stat>
            {/* SWARM and POLLINATOR only: a win or tie needs the opponent's score */}
            <Stat
              icon={Award}
              label={ofType ? `RP in ${ofType}` : 'Ranking Points'}
              phone="value"
              wideOnly={rp.rate === null}
              className="sm:col-span-2"
              note={swarmNote}
            >
              <span data-testid="session-ranking-points">
                {rp.rate === null ? (
                  'N/A'
                ) : (
                  <>
                    {rp.earned} of {rp.possible} RP
                    {/* The phone has no label to say it; a screen reader has */}
                    {ofType && (
                      <span aria-hidden="true" className="sm:hidden">
                        {' '}
                        in {ofType}
                      </span>
                    )}{' '}
                    ({rp.rate}%)
                  </>
                )}
              </span>
            </Stat>
          </div>
        </div>

        {shareNote && (
          <div
            role="status"
            onClick={stop}
            className={`flex items-center gap-2 text-sm cursor-default ${
              isDarkMode ? 'text-gray-100' : 'text-gray-900'
            }`}
          >
            <Lock aria-hidden="true" className="h-4 w-4 shrink-0" />
            <SignUpToShare linkRef={signUpRef} className="flex-1 min-w-0" />
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
      </div>
    </Card>
  );
};
