import { UserRound } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/** Select has no empty value: this stands for every driver */
const ALL = '__all__';

/**
 * Narrows a page to one driver's matches. Shown only where some match has
 * a driver; `value` '' is every driver.
 */
export const DriverFilter = ({
  drivers,
  value,
  onChange,
  isDarkMode,
}: {
  /** The drivers to choose from, A to Z */
  drivers: string[];
  value: string;
  onChange: (driver: string) => void;
  isDarkMode: boolean;
}) => {
  if (drivers.length === 0) return null;
  return (
    <Select
      value={value || ALL}
      onValueChange={next => onChange(next === ALL ? '' : next)}
    >
      <SelectTrigger
        aria-label="Driver"
        className={`w-auto max-w-[12rem] text-xs sm:text-sm px-2 h-9 [@media(pointer:coarse)]:min-h-11 ${isDarkMode ? 'bg-team-dark border-team-blue-40 text-white' : 'bg-white border-gray-300'}`}
      >
        <UserRound className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2 flex-shrink-0" />
        <span className="min-w-0 truncate">
          <SelectValue />
        </span>
      </SelectTrigger>
      <SelectContent
        className={isDarkMode ? 'bg-team-dark border-team-blue-40' : 'bg-white'}
      >
        <SelectItem value={ALL}>All drivers</SelectItem>
        {drivers.map(driver => (
          <SelectItem key={driver} value={driver}>
            {driver}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
