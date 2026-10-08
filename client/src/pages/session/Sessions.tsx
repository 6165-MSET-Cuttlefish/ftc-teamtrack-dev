import {
  useState,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useCallback,
  useSyncExternalStore,
} from 'react';
import {
  Link,
  NavigationType,
  useLocation,
  useNavigate,
  useNavigationType,
  useSearchParams,
} from 'react-router-dom';
import { useAuth, useSessionCore, useTheme, useTeam } from '@/contexts';
import { firebaseService, teamService } from '@/services';
import { TeamManager } from '@/components';
import {
  isAbortError,
  generateShareableLink,
  copyShareLink,
  logger,
  buildSessionsCsv,
  buildLegacySessionsCsv,
  csvFileName,
  downloadCsv,
  SORT_LABELS,
  DEFAULT_SORT,
  isArchived,
  isGuestSessionId,
  readGuestSessions,
  writeGuestSessions,
} from '@/lib';
import type { SortOption } from '@/lib';
import {
  archivedFor,
  inArchiveView,
  sortFromParam,
} from '@/lib/sessionFilters';
import {
  getPendingDeleteIds,
  subscribePendingDeletes,
  scheduleSessionDelete,
} from '@/lib/pendingSessionDeletes';
import { readAllGuestSessions } from '@/lib/guestSessions';
import {
  importGuestSessions,
  importableGuestSessions,
  isImportingGuestSessions,
  subscribeGuestImport,
} from '@/lib/guestImport';
import { safariMayEraseStorage } from '@/lib/browserStorage';
import { filedUnderName, teamFiling } from '@/lib/sessionAccess';
import { LEGACY_SEASON } from '@/lib/sessionNormalize';
import {
  UI_TIMING,
  APP_CONFIG,
  ROUTES,
  STORAGE_KEYS,
  OPEN_SHARE_SESSIONS_EVENT,
  CURRENT_SEASON,
} from '@/constants';
import type { Session } from '@/types';
import {
  EYEBROW_CLASS,
  PAGE_TITLE_CLASS,
  SECTION_TITLE_CLASS,
} from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Segmented } from '@/components/ui/segmented';
import { StatTile } from '@/components/ui/stat-tile';
import { CHIP_BASE, CHIP_SIZES } from '@/components/ui/tokens';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Archive,
  ArrowLeft,
  ArrowUpDown,
  CloudOff,
  Search,
  Plus,
  BarChart3,
  ChevronDown,
  Download,
  SlidersHorizontal,
  Smartphone,
  TrendingUp,
  Upload,
  Users,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { SessionCard } from './SessionCard';
import {
  ALL_MATCH_TYPES,
  MATCH_TYPE_FILTERS,
  SESSION_SCOPES,
  exportFileBase,
  filterSessions,
  hasActiveFilters,
  inSessionScope,
  matchCountOf,
  matchTypeFromParam,
  matchTypeParam,
  oneMatchTypeLabel,
  plural,
  quickStatsOf,
  scopeFromParam,
  scopeLabel,
  sessionsToExport,
  sortShown,
  withCountedMatches,
} from './sessionList';
import type { SessionListFilters, SessionScope } from './sessionList';
import { useSessionList } from './useSessionList';

/** How long the search waits after the last key before it goes in the address */
const SEARCH_TO_URL_MS = 300;

/** History entries remembered: enough for a few trips there and back */
const SCROLL_ENTRIES = 20;

/**
 * Where the list was left: how far down it was scrolled, and how far back
 * it had been read (every session recorded after `through`, in ms; 0 for
 * all of them), so coming Back reads that far again before scrolling.
 */
interface SavedScroll {
  y: number;
  through?: number;
}

type ScrollEntry = [string, number] | [string, number, number];

const readScrollPositions = (): ScrollEntry[] => {
  try {
    const saved: unknown = JSON.parse(
      sessionStorage.getItem(STORAGE_KEYS.SESSIONS_SCROLL) ?? '[]'
    );
    return Array.isArray(saved)
      ? saved.filter(
          (entry): entry is ScrollEntry =>
            Array.isArray(entry) &&
            typeof entry[0] === 'string' &&
            typeof entry[1] === 'number' &&
            (entry[2] === undefined || typeof entry[2] === 'number')
        )
      : [];
  } catch {
    return [];
  }
};

/** Remember how far down the list was, for coming Back to this entry */
const rememberScroll = (historyKey: string, { y, through }: SavedScroll) => {
  try {
    const others = readScrollPositions().filter(([key]) => key !== historyKey);
    const entry: ScrollEntry =
      through === undefined
        ? [historyKey, Math.round(y)]
        : [historyKey, Math.round(y), through];
    sessionStorage.setItem(
      STORAGE_KEYS.SESSIONS_SCROLL,
      JSON.stringify([...others, entry].slice(-SCROLL_ENTRIES))
    );
  } catch {
    /* storage unavailable: Back starts at the top */
  }
};

const savedScroll = (historyKey: string): SavedScroll | null => {
  const entry = readScrollPositions().find(([key]) => key === historyKey);
  return entry ? { y: entry[1], through: entry[2] } : null;
};

/**
 * What the list looked like when it last loaded on this device, so the
 * stand-ins shown while it loads take the room the list will: Quick Stats
 * only shows over two sessions or more, and the unshared banner only while
 * some of the viewer's sessions aren't shared. It holds counts, the list
 * settings they were for (a search as the address had it) and the team's
 * name to size the banner by.
 */
interface ListLayout {
  uid: string;
  teamId: string | null;
  /** The unshared banner as it last showed, or null when it didn't */
  unshared: { count: number; teamName: string } | null;
  /** How many sessions each set of list settings showed, latest last */
  shown: Array<[string, number]>;
  /**
   * Older sessions were left to read, so Quick Stats said it only counts
   * the newest ones
   */
  more: boolean;
}

const LAYOUT_KEY = 'teamtrack-sessions-layout';
/** Sets of settings remembered: the plain list and a few filtered ones */
const LAYOUT_ENTRIES = 20;

const readListLayout = (
  uid: string,
  teamId: string | null
): ListLayout | null => {
  try {
    const saved = JSON.parse(
      localStorage.getItem(LAYOUT_KEY) ?? 'null'
    ) as Partial<ListLayout> | null;
    if (
      !saved ||
      saved.uid !== uid ||
      saved.teamId !== teamId ||
      !Array.isArray(saved.shown)
    ) {
      return null;
    }
    const unshared = saved.unshared;
    return {
      uid,
      teamId,
      unshared:
        unshared &&
        typeof unshared.count === 'number' &&
        typeof unshared.teamName === 'string'
          ? unshared
          : null,
      shown: saved.shown.filter(
        (entry): entry is [string, number] =>
          Array.isArray(entry) &&
          typeof entry[0] === 'string' &&
          typeof entry[1] === 'number'
      ),
      more: saved.more === true,
    };
  } catch {
    return null;
  }
};

const writeListLayout = (layout: ListLayout) => {
  try {
    localStorage.setItem(
      LAYOUT_KEY,
      JSON.stringify({ ...layout, shown: layout.shown.slice(-LAYOUT_ENTRIES) })
    );
  } catch {
    /* storage unavailable: the next visit guesses */
  }
};

/**
 * The list settings that decide which sessions are shown (the order
 * doesn't), as one key for `ListLayout.shown`.
 */
const listKey = (
  view: 'active' | 'archived',
  scope: string,
  matchType: string,
  searchTerm: string
) => [view, scope, matchType, searchTerm.trim().toLowerCase()].join('|');

/**
 * How many sessions the list will show, going by the last visit: what
 * these settings showed then, or for settings not seen yet, a plain list
 * of fewer than two (narrowing it can only show fewer). Undefined when
 * there's nothing to go by.
 */
const expectedCount = (
  layout: ListLayout | null,
  key: string,
  plainKey: string
): number | undefined => {
  const shownFor = (k: string) =>
    layout?.shown.find(([entry]) => entry === k)?.[1];
  const exact = shownFor(key);
  if (exact !== undefined) return exact;
  const plain = shownFor(plainKey);
  return plain !== undefined && plain < 2 ? plain : undefined;
};

/**
 * "Not now" to importing this browser's guest sessions, for the account it
 * was said in: it holds for the rest of the visit (this tab), and the offer
 * is back the next time the app is opened. A dismissal that lasted would
 * leave those sessions with no way into the account while signed in.
 */
const IMPORT_DISMISSED_KEY = 'teamtrack-guest-import-dismissed';

const readImportDismissed = (uid: string | undefined): boolean => {
  try {
    return !!uid && sessionStorage.getItem(IMPORT_DISMISSED_KEY) === uid;
  } catch {
    return false;
  }
};

const writeImportDismissed = (uid: string) => {
  try {
    sessionStorage.setItem(IMPORT_DISMISSED_KEY, uid);
  } catch {
    /* storage unavailable: dismissed until the page is left */
  }
};

/**
 * The unshared sessions the user said "Not now" about in this team. Keeping
 * a session private is a choice, so the banner only comes back for others.
 */
const readUnsharedDismissed = (uid: string, teamId: string): Set<string> => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.UNSHARED_BANNER_DISMISSED);
    const saved: unknown = raw ? JSON.parse(raw) : null;
    if (
      saved &&
      typeof saved === 'object' &&
      'uid' in saved &&
      'teamId' in saved &&
      'ids' in saved &&
      saved.uid === uid &&
      saved.teamId === teamId &&
      Array.isArray(saved.ids)
    ) {
      return new Set(saved.ids.filter(id => typeof id === 'string'));
    }
  } catch {
    /* unreadable: the banner shows again */
  }
  return new Set();
};

const writeUnsharedDismissed = (uid: string, teamId: string, ids: string[]) => {
  try {
    localStorage.setItem(
      STORAGE_KEYS.UNSHARED_BANNER_DISMISSED,
      JSON.stringify({ uid, teamId, ids })
    );
  } catch {
    /* storage unavailable: dismissed for this visit only */
  }
};

const LoadingCard = () => {
  const { isDarkMode } = useTheme();

  return (
    <Card
      className={`${isDarkMode ? 'border-team-blue-40 bg-team-dark' : 'border-team-blue/40 bg-white'}`}
    >
      <div className="flex flex-col gap-2 p-4 sm:gap-3 sm:p-5">
        <div className="h-6 bg-muted rounded animate-pulse w-3/4"></div>
        <div className="flex items-center justify-between gap-4">
          <div className="h-11 bg-muted rounded animate-pulse w-36"></div>
          <div className="h-9 bg-muted rounded-xl animate-pulse w-24"></div>
        </div>
        <div className="h-5 sm:h-[5.5rem] bg-muted rounded animate-pulse"></div>
      </div>
    </Card>
  );
};

interface UnsharedBannerProps {
  /** Counted among the sessions read so far */
  count: number;
  /** The viewer's own sessions aren't all read, so there may be more */
  more: boolean;
  teamName: string;
  /**
   * Held in place while the sessions load, as it last showed: the words are
   * drawn as bars, so it is the size it will be, and nothing in it answers.
   */
  pending: boolean;
  onShare: () => void;
  onDismiss: () => void;
  isDarkMode: boolean;
  className: string;
  dismissClassName: string;
}

/** The viewer's sessions their team can't see, with Share and Not now. */
const UnsharedBanner = ({
  count,
  more,
  teamName,
  pending,
  onShare,
  onDismiss,
  isDarkMode,
  className,
  dismissClassName,
}: UnsharedBannerProps) => {
  /** Words as skeleton bars, one per line they wrap to */
  const bar = pending
    ? 'rounded bg-muted text-transparent animate-pulse [-webkit-box-decoration-break:clone] [box-decoration-break:clone]'
    : undefined;

  return (
    <div
      role={pending ? undefined : 'region'}
      aria-label={pending ? undefined : "Sessions your team can't see"}
      aria-hidden={pending || undefined}
      inert={pending}
      className={`pl-3 pr-1 py-1 sm:pl-4 sm:pr-2 sm:py-2 rounded-xl border flex items-center gap-2 sm:gap-3 ${className}`}
    >
      <Users
        aria-hidden="true"
        className="hidden sm:block h-4 w-4 shrink-0 text-team-blue"
      />
      {/* A sentence that ends in its action on a phone; the action moves
          out to a button of its own from 640px */}
      <p
        className={`flex-1 min-w-0 text-sm font-medium break-words sm:flex sm:items-center sm:gap-3 ${
          isDarkMode ? 'text-gray-100' : 'text-gray-900'
        }`}
      >
        <span className="sm:flex-1">
          <span className={bar}>
            {count}
            {more && '+'} of your sessions{' '}
            {count === 1 && !more ? "isn't" : "aren't"} shared with {teamName}.
          </span>
        </span>{' '}
        <button
          type="button"
          onClick={onShare}
          className={`-my-2 py-2 font-semibold whitespace-nowrap sm:my-0 sm:min-h-11 sm:px-3 sm:rounded-lg sm:border sm:border-team-blue-40 ${
            pending
              ? ''
              : 'text-team-blue underline underline-offset-2 sm:no-underline sm:hover:bg-team-blue/10 sm:transition-colors'
          }`}
        >
          <span className={bar}>Share {count === 1 ? 'it' : 'them'}</span>
        </button>
      </p>
      <button
        type="button"
        onClick={onDismiss}
        className={dismissClassName}
        aria-label="Not now"
        title="Not now"
      >
        <X className={`h-4 w-4 ${pending ? 'invisible' : ''}`} />
      </button>
    </div>
  );
};

const Sessions = () => {
  const { user, isGuest } = useAuth();
  const { isDarkMode } = useTheme();
  const { resetSession, hasActiveSession } = useSessionCore();
  const { team, loading: teamLoading, unconfirmedTeamId } = useTeam();
  const navigate = useNavigate();
  const location = useLocation();
  const navigationType = useNavigationType();
  // A team's list follows the server while the page is open, so teammates'
  // sessions arrive by themselves. Either list is read a page at a time.
  const sessionList = useSessionList({ live: true });
  const {
    sessions,
    sessionsRead,
    loading,
    loadFailed,
    offline,
    hasMore,
    ownUnread,
    loadingOlder,
    olderFailed,
    completeAfter,
    loadOlder,
    loadAll,
    patch: patchSessions,
  } = sessionList;
  const reloadSessions = sessionList.reload;

  // How the list is narrowed and ordered lives in the address, so opening a
  // session and coming Back finds it as it was (and a link can share it).
  // The search box is the one exception while typing: it goes in the
  // address once the typing stops.
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState(
    () => searchParams.get('q') ?? ''
  );
  const searchInAddress = searchParams.get('q') ?? '';
  const selectedMatchType = matchTypeFromParam(searchParams.get('type'));
  /** All, Team or Mine; only offered (and only applied) inside a team */
  const selectedScope = scopeFromParam(searchParams.get('scope'));
  const sortBy = sortFromParam(searchParams.get('sort'));
  /** Which half of the list is on screen: the archived sessions, or the rest */
  const showArchived = searchParams.get('view') === 'archived';

  /** The address this page is on, as the router last showed it */
  const pagePath = location.pathname;

  /**
   * Change some of the list's settings. The page's history entry is
   * replaced, not added to: Back still leaves the page in one press.
   *
   * Nothing is written once the browser's address has moved on. Opening a
   * session or Charts adds its entry at once, but this page stays on screen
   * until the next one has downloaded; a setting written in that moment
   * would replace the new entry with this page's and cancel the trip.
   */
  const updateParams = useCallback(
    (changes: Record<string, string | null>) => {
      if (window.location.pathname !== pagePath) return;
      setSearchParams(
        prev => {
          const next = new URLSearchParams(prev);
          for (const [key, value] of Object.entries(changes)) {
            if (value) next.set(key, value);
            else next.delete(key);
          }
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams, pagePath]
  );
  const setSelectedMatchType = (value: string) =>
    updateParams({ type: matchTypeParam(value) });
  const setSelectedScope = (value: SessionScope) =>
    updateParams({ scope: value === 'all' ? null : value });
  const setSortBy = (value: SortOption) =>
    updateParams({ sort: value === DEFAULT_SORT ? null : value });
  const setShowArchived = (value: boolean) =>
    updateParams({ view: value ? 'archived' : null });

  // The search follows into the address once the typing stops.
  const searchTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    if (searchTerm === searchInAddress) return;
    searchTimer.current = setTimeout(
      () => updateParams({ q: searchTerm }),
      SEARCH_TO_URL_MS
    );
    return () => clearTimeout(searchTimer.current);
  }, [searchTerm, searchInAddress, updateParams]);

  /**
   * Put the search in the address now, before another page is opened, so
   * Back finds it; the write still waiting for the typing to stop is
   * dropped.
   */
  const flushSearch = () => {
    clearTimeout(searchTimer.current);
    if (searchTerm !== searchInAddress) updateParams({ q: searchTerm });
  };

  /** Open another page, taking the search along into this page's entry. */
  const leaveTo = (route: string) => {
    flushSearch();
    // Charts and Compare open on the match type and scope picked here
    const carried = new URLSearchParams();
    for (const key of ['type', 'scope']) {
      const value = searchParams.get(key);
      if (value) carried.set(key, value);
    }
    const query = carried.toString();
    navigate(query ? `${route}?${query}` : route);
  };

  // Coming Back to the list puts it where it was scrolled to, once the
  // sessions are there to scroll past (read as far back as they were). The
  // position is taken as the page goes, before the next page's shorter
  // height can cut it down.
  const [scrollToOnLoad] = useState(() =>
    navigationType === NavigationType.Pop ? savedScroll(location.key) : null
  );
  /** How far back the list has been read, for `rememberScroll` */
  const readThrough = useRef<number | undefined>(undefined);
  useLayoutEffect(() => {
    const historyKey = location.key;
    return () =>
      rememberScroll(historyKey, {
        y: window.scrollY,
        through: readThrough.current,
      });
  }, [location.key]);

  const searchRef = useRef<HTMLInputElement>(null);
  /** The phone's sheet of filters is open */
  const [filtersOpen, setFiltersOpen] = useState(false);
  /** Sessions deleted but still inside their undo window */
  const [hiddenIds, setHiddenIds] = useState(getPendingDeleteIds);
  /** Sessions a guest saved in this browser that the account doesn't have */
  const [guestSessionCount, setGuestSessionCount] = useState(0);
  /** They are being moved into the account: by Import, or by signing up */
  const importingGuestSessions = useSyncExternalStore(
    subscribeGuestImport,
    isImportingGuestSessions
  );
  const [importBannerDismissed, setImportBannerDismissed] = useState(() =>
    readImportDismissed(user?.uid)
  );
  /** Unshared sessions already answered "Not now" to, kept across visits */
  const [unsharedDismissedIds, setUnsharedDismissedIds] = useState<
    ReadonlySet<string>
  >(() => new Set());
  /** Last season's sessions exist: they aren't listed, but can be exported */
  const [hasOlderSeasons, setHasOlderSeasons] = useState(false);
  const [exportingOlder, setExportingOlder] = useState(false);

  const uid = user?.uid;
  const teamId = team?.id;

  // Earlier seasons are left out of the list (their scoring isn't this
  // season's), so say they are still there, and offer them as a CSV.
  useEffect(() => {
    let active = true;
    setHasOlderSeasons(false);
    if (isGuest) {
      setHasOlderSeasons(
        readAllGuestSessions().some(s => s.season !== CURRENT_SEASON)
      );
    } else if (uid) {
      firebaseService
        .hasOlderSeasonSessions(uid, teamId)
        .then(found => {
          if (active) setHasOlderSeasons(found);
        })
        .catch(error => {
          if (!isAbortError(error)) {
            logger.warn('Could not check for older-season sessions', error);
          }
        });
    }
    return () => {
      active = false;
    };
  }, [uid, teamId, isGuest]);

  // Pending deletes outlive this page (see lib/pendingSessionDeletes), so
  // the list follows them rather than keeping its own.
  useEffect(() => {
    const sync = () => setHiddenIds(getPendingDeleteIds());
    sync();
    return subscribePendingDeletes(sync);
  }, []);

  useEffect(() => {
    document.title = `${showArchived ? 'Archived sessions' : 'Sessions'} - ${APP_CONFIG.name}`;
  }, [showArchived]);

  // Sessions recorded as a guest stay in this browser when the guest signs
  // in; offer to bring them into the account (signing up brings them in by
  // itself). Counted again whenever a delete the guest left waiting is
  // finished or undone, and once a move into the account has finished,
  // which also puts them in the list: each lands at the date it was
  // recorded, anywhere in it (and, in a team, below the part that updates
  // by itself), so the list is read again from the top.
  useEffect(() => {
    if (!uid || isGuest) {
      setGuestSessionCount(0);
      return;
    }
    const recount = () =>
      setGuestSessionCount(importableGuestSessions().length);
    recount();
    const stopDeletes = subscribePendingDeletes(recount);
    const stopImports = subscribeGuestImport(() => {
      recount();
      if (!isImportingGuestSessions()) reloadSessions();
    });
    return () => {
      stopDeletes();
      stopImports();
    };
  }, [uid, isGuest, reloadSessions]);

  useEffect(() => {
    setImportBannerDismissed(readImportDismissed(uid));
  }, [uid]);

  /** Every loaded session except ones waiting out their undo window */
  const visibleSessions = useMemo(
    () => sessions.filter(session => !hiddenIds.has(session.id)),
    [sessions, hiddenIds]
  );

  const filters = useMemo<SessionListFilters>(
    () => ({
      searchTerm,
      matchType: selectedMatchType,
      scope: teamId ? selectedScope : 'all',
    }),
    [searchTerm, selectedMatchType, selectedScope, teamId]
  );

  const filtersActive = hasActiveFilters(filters);

  /** Whose archive counts: a session is archived only for its author. */
  const viewer = useMemo(() => ({ uid, isGuest }), [uid, isGuest]);

  /** The viewer's own archived sessions, in the scope on screen */
  const archivedCount = useMemo(
    () =>
      visibleSessions.filter(
        session =>
          archivedFor(session, viewer) &&
          inSessionScope(session, filters.scope, { teamId, uid })
      ).length,
    [visibleSessions, viewer, filters.scope, teamId, uid]
  );

  /**
   * The sessions of the view on screen: the archived ones under Archived,
   * the rest otherwise, whatever the search and filter say. Everything
   * below (the cards, Quick Stats, the export) starts here.
   */
  const viewSessions = useMemo(
    () => inArchiveView(visibleSessions, showArchived, viewer),
    [visibleSessions, showArchived, viewer]
  );

  /**
   * The sessions the list shows, in the chosen order. Ordered as their
   * cards show them: under a one-type filter by that type's matches alone,
   * so the scores and counts they are sorted by are the ones on the cards.
   */
  const filteredSessions = useMemo(
    () =>
      sortShown(
        filterSessions(viewSessions, filters, { teamId, uid }),
        filters.matchType,
        sortBy
      ),
    [viewSessions, filters, teamId, uid, sortBy]
  );

  /**
   * The view is empty only because of which half it shows: nothing archived
   * yet, or everything archived. The way out is the other view, not a new
   * session.
   */
  const archiveEmpty = showArchived || archivedCount > 0;

  /**
   * The list is read a page at a time, newest first. Every active session,
   * newest first, is shown as far as it has been read, with Show older
   * sessions at the end. A search, a filter, another order or the archive
   * would only cover part of the sessions, so they read the rest first.
   */
  const needsAll = filtersActive || showArchived || sortBy !== DEFAULT_SORT;
  /** None of what has been read is shown: older pages may hold some */
  const noneShown = filteredSessions.length === 0;
  useEffect(() => {
    if (loading || loadingOlder || olderFailed || !hasMore) return;
    if (needsAll) void loadAll();
    else if (noneShown) void loadOlder();
  }, [
    loading,
    loadingOlder,
    olderFailed,
    hasMore,
    needsAll,
    noneShown,
    loadAll,
    loadOlder,
  ]);

  /** Read on from the end of the list: a page, or all for a view that needs it */
  const showOlder = () => void (needsAll ? loadAll() : loadOlder());

  useEffect(() => {
    readThrough.current = loading
      ? undefined
      : hasMore && completeAfter
        ? completeAfter.getTime()
        : 0;
  }, [loading, hasMore, completeAfter]);
  /** Back has come to a list read further back than its first page */
  const restoreThrough = scrollToOnLoad?.through;
  const readFarEnough =
    restoreThrough === undefined ||
    !hasMore ||
    olderFailed ||
    (restoreThrough > 0 &&
      !!completeAfter &&
      completeAfter.getTime() <= restoreThrough);
  const restoring = scrollToOnLoad !== null && !readFarEnough;
  useEffect(() => {
    if (!restoring || loading || loadingOlder) return;
    void (restoreThrough === 0 ? loadAll() : loadOlder());
  }, [restoring, loading, loadingOlder, restoreThrough, loadAll, loadOlder]);

  const clearFilters = () => {
    setSearchTerm('');
    updateParams({ q: null, type: null, scope: null });
  };

  /**
   * The settings the phone keeps in its Filters sheet that are not at their
   * defaults: the count on the Filters button.
   */
  const settingsChanged = [
    selectedMatchType !== ALL_MATCH_TYPES,
    sortBy !== DEFAULT_SORT,
    showArchived,
    !!teamId && selectedScope !== 'all',
  ].filter(Boolean).length;

  const resetSettings = () =>
    updateParams({ type: null, sort: null, view: null, scope: null });

  /**
   * Quick Stats, over exactly the sessions the list is showing: archived
   * ones count under Archived, and still count on Charts and Compare.
   */
  const quickStats = useMemo(
    () => quickStatsOf(filteredSessions, filters.matchType),
    [filteredSessions, filters.matchType]
  );

  /** A filter that names one match type, so cards count only those matches */
  const oneTypeFiltered = oneMatchTypeLabel(filters.matchType) !== undefined;

  /**
   * Quick Stats over one card would repeat it figure for figure (under a
   * one-type filter too: the card then counts the same matches), so it
   * takes two.
   */
  const showQuickStats = filteredSessions.length >= 2;

  /**
   * Each card as the list shows it: under a one-type filter with just the
   * matches of that type, so its Best, average and count agree with Quick
   * Stats; archived only if the viewer archived it.
   */
  const cards = useMemo(
    () =>
      filteredSessions.map(session => {
        const shown = withCountedMatches(session, filters.matchType);
        const archived = archivedFor(session, viewer);
        return {
          session,
          shown:
            archived === isArchived(session) ? shown : { ...shown, archived },
        };
      }),
    [filteredSessions, filters.matchType, viewer]
  );

  /**
   * The viewer's own sessions that no team can see. A team's list only ever
   * adds the viewer's own to what is filed under the team; one still filed
   * under a team they left stays with that team, so it isn't offered.
   * Archived ones are put away, so they aren't asked about. Counted over
   * every session read, as Share them offers them all: one dated below the
   * team's part of the list read so far isn't on screen yet, but it is
   * unshared.
   */
  const unsharedIds = useMemo(
    () =>
      teamId
        ? sessionsRead
            .filter(
              session =>
                !session.teamId &&
                !archivedFor(session, viewer) &&
                !hiddenIds.has(session.id)
            )
            .map(session => session.id)
        : [],
    [sessionsRead, teamId, viewer, hiddenIds]
  );
  const unsharedCount = unsharedIds.length;
  const unsharedBannerDismissed = unsharedIds.every(id =>
    unsharedDismissedIds.has(id)
  );
  const unsharedBannerShown =
    !!team && !loading && unsharedCount > 0 && !unsharedBannerDismissed;

  // While the list loads, its stand-ins take the room the list took the
  // last time it loaded here, so it doesn't jump when the sessions arrive.
  const viewName = showArchived ? 'archived' : 'active';
  const shownKey = listKey(
    viewName,
    filters.scope,
    filters.matchType,
    filters.searchTerm
  );
  const plainKey = listKey(viewName, 'all', ALL_MATCH_TYPES, '');
  const lastLayout = useMemo(
    () => (uid && !isGuest ? readListLayout(uid, teamId ?? null) : null),
    [uid, teamId, isGuest]
  );
  /** Sessions the loading list will most likely show, if anything says */
  const expectedShown = loading
    ? expectedCount(lastLayout, shownKey, plainKey)
    : undefined;
  /** The unshared banner as it last showed, held in place while loading */
  const pendingUnshared = loading && team ? lastLayout?.unshared : undefined;
  /** Quick Stats' line about older sessions, held in place while loading */
  const pendingMore = loading && !needsAll && !!lastLayout?.more;
  /** Whether the first page left older sessions to read, on this visit */
  const firstPageMore = useRef<boolean | null>(null);
  useEffect(() => {
    if (loading) firstPageMore.current = null;
    else if (firstPageMore.current === null) firstPageMore.current = hasMore;
  }, [loading, hasMore]);

  // Remember how the list came out once it has, the search has settled
  // into the address and it is known whether there's a team, for the next
  // visit's stand-ins.
  const settledKey = searchTerm === searchInAddress ? shownKey : null;
  const shownCount = filteredSessions.length;
  const teamName = team?.name;
  useEffect(() => {
    if (
      loading ||
      loadFailed ||
      teamLoading ||
      !uid ||
      isGuest ||
      settledKey === null
    ) {
      return;
    }
    const others = (readListLayout(uid, teamId ?? null)?.shown ?? []).filter(
      ([key]) => key !== settledKey
    );
    writeListLayout({
      uid,
      teamId: teamId ?? null,
      unshared:
        unsharedBannerShown && teamName
          ? { count: unsharedCount, teamName }
          : null,
      shown: [...others, [settledKey, shownCount]],
      // What the next visit opens on: the first page, whatever was read since
      more: firstPageMore.current ?? hasMore,
    });
  }, [
    loading,
    loadFailed,
    teamLoading,
    uid,
    isGuest,
    teamId,
    teamName,
    settledKey,
    shownCount,
    unsharedBannerShown,
    unsharedCount,
    hasMore,
  ]);

  const scrollRestored = useRef(false);
  useLayoutEffect(() => {
    if (loading || restoring || scrollRestored.current) return;
    scrollRestored.current = true;
    if (scrollToOnLoad !== null) window.scrollTo(0, scrollToOnLoad.y);
  }, [loading, restoring, scrollToOnLoad]);

  useEffect(() => {
    setUnsharedDismissedIds(
      uid && teamId ? readUnsharedDismissed(uid, teamId) : new Set()
    );
  }, [uid, teamId]);

  const dismissUnsharedBanner = () => {
    setUnsharedDismissedIds(new Set(unsharedIds));
    if (uid && teamId) writeUnsharedDismissed(uid, teamId, unsharedIds);
  };

  /** Whether a session is filed under the viewer's team (see teamFiling) */
  const filingOf = (session: Session) =>
    isGuest
      ? 'here'
      : teamFiling(session, { teamId, teamLoading, unconfirmedTeamId });

  /**
   * A session of the viewer's that stays with a team they are no longer in
   * (left, or removed): view-only for them, as the rules have it. Its card
   * says so, and under which team.
   */
  const filedElsewhere = (session: Session): boolean =>
    filingOf(session) === 'elsewhere';

  /**
   * The author of a session (and a guest, of their own) can rename it,
   * unless it stays with a team they have left, or may have (their team
   * can't be checked just now).
   */
  const canRename = (session: Session): boolean =>
    isGuest ||
    (!!uid && session.userId === uid && filingOf(session) === 'here');

  /**
   * Archiving is an edit like renaming, so the same people can do it: the
   * Firestore rules let nobody but the author update a session.
   */
  const canArchive = canRename;

  /**
   * The author can delete a session (one that stays with a team they left
   * too), and so can the owner of the team it is filed under — the same two
   * people the Firestore rules allow.
   */
  const canDelete = (session: Session): boolean =>
    isGuest ||
    (!!uid && session.userId === uid) ||
    (!!uid &&
      !!team &&
      session.teamId === team.id &&
      teamService.ownerOf(team) === uid);

  const handleUpdateSessionName = async (
    sessionId: string,
    newName: string
  ) => {
    const originalName = sessions.find(s => s.id === sessionId)?.sessionName;

    try {
      patchSessions(prevSessions =>
        prevSessions.map(session =>
          session.id === sessionId
            ? { ...session, sessionName: newName }
            : session
        )
      );

      let success: boolean;
      if (isGuestSessionId(sessionId)) {
        writeGuestSessions(
          readGuestSessions().map(s =>
            s.id === sessionId ? { ...s, sessionName: newName } : s
          )
        );
        success = true;
      } else {
        success = await firebaseService.updateSession(sessionId, {
          sessionName: newName,
        });
      }

      if (!success) {
        patchSessions(prevSessions =>
          prevSessions.map(session =>
            session.id === sessionId
              ? { ...session, sessionName: originalName || newName }
              : session
          )
        );
        toast.error('Failed to update session name');
      } else {
        toast.success('Session name updated');
      }
    } catch (error) {
      logger.error('Error updating session name', error);
      patchSessions(prevSessions =>
        prevSessions.map(session =>
          session.id === sessionId
            ? { ...session, sessionName: originalName || newName }
            : session
        )
      );
      toast.error('Failed to update session name');
    }
  };

  /**
   * Hide the session straight away, but only delete it for real once the
   * undo window has passed.
   */
  const handleDeleteSession = (sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;
    scheduleSessionDelete(session, isGuest ? null : (uid ?? null));
  };

  /**
   * Archive a session, or bring it back. The card moves to the other view
   * at once and moves back if the change couldn't be saved.
   */
  const handleToggleArchive = async (
    sessionId: string,
    archived: boolean,
    isUndo = false
  ) => {
    const setArchived = (value: boolean) =>
      patchSessions(prev =>
        prev.map(session =>
          session.id === sessionId ? { ...session, archived: value } : session
        )
      );

    setArchived(archived);
    try {
      if (isGuestSessionId(sessionId)) {
        writeGuestSessions(
          readGuestSessions().map(session =>
            session.id === sessionId ? { ...session, archived } : session
          )
        );
      } else if (
        !(await firebaseService.updateSession(sessionId, { archived }))
      ) {
        throw new Error('Session was not updated');
      }
    } catch (error) {
      logger.error('Error archiving session', error);
      setArchived(!archived);
      toast.error(`Failed to ${archived ? 'archive' : 'unarchive'} session`);
      return;
    }

    toast.success(
      archived ? 'Session archived' : 'Session unarchived',
      isUndo
        ? undefined
        : {
            duration: UI_TIMING.UNDO_WINDOW,
            action: {
              label: 'Undo',
              onClick: () => handleToggleArchive(sessionId, !archived, true),
            },
          }
    );
  };

  const handleShareSession = async (session: Session) => {
    try {
      const shareLink = await generateShareableLink(session);
      // A plain confirmation: taking links down is done from the session
      // itself (Analysis) or the account's share links, never a tap away
      // from the button that just made one.
      await copyShareLink(shareLink, () =>
        toast.success('Share link copied', {
          description:
            'Shows the session as it is now. Copy again after edits.',
        })
      );
    } catch (error) {
      logger.error('Error sharing session', error);
      toast.error('Failed to generate share link');
    }
  };

  /**
   * Copy the sessions this browser saved for a guest into the signed-in
   * account, as personal sessions (see lib/guestImport: nothing leaves this
   * browser until the account has it). The list is read again once it is
   * done (see the effect above).
   */
  const handleImportGuestSessions = async () => {
    if (!uid || importingGuestSessions) return;
    const { imported, failed } = await importGuestSessions(
      uid,
      user?.email ?? null
    );
    if (imported > 0) {
      toast.success(`Imported ${plural(imported, 'session')}`);
    }
    if (failed > 0) {
      toast.error(`Couldn't import ${plural(failed, 'session')}`, {
        description: `${failed === 1 ? "It's" : "They're"} still in this browser. Try again.`,
      });
    }
  };

  /** "Not now": for this visit; the offer is back next time */
  const dismissImport = () => {
    setImportBannerDismissed(true);
    if (uid) writeImportDismissed(uid);
  };

  /**
   * Who recorded a teammate's session, for its card. The viewer's own have
   * no name on them: a card without one is yours, and Mine lists them.
   */
  const getSessionOwnerName = (session: Session): string | undefined => {
    if (!team || session.userId === uid) return undefined;
    const member = team.members.find(m => m.userId === session.userId);
    return (
      member?.displayName || member?.email || session.userEmail || undefined
    );
  };

  /**
   * Download `toExport` as one CSV and say how much went into it. Under a
   * filter that names one match type (`matchType`), only the matches of that
   * type go in, the ones Quick Stats counts. `narrowed` says the list on
   * screen is being exported, not the whole view, and the file is named
   * for what narrowed it.
   */
  const exportSessions = (
    toExport: Session[],
    matchType: string = ALL_MATCH_TYPES,
    narrowed = false
  ) => {
    if (toExport.length === 0) {
      toast.error('No sessions to export');
      return;
    }

    const exported = sessionsToExport(toExport, matchType);
    downloadCsv(
      csvFileName(exportFileBase(filters, showArchived, narrowed)),
      buildSessionsCsv(exported)
    );
    const matchCount = matchCountOf(exported);
    const type = oneMatchTypeLabel(matchType);
    const match = type ? `${type} match` : 'match';
    toast.success(
      `Exported ${plural(exported.length, 'session')} (${plural(matchCount, match, `${match}es`)})`
    );
  };

  /**
   * Export what the list shows (`narrowed`) or the whole view, of every
   * session: the ones not read yet are read first, so a file never stops
   * at the oldest one on screen.
   */
  const [exporting, setExporting] = useState(false);
  const exportView = async (narrowed: boolean) => {
    if (exporting) return;
    let everySession = visibleSessions;
    if (hasMore) {
      setExporting(true);
      const all = await loadAll();
      setExporting(false);
      if (!all) return;
      const pendingIds = getPendingDeleteIds();
      everySession = all.filter(session => !pendingIds.has(session.id));
    }
    // Rows follow the order on screen (see filteredSessions)
    const view = inArchiveView(everySession, showArchived, viewer);
    if (narrowed) {
      exportSessions(
        sortShown(
          filterSessions(view, filters, { teamId, uid }),
          filters.matchType,
          sortBy
        ),
        filters.matchType,
        true
      );
    } else {
      exportSessions(sortShown(view, ALL_MATCH_TYPES, sortBy));
    }
  };

  /**
   * Export follows the list: when a search, filter or scope leaves anything
   * out (a session, or under a one-type filter a match of another type), the
   * button exports what is shown (and what Quick Stats counts) and says
   * which part that is, and every session of the view is one more choice
   * away. Plain "Export" always writes the whole view: every active session,
   * or under Archived every archived one, older ones not on screen yet
   * included. Rows follow the order on screen.
   */
  const canExport = viewSessions.length > 0;
  const sessionsLeftOut = filteredSessions.length < viewSessions.length;
  const exportsShown =
    filtersActive &&
    filteredSessions.length > 0 &&
    (sessionsLeftOut ||
      matchCountOf(sessionsToExport(filteredSessions, filters.matchType)) <
        matchCountOf(viewSessions));
  /** Every session is shown: the one-type filter only leaves matches out */
  const exportsOneType = exportsShown && !sessionsLeftOut && oneTypeFiltered;
  const exportLabel = exportsShown
    ? sessionsLeftOut
      ? `Export ${filteredSessions.length} shown`
      : exportsOneType
        ? `Export ${oneMatchTypeLabel(filters.matchType)} only`
        : 'Export shown'
    : canExport && filtersActive && filteredSessions.length === 0
      ? hasMore
        ? 'Export all'
        : `Export all ${viewSessions.length}`
      : 'Export';

  /** Export last season's sessions, in that season's columns. */
  const handleExportOlderSeasons = async () => {
    setExportingOlder(true);
    try {
      const older = isGuest
        ? readAllGuestSessions().filter(s => s.season !== CURRENT_SEASON)
        : uid
          ? await firebaseService.getOlderSeasonSessions(uid, teamId)
          : [];
      if (older.length === 0) {
        toast.info('No sessions from earlier seasons to export');
        return;
      }
      downloadCsv(
        csvFileName(`${LEGACY_SEASON}-sessions-export`),
        buildLegacySessionsCsv(older)
      );
      toast.success(
        `Exported ${older.length} ${LEGACY_SEASON.toUpperCase()} session${older.length === 1 ? '' : 's'} to CSV`
      );
    } catch (error) {
      if (isAbortError(error)) return;
      logger.error('Error exporting older-season sessions', error);
      toast.error("Couldn't export last season's sessions. Please try again.");
    } finally {
      setExportingOlder(false);
    }
  };

  const hasSessions = visibleSessions.length > 0;
  /**
   * The banner offering this browser's guest sessions: its Import is the
   * page's one filled button while it shows. Also up while they are being
   * moved in (by signing up, say), to say so.
   */
  const importOffered =
    !isGuest &&
    guestSessionCount > 0 &&
    (importingGuestSessions || !importBannerDismissed);
  /** Safari erases an unvisited site's storage after a week */
  const [safariErases] = useState(safariMayEraseStorage);
  /** Only the Team / Mine scope is narrowing the view */
  const scopeOnly =
    filters.scope !== 'all' &&
    filters.searchTerm.trim() === '' &&
    filters.matchType === ALL_MATCH_TYPES;

  const headingText = 'text-foreground';
  const mutedText = isDarkMode ? 'text-gray-300' : 'text-gray-600';
  /** The colour of the search field's icons: the magnifier and the clear */
  const fieldIcon = isDarkMode ? 'text-team-white-60' : 'text-gray-500';
  const outlineButton = `border border-team-blue hover:bg-team-blue/10 transition-colors text-xs sm:text-sm md:text-base px-2.5 sm:px-3 py-2 min-h-11 flex items-center gap-1 sm:gap-1.5 text-team-blue border-team-blue-40`;
  /** Search, the selects and the view toggle: one field look */
  const fieldTone = isDarkMode
    ? 'bg-team-dark border-team-blue-40 text-white'
    : 'bg-white border-gray-200 text-gray-900';
  const countBadge = `${CHIP_BASE} ${CHIP_SIZES.sm} min-w-[1.25rem] justify-center tabular-nums bg-team-blue/15 ring-team-blue/40 ${
    isDarkMode ? 'text-white' : 'text-gray-900'
  }`;
  /** Stand-in for a control while the sessions load: same size, no jump */
  const placeholder = 'h-11 rounded-lg bg-muted animate-pulse';

  const typeSelect = (className: string) => (
    <Select value={selectedMatchType} onValueChange={setSelectedMatchType}>
      <SelectTrigger
        aria-label="Filter by match type"
        className={`h-11 text-sm md:text-base rounded-xl shadow-sm border ${fieldTone} ${className}`}
      >
        <SelectValue placeholder="All match types" />
      </SelectTrigger>
      <SelectContent
        className={`${isDarkMode ? 'bg-team-dark border-team-blue-40' : 'bg-white border-gray-200'}`}
      >
        <SelectItem value={ALL_MATCH_TYPES}>All match types</SelectItem>
        {MATCH_TYPE_FILTERS.map(({ value, label }) => (
          <SelectItem key={value} value={value}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  const sortSelect = (className: string) => (
    <Select
      value={sortBy}
      onValueChange={value => setSortBy(value as SortOption)}
    >
      <SelectTrigger
        aria-label="Sort sessions"
        className={`h-11 text-sm md:text-base rounded-xl shadow-sm border ${fieldTone} ${className}`}
      >
        {/* A div: the trigger clamps a span child to one line, which
            would stack the icon over the label */}
        <div className="flex min-w-0 items-center gap-2">
          <ArrowUpDown
            aria-hidden="true"
            className="h-4 w-4 shrink-0 opacity-70"
          />
          <span className="truncate">
            <SelectValue placeholder="Sort" />
          </span>
        </div>
      </SelectTrigger>
      <SelectContent
        className={`${isDarkMode ? 'bg-team-dark border-team-blue-40' : 'bg-white border-gray-200'}`}
      >
        {(Object.keys(SORT_LABELS) as SortOption[]).map(option => (
          <SelectItem key={option} value={option}>
            {SORT_LABELS[option]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  const scopeControl = (className: string, fill = false) => (
    <Segmented
      label="Whose sessions to show"
      value={filters.scope}
      options={SESSION_SCOPES}
      onChange={setSelectedScope}
      isDarkMode={isDarkMode}
      size="md"
      fill={fill}
      className={className}
    />
  );
  const bannerTone = isDarkMode
    ? 'bg-team-blue/10 border-team-blue-40'
    : 'bg-team-blue/5 border-team-blue/40';
  const dismissButton = `inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg hover:bg-team-blue/20 transition-colors disabled:opacity-50 [@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:min-w-11 ${
    isDarkMode ? 'text-team-white-60' : 'text-gray-500'
  }`;

  return (
    <div
      className={`min-h-[100dvh] page-transition ${isDarkMode ? 'bg-team-dark' : 'bg-[#FEFEFE]'}`}
    >
      <div className="max-w-[1152px] mx-auto px-2 sm:px-3 md:px-4 lg:px-6 xl:px-8 py-4 sm:py-6 md:py-8 lg:py-12">
        <div className="mb-4 sm:mb-6 flex flex-col gap-3">
          {/* From 640px the title and the page's actions share a row. On a
              phone the title has a row of its own, the height of a toast,
              which drops in over it there: the actions below stay clear.
              Export sits at the row's end and grows into the space before
              it when it reads "Export 2 shown" or "Export Autonomous only",
              so typing a search never wraps the row and pushes the search
              field down; the icons are left out on a phone to make that
              room, and under 360px Export is its icon alone. While the
              sessions load, stand-ins hold the row's height. */}
          <div className="flex flex-wrap items-center gap-x-1.5 sm:gap-x-2 md:gap-x-3 gap-y-2">
            <h1
              className={`w-full sm:w-auto sm:mr-auto min-h-11 sm:min-h-0 flex items-center ${PAGE_TITLE_CLASS}`}
            >
              {showArchived ? 'Archived sessions' : 'Sessions'}
            </h1>
            {loading && (
              <>
                <div
                  aria-hidden="true"
                  className={`${placeholder} w-[4.25rem] sm:w-24`}
                />
                <div
                  aria-hidden="true"
                  className={`${placeholder} w-[5.25rem] sm:w-28`}
                />
                <div
                  aria-hidden="true"
                  className={`${placeholder} w-[4.25rem] sm:w-24 ml-auto sm:ml-0`}
                />
              </>
            )}
            {!loading && hasSessions && (
              <Button
                onClick={() => leaveTo(ROUTES.CHARTS)}
                className={outlineButton}
                variant="outline"
              >
                <TrendingUp className="max-sm:hidden" />
                Charts
              </Button>
            )}
            {!loading && visibleSessions.length > 1 && (
              <Button
                onClick={() => leaveTo(ROUTES.COMPARE)}
                className={outlineButton}
                variant="outline"
              >
                <BarChart3 className="max-sm:hidden" />
                Compare
              </Button>
            )}
            {!loading && canExport && (
              <div className="flex ml-auto sm:ml-0">
                <Button
                  onClick={() => void exportView(exportsShown)}
                  disabled={exporting}
                  className={`${outlineButton} max-[359px]:min-w-11 max-[359px]:justify-center ${exportsShown ? 'rounded-r-none' : ''}`}
                  variant="outline"
                >
                  {/* Under 390px "Export Autonomous only" gives its first
                      word to the icon, so the row still holds it at 360 */}
                  <Download
                    aria-hidden="true"
                    className={
                      exportsOneType
                        ? 'min-[390px]:max-sm:hidden'
                        : 'min-[360px]:max-sm:hidden'
                    }
                  />
                  <span className="max-[359px]:sr-only">
                    {exportsOneType ? (
                      <>
                        <span className="max-[389px]:sr-only">Export </span>
                        {oneMatchTypeLabel(filters.matchType)} only
                      </>
                    ) : (
                      exportLabel
                    )}
                  </span>
                </Button>
                {exportsShown && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        aria-label="More export options"
                        className={`${outlineButton} -ml-px rounded-l-none px-2 sm:px-2 [@media(pointer:coarse)]:min-w-11`}
                        variant="outline"
                      >
                        <ChevronDown />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onSelect={() => void exportView(false)}
                        className="flex items-center gap-2 cursor-pointer [@media(pointer:coarse)]:min-h-11"
                      >
                        <Download className="h-4 w-4" />
                        <span>
                          {hasMore
                            ? 'Export all'
                            : `Export all ${viewSessions.length}`}
                        </span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            )}
          </div>
          {/* One TeamManager in one place, so its dialogs (and the share
              step after joining) outlive a change of team; they open over
              the page wherever the row itself is. In a team the row is the
              team pill and Invite, left out on a phone, where the account
              menu opens the team. Without one it is Create team and Join
              team, outlined, as soon as it is known there is no team. From
              640px either one shows, so a stand-in holds the row's place
              until then. */}
          {!isGuest && teamLoading && (
            <div
              aria-hidden="true"
              className={`${placeholder} max-sm:hidden w-64 rounded-xl`}
            />
          )}
          {!isGuest && (
            <div
              className={
                teamLoading ? 'hidden' : team ? 'max-sm:hidden' : undefined
              }
            >
              <TeamManager
                // Sessions shared with the team move from one query of the
                // list to the other, at their own dates, which can be below
                // the part that updates by itself: read it again.
                onTeamChange={reloadSessions}
              />
            </div>
          )}
        </div>

        {isGuest && !loading && hasSessions && (
          <p
            role="note"
            className={`mb-4 px-3 py-2 rounded-xl border flex items-center gap-2 text-xs sm:text-sm ${bannerTone} ${
              isDarkMode ? 'text-gray-100' : 'text-gray-900'
            }`}
          >
            <Smartphone aria-hidden="true" className="h-4 w-4 shrink-0" />
            <span>
              Saved only in this browser
              {safariErases &&
                `, and Safari can erase ${visibleSessions.length === 1 ? 'it' : 'them'} after a week unused`}
              .{' '}
              <Link
                to={ROUTES.SIGNUP}
                className="inline-block -my-3 py-3 font-semibold text-team-blue underline underline-offset-2"
              >
                Sign up to keep {visibleSessions.length === 1 ? 'it' : 'them'}
              </Link>
            </span>
          </p>
        )}

        {importOffered && (
          <div
            role="region"
            aria-label="Sessions saved in this browser"
            aria-busy={importingGuestSessions || undefined}
            className={`mb-4 sm:mb-6 p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center gap-3 ${bannerTone}`}
          >
            <div className="flex-1 min-w-0">
              <p className={`font-semibold ${headingText}`}>
                {importingGuestSessions
                  ? `Moving ${plural(guestSessionCount, 'session')} from this browser into your account...`
                  : `Import ${plural(guestSessionCount, 'session')} from this browser`}
              </p>
              <p className={`text-sm ${mutedText}`}>
                {importingGuestSessions
                  ? `${guestSessionCount === 1 ? 'It shows' : 'They show'} up here once ${guestSessionCount === 1 ? "it's" : "they're"} in.`
                  : `Recorded here before you signed in. ${guestSessionCount === 1 ? "It isn't" : "They aren't"} in this account yet.`}
              </p>
            </div>
            {!importingGuestSessions && (
              <div className="flex items-center gap-2 flex-shrink-0">
                <Button
                  variant="neutral"
                  size="touch"
                  onClick={dismissImport}
                  className="max-sm:flex-1"
                >
                  Not now
                </Button>
                <Button
                  variant="primary"
                  size="touch"
                  onClick={handleImportGuestSessions}
                  data-page-primary
                  className="max-sm:flex-1"
                >
                  <Upload />
                  Import
                </Button>
              </div>
            )}
          </div>
        )}

        {/* The list as it last loaded, while the server can't be reached */}
        {offline && !loadFailed && !loading && (
          <p
            role="status"
            className={`mb-4 px-3 py-2 rounded-xl border flex items-center gap-2 text-xs sm:text-sm ${bannerTone} ${
              isDarkMode ? 'text-gray-100' : 'text-gray-900'
            }`}
          >
            <CloudOff aria-hidden="true" className="h-4 w-4 shrink-0" />
            You're offline. These are your sessions as they last loaded, and
            they update once you're back online.
          </p>
        )}

        {team && (unsharedBannerShown || pendingUnshared) && (
          <UnsharedBanner
            count={pendingUnshared ? pendingUnshared.count : unsharedCount}
            more={!pendingUnshared && ownUnread}
            teamName={team.name}
            pending={!!pendingUnshared}
            onShare={() =>
              window.dispatchEvent(new Event(OPEN_SHARE_SESSIONS_EVENT))
            }
            onDismiss={dismissUnsharedBanner}
            isDarkMode={isDarkMode}
            className={`mb-4 ${bannerTone}`}
            dismissClassName={dismissButton}
          />
        )}

        {/* Search, filter, order, view and scope sit above everything they
            narrow: Quick Stats, the cards and the export. On a phone the
            search shares its row with one Filters button, and the rest wait
            in a sheet; from 768px they share the search's row, with the
            scope (in a team) on a row of its own until 1280px. The sort's
            width never follows its label, so picking an order never moves
            anything. */}
        {(loading || hasSessions) && (
          <div
            className={`mb-4 sm:mb-6 flex flex-col gap-2 sm:gap-3 ${team ? 'xl:flex-row' : ''}`}
          >
            <div className="flex flex-1 min-w-0 gap-2 sm:gap-3">
              <div className="flex-1 min-w-0 relative">
                <Search
                  aria-hidden="true"
                  className={`pointer-events-none absolute left-3 md:left-4 top-1/2 -translate-y-1/2 h-4 w-4 ${fieldIcon}`}
                />
                <Input
                  ref={searchRef}
                  type="search"
                  aria-label="Search sessions"
                  placeholder="Search"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  // The browser's own clear button is drawn in its own
                  // colours; the one below follows the theme.
                  className={`pl-10 md:pl-12 h-11 text-base md:text-base rounded-xl shadow-sm transition-all duration-200 focus:shadow-md [&::-webkit-search-cancel-button]:appearance-none ${
                    searchTerm ? 'pr-11' : ''
                  } ${
                    isDarkMode
                      ? 'bg-team-dark-20 border-team-blue-40 text-white placeholder-team-white-40 focus:border-team-blue'
                      : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-team-blue'
                  }`}
                />
                {searchTerm && (
                  <button
                    type="button"
                    aria-label="Clear search"
                    onClick={() => {
                      setSearchTerm('');
                      updateParams({ q: null });
                      searchRef.current?.focus();
                    }}
                    className={`absolute right-0 top-1/2 -translate-y-1/2 h-11 w-11 inline-flex items-center justify-center rounded-xl transition-colors hover:text-team-blue ${fieldIcon}`}
                  >
                    <X aria-hidden="true" className="h-4 w-4" />
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => setFiltersOpen(true)}
                aria-haspopup="dialog"
                aria-expanded={filtersOpen}
                className={`md:hidden h-11 shrink-0 inline-flex items-center gap-1.5 rounded-xl border px-3 text-sm font-medium shadow-sm transition-colors hover:border-team-blue ${fieldTone}`}
              >
                <SlidersHorizontal aria-hidden="true" className="h-4 w-4" />
                Filters
                {settingsChanged > 0 && (
                  <>
                    <span aria-hidden="true" className={countBadge}>
                      {settingsChanged}
                    </span>
                    <span className="sr-only">, {settingsChanged} on</span>
                  </>
                )}
              </button>
              <div className="hidden md:flex shrink-0 gap-3">
                {typeSelect('w-44 lg:w-[180px]')}
                {sortSelect('w-[11.5rem]')}
                {/* One width in both views, so neither the count arriving
                    nor the label changing moves the search */}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowArchived(!showArchived)}
                  className={`h-11 w-[9.75rem] shrink-0 rounded-xl shadow-sm text-sm md:text-base px-3 gap-1.5 hover:text-current ${fieldTone}`}
                >
                  {showArchived ? (
                    <>
                      <ArrowLeft aria-hidden="true" />
                      Back to active
                    </>
                  ) : (
                    <>
                      <Archive aria-hidden="true" />
                      Archived
                      {archivedCount > 0 && (
                        <span
                          data-testid="archived-count"
                          className={countBadge}
                        >
                          {/* Counted among the sessions read so far */}
                          {archivedCount}
                          {hasMore && '+'}
                        </span>
                      )}
                    </>
                  )}
                </Button>
              </div>
            </div>
            {team &&
              scopeControl(
                // As tall as the fields beside it; on a touch screen the
                // options alone are 44px
                'max-md:hidden self-start h-11 p-0.5 [@media(pointer:coarse)]:p-0'
              )}
          </div>
        )}

        <Dialog open={filtersOpen} onOpenChange={setFiltersOpen}>
          {/* A sheet from the bottom edge on a phone, a small dialog from
              640px: the backdrop centres it and pads it by 1rem. */}
          <DialogContent
            className={`self-end -mx-4 -mb-4 w-[calc(100%+2rem)] max-w-none max-h-[85dvh] overflow-y-auto rounded-b-none border slide-in-from-bottom-8 sm:self-center sm:m-0 sm:w-full sm:max-w-md sm:rounded-b-2xl ${
              isDarkMode
                ? 'bg-team-dark border-team-blue-40'
                : 'bg-white border-gray-200'
            }`}
          >
            {/* Takes the focus first, so no field opens with a ring */}
            <DialogHeader
              tabIndex={-1}
              data-autofocus
              className={`flex items-center justify-between gap-3 py-2 pl-5 pr-2 outline-none ${
                isDarkMode ? 'border-team-blue-40' : 'border-gray-200'
              }`}
            >
              <DialogTitle className={headingText}>Filters</DialogTitle>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setFiltersOpen(false)}
                className={dismissButton}
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </button>
            </DialogHeader>
            <div className="flex flex-col gap-4 px-5 py-4">
              <div className="flex flex-col gap-1.5">
                <p className={EYEBROW_CLASS}>Match type</p>
                {typeSelect('w-full')}
              </div>
              <div className="flex flex-col gap-1.5">
                <p className={EYEBROW_CLASS}>Sort</p>
                {sortSelect('w-full')}
              </div>
              <div className="flex flex-col gap-1.5">
                <p className={EYEBROW_CLASS}>Show</p>
                <Segmented
                  label="Show"
                  value={showArchived ? 'archived' : 'active'}
                  options={[
                    { value: 'active', label: 'Active' },
                    {
                      value: 'archived',
                      label: 'Archived',
                      // A count of the sessions read so far would be short
                      count:
                        archivedCount > 0 && !hasMore
                          ? archivedCount
                          : undefined,
                    },
                  ]}
                  onChange={value => setShowArchived(value === 'archived')}
                  isDarkMode={isDarkMode}
                  size="md"
                  fill
                  className="min-h-11"
                />
              </div>
              {team && (
                <div className="flex flex-col gap-1.5">
                  <p className={EYEBROW_CLASS}>Whose sessions</p>
                  {scopeControl('min-h-11', true)}
                </div>
              )}
            </div>
            <DialogFooter className="flex-row gap-3 px-5 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <Button
                type="button"
                variant="neutral"
                size="touch"
                onClick={resetSettings}
                disabled={settingsChanged === 0}
                className="flex-1 sm:flex-none"
              >
                Reset
              </Button>
              <Button
                type="button"
                variant="primary"
                size="touch"
                onClick={() => setFiltersOpen(false)}
                className="flex-1 sm:flex-none"
              >
                Show {plural(filteredSessions.length, 'session')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Quick Stats: a strip of figures over the list. Named for screen
            readers, with what it counts; on screen the cards under it say
            that. While the sessions load it holds its place when the list
            is expected to need it, so the list doesn't move when they
            arrive. */}
        {(loading
          ? expectedShown === undefined || expectedShown >= 2
          : showQuickStats) && (
          <section
            aria-labelledby="quick-stats-title"
            aria-busy={loading || undefined}
            className="mb-4 sm:mb-6"
          >
            <h2 id="quick-stats-title" className="sr-only">
              {loading
                ? 'Quick Stats'
                : `Quick Stats, ${quickStats.countedType ? `${quickStats.countedType} matches from ` : ''}${scopeLabel(quickStats.sessionCount, filters, showArchived)}`}
            </h2>
            {/* With more than one match type and none picked, the figures
                are over the commonest type only, and say so */}
            <div className="grid grid-cols-3 gap-2 sm:gap-4">
              {[
                {
                  id: 'avg',
                  label: quickStats.countedType
                    ? `${quickStats.countedType} avg`
                    : 'Avg score',
                  value: quickStats.averageScore,
                },
                {
                  id: 'best',
                  label: quickStats.countedType
                    ? `${quickStats.countedType} best`
                    : 'Best score',
                  value: quickStats.bestScore,
                },
                {
                  id: 'matches',
                  label: quickStats.countedType
                    ? `${quickStats.countedType} matches`
                    : 'Matches',
                  value: quickStats.matchCount,
                },
              ].map(({ id, label, value }) => (
                <StatTile
                  key={id}
                  label={label}
                  value={
                    loading ? (
                      <span
                        aria-hidden="true"
                        className="inline-block h-[0.8em] w-10 sm:w-16 rounded bg-muted animate-pulse align-middle"
                      />
                    ) : (
                      value
                    )
                  }
                  isDarkMode={isDarkMode}
                  className="p-2.5 sm:p-4"
                />
              ))}
            </div>
            {/* Older sessions not read yet aren't counted: say so, with
                the way to count them */}
            {loading
              ? pendingMore && (
                  <p
                    aria-hidden="true"
                    className="mt-2 h-4 sm:h-5 w-56 rounded bg-muted animate-pulse"
                  />
                )
              : hasMore && (
                  <p
                    className={`mt-2 text-xs sm:text-sm ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
                  >
                    Over the newest {plural(filteredSessions.length, 'session')}{' '}
                    ·{' '}
                    {loadingOlder ? (
                      'reading older ones...'
                    ) : (
                      <button
                        type="button"
                        onClick={() => void loadAll()}
                        // 44px tall around a 16px line
                        className="inline-block -my-3.5 py-3.5 font-medium text-team-blue underline underline-offset-4"
                      >
                        Count them all
                      </button>
                    )}
                  </p>
                )}
          </section>
        )}

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
            {[...Array(Math.min(6, Math.max(1, expectedShown ?? 6)))].map(
              (_, i) => (
                <LoadingCard key={i} />
              )
            )}
          </div>
        ) : noneShown && hasMore ? (
          // Nothing read so far is shown; older pages are being read for
          // some (or couldn't be: the button below tries again)
          loadingOlder && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
              {[...Array(3)].map((_, i) => (
                <LoadingCard key={i} />
              ))}
            </div>
          )
        ) : noneShown ? (
          <div className="text-center py-12 sm:py-16">
            <div
              className={`mx-auto w-16 sm:w-24 h-16 sm:h-24 rounded-full flex items-center justify-center mb-4 ${
                isDarkMode ? 'bg-team-dark-20' : 'bg-gray-100'
              }`}
            >
              {showArchived ? (
                <Archive
                  aria-hidden="true"
                  className={`h-8 sm:h-12 w-8 sm:w-12 ${fieldIcon}`}
                />
              ) : (
                <BarChart3
                  aria-hidden="true"
                  className={`h-8 sm:h-12 w-8 sm:w-12 ${fieldIcon}`}
                />
              )}
            </div>
            <h2 className={`mb-2 ${SECTION_TITLE_CLASS}`}>
              {loadFailed
                ? "Couldn't load your sessions"
                : importOffered && !filtersActive && !archiveEmpty
                  ? 'No sessions in this account yet'
                  : scopeOnly && showArchived
                    ? filters.scope === 'team'
                      ? `No archived sessions shared with ${team?.name ?? 'your team'}`
                      : "You haven't archived any of your sessions"
                    : scopeOnly
                      ? filters.scope === 'team'
                        ? `No sessions shared with ${team?.name ?? 'your team'} yet`
                        : "You haven't recorded a session yet"
                      : filtersActive
                        ? `No ${showArchived ? 'archived ' : ''}sessions match these filters`
                        : showArchived
                          ? 'No archived sessions'
                          : archivedCount > 0
                            ? 'No active sessions'
                            : 'No sessions yet'}
            </h2>
            <p
              className={`mb-6 max-w-md mx-auto text-balance ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
            >
              {loadFailed
                ? offline
                  ? "You're offline. They load by themselves once you're back online."
                  : 'Check your connection, then reload the page'
                : importOffered && !filtersActive && !archiveEmpty
                  ? importingGuestSessions
                    ? `The ${guestSessionCount === 1 ? 'session above is on its' : `${guestSessionCount} sessions above are on their`} way in.`
                    : `The ${guestSessionCount === 1 ? 'session' : `${guestSessionCount} sessions`} above ${guestSessionCount === 1 ? 'is' : 'are'} only in this browser until you import ${guestSessionCount === 1 ? 'it' : 'them'}.`
                  : scopeOnly && showArchived
                    ? 'Sessions you archive are kept here, out of your main list.'
                    : scopeOnly
                      ? filters.scope === 'team'
                        ? 'Sessions filed under the team show up here.'
                        : 'Sessions you score show up here.'
                      : filtersActive
                        ? 'Try a different search or match type'
                        : showArchived
                          ? 'Sessions you archive are kept here, out of your main list.'
                          : archivedCount > 0
                            ? archivedCount === 1
                              ? 'The only session here is archived.'
                              : `All ${archivedCount} sessions here are archived.`
                            : isGuest
                              ? 'Score a practice and it shows up here. No account needed: sessions stay in this browser.'
                              : 'Score a practice and it shows up here.'}
            </p>
            {!loadFailed && filtersActive && (
              <Button
                onClick={clearFilters}
                variant="outline"
                className={`min-h-11 ${
                  isDarkMode
                    ? 'border-team-blue-40 text-team-white hover:bg-team-blue-10'
                    : 'border-gray-300'
                }`}
              >
                {scopeOnly ? 'Show all sessions' : 'Clear filters'}
              </Button>
            )}
            {!loadFailed && !filtersActive && archiveEmpty && (
              <Button
                onClick={() => setShowArchived(!showArchived)}
                variant="outline"
                className={`min-h-11 ${
                  isDarkMode
                    ? 'border-team-blue-40 text-team-white hover:bg-team-blue-10'
                    : 'border-gray-300'
                }`}
              >
                {showArchived ? 'Back to active' : 'Show archived sessions'}
              </Button>
            )}
            {/* While the banner above offers this browser's sessions,
                Import is the one way on: no Start here */}
            {!loadFailed &&
              !filtersActive &&
              !archiveEmpty &&
              !isGuest &&
              !importOffered && (
                <Button
                  onClick={() => {
                    // A session already under way is carried on, not replaced.
                    if (!hasActiveSession) resetSession();
                    navigate(ROUTES.ACTIVE);
                  }}
                  variant="primary"
                  // The view's one fill: the header's New Session steps back
                  data-page-primary
                  className="min-h-11"
                >
                  {!hasActiveSession && <Plus className="h-4 w-4" />}
                  {hasActiveSession
                    ? 'Back to your active session'
                    : 'Start your first session'}
                </Button>
              )}
            {!loadFailed && !filtersActive && !archiveEmpty && isGuest && (
              <div className="flex flex-col gap-2 justify-center items-center">
                <Button
                  onClick={() => navigate(ROUTES.ACTIVE)}
                  data-page-primary
                  className={`bg-team-blue hover:bg-team-blue/90 min-h-11 ${isDarkMode ? 'text-black' : 'text-white'}`}
                >
                  {/* A match under way is gone back to, not started again */}
                  {!hasActiveSession && <Plus className="h-4 w-4" />}
                  {hasActiveSession
                    ? 'Back to your active session'
                    : 'Start your first session'}
                </Button>
                <Link
                  to={ROUTES.SIGNUP}
                  className="inline-flex min-h-11 items-center text-sm font-medium text-team-blue underline underline-offset-2"
                >
                  Sign up to back up and share
                </Link>
              </div>
            )}
          </div>
        ) : (
          // A press on a card opens its session: the search goes into the
          // address first, so Back finds it.
          <div
            onClickCapture={flushSearch}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6"
          >
            {cards.map(({ session, shown }) => (
              <SessionCard
                key={session.id}
                session={shown}
                href={`${ROUTES.ANALYSIS}?sessionId=${session.id}`}
                onNameChange={
                  canRename(session)
                    ? newName => handleUpdateSessionName(session.id, newName)
                    : undefined
                }
                onShare={
                  isGuest ? undefined : () => handleShareSession(session)
                }
                onToggleArchive={
                  canArchive(session)
                    ? () =>
                        handleToggleArchive(
                          session.id,
                          !archivedFor(session, viewer)
                        )
                    : undefined
                }
                onDelete={
                  canDelete(session)
                    ? () => handleDeleteSession(session.id)
                    : undefined
                }
                ownerName={getSessionOwnerName(session)}
                // The banner above already says which aren't shared
                notSharedWith={
                  team && !unsharedBannerShown && !session.teamId
                    ? team.name
                    : undefined
                }
                filedUnder={
                  filedElsewhere(session)
                    ? { name: filedUnderName(session) }
                    : undefined
                }
              />
            ))}
          </div>
        )}

        {/* The end of what has been read: the next page is a press away */}
        {!loading && hasMore && (
          <div aria-live="polite" className="mt-6 sm:mt-8 flex justify-center">
            <Button
              onClick={showOlder}
              disabled={loadingOlder}
              variant="outline"
              className={`min-h-11 ${
                isDarkMode
                  ? 'border-team-blue-40 text-team-white hover:bg-team-blue-10'
                  : 'border-gray-300'
              }`}
            >
              {loadingOlder
                ? 'Loading older sessions...'
                : 'Show older sessions'}
            </Button>
          </div>
        )}

        {hasOlderSeasons && !loading && (
          <p
            className={`mt-8 text-center text-sm ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
          >
            Sessions from last season ({LEGACY_SEASON.toUpperCase()}) aren't
            listed here.{' '}
            <button
              type="button"
              onClick={handleExportOlderSeasons}
              disabled={exportingOlder}
              className="inline-block -my-3 py-3 font-medium text-team-blue underline underline-offset-4 disabled:opacity-50"
            >
              {exportingOlder ? 'Exporting...' : 'Export them as CSV'}
            </button>
          </p>
        )}
      </div>
    </div>
  );
};

export default Sessions;
