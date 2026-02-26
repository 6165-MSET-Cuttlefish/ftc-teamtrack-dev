import { useTheme } from '@/contexts';
import { APP_CONFIG } from '@/constants';
import { Monitor } from 'lucide-react';
import { useEffect } from 'react';

const Mobile = () => {
  const { isDarkMode } = useTheme();

  useEffect(() => {
    document.title = `Mobile Not Supported - ${APP_CONFIG.name}`;
  }, []);

  return (
    <div
      className={`min-h-screen flex items-center justify-center px-6 ${isDarkMode ? 'bg-team-dark' : 'bg-[#FEFEFE]'}`}
    >
      <div className="text-center max-w-sm">
        <div className="mb-6 flex justify-center">
          <div
            className={`w-20 h-20 rounded-2xl flex items-center justify-center ${
              isDarkMode ? 'bg-team-blue/10' : 'bg-team-blue/5'
            }`}
          >
            <Monitor className="h-10 w-10 text-team-blue" />
          </div>
        </div>
        <h1
          className={`text-2xl font-bold mb-3 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
        >
          Mobile Support Coming Soon
        </h1>
        <p
          className={`text-sm leading-relaxed ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
        >
          Mobile support is coming in a future update. Please use {APP_CONFIG.name} on a computer.
        </p>
      </div>
    </div>
  );
};

export default Mobile;
