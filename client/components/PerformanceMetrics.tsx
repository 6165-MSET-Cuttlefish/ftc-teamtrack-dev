import { ChevronRight, ChevronUp, ChevronDown } from "lucide-react";
import { useState } from "react";
import { useSession } from "../contexts/SessionContext";
import { useTheme } from "../contexts/ThemeContext";

const MetricField = ({
  label,
  value,
  onChange,
  hasDropdown = true,
  onDropdownClick,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  hasDropdown?: boolean;
  onDropdownClick?: () => void;
}) => {
  const handleIncrement = () => {
    onChange(value + 1);
  };

  const handleDecrement = () => {
    onChange(Math.max(0, value - 1)); // Prevent negative values
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const numericValue = e.target.value.replace(/[^0-9]/g, "");
    onChange(numericValue ? parseInt(numericValue) : 0);
  };

  return (
    <div className="flex flex-col gap-2 w-full sm:max-w-[296px]">
      <div className="flex items-center justify-between">
        <label className="text-white text-base leading-6">{label}</label>
        <div className="w-6 h-6 flex items-center justify-center">
          {hasDropdown && (
            <button
              onClick={onDropdownClick}
              className="text-white hover:text-team-blue transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
      <div className="flex justify-between items-center px-2.5 py-2.5 rounded border border-team-blue-40 bg-team-dark">
        <input
          type="text"
          value={value}
          onChange={handleInputChange}
          className="flex-1 bg-transparent text-white text-base font-light leading-6 focus:outline-none placeholder:text-team-white-40"
          placeholder="0"
        />
        <div className="flex flex-col gap-0.5 p-0.5 rounded bg-team-white-10">
          <button
            onClick={handleIncrement}
            className="flex items-center justify-center hover:bg-team-white-20 rounded transition-colors"
          >
            <ChevronUp className="w-2.5 h-2.5 text-team-white-40" />
          </button>
          <button
            onClick={handleDecrement}
            className="flex items-center justify-center hover:bg-team-white-20 rounded transition-colors"
          >
            <ChevronDown className="w-2.5 h-2.5 text-team-white-40" />
          </button>
        </div>
      </div>
    </div>
  );
};

export const PerformanceMetrics = () => {
  const { sessionData, updateSessionData } = useSession();

  // Breakdown field states
  const [samples, setSamples] = useState(0);
  const [specimen, setSpecimen] = useState(0);
  const [floorMark, setFloorMark] = useState(0);
  const [basket, setBasket] = useState(0);
  const [autonomousSpecimen, setAutonomousSpecimen] = useState(0);
  const [autonomousFloorMark, setAutonomousFloorMark] = useState(0);
  const [climb, setClimb] = useState(0);
  const [park, setPark] = useState(0);

  const handleIntegerChange = (
    value: string,
    setter: (value: number) => void,
  ) => {
    // Only allow integers (remove any non-digit characters)
    const integerValue = value.replace(/[^0-9]/g, "");
    setter(integerValue ? parseInt(integerValue) : 0);
  };

  const handleIncrement = (value: number, setter: (value: number) => void) => {
    setter(value + 1);
  };

  const handleDecrement = (value: number, setter: (value: number) => void) => {
    setter(Math.max(0, value - 1));
  };

  const InlineBreakdownField = ({
    label,
    value,
    onChange,
    hasHButton = false,
  }: {
    label: string;
    value: number;
    onChange: (value: number) => void;
    hasHButton?: boolean;
  }) => {
    const [isHighNet, setIsHighNet] = useState(true); // true = H, false = L

    return (
      <div className="flex flex-col gap-2 w-full sm:max-w-[296px]">
        <label className="text-white text-base leading-6">{label}</label>
        <div className="flex justify-between items-center px-2.5 py-2.5 rounded border border-team-blue-40 bg-team-dark">
          <input
            type="text"
            value={value}
            onChange={(e) => handleIntegerChange(e.target.value, onChange)}
            className="flex-1 bg-transparent text-white text-base font-light leading-6 focus:outline-none placeholder:text-team-white-40"
            placeholder="0"
          />
          <div className="flex items-center gap-1">
            {hasHButton && (
              <button
                onClick={() => setIsHighNet(!isHighNet)}
                className="flex items-center justify-center px-1 py-1 rounded hover:bg-team-white-10 transition-colors"
              >
                <span className="text-team-white-40 text-2xl font-medium leading-[18px]">
                  {isHighNet ? "H" : "L"}
                </span>
              </button>
            )}
            <div className="flex flex-col gap-0.5 p-0.5 rounded bg-team-white-10">
              <button
                onClick={() => handleIncrement(value, onChange)}
                className="flex items-center justify-center hover:bg-team-white-20 rounded transition-colors"
              >
                <ChevronUp className="w-2.5 h-2.5 text-team-white-40" />
              </button>
              <button
                onClick={() => handleDecrement(value, onChange)}
                className="flex items-center justify-center hover:bg-team-white-20 rounded transition-colors"
              >
                <ChevronDown className="w-2.5 h-2.5 text-team-white-40" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };


  const setFinalScore = (value: number) => updateSessionData({ finalScore: value });
  const setAutonomousScore = (value: number) => updateSessionData({ autonomousScore: value });
  const setTeleOpScore = (value: number) => updateSessionData({ teleOpScore: value });
  const setEndGameScore = (value: number) => updateSessionData({ endGameScore: value });

  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const toggleSection = (metricType: string) => {
    setExpandedSection(expandedSection === metricType ? null : metricType);
  };

  const getSectionTitle = () => {
    switch (expandedSection) {
      case "Autonomous Score":
        return "Autonomous Score";
      case "TeleOp Score":
        return "TeleOp Score";
      case "End Game Score":
        return "End Game Score";
      default:
        return ""; // Default to blank
    }
  };

  const getBreakdownFields = () => {
    if (!expandedSection) {
      return null; // Return nothing when no section is selected
    }

    switch (expandedSection) {
      case "Autonomous Score":
        return (
          <div className="space-y-6">
            <InlineBreakdownField
              label="Basket"
              value={basket}
              onChange={setBasket}
              hasHButton={true}
            />
            <InlineBreakdownField
              label="Specimen"
              value={autonomousSpecimen}
              onChange={setAutonomousSpecimen}
              hasHButton={true}
            />
            <InlineBreakdownField
              label="Floor Mark"
              value={autonomousFloorMark}
              onChange={setAutonomousFloorMark}
            />
          </div>
        );
      case "TeleOp Score":
        return (
          <div className="space-y-6">
            <InlineBreakdownField label="Samples" value={samples} onChange={setSamples} hasHButton={true} />
            <InlineBreakdownField
              label="Specimen"
              value={specimen}
              onChange={setSpecimen}
              hasHButton={false}
            />
            <InlineBreakdownField
              label="Floor mark"
              value={floorMark}
              onChange={setFloorMark}
            />
          </div>
        );
      case "End Game Score":
        return (
          <div className="space-y-6">
            <InlineBreakdownField label="Climb" value={climb} onChange={setClimb} />
            <InlineBreakdownField label="Park" value={park} onChange={setPark} />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex gap-16">
      {/* Left Column - Performance Metrics */}
      <div className="flex-1 space-y-8">
        <h2 className="text-team-blue text-2xl font-semibold leading-6">
          Performance Metrics
        </h2>

        <div className="space-y-6">
          <MetricField
            label="Final Score"
            value={sessionData.finalScore}
            onChange={setFinalScore}
            hasDropdown={false}
          />

          <MetricField
            label="Autonomous Score"
            value={sessionData.autonomousScore}
            onChange={setAutonomousScore}
            onDropdownClick={() => toggleSection("Autonomous Score")}
          />

          <MetricField
            label="TeleOp Score"
            value={sessionData.teleOpScore}
            onChange={setTeleOpScore}
            onDropdownClick={() => toggleSection("TeleOp Score")}
          />

          <MetricField
            label="End Game Score"
            value={sessionData.endGameScore}
            onChange={setEndGameScore}
            onDropdownClick={() => toggleSection("End Game Score")}
          />
        </div>
      </div>

      {/* Right Column - Breakdown Fields */}
      <div className="flex-1 space-y-8">
        <h2 className="text-team-blue text-2xl font-semibold leading-6 min-h-[32px]">
          {getSectionTitle()}
        </h2>

        <div className="min-h-[200px]">
          {getBreakdownFields()}
        </div>
      </div>
    </div>
  );
};
