/**
 * Controls the two lifetime pages (Charts and Compare) share.
 */

interface SegmentedProps<T extends string> {
  /** What is being chosen, for screen readers */
  label: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string; count?: number }>;
  onChange: (value: T) => void;
  isDarkMode: boolean;
}

/** A row of mutually exclusive choices; exactly one is pressed. */
export const Segmented = <T extends string>({
  label,
  value,
  options,
  onChange,
  isDarkMode,
}: SegmentedProps<T>) => (
  <div
    role="group"
    aria-label={label}
    className={`inline-flex flex-wrap gap-1 rounded-lg p-1 ${isDarkMode ? 'bg-white/5' : 'bg-gray-100'}`}
  >
    {options.map(option => {
      const active = option.value === value;
      return (
        <button
          key={option.value}
          type="button"
          aria-pressed={active}
          onClick={() => onChange(option.value)}
          className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors [@media(pointer:coarse)]:min-h-11 ${
            active
              ? `bg-team-blue ${isDarkMode ? 'text-black' : 'text-white'}`
              : isDarkMode
                ? 'text-team-white-60 hover:bg-white/10 hover:text-white'
                : 'text-gray-600 hover:bg-gray-200 hover:text-gray-900'
          }`}
        >
          {option.label}
          {option.count !== undefined && (
            <span className="ml-1.5 font-normal tabular-nums opacity-80">
              {option.count}
            </span>
          )}
        </button>
      );
    })}
  </div>
);
