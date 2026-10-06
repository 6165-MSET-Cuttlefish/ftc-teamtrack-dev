import { useEffect, useState } from 'react';
import { firebaseService } from '@/services';
import type { ShareLink } from '@/services/firebaseService';
import { formatDate, logger } from '@/lib';
import { ROUTES } from '@/constants';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ignoreHeldEnter } from '@/components/session/controls/ignoreHeldEnter';
import { useArmedAfterOpen } from '@/hooks/useArmedAfterOpen';

const DAY: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
};

/**
 * The facts under a link's name. Each one is kept whole on a line: a narrow
 * row wraps between them, never inside one ('3 / matches').
 */
const describe = (link: ShareLink): string[] =>
  [
    link.createdAt ? `Shared ${formatDate(link.createdAt, DAY)}` : null,
    `${link.matchCount} match${link.matchCount === 1 ? '' : 'es'}`,
    link.madeByUser ? null : 'by a teammate',
  ].filter((part): part is string => part !== null);

/**
 * Every share link the user can take down, each with a way to do it. A link
 * is a snapshot, so it outlives what it was made from: this lists it even
 * when its session has been deleted or is from an older season, which no
 * session card or analysis page can.
 */
export const ShareLinks = ({
  userId,
  isDarkMode,
}: {
  userId: string;
  isDarkMode: boolean;
}) => {
  /** Null until the first answer from the server */
  const [links, setLinks] = useState<ShareLink[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  /** The link being removed, or 'all' */
  const [removing, setRemoving] = useState<string | null>(null);
  const [confirmingAll, setConfirmingAll] = useState(false);
  // The question takes the pressed button's place, so the second press of
  // a double click or tap lands on it: it waits that out. Timed from each
  // time it is asked, so asking again right after it was dismissed is
  // guarded too.
  const allArmed = useArmedAfterOpen(confirmingAll);

  useEffect(() => {
    let mounted = true;
    firebaseService.getShareLinks(userId).then(
      found => {
        if (!mounted) return;
        setLinks(found);
        setFailed(false);
      },
      error => {
        logger.error('Error loading share links', error);
        if (mounted) setFailed(true);
      }
    );
    return () => {
      mounted = false;
    };
  }, [userId, attempt]);

  const remove = async (ids: string[], key: string) => {
    setRemoving(key);
    try {
      await firebaseService.deleteShareLinks(userId, ids);
      setLinks(prev => prev && prev.filter(link => !ids.includes(link.id)));
      toast.success(
        ids.length === 1
          ? 'Share link removed'
          : `Removed ${ids.length} share links`,
        {
          description:
            ids.length === 1
              ? 'It no longer opens for anyone.'
              : 'They no longer open for anyone.',
        }
      );
    } catch (error) {
      logger.error('Error removing share links', error);
      toast.error('Failed to remove share links', {
        // Firestore errors carry a code; anything else is one of our own
        // messages, written to be shown.
        description:
          error instanceof Error && !('code' in error)
            ? error.message
            : undefined,
      });
    } finally {
      setRemoving(null);
      setConfirmingAll(false);
    }
  };

  const muted = `text-sm ${isDarkMode ? 'text-team-white-60' : 'text-gray-500'}`;

  if (failed) {
    return (
      <div className="flex items-center justify-between gap-3">
        <p className={muted}>Couldn't load your share links.</p>
        <Button
          variant="neutral"
          size="sm"
          className="shrink-0"
          onClick={() => {
            setFailed(false);
            setAttempt(n => n + 1);
          }}
        >
          Try again
        </Button>
      </div>
    );
  }

  if (!links) return <p className={muted}>Loading share links…</p>;

  if (links.length === 0) {
    return <p className={muted}>You have no share links.</p>;
  }

  return (
    <div className="space-y-3">
      {/* Rows divided by rules, not boxed in a second border inside the card */}
      <ul
        className={`divide-y ${
          isDarkMode ? 'divide-team-blue-40' : 'divide-gray-200'
        }`}
      >
        {links.map(link => {
          const name = link.sessionName || 'Untitled session';
          return (
            <li
              key={link.id}
              className="flex items-center justify-between gap-3 py-3 first:pt-0"
            >
              <a
                href={`${ROUTES.SHARED_SESSION}?id=${link.id}`}
                target="_blank"
                rel="noopener noreferrer"
                title="Open the shared page"
                className="block min-w-0"
              >
                <span
                  className={`block truncate text-sm font-medium underline underline-offset-4 ${
                    isDarkMode ? 'text-white' : 'text-gray-900'
                  }`}
                >
                  {name}
                </span>
                <span
                  className={`flex flex-wrap gap-x-1.5 text-xs mt-0.5 ${isDarkMode ? 'text-team-white-60' : 'text-gray-500'}`}
                >
                  {describe(link).map(part => (
                    <span
                      key={part}
                      className="whitespace-nowrap before:mr-1.5 before:content-['·'] first:before:content-none"
                    >
                      {part}
                    </span>
                  ))}
                </span>
              </a>
              <Button
                variant="neutral"
                size="sm"
                className="shrink-0"
                disabled={removing !== null}
                aria-label={`Remove share link for ${name}`}
                onClick={() => remove([link.id], link.id)}
              >
                {removing === link.id ? 'Removing…' : 'Remove'}
              </Button>
            </li>
          );
        })}
      </ul>
      {links.length > 1 && (
        // Asks once, in the red of a delete: the next press takes every link
        // down, once the question has been up long enough to be read. There
        // is no Undo.
        <Button
          variant={confirmingAll ? 'dangerOutline' : 'neutral'}
          size="sm"
          disabled={removing !== null}
          onBlur={() => setConfirmingAll(false)}
          // Held down, Enter would ask and then answer
          onKeyDown={ignoreHeldEnter}
          onClick={() => {
            if (!confirmingAll) {
              setConfirmingAll(true);
            } else if (allArmed()) {
              remove(
                links.map(link => link.id),
                'all'
              );
            }
          }}
        >
          {removing === 'all'
            ? 'Removing…'
            : confirmingAll
              ? `Remove all ${links.length} links?`
              : 'Remove all'}
        </Button>
      )}
    </div>
  );
};
