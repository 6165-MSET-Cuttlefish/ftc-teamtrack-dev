import { Link } from "react-router-dom";
import { Header } from "../components/Header";
import { SessionSetup } from "../components/SessionSetup";
import { PerformanceMetrics } from "../components/PerformanceMetrics";
import { Notes } from "../components/Notes";
import { LivePreview } from "../components/LivePreview";
import { SessionProvider } from "../contexts/SessionContext";
import { ThemeProvider, useTheme } from "../contexts/ThemeContext";

const OriginalContent = () => {
  const { isDarkMode } = useTheme();

  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-team-dark' : 'bg-white'}`}>
      <Header />

      <div className="flex flex-col lg:flex-row items-start max-w-[1216px] mx-auto px-4 sm:px-8 py-5 lg:py-10 gap-6 lg:gap-10">
        {/* Left Column - Session Form */}
        <div className="flex-1 w-full lg:max-w-[776px] py-8 lg:py-14 lg:pr-12 lg:border-r border-team-blue-10">
          <div className="space-y-12 lg:space-y-16">
            {/* Header */}
            <div className="text-center px-4 lg:px-24 space-y-6">
              <h1 className="text-team-blue text-3xl lg:text-5xl font-semibold leading-[48px]">
                Active Practice Session
              </h1>
              <p className={`text-base leading-6 ${isDarkMode ? 'text-white' : 'text-[#191919]'}`}>
                6165 Mset Cuttlefish
              </p>
            </div>

            {/* Session Setup */}
            <SessionSetup />

            {/* Performance Metrics */}
            <PerformanceMetrics />

            {/* Notes */}
            <Notes />
          </div>
        </div>

        {/* Right Column - Live Preview */}
        <div className="w-full lg:w-[413px] py-8 lg:py-14 px-4">
          <div className="space-y-6">
            {/* Navigation to Analysis */}
            <div className="text-center">
              <Link
                to="/analysis"
                className="inline-block w-full sm:w-60 px-2.5 py-2.5 rounded-2xl border border-team-blue bg-team-blue text-team-dark text-base leading-6 font-normal hover:bg-team-blue/90 transition-colors"
              >
                View Analysis
              </Link>
            </div>

            <LivePreview />
          </div>
        </div>
      </div>
    </div>
  );
};

export default function Original() {
  return (
    <ThemeProvider>
      <SessionProvider>
        <OriginalContent />
      </SessionProvider>
    </ThemeProvider>
  );
}
