import { useEffect, useRef } from 'react';
import { useSession } from '@/contexts';

export const useMatchAudio = () => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hasPlayedRef = useRef<boolean>(false);
  const { matchActive, matchPhase, isTimerRunning, isPreMatchDelay } = useSession();

  // Initialize audio element
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio('/audio/match-audio.mp3');
      audioRef.current.volume = 0.8;
    }
  }, []);

  // Play audio when match starts (any mode: Full Game, Autonomous, or Teleop)
  useEffect(() => {
    if (matchActive && (isTimerRunning || isPreMatchDelay)) {
      if (!hasPlayedRef.current) {
        hasPlayedRef.current = true;
        audioRef.current?.play().catch((err) => {
          console.log('Audio autoplay blocked or error:', err);
        });
      }
    }
  }, [matchActive, isTimerRunning, isPreMatchDelay]);

  // Stop and reset audio when match becomes inactive
  useEffect(() => {
    if (!matchActive) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      hasPlayedRef.current = false;
    }
  }, [matchActive]);

  // Pause/resume audio when timer pauses/resumes (but keep playing during pre-match delay)
  useEffect(() => {
    if (matchActive && audioRef.current) {
      if (isTimerRunning || isPreMatchDelay) {
        audioRef.current.play().catch(() => {
          // Silently fail if autoplay is blocked
        });
      } else if (matchPhase !== 'controller_pickup' && matchPhase !== 'prepare') {
        // Only pause audio during actual user pause, not during phase transitions
        audioRef.current.pause();
      }
    }
  }, [isTimerRunning, matchActive, isPreMatchDelay, matchPhase]);

  return audioRef;
};
