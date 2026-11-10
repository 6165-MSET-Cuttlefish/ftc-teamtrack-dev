import { useId, useState } from 'react';
import { BatteryMedium } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useSessionCore, useTheme } from '@/contexts';
import {
  BATTERY_MAX_V,
  BATTERY_MIN_V,
  toBatteryVoltage,
  useRecordBattery,
} from '@/lib/battery';
import { useScoringLocks } from './useScoringLocks';

/**
 * The next match's battery voltage, where this device asks for it (the
 * session menu's "Record battery voltage"). Typed before Start, or any time
 * until the match is saved, which keeps it on the match and empties this for
 * the next one. A saved match's voltage is changed from Analysis.
 */
export const BatteryField = () => {
  const on = useRecordBattery();
  const { editing, entryKey } = useScoringLocks();
  if (!on || editing) return null;
  // A fresh draft for each match the fields hold
  return <BatteryInput key={entryKey} />;
};

const BatteryInput = () => {
  const { isDarkMode } = useTheme();
  const { sessionData, updateSessionData } = useSessionCore();
  const saved = sessionData.batteryVoltage;
  const [draft, setDraft] = useState(saved === undefined ? '' : String(saved));
  const [invalid, setInvalid] = useState(false);
  const id = useId();
  const hintId = useId();

  const commit = () => {
    const text = draft.trim();
    if (text === '') {
      setInvalid(false);
      if (saved !== undefined) updateSessionData({ batteryVoltage: undefined });
      return;
    }
    const volts = toBatteryVoltage(text);
    if (volts === null) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    setDraft(String(volts));
    if (volts !== saved) updateSessionData({ batteryVoltage: volts });
  };

  const muted = isDarkMode ? 'text-team-white-60' : 'text-gray-600';

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <label
        htmlFor={id}
        className="flex items-center gap-1.5 text-sm font-semibold"
      >
        <BatteryMedium aria-hidden className="h-4 w-4" />
        Battery
      </label>
      <div className="relative w-28">
        <Input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          placeholder="12.8"
          value={draft}
          aria-invalid={invalid || undefined}
          aria-describedby={hintId}
          onChange={e => {
            setDraft(e.target.value);
            if (invalid) setInvalid(false);
          }}
          onBlur={commit}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              e.currentTarget.blur();
            }
          }}
          className={`h-10 pr-7 tabular-nums ${invalid ? '!border-red-500' : ''}`}
        />
        <span
          aria-hidden
          className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm ${muted}`}
        >
          V
        </span>
      </div>
      <span
        id={hintId}
        className={`text-xs ${invalid ? 'text-red-500' : muted}`}
      >
        {invalid
          ? `Enter volts between ${BATTERY_MIN_V} and ${BATTERY_MAX_V}`
          : saved === undefined
            ? 'Before Start, from the Driver Hub'
            : 'Kept with this match when it is saved'}
      </span>
    </div>
  );
};
