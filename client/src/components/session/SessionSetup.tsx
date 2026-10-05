import { useState, useEffect, useId, type KeyboardEvent } from 'react';
import { useSessionCore, useTheme } from '@/contexts';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SECTION_TITLE_CLASS } from '@/components/ui/page-header';
import { selectedClass } from '@/components/ui/tokens';
import { Lock } from 'lucide-react';
import type { SessionType } from '@/types';
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@/components/ui/select';
import { actionClass, toneText } from './controls/tones';

/** Long enough for any real name, short enough not to break page layouts */
const MAX_NAME_LENGTH = 80;

const SESSION_TYPES: Array<{ value: SessionType; hint: string }> = [
  { value: 'Practice', hint: 'Solo drilling and repetition' },
  { value: 'Scrim', hint: 'Matches vs. another alliance — adds penalties' },
];

interface SessionSetupProps {
  onSave?: () => void;
  /** Draw the eye to what is missing: the user tried to start without it */
  shouldFlash?: boolean;
  /**
   * The settings have not been saved yet. The panel looks the same either
   * way (an empty name says so under its field), so this is not used.
   */
  isUnsaved?: boolean;
}

/**
 * Session name, match type and session type. One layout in every state:
 * clearing the name to type a new one only adds "Session name is required"
 * under the field and holds Save back until there is a name. Save is an
 * outline, so the page's one filled button stays Start Match (or +1 Tip).
 */
export const SessionSetup = ({
  onSave,
  shouldFlash = false,
}: SessionSetupProps) => {
  const { sessionData, updateSessionData, matchActive, isTutorialActive } =
    useSessionCore();
  // The match type and session type are fixed once a match is under way. The
  // walkthrough's practice match doesn't count: its settings step says they
  // can be changed, and whatever is changed there is put back when it closes.
  const settingsLocked = matchActive && !isTutorialActive;
  const { isDarkMode } = useTheme();
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
    <div className="space-y-6">
      <h2 className={SECTION_TITLE_CLASS}>Session Settings</h2>

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
            aria-invalid={!hasName}
            aria-describedby={!hasName ? nameErrorId : undefined}
            className={`h-14 px-4 rounded-xl border-2 transition-all duration-200 focus:ring-2 focus:ring-team-blue/20 ${
              !hasName ? 'border-red-400' : 'border-team-blue-40'
            } ${
              isDarkMode
                ? 'bg-team-dark text-white placeholder:text-gray-500'
                : 'bg-white text-black placeholder:text-gray-400'
            }`}
          />
          {!hasName && (
            <p
              id={nameErrorId}
              className={`text-xs font-medium mt-2 ${toneText('red', isDarkMode)} ${
                isFlashing ? 'animate-pulse' : ''
              }`}
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
          {/* The whole box is the trigger: a tap anywhere in it opens the list */}
          <Select
            name="matchType"
            value={sessionData.matchType}
            onValueChange={setMatchType}
            disabled={settingsLocked}
          >
            <SelectTrigger
              id={matchTypeId}
              aria-labelledby={`${matchTypeLabelId} ${matchTypeId}`}
              aria-describedby={settingsLocked ? matchTypeLockId : undefined}
              className={`h-14 w-full px-4 rounded-xl border-2 border-team-blue-40 transition-all duration-200 focus:ring-2 focus:ring-team-blue/20 focus:ring-offset-0 disabled:opacity-60 ${
                isDarkMode ? 'bg-team-dark text-white' : 'bg-white text-black'
              }`}
            >
              <SelectValue placeholder="Full Game" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Full Game">Full Game</SelectItem>
              <SelectItem value="Autonomous">Autonomous</SelectItem>
              <SelectItem value="Teleop">Teleop</SelectItem>
            </SelectContent>
          </Select>
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
                tabIndex={
                  isSelected || (!hasSessionType && index === 0) ? 0 : -1
                }
                onClick={() => setSessionType(type.value)}
                onKeyDown={e => handleSessionTypeKey(e, index)}
                disabled={settingsLocked}
                // Titles level along the top, however many lines each hint
                // takes.
                className={`flex flex-col justify-start px-4 py-3 rounded-xl border-2 text-left transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
                  isSelected
                    ? selectedClass(isDarkMode)
                    : isDarkMode
                      ? 'border-team-blue-40 bg-team-dark text-gray-200 hover:border-team-white-40'
                      : 'border-gray-300 bg-white text-gray-800 hover:border-gray-400'
                }`}
              >
                <span className="text-sm font-bold">{type.value}</span>
                <span
                  className={`text-xs mt-0.5 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}
                >
                  {type.hint}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={!hasName}
          className={`h-12 rounded-2xl px-6 text-base ${actionClass('neutral', isDarkMode)}`}
        >
          Save
        </button>
      </div>
    </div>
  );
};
