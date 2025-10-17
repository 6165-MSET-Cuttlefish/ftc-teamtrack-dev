import React, { useState, useEffect } from 'react';
import { useSession } from '../contexts/SessionContext';
import { useTheme } from '../contexts/ThemeContext';
import { ChevronUp, ChevronDown, ChevronRight } from 'lucide-react';

// Reusable number input that allows easy typing (allows empty during edit, commits on blur/Enter)
const NumberInput: React.FC<{
  value: number;
  onChange: (v: number) => void;
  placeholder?: string;
  className?: string;
  readOnly?: boolean;
}> = ({ value, onChange, placeholder, className, readOnly = false }) => {
  const [local, setLocal] = useState<string>(
    value !== undefined && value !== null ? String(value) : ''
  );

  useEffect(() => {
    const asString = value !== undefined && value !== null ? String(value) : '';
    if (asString !== local) {
      setLocal(asString);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const commit = () => {
    const numeric = local.trim() === '' ? 0 : parseInt(local, 10) || 0;
    onChange(numeric);
    setLocal(String(numeric));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value;
    if (next === '' || /^[0-9]+$/.test(next)) {
      setLocal(next);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur();
    }
  };

  return (
    <input
      type="text"
      value={local}
      onChange={handleChange}
      onBlur={commit}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      className={className}
      readOnly={readOnly}
    />
  );
};

const MetricField = ({
  label,
  value,
  onChange,
  hasDropdown = true,
  onDropdownClick,
  editable = true,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  hasDropdown?: boolean;
  onDropdownClick?: () => void;
  editable?: boolean;
}) => {
  const { isDarkMode } = useTheme();

  const handleIncrement = () => {
    onChange(value + 1);
  };

  const handleDecrement = () => {
    onChange(Math.max(0, value - 1));
  };

  return (
    <div className="flex flex-col gap-2 w-full sm:max-w-[296px]">
      <div className="flex items-center justify-between">
        <label
          className={`text-base leading-6 ${isDarkMode ? 'text-white' : 'text-black'}`}
        >
          {label}
        </label>
        <div className="w-6 h-6 flex items-center justify-center">
          {hasDropdown && (
            <button
              onClick={onDropdownClick}
              className={`hover:text-team-blue transition-colors ${isDarkMode ? 'text-white' : 'text-black'}`}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
      <div
        className={`flex justify-between items-center px-2.5 py-2.5 rounded border border-team-blue-40 ${isDarkMode ? 'bg-team-dark' : 'bg-[#FEFEFE]'}`}
      >
        <NumberInput
          value={value}
          onChange={onChange}
          placeholder="0"
          className={`flex-1 bg-transparent text-base font-light leading-6 focus:outline-none placeholder:text-team-white-40 ${isDarkMode ? 'text-white' : 'text-black'}`}
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

  const [autonomousBasket, setAutonomousBasket] = useState(0);
  const [autonomousSpecimen, setAutonomousSpecimen] = useState(0);
  const [autonomousFloorMark, setAutonomousFloorMark] = useState(0);
  const [autonomousLeave, setAutonomousLeave] = useState(0);

  const [teleOpSamples, setTeleOpSamples] = useState(0);
  const [teleOpSpecimen, setTeleOpSpecimen] = useState(0);
  const [teleOpFloorMark, setTeleOpFloorMark] = useState(0);

  const [endGameValue, setEndGameValue] = useState(0);
  
  // Track if breakdown fields have any values (indicating they're being used)
  const hasBreakdownValues = autonomousBasket > 0 || autonomousSpecimen > 0 || autonomousFloorMark > 0 || 
                             autonomousLeave > 0 || teleOpSamples > 0 || teleOpSpecimen > 0 || 
                             teleOpFloorMark > 0 || endGameValue > 0;

  // Removed toggle states for High/Low functionality

  useEffect(() => {
    // Only auto-calculate scores when breakdown fields are being used
    // This allows manual score entry to be preserved when breakdown fields are empty
    if (hasBreakdownValues) {
      // New scoring multipliers:
      // Classified Artifact = 3 pts
      // Overflow Artifact = 1 pt
      // Motif = 2 pts
      // Leave = 3 pts (autonomous only)
      const autonomousScore =
        autonomousBasket * 3 +
        autonomousSpecimen * 1 +
        autonomousFloorMark * 2 +
        autonomousLeave * 3;

      const teleOpScore =
        teleOpSamples * 3 + teleOpSpecimen * 1 + teleOpFloorMark * 2;

      const finalScore = autonomousScore + teleOpScore + endGameValue;

      updateSessionData({
        autonomousScore,
        teleOpScore,
        endGameScore: endGameValue,
        finalScore,
      });
    }
    
    // Always save the breakdown values
    updateSessionData({
      autonomousBasket,
      autonomousSpecimen,
      autonomousFloorMark,
      autonomousLeave,
      teleOpSamples,
      teleOpSpecimen,
      teleOpFloorMark,
      endGameValue,
    });
  }, [
    autonomousBasket,
    autonomousSpecimen,
    autonomousFloorMark,
    autonomousLeave,
    teleOpSamples,
    teleOpSpecimen,
    teleOpFloorMark,
    endGameValue,
    hasBreakdownValues,
    updateSessionData,
  ]);

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
    isBinary = false,
  }: {
    label: string;
    value: number;
    onChange: (value: number) => void;
    isBinary?: boolean;
  }) => {
    const { isDarkMode } = useTheme();

    return (
      <div className="flex flex-col gap-2 w-full sm:max-w-[296px]">
        <div className="flex items-center justify-between">
          <label
            className={`text-base leading-6 ${isDarkMode ? 'text-white' : 'text-black'}`}
          >
            {label}
          </label>
          <div className="w-6 h-6 flex items-center justify-center" />
        </div>
        <div
          className={`flex justify-between items-center px-2.5 py-2.5 rounded border border-team-blue-40 ${isDarkMode ? 'bg-team-dark' : 'bg-[#FEFEFE]'}`}
        >
          <NumberInput
            value={value}
            onChange={onChange}
            placeholder="0"
            className={`flex-1 bg-transparent text-base font-light leading-6 focus:outline-none placeholder:text-team-white-40 ${isDarkMode ? 'text-white' : 'text-black'}`}
          />
          {!isBinary && (
            <div className="flex items-center gap-1">
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
          )}
        </div>
      </div>
    );
  };

  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const toggleSection = (metricType: string) =>
    setExpandedSection(expandedSection === metricType ? null : metricType);
  const getSectionTitle = () => {
    switch (expandedSection) {
      case 'Autonomous Score':
        return 'Autonomous Score';
      case 'TeleOp Score':
        return 'TeleOp Score';
      case 'End Game Score':
        return 'End Game Score';
      default:
        return '';
    }
  };

  const getBreakdownFields = () => {
    if (!expandedSection) return null;
    switch (expandedSection) {
      case 'Autonomous Score':
        return (
          <div className="space-y-8">
            <InlineBreakdownField
              label="Classified Artifact (3 pts each)"
              value={autonomousBasket}
              onChange={setAutonomousBasket}
            />
            <InlineBreakdownField
              label="Overflow Artifact (1 pt each)"
              value={autonomousSpecimen}
              onChange={setAutonomousSpecimen}
            />
            <InlineBreakdownField
              label="Motif (2 pts each)"
              value={autonomousFloorMark}
              onChange={setAutonomousFloorMark}
            />
            <InlineBreakdownField
              label="Leave (enter 1 for +3 pts)"
              value={autonomousLeave}
              onChange={v => setAutonomousLeave(v > 0 ? 1 : 0)}
              isBinary
            />
          </div>
        );
      case 'TeleOp Score':
        return (
          <div className="space-y-8">
            <InlineBreakdownField
              label="Classified Artifact (3 pts each)"
              value={teleOpSamples}
              onChange={setTeleOpSamples}
            />
            <InlineBreakdownField
              label="Overflow Artifact (1 pt each)"
              value={teleOpSpecimen}
              onChange={setTeleOpSpecimen}
            />
            <InlineBreakdownField
              label="Motif (2 pts each)"
              value={teleOpFloorMark}
              onChange={setTeleOpFloorMark}
            />
          </div>
        );
      case 'End Game Score':
        return (
          <div className="space-y-8">
            <InlineBreakdownField
              label="Base Score"
              value={endGameValue}
              onChange={setEndGameValue}
            />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex gap-6">
      <div className="flex-1 space-y-8">
        <h2 className="text-team-blue text-2xl font-semibold leading-6">
          Performance Metrics
        </h2>
        <div className="space-y-8">
          <MetricField
            label="Final Score"
            value={sessionData.finalScore}
            onChange={(value) => updateSessionData({ finalScore: value })}
            hasDropdown={false}
          />
          <MetricField
            label="Autonomous Score"
            value={sessionData.autonomousScore}
            onChange={(value) => updateSessionData({ autonomousScore: value })}
            onDropdownClick={() => toggleSection('Autonomous Score')}
          />
          <MetricField
            label="TeleOp Score"
            value={sessionData.teleOpScore}
            onChange={(value) => updateSessionData({ teleOpScore: value })}
            onDropdownClick={() => toggleSection('TeleOp Score')}
          />
          <MetricField
            label="End Game Score"
            value={sessionData.endGameScore}
            onChange={(value) => updateSessionData({ endGameScore: value })}
            onDropdownClick={() => toggleSection('End Game Score')}
          />
        </div>
      </div>
      <div className="flex-1 space-y-6">
        <h2 className="text-team-blue text-2xl font-semibold leading-6 min-h-[32px]">
          {getSectionTitle()}
        </h2>
        <div className="min-h-[200px]">{getBreakdownFields()}</div>
      </div>
    </div>
  );
};
