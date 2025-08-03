import { ChevronRight, ChevronUp, ChevronDown } from "lucide-react";
import { useState } from "react";
import { Modal } from "./ui/modal";

const MetricField = ({
  label,
  value,
  onChange,
  hasDropdown = true,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  hasDropdown?: boolean;
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
        {hasDropdown && <ChevronRight className="w-4 h-4 text-white" />}
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
  const [finalScore, setFinalScore] = useState(438);
  const [autonomousScore, setAutonomousScore] = useState(200);
  const [teleOpScore, setTeleOpScore] = useState(208);
  const [endGameScore, setEndGameScore] = useState(208);

  return (
    <div className="space-y-8">
      <h2 className="text-team-blue text-2xl font-semibold leading-6">
        Performance Metrics
      </h2>

      <div className="space-y-6">
        {/* First Row */}
        <div className="flex flex-col gap-6">
          <MetricField
            label="Final Score"
            value={finalScore}
            onChange={setFinalScore}
          />
          <MetricField
            label="Autonomous Score"
            value={autonomousScore}
            onChange={setAutonomousScore}
          />
        </div>

        {/* Second Row */}
        <div className="flex flex-col gap-6">
          <MetricField
            label="TeleOp Score"
            value={teleOpScore}
            onChange={setTeleOpScore}
            hasDropdown={false}
          />
        </div>

        {/* Third Row */}
        <div className="flex flex-col gap-6">
          <MetricField
            label="End Game Score"
            value={endGameScore}
            onChange={setEndGameScore}
          />
        </div>
      </div>
    </div>
  );
};
