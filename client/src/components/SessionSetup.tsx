import { useState, useEffect } from 'react';
import { useSession, useTheme } from '@/contexts';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Button } from './ui/button';
import { AlertTriangle } from 'lucide-react';
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from './ui/select';

interface SessionSetupProps {
  onSave?: () => void;
  shouldFlash?: boolean;
  isUnsaved?: boolean;
}

export const SessionSetup = ({ onSave, shouldFlash = false, isUnsaved = false }: SessionSetupProps) => {
  const { sessionData, updateSessionData } = useSession();
  const { isDarkMode } = useTheme();
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
  const setSelectedFeature = (value: string) =>
    updateSessionData({ selectedFeature: value });

  const hasName = sessionData.sessionName?.trim().length > 0;

  const handleSave = () => {
    if (!hasName) return;
    onSave?.();
  };

  return (
    <>
      <style>{`
        @keyframes redGlow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.6), 0 0 10px rgba(239,68,68,0.2); }
          50% { box-shadow: 0 0 0 4px rgba(239,68,68,0.2), 0 0 20px rgba(239,68,68,0.35); }
        }
        @keyframes savePulse {
          0%, 100% { background-color: rgb(239,68,68); transform: scale(1); }
          50% { background-color: rgb(185,28,28); transform: scale(1.04); }
        }
        .red-glow-border {
          animation: redGlow 1.4s ease-in-out infinite;
        }
        .save-pulse {
          animation: savePulse 0.7s ease-in-out infinite;
          background-color: rgb(239,68,68) !important;
          color: white !important;
        }
      `}</style>
      <div
        className={`rounded-2xl p-6 space-y-6 ${isUnsaved ? 'red-glow-border' : ''}`}
        style={{
          border: `2px solid ${isUnsaved ? 'rgb(239,68,68)' : 'rgba(59,130,246,0.4)'}`,
          backgroundColor: isUnsaved ? 'rgba(239,68,68,0.06)' : 'transparent',
          transition: 'background-color 0.3s, border-color 0.3s',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-team-blue">
            Session Settings
          </h3>
          {isUnsaved && (
            <div className="flex items-center gap-1.5 text-red-500">
              <AlertTriangle size={16} className={isFlashing ? 'flash-animate' : ''} />
              <span className="text-xs font-semibold uppercase tracking-wide">Setup required</span>
            </div>
          )}
        </div>

        {/* Session Name */}
        <div className="space-y-2">
          <Label className={`text-sm font-semibold uppercase tracking-wide ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            Session Name <span className="text-red-500">*</span>
          </Label>
          <Input
            type="text"
            value={sessionData.sessionName}
            onChange={(e) => setSessionName(e.target.value)}
            placeholder="Sunday Afternoon"
            className={`h-14 px-4 text-lg rounded-xl border-2 transition-all duration-200 focus:ring-2 focus:ring-team-blue/20 ${
              isUnsaved && !hasName
                ? 'border-red-400'
                : 'border-team-blue-40'
            } ${
              isDarkMode
                ? 'bg-team-dark text-white placeholder:text-gray-500'
                : 'bg-white text-black placeholder:text-gray-400'
            }`}
          />
          {isUnsaved && !hasName && (
            <p className="text-xs text-red-400 font-medium">Session name is required</p>
          )}
        </div>

        {/* Match Type and Features */}
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label className={`text-sm font-semibold uppercase tracking-wide ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              Match Type
            </Label>
            <div className={`h-14 px-4 rounded-xl border-2 border-team-blue-40 transition-all duration-200 flex items-center ${
              isDarkMode
                ? 'bg-team-dark text-white'
                : 'bg-white text-black'
            }`}>
              <Select value={sessionData.matchType} onValueChange={setMatchType}>
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
          </div>

          <div className="space-y-2">
            <Label className={`text-sm font-semibold uppercase tracking-wide ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              Features
            </Label>
            <div className={`h-14 px-4 rounded-xl border-2 border-team-blue-40 transition-all duration-200 flex items-center ${
              isDarkMode
                ? 'bg-team-dark text-white'
                : 'bg-white text-black'
            }`}>
              <Select value={sessionData.selectedFeature || 'none'} onValueChange={setSelectedFeature}>
                <SelectTrigger className="border-0 p-0 h-auto focus:ring-0 bg-transparent">
                  <SelectValue placeholder="Select Feature" />
                </SelectTrigger>
                <SelectContent
                  className={`${isDarkMode ? 'bg-[#2a2a2a] border-gray-700' : 'bg-white border-gray-200'}`}
                >
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="cycle-times">Cycle Times</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end pt-2">
          <Button
            onClick={handleSave}
            disabled={!hasName}
            className={`px-8 py-3 rounded-xl font-semibold transition-none disabled:cursor-not-allowed ${
              isUnsaved
                ? 'save-pulse disabled:save-pulse'
                : isDarkMode
                  ? 'bg-team-blue hover:bg-team-blue/90 text-black'
                  : 'bg-team-blue hover:bg-team-blue/90 text-black'
            }`}
          >
            {!hasName && isUnsaved ? 'Enter a name to save' : 'Save'}
          </Button>
        </div>
      </div>
    </>
  );
};
