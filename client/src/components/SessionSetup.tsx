import React from 'react';
import { useSession } from '../contexts/SessionContext';
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
}

const FormField = ({
  label,
  placeholder,
  value,
  onChange,
  type = 'text',
  id,
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
        className="px-2.5 py-2.5 rounded text-base font-normal leading-6 border border-team-blue-40 focus:outline-none focus:border-team-blue focus:ring-1 focus:ring-team-blue placeholder:text-team-white-40"
      />
    </div>
  );
};

export const SessionSetup: React.FC = () => {
  const { sessionData, updateSessionData } = useSession();

  const setSessionName = (value: string) =>
    updateSessionData({ sessionName: value });
  const setDriverName = (value: string) =>
    updateSessionData({ driverName: value });
  const setSessionDuration = (value: string) =>
    updateSessionData({ sessionDuration: value });
  const setMatchType = (value: string) =>
    updateSessionData({ matchType: value });

  return (
    <div className="space-y-8 mt-16">
      <h2 className="text-team-blue text-2xl font-semibold leading-6">
        Session Setup
      </h2>

      <div className="space-y-6">
        {/* First Row */}
        <div className="flex flex-col sm:flex-row gap-6">
          <FormField
            label="Session Name"
            placeholder="ex. practice"
            value={sessionData.sessionName}
            onChange={setSessionName}
          />
          <FormField
            label="Driver Name"
            placeholder="Ethan Yang"
            value={sessionData.driverName}
            onChange={setDriverName}
          />
        </div>

        {/* Second Row */}
        <div className="flex flex-col sm:flex-row gap-6">
          <FormField
            label="Session Duration"
            placeholder="minutes"
            value={sessionData.sessionDuration}
            onChange={setSessionDuration}
            type="decimal"
          />

          <div className="flex flex-col gap-2 w-full sm:max-w-[296px]">
            <Label className="text-base leading-6">Match Type</Label>
            <Select value={sessionData.matchType} onValueChange={setMatchType}>
              <SelectTrigger
                className={`w-full h-12 text-base font-normal leading-6 px-2.5 py-2.5 rounded border border-team-blue-40`}
              >
                <SelectValue placeholder="Select match type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Autonomous">Autonomous</SelectItem>
                <SelectItem value="Teleop">Teleop</SelectItem>
                <SelectItem value="Full Game">Full Game</SelectItem>
                <SelectItem value="Practice">Practice</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>
  );
};
