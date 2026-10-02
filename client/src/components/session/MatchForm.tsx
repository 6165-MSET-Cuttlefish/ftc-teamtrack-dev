import { useState, useEffect, useRef } from 'react';
import { useTheme } from '@/contexts';
import type { Match, MatchScoringFields, SessionType } from '@/types';
import {
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
import { Plus, Pencil } from 'lucide-react';
import { toast } from 'sonner';
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
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => {
  const { isDarkMode } = useTheme();
  return (
    <div
      className={`p-3 sm:p-4 rounded-xl border ${isDarkMode ? 'border-team-blue-40 bg-team-dark-20' : 'border-team-blue-40 bg-gray-50'}`}
    >
      <h4
        className={`font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-team-blue'}`}
      >
        {title}
      </h4>
      <div className="space-y-3">{children}</div>
    </div>
  );
};

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

  /**
   * `available` is false when the match type never ran the period the
   * toggle belongs to; it then shows unchecked and can't be ticked.
   */
  const checkToggle = (
    label: string,
    checked: boolean,
    onChange: (v: boolean) => void,
    hint: string,
    available: boolean
  ) => (
    <label
      className={`flex items-center gap-3 select-none ${
        available ? 'cursor-pointer' : 'cursor-not-allowed'
      }`}
    >
      <input
        type="checkbox"
        checked={available && checked}
        disabled={isLoading || !available}
        onChange={e => onChange(e.target.checked)}
        className={`w-4 h-4 accent-team-blue ${
          available ? 'cursor-pointer' : 'cursor-not-allowed'
        }`}
      />
      <span
        className={`text-sm font-semibold ${
          available
            ? isDarkMode
              ? 'text-gray-200'
              : 'text-gray-800'
            : mutedTone
        }`}
      >
        {label}
      </span>
      <span className={`text-xs ${mutedTone}`}>
        {available ? hint : `not run in ${matchType} matches`}
      </span>
    </label>
  );

  return (
    <Dialog
      open={isOpen}
      onOpenChange={open => {
        // Closing mid-save would throw away the input if the save then fails.
        if (!open && !isLoading) onClose();
      }}
    >
      <DialogContent
        className={`max-w-2xl max-h-[90vh] overflow-y-auto border-2 ${
          isDarkMode
            ? 'bg-team-dark border-team-blue-40'
            : 'bg-white border-team-blue-40'
        }`}
      >
        <DialogHeader className={isDarkMode ? 'border-team-blue-40' : ''}>
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

        <div className="space-y-6 px-4 sm:px-6 py-4 sm:py-6">
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
              label="Tipping"
              hint={FIELD_HINTS.tipping}
              max={FIELD_LIMITS.tipping}
              value={formData.tipping ?? 0}
              points={breakdown.tipping}
              disabled={isLoading}
              onChange={v => setField('tipping', v)}
            />
            <ScoreField
              label="Garden"
              hint={FIELD_HINTS.garden}
              max={FIELD_LIMITS.garden}
              value={formData.garden ?? 0}
              points={breakdown.garden}
              disabled={isLoading}
              onChange={v => setField('garden', v)}
            />
            <ScoreField
              label="Flower"
              hint={FIELD_HINTS.flower}
              max={FIELD_LIMITS.flower}
              value={formData.flower ?? 0}
              points={breakdown.flower}
              disabled={isLoading}
              onChange={v => setField('flower', v)}
            />
            <ScoreField
              label="Flower Bonus"
              hint={FIELD_HINTS.flowerBonus}
              max={FIELD_LIMITS.flowerBonus}
              value={formData.flowerBonus ?? 0}
              points={breakdown.flowerBonus}
              disabled={isLoading}
              onChange={v => setField('flowerBonus', v)}
            />
            <ScoreField
              label="Left in Hive"
              hint={FIELD_HINTS.ballsInHive}
              max={FIELD_LIMITS.ballsInHive}
              value={formData.ballsInHive ?? 0}
              points={breakdown.hive}
              disabled={isLoading}
              onChange={v => setField('ballsInHive', v)}
            />
          </Panel>

          <Panel title="Robots">
            {checkToggle(
              'Robot 1 Leave',
              formData.robot1Leave ?? false,
              v => setField('robot1Leave', v),
              `${POINTS.LEAVE} pts`,
              hasAuto
            )}
            {checkToggle(
              'Robot 1 Park (Auto)',
              formData.robot1ParkAuto ?? false,
              v => setField('robot1ParkAuto', v),
              `${POINTS.PARK} pts`,
              hasAuto
            )}
            {checkToggle(
              'Robot 1 Park (End)',
              formData.robot1ParkTeleop ?? false,
              v => setField('robot1ParkTeleop', v),
              `${POINTS.PARK} pts`,
              hasTeleop
            )}
            {checkToggle(
              'Robot 2 Leave',
              formData.robot2Leave ?? false,
              v => setField('robot2Leave', v),
              `${POINTS.LEAVE} pts`,
              hasAuto
            )}
            {checkToggle(
              'Robot 2 Park (Auto)',
              formData.robot2ParkAuto ?? false,
              v => setField('robot2ParkAuto', v),
              `${POINTS.PARK} pts`,
              hasAuto
            )}
            {checkToggle(
              'Robot 2 Park (End)',
              formData.robot2ParkTeleop ?? false,
              v => setField('robot2ParkTeleop', v),
              `${POINTS.PARK} pts`,
              hasTeleop
            )}
          </Panel>

          {showFouls && (
            <Panel title="Your Fouls">
              <ScoreField
                label="Minor"
                hint={FIELD_HINTS.minorPenalties}
                max={FIELD_LIMITS.minorPenalties}
                value={formData.minorPenalties ?? 0}
                opponentPoints={
                  (formData.minorPenalties ?? 0) * POINTS.MINOR_PENALTY
                }
                disabled={isLoading}
                onChange={v => setField('minorPenalties', v)}
              />
              <ScoreField
                label="Major"
                hint={FIELD_HINTS.majorPenalties}
                max={FIELD_LIMITS.majorPenalties}
                value={formData.majorPenalties ?? 0}
                opponentPoints={
                  (formData.majorPenalties ?? 0) * POINTS.MAJOR_PENALTY
                }
                disabled={isLoading}
                onChange={v => setField('majorPenalties', v)}
              />
            </Panel>
          )}

          <Panel title="Total">
            <div className="space-y-1">
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
              <div
                className={`flex items-center justify-between font-bold pt-2 mt-1 border-t ${
                  isDarkMode
                    ? 'border-gray-700 text-white'
                    : 'border-gray-200 text-gray-900'
                }`}
              >
                <span>Final Score</span>
                <span className="text-xl tabular-nums text-team-blue">
                  {breakdown.total}
                </span>
              </div>
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
          </Panel>

          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
              className={
                isDarkMode
                  ? 'border-team-blue-40 text-white hover:bg-team-white-10'
                  : ''
              }
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={isLoading}
              className={`bg-team-blue ${isDarkMode ? 'text-black' : 'text-white'}`}
            >
              {isLoading
                ? 'Saving...'
                : initialMatch
                  ? 'Update Match'
                  : 'Add Match'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
