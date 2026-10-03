import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import type { KeyboardEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth, useSessionCore, useTheme, useTeam } from '@/contexts';
import { firebaseService, teamService } from '@/services';
import { TeamManager } from '@/components';
import {
  toDate,
  isAbortError,
  generateShareableLink,
  copyShareLink,
  logger,
  matchScore,
  buildSessionsCsv,
  buildLegacySessionsCsv,
  csvFileName,
  downloadCsv,
  SORT_LABELS,
  DEFAULT_SORT,
  sortSessions,
  isArchived,
  inArchiveView,
  isGuestSessionId,
  readGuestSessions,
  writeGuestSessions,
} from '@/lib';
import type { SortOption } from '@/lib';
import {
  getPendingDeleteIds,
  subscribePendingDeletes,
  onSessionDeleted,
  scheduleSessionDelete,
} from '@/lib/pendingSessionDeletes';
import { readAllGuestSessions } from '@/lib/guestSessions';
import { LEGACY_SEASON } from '@/lib/sessionNormalize';
import {
  UI_TIMING,
  APP_CONFIG,
  ROUTES,
  SESSION_LIMITS,
  STORAGE_KEYS,
  OPEN_SHARE_SESSIONS_EVENT,
  CURRENT_SEASON,
} from '@/constants';
import type { CreateSessionData, Session } from '@/types';
import { PAGE_TITLE_CLASS } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Archive,
  ArrowUpDown,
  Search,
  Plus,
  BarChart3,
  ChevronDown,
  Download,
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
  filterSessions,
  hasActiveFilters,
  matchCountOf,
  matchTypeLabel,
  oneMatchTypeLabel,
  plural,
  quickStatsOf,
  scopeLabel,
  sessionsToExport,
} from './sessionList';
import type { SessionListFilters, SessionScope } from './sessionList';

/**
 * The guest sessions in this browser that an account can take in. One the
 * guest deleted but can still bring back is left out: it is on its way out,
 * and Undo puts it back on offer.
 */
const importableGuestSessions = (): Session[] => {
  const pendingIds = getPendingDeleteIds();
  return readGuestSessions().filter(session => !pendingIds.has(session.id));
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

const Sessions = () => {
  const { user, isGuest } = useAuth();
  const { isDarkMode } = useTheme();
  const { resetSession, hasActiveSession } = useSessionCore();
  const { team, refreshTeam } = useTeam();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  /** The list couldn't be read, so an empty one doesn't mean "no sessions" */
  const [loadFailed, setLoadFailed] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMatchType, setSelectedMatchType] =
    useState<string>(ALL_MATCH_TYPES);
  /** All, Team or Mine; only offered (and only applied) inside a team */
  const [selectedScope, setSelectedScope] = useState<SessionScope>('all');
  const [sortBy, setSortBy] = useState<SortOption>(DEFAULT_SORT);
  /** Which half of the list is on screen: the archived sessions, or the rest */
  const [showArchived, setShowArchived] = useState(false);
  /** Sessions deleted but still inside their undo window */
  const [hiddenIds, setHiddenIds] = useState(getPendingDeleteIds);
  /** Sessions a guest saved in this browser that the account doesn't have */
  const [guestSessionCount, setGuestSessionCount] = useState(0);
  const [importingGuestSessions, setImportingGuestSessions] = useState(false);
  const [importBannerDismissed, setImportBannerDismissed] = useState(false);
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
    const stopChanges = subscribePendingDeletes(sync);
    const stopDeleted = onSessionDeleted(sessionId =>
      setSessions(prev => prev.filter(s => s.id !== sessionId))
    );
    return () => {
      stopChanges();
      stopDeleted();
    };
  }, []);

  useEffect(() => {
    document.title = `Sessions - ${APP_CONFIG.name}`;
  }, []);

  // Sessions recorded as a guest stay in this browser when the guest signs
  // up or logs in; offer to bring them into the account. Counted again
  // whenever a delete the guest left waiting is finished or undone.
  useEffect(() => {
    if (!uid || isGuest) {
      setGuestSessionCount(0);
      return;
    }
    const recount = () =>
      setGuestSessionCount(importableGuestSessions().length);
    recount();
    return subscribePendingDeletes(recount);
  }, [uid, isGuest]);

  const loadPersonalSessions = useCallback(async () => {
    if (isGuest) {
      setSessions(readGuestSessions());
      setLoading(false);
      return;
    }

    if (!uid) return;

    setLoading(true);
    try {
      const fetchedSessions = await firebaseService.getUserSessions(uid);
      setSessions(fetchedSessions);
      setLoadFailed(false);
    } catch (error) {
      if (isAbortError(error)) return;
      logger.error('Error loading sessions', error);
      setLoadFailed(true);
      toast.error('Failed to load sessions');
    } finally {
      setLoading(false);
    }
  }, [uid, isGuest]);

  const loadSessions = useCallback(async () => {
    if (!uid) return;
    if (!teamId) {
      await loadPersonalSessions();
    }
  }, [uid, teamId, loadPersonalSessions]);

  /** The latest refreshTeam, for a listener that outlives its render. */
  const refreshTeamRef = useRef(refreshTeam);
  useEffect(() => {
    refreshTeamRef.current = refreshTeam;
  }, [refreshTeam]);

  useEffect(() => {
    if (!teamId) return;

    setLoading(true);
    let unsubscribe: (() => void) | undefined;
    let subscribed = false;
    let active = true;
    let deniedNotice: ReturnType<typeof setTimeout> | undefined;

    const syncFailed = () =>
      toast.error(
        "Couldn't sync your team's sessions. Check your connection and reload."
      );

    firebaseService
      .subscribeTeamSessions(
        teamId,
        teamSessions => {
          if (!active) return;
          subscribed = true;
          setSessions(teamSessions);
          setLoadFailed(false);
          setLoading(false);
        },
        async error => {
          // A listener this effect has already let go of has nothing to say.
          if (!active) return;
          logger.error('Team sessions listener error:', {
            error: String(error),
          });

          if (
            (error as { code?: string } | null)?.code === 'permission-denied'
          ) {
            // Almost always means the user is no longer in this team (removed,
            // or left on another device). Re-checking membership clears the
            // stale team and says so, which tears this effect down and loads
            // the personal list. If the team is still here a moment later,
            // they are a member after all and the list just couldn't load.
            await refreshTeamRef.current();
            deniedNotice = setTimeout(() => {
              if (!active) return;
              syncFailed();
              setLoadFailed(true);
              setLoading(false);
            }, UI_TIMING.SHORT_DELAY);
            return;
          }

          if ((error?.message || '').includes('index')) {
            toast.error(
              'Firestore needs a composite index for team sessions. Check the browser console for the creation link.',
              { duration: 10000 }
            );
          } else {
            syncFailed();
          }
          if (!subscribed) {
            try {
              const fetched = await firebaseService.getTeamSessions(teamId);
              if (active) setSessions(fetched);
            } catch {
              if (active) setLoadFailed(true);
            }
          }
          if (active) setLoading(false);
        }
      )
      .then(unsub => {
        if (active) unsubscribe = unsub;
        else unsub();
      });

    return () => {
      active = false;
      clearTimeout(deniedNotice);
      unsubscribe?.();
    };
  }, [teamId]);

  useEffect(() => {
    if (!teamId) {
      loadPersonalSessions();
    }
  }, [teamId, loadPersonalSessions]);

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

  const archivedCount = useMemo(
    () => visibleSessions.filter(isArchived).length,
    [visibleSessions]
  );

  /**
   * The sessions of the view on screen, in the chosen order: the archived
   * ones under Archived, the rest otherwise, whatever the search and filter
   * say. Everything below (the cards, Quick Stats, the export) starts here.
   */
  const viewSessions = useMemo(
    () => sortSessions(inArchiveView(visibleSessions, showArchived), sortBy),
    [visibleSessions, showArchived, sortBy]
  );

  const filteredSessions = useMemo(
    () => filterSessions(viewSessions, filters, { teamId, uid }),
    [viewSessions, filters, teamId, uid]
  );

  /**
   * The view is empty only because of which half it shows: nothing archived
   * yet, or everything archived. The way out is the other view, not a new
   * session.
   */
  const archiveEmpty = showArchived || archivedCount > 0;

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedMatchType(ALL_MATCH_TYPES);
    setSelectedScope('all');
  };

  /**
   * Quick Stats, over exactly the sessions the list is showing: archived
   * ones count under Archived, and still count on Charts and Compare.
   */
  const quickStats = useMemo(
    () => quickStatsOf(filteredSessions, filters.matchType),
    [filteredSessions, filters.matchType]
  );

  /**
   * The viewer's own sessions that their team can't see. A team's list only
   * ever adds the viewer's own to what is filed under the team.
   */
  const unsharedIds = useMemo(
    () =>
      teamId
        ? visibleSessions
            .filter(session => session.teamId !== teamId)
            .map(session => session.id)
        : [],
    [visibleSessions, teamId]
  );
  const unsharedCount = unsharedIds.length;
  const unsharedBannerDismissed = unsharedIds.every(id =>
    unsharedDismissedIds.has(id)
  );

  useEffect(() => {
    setUnsharedDismissedIds(
      uid && teamId ? readUnsharedDismissed(uid, teamId) : new Set()
    );
  }, [uid, teamId]);

  const dismissUnsharedBanner = () => {
    setUnsharedDismissedIds(new Set(unsharedIds));
    if (uid && teamId) writeUnsharedDismissed(uid, teamId, unsharedIds);
  };

  /** Arrow keys move between All, Team and Mine, as in any radio group. */
  const handleScopeKey = (
    e: KeyboardEvent<HTMLButtonElement>,
    index: number
  ) => {
    const step =
      e.key === 'ArrowRight' || e.key === 'ArrowDown'
        ? 1
        : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
          ? -1
          : 0;
    if (step === 0) return;
    e.preventDefault();
    const nextIndex =
      (index + step + SESSION_SCOPES.length) % SESSION_SCOPES.length;
    setSelectedScope(SESSION_SCOPES[nextIndex].value);
    const radios =
      e.currentTarget.parentElement?.querySelectorAll<HTMLElement>(
        '[role="radio"]'
      );
    radios?.[nextIndex]?.focus();
  };

  /** The author of a session (and a guest, of their own) can rename it. */
  const canRename = (session: Session): boolean =>
    isGuest || (!!uid && session.userId === uid);

  /**
   * Archiving is an edit like renaming, so the same people can do it: the
   * Firestore rules let nobody but the author update a session.
   */
  const canArchive = canRename;

  /**
   * The author can delete a session, and so can the owner of the team it is
   * filed under — the same two people the Firestore rules allow.
   */
  const canDelete = (session: Session): boolean =>
    canRename(session) ||
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
      setSessions(prevSessions =>
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
        setSessions(prevSessions =>
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
      setSessions(prevSessions =>
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
      setSessions(prev =>
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
      await copyShareLink(shareLink, () =>
        toast.success('Share link copied to clipboard!', {
          duration: UI_TIMING.UNDO_WINDOW,
          action: {
            label: 'Turn off sharing',
            onClick: async () => {
              try {
                const removed = await firebaseService.deleteSharedSessions(
                  session.id
                );
                // Only the person who recorded a session can take down
                // every link to it; anyone else removes the ones they made.
                if (session.userId === uid) {
                  if (removed > 0) {
                    toast.success(
                      'Share links for this session no longer work'
                    );
                  } else {
                    toast.info('No active share links for this session');
                  }
                } else if (removed > 0) {
                  toast.success(
                    `The share link${removed === 1 ? '' : 's'} you made no longer work${removed === 1 ? 's' : ''}`,
                    {
                      description:
                        'Links made by others in your team are not affected.',
                    }
                  );
                } else {
                  toast.info("You haven't shared this session");
                }
              } catch (error) {
                logger.error('Error revoking share links', error);
                toast.error('Failed to turn off sharing');
              }
            },
          },
        })
      );
    } catch (error) {
      logger.error('Error sharing session', error);
      toast.error('Failed to generate share link');
    }
  };

  /**
   * Copy the sessions this browser saved for a guest into the signed-in
   * account, as personal sessions. Each one leaves guest storage only once
   * its upload has succeeded, so a failure part-way loses nothing and a
   * retry can't duplicate what already went up.
   */
  const handleImportGuestSessions = async () => {
    if (!uid || importingGuestSessions) return;
    setImportingGuestSessions(true);

    try {
      // Oldest first, so the account's list ends up in the original order
      // even if a session's date can't be carried over.
      let toImport = importableGuestSessions().sort(
        (a, b) => toDate(a.createdAt).getTime() - toDate(b.createdAt).getTime()
      );
      let overLimit = 0;
      try {
        const room = Math.max(
          0,
          SESSION_LIMITS.MAX_SESSIONS_PER_USER -
            (await firebaseService.countUserSessions(uid))
        );
        if (toImport.length > room) {
          overLimit = toImport.length - room;
          // Keep the most recent ones.
          toImport = toImport.slice(overLimit);
        }
      } catch (error) {
        // The count needs the server; the uploads below will say so too.
        logger.warn('Could not check the session limit before importing', {
          error: String(error),
        });
      }

      let imported = 0;
      let failed = 0;
      for (const guestSession of toImport) {
        const {
          id: guestId,
          createdAt: recordedAt,
          teamId: _teamId,
          ...rest
        } = guestSession;
        const data: CreateSessionData = {
          ...rest,
          userId: uid,
          userEmail: user?.email || '',
          matchType: matchTypeLabel(guestSession),
          matches: guestSession.matches.map(match => ({
            ...match,
            finalScore: matchScore(match, guestSession.matchType),
          })),
        };

        try {
          const created = await firebaseService.createSession(data);
          if (!created?.id) throw new Error('Session was not saved');
          writeGuestSessions(readGuestSessions().filter(s => s.id !== guestId));
          imported++;
          // createSession stamps the upload time; put back when the session
          // was actually recorded.
          const recorded = recordedAt ? toDate(recordedAt) : null;
          if (recorded && !Number.isNaN(recorded.getTime())) {
            await firebaseService
              .updateSession(created.id, { createdAt: recorded })
              .catch(error =>
                logger.warn('Could not keep the date of an imported session', {
                  error: String(error),
                })
              );
          }
        } catch (error) {
          failed++;
          logger.error('Error importing guest session', error);
        }
      }

      setGuestSessionCount(importableGuestSessions().length);
      if (imported > 0) {
        toast.success(`Imported ${plural(imported, 'session')}`);
      }
      if (failed > 0) {
        toast.error(
          `Couldn't import ${plural(failed, 'session')}. ${failed === 1 ? 'It is' : 'They are'} still saved on this device - try again.`
        );
      }
      if (overLimit > 0) {
        toast.error(
          `${plural(overLimit, 'session')} not imported: accounts hold ${SESSION_LIMITS.MAX_SESSIONS_PER_USER} sessions. Delete some of your own old sessions, then import again.`,
          { duration: UI_TIMING.UNDO_WINDOW }
        );
      }
      // A team's list updates by itself; the personal one is fetched.
      if (imported > 0 && !teamId) await loadPersonalSessions();
    } finally {
      setImportingGuestSessions(false);
    }
  };

  /** Helper: get display name for a session's owner from team members */
  const getSessionOwnerName = (session: Session): string | undefined => {
    if (!team) return undefined;
    const member = team.members.find(m => m.userId === session.userId);
    return (
      member?.displayName || member?.email || session.userEmail || undefined
    );
  };

  /**
   * Download `toExport` as one CSV and say how much went into it. Under a
   * filter that names one match type (`matchType`), only the matches of that
   * type go in, the ones Quick Stats counts.
   */
  const exportSessions = (
    toExport: Session[],
    matchType: string = ALL_MATCH_TYPES
  ) => {
    if (toExport.length === 0) {
      toast.error('No sessions to export');
      return;
    }

    const exported = sessionsToExport(toExport, matchType);
    downloadCsv(
      csvFileName(
        showArchived ? 'archived-sessions-export' : 'sessions-export'
      ),
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
   * Export follows the list: when a search, filter or scope leaves anything
   * out (a session, or under a one-type filter a match of another type), the
   * button exports what is shown (and what Quick Stats counts) and says
   * which part that is, and every session of the view is one more choice
   * away. Plain "Export" always writes the whole view: every active session,
   * or under Archived every archived one. Rows follow the order on screen.
   */
  const canExport = viewSessions.length > 0;
  const sessionsLeftOut = filteredSessions.length < viewSessions.length;
  const exportsShown =
    filtersActive &&
    filteredSessions.length > 0 &&
    (sessionsLeftOut ||
      matchCountOf(sessionsToExport(filteredSessions, filters.matchType)) <
        matchCountOf(viewSessions));
  const exportLabel = exportsShown
    ? sessionsLeftOut
      ? `Export ${filteredSessions.length} shown`
      : // Every session is shown; the filter only leaves matches out.
        `Export ${oneMatchTypeLabel(filters.matchType) ?? 'shown'}`
    : canExport && filtersActive && filteredSessions.length === 0
      ? `Export all ${viewSessions.length}`
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
  /** Only the Team / Mine scope is narrowing the view */
  const scopeOnly =
    filters.scope !== 'all' &&
    filters.searchTerm.trim() === '' &&
    filters.matchType === ALL_MATCH_TYPES;

  const headingText = isDarkMode ? 'text-white' : 'text-team-blue';
  const mutedText = isDarkMode ? 'text-gray-300' : 'text-gray-600';
  const outlineButton = `border border-team-blue hover:bg-team-blue/10 transition-colors text-xs sm:text-sm md:text-base px-2.5 sm:px-3 py-2 min-h-11 flex items-center gap-1 sm:gap-1.5 text-team-blue border-team-blue-40`;
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
              it when it reads "Export 2 shown" or "Export Autonomous", so
              typing a search never wraps the row and pushes the search field
              down; the icons are left out on a phone to make that room.
              Under 360px Export always has a row of its own. */}
          <div className="flex flex-wrap items-center gap-x-1.5 sm:gap-x-2 md:gap-x-3 gap-y-2">
            <h1
              className={`w-full sm:w-auto sm:mr-auto min-h-11 sm:min-h-0 flex items-center ${PAGE_TITLE_CLASS}`}
            >
              Sessions
            </h1>
            {hasSessions && (
              <Button
                onClick={() => navigate(ROUTES.CHARTS)}
                className={`bg-team-blue hover:bg-team-blue/90 transition-colors text-xs sm:text-sm md:text-base px-2.5 sm:px-3 md:px-4 py-2 min-h-11 flex items-center gap-1 sm:gap-1.5 ${
                  isDarkMode ? '!text-black' : '!text-white'
                }`}
              >
                <TrendingUp className="max-sm:hidden" />
                Charts
              </Button>
            )}
            {visibleSessions.length > 1 && (
              <Button
                onClick={() => navigate(ROUTES.COMPARE)}
                className={outlineButton}
                variant="outline"
              >
                <BarChart3 className="max-sm:hidden" />
                Compare
              </Button>
            )}
            {hasSessions && (
              <div className="flex ml-auto sm:ml-0 max-[359px]:w-full max-[359px]:justify-end">
                <Button
                  onClick={() =>
                    exportsShown
                      ? exportSessions(filteredSessions, filters.matchType)
                      : exportSessions(viewSessions)
                  }
                  disabled={!canExport}
                  className={`${outlineButton} ${exportsShown ? 'rounded-r-none' : ''}`}
                  variant="outline"
                >
                  <Download className="max-sm:hidden" />
                  {exportLabel}
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
                        onSelect={() => exportSessions(viewSessions)}
                        className="flex items-center gap-2 cursor-pointer [@media(pointer:coarse)]:min-h-11"
                      >
                        <Download className="h-4 w-4" />
                        <span>Export all {viewSessions.length}</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            )}
          </div>
          {!isGuest && <TeamManager onTeamChange={() => loadSessions()} />}
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
              Stored on this device only ·{' '}
              <Link
                to={ROUTES.SIGNUP}
                className="inline-block -my-3 py-3 font-semibold text-team-blue underline underline-offset-2"
              >
                Sign up to back up
              </Link>
            </span>
          </p>
        )}

        {!isGuest && guestSessionCount > 0 && !importBannerDismissed && (
          <div
            role="region"
            aria-label="Import sessions saved on this device"
            className={`mb-4 sm:mb-6 p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center gap-3 ${bannerTone}`}
          >
            <div className="flex-1 min-w-0">
              <p className={`font-semibold ${headingText}`}>
                {guestSessionCount} session{guestSessionCount === 1 ? '' : 's'}{' '}
                saved on this device
              </p>
              <p className={`text-sm ${mutedText}`}>
                Recorded here before you signed in. Import{' '}
                {guestSessionCount === 1 ? 'it' : 'them'} to keep{' '}
                {guestSessionCount === 1 ? 'it' : 'them'} in your account.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button
                onClick={handleImportGuestSessions}
                disabled={importingGuestSessions}
                className={`bg-team-blue hover:bg-team-blue/90 min-h-[44px] flex items-center gap-1.5 ${
                  isDarkMode ? '!text-black' : '!text-white'
                }`}
              >
                <Upload className="h-4 w-4" />
                {importingGuestSessions
                  ? 'Importing...'
                  : `Import ${guestSessionCount} session${guestSessionCount === 1 ? '' : 's'}`}
              </Button>
              <button
                onClick={() => setImportBannerDismissed(true)}
                disabled={importingGuestSessions}
                className={dismissButton}
                aria-label="Not now"
                title="Not now"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {team && !loading && unsharedCount > 0 && !unsharedBannerDismissed && (
          <div
            role="region"
            aria-label="Sessions your team can't see"
            className={`mb-4 pl-3 pr-1 py-1 sm:pl-4 sm:pr-2 sm:py-2 rounded-xl border flex items-center gap-2 sm:gap-3 ${bannerTone}`}
          >
            <Users
              aria-hidden="true"
              className="hidden sm:block h-4 w-4 shrink-0 text-team-blue"
            />
            {/* A sentence that ends in its action on a phone; the action
                moves out to a button of its own from 640px */}
            <p
              className={`flex-1 min-w-0 text-sm font-medium break-words sm:flex sm:items-center sm:gap-3 ${
                isDarkMode ? 'text-gray-100' : 'text-gray-900'
              }`}
            >
              <span className="sm:flex-1">
                {unsharedCount} of your sessions{' '}
                {unsharedCount === 1 ? "isn't" : "aren't"} shared with{' '}
                {team.name}.
              </span>{' '}
              <button
                type="button"
                onClick={() =>
                  window.dispatchEvent(new Event(OPEN_SHARE_SESSIONS_EVENT))
                }
                className="-my-2 py-2 font-semibold text-team-blue underline underline-offset-2 whitespace-nowrap sm:my-0 sm:min-h-11 sm:px-3 sm:rounded-lg sm:border sm:border-team-blue-40 sm:no-underline sm:hover:bg-team-blue/10 sm:transition-colors"
              >
                Share {unsharedCount === 1 ? 'it' : 'them'}
              </button>
            </p>
            <button
              onClick={dismissUnsharedBanner}
              className={dismissButton}
              aria-label="Not now"
              title="Not now"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Search, filter, order, view and scope sit above everything they
            narrow: Quick Stats, the cards and the export. They share one row
            from 1024px (1280px in a team, where the scope joins them); below
            that the order and the view have a row of their own, with the
            scope from 640px. The sort's width never follows its label, so
            picking an order never moves anything. */}
        {(loading || hasSessions) && (
          <div
            className={`mb-4 sm:mb-6 flex flex-col gap-2 sm:gap-3 ${team ? 'xl:flex-row' : 'lg:flex-row'}`}
          >
            <div className="flex flex-1 min-w-0 gap-2 sm:gap-3">
              <div className="flex-1 min-w-0 relative">
                <Search
                  aria-hidden="true"
                  className={`absolute left-3 md:left-4 top-1/2 transform -translate-y-1/2 h-4 w-4 transition-colors ${isDarkMode ? 'text-team-white-40' : 'text-gray-400'}`}
                />
                <Input
                  type="search"
                  aria-label="Search sessions"
                  placeholder="Search sessions"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className={`pl-10 md:pl-12 h-11 text-base md:text-base rounded-xl shadow-sm transition-all duration-200 focus:shadow-md ${
                    isDarkMode
                      ? 'bg-team-dark-20 border-team-blue-40 text-white placeholder-team-white-40 focus:border-team-blue'
                      : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-team-blue'
                  }`}
                />
              </div>
              <Select
                value={selectedMatchType}
                onValueChange={setSelectedMatchType}
              >
                <SelectTrigger
                  aria-label="Filter by match type"
                  className={`w-[8.75rem] sm:w-[180px] shrink-0 h-11 text-sm md:text-base rounded-xl shadow-sm border ${
                    isDarkMode
                      ? 'bg-team-dark border-team-blue-40 text-white'
                      : 'bg-white border-gray-200 text-gray-900'
                  }`}
                >
                  <SelectValue placeholder="All Match Types" />
                </SelectTrigger>
                <SelectContent
                  className={`${isDarkMode ? 'bg-team-dark border-team-blue-40' : 'bg-white border-gray-200'}`}
                >
                  <SelectItem value={ALL_MATCH_TYPES}>
                    <span className="sm:hidden">All types</span>
                    <span className="hidden sm:inline">All Match Types</span>
                  </SelectItem>
                  {MATCH_TYPE_FILTERS.map(({ value, label }) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div
              className={`flex flex-wrap sm:flex-nowrap gap-2 sm:gap-3 ${team ? 'xl:shrink-0' : 'lg:shrink-0'}`}
            >
              <div className="flex flex-1 sm:flex-none min-w-0 gap-2 sm:gap-3">
                <Select
                  value={sortBy}
                  onValueChange={value => setSortBy(value as SortOption)}
                >
                  <SelectTrigger
                    aria-label="Sort sessions"
                    className={`flex-1 min-w-0 sm:flex-none sm:w-[11.5rem] h-11 text-sm md:text-base rounded-xl shadow-sm border ${
                      isDarkMode
                        ? 'bg-team-dark border-team-blue-40 text-white'
                        : 'bg-white border-gray-200 text-gray-900'
                    }`}
                  >
                    {/* A div: the trigger clamps a span child to one line,
                        which would stack the icon over the label */}
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
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowArchived(prev => !prev)}
                  aria-pressed={showArchived}
                  title={
                    showArchived
                      ? 'Back to your active sessions'
                      : 'Show archived sessions'
                  }
                  className={`h-11 shrink-0 rounded-xl shadow-sm text-sm md:text-base px-3 flex items-center gap-1.5 ${
                    showArchived
                      ? 'bg-team-blue/10 border-team-blue text-team-blue hover:bg-team-blue/20 hover:text-team-blue'
                      : isDarkMode
                        ? 'bg-team-dark border-team-blue-40 text-gray-200 hover:bg-team-blue-10 hover:text-white'
                        : 'bg-white border-gray-200 text-gray-700'
                  }`}
                >
                  <Archive aria-hidden="true" />
                  <span>Archived</span>
                  {archivedCount > 0 && (
                    <span
                      data-testid="archived-count"
                      className="min-w-[1.25rem] rounded-full bg-team-blue/15 px-1.5 text-xs font-semibold tabular-nums text-team-blue"
                    >
                      {archivedCount}
                    </span>
                  )}
                </Button>
              </div>
              {team && (
                <div
                  role="radiogroup"
                  aria-label="Whose sessions to show"
                  className={`w-full sm:w-auto grid grid-cols-3 gap-0.5 p-0.5 rounded-xl border shrink-0 ${
                    isDarkMode
                      ? 'border-team-blue-40 bg-team-dark'
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  {SESSION_SCOPES.map(({ value, label }, index) => {
                    const isSelected = filters.scope === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        tabIndex={isSelected ? 0 : -1}
                        onClick={() => setSelectedScope(value)}
                        onKeyDown={e => handleScopeKey(e, index)}
                        className={`min-h-10 px-4 lg:px-5 rounded-[0.625rem] text-sm transition-colors [@media(pointer:coarse)]:min-h-11 ${
                          isSelected
                            ? `bg-team-blue font-bold ${isDarkMode ? 'text-black' : 'text-white'}`
                            : `font-medium hover:bg-team-blue/10 ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {!loading && filteredSessions.length > 0 && (
          <section
            aria-labelledby="quick-stats-title"
            className={`mb-4 sm:mb-6 p-3 sm:p-6 lg:p-8 rounded-2xl border shadow-lg ${
              isDarkMode
                ? 'bg-team-dark-20 border-team-blue-40'
                : 'bg-white border-gray-200'
            }`}
          >
            <h2
              id="quick-stats-title"
              className={`text-base sm:text-xl font-semibold mb-2 sm:mb-4 break-words ${headingText}`}
            >
              <TrendingUp
                aria-hidden="true"
                className="inline-block align-[-0.125em] mr-2 h-4 sm:h-5 w-4 sm:w-5"
              />
              Quick Stats{' '}
              <span
                data-testid="quick-stats-scope"
                className={`text-sm sm:text-base font-normal ${mutedText}`}
              >
                · {scopeLabel(quickStats.sessionCount, filters, showArchived)}
              </span>
            </h2>
            {/* One row of four at every width, so the first card stays on
                a phone's first screen */}
            <dl className="grid grid-cols-4 gap-1.5 sm:gap-4 lg:gap-6">
              {[
                { label: 'Sessions', value: quickStats.sessionCount },
                { label: 'Avg Score', value: quickStats.averageScore ?? '–' },
                { label: 'Best Score', value: quickStats.bestScore ?? '–' },
                { label: 'Matches', value: quickStats.matchCount },
              ].map(({ label, value }) => (
                <div
                  key={label}
                  className={`flex flex-col-reverse min-w-0 px-1.5 py-2 sm:p-4 rounded-xl text-center sm:text-left ${isDarkMode ? 'bg-team-blue/10' : 'bg-team-blue/5'}`}
                >
                  <dt
                    className={`text-[0.6875rem] leading-tight sm:text-sm font-medium ${mutedText}`}
                  >
                    {label}
                  </dt>
                  <dd className="text-xl sm:text-3xl font-bold text-team-blue tabular-nums sm:mb-1">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
            {[...Array(6)].map((_, i) => (
              <LoadingCard key={i} />
            ))}
          </div>
        ) : filteredSessions.length === 0 ? (
          <div className="text-center py-12 sm:py-16">
            <div
              className={`mx-auto w-16 sm:w-24 h-16 sm:h-24 rounded-full flex items-center justify-center mb-4 ${
                isDarkMode ? 'bg-team-dark-20' : 'bg-gray-100'
              }`}
            >
              <BarChart3
                className={`h-8 sm:h-12 w-8 sm:w-12 ${isDarkMode ? 'text-team-white-60' : 'text-gray-500'}`}
              />
            </div>
            <h2 className={`text-lg font-semibold mb-2 ${headingText}`}>
              {loadFailed
                ? "Couldn't load your sessions"
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
              className={`mb-6 max-w-md mx-auto ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
            >
              {loadFailed
                ? 'Check your connection, then reload the page'
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
                            ? 'Score a practice and it shows up here. No account needed · sessions are kept in this browser.'
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
                onClick={() => setShowArchived(prev => !prev)}
                variant="outline"
                className={`min-h-11 ${
                  isDarkMode
                    ? 'border-team-blue-40 text-team-white hover:bg-team-blue-10'
                    : 'border-gray-300'
                }`}
              >
                {showArchived ? 'Back to sessions' : 'Show archived sessions'}
              </Button>
            )}
            {!loadFailed && !filtersActive && !archiveEmpty && !isGuest && (
              <Button
                onClick={() => {
                  // A session already under way is carried on, not replaced.
                  if (!hasActiveSession) resetSession();
                  navigate(ROUTES.ACTIVE);
                }}
                className={`bg-team-blue hover:bg-team-blue/90 min-h-11 ${isDarkMode ? 'text-black' : 'text-white'}`}
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
                  className={`bg-team-blue hover:bg-team-blue/90 min-h-11 ${isDarkMode ? 'text-black' : 'text-white'}`}
                >
                  <Plus className="h-4 w-4" />
                  Start your first session
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
            {filteredSessions.map(session => (
              <SessionCard
                key={session.id}
                session={session}
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
                        handleToggleArchive(session.id, !isArchived(session))
                    : undefined
                }
                onDelete={
                  canDelete(session)
                    ? () => handleDeleteSession(session.id)
                    : undefined
                }
                ownerName={getSessionOwnerName(session)}
                notSharedWith={
                  team && session.teamId !== team.id ? team.name : undefined
                }
              />
            ))}
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
