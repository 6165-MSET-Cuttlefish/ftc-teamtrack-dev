import { useState, useEffect, useRef, memo } from 'react';
import { Info, Minus, Plus } from 'lucide-react';
import { useTheme } from '@/contexts';

interface ScoreFieldProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  /** Points this field currently contributes, shown beside the input */
  points?: number;
  disabled?: boolean;
  max?: number;
  /** Render larger, for the live-scoring panel */
  size?: 'default' | 'large';
  hint?: string;
  /**
   * Rules reminder behind an (i) icon beside the label. Shows on hover, and
   * toggles open on tap since phones have no hover.
   */
  info?: string;
  /** Show +/- buttons for quick tap adjustment without opening the keyboard */
  stepper?: boolean;
}

/**
 * A numeric entry field for one scoring element.
 *
 * Keeps its own text state while focused so partial input (an empty box
 * mid-edit) is never clobbered by the committed value, then commits a clamped
 * integer on blur or Enter.
 */
export const ScoreField = memo(
  ({
    label,
    value,
    onChange,
    points,
    disabled = false,
    max = 999,
    size = 'default',
    hint,
    info,
    stepper = false,
  }: ScoreFieldProps) => {
    const { isDarkMode } = useTheme();
    const [showInfo, setShowInfo] = useState(false);
    const [local, setLocal] = useState(String(value));
    const [focused, setFocused] = useState(false);
    const prev = useRef(value);

    useEffect(() => {
      if (!focused && prev.current !== value) {
        setLocal(String(value));
        prev.current = value;
      }
    }, [value, focused]);

    const commit = () => {
      const parsed = local.trim() === '' ? 0 : parseInt(local, 10);
      const next = Math.min(max, Math.max(0, Number.isNaN(parsed) ? 0 : parsed));
      setLocal(String(next));
      prev.current = next;
      if (next !== value) onChange(next);
    };

    const isLarge = size === 'large';

    const step = (delta: number) => {
      const current = local.trim() === '' ? 0 : parseInt(local, 10) || 0;
      const next = Math.min(max, Math.max(0, current + delta));
      setLocal(String(next));
      prev.current = next;
      if (next !== value) onChange(next);
    };

    // 48px on a phone keeps the tap target over the 44px minimum while
    // leaving room for the label on a 360px-wide screen.
    const stepBtnSize = isLarge ? 'w-12 h-12' : 'w-10 h-10';
    const stepIconSize = isLarge ? 20 : 16;
    const stepBtnClass = (atLimit: boolean) =>
      `flex items-center justify-center rounded-lg border-2 shrink-0 transition-colors ${stepBtnSize} ${
        disabled || atLimit
          ? 'opacity-40 cursor-not-allowed border-gray-400 bg-gray-200 dark:border-gray-700 dark:bg-gray-800'
          : isDarkMode
            ? 'border-team-blue-40 bg-team-dark text-white hover:bg-team-white-10 active:bg-team-white-10 cursor-pointer'
            : 'border-gray-300 bg-white text-black hover:bg-gray-100 active:bg-gray-100 cursor-pointer'
      }`;

    return (
      <div className="flex items-center gap-2 md:gap-3">
        <div className="flex-1 min-w-0">
          <div
            className={`font-semibold ${isLarge ? 'text-xl' : 'text-lg'} ${
              disabled
                ? isDarkMode
                  ? 'text-gray-600'
                  : 'text-gray-500'
                : isDarkMode
                  ? 'text-gray-200'
                  : 'text-gray-800'
            }`}
          >
            <span className="inline-flex items-center gap-1.5">
              {label}
              {info && (
                <button
                  type="button"
                  title={info}
                  aria-label={`About ${label}`}
                  aria-expanded={showInfo}
                  onClick={() => setShowInfo(v => !v)}
                  className={`rounded-full p-0.5 transition-colors ${
                    isDarkMode
                      ? 'text-gray-400 hover:text-team-blue'
                      : 'text-gray-500 hover:text-team-blue'
                  }`}
                >
                  <Info size={16} />
                </button>
              )}
            </span>
          </div>
          {hint && (
            <div
              className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}
            >
              {hint}
            </div>
          )}
          {info && showInfo && (
            <div
              className={`text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}
            >
              {info}
            </div>
          )}
        </div>

        {stepper && (
          <button
            type="button"
            aria-label={`Decrease ${label}`}
            disabled={disabled || value <= 0}
            onClick={() => step(-1)}
            className={stepBtnClass(value <= 0)}
          >
            <Minus size={stepIconSize} />
          </button>
        )}

        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          aria-label={label}
          value={local}
          disabled={disabled}
          onChange={e => setLocal(e.target.value.replace(/[^0-9]/g, ''))}
          onFocus={e => {
            setFocused(true);
            e.target.select();
          }}
          onBlur={() => {
            setFocused(false);
            commit();
          }}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.currentTarget.blur();
            }
          }}
          className={`text-center font-bold rounded-lg border-2 transition-colors tabular-nums ${
            isLarge
              ? 'h-12 w-16 text-xl md:w-20'
              : 'h-10 w-20 text-lg'
          } ${
            disabled
              ? 'opacity-40 cursor-not-allowed border-gray-400 bg-gray-200 dark:border-gray-700 dark:bg-gray-800'
              : isDarkMode
                ? 'border-team-blue-40 bg-team-dark text-white focus:border-team-blue focus:outline-none'
                : 'border-gray-300 bg-white text-black focus:border-team-blue focus:outline-none'
          }`}
        />

        {stepper && (
          <button
            type="button"
            aria-label={`Increase ${label}`}
            disabled={disabled || value >= max}
            onClick={() => step(1)}
            className={stepBtnClass(value >= max)}
          >
            <Plus size={stepIconSize} />
          </button>
        )}

        {points !== undefined && (
          <div
            className={`text-right tabular-nums shrink-0 ${isLarge ? 'text-sm w-12 md:w-16' : 'text-sm w-16'} font-semibold ${
              disabled
                ? isDarkMode
                  ? 'text-gray-600'
                  : 'text-gray-500'
                : points < 0
                  ? 'text-red-400'
                  : 'text-team-blue'
            }`}
          >
            {points} pts
          </div>
        )}
      </div>
    );
  }
);

ScoreField.displayName = 'ScoreField';
