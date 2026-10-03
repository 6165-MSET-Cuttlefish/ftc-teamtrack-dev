import { Link, useLocation } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ROUTES } from '@/constants';
import type { AuthErrorAction, AuthErrorInfo } from '@/lib/authErrors';

const ACTION_LINKS: Record<AuthErrorAction, { to: string; label: string }> = {
  'forgot-password': {
    to: ROUTES.FORGOT_PASSWORD,
    label: 'Forgot your password?',
  },
  'sign-in': { to: ROUTES.LOGIN, label: 'Sign in instead' },
  'sign-up': { to: ROUTES.SIGNUP, label: 'Sign up instead' },
};

interface AuthErrorAlertProps {
  error: AuthErrorInfo | null;
  /** The ways out this page can offer (not a link to the page itself) */
  actions?: AuthErrorAction[];
}

/**
 * The error above a sign-in, sign-up or reset form: what went wrong in plain
 * words, and the way out when there is one.
 */
export const AuthErrorAlert = ({ error, actions = [] }: AuthErrorAlertProps) => {
  const location = useLocation();
  if (!error) return null;

  const link =
    error.action && actions.includes(error.action)
      ? ACTION_LINKS[error.action]
      : null;

  return (
    <Alert variant="destructive">
      <AlertCircle aria-hidden="true" className="h-4 w-4" />
      <AlertDescription className="flex flex-wrap items-center gap-x-2">
        <span>{error.message}</span>
        {link && (
          // Carries where they were headed, like the links under the form.
          // On a phone the link is a 44px target (global.css); the negative
          // margin keeps that from doubling the space under it.
          <Link
            to={link.to}
            state={location.state}
            className="inline-flex items-center font-semibold underline underline-offset-2 hover:no-underline [@media(max-width:640px)]:-mb-3"
          >
            {link.label}
          </Link>
        )}
      </AlertDescription>
    </Alert>
  );
};
