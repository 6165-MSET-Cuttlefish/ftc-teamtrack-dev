import { useState, useEffect, useId, type KeyboardEvent } from 'react';
import { useSessionCore, useTheme } from '@/contexts';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Lock } from 'lucide-react';
import type { SessionType } from '@/types';
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@/components/ui/select';
import { toneText } from './controls/tones';

/** Long enough for any real name, short enough not to break page layouts */
const MAX_NAME_LENGTH = 80;

const SESSION_TYPES: Array<{ value: SessionType; hint: string }> = [
  { value: 'Practice', hint: 'Solo drilling and repetition' },
  { value: 'Scrim', hint: 'Matches vs. another alliance — adds penalties' },
];

interface SessionSetupProps {
  onSave?: () => void;
  shouldFlash?: boolean;
  isUnsaved?: boolean;
}

export const SessionSetup = ({
  onSave,
  shouldFlash = false,
  isUnsaved = false,
}: SessionSetupProps) => {
  const { sessionData, updateSessionData, matchActive, isTutorialActive } =
    useSessionCore();
  // The match type and session type are fixed once a match is under way. The
  // walkthrough's practice match doesn't count: its settings step says they
  // can be changed, and whatever is changed there is put back when it closes.
  const settingsLocked = matchActive && !isTutorialActive;
  const { isDarkMode } = useTheme();
  const savedBtnClass = `bg-team-blue ${isDarkMode ? 'text-black' : 'text-white'}`;
  const [isFlashing, setIsFlashing] = useState(shouldFlash);
  const nameId = useId();
  const nameErrorId = useId();
  const matchTypeId = useId();
  const matchTypeLabelId = useId();
  const sessionTypeLabelId = useId();
  const matchTypeLockId = useId();
  const sessionTypeLockId = useId();
  const labelClass = `text-sm font-semibold uppercase tracking-wide mb-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`;
  /** Beside the label of each setting a running match holds in place */
  const lockedNote = (id: string) =>
    settingsLocked && (
      <span
        id={id}
        className={`mb-2 flex items-center gap-1.5 text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}
      >
        <Lock size={12} aria-hidden className="shrink-0" />
        Locked while a match is running
      </span>
    );

  useEffect(() => {
    setIsFlashing(shouldFlash);
    if (shouldFlash) {
      const timer = setTimeout(() => setIsFlashing(false), 1500);
      return () => clearTimeout(timer);
    }
  }, [shouldFlash]);

  const setSessionName = (value: string) =>
    updateSessionData({ sessionName: value });
  const setMatchType = (value: string) =>
    updateSessionData({ matchType: value });
  const setSessionType = (value: SessionType) => {
    // Fouls are only tracked in a scrim; ones entered before switching back
    // to practice would otherwise stay on the match with no field to clear.
    updateSessionData(
      value === 'Practice'
        ? { sessionType: value, minorPenalties: 0, majorPenalties: 0 }
        : { sessionType: value }
    );
  };

  /** Arrow keys move between the session types, as in any radio group. */
  const handleSessionTypeKey = (
    e: KeyboardEvent<HTMLButtonElement>,
    index: number
  ) => {
    const step =
      e.key === 'ArrowRight' || e.key === 'ArrowDown'
        ? 1
        : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
          ? -1
          : 0;
    if (step === 0) return;
    e.preventDefault();
    const next =
      SESSION_TYPES[
        (index + step + SESSION_TYPES.length) % SESSION_TYPES.length
      ];
    setSessionType(next.value);
    const radios =
      e.currentTarget.parentElement?.querySelectorAll<HTMLElement>(
        '[role="radio"]'
      );
    radios?.[SESSION_TYPES.indexOf(next)]?.focus();
  };

  const hasName = sessionData.sessionName?.trim().length > 0;
  /** Whichever radio is checked is the group's Tab stop; the first one if none is */
  const hasSessionType = SESSION_TYPES.some(
    type => type.value === sessionData.sessionType
  );

  const handleSave = () => {
    if (!hasName) return;
    onSave?.();
  };

  return (
    <>
      <style>{`
        .session-setup-unsaved {
          border: 2px solid rgb(239,68,68) !important;
          background-color: rgba(239,68,68,0.06) !important;
        }
        .session-setup-saved {
          border: 2px solid transparent !important;
          background-color: transparent !important;
        }
      `}</style>
      <div
        className={`rounded-2xl space-y-6 transition-all duration-300 ${
          isUnsaved ? 'session-setup-unsaved p-6' : 'session-setup-saved p-0'
        }`}
      >

        <div className="flex items-center justify-between">
          <h2
            className={`text-lg font-bold ${isUnsaved ? toneText('blue', isDarkMode) : 'text-team-blue'}`}
          >
            Session Settings
          </h2>
          {isUnsaved && (
            <div
              className={`flex items-center gap-1.5 ${toneText('red', isDarkMode)}`}
            >
              <AlertTriangle
                size={16}
                aria-hidden
                className={isFlashing ? 'flash-animate' : ''}
              />
              <span className="text-xs font-semibold uppercase tracking-wide">
                Setup required
              </span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="flex flex-col">
            <Label htmlFor={nameId} className={labelClass}>
              Session Name
            </Label>
            <Input
              id={nameId}
              name="sessionName"
              type="text"
              autoComplete="off"
              maxLength={MAX_NAME_LENGTH}
              value={sessionData.sessionName}
              onChange={e => setSessionName(e.target.value)}
              placeholder="Sunday Afternoon"
              aria-invalid={isUnsaved && !hasName}
              aria-describedby={isUnsaved && !hasName ? nameErrorId : undefined}
              className={`h-14 px-4 rounded-xl border-2 transition-all duration-200 focus:ring-2 focus:ring-team-blue/20 ${
                isUnsaved && !hasName ? 'border-red-400' : 'border-team-blue-40'
              } ${
                isDarkMode
                  ? 'bg-team-dark text-white placeholder:text-gray-500'
                  : 'bg-white text-black placeholder:text-gray-400'
              }`}
            />
            {isUnsaved && !hasName && (
              <p
                id={nameErrorId}
                className={`text-xs font-medium mt-2 ${toneText('red', isDarkMode)}`}
              >
                Session name is required
              </p>
            )}
          </div>

          <div className="flex flex-col">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <Label
                id={matchTypeLabelId}
                htmlFor={matchTypeId}
                className={labelClass}
              >
                Match Type
              </Label>
              {lockedNote(matchTypeLockId)}
            </div>
            <div
              className={`h-14 px-4 rounded-xl border-2 border-team-blue-40 transition-all duration-200 flex items-center ${
                isDarkMode ? 'bg-team-dark text-white' : 'bg-white text-black'
              } ${settingsLocked ? 'opacity-60 cursor-not-allowed' : ''}`}
              style={settingsLocked ? { pointerEvents: 'none' } : {}}
            >
              <Select
                name="matchType"
                value={sessionData.matchType}
                onValueChange={settingsLocked ? () => {} : setMatchType}
              >
                <SelectTrigger
                  id={matchTypeId}
                  aria-labelledby={`${matchTypeLabelId} ${matchTypeId}`}
                  aria-describedby={settingsLocked ? matchTypeLockId : undefined}
                  className="border-0 p-0 h-auto focus:ring-0 bg-transparent"
                >
                  <SelectValue placeholder="Full Game" />
                </SelectTrigger>
                <SelectContent
                  className={`${isDarkMode ? 'bg-[#2a2a2a] border-gray-700' : 'bg-white border-gray-200'}`}
                >
                  <SelectItem value="Full Game">Full Game</SelectItem>
                  <SelectItem value="Autonomous">Autonomous</SelectItem>
                  <SelectItem value="Teleop">Teleop</SelectItem>
                </SelectContent>
              </Select>
            </div>

          </div>
        </div>

        <div className="flex flex-col">
          {/* Not a <label>: it names a group, not a single field */}
          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
            <span
              id={sessionTypeLabelId}
              className={`leading-none ${labelClass}`}
            >
              Session Type
            </span>
            {lockedNote(sessionTypeLockId)}
          </div>
          <div
            role="radiogroup"
            aria-labelledby={sessionTypeLabelId}
            aria-describedby={settingsLocked ? sessionTypeLockId : undefined}
            className="grid grid-cols-2 gap-3"
          >
            {SESSION_TYPES.map((type, index) => {
              const isSelected = sessionData.sessionType === type.value;
              return (
                <button
                  key={type.value}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  tabIndex={isSelected || (!hasSessionType && index === 0) ? 0 : -1}
                  onClick={() => setSessionType(type.value)}
                  onKeyDown={e => handleSessionTypeKey(e, index)}
                  disabled={settingsLocked}
                  className={`px-4 py-3 rounded-xl border-2 text-left transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
                    isSelected
                      ? 'border-team-blue bg-team-blue/10'
                      : isDarkMode
                        ? 'border-team-blue-40 bg-team-dark hover:border-team-white-40'
                        : 'border-gray-300 bg-white hover:border-gray-400'
                  }`}
                >
                  <div
                    className={`text-sm font-bold ${
                      isSelected
                        ? toneText('blue', isDarkMode)
                        : isDarkMode
                          ? 'text-gray-200'
                          : 'text-gray-800'
                    }`}
                  >
                    {type.value}
                  </div>
                  <div
                    className={`text-xs mt-0.5 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}
                  >
                    {type.hint}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button
            onClick={handleSave}
            disabled={!hasName}
            className={`px-8 py-3 rounded-xl font-semibold transition-none disabled:opacity-50 disabled:cursor-not-allowed ${
              isUnsaved
                ? 'bg-red-600 text-white hover:bg-red-700'
                : savedBtnClass
            }`}
          >
            {!hasName && isUnsaved ? 'Enter a name to save' : 'Save'}
          </Button>
        </div>
      </div>
    </>
  );
};
