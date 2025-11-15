import React from 'react';
import { useSession } from '../contexts/SessionContext';
import { useTheme } from '../contexts/ThemeContext';
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
      <Label htmlFor={fieldId} className="text-base leading-6">
        {label}
      </Label>
      <Input
        id={fieldId}
        type="text"
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        disabled={disabled}
        className="px-2.5 py-2.5 rounded text-base font-normal leading-6 border border-team-blue-40 focus:outline-none focus:border-team-blue focus:ring-1 focus:ring-team-blue placeholder:text-muted-foreground disabled:opacity-50 disabled:cursor-not-allowed"
      />
    </div>
  );
};

export const SessionSetup: React.FC = () => {
  const { sessionData, updateSessionData } = useSession();
  const { isDarkMode } = useTheme();

  const setSessionName = (value: string) =>
    updateSessionData({ sessionName: value });
  const setDriverName = (value: string) =>
    updateSessionData({ driverName: value });
  const setMatchType = (value: string) =>
    updateSessionData({ matchType: value });

  const toggleFeature = (feature: string) => {
    const updatedFeatures = sessionData.enabledFeatures.includes(feature)
      ? sessionData.enabledFeatures.filter((f) => f !== feature)
      : [...sessionData.enabledFeatures, feature];
    updateSessionData({ enabledFeatures: updatedFeatures });
  };

  const AVAILABLE_FEATURES = ['Cycle Times'];

  return (
    <div className="space-y-8 mt-16">
      <h2 className="text-team-blue text-2xl font-semibold leading-6">
        Session Setup
      </h2>

      <div className="space-y-6">
        {/* First Row */}
        <div className="flex flex-col sm:flex-row gap-10">
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
        <div className="flex flex-col sm:flex-row gap-10">
          <div className="flex flex-col gap-2 w-full sm:max-w-[296px]">
            <Label className="text-base leading-6">Match Type</Label>
            <Select value={sessionData.matchType} onValueChange={setMatchType}>
              <SelectTrigger
                className={`w-full h-12 text-base font-normal leading-6 px-2.5 py-2.5 rounded border ${isDarkMode ? 'border-team-blue-40' : 'border-team-blue-40'}`}
              >
                <SelectValue placeholder="Select match type" />
              </SelectTrigger>
              <SelectContent className="bg-[#191919] border-team-blue-40">
                <SelectItem value="Autonomous">Autonomous</SelectItem>
                <SelectItem value="TeleOp">TeleOp</SelectItem>
                <SelectItem value="Full Game">Full Game</SelectItem>
                <SelectItem value="Practice">Practice</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2 w-full sm:max-w-[296px]">
            <Label className="text-base leading-6">Features</Label>
            <div className={`p-2.5 rounded border border-team-blue-40 space-y-2 ${isDarkMode ? 'bg-team-dark' : 'bg-[#FEFEFE]'}`}>
              {AVAILABLE_FEATURES.map((feature) => (
                <div key={feature} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id={`feature-${feature}`}
                    checked={sessionData.enabledFeatures.includes(feature)}
                    onChange={() => toggleFeature(feature)}
                    className="w-4 h-4 rounded border border-team-blue cursor-pointer accent-team-blue"
                  />
                  <label
                    htmlFor={`feature-${feature}`}
                    className={`text-sm cursor-pointer ${isDarkMode ? 'text-white' : 'text-black'}`}
                  >
                    {feature}
                  </label>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
