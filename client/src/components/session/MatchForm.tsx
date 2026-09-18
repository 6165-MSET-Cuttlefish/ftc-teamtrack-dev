import { useState, useEffect } from 'react';
import { useTheme } from '@/contexts';
import type { Match, MatchScoringFields } from '@/types';
import {
  POINTS,
  calculateScore,
  emptyScoringFields,
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
  onSave: (match: Partial<Match>) => Promise<void>;
  initialMatch?: Match;
  isLoading?: boolean;
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
      className={`p-4 rounded-xl border ${isDarkMode ? 'border-team-blue-40 bg-team-dark-20' : 'border-team-blue-40 bg-gray-50'}`}
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
}: MatchFormProps) => {
  const { isDarkMode } = useTheme();
  const [formData, setFormData] = useState<Partial<Match>>(() =>
    initialMatch
      ? { matchType: initialMatch.matchType || 'Full Game', ...pickScoringFields(initialMatch) }
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

  const breakdown = calculateScore(formData);
  const rows = scoreRows(formData);

  const handleSave = async () => {
    try {
      await onSave({ ...formData, finalScore: breakdown.total });
      onClose();
      setFormData(blankForm());
    } catch (error) {
      const { logger } = await import('@/lib/logger');
      logger.error('Error saving match', error);
      toast.error('Failed to save match');
    }
  };

  const checkToggle = (
    label: string,
    checked: boolean,
    onChange: (v: boolean) => void,
    hint?: string
  ) => (
    <label className="flex items-center gap-3 cursor-pointer select-none">
      <input
        type="checkbox"
        checked={checked}
        disabled={isLoading}
        onChange={e => onChange(e.target.checked)}
        className="w-4 h-4 accent-team-blue cursor-pointer"
      />
      <span
        className={`text-sm font-semibold ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}
      >
        {label}
      </span>
      {hint && (
        <span
          className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}
        >
          {hint}
        </span>
      )}
    </label>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
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
            className={isDarkMode ? 'text-team-white-60' : 'text-team-blue-40'}
          >
            {initialMatch
              ? 'Update the match details below'
              : 'Enter the details for the new match'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 px-6 py-6">
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
              hint={`${POINTS.HIVE_TIP} pts each — hive tips`}
              value={formData.tipping ?? 0}
              points={breakdown.tipping}
              disabled={isLoading}
              onChange={v => setField('tipping', v)}
            />
            <ScoreField
              label="Garden"
              hint={`${POINTS.GARDEN} pt each`}
              value={formData.garden ?? 0}
              points={breakdown.garden}
              disabled={isLoading}
              onChange={v => setField('garden', v)}
            />
            <ScoreField
              label="Flower"
              hint={`${POINTS.FLOWER_ELEMENT} pts each — in an owned flower`}
              value={formData.flower ?? 0}
              points={breakdown.flower}
              disabled={isLoading}
              onChange={v => setField('flower', v)}
            />
            <ScoreField
              label="Flower Bonus"
              hint={`${POINTS.FLOWER_BONUS} pts each — bottom nectar, max 4`}
              max={4}
              value={formData.flowerBonus ?? 0}
              points={breakdown.flowerBonus}
              disabled={isLoading}
              onChange={v => setField('flowerBonus', v)}
            />
            <ScoreField
              label="Left in Hive"
              hint={`${POINTS.CELL_REMAINING} pts each`}
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
              `${POINTS.LEAVE} pts`
            )}
            {checkToggle(
              'Robot 1 Park (Auto)',
              formData.robot1ParkAuto ?? false,
              v => setField('robot1ParkAuto', v),
              `${POINTS.PARK} pts`
            )}
            {checkToggle(
              'Robot 1 Park (Teleop)',
              formData.robot1ParkTeleop ?? false,
              v => setField('robot1ParkTeleop', v),
              `${POINTS.PARK} pts`
            )}
            {checkToggle(
              'Robot 2 Leave',
              formData.robot2Leave ?? false,
              v => setField('robot2Leave', v),
              `${POINTS.LEAVE} pts`
            )}
            {checkToggle(
              'Robot 2 Park (Auto)',
              formData.robot2ParkAuto ?? false,
              v => setField('robot2ParkAuto', v),
              `${POINTS.PARK} pts`
            )}
            {checkToggle(
              'Robot 2 Park (Teleop)',
              formData.robot2ParkTeleop ?? false,
              v => setField('robot2ParkTeleop', v),
              `${POINTS.PARK} pts`
            )}
          </Panel>

          <Panel title="Penalties">
            <ScoreField
              label="Minor"
              hint={`-${POINTS.MINOR_PENALTY} pts each`}
              value={formData.minorPenalties ?? 0}
              points={-((formData.minorPenalties ?? 0) * POINTS.MINOR_PENALTY)}
              disabled={isLoading}
              onChange={v => setField('minorPenalties', v)}
            />
            <ScoreField
              label="Major"
              hint={`-${POINTS.MAJOR_PENALTY} pts each`}
              value={formData.majorPenalties ?? 0}
              points={-((formData.majorPenalties ?? 0) * POINTS.MAJOR_PENALTY)}
              disabled={isLoading}
              onChange={v => setField('majorPenalties', v)}
            />
          </Panel>

          <Panel title="Total">
            <div className="space-y-1">
              {rows.map(row => (
                <div
                  key={row.key}
                  className={`flex items-center justify-between text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}
                >
                  <span>{row.label}</span>
                  <span
                    className={`tabular-nums font-semibold ${row.points < 0 ? 'text-red-400' : 'text-team-blue'}`}
                  >
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
              {isLoading ? 'Saving...' : initialMatch ? 'Update Match' : 'Add Match'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
