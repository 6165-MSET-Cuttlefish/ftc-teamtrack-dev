import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTheme } from '@/contexts';
import { APP_CONFIG, ROUTES } from '@/constants';
import { Button } from '@/components/ui/button';
import { EYEBROW_CLASS, PAGE_TITLE_CLASS } from '@/components/ui/page-header';

/**
 * An unknown address: what happened in one line, one way on (Sessions), and
 * a quiet way back. The header's back arrow and logo cover the rest.
 */
const NotFound = () => {
  const { isDarkMode } = useTheme();
  const navigate = useNavigate();

  useEffect(() => {
    document.title = `Page Not Found - ${APP_CONFIG.name}`;
  }, []);

  return (
    // flex-1 under the header (main is a flex column), not a second screen
    // height that scrolls by exactly the header's.
    <div
      className={`flex-1 flex items-center justify-center px-4 py-12 page-transition ${isDarkMode ? 'bg-team-dark' : 'bg-[#FEFEFE]'}`}
    >
      <div className="text-center max-w-md">
        <p className={`${EYEBROW_CLASS} mb-2`}>Error 404</p>
        <h1 className={`${PAGE_TITLE_CLASS} mb-3`}>Page not found</h1>
        <p
          className={`${isDarkMode ? 'text-team-white-60' : 'text-gray-600'} text-sm sm:text-base mb-8 max-w-xs mx-auto text-balance`}
        >
          The page you're looking for doesn't exist or may have been moved.
        </p>
        <div className="flex flex-col items-center gap-2">
          {/* The view's one fill: the header's New Session steps back */}
          <Button
            asChild
            variant="primary"
            size="touch"
            className="px-6"
            data-page-primary
          >
            <Link to={ROUTES.SESSIONS}>Go to Sessions</Link>
          </Button>
          <button
            type="button"
            onClick={() => {
              if (window.history.length > 1) {
                navigate(-1);
              } else {
                navigate(ROUTES.SESSIONS);
              }
            }}
            className={`inline-flex items-center rounded-md px-2 text-sm font-medium hover:underline [@media(pointer:coarse)]:min-h-11 min-h-9 ${isDarkMode ? 'text-team-white-60 hover:text-white' : 'text-gray-600 hover:text-gray-900'}`}
          >
            Go back
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
