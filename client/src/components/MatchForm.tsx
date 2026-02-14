import { useState } from 'react';
import type { Match } from '@/types';
import { useTheme } from '@/contexts';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
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
    matchNumber: initialMatch?.matchNumber || 1,
    matchType: initialMatch?.matchType || 'Full Game',
    finalScore: initialMatch?.finalScore || 0,
    autonomousScore: initialMatch?.autonomousScore || 0,
    teleOpScore: initialMatch?.teleOpScore || 0,
    endGameScore: initialMatch?.endGameScore || 0,
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
  });

  const handleInputChange = (field: string, value: number | string) => {
    setFormData(prev => ({
      ...prev,
      [field]: typeof value === 'string' ? value : value,
    }));
  };

  const handleNumericInputChange = (field: string, value: string) => {
    const numValue = parseInt(value) || 0;
    handleInputChange(field, numValue);
  };

  const handleSave = async () => {
    try {
      // Validate required fields
      if (!formData.matchNumber || formData.matchNumber <= 0) {
        toast.error('Match number must be greater than 0');
        return;
      }

      await onSave(formData);
      onClose();
      setFormData({
        matchNumber: 1,
        matchType: 'Full Game',
        finalScore: 0,
        autonomousScore: 0,
        teleOpScore: 0,
        endGameScore: 0,
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
        className={`max-w-2xl max-h-[90vh] overflow-y-auto ${
          isDarkMode ? 'bg-team-dark' : 'bg-white'
        }`}
      >
        <DialogHeader>
          <DialogTitle
            className={isDarkMode ? 'text-white' : 'text-team-blue'}
          >
            {initialMatch ? 'Edit Match' : 'Add New Match'}
          </DialogTitle>
          <DialogDescription
            className={
              isDarkMode ? 'text-team-white-60' : 'text-team-blue-40'
            }
          >
            {initialMatch
              ? 'Update the match details below'
              : 'Enter the details for the new match'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 px-6 py-4">
          {/* Match Number and Type */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="matchNumber" className={isDarkMode ? 'text-white' : ''}>
                Match Number
              </Label>
              <Input
                id="matchNumber"
                type="number"
                min="1"
                value={formData.matchNumber || 1}
                onChange={e => handleNumericInputChange('matchNumber', e.target.value)}
                disabled={isLoading}
                className={isDarkMode ? 'bg-team-dark-20 border-team-blue-40 text-white' : ''}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="matchType" className={isDarkMode ? 'text-white' : ''}>
                Match Type
              </Label>
              <Select
                value={formData.matchType || 'Full Game'}
                onValueChange={value =>
                  handleInputChange('matchType', value)
                }
              >
                <SelectTrigger
                  id="matchType"
                  disabled={isLoading}
                  className={isDarkMode ? 'bg-team-dark-20 border-team-blue-40 text-white' : ''}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent
                  className={isDarkMode ? 'bg-team-dark border-team-blue-40' : ''}
                >
                  <SelectItem value="Full Game">Full Game</SelectItem>
                  <SelectItem value="Autonomous">Autonomous</SelectItem>
                  <SelectItem value="TeleOp">TeleOp</SelectItem>
                  <SelectItem value="Practice">Practice</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Scores */}
          <div>
            <h4 className={`font-semibold mb-3 ${isDarkMode ? 'text-white' : ''}`}>
              Scoring
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="finalScore" className={isDarkMode ? 'text-white' : ''}>
                  Final Score
                </Label>
                <Input
                  id="finalScore"
                  type="number"
                  value={formData.finalScore || 0}
                  onChange={e =>
                    handleNumericInputChange('finalScore', e.target.value)
                  }
                  disabled={isLoading}
                  className={isDarkMode ? 'bg-team-dark-20 border-team-blue-40 text-white' : ''}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="autonomousScore" className={isDarkMode ? 'text-white' : ''}>
                  Autonomous Score
                </Label>
                <Input
                  id="autonomousScore"
                  type="number"
                  value={formData.autonomousScore || 0}
                  onChange={e =>
                    handleNumericInputChange('autonomousScore', e.target.value)
                  }
                  disabled={isLoading}
                  className={isDarkMode ? 'bg-team-dark-20 border-team-blue-40 text-white' : ''}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="teleOpScore" className={isDarkMode ? 'text-white' : ''}>
                  TeleOp Score
                </Label>
                <Input
                  id="teleOpScore"
                  type="number"
                  value={formData.teleOpScore || 0}
                  onChange={e =>
                    handleNumericInputChange('teleOpScore', e.target.value)
                  }
                  disabled={isLoading}
                  className={isDarkMode ? 'bg-team-dark-20 border-team-blue-40 text-white' : ''}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endGameScore" className={isDarkMode ? 'text-white' : ''}>
                  End Game Score
                </Label>
                <Input
                  id="endGameScore"
                  type="number"
                  value={formData.endGameScore || 0}
                  onChange={e =>
                    handleNumericInputChange('endGameScore', e.target.value)
                  }
                  disabled={isLoading}
                  className={isDarkMode ? 'bg-team-dark-20 border-team-blue-40 text-white' : ''}
                />
              </div>
            </div>
          </div>

          {/* Autonomous Details */}
          <div>
            <h4 className={`font-semibold mb-3 ${isDarkMode ? 'text-white' : ''}`}>
              Autonomous Phase
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="autonClassifiedArtifact" className={isDarkMode ? 'text-white' : ''}>
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
                  className={isDarkMode ? 'bg-team-dark-20 border-team-blue-40 text-white' : ''}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="autonOverflowArtifact" className={isDarkMode ? 'text-white' : ''}>
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
                  className={isDarkMode ? 'bg-team-dark-20 border-team-blue-40 text-white' : ''}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="autonMotif" className={isDarkMode ? 'text-white' : ''}>
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
                  className={isDarkMode ? 'bg-team-dark-20 border-team-blue-40 text-white' : ''}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="autonLeave" className={isDarkMode ? 'text-white' : ''}>
                  Leaves
                </Label>
                <Input
                  id="autonLeave"
                  type="number"
                  value={formData.autonLeave || 0}
                  onChange={e =>
                    handleNumericInputChange('autonLeave', e.target.value)
                  }
                  disabled={isLoading}
                  className={isDarkMode ? 'bg-team-dark-20 border-team-blue-40 text-white' : ''}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="autonBallsMissed" className={isDarkMode ? 'text-white' : ''}>
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
                  className={isDarkMode ? 'bg-team-dark-20 border-team-blue-40 text-white' : ''}
                />
              </div>
            </div>
          </div>

          {/* TeleOp Details */}
          <div>
            <h4 className={`font-semibold mb-3 ${isDarkMode ? 'text-white' : ''}`}>
              TeleOp Phase
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="teleClassifiedArtifact" className={isDarkMode ? 'text-white' : ''}>
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
                  className={isDarkMode ? 'bg-team-dark-20 border-team-blue-40 text-white' : ''}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="teleOverflowArtifact" className={isDarkMode ? 'text-white' : ''}>
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
                  className={isDarkMode ? 'bg-team-dark-20 border-team-blue-40 text-white' : ''}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="teleMotif" className={isDarkMode ? 'text-white' : ''}>
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
                  className={isDarkMode ? 'bg-team-dark-20 border-team-blue-40 text-white' : ''}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="teleBallsMissed" className={isDarkMode ? 'text-white' : ''}>
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
                  className={isDarkMode ? 'bg-team-dark-20 border-team-blue-40 text-white' : ''}
                />
              </div>
            </div>
          </div>

          {/* End Game / Parking */}
          <div>
            <h4 className={`font-semibold mb-3 ${isDarkMode ? 'text-white' : ''}`}>
              End Game / Parking
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="robot1Park" className={isDarkMode ? 'text-white' : ''}>
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
                    className={isDarkMode ? 'bg-team-dark-20 border-team-blue-40 text-white' : ''}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent
                    className={isDarkMode ? 'bg-team-dark border-team-blue-40' : ''}
                  >
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="partial">Partial</SelectItem>
                    <SelectItem value="full">Full</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="robot2Park" className={isDarkMode ? 'text-white' : ''}>
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
                    className={isDarkMode ? 'bg-team-dark-20 border-team-blue-40 text-white' : ''}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent
                    className={isDarkMode ? 'bg-team-dark border-team-blue-40' : ''}
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

        <div className={`border-t px-6 py-4 flex gap-2 justify-end ${isDarkMode ? 'border-team-blue-40' : 'border-gray-200'}`}>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isLoading}>
            {isLoading ? 'Saving...' : initialMatch ? 'Update Match' : 'Add Match'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
