import { useState, useCallback, useEffect } from 'react';
import { useTheme } from '@/contexts';
import { AlertCircle } from 'lucide-react';

import type { MotifColor } from '@/types';

interface MotifSetupDialogProps {
  isOpen: boolean;
  onConfirm: (pattern: MotifColor[]) => void;
  onCancel: () => void;
  initialPattern?: MotifColor[];
}

export const MotifSetupDialog = ({
  isOpen,
  onConfirm,
  onCancel,
  initialPattern,
}: MotifSetupDialogProps) => {
  const { isDarkMode } = useTheme();
  const [motifPattern, setMotifPattern] = useState<MotifColor[]>(
    initialPattern ?? ['empty', 'empty', 'empty']
  );

  useEffect(() => {
    if (isOpen && initialPattern) {
      setMotifPattern(initialPattern);
    }
  }, [isOpen, initialPattern]);

  const handleSlotClick = useCallback((slotIndex: number) => {
    setMotifPattern((prev) => {
      const newPattern = [...prev];
      const current = newPattern[slotIndex];
      // Cycle: purple → green → purple (no empty)
      if (current === 'purple') newPattern[slotIndex] = 'green';
      else newPattern[slotIndex] = 'purple';
      return newPattern as MotifColor[];
    });
  }, []);

  const purpleCount = motifPattern.filter(c => c === 'purple').length;
  const greenCount = motifPattern.filter(c => c === 'green').length;
  const isComplete = purpleCount === 2 && greenCount === 1;

  const getMotifSlotStyle = (color: MotifColor) => {
    if (color === 'purple') {
      return isDarkMode
        ? 'bg-purple-500 border-purple-400'
        : 'bg-purple-400 border-purple-500';
    }
    if (color === 'green') {
      return isDarkMode
        ? 'bg-emerald-500 border-emerald-400'
        : 'bg-emerald-400 border-emerald-500';
    }
    return isDarkMode
      ? 'bg-gray-800 border-gray-600'
      : 'bg-gray-200 border-gray-300';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200]">
      <div
        className={`rounded-2xl p-6 max-w-md w-full mx-4 space-y-4 ${
          isDarkMode ? 'bg-team-dark border border-team-blue/30' : 'bg-white border border-team-blue/20'
        }`}
      >
        <h2 className="text-xl font-bold text-center text-team-blue">Set Your Motif Pattern</h2>

        <div className={`text-sm p-3 rounded-lg flex items-start gap-2 ${
          isDarkMode ? 'bg-team-blue/10 border border-team-blue/30' : 'bg-team-blue/5 border border-team-blue/20'
        }`}>
          <AlertCircle className="w-4 h-4 text-team-blue flex-shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs">
            <p className="font-semibold">Before starting the match:</p>
            <p>Set exactly <span className="font-bold">2 purple</span> and <span className="font-bold">1 green</span></p>
            <p>
              <span className="font-bold">Click once</span> for{' '}
              <span className={isDarkMode ? 'text-purple-400' : 'text-purple-600'}>
                purple
              </span>
            </p>
            <p>
              <span className="font-bold">Click twice</span> for{' '}
              <span className={isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}>
                green
              </span>
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <p className={`text-sm font-semibold text-center ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Your 3-Ball Pattern</p>
          <div className="flex items-center gap-3 justify-center">
            {motifPattern.map((color, i) => (
              <button
                key={i}
                onClick={() => handleSlotClick(i)}
                className={`w-14 h-14 rounded-full border-3 transition-all duration-200 flex items-center justify-center text-sm font-bold cursor-pointer hover:scale-110 ${getMotifSlotStyle(
                  color
                )}`}
                title={`Slot ${i + 1}: ${color === 'empty' ? 'Not set' : color}`}
              >
                {color !== 'empty' && (
                  <div className="w-3 h-3 rounded-full bg-white/60" />
                )}
              </button>
            ))}
          </div>
        </div>

        {!isComplete && (
          <p
            className={`text-xs text-center ${
              isDarkMode ? 'text-gray-400' : 'text-gray-500'
            }`}
          >
            {purpleCount} purple, {greenCount} green — need 2 purple + 1 green
          </p>
        )}

        <div className="flex gap-3 pt-2">
          <button
            onClick={onCancel}
            className={`flex-1 px-4 py-2 rounded-lg border-2 text-sm font-bold transition-colors ${
              isDarkMode
                ? 'border-team-blue/30 bg-team-dark text-team-blue hover:bg-team-blue/10'
                : 'border-team-blue/20 bg-white text-team-blue hover:bg-team-blue/5'
            }`}
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(motifPattern)}
            disabled={!isComplete}
            className={`flex-1 px-4 py-2 rounded-lg border-2 text-sm font-bold transition-colors flex items-center justify-center ${
              isComplete
                ? 'border-green-500/40 bg-green-500/20 hover:bg-green-500/30 text-green-600'
                : 'border-green-500/20 bg-green-500/10 text-green-600/50 cursor-not-allowed opacity-50'
            }`}
          >
            Save Motif
          </button>
        </div>
      </div>
    </div>
  );
};
