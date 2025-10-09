import { useTheme } from '../contexts/ThemeContext';
import { SessionSetup } from '../components/SessionSetup';
import { PerformanceMetrics } from '../components/PerformanceMetrics';
import { LivePreview } from '../components/LivePreview';

const Original = () => {
  const { isDarkMode } = useTheme();

  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-team-dark' : 'bg-gray-50'}`}>
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Header */}
            <header className="text-center space-y-4">
              <h1 className={`text-3xl lg:text-4xl font-bold ${
                isDarkMode ? 'text-white' : 'text-team-blue'
              }`}>
                Create Practice Session
              </h1>
              <p className={`text-lg ${
                isDarkMode ? 'text-team-white-60' : 'text-muted-foreground'
              }`}>
                6165 MSET Cuttlefish - FTC Team Tracker
              </p>
            </header>

            {/* Session Components */}
            <div className="space-y-8">
              <div className={`p-6 rounded-lg ${
                isDarkMode 
                  ? 'bg-team-dark-20 border border-team-white-20' 
                  : 'bg-white border border-muted shadow-sm'
              }`}>
                <SessionSetup />
              </div>
              
              <div className={`p-6 rounded-lg ${
                isDarkMode 
                  ? 'bg-team-dark-20 border border-team-white-20' 
                  : 'bg-white border border-muted shadow-sm'
              }`}>
                <PerformanceMetrics />
              </div>
            </div>
          </div>

          {/* Sidebar - Live Preview */}
          <div className="lg:col-span-1">
            <div className="sticky top-24">
              <div className={`p-6 rounded-lg ${
                isDarkMode 
                  ? 'bg-team-dark-20 border border-team-white-20' 
                  : 'bg-white border border-muted shadow-sm'
              }`}>
                <LivePreview />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Original;