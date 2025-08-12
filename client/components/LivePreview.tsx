import { useState, useEffect } from "react";
import { useSession } from "../contexts/SessionContext";
import { useTheme } from "../contexts/ThemeContext";

const DataCard = ({ value, label }: { value: string; label: string }) => {
  const { isDarkMode } = useTheme();
  return (
    <div className="flex flex-col items-center gap-4 px-9 py-6 rounded-lg border border-team-blue-40 bg-team-dark-20">
      <div className="text-team-blue text-3xl font-medium leading-6">{value}</div>
      <div className="text-team-white-60 text-base leading-6">{label}</div>
    </div>
  );
};

const OverviewCard = ({ driverName, matchType, sessionDuration, finalScore }: {
  driverName: string;
  matchType: string;
  sessionDuration: string;
  finalScore: number;
}) => {
  const { isDarkMode } = useTheme();
  return (
    <div className="w-full px-6 py-6 rounded-lg border border-team-blue-40 space-y-2.5">
      <h3 className={`text-base font-medium leading-6 ${isDarkMode ? 'text-white' : 'text-[#191919]'}`}>
        Session Overview
      </h3>
      <div className="flex justify-between items-start">
        <div className="flex flex-col gap-2.5">
          <div className="text-team-white-60 text-xs leading-6">Driver</div>
          <div className="text-team-white-60 text-xs leading-6">Match Type</div>
          <div className="text-team-white-60 text-xs leading-6">Duration</div>
          <div className="text-team-white-60 text-xs leading-6">Score</div>
        </div>
        <div className="flex flex-col gap-2.5">
          <div className="text-team-blue text-xs leading-6">{driverName || "N/A"}</div>
          <div className="text-team-blue text-xs leading-6">{matchType || "N/A"}</div>
          <div className="text-team-blue text-xs leading-6">{sessionDuration || "N/A"}</div>
          <div className="text-team-blue text-xs leading-6">{finalScore}</div>
        </div>
      </div>
    </div>
  );
};

const InsightsCard = () => {
  const { isDarkMode } = useTheme();
  return (
    <div className="w-full px-6 py-6 rounded-lg border border-team-blue-40 space-y-2.5">
      <h3 className={`text-base font-medium leading-6 ${isDarkMode ? 'text-white' : 'text-[#191919]'}`}>
        Performance Insights
      </h3>
      <div className="text-team-white-60 text-xs leading-6">
        Improvements in XXX
      </div>
    </div>
  );
};

export const LivePreview = () => {
  const { sessionData } = useSession();
  const { isDarkMode } = useTheme();
  const [timer, setTimer] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimer((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex flex-col items-center gap-12 lg:gap-16">
      {/* Header Section */}
      <div className="flex flex-col items-center gap-8 lg:gap-12">
        <div className="text-center space-y-6">
          <h1 className="text-team-blue text-3xl lg:text-5xl font-semibold leading-tight lg:leading-9">
            Live Preview
          </h1>
          <p className="text-white text-base leading-6">Real time analysis</p>
        </div>

        <div className="text-team-blue text-4xl lg:text-5xl font-semibold leading-tight lg:leading-9">
          {formatTime(timer)}
        </div>
      </div>

      {/* Data Section */}
      <div className="flex flex-col items-center gap-6 lg:gap-8 w-full">
        {/* Data Cards Row */}
        <div className="flex flex-col sm:flex-row gap-6 lg:gap-9 w-full justify-center">
          <DataCard value={sessionData.finalScore.toString()} label="Final Score" />
          <DataCard value="87%" label="Consistency" />
        </div>

        {/* Overview Card */}
        <OverviewCard
          driverName={sessionData.driverName}
          matchType={sessionData.matchType}
          sessionDuration={sessionData.sessionDuration}
          finalScore={sessionData.finalScore}
        />

        {/* Insights Card */}
        <InsightsCard />

        {/* CTA Button */}
        <button className="w-full sm:w-60 px-2.5 py-2.5 rounded-2xl border border-team-white-20 bg-team-blue text-team-dark text-base leading-6 font-normal">
          View Full Analysis Report
        </button>
      </div>
    </div>
  );
};
