import { useEffect, useState } from 'react';
import { firebaseService } from '@/services';
import type { ShareLink } from '@/services/firebaseService';
import { formatDate, logger } from '@/lib';
import { ROUTES } from '@/constants';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

const DAY: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
};

const describe = (link: ShareLink): string =>
  [
    link.createdAt ? `Shared ${formatDate(link.createdAt, DAY)}` : null,
    `${link.matchCount} match${link.matchCount === 1 ? '' : 'es'}`,
    link.madeByUser ? null : 'by a teammate',
  ]
    .filter(Boolean)
    .join(' · ');

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
  const outline = isDarkMode ? 'border-team-blue-40 text-team-white-60' : '';

  if (failed) {
    return (
      <div className="flex items-center justify-between gap-3">
        <p className={muted}>Couldn't load your share links.</p>
        <Button
          variant="outline"
          size="sm"
          className={`shrink-0 ${outline}`}
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
      <ul
        className={`divide-y rounded-lg border ${
          isDarkMode
            ? 'border-team-blue-40 divide-team-blue-40'
            : 'border-gray-200 divide-gray-200'
        }`}
      >
        {links.map(link => {
          const name = link.sessionName || 'Untitled session';
          return (
            <li
              key={link.id}
              className="flex items-center justify-between gap-3 p-3"
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
                  className={`block text-xs mt-0.5 ${isDarkMode ? 'text-team-white-60' : 'text-gray-500'}`}
                >
                  {describe(link)}
                </span>
              </a>
              <Button
                variant="outline"
                size="sm"
                className={`shrink-0 ${outline}`}
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
        <Button
          variant="outline"
          size="sm"
          className={outline}
          disabled={removing !== null}
          onBlur={() => setConfirmingAll(false)}
          onClick={() =>
            confirmingAll
              ? remove(
                  links.map(link => link.id),
                  'all'
                )
              : setConfirmingAll(true)
          }
        >
          {removing === 'all'
            ? 'Removing…'
            : confirmingAll
              ? `Click again to remove all ${links.length}`
              : 'Remove all'}
        </Button>
      )}
    </div>
  );
};
