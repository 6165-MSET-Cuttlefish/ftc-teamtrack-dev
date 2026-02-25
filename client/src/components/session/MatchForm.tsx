import { useState, useEffect } from 'react';
import { useTheme } from '@/contexts';
import type { Match } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

interface MatchFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (match: Partial<Match>) => Promise<void>;
  initialMatch?: Match;
  isLoading?: boolean;
}

export const MatchForm = ({
  isOpen,
  onClose,
  onSave,
  initialMatch,
  isLoading = false,
}: MatchFormProps) => {
  const { isDarkMode } = useTheme();
  const [formData, setFormData] = useState<Partial<Match>>({
    matchType: initialMatch?.matchType || 'Full Game',
    autonClassifiedArtifact: initialMatch?.autonClassifiedArtifact || 0,
    autonOverflowArtifact: initialMatch?.autonOverflowArtifact || 0,
    autonMotif: initialMatch?.autonMotif || 0,
    autonLeave: initialMatch?.autonLeave || 0,
    autonBallsMissed: initialMatch?.autonBallsMissed || 0,
    teleClassifiedArtifact: initialMatch?.teleClassifiedArtifact || 0,
    teleOverflowArtifact: initialMatch?.teleOverflowArtifact || 0,
    teleMotif: initialMatch?.teleMotif || 0,
    teleBallsMissed: initialMatch?.teleBallsMissed || 0,
    robot1Park: initialMatch?.robot1Park || 'none',
    robot2Park: initialMatch?.robot2Park || 'none',
    cycleTimes: initialMatch?.cycleTimes || [],
    autonShots: initialMatch?.autonShots || [],
    teleopShots: initialMatch?.teleopShots || [],
  });

  const handleInputChange = (field: string, value: number | string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleNumericInputChange = (field: string, value: string) => {
    const numValue = Math.max(0, parseInt(value) || 0);
    handleInputChange(field, numValue);
  };

  useEffect(() => {
    if (initialMatch) {
      setFormData({
        matchType: initialMatch.matchType || 'Full Game',
        autonClassifiedArtifact: initialMatch.autonClassifiedArtifact || 0,
        autonOverflowArtifact: initialMatch.autonOverflowArtifact || 0,
        autonMotif: initialMatch.autonMotif || 0,
        autonLeave: initialMatch.autonLeave || 0,
        autonBallsMissed: initialMatch.autonBallsMissed || 0,
        teleClassifiedArtifact: initialMatch.teleClassifiedArtifact || 0,
        teleOverflowArtifact: initialMatch.teleOverflowArtifact || 0,
        teleMotif: initialMatch.teleMotif || 0,
        teleBallsMissed: initialMatch.teleBallsMissed || 0,
        robot1Park: initialMatch.robot1Park || 'none',
        robot2Park: initialMatch.robot2Park || 'none',
        cycleTimes: initialMatch.cycleTimes || [],
        autonShots: initialMatch.autonShots || [],
        teleopShots: initialMatch.teleopShots || [],
      });
    } else if (isOpen) {
      setFormData({
        matchType: 'Full Game',
        autonClassifiedArtifact: 0,
        autonOverflowArtifact: 0,
        autonMotif: 0,
        autonLeave: 0,
        autonBallsMissed: 0,
        teleClassifiedArtifact: 0,
        teleOverflowArtifact: 0,
        teleMotif: 0,
        teleBallsMissed: 0,
        robot1Park: 'none',
        robot2Park: 'none',
        cycleTimes: [],
        autonShots: [],
        teleopShots: [],
      });
    }
  }, [initialMatch, isOpen]);

  useEffect(() => {
    const autonomousScore =
      (formData.autonClassifiedArtifact || 0) * 3 +
      (formData.autonOverflowArtifact || 0) * 1 +
      (formData.autonMotif || 0) * 2 +
      (formData.autonLeave || 0) * 3;

    const teleopScore =
      (formData.teleClassifiedArtifact || 0) * 3 +
      (formData.teleOverflowArtifact || 0) * 1 +
      (formData.teleMotif || 0) * 2;

    let endGameScore = 0;
    const robot1Score =
      formData.robot1Park === 'partial'
        ? 5
        : formData.robot1Park === 'full'
          ? 10
          : 0;
    const robot2Score =
      formData.robot2Park === 'partial'
        ? 5
        : formData.robot2Park === 'full'
          ? 10
          : 0;

    // Special case: two full parks = 30 points total
    if (formData.robot1Park === 'full' && formData.robot2Park === 'full') {
      endGameScore = 30;
    } else {
      endGameScore = robot1Score + robot2Score;
    }

    const finalScore = autonomousScore + teleopScore + endGameScore;

    setFormData(prev => ({
      ...prev,
      autonomousScore,
      teleopScore,
      endGameScore,
      finalScore,
    }));
  }, [
    formData.autonClassifiedArtifact,
    formData.autonOverflowArtifact,
    formData.autonMotif,
    formData.autonLeave,
    formData.teleClassifiedArtifact,
    formData.teleOverflowArtifact,
    formData.teleMotif,
    formData.robot1Park,
    formData.robot2Park,
  ]);

  const handleSave = async () => {
    try {
      await onSave(formData);
      onClose();
      setFormData({
        matchType: 'Full Game',
        autonClassifiedArtifact: 0,
        autonOverflowArtifact: 0,
        autonMotif: 0,
        autonLeave: 0,
        autonBallsMissed: 0,
        teleClassifiedArtifact: 0,
        teleOverflowArtifact: 0,
        teleMotif: 0,
        teleBallsMissed: 0,
        robot1Park: 'none',
        robot2Park: 'none',
        cycleTimes: [],
      });
    } catch (error) {
      const { logger } = await import('@/lib/logger');
      logger.error('Error saving match', error);
      toast.error('Failed to save match');
    }
  };

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
              onValueChange={value => handleInputChange('matchType', value)}
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

          <div
            className={`p-4 rounded-xl border ${isDarkMode ? 'border-team-blue-40 bg-team-dark-20' : 'border-team-blue-40 bg-gray-50'}`}
          >
            <h4
              className={`font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-team-blue'}`}
            >
              Scores
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className={isDarkMode ? 'text-white' : 'text-gray-700'}>
                  Final Score
                </Label>
                <div
                  className={`p-3 rounded-lg border font-bold text-xl text-center ${isDarkMode ? 'bg-team-dark/50 border-team-blue-40 text-white' : 'bg-gray-100 border-team-blue-40 text-gray-900'}`}
                >
                  {formData.finalScore || 0}
                </div>
              </div>
              <div className="space-y-2">
                <Label className={isDarkMode ? 'text-white' : 'text-gray-700'}>
                  Autonomous Score
                </Label>
                <div
                  className={`p-3 rounded-lg border font-semibold text-lg text-center ${isDarkMode ? 'bg-team-dark/50 border-team-blue-40 text-white' : 'bg-gray-100 border-team-blue-40 text-gray-900'}`}
                >
                  {formData.autonomousScore || 0}
                </div>
              </div>
              <div className="space-y-2">
                <Label className={isDarkMode ? 'text-white' : 'text-gray-700'}>
                  Teleop Score
                </Label>
                <div
                  className={`p-3 rounded-lg border font-semibold text-lg text-center ${isDarkMode ? 'bg-team-dark/50 border-team-blue-40 text-white' : 'bg-gray-100 border-team-blue-40 text-gray-900'}`}
                >
                  {formData.teleopScore || 0}
                </div>
              </div>
              <div className="space-y-2">
                <Label className={isDarkMode ? 'text-white' : 'text-gray-700'}>
                  Endgame Score
                </Label>
                <div
                  className={`p-3 rounded-lg border font-semibold text-lg text-center ${isDarkMode ? 'bg-team-dark/50 border-team-blue-40 text-white' : 'bg-gray-100 border-team-blue-40 text-gray-900'}`}
                >
                  {formData.endGameScore || 0}
                </div>
              </div>
            </div>
          </div>

          <div
            className={`p-4 rounded-xl border ${isDarkMode ? 'border-team-blue-40 bg-team-dark-20' : 'border-team-blue-40 bg-gray-50'}`}
          >
            <h4
              className={`font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-team-blue'}`}
            >
              Autonomous
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label
                  htmlFor="autonClassifiedArtifact"
                  className={isDarkMode ? 'text-white' : 'text-gray-700'}
                >
                  Classified Artifacts
                </Label>
                <Input
                  id="autonClassifiedArtifact"
                  type="number"
                  value={formData.autonClassifiedArtifact || 0}
                  onChange={e =>
                    handleNumericInputChange(
                      'autonClassifiedArtifact',
                      e.target.value
                    )
                  }
                  disabled={isLoading}
                  className={
                    isDarkMode
                      ? 'bg-team-dark border border-team-blue-40 text-white'
                      : 'bg-white border border-team-blue-40'
                  }
                />
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="autonOverflowArtifact"
                  className={isDarkMode ? 'text-white' : 'text-gray-700'}
                >
                  Overflow Artifacts
                </Label>
                <Input
                  id="autonOverflowArtifact"
                  type="number"
                  value={formData.autonOverflowArtifact || 0}
                  onChange={e =>
                    handleNumericInputChange(
                      'autonOverflowArtifact',
                      e.target.value
                    )
                  }
                  disabled={isLoading}
                  className={
                    isDarkMode
                      ? 'bg-team-dark border border-team-blue-40 text-white'
                      : 'bg-white border border-team-blue-40'
                  }
                />
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="autonMotif"
                  className={isDarkMode ? 'text-white' : 'text-gray-700'}
                >
                  Motifs
                </Label>
                <Input
                  id="autonMotif"
                  type="number"
                  value={formData.autonMotif || 0}
                  onChange={e =>
                    handleNumericInputChange('autonMotif', e.target.value)
                  }
                  disabled={isLoading}
                  className={
                    isDarkMode
                      ? 'bg-team-dark border border-team-blue-40 text-white'
                      : 'bg-white border border-team-blue-40'
                  }
                />
              </div>
              <div className="space-y-2">
                <Label className={isDarkMode ? 'text-white' : 'text-gray-700'}>
                  Leave
                </Label>
                <div className="flex gap-2">
                  {[0, 1, 2].map(value => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => handleInputChange('autonLeave', value)}
                      disabled={isLoading}
                      className={`flex-1 py-2 px-4 rounded-lg border-2 font-medium transition-all ${
                        formData.autonLeave === value
                          ? isDarkMode
                            ? 'bg-team-blue border-team-blue text-black'
                            : 'bg-team-blue border-team-blue text-black'
                          : isDarkMode
                            ? 'bg-team-dark border-team-blue-40 text-white hover:bg-team-blue/20'
                            : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {value}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="autonBallsMissed"
                  className={isDarkMode ? 'text-white' : 'text-gray-700'}
                >
                  Balls Missed
                </Label>
                <Input
                  id="autonBallsMissed"
                  type="number"
                  value={formData.autonBallsMissed || 0}
                  onChange={e =>
                    handleNumericInputChange('autonBallsMissed', e.target.value)
                  }
                  disabled={isLoading}
                  className={
                    isDarkMode
                      ? 'bg-team-dark border border-team-blue-40 text-white'
                      : 'bg-white border border-team-blue-40'
                  }
                />
              </div>
            </div>
          </div>

          <div
            className={`p-4 rounded-xl border ${isDarkMode ? 'border-team-blue-40 bg-team-dark-20' : 'border-team-blue-40 bg-gray-50'}`}
          >
            <h4
              className={`font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-team-blue'}`}
            >
              Teleop
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label
                  htmlFor="teleClassifiedArtifact"
                  className={isDarkMode ? 'text-white' : 'text-gray-700'}
                >
                  Classified Artifacts
                </Label>
                <Input
                  id="teleClassifiedArtifact"
                  type="number"
                  value={formData.teleClassifiedArtifact || 0}
                  onChange={e =>
                    handleNumericInputChange(
                      'teleClassifiedArtifact',
                      e.target.value
                    )
                  }
                  disabled={isLoading}
                  className={
                    isDarkMode
                      ? 'bg-team-dark border border-team-blue-40 text-white'
                      : 'bg-white border border-team-blue-40'
                  }
                />
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="teleOverflowArtifact"
                  className={isDarkMode ? 'text-white' : 'text-gray-700'}
                >
                  Overflow Artifacts
                </Label>
                <Input
                  id="teleOverflowArtifact"
                  type="number"
                  value={formData.teleOverflowArtifact || 0}
                  onChange={e =>
                    handleNumericInputChange(
                      'teleOverflowArtifact',
                      e.target.value
                    )
                  }
                  disabled={isLoading}
                  className={
                    isDarkMode
                      ? 'bg-team-dark border border-team-blue-40 text-white'
                      : 'bg-white border border-team-blue-40'
                  }
                />
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="teleMotif"
                  className={isDarkMode ? 'text-white' : 'text-gray-700'}
                >
                  Motifs
                </Label>
                <Input
                  id="teleMotif"
                  type="number"
                  value={formData.teleMotif || 0}
                  onChange={e =>
                    handleNumericInputChange('teleMotif', e.target.value)
                  }
                  disabled={isLoading}
                  className={
                    isDarkMode
                      ? 'bg-team-dark border border-team-blue-40 text-white'
                      : 'bg-white border border-team-blue-40'
                  }
                />
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="teleBallsMissed"
                  className={isDarkMode ? 'text-white' : 'text-gray-700'}
                >
                  Balls Missed
                </Label>
                <Input
                  id="teleBallsMissed"
                  type="number"
                  value={formData.teleBallsMissed || 0}
                  onChange={e =>
                    handleNumericInputChange('teleBallsMissed', e.target.value)
                  }
                  disabled={isLoading}
                  className={
                    isDarkMode
                      ? 'bg-team-dark border border-team-blue-40 text-white'
                      : 'bg-white border border-team-blue-40'
                  }
                />
              </div>
            </div>
          </div>

          <div
            className={`p-4 rounded-xl border ${isDarkMode ? 'border-team-blue-40 bg-team-dark-20' : 'border-team-blue-40 bg-gray-50'}`}
          >
            <h4
              className={`font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-team-blue'}`}
            >
              Endgame
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label
                  htmlFor="robot1Park"
                  className={isDarkMode ? 'text-white' : 'text-gray-700'}
                >
                  Robot 1 Parking
                </Label>
                <Select
                  value={formData.robot1Park || 'none'}
                  onValueChange={value =>
                    handleInputChange('robot1Park', value)
                  }
                >
                  <SelectTrigger
                    id="robot1Park"
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
                    className={
                      isDarkMode ? 'bg-team-dark border-team-blue-40' : ''
                    }
                  >
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="partial">Partial</SelectItem>
                    <SelectItem value="full">Full</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="robot2Park"
                  className={isDarkMode ? 'text-white' : 'text-gray-700'}
                >
                  Robot 2 Parking
                </Label>
                <Select
                  value={formData.robot2Park || 'none'}
                  onValueChange={value =>
                    handleInputChange('robot2Park', value)
                  }
                >
                  <SelectTrigger
                    id="robot2Park"
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
                    className={
                      isDarkMode ? 'bg-team-dark border-team-blue-40' : ''
                    }
                  >
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="partial">Partial</SelectItem>
                    <SelectItem value="full">Full</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>

        <div
          className={`border-t px-6 py-4 flex gap-3 justify-end ${isDarkMode ? 'border-team-blue-40 bg-team-dark' : 'border-team-blue-40 bg-gray-50'}`}
        >
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
            className="min-w-[100px]"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isLoading}
            className={`min-w-[120px] bg-team-blue hover:bg-team-blue/90 flex items-center gap-2 ${isDarkMode ? 'text-black' : 'text-white'}`}
          >
            {isLoading ? (
              <>
                <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Saving...
              </>
            ) : initialMatch ? (
              'Update Match'
            ) : (
              'Add Match'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
