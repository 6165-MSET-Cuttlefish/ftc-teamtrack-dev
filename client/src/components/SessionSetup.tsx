import { useSession, useTheme } from '@/contexts';
import { Input } from './ui/input';
import { Label } from './ui/label';
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from './ui/select';

interface FormFieldProps {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  type?: 'text' | 'number' | 'decimal';
  id?: string;
  disabled?: boolean;
}

const FormField = ({
  label,
  placeholder,
  value,
  onChange,
  type = 'text',
  id,
  disabled = false,
}: FormFieldProps) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (type === 'number') {
      const numericValue = e.target.value.replace(/[^0-9]/g, '');
      onChange(numericValue);
    } else if (type === 'decimal') {
      const decimalValue = e.target.value.replace(/[^0-9.]/g, '');
      const parts = decimalValue.split('.');
      if (parts.length > 2) {
        onChange(`${parts[0]}.${parts.slice(1).join('')}`);
      } else {
        onChange(decimalValue);
      }
    } else {
      onChange(e.target.value);
    }
  };

  const fieldId = id || label.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className="flex flex-col gap-2 w-full sm:max-w-[296px]">
      <Label htmlFor={fieldId} className="text-sm sm:text-base leading-6 font-medium">
        {label}
        {(label === 'Session Name' || label === 'Driver Name') && (
          <span className="text-red-500 ml-1" title="Required field">*</span>
        )}
      </Label>
      <Input
        id={fieldId}
        type="text"
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        disabled={disabled}
        className="h-11 sm:h-12 px-3 sm:px-4 py-2.5 rounded-lg text-sm sm:text-base font-normal leading-6 border border-team-blue-40 shadow-sm transition-all duration-200 focus:outline-none focus:border-team-blue focus:ring-2 focus:ring-team-blue/20 hover:border-team-blue/60 placeholder:text-muted-foreground disabled:opacity-50 disabled:cursor-not-allowed"
      />
    </div>
  );
};

export const SessionSetup = () => {
  const { sessionData, updateSessionData } = useSession();
  const { isDarkMode } = useTheme();

  const setSessionName = (value: string) =>
    updateSessionData({ sessionName: value });
  const setDriverName = (value: string) =>
    updateSessionData({ driverName: value });
  const setMatchType = (value: string) =>
    updateSessionData({ matchType: value });
  const setSelectedFeature = (value: string) =>
    updateSessionData({ selectedFeature: value });

  // Check if required fields are filled
  const isSessionNameEmpty = !sessionData.sessionName?.trim();
  const isDriverNameEmpty = !sessionData.driverName?.trim();
  const hasRequiredFields = !isSessionNameEmpty && !isDriverNameEmpty;

  return (
    <div className="space-y-8 mt-16">
      <div className="flex items-center gap-2">
        <h2 className="text-team-blue text-3xl font-bold leading-6">
          Session Setup
        </h2>
        <span className="text-red-500 text-xl font-bold" title="Required fields">*</span>
      </div>

      {!hasRequiredFields && (
        <div className="text-sm text-red-500">
          <strong>Required:</strong> Please fill in Session Name and Driver Name before completing the session.
        </div>
      )}

      <div className="space-y-6">
        {/* First Row */}
        <div className="flex flex-col sm:flex-row gap-12">
          <FormField
            label="Session Name"
            placeholder="ex. practice"
            value={sessionData.sessionName}
            onChange={setSessionName}
          />
          <FormField
            label="Driver Name"
            placeholder="Enter driver name"
            value={sessionData.driverName}
            onChange={setDriverName}
          />
        </div>

        {/* Second Row */}
        <div className="flex flex-col sm:flex-row gap-12">
          <div className="flex flex-col gap-2 w-full sm:max-w-[296px]">
            <Label className="text-sm sm:text-base leading-6 font-medium">Match Type</Label>
            <Select value={sessionData.matchType} onValueChange={setMatchType}>
              <SelectTrigger
                className={`w-full h-12 text-base font-normal leading-6 px-4 py-2.5 rounded-lg border shadow-sm transition-all duration-200 hover:border-team-blue/60 ${isDarkMode ? 'border-team-blue-40' : 'border-team-blue-40'}`}
              >
                <SelectValue placeholder="Select match type" />
              </SelectTrigger>
              <SelectContent className={`${isDarkMode ? 'bg-[#191919]' : 'bg-white'} border-team-blue-40`}>
                <SelectItem value="Autonomous">Autonomous</SelectItem>
                <SelectItem value="TeleOp">TeleOp</SelectItem>
                <SelectItem value="Full Game">Full Game</SelectItem>
                <SelectItem value="Practice">Practice</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2 w-full sm:max-w-[296px]">
            <Label className="text-sm sm:text-base leading-6 font-medium">Features</Label>
            <Select
              value={sessionData.selectedFeature}
              onValueChange={setSelectedFeature}
            >
              <SelectTrigger
                className={`w-full h-12 text-base font-normal leading-6 px-4 py-2.5 rounded-lg border shadow-sm transition-all duration-200 hover:border-team-blue/60 ${isDarkMode ? 'border-team-blue-40' : 'border-team-blue-40'}`}
              >
                <SelectValue placeholder="Select feature" />
              </SelectTrigger>
              <SelectContent className={`${isDarkMode ? 'bg-[#191919]' : 'bg-white'} border-team-blue-40`}>
                <SelectItem value="Cycle Times">Cycle Times</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>
  );
};
