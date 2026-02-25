import { useState, useEffect } from 'react';
import { useSession, useTheme } from '@/contexts';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Button } from '../ui/button';
import { AlertTriangle } from 'lucide-react';
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '../ui/select';

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
  const { sessionData, updateSessionData, matchActive } = useSession();
  const { isDarkMode } = useTheme();
  const savedBtnClass = `bg-team-blue ${isDarkMode ? 'text-black' : 'text-white'}`;
  const [isFlashing, setIsFlashing] = useState(shouldFlash);

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

  const hasName = sessionData.sessionName?.trim().length > 0;

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
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-team-blue">Session Settings</h3>
          {isUnsaved && (
            <div className="flex items-center gap-1.5 text-red-500">
              <AlertTriangle
                size={16}
                className={isFlashing ? 'flash-animate' : ''}
              />
              <span className="text-xs font-semibold uppercase tracking-wide">
                Setup required
              </span>
            </div>
          )}
        </div>

        {/* Session Name and Match Type */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="flex flex-col">
            <Label
              className={`text-sm font-semibold uppercase tracking-wide mb-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}
            >
              Session Name
            </Label>
            <Input
              type="text"
              value={sessionData.sessionName}
              onChange={e => setSessionName(e.target.value)}
              placeholder="Sunday Afternoon"
              className={`h-14 px-4 rounded-xl border-2 transition-all duration-200 focus:ring-2 focus:ring-team-blue/20 ${
                isUnsaved && !hasName ? 'border-red-400' : 'border-team-blue-40'
              } ${
                isDarkMode
                  ? 'bg-team-dark text-white placeholder:text-gray-500'
                  : 'bg-white text-black placeholder:text-gray-400'
              }`}
            />
            {isUnsaved && !hasName && (
              <p className="text-xs text-red-400 font-medium mt-2">
                Session name is required
              </p>
            )}
          </div>

          <div className="flex flex-col">
            <Label
              className={`text-sm font-semibold uppercase tracking-wide mb-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}
            >
              Match Type
            </Label>
            <div
              className={`h-14 px-4 rounded-xl border-2 border-team-blue-40 transition-all duration-200 flex items-center ${
                isDarkMode ? 'bg-team-dark text-white' : 'bg-white text-black'
              } ${matchActive ? 'opacity-60 cursor-not-allowed' : ''}`}
              style={matchActive ? { pointerEvents: 'none' } : {}}
            >
              <Select
                value={sessionData.matchType}
                onValueChange={matchActive ? () => {} : setMatchType}
              >
                <SelectTrigger className="border-0 p-0 h-auto focus:ring-0 bg-transparent">
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
            <p className={`text-xs italic mt-2 ${
              matchActive ? 'text-gray-500' : 'text-gray-400'
            }`}>
              {matchActive ? 'Locked' : 'Will lock once match starts'}
            </p>
            {(sessionData.matchType === 'Autonomous' || sessionData.matchType === 'Teleop') && (
              <p className="text-xs italic mt-1 text-amber-500/80">
                There is no audio or additional time in these modes
              </p>
            )}
          </div>
        </div>

        {/* Motif Toggle */}
        <div className="flex flex-col">
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={sessionData.motifPattern !== undefined}
              onChange={e => {
                if (e.target.checked) {
                  updateSessionData({ motifPattern: ['empty', 'empty', 'empty'] });
                } else {
                  updateSessionData({ motifPattern: undefined });
                }
              }}
              disabled={matchActive}
              className="w-4 h-4 accent-team-blue cursor-pointer"
            />
            <span className={`text-sm font-semibold tracking-wide ${
              isDarkMode ? 'text-gray-300' : 'text-gray-700'
            }`}>Enable Motif Scoring</span>
          </label>
          <p className={`text-xs mt-2 ${
            isDarkMode ? 'text-gray-500' : 'text-gray-400'
          }`}>
            {sessionData.motifPattern !== undefined ? 'Motif buttons will appear during the match' : 'Skip motif scoring for this match'}
          </p>
        </div>

        {/* Save Button */}
        <div className="flex justify-end pt-2">
          <Button
            onClick={handleSave}
            disabled={!hasName}
            className={`px-8 py-3 rounded-xl font-semibold transition-none disabled:opacity-50 disabled:cursor-not-allowed ${
              isUnsaved
                ? 'bg-red-500 text-white hover:bg-red-600'
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
