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
    <div className="flex flex-col gap-2 w-full">
      <Label
        htmlFor={fieldId}
        className="text-xs sm:text-sm leading-5 font-medium"
      >
        {label}
      </Label>
      <Input
        id={fieldId}
        type="text"
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        disabled={disabled}
        className="h-10 px-3 py-2 rounded-lg text-sm font-normal leading-6 border border-team-blue-40 shadow-sm transition-all duration-200 focus:outline-none focus:border-team-blue focus:ring-2 focus:ring-team-blue/20 hover:border-team-blue/60 placeholder:text-muted-foreground disabled:opacity-50 disabled:cursor-not-allowed"
      />
    </div>
  );
};

export const SessionSetup = () => {
  const { sessionData, updateSessionData } = useSession();
  const { isDarkMode } = useTheme();

  const setSessionName = (value: string) =>
    updateSessionData({ sessionName: value });
  const setMatchType = (value: string) =>
    updateSessionData({ matchType: value });

  return (
    <div className="space-y-6">
      <h2 className="text-team-blue text-2xl font-semibold leading-6">
        Session Setup
      </h2>

      {/* Session Name and Match Type on same line */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
        <FormField
          label="Session Name"
          placeholder="ex. practice"
          value={sessionData.sessionName}
          onChange={setSessionName}
        />
        <div className="flex flex-col gap-2 w-full">
          <Label className="text-xs sm:text-sm leading-5 font-medium">
            Match Type
          </Label>
          <Select value={sessionData.matchType} onValueChange={setMatchType}>
            <SelectTrigger
              className={`w-full h-10 text-sm font-normal px-3 py-2 rounded-lg border shadow-sm transition-all duration-200 hover:border-team-blue/60 ${isDarkMode ? 'border-team-blue-40' : 'border-team-blue-40'}`}
            >
              <SelectValue placeholder="Select match type" />
            </SelectTrigger>
            <SelectContent
              className={`${isDarkMode ? 'bg-[#191919]' : 'bg-white'} border-team-blue-40`}
            >
              <SelectItem value="Full Game">Full Game</SelectItem>
              <SelectItem value="Autonomous">Autonomous</SelectItem>
              <SelectItem value="Teleop">Teleop</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
};
