import { Link } from 'react-router-dom';
import { useTheme } from '@/contexts';
import { ROUTES } from '@/constants';
import { ArrowLeft, Home } from 'lucide-react';

const NotFound = () => {
  const { isDarkMode } = useTheme();

  return (
    <div
      className={`min-h-screen flex items-center justify-center px-4 ${isDarkMode ? 'bg-team-dark' : 'bg-gray-100'}`}
    >
      <div className="text-center max-w-md">
        <h1
          className={`text-7xl font-bold mb-2 ${isDarkMode ? 'text-team-blue' : 'text-team-blue'}`}
        >
          404
        </h1>
        <p
          className={`${isDarkMode ? 'text-white' : 'text-gray-900'} text-xl font-semibold mb-2`}
        >
          Page not found
        </p>
        <p
          className={`${isDarkMode ? 'text-team-white-60' : 'text-gray-600'} text-sm mb-8`}
        >
          The page you're looking for doesn't exist or may have been moved.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            to={ROUTES.SESSIONS}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-team-blue text-white text-sm font-medium hover:bg-team-blue/90 transition-colors"
          >
            <Home className="h-4 w-4" />
            Go to Sessions
          </Link>
          <button
            onClick={() => window.history.back()}
            className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
              isDarkMode
                ? 'border-team-blue-40 text-team-white-60 hover:bg-team-blue/10'
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
