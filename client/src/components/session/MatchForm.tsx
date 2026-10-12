import {
  Fragment,
  useCallback,
  useState,
  useEffect,
  useId,
  useRef,
  type CSSProperties,
} from 'react';
import { useTheme } from '@/contexts';
import type {
  Match,
  MatchScoringFields,
  RobotCount,
  SessionType,
} from '@/types';
import {
  COUNT_LABELS,
  DEFAULT_ROBOT_COUNT,
  EACH_LABELS,
  ELEMENT_LABELS,
  FIELD_HINTS,
  FIELD_LIMITS,
  POINTS,
  calculateScore,
  failureReason,
  emptyScoringFields,
  includesAuto,
  includesTeleop,
  normalizeForMatchType,
  pickScoringFields,
  robotsOf,
  scoreRows,
} from '@/lib';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { EYEBROW_CLASS } from '@/components/ui/page-header';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ChevronDown, Plus, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { CounterHead } from './EndOfMatchParts';
import { Toggle } from './MatchEntry';
import { ScoreField } from './ScoreField';
import { LOCK_REASONS, autonomousNote, countersShown } from './useScoringLocks';

interface MatchFormProps {
  isOpen: boolean;
  onClose: () => void;
  /**
   * Save the match. The caller closes the dialog once the save has worked;
   * a save that fails leaves it open with everything that was typed.
   */
  onSave: (match: Partial<Match>) => Promise<void>;
  initialMatch?: Match;
  isLoading?: boolean;
  /** Fouls are only recorded for a Scrim; other sessions don't show them */
  sessionType?: SessionType;
  /**
   * What a new match starts as: the session's match type, so a run added to
   * an Autonomous session is an Autonomous run unless changed here.
   */
  defaultMatchType?: string;
  /** The robots a new match starts with, as the session was played */
  defaultRobotCount?: RobotCount;
}

/**
 * One part of the form: a title and its fields, with no box of its own, so
 * the dialog is the only frame. The title is the eyebrow the scoring page
 * puts over the same group (ROBOTS, END OF MATCH, PENALTIES), over the
 * fields' 14px names.
 */
const Section = ({
  title,
  note,
  hidden = false,
  children,
}: {
  title: string;
  /** One muted line beside the title: what the section's entries are worth */
  note?: string;
  /** Left out, with its title: it has nothing to show */
  hidden?: boolean;
  children: React.ReactNode;
}) => {
  const { isDarkMode } = useTheme();
  if (hidden) return null;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <h3 className={EYEBROW_CLASS}>{title}</h3>
        {note && (
          <span
            className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}
          >
            {note}
          </span>
        )}
      </div>
      {children}
    </div>
  );
};

/** Each robot's row in the Robots section, as on the scoring page */
const ROBOTS = [
  {
    name: 'Robot 1',
    leave: 'robot1Leave',
    parkAuto: 'robot1ParkAuto',
    parkEnd: 'robot1ParkTeleop',
  },
  {
    name: 'Robot 2',
    leave: 'robot2Leave',
    parkAuto: 'robot2ParkAuto',
    parkEnd: 'robot2ParkTeleop',
  },
] as const;

/**
 * The robot toggles, in the scoring page's order. The parks say "Auto" and
 * "End" under a Park heading where the form is narrow, and their full names
 * where it has room (the Toggle's container query).
 */
const ROBOT_COLUMNS = [
  { key: 'leave', label: ELEMENT_LABELS.leave, wide: undefined, park: false },
  { key: 'parkAuto', label: 'Auto', wide: ELEMENT_LABELS.parkAuto, park: true },
  { key: 'parkEnd', label: 'End', wide: ELEMENT_LABELS.parkEnd, park: true },
] as const;

/**
 * The robots' name column, then one column per toggle the match can score.
 * With three, Leave never goes under 4rem, the width of its label with the
 * check mark: on a 320px phone it takes that and the two parks share the
 * rest ("Auto" and "End" are shorter). Wherever there is room the three are
 * equal. Under 280px wide (a phone zoomed to 200%) a robot's name takes a
 * line of its own over its toggles (ROBOT_NAME), which then have the whole
 * width, each at least its label's: beside the name the parks were
 * squeezed to a sliver with their labels over their neighbours.
 */
const ROBOT_GRID = {
  1: 'grid-cols-[auto_minmax(0,1fr)] max-[279px]:grid-cols-1',
  2: 'grid-cols-[auto_repeat(2,minmax(0,1fr))] max-[279px]:grid-cols-[repeat(2,minmax(min-content,1fr))]',
  3: 'grid-cols-[auto_minmax(4rem,1fr)_repeat(2,minmax(0,1fr))] max-[279px]:grid-cols-[repeat(3,minmax(min-content,1fr))]',
} as const;

/** Where a robot's name goes on its own line (see ROBOT_GRID) */
const ROBOT_NAME = 'max-[279px]:col-span-full';

/**
 * Spans for the Park heading's row: what goes before it, and its own. What
 * goes before it counts the name column, which is gone under 280px.
 */
const COL_SPAN = { 1: 'col-span-1', 2: 'col-span-2' } as const;
const BEFORE_PARK_NARROW = {
  1: 'max-[279px]:hidden',
  2: 'max-[279px]:col-span-1',
} as const;

/**
 * A select beside its label. Under 280px wide (a phone zoomed to 200%) the
 * select goes under its label at full width instead, where beside it its
 * value was cut to "Full..".
 */
const SELECT_ROW =
  'flex items-center justify-between gap-3 max-[279px]:flex-col max-[279px]:items-stretch max-[279px]:gap-1.5';

/**
 * Where the whole panel scrolls rather than its body (see the panel): a
 * short screen, and a screen under 280px wide (a phone zoomed to 200%),
 * whose footer of stacked buttons would leave the body a sliver too. The
 * classes that go with it repeat the two conditions as Tailwind variants.
 */
const WHOLE_PANEL_SCROLLS = '(max-height: 500px), (max-width: 279px)';

/** Which end-of-match rule is open under its (i) */
type InfoKey = 'flower' | 'flowerBonus' | 'hive' | 'garden';

const MATCH_TYPES = ['Full Game', 'Autonomous', 'Teleop'];

/** The robot counts offered, in the session menu's words */
const ROBOT_COUNTS: Array<{ value: RobotCount; label: string }> = [
  { value: 1, label: '1 robot' },
  { value: 2, label: '2 robots' },
];

const blankForm = (
  matchType = 'Full Game',
  robotCount: RobotCount = DEFAULT_ROBOT_COUNT
): Partial<Match> => ({
  matchType: MATCH_TYPES.includes(matchType) ? matchType : 'Full Game',
  ...emptyScoringFields(),
  robotCount,
});

/** A saved match as the form edits it */
const formOf = (match: Match): Partial<Match> => ({
  matchType: match.matchType || 'Full Game',
  ...pickScoringFields(match),
  // Saved before the count existed, or with Robot 2 marked: both rows
  robotCount: robotsOf(match),
});

export const MatchForm = ({
  isOpen,
  onClose,
  onSave,
  initialMatch,
  isLoading = false,
  sessionType,
  defaultMatchType,
  defaultRobotCount,
}: MatchFormProps) => {
  const { isDarkMode } = useTheme();
  /** A save is in flight: a second click must not send it twice */
  const savingRef = useRef(false);
  const [showBreakdown, setShowBreakdown] = useState(false);
  /**
   * The footer's height, kept as the panel's scroll padding on a short
   * screen. There the footer is pinned over the bottom of the panel as it
   * scrolls, and a field or button the keyboard moves to would otherwise be
   * scrolled only as far as the panel's edge, under the footer.
   */
  const [footerHeight, setFooterHeight] = useState(0);
  const footerEl = useRef<HTMLDivElement | null>(null);
  const footerObserver = useRef<ResizeObserver | null>(null);
  const footerRef = useCallback((footer: HTMLDivElement | null) => {
    footerEl.current = footer;
    footerObserver.current?.disconnect();
    footerObserver.current = null;
    if (!footer) return;
    // Measured again as the breakdown opens and closes
    const observer = new ResizeObserver(() =>
      setFooterHeight(footer.offsetHeight)
    );
    observer.observe(footer);
    footerObserver.current = observer;
  }, []);
  // With the breakdown open the footer is taller than a short screen's
  // panel (and nearly as tall as one under 280px wide): pinned, it would
  // cover the whole form and the keyboard's every stop in it. So it goes
  // back to the end of the panel, which scrolls down to it, the breakdown
  // and the button just pressed in view.
  const pinFooter = !showBreakdown;
  useEffect(() => {
    if (!showBreakdown || !window.matchMedia(WHOLE_PANEL_SCROLLS).matches) {
      return;
    }
    const panel = footerEl.current?.parentElement;
    if (panel) panel.scrollTop = panel.scrollHeight;
  }, [showBreakdown]);
  const [infoOpen, setInfoOpen] = useState<InfoKey | null>(null);
  const breakdownId = useId();
  const ids = {
    flower: useId(),
    flowerBonus: useId(),
    hive: useId(),
    garden: useId(),
    info: useId(),
  };
  /** What each counter's stepper is described by (CounterHead's `worth`) */
  const worthIds = {
    flower: useId(),
    flowerBonus: useId(),
    hive: useId(),
    garden: useId(),
  };
  const [formData, setFormData] = useState<Partial<Match>>(() =>
    initialMatch
      ? formOf(initialMatch)
      : blankForm(defaultMatchType, defaultRobotCount)
  );
  /**
   * The counts in the form when its match type was last changed: an
   * Autonomous match keeps showing those it had, to be fixed (see
   * `countersShown`)
   */
  const [countedAtTypeChange, setCountedAtTypeChange] =
    useState<Partial<Match>>();

  useEffect(() => {
    if (initialMatch) {
      setFormData(formOf(initialMatch));
    } else if (isOpen) {
      setFormData(blankForm(defaultMatchType, defaultRobotCount));
    }
    // Each opening starts with every rule closed.
    if (isOpen) {
      setInfoOpen(null);
      setCountedAtTypeChange(undefined);
    }
  }, [initialMatch, isOpen, defaultMatchType, defaultRobotCount]);

  const setField = <K extends keyof MatchScoringFields>(
    field: K,
    value: MatchScoringFields[K]
  ) => setFormData(prev => ({ ...prev, [field]: value }));

  const matchType = formData.matchType || 'Full Game';
  const hasAuto = includesAuto(matchType);
  const hasTeleop = includesTeleop(matchType);
  /** One robot row, or two, as on the scoring page */
  const robots = robotsOf(formData);
  /**
   * The end-of-match counters, where they can score, as on the scoring
   * page: not in an Autonomous-only match, unless it has some to fix (saved
   * with them, or counted before the type was changed here). Those stay
   * while the form is open, at 0 too.
   */
  const shown = countersShown(
    hasTeleop,
    initialMatch,
    countedAtTypeChange,
    formData
  );
  const flowersShown = shown.flowers;
  const hiveGardenShown = shown.hiveGarden;

  /** One robot clears a second robot's LEAVE and PARK, as the session menu does */
  const setRobotCount = (robotCount: RobotCount) =>
    setFormData(prev => ({
      ...prev,
      robotCount,
      ...(robotCount === 1 && {
        robot2Leave: false,
        robot2ParkAuto: false,
        robot2ParkTeleop: false,
      }),
    }));

  const breakdown = calculateScore(formData);
  // Fouls are credited to the opponent, so they are not one of the rows
  // that add up to the score; they get their own line under the total.
  const rows = scoreRows(formData).filter(row => !row.informational);

  // Fouls belong to a Scrim. A match that already has some keeps the panel
  // whatever the session type, so they can still be seen and corrected.
  const showFouls =
    sessionType === 'Scrim' ||
    (initialMatch?.minorPenalties ?? 0) + (initialMatch?.majorPenalties ?? 0) >
      0;

  const handleSave = async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    try {
      // Flags for a period this match type never ran are dropped, not saved.
      await onSave({
        ...normalizeForMatchType(formData, matchType),
        matchType,
        robotCount: robots,
        finalScore: breakdown.total,
      });
    } catch (error) {
      const { logger } = await import('@/lib/logger');
      logger.error('Error saving match', error);
      toast.error("Couldn't save the match", {
        description: failureReason(error, { nothingChanged: true }),
      });
    } finally {
      savingRef.current = false;
    }
  };

  const mutedTone = isDarkMode ? 'text-gray-400' : 'text-gray-600';

  /**
   * Which toggles this match type leaves out, said once for the section in
   * the live page's words
   */
  const periodNote = !hasAuto
    ? LOCK_REASONS.noAuto
    : !hasTeleop
      ? autonomousNote(shown)
      : undefined;

  /** Only the toggles this match type can score: no dead columns */
  const robotColumns = ROBOT_COLUMNS.filter(c =>
    c.key === 'parkEnd' ? hasTeleop : hasAuto
  );
  const parkColumns = robotColumns.filter(c => c.park).length as 1 | 2;
  const beforePark = (robotColumns.length - parkColumns + 1) as 1 | 2;

  const stepperProps = {
    size: 'large',
    layout: 'compact',
    stepper: true,
    disabled: isLoading,
  } as const;
  /** A counter's name, at the level of the end-of-match headings */
  const nameClass = 'text-sm font-semibold leading-5';

  const toggleInfo = (key: InfoKey) =>
    setInfoOpen(open => (open === key ? null : key));

  /**
   * One end-of-match counter as one row, like Hive Tips above it: its name
   * (with the (i), which says what one is worth) on the left, the stepper
   * on the right, in line with every other stepper in the form, and the
   * rule under the row once opened. Its points sit beside the name on a
   * phone and in the points column from md up. Where that would leave the
   * words under 7.5rem (a 320px phone) the stepper wraps under them, still
   * on the right, instead of squeezing them a word a line.
   */
  const counter = (
    field: 'flower' | 'flowerBonus' | 'ballsInHive' | 'garden',
    key: InfoKey,
    name: string,
    points: number
  ) => (
    <div role="group" aria-labelledby={ids[key]} className="space-y-2">
      <div className="flex flex-wrap items-center justify-end gap-x-1.5 gap-y-2 md:gap-x-3">
        <div className="min-w-0 flex-[1_1_7.5rem]">
          <CounterHead
            id={ids[key]}
            title={COUNT_LABELS[field]}
            worth={{ id: worthIds[key], each: EACH_LABELS[field] }}
            points={points}
            pointsClassName="md:hidden"
            info={FIELD_HINTS[field]}
            infoId={ids.info}
            infoOpen={infoOpen === key}
            onInfo={() => toggleInfo(key)}
          />
        </div>
        <ScoreField
          {...stepperProps}
          hideLabel
          label={COUNT_LABELS[field]}
          name={name}
          describedBy={worthIds[key]}
          max={FIELD_LIMITS[field]}
          value={formData[field] ?? 0}
          points={points}
          onChange={v => setField(field, v)}
        />
      </div>
      {infoOpen === key && (
        <p
          id={ids.info}
          className={`text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}
        >
          {FIELD_HINTS[field]}
        </p>
      )}
    </div>
  );

  return (
    <Dialog
      open={isOpen}
      onOpenChange={open => {
        // Closing mid-save would throw away the input if the save then fails.
        if (!open && !isLoading) onClose();
      }}
    >
      {/*
        A column with one scrolling body: the header and the footer (the
        running total and the buttons) stay put, so the score and Save are on
        screen wherever the form is scrolled to. On a phone it is a
        full-height sheet. On a short screen (a phone on its side), or one
        under 280px wide, the two bars would leave the form a sliver, so the
        whole panel scrolls instead (WHOLE_PANEL_SCROLLS) and only the
        footer stays, pinned to its bottom (not while
        the breakdown is open, see pinFooter). The panel then keeps the
        footer's height (and a little) as scroll padding, so whatever the
        keyboard moves to is scrolled clear of it.
      */}
      <DialogContent
        style={{ '--footer-h': `${footerHeight}px` } as CSSProperties}
        className={`flex max-h-[90dvh] max-w-2xl flex-col overflow-hidden border-2 max-md:h-[calc(100dvh-2rem)] max-md:max-h-none [@media(max-height:500px)]:overflow-y-auto [@media(max-height:500px)]:overscroll-contain max-[279px]:overflow-y-auto max-[279px]:overscroll-contain ${
          pinFooter
            ? '[@media(max-height:500px)]:[scroll-padding-bottom:calc(var(--footer-h)+0.5rem)] max-[279px]:[scroll-padding-bottom:calc(var(--footer-h)+0.5rem)]'
            : ''
        } ${
          isDarkMode
            ? 'bg-team-dark border-team-blue-40'
            : 'bg-white border-team-blue-40'
        }`}
      >
        <DialogHeader
          className={`shrink-0 max-sm:px-4 max-sm:py-3 ${isDarkMode ? 'border-team-blue-40' : ''}`}
        >
          {/* Names the match, which the sheet covers on a phone */}
          <DialogTitle className="text-foreground">
            {initialMatch ? (
              <>
                <Pencil className="h-5 w-5 shrink-0" aria-hidden />
                {/* Where it has to wrap, the type goes down whole:
                    never one word of it on a line of its own. */}
                <span>
                  Edit Match {initialMatch.matchNumber}{' '}
                  <span className="whitespace-nowrap">({matchType})</span>
                </span>
              </>
            ) : (
              <>
                <Plus className="h-5 w-5 shrink-0" aria-hidden />
                <span>Add Match</span>
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        {/*
          The scoring page's order and anatomy: Hive Tips, the robots, then
          the end of match (each counter's name with its rule behind an (i),
          a line saying what to count, its stepper), then a Scrim's fouls.
          No boxes inside the dialog: titles and spacing group the fields.
        */}
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-5 [@media(max-height:500px)]:flex-none [@media(max-height:500px)]:overflow-visible max-[279px]:flex-none max-[279px]:overflow-visible">
          <div className={SELECT_ROW}>
            <Label htmlFor="matchType" className="text-foreground">
              Match Type
            </Label>
            <Select
              value={formData.matchType || 'Full Game'}
              onValueChange={value => {
                setCountedAtTypeChange(formData);
                setFormData(prev => ({ ...prev, matchType: value }));
              }}
            >
              <SelectTrigger
                id="matchType"
                disabled={isLoading}
                className={`w-44 max-[279px]:w-full ${
                  isDarkMode ? 'bg-team-dark text-white' : 'bg-white'
                }`}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent
                className={isDarkMode ? 'bg-team-dark border-team-blue-40' : ''}
              >
                <SelectItem value="Full Game">Full Game</SelectItem>
                <SelectItem value="Autonomous">Autonomous</SelectItem>
                <SelectItem value="Teleop">Teleop</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className={SELECT_ROW}>
            <Label htmlFor="robotCount" className="text-foreground">
              Robots
            </Label>
            <Select
              value={String(robots)}
              onValueChange={value =>
                setRobotCount(Number(value) as RobotCount)
              }
            >
              <SelectTrigger
                id="robotCount"
                disabled={isLoading}
                className={`w-44 max-[279px]:w-full ${
                  isDarkMode ? 'bg-team-dark text-white' : 'bg-white'
                }`}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent
                className={isDarkMode ? 'bg-team-dark border-team-blue-40' : ''}
              >
                {ROBOT_COUNTS.map(count => (
                  <SelectItem key={count.value} value={String(count.value)}>
                    {count.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <ScoreField
            {...stepperProps}
            labelClassName={nameClass}
            label={ELEMENT_LABELS.tipping}
            name="tipping"
            info={FIELD_HINTS.tipping}
            max={FIELD_LIMITS.tipping}
            value={formData.tipping ?? 0}
            points={breakdown.tipping}
            onChange={v => setField('tipping', v)}
          />

          <Section
            title="Robots"
            note={`Leave ${POINTS.LEAVE} pts and Park ${POINTS.PARK} pts each`}
          >
            {/*
              Rows as on the scoring page. Its own width picks the labels (a
              size container): "Auto" and "End" under one Park heading when
              narrow, "Park (Auto)" and "Park (End)" when there is room.
            */}
            <div className="[container-type:inline-size]">
              {/* Closer together where the toggles are at their narrowest */}
              <div
                className={`grid items-center gap-2 [@container(max-width:18.5rem)]:gap-x-1.5 ${ROBOT_GRID[robotColumns.length as 1 | 2 | 3]}`}
              >
                <div
                  aria-hidden
                  className={`${COL_SPAN[beforePark]} ${BEFORE_PARK_NARROW[beforePark]} [@container(min-width:27.5rem)]:hidden`}
                />
                <div
                  aria-hidden
                  className={`${COL_SPAN[parkColumns]} ${EYEBROW_CLASS} text-center leading-4 [@container(min-width:27.5rem)]:hidden`}
                >
                  Park
                </div>
                {/* Each toggle's own name says which robot it is for */}
                {ROBOTS.slice(0, robots).map(robot => (
                  <Fragment key={robot.name}>
                    <div
                      aria-hidden
                      className={`whitespace-nowrap ${ROBOT_NAME} ${nameClass} ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}
                    >
                      {robot.name}
                    </div>
                    {robotColumns.map(column => {
                      const field = robot[column.key];
                      const fullName = column.wide ?? column.label;
                      return (
                        <Toggle
                          key={column.key}
                          label={column.label}
                          wideLabel={column.wide}
                          ariaLabel={`${robot.name} ${fullName}`}
                          checked={formData[field] ?? false}
                          onChange={v => setField(field, v)}
                          disabled={isLoading}
                        />
                      );
                    })}
                  </Fragment>
                ))}
              </div>
            </div>
            {periodNote && (
              <p className={`text-xs ${mutedTone}`}>{periodNote}</p>
            )}
          </Section>

          {/* An Autonomous match has none of its counters to show */}
          <Section
            title="End of Match"
            hidden={!flowersShown && !hiveGardenShown}
          >
            <div className="space-y-3">
              {/* Each counter under its own name, as on the scoring page */}
              {flowersShown &&
                counter('flower', 'flower', 'flower', breakdown.flower)}
              {flowersShown &&
                counter(
                  'flowerBonus',
                  'flowerBonus',
                  'flower-bonus',
                  breakdown.flowerBonus
                )}
              {hiveGardenShown &&
                counter('ballsInHive', 'hive', 'left-in-hive', breakdown.hive)}
              {hiveGardenShown &&
                counter('garden', 'garden', 'garden', breakdown.garden)}
            </div>
          </Section>

          {showFouls && (
            <Section
              title="Fouls"
              note="Goes to the opponent, not off your score"
            >
              <ScoreField
                {...stepperProps}
                labelClassName={nameClass}
                label={ELEMENT_LABELS.minor}
                max={FIELD_LIMITS.minorPenalties}
                value={formData.minorPenalties ?? 0}
                opponentPoints={
                  (formData.minorPenalties ?? 0) * POINTS.MINOR_PENALTY
                }
                onChange={v => setField('minorPenalties', v)}
              />
              <ScoreField
                {...stepperProps}
                labelClassName={nameClass}
                label={ELEMENT_LABELS.major}
                max={FIELD_LIMITS.majorPenalties}
                value={formData.majorPenalties ?? 0}
                opponentPoints={
                  (formData.majorPenalties ?? 0) * POINTS.MAJOR_PENALTY
                }
                onChange={v => setField('majorPenalties', v)}
              />
            </Section>
          )}
        </div>

        <div
          ref={footerRef}
          className={`shrink-0 px-4 py-3 sm:px-6 [@media(max-height:500px)]:py-2 ${
            pinFooter
              ? '[@media(max-height:500px)]:sticky [@media(max-height:500px)]:bottom-0 max-[279px]:sticky max-[279px]:bottom-0'
              : ''
          } ${isDarkMode ? 'bg-team-dark' : 'bg-white'}`}
        >
          {showBreakdown && (
            <div id={breakdownId} className="mb-3 space-y-1">
              {rows.map(row => (
                <div
                  key={row.key}
                  className={`flex items-center justify-between text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}
                >
                  <span>{row.label}</span>
                  <span className="tabular-nums font-semibold text-foreground">
                    {row.points}
                  </span>
                </div>
              ))}
              {showFouls && (
                <div
                  className={`flex items-center justify-between text-sm pt-1 ${mutedTone}`}
                >
                  <span>Given to opponent (not part of your score)</span>
                  <span className="tabular-nums font-semibold">
                    +{breakdown.penalties}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Two rows on a phone, so the buttons are each half the width.
              Under 280px wide (a phone zoomed to 200%) half is too narrow
              for "Update Match", so the buttons stack full width, the main
              one on top, as other dialogs' do on a phone. */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            {/* Score and toggle share a line on a short screen, too. Under
                320px wide the two don't fit on one line (an edited match's
                three-digit score at 280px ran the toggle off the edge), so
                there the toggle may go under the score. */}
            <div className="flex min-w-0 flex-1 items-center justify-between gap-3 sm:block max-[319px]:flex-wrap [@media(max-height:500px)]:flex">
              <p
                aria-live="polite"
                aria-atomic="true"
                className={`flex items-baseline gap-2 whitespace-nowrap font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
              >
                <span className="text-sm">Final Score</span>
                <span className="text-2xl leading-7 tabular-nums">
                  {breakdown.total}
                </span>
              </p>
              <button
                type="button"
                aria-expanded={showBreakdown}
                aria-controls={breakdownId}
                onClick={() => setShowBreakdown(v => !v)}
                // 44px to the thumb like every other control here; the
                // negative margin keeps the footer as short as the text.
                className={`-my-1 inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded py-1 text-xs underline-offset-2 hover:underline [@media(pointer:coarse)]:-my-2 [@media(pointer:coarse)]:min-h-11 ${mutedTone}`}
              >
                {showBreakdown ? 'Hide breakdown' : 'Show breakdown'}
                <ChevronDown
                  size={14}
                  aria-hidden
                  className={`transition-transform ${showBreakdown ? 'rotate-180' : ''}`}
                />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:gap-3 max-[279px]:flex max-[279px]:flex-col-reverse">
              <Button
                variant="neutral"
                onClick={onClose}
                disabled={isLoading}
                className="[@media(pointer:coarse)]:min-h-11"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleSave}
                disabled={isLoading}
                className="[@media(pointer:coarse)]:min-h-11"
              >
                {isLoading
                  ? 'Saving…'
                  : initialMatch
                    ? 'Update Match'
                    : 'Add Match'}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
