import { Link, useNavigate } from 'react-router-dom';
import { useTheme } from '@/contexts';
import { APP_CONFIG, ROUTES } from '@/constants';
import { ArrowLeft, Home, Compass } from 'lucide-react';
import { useEffect } from 'react';

const NotFound = () => {
  const { isDarkMode } = useTheme();
  const navigate = useNavigate();

  useEffect(() => {
    document.title = `Page Not Found - ${APP_CONFIG.name}`;
  }, []);

  return (
    <div
      className={`min-h-screen flex items-center justify-center px-4 page-transition ${isDarkMode ? 'bg-team-dark' : 'bg-[#FEFEFE]'}`}
    >
      <div className="text-center max-w-md">
        <div className="mb-6 flex justify-center">
          <div
            className={`w-20 h-20 rounded-2xl flex items-center justify-center ${
              isDarkMode ? 'bg-team-blue/10' : 'bg-team-blue/5'
            }`}
          >
            <Compass className="h-10 w-10 text-team-blue animate-pulse-subtle" />
          </div>
        </div>
        <h1
          className="text-8xl font-bold mb-3 text-team-blue"
        >
          404
        </h1>
        <p
          className={`${isDarkMode ? 'text-white' : 'text-gray-900'} text-xl font-semibold mb-2`}
        >
          Page not found
        </p>
        <p
          className={`${isDarkMode ? 'text-team-white-60' : 'text-gray-600'} text-sm mb-8 max-w-xs mx-auto`}
        >
          The page you're looking for doesn't exist or may have been moved.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            to={ROUTES.SESSIONS}
            className={`inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-team-blue text-sm font-medium hover:bg-team-blue/90 transition-all duration-200 hover:scale-[1.02] shadow-lg hover:shadow-xl ${isDarkMode ? 'text-black' : 'text-white'}`}
          >
            <Home className="h-4 w-4" />
            Go to Sessions
          </Link>
          <button
            onClick={() => {
              if (window.history.length > 1) {
                navigate(-1);
              } else {
                navigate(ROUTES.SESSIONS);
              }
            }}
            aria-label="Go back to the previous page"
            className={`inline-flex items-center gap-2 px-6 py-2.5 rounded-lg border text-sm font-medium transition-all duration-200 hover:scale-[1.02] ${
              isDarkMode
                ? 'border-team-blue-40 text-team-white-60 hover:bg-team-blue/10 hover:text-white'
                : 'border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <ArrowLeft className="h-4 w-4" />
            Go Back
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
