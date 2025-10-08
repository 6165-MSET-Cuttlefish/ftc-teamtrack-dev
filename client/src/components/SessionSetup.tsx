import React from 'react';
import { useSession } from '../contexts/SessionContext';
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from './ui/select';

import { Input } from './ui/input';
import { Label } from './ui/label';

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
      // Only allow numbers
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
      <Label htmlFor={fieldId} className="text-sm font-medium">
        {label}
      </Label>
      <Input
        id={fieldId}
        type="text"
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        className="transition-colors focus:ring-2 focus:ring-team-blue focus:border-team-blue"
      />
    </div>
  );
};

export const SessionSetup = () => {
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
    <section className="space-y-6">
      <h2 className="text-team-blue text-2xl font-semibold">
        Session Setup
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <FormField
          id="session-name"
          label="Session Name"
          placeholder="e.g., Morning Practice"
          value={sessionData.sessionName}
          onChange={setSessionName}
        />
        <FormField
          id="driver-name"
          label="Driver Name"
          placeholder="e.g., Ethan Yang"
          value={sessionData.driverName}
          onChange={setDriverName}
        />
        <FormField
          id="session-duration"
          label="Session Duration (minutes)"
          placeholder="e.g., 15"
          value={sessionData.sessionDuration}
          onChange={setSessionDuration}
          type="decimal"
        />
        <div className="flex flex-col gap-2">
          <Label htmlFor="match-type" className="text-sm font-medium">
            Match Type
          </Label>
          <Select
            value={sessionData.matchType}
            onValueChange={setMatchType}
          >
            <SelectTrigger
              id="match-type"
              className="transition-colors focus:ring-2 focus:ring-team-blue focus:border-team-blue"
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
    </section>
  );
};
