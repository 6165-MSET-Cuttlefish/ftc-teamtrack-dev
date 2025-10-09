import React from 'react';
import { useSession } from '../contexts/SessionContext';
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
          <select
            id="match-type"
            value={sessionData.matchType}
            onChange={(e) => setMatchType(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-team-blue focus-visible:ring-offset-2 transition-colors"
          >
            <option value="">Select match type</option>
            <option value="Autonomous">Autonomous</option>
            <option value="Teleop">Teleop</option>
            <option value="Full Game">Full Game</option>
            <option value="Practice">Practice</option>
          </select>
        </div>
      </div>
    </section>
  );
};
