  import { ChevronRight, ChevronUp, ChevronDown } from 'lucide-react';
  import { useState, useEffect } from 'react';
  import { useSession } from '../contexts/SessionContext';
  import { useTheme } from '../contexts/ThemeContext';

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
    const { isDarkMode } = useTheme();

    const handleIncrement = () => {
      onChange(value + 1);
    };

    const handleDecrement = () => {
      onChange(Math.max(0, value - 1)); // Prevent negative values
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const numericValue = e.target.value.replace(/[^0-9]/g, '');
      onChange(numericValue ? parseInt(numericValue) : 0);
    };

    return (
      <div className="flex flex-col gap-2 w-full sm:max-w-[296px]">
        <div className="flex items-center justify-between">
          <label
            className={`text-base leading-6 ${isDarkMode ? 'text-white' : 'text-[#191919]'}`}
          >
            {label}
          </label>
          <div className="w-6 h-6 flex items-center justify-center">
            {hasDropdown && (
              <button
                onClick={onDropdownClick}
                className={`hover:text-team-blue transition-colors ${isDarkMode ? 'text-white' : 'text-[#191919]'}`}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
        <div
          className={`flex justify-between items-center px-2.5 py-2.5 rounded border border-team-blue-40 ${isDarkMode ? 'bg-team-dark' : 'bg-white'}`}
        >
          <input
            type="text"
            value={value}
            onChange={handleInputChange}
            className={`flex-1 bg-transparent text-base font-light leading-6 focus:outline-none placeholder:text-team-white-40 ${isDarkMode ? 'text-white' : 'text-[#191919]'}`}
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

    // Autonomous breakdown field states
    const [autonomousBasket, setAutonomousBasket] = useState(0);
    const [autonomousSpecimen, setAutonomousSpecimen] = useState(0);
    const [autonomousFloorMark, setAutonomousFloorMark] = useState(0);

    // TeleOp breakdown field states (includes autonomous values + additional)
    const [teleOpSamples, setTeleOpSamples] = useState(0);
    const [teleOpSpecimen, setTeleOpSpecimen] = useState(0);
    const [teleOpFloorMark, setTeleOpFloorMark] = useState(0);

    // End game states
    const [endGameValue, setEndGameValue] = useState(0); // 0, 5, 15, or 30

    // H/L toggle states for each field
    const [toggleStates, setToggleStates] = useState({
      autonomousBasket: true,
      autonomousSpecimen: true,
      teleOpSamples: true,
    });

    // Calculate scores automatically
    useEffect(() => {
      // Autonomous scoring: basket = 8, specimen = 10, floor mark = 1
      const autonomousScore =
        autonomousBasket * 8 + autonomousSpecimen * 10 + autonomousFloorMark * 1;

      // TeleOp scoring: same as autonomous, but includes autonomous values + additional teleop values
      const totalSpecimen = autonomousSpecimen + teleOpSpecimen;
      const totalSamples = teleOpSamples; // Samples only exist in teleop
      const totalFloorMark = autonomousFloorMark + teleOpFloorMark;

      const teleOpScore =
        totalSamples * 8 + totalSpecimen * 10 + totalFloorMark * 1;

      // Final score = autonomous + teleop + endgame
      const finalScore = autonomousScore + teleOpScore + endGameValue;

      updateSessionData({
        autonomousScore,
        teleOpScore,
        endGameScore: endGameValue,
        finalScore,
        autonomousBasket,
        autonomousSpecimen,
        autonomousFloorMark,
        teleOpSamples,
        teleOpSpecimen,
        teleOpFloorMark,
        endGameValue,
      });
    }, [
      autonomousBasket,
      autonomousSpecimen,
      autonomousFloorMark,
      teleOpSamples,
      teleOpSpecimen,
      teleOpFloorMark,
      endGameValue,
      updateSessionData,
    ]);

    const handleIntegerChange = (
      value: string,
      setter: (value: number) => void
    ) => {
      // Only allow integers (remove any non-digit characters)
      const integerValue = value.replace(/[^0-9]/g, '');
      // Allow empty string to be converted to 0, but preserve multi-digit numbers
      if (integerValue === '') {
        setter(0);
      } else {
        const numValue = parseInt(integerValue);
        // Allow numbers up to a reasonable limit (e.g., 9999)
        if (numValue <= 9999) {
          setter(numValue);
        }
      }
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
      toggleKey,
    }: {
      label: string;
      value: number;
      onChange: (value: number) => void;
      hasHButton?: boolean;
      toggleKey?: string;
    }) => {
      const { isDarkMode } = useTheme();

      const handleToggle = () => {
        if (toggleKey) {
          setToggleStates(prev => ({
            ...prev,
            [toggleKey]: !prev[toggleKey as keyof typeof prev],
          }));
        }
      };

      const isHighNet = toggleKey
        ? toggleStates[toggleKey as keyof typeof toggleStates]
        : true;

      return (
        <div className="flex flex-col gap-2 w-full sm:max-w-[296px]">
          <div className="flex items-center justify-between">
            <label
              className={`text-base leading-6 ${isDarkMode ? 'text-white' : 'text-[#191919]'}`}
            >
              {label}
            </label>
            <div className="w-6 h-6 flex items-center justify-center">
              {/* Empty space for alignment */}
            </div>
          </div>
          <div
            className={`flex justify-between items-center px-2.5 py-2.5 rounded border border-team-blue-40 ${isDarkMode ? 'bg-team-dark' : 'bg-white'}`}
          >
            <input
              type="text"
              value={value.toString()}
              onChange={e => handleIntegerChange(e.target.value, onChange)}
              className={`flex-1 bg-transparent text-base font-light leading-6 focus:outline-none placeholder:text-team-white-40 ${isDarkMode ? 'text-white' : 'text-[#191919]'}`}
              placeholder="0"
            />
            <div className="flex items-center gap-1">
              {hasHButton && (
                <button
                  onClick={handleToggle}
                  className="flex items-center justify-center px-1 py-1 rounded hover:bg-team-white-10 transition-colors"
                >
                  <span className="text-team-white-40 text-2xl font-medium leading-[18px]">
                    {isHighNet ? 'H' : 'L'}
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

    // End game score setter with validation for allowed values
    const handleEndGameChange = (value: number) => {
      const allowedValues = [0, 5, 15, 30];
      const closest = allowedValues.reduce((prev, curr) =>
        Math.abs(curr - value) < Math.abs(prev - value) ? curr : prev
      );
      setEndGameValue(closest);
    };

    const [expandedSection, setExpandedSection] = useState<string | null>(null);

    const toggleSection = (metricType: string) => {
      setExpandedSection(expandedSection === metricType ? null : metricType);
    };

    const getSectionTitle = () => {
      switch (expandedSection) {
        case 'Autonomous Score':
          return 'Autonomous Score';
        case 'TeleOp Score':
          return 'TeleOp Score';
        case 'End Game Score':
          return 'End Game Score';
        default:
          return ''; // Default to blank
      }
    };

    const getBreakdownFields = () => {
      if (!expandedSection) {
        return null; // Return nothing when no section is selected
      }

      switch (expandedSection) {
        case 'Autonomous Score':
          return (
            <div className="space-y-2">
              <InlineBreakdownField
                label="Basket (8 pts each)"
                value={autonomousBasket}
                onChange={setAutonomousBasket}
                hasHButton={true}
                toggleKey="autonomousBasket"
              />
              <InlineBreakdownField
                label="Specimen (10 pts each)"
                value={autonomousSpecimen}
                onChange={setAutonomousSpecimen}
                hasHButton={true}
                toggleKey="autonomousSpecimen"
              />
              <InlineBreakdownField
                label="Floor Mark (1 pt each)"
                value={autonomousFloorMark}
                onChange={setAutonomousFloorMark}
                hasHButton={false}
              />
            </div>
          );
        case 'TeleOp Score':
          return (
            <div className="space-y-2
            ">
              <InlineBreakdownField
                label="Additional Samples (8 pts each)"
                value={teleOpSamples}
                onChange={setTeleOpSamples}
                hasHButton={true}
                toggleKey="teleOpSamples"
              />
              <InlineBreakdownField
                label="Additional Specimen (10 pts each)"
                value={teleOpSpecimen}
                onChange={setTeleOpSpecimen}
                hasHButton={false}
              />
              <InlineBreakdownField
                label="Additional Floor Mark (1 pt each)"
                value={teleOpFloorMark}
                onChange={setTeleOpFloorMark}
                hasHButton={false}
              />
            </div>
          );
        case 'End Game Score':
          return (
            <div className="space-y-2">
              <div className="text-sm text-team-white-60 mb-4">
                * Choose one: 0, 5, 15, or 30 points
              </div>
              <InlineBreakdownField
                label="End Game Points"
                value={endGameValue}
                onChange={handleEndGameChange}
                hasHButton={false}
              />
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

          <div className="space-y-2">
            <MetricField
              label="Final Score"
              value={sessionData.finalScore}
              onChange={() => {}} // Read-only, calculated automatically
              hasDropdown={false}
            />

            <MetricField
              label="Autonomous Score"
              value={sessionData.autonomousScore}
              onChange={() => {}} // Read-only, calculated automatically
              onDropdownClick={() => toggleSection('Autonomous Score')}
            />

            <MetricField
              label="TeleOp Score"
              value={sessionData.teleOpScore}
              onChange={() => {}} // Read-only, calculated automatically
              onDropdownClick={() => toggleSection('TeleOp Score')}
            />

            <MetricField
              label="End Game Score"
              value={sessionData.endGameScore}
              onChange={() => {}} // Read-only, calculated automatically
              onDropdownClick={() => toggleSection('End Game Score')}
            />
          </div>
        </div>

        {/* Right Column - Breakdown Fields */}
        <div className="flex-1 space-y-8">
          <h2 className="text-team-blue text-2xl font-semibold leading-6 min-h-[32px]">
            {getSectionTitle()}
          </h2>

          <div className="min-h-[200px]">{getBreakdownFields()}</div>
        </div>
      </div>
    );
  };
