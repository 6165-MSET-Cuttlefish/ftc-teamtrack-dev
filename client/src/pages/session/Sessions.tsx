import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, useSessionCore, useTheme, useTeam } from '@/contexts';
import { firebaseService, teamService } from '@/services';
import { TeamManager } from '@/components';
import { useEscapeKey } from '@/hooks';
import {
  formatDate,
  toDate,
  isAbortError,
  generateShareableLink,
  copyShareLink,
  logger,
  matchScore,
  rankingPointTally,
  sessionMatchType,
  MIXED_MATCH_TYPE,
  buildSessionsCsv,
  downloadCsv,
  isGuestSessionId,
  readGuestSessions,
  writeGuestSessions,
} from '@/lib';
import {
  getPendingDeleteIds,
  subscribePendingDeletes,
  onSessionDeleted,
  scheduleSessionDelete,
} from '@/lib/pendingSessionDeletes';
import { UI_TIMING, APP_CONFIG, ROUTES, SESSION_LIMITS } from '@/constants';
import type { CreateSessionData, Session } from '@/types';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Search,
  Plus,
  Award,
  Calendar,
  Trophy,
  Clock,
  BarChart3,
  Pencil,
  Trash2,
  Download,
  TrendingUp,
  Hash,
  Share2,
  Upload,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

/** Match types offered by the filter, as the lower-case values it stores. */
const MATCH_TYPE_FILTERS = [
  { value: 'full game', label: 'Full Game' },
  { value: 'autonomous', label: 'Autonomous' },
  { value: 'teleop', label: 'Teleop' },
  { value: MIXED_MATCH_TYPE.toLowerCase(), label: MIXED_MATCH_TYPE },
] as const;

/** The type each of a session's matches was run as, lower-cased. */
const matchTypesOf = (session: Session): string[] =>
  (session.matches || []).map(match =>
    (match.matchType || session.matchType || 'Full Game').toLowerCase()
  );

/** A session's own label: the type its matches share, or 'Mixed'. */
const matchTypeLabel = (session: Session): string =>
  sessionMatchType(session.matches, session.matchType);

/** Every match score in a session, recomputed from the match's fields. */
const scoresOf = (session: Session): number[] =>
  (session.matches || []).map(match => matchScore(match, session.matchType));

/**
 * The guest sessions in this browser that an account can take in. One the
 * guest deleted but can still bring back is left out: it is on its way out,
 * and Undo puts it back on offer.
 */
const importableGuestSessions = (): Session[] => {
  const pendingIds = getPendingDeleteIds();
  return readGuestSessions().filter(session => !pendingIds.has(session.id));
};

interface SessionCardProps {
  session: Session;
  onView: () => void;
  /** Rename the session. Left out when the viewer can't change it. */
  onNameChange?: (newName: string) => void;
  /** Delete the session. Left out when the viewer can't delete it. */
  onDelete?: () => void;
  onShare: () => void;
  isDeleting?: boolean;
  ownerName?: string;
  /** Name of the viewer's team when this session isn't filed under it */
  notSharedWith?: string;
}

const SessionCard = ({
  session,
  onView,
  onNameChange,
  onDelete,
  onShare,
  isDeleting = false,
  ownerName,
  notSharedWith,
}: SessionCardProps) => {
  const { isDarkMode } = useTheme();
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(session.sessionName || '');
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [isSavingName, setIsSavingName] = useState(false);
  const [isTitleTruncated, setIsTitleTruncated] = useState(false);
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (titleRef.current && !isEditing) {
      const isTruncated = titleRef.current.scrollHeight > titleRef.current.clientHeight;
      setIsTitleTruncated(isTruncated);
    } else {
      setIsTitleTruncated(false);
    }
  }, [session.sessionName, isEditing]);

  useEffect(() => {
    if (deleteConfirm) {
      const timeout = setTimeout(() => setDeleteConfirm(false), UI_TIMING.DELETE_CONFIRM_TIMEOUT);
      return () => clearTimeout(timeout);
    }
  }, [deleteConfirm]);
  useEscapeKey(deleteConfirm, () => setDeleteConfirm(false));

  const handleSaveName = async () => {
    if (!editedName.trim()) {
      toast.error('Session name cannot be empty');
      setEditedName(session.sessionName || '');
      setIsEditing(false);
      return;
    }
    setIsSavingName(true);
    await onNameChange?.(editedName.trim());
    setIsSavingName(false);
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditedName(session.sessionName || '');
    setIsEditing(false);
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (deleteConfirm) {
      onDelete?.();
      setDeleteConfirm(false);
    } else {
      setDeleteConfirm(true);
    }
  };

  const handleDeleteCancel = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteConfirm(false);
  };

  const getSessionScores = () => {
    const matches = session.matches || [];
    const scores = scoresOf(session);

    if (scores.length === 0) {
      return { highestScore: 0, averageScore: 0, totalScore: 0, matchCount: matches.length };
    }

    const totalScore = scores.reduce((a, b) => a + b, 0);
    const highestScore = Math.max(...scores);
    const averageScore = Math.round(totalScore / scores.length);
    
    return { highestScore, averageScore, totalScore, matchCount: matches.length };
  };

  const { highestScore, averageScore, totalScore, matchCount } = getSessionScores();
  const rp = rankingPointTally(session.matches || [], session.matchType);

  const cardContent = (
    <Card
      className={`transition-all duration-300 cursor-pointer group ${
        isDarkMode
          ? 'border-team-blue-40 bg-team-dark hover:border-team-blue'
          : 'border-gray-200 bg-white hover:border-team-blue'
      }`}
      onClick={onView}
    >
      <CardHeader className="pb-4 pt-6 px-6">
        {/* On a phone the buttons leave the name no width beside them, so
            it gets the row above */}
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-x-4 gap-y-2 mb-4">
          <div className="flex-1 min-w-0 basis-full sm:basis-0">
            {isEditing ? (
              <div
                className="flex items-center gap-3"
                onClick={e => e.stopPropagation()}
              >
                <Input
                  value={editedName}
                  onChange={e => setEditedName(e.target.value)}
                  maxLength={SESSION_LIMITS.MAX_SESSION_NAME_LENGTH}
                  aria-label="Session name"
                  className={`h-10 text-xl font-semibold ${
                    isDarkMode
                      ? 'bg-team-dark-20 border-team-blue-40 text-white placeholder-team-white-40'
                      : 'bg-gray-50 border-team-blue/60 text-team-blue placeholder-gray-500'
                  }`}
                  autoFocus
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
            ) : (
              <CardTitle
                ref={titleRef}
                className={`text-lg font-semibold line-clamp-3 break-words [overflow-wrap:anywhere] ${isDarkMode ? 'text-white' : 'text-team-blue'}`}
              >
                {session.sessionName || 'Untitled Session'}
              </CardTitle>
            )}
          </div>
          <div className="flex items-center gap-3 flex-shrink-0 ml-auto">
            {!isEditing && (
              <div className="flex items-center gap-2">
                {isSavingName ? (
                  <div className="h-4 w-4 border-2 border-team-blue border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onShare();
                      }}
                      className={`inline-flex items-center justify-center p-1.5 rounded-lg hover:bg-team-blue/20 transition-all transform hover:scale-110 ${
                        isDarkMode ? 'text-team-white-60' : 'text-gray-500'
                      } hover:text-team-blue`}
                      title="Share session"
                    >
                      <Share2 className="h-4 w-4" />
                    </button>
                    {onNameChange && (
                      <button
                        onClick={handleEditClick}
                        className={`inline-flex items-center justify-center p-1.5 rounded-lg hover:bg-team-blue/20 transition-all transform hover:scale-110 ${
                          isDarkMode ? 'text-team-white-60' : 'text-gray-500'
                        } hover:text-team-blue`}
                        title="Edit session name"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    )}
                    {onDelete && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={handleDeleteClick}
                          disabled={isDeleting}
                          className={`inline-flex items-center justify-center p-1.5 rounded-lg transition-all transform hover:scale-110 ${
                            isDeleting
                              ? 'opacity-50 cursor-not-allowed'
                              : deleteConfirm
                                ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg'
                                : `${isDarkMode ? 'text-team-white-60' : 'text-gray-500'} hover:bg-red-500/20 hover:text-red-500`
                          }`}
                          title={
                            isDeleting
                              ? 'Deleting...'
                              : deleteConfirm
                                ? 'Click again to confirm delete'
                                : 'Delete session'
                          }
                        >
                          {isDeleting ? (
                            <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </button>
                        {deleteConfirm && !isDeleting && (
                          <button
                            onClick={handleDeleteCancel}
                            className={`p-1.5 rounded-lg hover:bg-team-blue/20 transition-all transform hover:scale-110 ${
                              isDarkMode ? 'text-team-white-60' : 'text-gray-500'
                            }`}
                            title="Cancel delete"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
            <div className="flex items-center gap-2 bg-team-blue/15 px-4 py-2 rounded-xl shadow-md group-hover:shadow-lg transition-all duration-300">
              <Trophy className="h-5 w-5 text-team-blue group-hover:scale-110 transition-transform duration-300" />
              <span className="text-xl font-bold text-team-blue">
                {highestScore}
              </span>
            </div>
          </div>
        </div>

        <div
          className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}
        >
          <span className="inline-flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span>{formatDate(session.createdAt)}</span>
          </span>
          {/* Each separator stays with the item after it when the row wraps */}
          <span className="inline-flex items-center gap-2">
            <span className={isDarkMode ? 'text-gray-400' : 'text-gray-500'}>
              ·
            </span>
            <span data-testid="session-match-type">
              {matchTypeLabel(session)}
            </span>
          </span>
          {ownerName && (
            <span className="inline-flex items-center gap-2 min-w-0">
              <span className={isDarkMode ? 'text-gray-400' : 'text-gray-500'}>
                ·
              </span>
              <span className="break-words [overflow-wrap:anywhere]">
                {ownerName}
              </span>
            </span>
          )}
          {notSharedWith && (
            <span
              className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
                isDarkMode
                  ? 'border-team-blue-40 text-team-white-60'
                  : 'border-gray-300 text-gray-600'
              }`}
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
      </CardHeader>

      <CardContent className="pt-0 pb-6 px-6">
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
          <div className="flex items-center gap-3">
            <TrendingUp
              className={`h-4 w-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}
            />
            <div className="flex flex-col">
              <span
                className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}
              >
                Total Score
              </span>
              <span
                className={`font-medium ${isDarkMode ? 'text-white' : 'text-team-blue'}`}
              >
                {totalScore} pts
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Trophy
              className={`h-4 w-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}
            />
            <div className="flex flex-col">
              <span
                className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}
              >
                Avg Score
              </span>
              <span
                className={`font-medium ${isDarkMode ? 'text-white' : 'text-team-blue'}`}
              >
                {averageScore} pts
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Hash
              className={`h-4 w-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}
            />
            <div className="flex flex-col">
              <span
                className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}
              >
                Matches
              </span>
              <span
                className={`font-medium ${isDarkMode ? 'text-white' : 'text-team-blue'}`}
              >
                {matchCount}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Clock
              className={`h-4 w-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}
            />
            <div className="flex flex-col">
              <span
                className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}
              >
                Duration
              </span>
              <span
                className={`font-medium ${isDarkMode ? 'text-white' : 'text-team-blue'}`}
              >
                {session.sessionDuration || 'N/A'}
              </span>
            </div>
          </div>

          {/* SWARM and POLLINATOR only: a win or tie needs the opponent's score */}
          <div className="col-span-2 flex items-center gap-3">
            <Award
              className={`h-4 w-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}
            />
            <div className="flex flex-col">
              <span
                className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}
              >
                Ranking Points
              </span>
              <span
                data-testid="session-ranking-points"
                className={`font-medium ${isDarkMode ? 'text-white' : 'text-team-blue'}`}
              >
                {rp.rate === null
                  ? 'N/A'
                  : `${rp.earned} of ${rp.possible} RP (${rp.rate}%)`}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (isTitleTruncated) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          {cardContent}
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs break-words">
          {session.sessionName || 'Untitled Session'}
        </TooltipContent>
      </Tooltip>
    );
  }

  return cardContent;
};

const LoadingCard = () => {
  const { isDarkMode } = useTheme();

  return (
    <Card
      className={`${isDarkMode ? 'border-team-blue-40 bg-team-dark' : 'border-team-blue/40 bg-white'}`}
    >
      <CardHeader className="pb-4 pt-6 px-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="space-y-3 flex-1">
            <div className="h-6 bg-muted rounded animate-pulse w-40"></div>
          </div>
          <div className="h-8 bg-muted rounded animate-pulse w-16"></div>
        </div>
        <div className="h-4 bg-muted rounded animate-pulse w-32"></div>
      </CardHeader>

      <CardContent className="pt-0 pb-6 px-6">
        <div className="grid grid-cols-2 gap-x-6 gap-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-10 bg-muted rounded animate-pulse"></div>
          ))}
        </div>
      </CardContent>
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
  const [selectedMatchType, setSelectedMatchType] = useState<string>('all');
  /** Sessions deleted but still inside their undo window */
  const [hiddenIds, setHiddenIds] = useState(getPendingDeleteIds);
  /** Sessions a guest saved in this browser that the account doesn't have */
  const [guestSessionCount, setGuestSessionCount] = useState(0);
  const [importingGuestSessions, setImportingGuestSessions] = useState(false);
  const [importBannerDismissed, setImportBannerDismissed] = useState(false);

  const uid = user?.uid;
  const teamId = team?.id;

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

  const filtersActive = searchTerm.trim() !== '' || selectedMatchType !== 'all';

  const filteredSessions = useMemo(() => {
    let filtered = visibleSessions;

    const term = searchTerm.trim().toLowerCase();
    if (term) {
      filtered = filtered.filter(
        session =>
          session.sessionName?.toLowerCase().includes(term) ||
          matchTypeLabel(session).toLowerCase().includes(term) ||
          matchTypesOf(session).some(type => type.includes(term))
      );
    }

    if (selectedMatchType !== 'all') {
      // A session belongs under every type any of its matches was run as,
      // and under 'Mixed' when they weren't all the same.
      filtered = filtered.filter(
        session =>
          matchTypeLabel(session).toLowerCase() === selectedMatchType ||
          matchTypesOf(session).includes(selectedMatchType)
      );
    }

    return filtered;
  }, [visibleSessions, searchTerm, selectedMatchType]);

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedMatchType('all');
  };

  /** Quick Stats, over the same sessions the list can show */
  const quickStats = useMemo(() => {
    const scores = visibleSessions.flatMap(scoresOf);
    return {
      sessionCount: visibleSessions.length,
      matchCount: scores.length,
      averageScore:
        scores.length > 0
          ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
          : 0,
      bestScore: scores.length > 0 ? Math.max(...scores) : 0,
    };
  }, [visibleSessions]);

  /** The author of a session (and a guest, of their own) can rename it. */
  const canRename = (session: Session): boolean =>
    isGuest || (!!uid && session.userId === uid);

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

  const handleViewSession = (sessionId: string) => {
    navigate(`/analysis?sessionId=${sessionId}`);
  };

  const handleUpdateSessionName = async (sessionId: string, newName: string) => {
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

  const handleShareSession = async (session: Session) => {
    if (isGuest) {
      toast.error('Create an account to share sessions');
      return;
    }
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
      const plural = (n: number) => `${n} session${n === 1 ? '' : 's'}`;
      if (imported > 0) toast.success(`Imported ${plural(imported)}`);
      if (failed > 0) {
        toast.error(
          `Couldn't import ${plural(failed)}. ${failed === 1 ? 'It is' : 'They are'} still saved on this device - try again.`
        );
      }
      if (overLimit > 0) {
        toast.error(
          `${plural(overLimit)} not imported: accounts hold ${SESSION_LIMITS.MAX_SESSIONS_PER_USER} sessions. Delete some of your own old sessions, then import again.`,
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
    return member?.displayName || member?.email || session.userEmail || undefined;
  };

  const handleExportCSV = () => {
    if (visibleSessions.length === 0) {
      toast.error('No sessions to export');
      return;
    }

    downloadCsv(
      `sessions-export-${new Date().toISOString().split('T')[0]}.csv`,
      buildSessionsCsv(visibleSessions)
    );
    toast.success('Sessions exported to CSV');
  };

  return (
    <div
      className={`min-h-[100dvh] page-transition ${isDarkMode ? 'bg-team-dark' : 'bg-[#FEFEFE]'}`}
    >
      <div className="max-w-[1152px] mx-auto px-2 sm:px-3 md:px-4 lg:px-6 xl:px-8 py-4 sm:py-6 md:py-8 lg:py-12">
        <div className="mb-4 sm:mb-6 md:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 md:gap-4">
            <div className="flex flex-col gap-3">
              <h1
                className={`text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold ${isDarkMode ? 'text-white' : 'text-team-blue'}`}
              >
                {team ? team.name : 'My Sessions'}
              </h1>
              {!isGuest && <TeamManager onTeamChange={() => loadSessions()} />}
            </div>
            <div className="flex gap-1 sm:gap-2 md:gap-3 flex-wrap">
              {visibleSessions.length > 0 && (
                <Button
                  onClick={() => navigate(ROUTES.CHARTS)}
                  className={`bg-team-blue hover:bg-team-blue/90 transition-colors text-xs sm:text-sm md:text-base px-2 sm:px-3 md:px-4 py-2 min-h-[40px] sm:min-h-[44px] flex items-center gap-1 sm:gap-1.5 ${
                    isDarkMode ? '!text-black' : '!text-white'
                  }`}
                >
                  <TrendingUp className="h-3 sm:h-4 w-3 sm:w-4" />
                  <span className="hidden sm:inline">Charts</span>
                  <span className="sm:hidden">Stats</span>
                </Button>
              )}
              {visibleSessions.length > 1 && (
                <Button
                  onClick={() => navigate(ROUTES.COMPARE)}
                  className={`border border-team-blue hover:bg-team-blue/10 transition-colors text-xs sm:text-sm md:text-base px-2 sm:px-3 py-2 min-h-[40px] sm:min-h-[44px] flex items-center gap-1 sm:gap-1.5 ${
                    isDarkMode
                      ? 'text-team-blue border-team-blue-40'
                      : 'text-team-blue border-team-blue-40'
                  }`}
                  variant="outline"
                >
                  <BarChart3 className="h-3 sm:h-4 w-3 sm:w-4" />
                  <span className="hidden sm:inline">Compare</span>
                  <span className="sm:hidden">Comp</span>
                </Button>
              )}
              {visibleSessions.length > 0 && (
                <Button
                  onClick={handleExportCSV}
                  className={`border border-team-blue hover:bg-team-blue/10 transition-colors text-xs sm:text-sm md:text-base px-2 sm:px-3 py-2 min-h-[40px] sm:min-h-[44px] flex items-center gap-1 sm:gap-1.5 ${
                    isDarkMode
                      ? 'text-team-blue border-team-blue-40'
                      : 'text-team-blue border-team-blue-40'
                  }`}
                  variant="outline"
                >
                  <Download className="h-3 sm:h-4 w-3 sm:w-4" />
                  <span className="hidden sm:inline">Export</span>
                  <span className="sm:hidden">CSV</span>
                </Button>
              )}
            </div>
          </div>
        </div>

        {!isGuest && guestSessionCount > 0 && !importBannerDismissed && (
          <div
            role="region"
            aria-label="Import sessions saved on this device"
            className={`mb-6 p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center gap-3 ${
              isDarkMode
                ? 'bg-team-blue/10 border-team-blue-40'
                : 'bg-team-blue/5 border-team-blue/40'
            }`}
          >
            <div className="flex-1 min-w-0">
              <p
                className={`font-semibold ${isDarkMode ? 'text-white' : 'text-team-blue'}`}
              >
                {guestSessionCount} session{guestSessionCount === 1 ? '' : 's'}{' '}
                saved on this device
              </p>
              <p
                className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}
              >
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
                className={`inline-flex items-center justify-center p-2 rounded-lg hover:bg-team-blue/20 transition-colors disabled:opacity-50 ${
                  isDarkMode ? 'text-team-white-60' : 'text-gray-500'
                }`}
                aria-label="Not now"
                title="Not now"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {!loading && visibleSessions.length > 0 && (
          <div
            className={`mb-6 p-4 sm:p-6 lg:p-8 rounded-2xl border shadow-lg ${
              isDarkMode
                ? 'bg-team-dark-20 border-team-blue-40'
                : 'bg-white border-gray-200'
            }`}
          >
            <h3
              className={`text-lg sm:text-xl font-semibold mb-4 sm:mb-6 flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-team-blue'}`}
            >
              <TrendingUp className="h-4 sm:h-5 w-4 sm:w-5" />
              Quick Stats
            </h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
              <div
                className={`p-4 rounded-xl transition-all duration-300 hover:scale-105 ${isDarkMode ? 'bg-team-blue/10 hover:bg-team-blue/20' : 'bg-team-blue/5 hover:bg-team-blue/10'}`}
              >
                <div className="text-2xl sm:text-3xl font-bold text-team-blue mb-1">
                  {quickStats.sessionCount}
                </div>
                <div
                  className={`text-xs sm:text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}
                >
                  Total Sessions
                </div>
              </div>
              <div
                className={`p-4 rounded-xl transition-all duration-300 hover:scale-105 ${isDarkMode ? 'bg-team-blue/10 hover:bg-team-blue/20' : 'bg-team-blue/5 hover:bg-team-blue/10'}`}
              >
                <div className="text-2xl sm:text-3xl font-bold text-team-blue mb-1">
                  {quickStats.averageScore}
                </div>
                <div
                  className={`text-xs sm:text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}
                >
                  Avg Score
                </div>
              </div>
              <div
                className={`p-4 rounded-xl transition-all duration-300 hover:scale-105 ${isDarkMode ? 'bg-team-blue/10 hover:bg-team-blue/20' : 'bg-team-blue/5 hover:bg-team-blue/10'}`}
              >
                <div className="text-2xl sm:text-3xl font-bold text-team-blue mb-1">
                  {quickStats.bestScore}
                </div>
                <div
                  className={`text-xs sm:text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}
                >
                  Best Score
                </div>
              </div>
              <div
                className={`p-4 rounded-xl transition-all duration-300 hover:scale-105 ${isDarkMode ? 'bg-team-blue/10 hover:bg-team-blue/20' : 'bg-team-blue/5 hover:bg-team-blue/10'}`}
              >
                <div className="text-2xl sm:text-3xl font-bold text-team-blue mb-1">
                  {quickStats.matchCount}
                </div>
                <div
                  className={`text-xs sm:text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}
                >
                  Total Matches
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="mb-6">
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <div className="flex-1 relative">
              <Search
                className={`absolute left-3 md:left-4 top-1/2 transform -translate-y-1/2 h-4 w-4 transition-colors ${isDarkMode ? 'text-team-white-40' : 'text-gray-400'}`}
              />
              <Input
                placeholder="Search sessions..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className={`pl-10 md:pl-12 h-10 md:h-11 text-sm md:text-base rounded-xl shadow-sm transition-all duration-200 focus:shadow-md ${
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
                className={`w-full sm:w-[180px] h-10 md:h-11 text-sm md:text-base rounded-xl shadow-sm border ${
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
                <SelectItem value="all">All Match Types</SelectItem>
                {MATCH_TYPE_FILTERS.map(({ value, label }) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
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
            <h3
              className={`text-lg font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-team-blue'}`}
            >
              {loadFailed
                ? "Couldn't load your sessions"
                : filtersActive
                  ? 'No sessions match these filters'
                  : 'No sessions yet'}
            </h3>
            <p
              className={`mb-6 ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
            >
              {loadFailed
                ? 'Check your connection, then reload the page'
                : filtersActive
                  ? 'Try a different search or match type'
                  : isGuest
                    ? 'Create an account to save your practice sessions'
                    : 'Start tracking your practice sessions to see them here'}
            </p>
            {!loadFailed && filtersActive && (
              <Button
                onClick={clearFilters}
                variant="outline"
                className={
                  isDarkMode
                    ? 'border-team-blue-40 text-team-white hover:bg-team-blue-10'
                    : 'border-gray-300'
                }
              >
                Clear filters
              </Button>
            )}
            {!loadFailed && !filtersActive && !isGuest && (
              <Button
                onClick={() => {
                  resetSession();
                  navigate(ROUTES.ACTIVE);
                }}
                disabled={hasActiveSession}
                title={hasActiveSession ? 'Complete or cancel the active session first' : undefined}
                className={`bg-team-blue hover:bg-team-blue/90 disabled:opacity-50 disabled:cursor-not-allowed ${isDarkMode ? 'text-black' : 'text-white'}`}
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Session
              </Button>
            )}
            {!loadFailed && !filtersActive && isGuest && (
              <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
                <Button
                  onClick={() => navigate('/signup')}
                  className={`bg-team-blue hover:bg-team-blue/90 ${isDarkMode ? 'text-black' : 'text-white'}`}
                >
                  Sign Up to Save Sessions
                </Button>
                <Button
                  onClick={() => navigate('/active')}
                  variant="outline"
                  className={
                    isDarkMode
                      ? 'border-team-blue-40 text-team-white hover:bg-team-blue-10'
                      : 'border-gray-300'
                  }
                >
                  Start Practice Session
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {filteredSessions.map(session => (
              <SessionCard
                key={session.id}
                session={session}
                onView={() => handleViewSession(session.id)}
                onNameChange={
                  canRename(session)
                    ? newName => handleUpdateSessionName(session.id, newName)
                    : undefined
                }
                onShare={() => handleShareSession(session)}
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
      </div>
    </div>
  );
};

export default Sessions;
