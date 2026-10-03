import { useState, useEffect, useId, useRef } from 'react';
import { useTheme } from '@/contexts';
import type { Match, MatchScoringFields, SessionType } from '@/types';
import {
  ELEMENT_LABELS,
  FIELD_HINTS,
  FIELD_LIMITS,
  POINTS,
  calculateScore,
  emptyScoringFields,
  includesAuto,
  includesTeleop,
  normalizeForMatchType,
  pickScoringFields,
  scoreRows,
} from '@/lib';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ChevronDown, Plus, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { Toggle } from './MatchEntry';
import { ScoreField } from './ScoreField';

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
}

const Panel = ({
  title,
  note,
  children,
}: {
  title: string;
  /** One muted line beside the title: what the panel's entries are worth */
  note?: string;
  children: React.ReactNode;
}) => {
  const { isDarkMode } = useTheme();
  return (
    <div
      className={`p-3 sm:p-4 rounded-xl border ${isDarkMode ? 'border-team-blue-40 bg-team-dark-20' : 'border-team-blue-40 bg-gray-50'}`}
    >
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-3">
        <h4
          className={`font-semibold ${isDarkMode ? 'text-white' : 'text-team-blue'}`}
        >
          {title}
        </h4>
        {note && (
          <span
            className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}
          >
            {note}
          </span>
        )}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
};

/** Each robot's column in the Robots panel */
const ROBOTS = [
  {
    name: 'Robot 1',
    leave: 'robot1Leave',
    parkAuto: 'robot1ParkAuto',
    parkTeleop: 'robot1ParkTeleop',
  },
  {
    name: 'Robot 2',
    leave: 'robot2Leave',
    parkAuto: 'robot2ParkAuto',
    parkTeleop: 'robot2ParkTeleop',
  },
] as const;

const blankForm = (): Partial<Match> => ({
  matchType: 'Full Game',
  ...emptyScoringFields(),
});

export const MatchForm = ({
  isOpen,
  onClose,
  onSave,
  initialMatch,
  isLoading = false,
  sessionType,
}: MatchFormProps) => {
  const { isDarkMode } = useTheme();
  /** A save is in flight: a second click must not send it twice */
  const savingRef = useRef(false);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const breakdownId = useId();
  const periodNoteId = useId();
  const [formData, setFormData] = useState<Partial<Match>>(() =>
    initialMatch
      ? {
          matchType: initialMatch.matchType || 'Full Game',
          ...pickScoringFields(initialMatch),
        }
      : blankForm()
  );

  useEffect(() => {
    if (initialMatch) {
      setFormData({
        matchType: initialMatch.matchType || 'Full Game',
        ...pickScoringFields(initialMatch),
      });
    } else if (isOpen) {
      setFormData(blankForm());
    }
  }, [initialMatch, isOpen]);

  const setField = <K extends keyof MatchScoringFields>(
    field: K,
    value: MatchScoringFields[K]
  ) => setFormData(prev => ({ ...prev, [field]: value }));

  const matchType = formData.matchType || 'Full Game';
  const hasAuto = includesAuto(matchType);
  const hasTeleop = includesTeleop(matchType);

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
        finalScore: breakdown.total,
      });
    } catch (error) {
      const { logger } = await import('@/lib/logger');
      logger.error('Error saving match', error);
      toast.error('Failed to save match');
    } finally {
      savingRef.current = false;
    }
  };

  const mutedTone = isDarkMode ? 'text-gray-400' : 'text-gray-600';

  /** Which toggles this match type leaves out, said once for the panel */
  const periodNote = !hasAuto
    ? `Leave and Park (Auto) are not run in ${matchType} matches`
    : !hasTeleop
      ? `Park (End) is not run in ${matchType} matches`
      : undefined;

  /**
   * `available` is false when the match type never ran the period the
   * toggle belongs to; it then shows unchecked and can't be ticked.
   */
  const robotToggle = (
    robot: string,
    label: string,
    field:
      | 'robot1Leave'
      | 'robot1ParkAuto'
      | 'robot1ParkTeleop'
      | 'robot2Leave'
      | 'robot2ParkAuto'
      | 'robot2ParkTeleop',
    available: boolean
  ) => (
    <Toggle
      label={label}
      ariaLabel={`${robot} ${label}`}
      checked={available && (formData[field] ?? false)}
      onChange={v => setField(field, v)}
      disabled={isLoading || !available}
      disabledReason={available ? undefined : periodNote}
      describedBy={available ? undefined : periodNoteId}
    />
  );

  const stepperProps = {
    size: 'large',
    layout: 'compact',
    stepper: true,
    disabled: isLoading,
  } as const;

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
        full-height sheet. On a short screen (a phone on its side) the two
        bars would leave the form a sliver, so the whole panel scrolls
        instead and only the footer stays, pinned to its bottom.
      */}
      <DialogContent
        className={`flex max-h-[90dvh] max-w-2xl flex-col overflow-hidden border-2 max-md:h-[calc(100dvh-2rem)] max-md:max-h-none [@media(max-height:500px)]:overflow-y-auto [@media(max-height:500px)]:overscroll-contain ${
          isDarkMode
            ? 'bg-team-dark border-team-blue-40'
            : 'bg-white border-team-blue-40'
        }`}
      >
        <DialogHeader
          className={`shrink-0 max-sm:px-4 max-sm:py-3 ${isDarkMode ? 'border-team-blue-40' : ''}`}
        >
          <DialogTitle className={isDarkMode ? 'text-white' : 'text-team-blue'}>
            {initialMatch ? (
              <>
                <Pencil className="h-5 w-5" />
                Edit Match
              </>
            ) : (
              <>
                <Plus className="h-5 w-5" />
                Add New Match
              </>
            )}
          </DialogTitle>
          <DialogDescription
            className={isDarkMode ? 'text-team-white-60' : 'text-gray-600'}
          >
            {initialMatch
              ? 'Update the match details below'
              : 'Enter the details for the new match'}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-6 [@media(max-height:500px)]:flex-none [@media(max-height:500px)]:overflow-visible">
          <div className="space-y-2">
            <Label
              htmlFor="matchType"
              className={isDarkMode ? 'text-white' : 'text-gray-700'}
            >
              Match Type
            </Label>
            <Select
              value={formData.matchType || 'Full Game'}
              onValueChange={value =>
                setFormData(prev => ({ ...prev, matchType: value }))
              }
            >
              <SelectTrigger
                id="matchType"
                disabled={isLoading}
                className={
                  isDarkMode
                    ? 'bg-team-dark border border-team-blue-40 text-white'
                    : 'bg-white border border-team-blue-40'
                }
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

          <Panel title="Scoring">
            <ScoreField
              {...stepperProps}
              label={ELEMENT_LABELS.tipping}
              name="tipping"
              hint={FIELD_HINTS.tipping}
              max={FIELD_LIMITS.tipping}
              value={formData.tipping ?? 0}
              points={breakdown.tipping}
              onChange={v => setField('tipping', v)}
            />
            <ScoreField
              {...stepperProps}
              label={ELEMENT_LABELS.garden}
              hint={FIELD_HINTS.garden}
              max={FIELD_LIMITS.garden}
              value={formData.garden ?? 0}
              points={breakdown.garden}
              onChange={v => setField('garden', v)}
            />
            <ScoreField
              {...stepperProps}
              label={ELEMENT_LABELS.flower}
              hint={FIELD_HINTS.flower}
              max={FIELD_LIMITS.flower}
              value={formData.flower ?? 0}
              points={breakdown.flower}
              onChange={v => setField('flower', v)}
            />
            <ScoreField
              {...stepperProps}
              label={ELEMENT_LABELS.flowerBonus}
              hint={FIELD_HINTS.flowerBonus}
              max={FIELD_LIMITS.flowerBonus}
              value={formData.flowerBonus ?? 0}
              points={breakdown.flowerBonus}
              onChange={v => setField('flowerBonus', v)}
            />
            <ScoreField
              {...stepperProps}
              label={ELEMENT_LABELS.hive}
              hint={FIELD_HINTS.ballsInHive}
              max={FIELD_LIMITS.ballsInHive}
              value={formData.ballsInHive ?? 0}
              points={breakdown.hive}
              onChange={v => setField('ballsInHive', v)}
            />
          </Panel>

          <Panel
            title="Robots"
            note={`Leave ${POINTS.LEAVE} pts · each Park ${POINTS.PARK} pts`}
          >
            <div className="grid grid-cols-2 gap-3">
              {ROBOTS.map(robot => (
                <div
                  key={robot.name}
                  role="group"
                  aria-label={robot.name}
                  className="flex min-w-0 flex-col gap-2"
                >
                  <div
                    aria-hidden
                    className={`text-sm font-semibold ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}
                  >
                    {robot.name}
                  </div>
                  {robotToggle(
                    robot.name,
                    ELEMENT_LABELS.leave,
                    robot.leave,
                    hasAuto
                  )}
                  {robotToggle(
                    robot.name,
                    ELEMENT_LABELS.parkAuto,
                    robot.parkAuto,
                    hasAuto
                  )}
                  {robotToggle(
                    robot.name,
                    ELEMENT_LABELS.parkEnd,
                    robot.parkTeleop,
                    hasTeleop
                  )}
                </div>
              ))}
            </div>
            {periodNote && (
              <p id={periodNoteId} className={`text-xs ${mutedTone}`}>
                {periodNote}
              </p>
            )}
          </Panel>

          {showFouls && (
            <Panel title="Penalties">
              <ScoreField
                {...stepperProps}
                label={ELEMENT_LABELS.minor}
                hint={FIELD_HINTS.minorPenalties}
                max={FIELD_LIMITS.minorPenalties}
                value={formData.minorPenalties ?? 0}
                opponentPoints={
                  (formData.minorPenalties ?? 0) * POINTS.MINOR_PENALTY
                }
                onChange={v => setField('minorPenalties', v)}
              />
              <ScoreField
                {...stepperProps}
                label={ELEMENT_LABELS.major}
                hint={FIELD_HINTS.majorPenalties}
                max={FIELD_LIMITS.majorPenalties}
                value={formData.majorPenalties ?? 0}
                opponentPoints={
                  (formData.majorPenalties ?? 0) * POINTS.MAJOR_PENALTY
                }
                onChange={v => setField('majorPenalties', v)}
              />
            </Panel>
          )}
        </div>

        <div
          className={`shrink-0 border-t px-4 py-3 sm:px-6 [@media(max-height:500px)]:sticky [@media(max-height:500px)]:bottom-0 [@media(max-height:500px)]:py-2 ${
            isDarkMode
              ? 'border-team-blue-40 bg-team-dark'
              : 'border-gray-200 bg-white'
          }`}
        >
          {showBreakdown && (
            <div
              id={breakdownId}
              className={`mb-3 space-y-1 border-b pb-3 ${
                isDarkMode ? 'border-gray-700' : 'border-gray-200'
              }`}
            >
              {rows.map(row => (
                <div
                  key={row.key}
                  className={`flex items-center justify-between text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}
                >
                  <span>{row.label}</span>
                  <span className="tabular-nums font-semibold text-team-blue">
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

          {/* Two rows on a phone, so the buttons are each half the width */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            {/* Score and toggle share a line on a short screen, too */}
            <div className="flex min-w-0 flex-1 items-center justify-between gap-3 sm:block [@media(max-height:500px)]:flex">
              <p
                aria-live="polite"
                aria-atomic="true"
                className={`flex items-baseline gap-2 whitespace-nowrap font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
              >
                <span className="text-sm">Final Score</span>
                <span className="text-2xl leading-7 tabular-nums text-team-blue">
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
            <div className="grid grid-cols-2 gap-2 sm:flex sm:gap-3">
              <Button
                variant="outline"
                onClick={onClose}
                disabled={isLoading}
                className={`[@media(pointer:coarse)]:min-h-11 ${
                  isDarkMode
                    ? 'border-team-blue-40 text-white hover:bg-team-white-10'
                    : ''
                }`}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={isLoading}
                className={`bg-team-blue [@media(pointer:coarse)]:min-h-11 ${isDarkMode ? 'text-black' : 'text-white'}`}
              >
                {isLoading
                  ? 'Saving...'
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
