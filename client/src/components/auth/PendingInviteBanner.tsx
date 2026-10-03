import { useState } from 'react';
import { Users } from 'lucide-react';
import { useTheme } from '@/contexts';
import { APP_CONFIG } from '@/constants';
import { hasPendingInvite } from '@/lib/pendingInvite';

/**
 * Shown above the sign-in and sign-up forms to someone who opened a team
 * invite while signed out: says why they are here and that the invite is
 * still waiting. Renders nothing without a remembered, unexpired invite.
 */
export const PendingInviteBanner = () => {
  const { isDarkMode } = useTheme();
  const [pending] = useState(hasPendingInvite);

  if (!pending) return null;

  return (
    <div
      role="status"
      className={`flex items-start gap-3 rounded-lg border p-3 text-sm ${
        isDarkMode
          ? 'border-team-blue-40 bg-team-blue-10 text-team-white'
          : 'border-team-blue/40 bg-team-blue/5 text-gray-800'
      }`}
    >
      <Users
        aria-hidden="true"
        className="mt-0.5 h-4 w-4 shrink-0 text-team-blue"
      />
      <p>
        You've been invited to join a team on {APP_CONFIG.name}. Sign in or
        create an account to continue.
      </p>
    </div>
  );
};
