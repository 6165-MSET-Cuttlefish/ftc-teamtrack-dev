import { useEffect, useState } from 'react';
import { Link, generatePath } from 'react-router-dom';
import { Radio } from 'lucide-react';
import { useAuth, useTeam, useTheme } from '@/contexts';
import { ROUTES } from '@/constants';
import { LIVE_STALE_MS, liveService } from '@/services/liveService';
import type { LiveSession } from '@/types';

/**
 * Teammates' sessions shared live right now, at the top of My Sessions:
 * who, which session and match, and a way in to watch or score Robot 2.
 * One whose host has gone quiet (closed the page without stopping) is left
 * out. The viewer's own is left out too: they are scoring it.
 */
export const LiveNowBanner = () => {
  const { user, isGuest } = useAuth();
  const { team } = useTeam();
  const { isDarkMode } = useTheme();
  const [live, setLive] = useState<LiveSession[]>([]);
  const [now, setNow] = useState(() => Date.now());

  const teamId = !isGuest ? team?.id : undefined;
  useEffect(() => {
    if (!teamId) {
      setLive([]);
      return;
    }
    return liveService.watchTeam(teamId, setLive);
  }, [teamId]);

  // Quiet hosts drop off without a change to the list
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const shown = live.filter(
    l =>
      l.hostId !== user?.uid &&
      !l.state.completed &&
      now - l.updatedAt < LIVE_STALE_MS
  );
  if (shown.length === 0) return null;

  const tone = isDarkMode
    ? 'bg-red-500/10 border-red-500/40 text-gray-100'
    : 'bg-red-50 border-red-300 text-gray-900';
  const base =
    'inline-flex min-h-9 items-center justify-center rounded-lg border-2 px-3 text-sm font-semibold transition-colors [@media(pointer:coarse)]:min-h-11';
  const button = `${base} ${
    isDarkMode
      ? 'border-team-blue-40 text-white hover:bg-team-white-10'
      : 'border-gray-400 text-gray-900 hover:bg-gray-100'
  }`;
  const primary = `${base} border-team-blue bg-team-blue ${
    isDarkMode
      ? 'text-black hover:brightness-110'
      : 'text-white hover:brightness-90'
  }`;

  return (
    <div
      role="region"
      aria-label="Live now"
      className="mb-4 flex flex-col gap-2"
    >
      {shown.map(l => {
        const path = generatePath(ROUTES.LIVE, { hostId: l.hostId });
        const robot2Free = !l.robot2?.scorerId;
        return (
          <div
            key={l.hostId}
            className={`flex flex-col gap-3 rounded-2xl border p-3 sm:flex-row sm:items-center ${tone}`}
          >
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <Radio
                aria-hidden
                className="h-4 w-4 shrink-0 text-red-500 motion-safe:animate-pulse"
              />
              <p className="min-w-0 text-sm">
                <span className="font-semibold">Live now: </span>
                <span className="font-semibold">{l.sessionName}</span>
                <span className="text-muted-foreground">
                  {' '}
                  by {l.hostName} · Match {l.matchNumber}
                  {l.robot2?.scorerId
                    ? ` · ${l.robot2.scorerName} on Robot 2`
                    : ''}
                </span>
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Link to={path} className={button}>
                Watch
              </Link>
              {robot2Free && (
                <Link to={`${path}?score=robot2`} className={primary}>
                  Score Robot 2
                </Link>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
