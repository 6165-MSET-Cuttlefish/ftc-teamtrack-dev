/* eslint-disable react-refresh/only-export-components */

/**
 * What every Recharts chart in the app shares, so they read as one set: axis
 * colours with enough contrast, small legends, one dot recipe and one tooltip
 * that draws above the legend.
 */

import type { CSSProperties } from 'react';
import type {
  AreaProps,
  LegendProps,
  LineProps,
  XAxisProps,
  YAxisProps,
} from 'recharts';
import type { ChartDataPoint } from '@/types';

/** A number as shown: whole numbers as they are, the rest to one decimal. */
const formatNumber = (value: number): string => {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
};

/**
 * The axis colour: slate-400 on the dark themes and slate-500 on light (about
 * 6.9:1 and 4.75:1). For anything drawn in it besides the axis itself, such
 * as an axis `label`'s fill.
 */
export const axisColor = (isDarkMode: boolean): string =>
  isDarkMode ? '#94a3b8' : '#64748b';

/**
 * Spread on every XAxis and YAxis: `<XAxis dataKey="id" {...axisProps(isDarkMode)} />`.
 * The tick labels get their fill explicitly rather than following the stroke.
 * A `tick` passed after the spread replaces this one whole, so give it the
 * fill too.
 */
export const axisProps = (isDarkMode: boolean) => {
  const color = axisColor(isDarkMode);
  return {
    stroke: color,
    tick: { fontSize: 12, fill: color },
  } satisfies XAxisProps & YAxisProps;
};

/**
 * Spread on every Legend: `<Legend {...LEGEND_PROPS} itemSorter={null} />`.
 * The legend is no larger than the axes (the label colour is set in
 * global.css, `.recharts-legend-item-text`).
 */
export const LEGEND_PROPS = {
  wrapperStyle: { fontSize: 12 },
  iconSize: 10,
} satisfies LegendProps;

/**
 * Every Tooltip's `wrapperStyle`: draws the tooltip above the legend, whose
 * text otherwise shows through it on a phone.
 * `<Tooltip wrapperStyle={TOOLTIP_WRAPPER_STYLE} content={<ChartTooltip … />} />`
 */
export const TOOLTIP_WRAPPER_STYLE = { zIndex: 10 } satisfies CSSProperties;

/**
 * The one dot recipe for a Line or an Area, spread on it:
 * `<Line stroke={color} {...dotProps(cardBg, color)} />`.
 *
 * Filled with the series colour and ringed in the card's background, so the
 * ring disappears into the card and only separates overlapping dots. The ring
 * stays solid on a dashed series: a dot inherits the line's strokeDasharray,
 * which drew broken 'cog' rings.
 *
 * @param cardBg the colour of the card the chart sits on
 * @param color the series colour (the line's stroke)
 */
export const dotProps = (cardBg: string, color: string) =>
  ({
    dot: {
      r: 4,
      fill: color,
      stroke: cardBg,
      strokeWidth: 2,
      strokeDasharray: '0',
    },
    activeDot: {
      r: 6,
      fill: color,
      stroke: cardBg,
      strokeWidth: 2,
      strokeDasharray: '0',
    },
  }) satisfies Pick<LineProps, 'dot' | 'activeDot'> &
    Pick<AreaProps, 'dot' | 'activeDot'>;

/** One series under the pointer, as Recharts hands it to the tooltip */
export interface ChartTooltipEntry {
  name?: string | number;
  value?: number | string | null;
  color?: string;
  /** The chart row this entry was read from */
  payload?: ChartDataPoint;
}

export interface ChartTooltipProps {
  /** Filled in by Recharts */
  active?: boolean;
  /** Filled in by Recharts */
  payload?: ReadonlyArray<ChartTooltipEntry>;
  /** Filled in by Recharts: the axis value under the pointer */
  label?: string | number;
  isDarkMode: boolean;
  /** How a value is written; by default to one decimal at most: '39', '5.3' */
  formatValue?: (value: number, name: string) => string;
  /** Adds a row that sums the series, for a stack that adds up to a figure */
  formatTotal?: (sum: number) => string;
  /**
   * The row field that names the column in full, for the heading. Defaults to
   * 'label'; without one the heading is the axis value.
   */
  titleKey?: string;
  /** A last quiet line, e.g. what a tap on this column does */
  hint?: string;
}

/**
 * The chart tooltip: the row's full name as the heading, then each series
 * with its colour dot and value (the colour is on the dot: as text most
 * series colours are under 4.5:1). The row's `note` field, if any, is printed
 * under the series. Pass it as an element so Recharts fills in the rest:
 * `<Tooltip content={<ChartTooltip isDarkMode={isDarkMode} />} />`.
 */
export const ChartTooltip = ({
  active,
  payload,
  label,
  isDarkMode,
  formatValue = formatNumber,
  formatTotal,
  titleKey = 'label',
  hint,
}: ChartTooltipProps) => {
  if (!active || !payload || payload.length === 0) return null;
  // The axis value is only the row's key; the row carries its full label.
  const row = payload[0].payload;
  // A series with no value in this row (a match of another type, say) has
  // nothing to say here.
  const entries = payload.filter(
    entry => entry.value !== null && entry.value !== undefined
  );
  const title = row?.[titleKey] ?? label;
  const note = row?.note;
  const sum = entries.reduce(
    (acc, entry) => acc + (typeof entry.value === 'number' ? entry.value : 0),
    0
  );
  const nameTone = isDarkMode ? 'text-team-white-60' : 'text-gray-600';
  const valueTone = isDarkMode ? 'text-white' : 'text-gray-900';
  return (
    // Kept narrower than a phone's chart, or Recharts can't place it inside
    // and its right-hand values are cut off.
    <div
      className={`max-w-[min(20rem,calc(100vw-6rem))] p-3 sm:p-4 rounded-lg border ${isDarkMode ? 'bg-team-dark/95 border-team-blue-40 backdrop-blur-sm' : 'bg-white/95 border-gray-200 backdrop-blur-sm'} shadow-xl`}
    >
      {title !== undefined && title !== '' && (
        <p
          className={`text-sm sm:text-base font-bold mb-2 pb-1.5 sm:mb-3 sm:pb-2 border-b [overflow-wrap:anywhere] ${isDarkMode ? 'text-white border-team-blue-40' : 'text-gray-900 border-gray-200'}`}
        >
          {title}
        </p>
      )}
      <div className="space-y-1 sm:space-y-2">
        {entries.map((entry, index) => (
          <div key={index} className="flex items-center justify-between gap-4">
            {/* No colon after the name: the dot and the value across from
                it pair them, and the colon alone wrapped 'POLLINATOR 1' on
                a 320px phone. min-w-0 lets a long name wrap, never the
                value. */}
            <div className="flex min-w-0 items-center gap-2">
              <div
                className="w-3 h-3 shrink-0 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className={`text-xs sm:text-sm font-medium ${nameTone}`}>
                {entry.name}
              </span>
            </div>
            <span
              className={`shrink-0 text-xs sm:text-sm font-bold tabular-nums ${valueTone}`}
            >
              {typeof entry.value === 'number'
                ? formatValue(entry.value, String(entry.name ?? ''))
                : entry.value}
            </span>
          </div>
        ))}
        {formatTotal && (
          <div
            className={`flex items-center justify-between gap-4 pt-1 sm:pt-2 border-t ${isDarkMode ? 'border-team-blue-40' : 'border-gray-200'}`}
          >
            <span className={`text-xs sm:text-sm font-semibold ${valueTone}`}>
              Total
            </span>
            <span
              className={`shrink-0 text-xs sm:text-sm font-bold tabular-nums ${valueTone}`}
            >
              {formatTotal(sum)}
            </span>
          </div>
        )}
        {/* A line the row carries about itself, under its series */}
        {note ? <p className={`text-xs ${nameTone}`}>{note}</p> : null}
      </div>
      {hint && <p className={`mt-2 text-xs ${nameTone}`}>{hint}</p>}
    </div>
  );
};
