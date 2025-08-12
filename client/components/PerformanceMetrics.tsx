import { ChevronRight, ChevronUp, ChevronDown } from "lucide-react";
import { useState } from "react";
import { useSession } from "../contexts/SessionContext";

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
      <div className="flex items-center gap-2">
        <label className="text-white text-base leading-6">{label}</label>
        {hasDropdown && (
          <button
            onClick={onDropdownClick}
            className="text-white hover:text-team-blue transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
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
  }) => (
    <div className="flex flex-col gap-2 w-full sm:max-w-[200px]">
      <label className="text-white text-sm">{label}</label>
      <div className="flex justify-between items-center px-2 py-2 rounded border border-team-blue-40 bg-team-dark">
        <input
          type="text"
          value={value}
          onChange={(e) => handleIntegerChange(e.target.value, onChange)}
          className="flex-1 bg-transparent text-white text-sm font-light leading-6 focus:outline-none placeholder:text-team-white-40"
          placeholder="0"
        />
        <div className="flex items-center gap-1">
          {hasHButton && (
            <div className="flex items-center justify-center px-1 py-1 rounded">
              <span className="text-team-white-40 text-lg font-medium leading-[14px]">
                H
              </span>
            </div>
          )}
          <div className="flex flex-col gap-0.5 p-0.5 rounded bg-team-white-10">
            <button
              onClick={() => handleIncrement(value, onChange)}
              className="flex items-center justify-center hover:bg-team-white-20 rounded transition-colors"
            >
              <ChevronUp className="w-2 h-2 text-team-white-40" />
            </button>
            <button
              onClick={() => handleDecrement(value, onChange)}
              className="flex items-center justify-center hover:bg-team-white-20 rounded transition-colors"
            >
              <ChevronDown className="w-2 h-2 text-team-white-40" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderBreakdownFields = (section: string) => {
    switch (section) {
      case "Autonomous Score":
        return (
          <div className="flex gap-4 ml-6 mt-4">
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
          <div className="flex gap-4 ml-6 mt-4">
            <InlineBreakdownField label="Samples" value={samples} onChange={setSamples} />
            <InlineBreakdownField
              label="Specimen"
              value={specimen}
              onChange={setSpecimen}
              hasHButton={true}
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
          <div className="flex gap-4 ml-6 mt-4">
            <InlineBreakdownField label="Climb" value={climb} onChange={setClimb} />
            <InlineBreakdownField label="Park" value={park} onChange={setPark} />
          </div>
        );
      default:
        return null;
    }
  };

  const setFinalScore = (value: number) => updateSessionData({ finalScore: value });
  const setAutonomousScore = (value: number) => updateSessionData({ autonomousScore: value });
  const setTeleOpScore = (value: number) => updateSessionData({ teleOpScore: value });
  const setEndGameScore = (value: number) => updateSessionData({ endGameScore: value });

  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const toggleSection = (metricType: string) => {
    setExpandedSection(expandedSection === metricType ? null : metricType);
  };

  return (
    <div className="space-y-8">
      <h2 className="text-team-blue text-2xl font-semibold leading-6">
        Performance Metrics
      </h2>

      <div className="space-y-6">
        {/* Final Score */}
        <div>
          <MetricField
            label="Final Score"
            value={sessionData.finalScore}
            onChange={setFinalScore}
            hasDropdown={false}
          />
        </div>

        {/* Autonomous Score */}
        <div>
          <MetricField
            label="Autonomous Score"
            value={sessionData.autonomousScore}
            onChange={setAutonomousScore}
            onDropdownClick={() => toggleSection("Autonomous Score")}
          />
          {expandedSection === "Autonomous Score" && renderBreakdownFields("Autonomous Score")}
        </div>

        {/* TeleOp Score */}
        <div>
          <MetricField
            label="TeleOp Score"
            value={sessionData.teleOpScore}
            onChange={setTeleOpScore}
            onDropdownClick={() => toggleSection("TeleOp Score")}
          />
          {expandedSection === "TeleOp Score" && renderBreakdownFields("TeleOp Score")}
        </div>

        {/* End Game Score */}
        <div>
          <MetricField
            label="End Game Score"
            value={sessionData.endGameScore}
            onChange={setEndGameScore}
            onDropdownClick={() => toggleSection("End Game Score")}
          />
          {expandedSection === "End Game Score" && renderBreakdownFields("End Game Score")}
        </div>
      </div>
    </div>
  );
};
