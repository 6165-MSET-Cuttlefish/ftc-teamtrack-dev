import { useSession, useTheme } from '@/contexts';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Button } from './ui/button';
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from './ui/select';

interface SessionSetupProps {
  onSave?: () => void;
}

export const SessionSetup = ({ onSave }: SessionSetupProps) => {
  const { sessionData, updateSessionData } = useSession();
  const { isDarkMode } = useTheme();

  const setSessionName = (value: string) =>
    updateSessionData({ sessionName: value });
  const setMatchType = (value: string) =>
    updateSessionData({ matchType: value });
  const setSelectedFeature = (value: string) =>
    updateSessionData({ selectedFeature: value });

  const handleSave = () => {
    onSave?.();
  };

  return (
    <div className="space-y-6">
      {/* Session Name */}
      <div className="space-y-2">
        <Label className={`text-sm font-semibold uppercase tracking-wide ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
          Session Name
        </Label>
        <Input
          type="text"
          value={sessionData.sessionName}
          onChange={(e) => setSessionName(e.target.value)}
          placeholder="Sunday Afternoon"
          className={`h-14 px-4 text-lg rounded-xl border-2 border-team-blue-40 transition-all duration-200 focus:ring-2 focus:ring-team-blue/20 ${
            isDarkMode
              ? 'bg-team-dark text-white placeholder:text-gray-500'
              : 'bg-white text-black placeholder:text-gray-400'
          }`}
        />
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
      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          className={`px-8 py-3 rounded-xl font-semibold transition-colors duration-200 ${
            isDarkMode
              ? 'bg-team-blue hover:bg-team-blue/90 text-black'
              : 'bg-team-blue hover:bg-team-blue/90 text-white'
          }`}
        >
          Save
        </Button>
      </div>
    </div>
  );
};
