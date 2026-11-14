/* eslint-disable react-refresh/only-export-components */

/**
 * What every Recharts chart in the app shares, so they read as one set: axis
 * colours with enough contrast, small legends, one dot recipe and one tooltip
 * that draws above the legend.
 */

import type { CSSProperties } from 'react';
import { Rectangle } from 'recharts';
import type {
  AreaProps,
  CartesianGridProps,
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
    // The gridlines carry the scale: no axis rule or tick marks of their
    // own, only the labels, a little apart from the plot
    axisLine: false,
    tickLine: false,
    tickMargin: 8,
  } satisfies XAxisProps & YAxisProps;
};

/** The background of the cards the charts sit on, in every theme */
export const CARD_BG = 'hsl(var(--card))';

/**
 * Spread on every CartesianGrid: `<CartesianGrid {...gridProps(isDarkMode)} />`.
 * Hairline, solid and across only, one step off the card, so the marks are
 * the loudest thing in the plot.
 */
export const gridProps = (isDarkMode: boolean) =>
  ({
    vertical: false,
    stroke: isDarkMode ? 'rgba(148, 163, 184, 0.16)' : '#e8edf3',
  }) satisfies CartesianGridProps;

/**
 * The widest a bar gets, so a few columns never become walls of colour:
 * the rest of each column's slot is air.
 */
export const MAX_BAR_SIZE = 28;

/** A bar's data end, rounded; square where it stands on the baseline */
export const BAR_RADIUS: [number, number, number, number] = [4, 4, 0, 0];

/** The band behind the hovered column of a bar chart */
export const barCursor = (isDarkMode: boolean) => ({
  fill: isDarkMode ? 'rgba(255, 255, 255, 0.06)' : 'rgba(15, 23, 42, 0.04)',
});

/** The rule under the pointer on a line or area chart */
export const lineCursor = (isDarkMode: boolean) => ({
  stroke: axisColor(isDarkMode),
  strokeWidth: 1,
});

interface SegmentProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fill?: string;
  payload?: Record<string, unknown>;
}

/**
 * The `shape` of one series of a stacked Bar, `key` among `keys` (bottom
 * first): `<Bar dataKey={key} shape={stackSegment(key, keys)} … />`. Each
 * segment stands 2px clear of the one under it, in the card's colour, and
 * only the top one of a column is rounded, whichever series that is in it.
 */
export const stackSegment = (key: string, keys: readonly string[]) =>
  function StackSegment(props: unknown) {
    const {
      x = 0,
      y = 0,
      width = 0,
      height = 0,
      fill,
      payload,
    } = props as SegmentProps;
    if (width <= 0 || height <= 0) return <g />;
    const filled = keys.filter(k => Number(payload?.[k] ?? 0) > 0);
    const top = filled[filled.length - 1];
    const bottom = filled[0];
    const h = key === bottom ? height : Math.max(0, height - 2);
    const r = key === top ? Math.min(4, width / 2, h) : 0;
    return (
      <Rectangle
        x={x}
        y={y}
        width={width}
        height={h}
        fill={fill}
        radius={[r, r, 0, 0]}
      />
    );
  };

/**
 * The soft wash under a line, its colour fading to nothing at the
 * baseline: put `{areaWash(id, color, isDarkMode)}` in the chart and give
 * the Area `fill={`url(#${id})`}`. Ids are per page, so make each one
 * unique to its chart.
 */
export const areaWash = (id: string, color: string, isDarkMode: boolean) => (
  <defs>
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      <stop
        offset="0%"
        stopColor={color}
        stopOpacity={isDarkMode ? 0.24 : 0.14}
      />
      <stop offset="95%" stopColor={color} stopOpacity={0} />
    </linearGradient>
  </defs>
);

/** One legend entry, as Recharts hands it to the legend */
interface LegendEntry {
  value?: string | number;
  color?: string;
  type?: string;
  payload?: { strokeDasharray?: string | number };
}

/**
 * The legend's keys: a round dot in the series colour, as the tooltip's,
 * or a short dashed line for a reference drawn dashed (a series with
 * `legendType="plainline"`), in the order the chart gives them.
 */
export const LegendKeys = ({
  payload = [],
}: {
  payload?: ReadonlyArray<LegendEntry>;
}) => (
  <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1">
    {payload
      .filter(entry => entry.type !== 'none')
      .map((entry, i) => (
        <li
          key={`${entry.value}-${i}`}
          className="inline-flex items-center gap-1.5"
        >
          {entry.type === 'plainline' ? (
            <svg width="14" height="8" aria-hidden className="shrink-0">
              <line
                x1="0"
                y1="4"
                x2="14"
                y2="4"
                stroke={entry.color}
                strokeWidth="2"
                strokeDasharray={
                  entry.payload?.strokeDasharray ? '3 2' : undefined
                }
              />
            </svg>
          ) : (
            <span
              aria-hidden
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
          )}
          <span className="recharts-legend-item-text">{entry.value}</span>
        </li>
      ))}
  </ul>
);

/**
 * Spread on every Legend: `<Legend {...LEGEND_PROPS} itemSorter={null} />`.
 * The legend is no larger than the axes (the label colour is set in
 * global.css, `.recharts-legend-item-text`).
 */
export const LEGEND_PROPS = {
  wrapperStyle: { fontSize: 12, paddingTop: 8 },
  content: <LegendKeys />,
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
    <div className="glass-thick max-w-[min(20rem,calc(100vw-6rem))] p-3 sm:p-4 rounded-xl border">
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
