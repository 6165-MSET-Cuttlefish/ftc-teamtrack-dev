import { useTheme } from '@/contexts';

const NotFound = () => {
  const { isDarkMode } = useTheme();

  return (
    <div
      className={`min-h-screen flex items-center justify-center ${isDarkMode ? 'bg-team-dark' : 'bg-gray-100'}`}
    >
      <div className="text-center">
        <h1
          className={`text-4xl font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-black'}`}
        >
          404
        </h1>
        <p
          className={`${isDarkMode ? 'text-team-white-60' : 'text-gray-600'} text-xl mb-4`}
        >
          Oops! Page not found
        </p>
        <a
          href="/"
          className={`${isDarkMode ? 'text-team-white-60' : 'text-blue-500'} underline`}
        >
          Return to Home
        </a>
      </div>
    </div>
  );
};

export default NotFound;
