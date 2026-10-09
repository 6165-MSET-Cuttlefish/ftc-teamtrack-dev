import type { HTMLAttributes, Ref } from 'react';
import { Link } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { ROUTES } from '@/constants';

interface SignUpToShareProps
  extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** The lock goes in the line itself, before its first word */
  lock?: boolean;
  /** Lines end at the right from 640px, as in the Analysis header */
  endFromSm?: boolean;
  /** The Sign up link, for whoever moves focus to it */
  linkRef?: Ref<HTMLAnchorElement>;
}

/**
 * "Sharing needs a free account. Sign up", for a guest. When it can't fit
 * on one line it breaks before Sign up.
 */
export const SignUpToShare = ({
  lock = false,
  endFromSm = false,
  linkRef,
  className = '',
  ...rest
}: SignUpToShareProps) => (
  <div {...rest} className={className}>
    <p
      className={`flex flex-wrap items-center gap-x-1.5 ${endFromSm ? 'sm:justify-end' : ''}`}
    >
      <span className="min-w-0">
        {lock && (
          <Lock
            size={14}
            aria-hidden
            className="mr-1.5 inline-block align-[-2px]"
          />
        )}
        Sharing needs a free account.
      </span>
      <span className="whitespace-nowrap">
        {/* 44px tall to a finger, but the line (and the focus ring) stay text height */}
        <Link
          ref={linkRef}
          to={ROUTES.SIGNUP}
          className="relative inline-flex min-h-0 items-center font-semibold text-team-blue underline underline-offset-4 after:absolute after:inset-x-0 [@media(pointer:coarse)]:after:inset-y-[calc((100%_-_2.75rem)/2)]"
        >
          Sign up
        </Link>
      </span>
    </p>
  </div>
);
