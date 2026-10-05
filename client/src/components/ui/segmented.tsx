import { useRef, type KeyboardEvent } from 'react';
import type { LucideIcon } from 'lucide-react';

import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';
import { selectedClass } from './tokens';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  /** A number after the label (how many sessions the choice covers) */
  count?: number;
  /** Shown before the label (over it on a phone, with `stackIcons`) */
  icon?: LucideIcon;
  /** The button's id: with `tabs`, what its panel's aria-labelledby names */
  id?: string;
  /** With `tabs`: the id of the panel this tab shows, named while picked */
  controls?: string;
}

export interface SegmentedProps<T extends string> {
  /** What is being chosen, for screen readers */
  label: string;
  value: T;
  options: ReadonlyArray<SegmentedOption<T>>;
  onChange: (value: T) => void;
  /** The theme's unless given */
  isDarkMode?: boolean;
  /**
   * A tab bar: role=tablist / tab with aria-selected, one Tab stop, and the
   * arrow keys, Home and End move along it and pick as they go. Wrap the
   * content it switches in `role="tabpanel"`, labelled by the picked
   * option's `id` and with the id its `controls` names.
   */
  tabs?: boolean;
  /** Across the whole width, the options sharing it equally */
  fill?: boolean;
  /** `sm` (default): a filter's size. `md`: a page's tab bar, larger from `sm` up */
  size?: 'sm' | 'md';
  /** Icons over their labels below `sm`, side by side from `sm` up */
  stackIcons?: boolean;
  /** Merged onto the track (a border, a width) */
  className?: string;
}

/**
 * Padding one pixel short of the size's, for the border every option keeps
 * (transparent until picked) so that picking one moves nothing.
 */
const SIZES = {
  sm: {
    button: 'px-[11px] py-[5px] text-xs',
    gap: 'gap-1.5',
    icon: 14,
  },
  md: {
    button: 'px-[7px] py-[5px] text-xs sm:px-[15px] sm:py-[9px] sm:text-sm',
    gap: 'gap-2',
    icon: 16,
  },
} as const;

/**
 * A row of mutually exclusive choices; exactly one is picked, in the shared
 * SELECTED look (accent tint, accent border, strong text). At least 44px
 * tall on touch screens. A row of toggle buttons unless `tabs` makes it a
 * tab bar.
 */
export const Segmented = <T extends string>({
  label,
  value,
  options,
  onChange,
  isDarkMode: isDarkModeProp,
  tabs = false,
  fill = false,
  size = 'sm',
  stackIcons = false,
  className,
}: SegmentedProps<T>) => {
  const theme = useTheme();
  const isDarkMode = isDarkModeProp ?? theme.isDarkMode;
  const listRef = useRef<HTMLDivElement>(null);
  const sizing = SIZES[size];
  // The one Tab stop of a tab bar: the picked tab, or the first if none is.
  const tabStop = Math.max(
    options.findIndex(option => option.value === value),
    0
  );

  /** Arrow keys move between tabs, as in any tablist */
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const count = options.length;
    const next =
      e.key === 'ArrowRight'
        ? (tabStop + 1) % count
        : e.key === 'ArrowLeft'
          ? (tabStop - 1 + count) % count
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? count - 1
              : -1;
    if (next === -1 || count === 0) return;
    e.preventDefault();
    onChange(options[next].value);
    const tabButtons =
      listRef.current?.querySelectorAll<HTMLElement>('[role="tab"]');
    tabButtons?.[next]?.focus();
  };

  return (
    <div
      ref={listRef}
      role={tabs ? 'tablist' : 'group'}
      aria-label={label}
      onKeyDown={tabs ? onKeyDown : undefined}
      className={cn(
        'gap-1 rounded-lg p-1',
        fill ? 'flex w-full' : 'inline-flex flex-wrap',
        isDarkMode ? 'bg-white/5' : 'bg-gray-100',
        className
      )}
    >
      {options.map((option, index) => {
        const active = option.value === value;
        const Icon = option.icon;
        return (
          <button
            key={option.value}
            type="button"
            id={option.id}
            {...(tabs
              ? {
                  role: 'tab',
                  'aria-selected': active,
                  'aria-controls': active ? option.controls : undefined,
                  tabIndex: index === tabStop ? 0 : -1,
                }
              : { 'aria-pressed': active })}
            onClick={() => onChange(option.value)}
            className={`inline-flex items-center justify-center rounded-md border font-semibold transition-colors [@media(pointer:coarse)]:min-h-11 ${sizing.button} ${
              stackIcons && Icon
                ? 'flex-col gap-0.5 sm:flex-row sm:gap-2'
                : sizing.gap
            } ${fill ? 'flex-1 min-w-0' : ''} ${
              active
                ? selectedClass(isDarkMode)
                : `border-transparent ${
                    isDarkMode
                      ? 'text-team-white-60 hover:bg-white/10 hover:text-white'
                      : 'text-gray-600 hover:bg-gray-200 hover:text-gray-900'
                  }`
            }`}
          >
            {Icon && (
              <Icon size={sizing.icon} aria-hidden className="shrink-0" />
            )}
            <span>{option.label}</span>
            {option.count !== undefined && (
              <span className="font-normal tabular-nums opacity-80">
                {option.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
