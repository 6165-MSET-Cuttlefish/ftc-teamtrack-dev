import React, { useState, useEffect, useCallback } from 'react';
import { useSession } from '../contexts/SessionContext';
import { useTheme } from '../contexts/ThemeContext';
import { ChevronUp, ChevronDown, ChevronRight, Clock } from 'lucide-react';

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
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    // Only update local state if the input is not focused
    // The 'local' dependency is intentionally omitted to prevent infinite loops
    // This effect only runs when value or isFocused changes
    if (!isFocused) {
      const asString = value !== undefined && value !== null ? String(value) : '';
      if (asString !== local) {
        setLocal(asString);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, isFocused]);

  const commit = () => {
    const numeric = local.trim() === '' ? 0 : parseInt(local, 10) || 0;
    if (numeric !== value) {
      onChange(numeric);
    }
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
      onFocus={() => setIsFocused(true)}
      onBlur={() => {
        setIsFocused(false);
        commit();
      }}
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
  showArrows = true,
  isSelected = false,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  hasDropdown?: boolean;
  onDropdownClick?: () => void;
  editable?: boolean;
  showArrows?: boolean;
  isSelected?: boolean;
}) => {
  const { isDarkMode } = useTheme();

  const handleIncrement = () => {
    onChange(value + 1);
  };

  const handleDecrement = () => {
    onChange(Math.max(0, value - 1));
  };

  const handleArrowClick = (e: React.MouseEvent, action: () => void) => {
    e.preventDefault();
    action();
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
              className={`w-6 h-6 rounded flex items-center justify-center transition-colors ${
                isSelected 
                  ? 'text-team-blue border border-gray-400' 
                  : isDarkMode ? 'text-white hover:text-team-blue' : 'text-black hover:text-team-blue'
              }`}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
      <div
        className={`flex justify-between items-center px-2.5 py-2.5 rounded border border-team-blue-40 h-[48px] ${isDarkMode ? 'bg-team-dark' : 'bg-[#FEFEFE]'}`}
      >
        <NumberInput
          value={value}
          onChange={onChange}
          placeholder="0"
          readOnly={!editable}
          className={`flex-1 bg-transparent text-base font-light leading-6 focus:outline-none placeholder:text-team-white-40 ${isDarkMode ? 'text-white' : 'text-black'}`}
        />
        {showArrows && (
          <div className="flex flex-col gap-0.5 p-0.5 rounded bg-team-white-10">
            <button
              onMouseDown={(e) => handleArrowClick(e, handleIncrement)}
              className="flex items-center justify-center hover:bg-team-white-20 rounded transition-colors"
            >
              <ChevronUp className="w-2.5 h-2.5 text-team-white-40" />
            </button>
            <button
              onMouseDown={(e) => handleArrowClick(e, handleDecrement)}
              className="flex items-center justify-center hover:bg-team-white-20 rounded transition-colors"
            >
              <ChevronDown className="w-2.5 h-2.5 text-team-white-40" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export const PerformanceMetrics = () => {
  const { sessionData, updateSessionData, expandedSection, setExpandedSection } = useSession();
  const { isDarkMode } = useTheme();

  // Local state for scoring metrics - needed for controlled input behavior
  // These sync with sessionData but allow for intermediate input states
  const [autonClassifiedArtifact, setAutonClassifiedArtifact] = useState(0);
  const [autonOverflowArtifact, setAutonOverflowArtifact] = useState(0);
  const [autonMotif, setAutonMotif] = useState(0);
  const [autonomousLeave, setAutonomousLeave] = useState(0);

  const [teleClassifiedArtifact, setTeleClassifiedArtifact] = useState(0);
  const [teleOverflowArtifact, setTeleOverflowArtifact] = useState(0);
  const [teleMotif, setTeleMotif] = useState(0);

  const [endgameHang, setEndgameHang] = useState(0);

  // Memoize the score update function to prevent infinite loops
  const updateScores = useCallback(() => {
    const autonomousScore =
      autonClassifiedArtifact * 3 +
      autonOverflowArtifact * 1 +
      autonMotif * 2 +
      autonomousLeave * 3;

    const teleOpScore =
      teleClassifiedArtifact * 3 + teleOverflowArtifact * 1 + teleMotif * 2;

    const finalScore = autonomousScore + teleOpScore + endgameHang;

    updateSessionData({
      autonomousScore,
      teleOpScore,
      endGameScore: endgameHang,
      finalScore,
      autonClassifiedArtifact,
      autonOverflowArtifact,
      autonMotif,
      autonLeave: autonomousLeave,
      teleClassifiedArtifact,
      teleOverflowArtifact,
      teleMotif,
      endgameHang,
    });
  }, [
    autonClassifiedArtifact,
    autonOverflowArtifact,
    autonMotif,
    autonomousLeave,
    teleClassifiedArtifact,
    teleOverflowArtifact,
    teleMotif,
    endgameHang,
    updateSessionData,
  ]);

  // Cycle time tracking
  const [cycleTimerStartTime, setCycleTimerStartTime] = useState<number | null>(null);
  const [cycleTimerElapsed, setCycleTimerElapsed] = useState(0);
  const [isCycleTimesLogExpanded, setIsCycleTimesLogExpanded] = useState(false);

  // Sync local state with sessionData when scores are reset (after match save)
  useEffect(() => {
    setAutonClassifiedArtifact(sessionData.autonClassifiedArtifact || 0);
    setAutonOverflowArtifact(sessionData.autonOverflowArtifact || 0);
    setAutonMotif(sessionData.autonMotif || 0);
    setAutonomousLeave(sessionData.autonLeave || 0);
    setTeleClassifiedArtifact(sessionData.teleClassifiedArtifact || 0);
    setTeleOverflowArtifact(sessionData.teleOverflowArtifact || 0);
    setTeleMotif(sessionData.teleMotif || 0);
    setEndgameHang(sessionData.endgameHang || 0);
  }, [
    sessionData.autonClassifiedArtifact,
    sessionData.autonOverflowArtifact,
    sessionData.autonMotif,
    sessionData.autonLeave,
    sessionData.teleClassifiedArtifact,
    sessionData.teleOverflowArtifact,
    sessionData.teleMotif,
    sessionData.endgameHang,
  ]);

  // Popup state for keyboard shortcuts
  const [showPopup, setShowPopup] = useState(false);
  const [popupNumber, setPopupNumber] = useState<string>('');
  const [madeCount, setMadeCount] = useState<number | null>(null);

  const toggleSection = (metricType: string) =>
    setExpandedSection(expandedSection === metricType ? null : metricType);

  // Cycle time effect - updates elapsed time every second
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (cycleTimerStartTime !== null && !sessionData.isSessionCompleted) {
      interval = setInterval(() => {
        const now = Date.now();
        const elapsed = Math.floor((now - cycleTimerStartTime) / 1000);
        setCycleTimerElapsed(elapsed);
      }, 100);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [cycleTimerStartTime, sessionData.isSessionCompleted]);

  const recordCycleTime = () => {
    if (cycleTimerStartTime === null) {
      // Start the cycle timer
      setCycleTimerStartTime(Date.now());
    } else {
      // Record the time and reset
      updateSessionData({
        cycleTimes: [...(sessionData.cycleTimes ?? []), cycleTimerElapsed],
      });
      setCycleTimerStartTime(Date.now()); // Restart for next cycle
      setCycleTimerElapsed(0);
    }
  };

  // Keyboard event listener for 1, 2, 3 keys
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // Only trigger if not typing in an input field
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (['1', '2', '3'].includes(event.key)) {
        if (!showPopup) {
          // First press - open popup with shot type
          setPopupNumber(event.key);
          setMadeCount(null);
          setShowPopup(true);
        } else {
          // Second press - set the made count with validation
          const pressedNumber = parseInt(event.key);
          const shotType = parseInt(popupNumber);
          
          // For shot 1: only accept 1
          // For shot 2: only accept 1 or 2
          // For shot 3: accept 1, 2, or 3
          if (pressedNumber <= shotType) {
            setMadeCount(pressedNumber);
          }
        }
      }

      // Handle Enter key to confirm and add to appropriate score
      if (event.key === 'Enter' && showPopup && madeCount !== null) {
        // Auto-detect which section to update based on match type
        const matchType = sessionData.matchType;
        
        if (!expandedSection || expandedSection === 'Autonomous Score') {
          // Default to autonomous if no section expanded or if autonomous is expanded
          if (matchType !== 'TeleOp') {
            setAutonClassifiedArtifact(prev => prev + madeCount);
          } else {
            setTeleClassifiedArtifact(prev => prev + madeCount);
          }
        } else if (expandedSection === 'TeleOp Score') {
          setTeleClassifiedArtifact(prev => prev + madeCount);
        } else {
          // If End Game or other section is expanded, use match type to determine
          if (matchType === 'Autonomous') {
            setAutonClassifiedArtifact(prev => prev + madeCount);
          } else {
            setTeleClassifiedArtifact(prev => prev + madeCount);
          }
        }
        
        // Close popup after confirming
        setShowPopup(false);
        setMadeCount(null);
      }

      // Close popup on Escape key
      if (event.key === 'Escape' && showPopup) {
        setShowPopup(false);
        setMadeCount(null);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, [showPopup, popupNumber, madeCount, expandedSection]);

  useEffect(() => {
    updateScores();
  }, [
    autonClassifiedArtifact,
    autonOverflowArtifact,
    autonMotif,
    autonomousLeave,
    teleClassifiedArtifact,
    teleOverflowArtifact,
    teleMotif,
    endgameHang,
    updateScores,
  ]);

  const InlineBreakdownField = ({
    label,
    value,
    onChange,
  }: {
    label: string;
    value: number;
    onChange: (value: number) => void;
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
        <div className="flex items-center justify-between min-h-[24px]">
          <label
            className={`text-base leading-6 ${isDarkMode ? 'text-white' : 'text-black'}`}
          >
            {label}
          </label>
        </div>
        <div className={`flex justify-between items-center gap-2 h-[48px]`}>
          <button
            onClick={handleIncrement}
            className={`flex-1 h-full rounded border border-team-blue-40 flex items-center justify-center transition-colors hover:bg-team-blue-40 ${
              isDarkMode ? 'bg-team-dark' : 'bg-[#FEFEFE]'
            }`}
          >
            <ChevronUp className={`w-6 h-6 ${isDarkMode ? 'text-white' : 'text-black'}`} />
          </button>
          <div
            className={`flex-1 h-full rounded border border-team-blue-40 flex items-center justify-center ${
              isDarkMode ? 'bg-team-dark text-white' : 'bg-[#FEFEFE] text-black'
            }`}
          >
            <NumberInput
              value={value}
              onChange={onChange}
              placeholder="0"
              className={`w-full h-full bg-transparent text-2xl font-semibold text-center focus:outline-none ${isDarkMode ? 'text-white' : 'text-black'}`}
            />
          </div>
          <button
            onClick={handleDecrement}
            className={`flex-1 h-full rounded border border-team-blue-40 flex items-center justify-center transition-colors hover:bg-team-blue-40 ${
              isDarkMode ? 'bg-team-dark' : 'bg-[#FEFEFE]'
            }`}
          >
            <ChevronDown className={`w-6 h-6 ${isDarkMode ? 'text-white' : 'text-black'}`} />
          </button>
        </div>
      </div>
    );
  };

  const CheckboxField = ({
    label,
    checked,
    onChange,
  }: {
    label: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
  }) => {
    const { isDarkMode } = useTheme();

    return (
      <div className="flex flex-col gap-2 w-full sm:max-w-[296px]">
        <div className="flex items-center justify-between min-h-[24px]">
          <label
            className={`text-base leading-6 ${isDarkMode ? 'text-white' : 'text-black'}`}
          >
            {label}
          </label>
        </div>
        <div className="flex items-center justify-center h-[48px]">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => onChange(e.target.checked)}
            className="w-8 h-8 rounded-full border-2 border-team-blue cursor-pointer accent-team-blue"
          />
        </div>
      </div>
    );
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
              value={autonClassifiedArtifact}
              onChange={setAutonClassifiedArtifact}
            />
            <InlineBreakdownField
              label="Overflow Artifact (1 pt each)"
              value={autonOverflowArtifact}
              onChange={setAutonOverflowArtifact}
            />
            <InlineBreakdownField
              label="Motif (2 pts each)"
              value={autonMotif}
              onChange={setAutonMotif}
            />
            <CheckboxField
              label="Leave (Check if left)"
              checked={autonomousLeave === 1}
              onChange={(checked) => setAutonomousLeave(checked ? 1 : 0)}
            />
          </div>
        );
      case 'TeleOp Score':
        return (
          <div className="space-y-8">
            <InlineBreakdownField
              label="Classified Artifact (3 pts each)"
              value={teleClassifiedArtifact}
              onChange={setTeleClassifiedArtifact}
            />
            <InlineBreakdownField
              label="Overflow Artifact (1 pt each)"
              value={teleOverflowArtifact}
              onChange={setTeleOverflowArtifact}
            />
            <InlineBreakdownField
              label="Motif (2 pts each)"
              value={teleMotif}
              onChange={setTeleMotif}
            />
            {sessionData.selectedFeature === 'Cycle Times' && (
              <div className="space-y-4">
                <div className="flex flex-col gap-2 w-full">
                  <label className={`text-base leading-6 ${isDarkMode ? 'text-white' : 'text-black'}`}>
                    Cycle Time
                  </label>
                  <div className="flex flex-row items-center" style={{ gap: '18px' }}>
                    <button
                      onClick={recordCycleTime}
                      className={`w-12 h-12 rounded-lg border border-team-blue-40 flex items-center justify-center transition-colors flex-shrink-0 ${
                        isDarkMode ? 'bg-team-dark text-white hover:bg-team-dark-20' : 'bg-[#FEFEFE] text-black hover:bg-gray-100'
                      }`}
                    >
                      <Clock className="w-6 h-6" />
                    </button>
                    {cycleTimerStartTime !== null && (
                      <div className={`text-2xl flex flex-row ${isDarkMode ? 'text-white' : 'text-black'}`}>
                        <div style={{ paddingTop: '6px' }}>
                          {Math.floor(cycleTimerElapsed / 60)}
                        </div>
                        <div style={{ paddingTop: '6px' }}>
                          :
                        </div>
                        <div style={{ paddingTop: '6px' }}>
                          {(cycleTimerElapsed % 60).toString().padStart(2, '0')}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {(sessionData.cycleTimes?.length ?? 0) > 0 && (
                  <div className="flex flex-col gap-2 w-full sm:max-w-[296px]">
                    <button
                      onClick={() => setIsCycleTimesLogExpanded(!isCycleTimesLogExpanded)}
                      className={`text-base leading-6 font-medium flex items-center gap-2 ${isDarkMode ? 'text-white hover:text-team-blue' : 'text-black hover:text-team-blue'} transition-colors`}
                    >
                      <ChevronRight className={`w-4 h-4 transition-transform ${isCycleTimesLogExpanded ? 'rotate-90' : ''}`} />
                      Cycle Times Log ({sessionData.cycleTimes.length})
                    </button>
                    {isCycleTimesLogExpanded && (
                      <div className={`p-2.5 rounded border border-team-blue-40 ${isDarkMode ? 'bg-team-dark' : 'bg-[#FEFEFE]'}`} style={{ height: '150px', overflowY: 'auto' }}>
                        <div className="flex flex-col gap-2">
                          {sessionData.cycleTimes.map((time, index) => {
                            const minutes = Math.floor(time / 60);
                            const seconds = time % 60;
                            return (
                              <div
                                key={index}
                                className={`px-2.5 py-1.5 rounded text-sm font-medium ${isDarkMode ? 'bg-team-blue-40 text-white' : 'bg-team-blue-40 text-white'}`}
                              >
                                {index + 1}. {minutes}:{seconds.toString().padStart(2, '0')}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      case 'End Game Score':
        return (
          <div className="space-y-8">
            <InlineBreakdownField
              label="Base Score"
              value={endgameHang}
              onChange={setEndgameHang}
            />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <>
      {/* Keyboard shortcut popup */}
      {showPopup && (
        <div className="fixed bottom-8 right-8 z-50 pointer-events-none">
          <div className="bg-team-blue text-white rounded-lg shadow-2xl p-12 text-center">
            <div className="text-6xl font-bold mb-4">shot {popupNumber}</div>
            <div className="text-4xl mb-4">{madeCount !== null ? `${madeCount} made` : '__ made'}</div>
            <div className="text-sm opacity-75 mb-2">press enter to confirm</div>
            <div className="text-sm opacity-75">press esc to exit</div>
          </div>
        </div>
      )}

      <div className="flex gap-6">
        <div className="flex-1 flex flex-col justify-between">
          <div>
            <h2 className="text-team-blue text-2xl font-semibold leading-6 mb-8">
              Performance Metrics
            </h2>
            <div className="space-y-8">
              <MetricField
                label="Final Score"
                value={sessionData.finalScore ?? 0}
                onChange={(value) => updateSessionData({ finalScore: value })}
                hasDropdown={false}
                editable={false}
                showArrows={false}
              />
              {sessionData.matchType !== 'TeleOp' && (
                <MetricField
                  label="Autonomous Score"
                  value={sessionData.autonomousScore ?? 0}
                  onChange={(value) => updateSessionData({ autonomousScore: value })}
                  onDropdownClick={() => toggleSection('Autonomous Score')}
                  editable={true}
                  showArrows={false}
                  isSelected={expandedSection === 'Autonomous Score'}
                />
              )}
              {sessionData.matchType !== 'Autonomous' && (
                <MetricField
                  label="TeleOp Score"
                  value={sessionData.teleOpScore ?? 0}
                  onChange={(value) => updateSessionData({ teleOpScore: value })}
                  onDropdownClick={() => toggleSection('TeleOp Score')}
                  editable={true}
                  showArrows={false}
                  isSelected={expandedSection === 'TeleOp Score'}
                />
              )}
              <MetricField
                label="End Game Score"
                value={sessionData.endGameScore ?? 0}
                onChange={(value) => updateSessionData({ endGameScore: value })}
                onDropdownClick={() => toggleSection('End Game Score')}
                editable={true}
                showArrows={false}
                isSelected={expandedSection === 'End Game Score'}
              />
            </div>
          </div>
        </div>
        <div className="flex-1">
          <h2 className="text-team-blue text-2xl font-semibold leading-6 mb-6 min-h-[32px]">
            {getSectionTitle()}
          </h2>
          <div className="min-h-[200px]">{getBreakdownFields()}</div>
        </div>
      </div>
    </>
  );
};
